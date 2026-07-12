"""PathPlanningEngine — AI 个性化路径规划引擎

协调 Neo4j 知识图谱（硬约束）和 LLM（软优化）生成个性化学习路径。

架构：
  Stage 1: Neo4j 拓扑分析 → 合法偏序列表（硬约束）
  Stage 2: LLM 个性化排序 → 阶段划分/时间分配/策略建议（软优化）
  Stage 3: 持久化 → LearningPathState

仅使用用户自己配置的 LLM API，未配置则不可用。
"""

import logging
import json
from typing import Optional, Dict, Any, List, Tuple
from uuid import UUID

from sqlalchemy.orm import Session

from app.schemas.path_personalization import (
    PersonalizationContext, PathGenerationResponse,
    PhaseInfo, DailySuggestion,
)
from app.models.question_bank import KnowledgePoint, KnowledgeDomain, Subject
from app.models.path_state import LearningPathState
from app.db.neo4j import get_neo4j, Neo4jConnection
from app.services.path_planner import PathPlanner
from app.services.multi_agent.llm import LLMHelper
from app.core.config import settings

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════
#  LLM Prompt
# ═══════════════════════════════════════════════════════

PATH_GENERATION_SYSTEM_PROMPT = """你是一个个性化学习路径规划专家。你的任务是根据学生的完整画像和学科知识图谱，生成一条个性化的学习路径。

## 输入格式
你会收到一份结构化的学生画像报告，包含：
- 学生基本信息（专业、年级、学校）
- 学习目标（学科、目标类型、目标分数、截止日期）
- 认知风格（visual/auditory/reading_writing/kinesthetic/mixed）
- 学习行为（活跃时段、学习节奏、每日练习数据）
- 已有掌握度（如存在）
- 易错知识点（如存在）
- 完整的知识点列表（含难度和领域分组）
- 前置依赖关系摘要

## 输出要求
严格按照以下 JSON 格式输出，不要包含任何其他文字：

```json
{
  "path_name": "简洁有力的路径名称（≤15字）",
  "description": "路径总体描述（2-3句话，说明核心理念和主要策略）",
  "phases": [
    {
      "name": "阶段名称（如：基础巩固）",
      "days": 30,
      "focus": "本阶段学习重点（1句话）",
      "node_names": ["知识点1", "知识点2", ...]
    }
  ],
  "daily_suggestion": {
    "recommended_session_minutes": 60,
    "best_time": "下午",
    "tasks_per_day": 2,
    "note": "简短的学习时段建议"
  },
  "strategy_notes": [
    "个性化策略建议1（可引用认知风格、活跃时段等画像数据）",
    "个性化策略建议2",
    ...
  ],
  "priority_order": ["知识点名1", "知识点名2", ...]
}
```

## 规划规则
1. **前置依赖硬约束**：拓扑顺序中标记的 [→] 关系不可违反，前置知识点必须排在后面知识点之前
2. **基础优先**：difficulty ≤ 2 的基础知识点优先安排
3. **薄弱点聚焦**：掌握度 < 40% 的知识点重点标注，分配更多时间
4. **风格匹配**：
   - visual 型：建议多看图表/视频类资源
   - reading_writing 型：建议多读文档/整理笔记
   - kinesthetic 型：建议多动手做练习
   - auditory 型：建议多听讲解/口头复述
5. **时段匹配**：根据活跃时段建议最佳学习时间
6. **目标调整**：
   - 学期提升：稳健节奏，重视基础，每天1-2个知识点
   - 升学备考：加速节奏，侧重考点，每天2-4个知识点
   - 考级考证：效率优先，侧重重要度高的知识点
7. **阶段数量**：2-4个阶段，每个阶段包含3-15个知识点
8. **阶段天数计算**：总截止天数 / 阶段数，合理分配（不要全部挤在第一阶段）

## 重要提醒
- priority_order 必须包含所有知识点
- 阶段名称要具体有意义，不要用"阶段一"这样的名字
- 策略建议要个性化，明确提及学生的实际情况（如"作为CS专业大三学生"）"""


class PathPlanningEngine:
    """个性化路径规划引擎"""

    def __init__(self, db: Session):
        self.db = db
        self.llm = LLMHelper()

    async def generate(
        self,
        ctx: PersonalizationContext,
        goal_type: str = "",
    ) -> PathGenerationResponse:
        """生成个性化学习路径

        Args:
            ctx: 用户画像上下文
            goal_type: 目标类型，用于动态权重

        Returns:
            PathGenerationResponse: 个性化路径
        """
        # ── Step 1: 获取知识点列表 ──
        knowledge_points = self._get_knowledge_points(ctx)

        if not knowledge_points:
            return self._build_empty_response(ctx)

        # ── Step 2: 拓扑排序（Neo4j 硬约束）──
        topological_info = self._get_topological_info(ctx, knowledge_points)

        # ── Step 3: LLM 个性化 ──
        if ctx.has_llm_configured:
            llm_result = await self._call_llm(ctx, knowledge_points, topological_info)
        else:
            llm_result = None

        # ── Step 4: 构建响应 ──
        if not knowledge_points:
            return self._build_empty_response(ctx)

        if llm_result:
            return self._build_llm_response(ctx, llm_result, knowledge_points)
        else:
            return self._build_heuristic_response(ctx, knowledge_points, topological_info)

    def _build_empty_response(self, ctx: PersonalizationContext) -> PathGenerationResponse:
        """知识点为空时的响应"""
        return PathGenerationResponse(
            path_name="",
            description=f"学科「{ctx.subject_name}」暂无知识点，请联系管理员添加知识点后再生成学习路径。",
            total_days=0,
            total_nodes=0,
            phases=[],
            daily_suggestion=DailySuggestion(
                recommended_session_minutes=0,
                best_time="",
                tasks_per_day=0,
                note="学科知识点为空，无法规划学习路径",
            ),
            strategy_notes=["请先在题库管理中添加知识点及前置依赖关系"],
            generation_reason="学科知识点为空，无法生成路径",
            nodes=[],
            edges=[],
        )

    # ═══════════════════════════════════════════════════════
    #  Step 1: 获取知识点
    # ═══════════════════════════════════════════════════════

    def _get_knowledge_points(self, ctx: PersonalizationContext) -> List[Dict[str, Any]]:
        """从 PostgreSQL 获取学科下所有知识点"""
        try:
            if not ctx.subject_id:
                # 没有指定学科 → 获取所有知识点
                points = (
                    self.db.query(KnowledgePoint)
                    .order_by(KnowledgePoint.sort_order)
                    .all()
                )
            else:
                domains = (
                    self.db.query(KnowledgeDomain)
                    .filter(KnowledgeDomain.subject_id == ctx.subject_id)
                    .all()
                )
                domain_ids = [d.id for d in domains]
                if not domain_ids:
                    return []
                points = (
                    self.db.query(KnowledgePoint)
                    .filter(KnowledgePoint.domain_id.in_(domain_ids))
                    .order_by(KnowledgePoint.sort_order)
                    .all()
                )

            result = []
            for pt in points:
                domain_name = ""
                if pt.domain:
                    domain_name = pt.domain.name
                result.append({
                    "id": str(pt.id),
                    "name": pt.name,
                    "difficulty": pt.difficulty or 1,
                    "domain_name": domain_name,
                    "sort_order": pt.sort_order or 0,
                    "mastery_score": ctx.existing_mastery.get(str(pt.id), 0),
                })
            return result
        except Exception as e:
            self.db.rollback()
            logger.error(f"获取知识点失败: {e}")
            return []

    # ═══════════════════════════════════════════════════════
    #  Step 2: Neo4j 拓扑分析
    # ═══════════════════════════════════════════════════════

    def _get_topological_info(
        self, ctx: PersonalizationContext, kps: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """从 Neo4j 获取前置依赖关系"""
        result: Dict[str, Any] = {
            "prerequisite_pairs": [],   # [(前置, 后置), ...]
            "related_pairs": [],        # [(A, B), ...]
            "topological_layers": {},   # {知识点: 深度层级}
            "available": True,
        }

        try:
            neo4j = get_neo4j()
            if not neo4j.verify_connectivity():
                result["available"] = False
                return result

            # 获取所有前置依赖关系
            prereq_edges = neo4j.get_all_prerequisite_edges()
            kp_names = {kp["name"] for kp in kps}

            for edge in prereq_edges:
                src = edge.get("source", "")
                tgt = edge.get("target", "")
                if src in kp_names and tgt in kp_names:
                    result["prerequisite_pairs"].append((src, tgt))

            # 尝试用 PathPlanner 获取完整 DAG
            planner = PathPlanner(neo4j)
            # 使用现有的 plan 方法获取深度信息

            # 计算拓扑层级（简化版 BFS）
            # 入度为 0 → 层级 0，逐层递推
            in_degree: Dict[str, int] = {kp["name"]: 0 for kp in kps}
            adj: Dict[str, List[str]] = {kp["name"]: [] for kp in kps}

            for src, tgt in result["prerequisite_pairs"]:
                if src in adj and tgt in in_degree:
                    adj[src].append(tgt)
                    in_degree[tgt] = in_degree.get(tgt, 0) + 1

            # Kahn 算法计算层级
            queue = [(name, 0) for name in kp_names if in_degree.get(name, 0) == 0]
            layer: Dict[str, int] = {}
            for name in kp_names:
                if in_degree.get(name, 0) == 0:
                    layer[name] = 0

            ptr = 0
            queue_list = [name for name in kp_names if in_degree.get(name, 0) == 0]
            while ptr < len(queue_list):
                current = queue_list[ptr]
                ptr += 1
                current_layer = layer.get(current, 0)
                for neighbor in adj.get(current, []):
                    new_layer = current_layer + 1
                    if neighbor not in layer or layer[neighbor] < new_layer:
                        layer[neighbor] = new_layer
                    in_degree[neighbor] -= 1
                    if in_degree[neighbor] == 0:
                        queue_list.append(neighbor)

            result["topological_layers"] = layer

        except Exception as e:
            logger.warning(f"Neo4j 拓扑分析失败（降级处理）: {e}")
            result["available"] = False

        return result

    # ═══════════════════════════════════════════════════════
    #  Step 3: LLM 调用
    # ═══════════════════════════════════════════════════════

    async def _call_llm(
        self,
        ctx: PersonalizationContext,
        kps: List[Dict[str, Any]],
        topo_info: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """调用 LLM 生成个性化路径"""
        user_prompt = self._build_llm_prompt(ctx, kps, topo_info)

        # 获取用户 API 配置
        api_key = None
        base_url = None
        model = None

        valid_deepseek_models = set(settings.VALID_DEEPSEEK_MODELS.split(","))
        valid_qwen_models = set(settings.VALID_QWEN_MODELS.split(","))

        if ctx.api_settings.get("deepseek", {}).get("api_key"):
            ds = ctx.api_settings["deepseek"]
            api_key = ds["api_key"]
            base_url = ds.get("base_url") or settings.DEEPSEEK_BASE_URL
            raw_model = ds.get("model_version", "")
            model = raw_model if raw_model in valid_deepseek_models else settings.DEEPSEEK_MODEL
        elif ctx.api_settings.get("qwen", {}).get("api_key"):
            qw = ctx.api_settings["qwen"]
            api_key = qw["api_key"]
            base_url = qw.get("base_url") or settings.QWEN_BASE_URL
            raw_model = qw.get("model_version", "")
            model = raw_model if raw_model in valid_qwen_models else settings.QWEN_MODEL

        if not api_key:
            logger.warning("用户未配置 LLM API Key，无法使用 LLM 生成路径")
            return None

        try:
            result = await self.llm.chat_json(
                system_prompt=PATH_GENERATION_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.5,
                max_tokens=4096,
                api_key=api_key,
                base_url=base_url,
                model=model,
            )
            if result:
                logger.info(f"LLM 路径生成成功: path_name={result.get('path_name', 'N/A')}")
            return result
        except Exception as e:
            logger.error(f"LLM 调用失败: {e}", exc_info=True)
            return None

    def _build_llm_prompt(
        self,
        ctx: PersonalizationContext,
        kps: List[Dict[str, Any]],
        topo_info: Dict[str, Any],
    ) -> str:
        """构建发给 LLM 的完整 prompt"""
        lines = []

        # ── 学生画像 ──
        lines.append(ctx.to_llm_context())

        # ── 知识点列表 ──
        lines.append(f"\n## 知识点列表（共 {len(kps)} 个）")
        # 按领域分组
        domain_groups: Dict[str, List[Dict]] = {}
        for kp in kps:
            domain = kp.get("domain_name", "未分类")
            if domain not in domain_groups:
                domain_groups[domain] = []
            domain_groups[domain].append(kp)

        for domain, pts in domain_groups.items():
            lines.append(f"\n### {domain}（{len(pts)} 个知识点）")
            for pt in pts:
                diff_label = ["", "★", "★★", "★★★", "★★★★", "★★★★★"][
                    min(pt.get("difficulty", 1), 5)
                ]
                mastery = pt.get("mastery_score", 0)
                mastery_note = ""
                if mastery >= 80:
                    mastery_note = " [已掌握]"
                elif mastery > 0:
                    mastery_note = f" [掌握度{mastery}%]"
                lines.append(f"- {pt['name']} (难度{diff_label}){mastery_note}")

        # ── 拓扑关系 ──
        if topo_info.get("prerequisite_pairs"):
            lines.append(f"\n## 前置依赖关系（不可违反的硬约束）")
            lines.append('以下 [→] 表示「必须先学A才能学B」：')
            for src, tgt in topo_info["prerequisite_pairs"][:20]:
                lines.append(f"- {src} [→] {tgt}")

        if topo_info.get("topological_layers"):
            layers = topo_info["topological_layers"]
            max_layer = max(layers.values()) if layers else 0
            lines.append(f"\n拓扑层级深度: 0-{max_layer}层（层数越小越基础，应先学）")

        # ── 截止日期 ──
        if ctx.deadline:
            lines.append(f"\n## 时间约束")
            lines.append(f"截止日期: {ctx.deadline}")
            try:
                from datetime import datetime
                deadline_date = datetime.strptime(ctx.deadline, "%Y-%m-%d")
                days_remaining = (deadline_date - datetime.utcnow()).days
                if days_remaining > 0:
                    lines.append(f"剩余天数: {days_remaining} 天")
            except Exception:
                pass

        return "\n".join(lines)

    # ═══════════════════════════════════════════════════════
    #  Step 4: 构建响应
    # ═══════════════════════════════════════════════════════

    def _build_llm_response(
        self,
        ctx: PersonalizationContext,
        llm_result: Dict[str, Any],
        kps: List[Dict[str, Any]],
    ) -> PathGenerationResponse:
        """从 LLM 结果构建响应"""
        # 构建 node_id → name 映射
        name_to_id: Dict[str, str] = {}
        id_to_info: Dict[str, Dict] = {}
        for kp in kps:
            name_to_id[kp["name"]] = kp["id"]
            id_to_info[kp["id"]] = kp

        # 解析阶段
        phases = []
        for phase_data in llm_result.get("phases", []):
            node_names = phase_data.get("node_names", [])
            node_ids = [name_to_id.get(n, "") for n in node_names]
            node_ids = [nid for nid in node_ids if nid]  # 过滤空值
            phases.append(PhaseInfo(
                name=phase_data.get("name", ""),
                days=phase_data.get("days", 30),
                focus=phase_data.get("focus", ""),
                node_ids=node_ids,
                node_names=node_names,
            ))

        # 解析每日建议
        daily = llm_result.get("daily_suggestion", {})
        daily_suggestion = DailySuggestion(
            recommended_session_minutes=daily.get("recommended_session_minutes", 90),
            best_time=daily.get("best_time", "下午"),
            tasks_per_day=daily.get("tasks_per_day", 2),
            note=daily.get("note", ""),
        )

        # 构建节点列表（按 LLM 推荐的优先级排序）
        priority_order = llm_result.get("priority_order", [])
        ordered_kps = []
        seen = set()
        # 先按 LLM 顺序
        for name in priority_order:
            kp_id = name_to_id.get(name, "")
            if kp_id and kp_id not in seen:
                info = id_to_info.get(kp_id, {})
                ordered_kps.append({
                    "id": kp_id,
                    "name": name,
                    "domain_name": info.get("domain_name", ""),
                    "difficulty": info.get("difficulty", 1),
                    "mastery_score": info.get("mastery_score", 0),
                })
                seen.add(kp_id)
        # 补充 LLM 未覆盖的知识点
        for kp in kps:
            if kp["id"] not in seen:
                ordered_kps.append(kp)
                seen.add(kp["id"])

        # 计算总天数
        total_days = sum(p.days for p in phases)

        return PathGenerationResponse(
            path_name=llm_result.get("path_name", f"{ctx.subject_name}学习路径"),
            description=llm_result.get("description", ""),
            total_days=total_days,
            total_nodes=len(kps),
            phases=phases,
            daily_suggestion=daily_suggestion,
            strategy_notes=llm_result.get("strategy_notes", []),
            generation_reason="基于 Neo4j 知识图谱拓扑分析 + 大模型个性化规划",
            nodes=ordered_kps,
            edges=[],
        )

    def _build_heuristic_response(
        self,
        ctx: PersonalizationContext,
        kps: List[Dict[str, Any]],
        topo_info: Dict[str, Any],
    ) -> PathGenerationResponse:
        """启发式降级方案（LLM 不可用时）"""
        layers = topo_info.get("topological_layers", {})

        # 按拓扑层级 + 难度排序（基础知识点优先）
        sorted_kps = sorted(kps, key=lambda kp: (
            layers.get(kp["name"], 0),  # 先按拓扑层级
            kp.get("difficulty", 1),     # 再按难度
            kp.get("sort_order", 0),     # 最后按原始排序
        ))

        # 简单分阶段：前1/3基础、中1/3强化、后1/3冲刺
        n = len(sorted_kps)
        third = max(1, n // 3)
        # 合理计算天数：每个知识点 1-3 天，总天数 = n * 1.5，合理分配
        days_per_kp = 1.5
        # 根据goal_type调整节奏
        if ctx.goal_type == "升学备考":
            days_per_kp = 1.0
        elif ctx.goal_type == "考级考证":
            days_per_kp = 1.2

        phases = []
        if n > 0:
            phase1_kps = sorted_kps[:third]
            phase1_days = max(7, int(len(phase1_kps) * days_per_kp * 1.2))
            phases.append(PhaseInfo(
                name="基础入门",
                days=phase1_days,
                focus="掌握基础知识点，建立知识框架",
                node_ids=[kp["id"] for kp in phase1_kps],
                node_names=[kp["name"] for kp in phase1_kps],
            ))
        if n > third:
            phase2_kps = sorted_kps[third:2*third]
            phase2_days = max(7, int(len(phase2_kps) * days_per_kp))
            phases.append(PhaseInfo(
                name="强化提升",
                days=phase2_days,
                focus="攻克进阶知识点，加强练习",
                node_ids=[kp["id"] for kp in phase2_kps],
                node_names=[kp["name"] for kp in phase2_kps],
            ))
        if n > 2*third:
            phase3_kps = sorted_kps[2*third:]
            phase3_days = max(7, int(len(phase3_kps) * days_per_kp * 0.8))
            phases.append(PhaseInfo(
                name="综合冲刺",
                days=phase3_days,
                focus="综合复习与薄弱环节突破",
                node_ids=[kp["id"] for kp in phase3_kps],
                node_names=[kp["name"] for kp in phase3_kps],
            ))

        # 每日建议
        time_labels = {
            "morning": "早上",
            "afternoon": "下午",
            "evening": "晚上",
            "night": "深夜",
        }
        best_hour = max(ctx.active_hours, key=ctx.active_hours.get)  # type: ignore[arg-type]
        best_time = time_labels.get(best_hour, "下午")

        strategy_notes = [
            "当前使用启发式规则生成路径（AI 服务未配置）",
            "知识点按拓扑层级和难度排序，前置依赖关系已考虑",
            "建议配置 DeepSeek 或 Qwen API 以获得 AI 个性化规划",
        ]

        return PathGenerationResponse(
            path_name=f"{ctx.subject_name}学习路径",
            description=f"基于知识图谱拓扑分析和难度排序的启发式学习路径，共 {n} 个知识点，分为 {len(phases)} 个阶段。",
            total_days=sum(p.days for p in phases),
            total_nodes=n,
            phases=phases,
            daily_suggestion=DailySuggestion(
                recommended_session_minutes=60,
                best_time=best_time,
                tasks_per_day=2,
                note=f"根据你的注册数据，建议在{best_time}集中学习",
            ),
            strategy_notes=strategy_notes,
            generation_reason="基于 Neo4j 知识图谱拓扑分析 + 启发式规则（用户未配置 AI 服务）",
            nodes=[{
                "id": kp["id"],
                "name": kp["name"],
                "domain_name": kp.get("domain_name", ""),
                "difficulty": kp.get("difficulty", 1),
                "mastery_score": kp.get("mastery_score", 0),
            } for kp in sorted_kps],
            edges=[],
        )


# ── 工厂函数 ──

def get_path_planning_engine(db: Session) -> PathPlanningEngine:
    """获取 PathPlanningEngine 实例"""
    return PathPlanningEngine(db)
