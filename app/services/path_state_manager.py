"""路径状态管理器 — 管理学习路径执行状态的生命周期

职责：
- 初始化路径：选择科目+目标 → 调用 PathPlanner 生成拓扑图 → 持久化状态
- 更新进度：用户完成/跳过一个节点后推进游标
- 获取状态：返回当前阶段 + 焦点节点 + 节点执行顺序
- 重新开始：保留历史版本，创建新路径
"""

import logging
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.models.path_state import LearningPathState
from app.models.question_bank import KnowledgePoint, KnowledgeDomain, Subject, KnowledgePointRecord
from app.schemas.path_state import (
    PathStateData, PathStateResponse, PathInitResponse,
    CurrentNodeInfo, NodeOrderItem, PathProgress,
)

logger = logging.getLogger(__name__)

PHASE_ORDER = ["diagnosis", "learning", "practice", "review", "completed"]


class PathStateManager:
    """学习路径状态管理器"""

    def __init__(self, db: Session):
        self.db = db

    # ── 获取当前路径状态 ──
    def get_state(self, user_id: str, state_id: Optional[str] = None) -> PathStateResponse:
        """获取用户路径执行状态

        Args:
            user_id: 用户 ID
            state_id: 可选，指定路径 ID；不传则返回最近的活跃路径
        """
        if state_id:
            state = (
                self.db.query(LearningPathState)
                .filter(
                    LearningPathState.id == state_id,
                    LearningPathState.user_id == user_id,
                )
                .first()
            )
        else:
            state = (
                self.db.query(LearningPathState)
                .filter(
                    LearningPathState.user_id == user_id,
                    LearningPathState.phase != "completed",
                )
                .order_by(LearningPathState.updated_at.desc())
                .first()
            )

        if not state:
            return PathStateResponse(has_active_path=False)

        # 构建当前节点信息
        current_node = None
        if state.current_node_id:
            point = self.db.query(KnowledgePoint).filter(
                KnowledgePoint.id == state.current_node_id
            ).first()
            if point:
                record = (
                    self.db.query(KnowledgePointRecord)
                    .filter(
                        KnowledgePointRecord.user_id == user_id,
                        KnowledgePointRecord.point_id == state.current_node_id,
                    )
                    .first()
                )
                reason = self._build_reason(state, point, record)
                current_node = CurrentNodeInfo(
                    node_id=str(state.current_node_id),
                    name=point.name,
                    domain_name=point.domain.name if point.domain else "",
                    mastery_score=record.mastery_score if record else 0,
                    status="active",
                    reason=reason,
                )

        # 预先批量查询所有知识点的最新掌握度（实时合并 KPR → node_order）
        all_node_ids = [item.get("node_id", "") for item in (state.node_order or []) if item.get("node_id")]
        kpr_map: dict[str, int] = {}
        if all_node_ids:
            try:
                from uuid import UUID as UuidLib
                uuids = [UuidLib(nid) for nid in all_node_ids if len(nid) == 36]
                if uuids:
                    records = (
                        self.db.query(KnowledgePointRecord)
                        .filter(
                            KnowledgePointRecord.user_id == user_id,
                            KnowledgePointRecord.point_id.in_(uuids),
                        )
                        .all()
                    )
                    for r in records:
                        kpr_map[str(r.point_id)] = r.mastery_score or 0
            except Exception:
                pass

        # 构建 node_order（使用 KPR 最新数据覆盖 stale 缓存）
        node_order = []
        for item in state.node_order or []:
            nid = item.get("node_id", "")
            live_mastery = kpr_map.get(nid)
            if live_mastery is not None:
                ms = live_mastery
            else:
                ms = item.get("mastery_score", 0)
            node_order.append(NodeOrderItem(
                node_id=nid,
                name=item.get("name", ""),
                domain_name=item.get("domain_name", ""),
                status=item.get("status", "pending"),
                mastery_score=ms,
                sort_order=item.get("sort_order", 0),
                started_at=item.get("started_at"),
                completed_at=item.get("completed_at"),
            ))

        # 计算进度
        done_count = sum(1 for n in state.node_order or [] if n.get("status") == "done")
        total = state.total_nodes or len(state.node_order or [])
        progress = PathProgress(
            total=total,
            completed=done_count,
            skipped=sum(1 for n in state.node_order or [] if n.get("status") == "skipped"),
            percentage=round(done_count / max(total, 1) * 100),
        )

        return PathStateResponse(
            has_active_path=True,
            state=PathStateData(
                id=str(state.id),
                phase=state.phase,
                goal_type=state.goal_type or "",
                goal_description=state.goal_description or "",
                current_node=current_node,
                node_order=node_order,
                progress=progress,
                version=state.version,
                subject_id=str(state.subject_id) if state.subject_id else None,
                created_at=state.created_at,
                updated_at=state.updated_at,
            ),
        )

    # ── 初始化路径 ──
    def init_path(
        self,
        user_id: str,
        subject_id: str,
        goal_type: str = "",
        goal_description: str = "",
    ) -> PathInitResponse:
        """为新用户或重规划用户初始化学习路径

        流程：
        1. 获取该学科下的所有知识点（按 domain.sort_order, point.sort_order 排序）
        2. 获取用户掌握度记录
        3. 生成 node_order（拓扑排序后的执行顺序）
        4. 将已掌握(>=80%)的节点标记为 done，未开始的按顺序推进
        5. 设置第一个未完成节点为 current_node
        """
        # 验证并转换 UUID（防止 500 错误）
        try:
            user_uuid = UUID(user_id)
            subject_uuid = UUID(subject_id)
        except (ValueError, TypeError, AttributeError) as e:
            raise ValueError(f"参数格式错误：用户ID或学科ID不是有效的UUID。user_id={user_id[:20]}..., subject_id={subject_id[:20]}...")

        # 验证学科存在
        subject = self.db.query(Subject).filter(Subject.id == subject_uuid).first()
        if not subject:
            raise ValueError(f"学科不存在：{subject_id}")
        subj_name = subject.name

        # 删除旧路径（同一科目），但保留种子路径
        old_states = (
            self.db.query(LearningPathState)
            .filter(
                LearningPathState.user_id == user_uuid,
                LearningPathState.subject_id == subject_uuid,
                LearningPathState.phase != "completed",
            )
            .all()
        )
        for old in old_states:
            if old.ai_metadata and old.ai_metadata.get("is_seed"):
                continue
            old.phase = "completed"
            old.updated_at = datetime.utcnow()

        # 获取该学科下所有知识点（按层级排序）
        domains = (
            self.db.query(KnowledgeDomain)
            .filter(KnowledgeDomain.subject_id == subject_uuid)
            .order_by(KnowledgeDomain.sort_order)
            .all()
        )

        # 获取用户所有知识点记录
        records = (
            self.db.query(KnowledgePointRecord)
            .filter(KnowledgePointRecord.user_id == user_uuid)
            .all()
        )
        records_map = {str(r.point_id): r for r in records}

        # 构建 node_order
        node_order = []
        for domain in domains:
            points = (
                self.db.query(KnowledgePoint)
                .filter(KnowledgePoint.domain_id == domain.id)
                .order_by(KnowledgePoint.sort_order)
                .all()
            )
            for pt in points:
                record = records_map.get(str(pt.id))
                mastery = record.mastery_score if record else 0
                # 掌握度 >= 80% 且练习过 → 已完成
                if mastery >= 80 and record and record.total_practiced > 0:
                    status = "done"
                # 掌握度 0 且从未学习 → 待学习
                elif mastery == 0 and (not record or record.study_count == 0):
                    status = "pending"
                # 中间状态 → 学习中
                else:
                    status = "pending" if mastery < 60 else "done"

                node_order.append({
                    "node_id": str(pt.id),
                    "name": pt.name,
                    "domain_name": domain.name,
                    "status": status,
                    "mastery_score": mastery,
                    "sort_order": pt.sort_order,
                    "started_at": None,
                    "completed_at": datetime.utcnow().isoformat() if status == "done" else None,
                })

        total = len(node_order)
        done_count = sum(1 for n in node_order if n["status"] == "done")
        has_existing_data = any(r.mastery_score > 0 or r.total_practiced > 0 for r in records)

        # 找到第一个 pending 节点设为 active（当前焦点）
        current_node_id = None
        current_node_name = None
        first_pending = next((n for n in node_order if n["status"] == "pending"), None)
        if first_pending:
            first_pending["status"] = "active"
            current_node_id = UUID(first_pending["node_id"])
            current_node_name = first_pending["name"]

        # 确定初始阶段：
        # - 用户无任何学习数据 → 从 diagnosis（诊断）阶段开始
        # - 有数据但还有未掌握的点 → learning
        # - 全部完成 → completed
        if done_count >= total and total > 0:
            initial_phase = "completed"
        elif not has_existing_data and total > 0:
            initial_phase = "diagnosis"  # 新用户：先做学情诊断
        else:
            initial_phase = "learning"

        # 创建新状态
        state = LearningPathState(
            user_id=user_uuid,
            subject_id=subject_uuid,
            goal_type=goal_type or "",
            goal_description=goal_description or "",
            phase=initial_phase,
            current_node_id=current_node_id,
            current_node_name=current_node_name,
            node_order=node_order,
            total_nodes=total,
            completed_nodes=done_count,
            version=1,
        )
        self.db.add(state)
        self.db.commit()
        self.db.refresh(state)

        return PathInitResponse(
            state_id=str(state.id),
            message=f"学习路径已创建！学科「{subj_name}」，共 {total} 个知识点，已掌握 {done_count} 个",
            phase=initial_phase,
            total_nodes=total,
        )

    # ── 确认 AI 生成的路径 ──
    def confirm_path(
        self,
        user_id: str,
        subject_id: str,
        goal_type: str,
        goal_description: str,
        generated_path: Dict[str, Any],
    ) -> PathInitResponse:
        """将 AI 生成的个性化路径持久化到状态机

        Args:
            user_id: 用户 ID
            subject_id: 学科 ID
            goal_type: 目标类型
            goal_description: 目标描述
            generated_path: AI 返回的完整路径数据（来自 POST /path/generate 的响应）
                {path_name, description, phases, daily_suggestion, strategy_notes,
                 generation_reason, nodes: [{id, name, domain_name, difficulty, mastery_score}]}
        """
        # 1. 完成该用户同一 subject 的旧路径（但保留种子路径）
        old_states = (
            self.db.query(LearningPathState)
            .filter(
                LearningPathState.user_id == user_id,
                LearningPathState.subject_id == subject_id,
                LearningPathState.phase != "completed",
            )
            .all()
        )
        for old in old_states:
            # 保留种子学习路径，不标记为完成
            if old.ai_metadata and old.ai_metadata.get("is_seed"):
                continue
            old.phase = "completed"
            old.updated_at = datetime.utcnow()

        # 获取学科名称
        subject = self.db.query(Subject).filter(Subject.id == subject_id).first()
        subj_name = subject.name if subject else ""

        # 2. 按 AI 生成的 nodes 顺序构建 node_order
        ai_nodes = generated_path.get("nodes", [])
        node_order = []
        for node in ai_nodes:
            node_order.append({
                "node_id": node.get("id", ""),
                "name": node.get("name", ""),
                "domain_name": node.get("domain_name", ""),
                "status": "pending",
                "mastery_score": node.get("mastery_score", 0),
                "sort_order": node.get("sort_order", 0),
                "started_at": None,
                "completed_at": None,
            })

        total = len(node_order)
        if total == 0:
            return PathInitResponse(
                state_id="",
                message="路径为空，无法保存",
                phase="completed",
                total_nodes=0,
            )

        # 3. 设置第一个未掌握节点为 active
        current_node_id = None
        current_node_name = None
        first_pending = next(
            (n for n in node_order if n.get("mastery_score", 0) < 80),
            None,
        )
        if first_pending:
            first_pending["status"] = "active"
            current_node_id = UUID(first_pending["node_id"])
            current_node_name = first_pending["name"]
        elif node_order:
            # All mastered — set first one active anyway
            node_order[0]["status"] = "active"
            current_node_id = UUID(node_order[0]["node_id"])
            current_node_name = node_order[0]["name"]

        # 4. 创建 LearningPathState（含 AI 元数据）
        state = LearningPathState(
            user_id=UUID(user_id),
            subject_id=UUID(subject_id),
            goal_type=goal_type or "",
            goal_description=goal_description or "",
            phase="learning",
            current_node_id=current_node_id,
            current_node_name=current_node_name,
            node_order=node_order,
            total_nodes=total,
            completed_nodes=0,
            version=1,
            ai_metadata={
                "path_name": generated_path.get("path_name", ""),
                "description": generated_path.get("description", ""),
                "phases": generated_path.get("phases", []),
                "strategy_notes": generated_path.get("strategy_notes", []),
                "daily_suggestion": (
                    generated_path["daily_suggestion"]
                    if generated_path.get("daily_suggestion")
                    else None
                ),
                "generation_reason": generated_path.get("generation_reason", ""),
                "total_days": generated_path.get("total_days", 0),
            },
        )
        self.db.add(state)
        self.db.commit()
        self.db.refresh(state)

        logger.info(
            f"AI 路径已确认: user={user_id}, subject={subj_name}, "
            f"path_name={generated_path.get('path_name', 'N/A')}, "
            f"total={total}, state_id={state.id}"
        )

        return PathInitResponse(
            state_id=str(state.id),
            message=f"个性化学习路径已保存！学科「{subj_name}」，「{generated_path.get('path_name', '')}」，共 {total} 个知识点",
            phase="learning",
            total_nodes=total,
        )

    # ── 更新节点进度 ──
    def replan_path(
        self,
        user_id: str,
        state_id: Optional[str] = None,
        trigger: str = "manual",
    ) -> Dict[str, Any]:
        """Reorder unfinished nodes using the latest mastery records."""
        state = self._get_target_state(user_id, state_id)
        if not state:
            return {"success": False, "message": "没有活跃的学习路径，请先创建路径"}

        original_order = list(state.node_order or [])
        if not original_order:
            return {"success": False, "message": "当前路径没有可调整的知识点"}

        new_order, changed_count = self._build_dynamic_order(user_id, original_order)
        next_node = self._activate_first_pending(state, new_order)

        state.node_order = new_order
        flag_modified(state, "node_order")
        state.completed_nodes = sum(1 for n in new_order if n.get("status") == "done")
        state.total_nodes = len(new_order)
        if not next_node and all(n.get("status") in ("done", "skipped") for n in new_order):
            state.phase = "completed"
        elif state.phase == "diagnosis":
            state.phase = "learning"
        state.version = (state.version or 0) + 1
        state.updated_at = datetime.utcnow()

        self.db.commit()

        return {
            "success": True,
            "message": "学习路径已根据最新掌握度动态调整",
            "trigger": trigger,
            "changed_count": changed_count,
            "current_node": {
                "node_id": next_node["node_id"],
                "name": next_node["name"],
            } if next_node else None,
            "phase": state.phase,
            "progress": {
                "completed": state.completed_nodes,
                "total": state.total_nodes,
                "percentage": round(state.completed_nodes / max(state.total_nodes, 1) * 100),
            },
        }

    def update_progress(
        self,
        user_id: str,
        node_id: str,
        action: str = "complete",
        state_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """上报节点完成或跳过

        action:
        - complete: 标记节点为 done，推进游标到下一个 pending 节点
        - skip: 标记节点为 skipped
        - unskip: 将 skipped 节点恢复为 pending

        state_id: 可选，指定路径 ID；不传则更新最近活跃路径
        """
        if state_id:
            state = (
                self.db.query(LearningPathState)
                .filter(
                    LearningPathState.id == state_id,
                    LearningPathState.user_id == user_id,
                )
                .first()
            )
        else:
            state = (
                self.db.query(LearningPathState)
                .filter(
                    LearningPathState.user_id == user_id,
                    LearningPathState.phase != "completed",
                )
                .order_by(LearningPathState.updated_at.desc())
                .first()
            )

        if not state:
            return {"success": False, "message": "没有活跃的学习路径，请先初始化"}

        node_order = list(state.node_order or [])
        now_iso = datetime.utcnow().isoformat()

        # 查找并更新目标节点
        updated_node = None
        for i, node in enumerate(node_order):
            if node.get("node_id") == node_id:
                if action == "complete":
                    node["status"] = "done"
                    node["completed_at"] = now_iso
                    # 清除当前焦点
                    if str(state.current_node_id) == node_id:
                        state.current_node_id = None
                        state.current_node_name = None
                elif action == "skip":
                    node["status"] = "skipped"
                    node["completed_at"] = now_iso
                    if str(state.current_node_id) == node_id:
                        state.current_node_id = None
                        state.current_node_name = None
                elif action == "unskip":
                    node["status"] = "pending"
                    node["completed_at"] = None
                updated_node = node
                break

        if not updated_node:
            return {"success": False, "message": "节点不存在于当前路径中"}

        # 推进游标：找到下一个 pending 节点设为 active
        node_order, changed_count = self._build_dynamic_order(user_id, node_order)
        next_node = self._activate_first_pending(state, node_order)

        if not next_node:
            # 所有节点都完成了 → 检查是否真的全部 done
            all_done = all(n.get("status") in ("done", "skipped") for n in node_order)
            if all_done:
                state.phase = "completed"

        # 更新统计
        state.node_order = node_order
        flag_modified(state, "node_order")  # 确保 SQLAlchemy 检测 JSONB 变更
        state.completed_nodes = sum(1 for n in node_order if n.get("status") == "done")
        state.total_nodes = len(node_order)
        state.version = (state.version or 0) + 1
        state.updated_at = datetime.utcnow()

        self.db.flush()
        self.db.commit()

        return {
            "success": True,
            "message": f"节点「{updated_node.get('name', '')}」已{'完成' if action != 'skip' else '跳过'}",
            "current_node": {
                "node_id": next_node["node_id"] if next_node else None,
                "name": next_node["name"] if next_node else None,
            } if next_node else None,
            "phase": state.phase,
            "progress": {
                "completed": state.completed_nodes,
                "total": state.total_nodes,
                "percentage": round(state.completed_nodes / max(state.total_nodes, 1) * 100),
            },
        }

    # ── 重新开始路径 ──
    def _get_target_state(self, user_id: str, state_id: Optional[str] = None) -> Optional[LearningPathState]:
        if state_id:
            return (
                self.db.query(LearningPathState)
                .filter(
                    LearningPathState.id == state_id,
                    LearningPathState.user_id == user_id,
                )
                .first()
            )
        return (
            self.db.query(LearningPathState)
            .filter(
                LearningPathState.user_id == user_id,
                LearningPathState.phase != "completed",
            )
            .order_by(LearningPathState.updated_at.desc())
            .first()
        )

    def _build_dynamic_order(self, user_id: str, node_order: List[Dict[str, Any]]) -> tuple[List[Dict[str, Any]], int]:
        node_ids = [n.get("node_id") for n in node_order if n.get("node_id")]
        uuid_ids = []
        for nid in node_ids:
            try:
                uuid_ids.append(UUID(str(nid)))
            except Exception:
                continue

        records_map: Dict[str, KnowledgePointRecord] = {}
        points_map: Dict[str, KnowledgePoint] = {}
        if uuid_ids:
            records = (
                self.db.query(KnowledgePointRecord)
                .filter(
                    KnowledgePointRecord.user_id == user_id,
                    KnowledgePointRecord.point_id.in_(uuid_ids),
                )
                .all()
            )
            records_map = {str(r.point_id): r for r in records}
            points = self.db.query(KnowledgePoint).filter(KnowledgePoint.id.in_(uuid_ids)).all()
            points_map = {str(p.id): p for p in points}

        prereq_map = self._get_prerequisite_map(points_map)

        fixed: List[Dict[str, Any]] = []
        remaining: List[Dict[str, Any]] = []
        original_remaining_ids: List[str] = []

        for idx, raw in enumerate(node_order):
            item = dict(raw)
            nid = str(item.get("node_id", ""))
            item["_original_index"] = idx
            record = records_map.get(nid)
            point = points_map.get(nid)

            if record:
                item["mastery_score"] = record.mastery_score or 0
            if point:
                item["sort_order"] = point.sort_order or item.get("sort_order", 0)
                if not item.get("domain_name") and point.domain:
                    item["domain_name"] = point.domain.name

            status = item.get("status", "pending")
            needs_rollback = bool(
                record
                and status == "done"
                and (
                    (record.consecutive_errors or 0) >= 3
                    or ((record.total_practiced or 0) > 0 and (record.mastery_score or 0) < 60)
                    or record.status == "reviewing"
                )
            )

            if status == "skipped":
                fixed.append(item)
                continue

            if status == "done" and not needs_rollback:
                fixed.append(item)
                continue

            if record and (record.mastery_score or 0) >= 80 and (record.total_practiced or 0) >= 3:
                item["status"] = "done"
                item["completed_at"] = item.get("completed_at") or datetime.utcnow().isoformat()
                fixed.append(item)
                continue

            blocked_by = self._blocking_prerequisites(nid, prereq_map, records_map, node_order)
            if blocked_by:
                item["status"] = "locked"
                item["blocked_by"] = blocked_by
            elif record and ((record.consecutive_errors or 0) >= 3 or record.status == "reviewing"):
                item["status"] = "reviewing"
                item["completed_at"] = None
            elif needs_rollback:
                item["status"] = "reviewing"
                item["completed_at"] = None
            else:
                item["status"] = "pending"
            original_remaining_ids.append(nid)
            remaining.append(item)

        remaining.sort(key=lambda n: self._dynamic_priority_key(
            n,
            records_map.get(str(n.get("node_id", ""))),
            points_map.get(str(n.get("node_id", ""))),
        ))

        changed_count = sum(
            1 for idx, item in enumerate(remaining)
            if idx >= len(original_remaining_ids) or str(item.get("node_id", "")) != original_remaining_ids[idx]
        )

        result = fixed + remaining
        for item in result:
            item.pop("_original_index", None)
        return result, changed_count

    def _dynamic_priority_key(
        self,
        item: Dict[str, Any],
        record: Optional[KnowledgePointRecord],
        point: Optional[KnowledgePoint],
    ) -> tuple:
        mastery = int(item.get("mastery_score") or 0)
        consecutive_errors = int(record.consecutive_errors or 0) if record else 0
        total_practiced = int(record.total_practiced or 0) if record else 0
        status = record.status if record else ""
        difficulty = int(point.difficulty or 1) if point else 1
        domain_order = point.domain.sort_order if point and point.domain else 0
        sort_order = int(item.get("sort_order") or 0)

        if item.get("status") == "locked":
            return (1, domain_order, sort_order, int(item.get("_original_index") or 0))

        priority = 0
        priority += max(0, 100 - mastery) * 10
        priority += consecutive_errors * 80
        if item.get("status") == "reviewing" or status == "reviewing" or consecutive_errors >= 3:
            priority += 600
        if total_practiced > 0 and mastery < 60:
            priority += 180
        priority += max(0, 4 - difficulty) * 25

        return (-priority, domain_order, sort_order, int(item.get("_original_index") or 0))

    def _get_prerequisite_map(self, points_map: Dict[str, KnowledgePoint]) -> Dict[str, set[str]]:
        if not points_map:
            return {}

        name_to_id = {p.name: pid for pid, p in points_map.items() if p.name}
        prereq_map: Dict[str, set[str]] = {}

        try:
            from app.db.neo4j import get_neo4j
            neo4j = get_neo4j()
            if not neo4j.verify_connectivity():
                return {}
            for edge in neo4j.get_all_prerequisite_edges():
                src_id = name_to_id.get(edge.get("source", ""))
                tgt_id = name_to_id.get(edge.get("target", ""))
                if src_id and tgt_id:
                    prereq_map.setdefault(tgt_id, set()).add(src_id)
        except Exception as e:
            logger.warning(f"获取路径前置依赖失败，跳过锁定规则: {e}")

        return prereq_map

    def _blocking_prerequisites(
        self,
        node_id: str,
        prereq_map: Dict[str, set[str]],
        records_map: Dict[str, KnowledgePointRecord],
        node_order: List[Dict[str, Any]],
    ) -> List[str]:
        prereq_ids = prereq_map.get(node_id) or set()
        if not prereq_ids:
            return []

        status_map = {str(n.get("node_id", "")): n.get("status", "pending") for n in node_order}
        blocked = []
        for prereq_id in prereq_ids:
            record = records_map.get(prereq_id)
            status = status_map.get(prereq_id)
            mastered = bool(record and (record.mastery_score or 0) >= 70)
            done = status in ("done", "skipped") or bool(record and record.status == "mastered")
            if not (done or mastered):
                blocked.append(prereq_id)
        return blocked

    def _activate_first_pending(
        self,
        state: LearningPathState,
        node_order: List[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        next_node = None
        for node in node_order:
            if node.get("status") == "active":
                node["status"] = "pending"
            if next_node is None and node.get("status") in ("reviewing", "pending"):
                next_node = node

        if next_node:
            if next_node.get("status") != "reviewing":
                next_node["status"] = "active"
            state.current_node_id = UUID(next_node["node_id"])
            state.current_node_name = next_node["name"]
        else:
            state.current_node_id = None
            state.current_node_name = None
        return next_node

    def restart_path(self, user_id: str) -> Dict[str, Any]:
        """结束当前路径，保留历史，并清零路径中知识点的掌握度"""
        state = (
            self.db.query(LearningPathState)
            .filter(
                LearningPathState.user_id == user_id,
                LearningPathState.phase != "completed",
            )
            .order_by(LearningPathState.updated_at.desc())
            .first()
        )

        if not state:
            return {"success": False, "message": "没有活跃的学习路径"}

        state.phase = "completed"
        state.updated_at = datetime.utcnow()

        # 清零路径中所有知识点的掌握度
        node_order = state.node_order or []
        point_ids = []
        for node in node_order:
            nid = node.get("node_id") if isinstance(node, dict) else node
            if nid:
                try:
                    point_ids.append(UUID(str(nid)))
                except (ValueError, AttributeError):
                    pass

        if point_ids:
            records = (
                self.db.query(KnowledgePointRecord)
                .filter(
                    KnowledgePointRecord.user_id == user_id,
                    KnowledgePointRecord.point_id.in_(point_ids),
                )
                .all()
            )
            for record in records:
                record.mastery_score = 0
                record.recent_accuracy = 0
                record.consecutive_errors = 0
                record.total_practiced = 0
                record.total_correct = 0
                record.total_time_spent_seconds = 0
                record.study_count = 0
                record.status = "not_started"
                record.next_review_at = None
                record.last_study_at = None
                record.last_practice_at = None

        self.db.commit()

        return {"success": True, "message": "路径已结束，知识点掌握度已清零，可以初始化新的学习路径"}

    # ── 辅助：构建推荐理由 ──
    def _build_reason(
        self,
        state: LearningPathState,
        point: KnowledgePoint,
        record: Optional[KnowledgePointRecord] = None,
    ) -> str:
        """为当前焦点节点生成推荐理由"""
        reasons = []

        # 检查前置依赖
        if point.domain:
            domain_points = (
                self.db.query(KnowledgePoint)
                .filter(
                    KnowledgePoint.domain_id == point.domain_id,
                    KnowledgePoint.sort_order < point.sort_order,
                )
                .all()
            )
            prev_done = True
            for prev_pt in domain_points:
                prev_record = (
                    self.db.query(KnowledgePointRecord)
                    .filter(
                        KnowledgePointRecord.user_id == state.user_id,
                        KnowledgePointRecord.point_id == prev_pt.id,
                    )
                    .first()
                )
                if not prev_record or prev_record.mastery_score < 80:
                    prev_done = False
                    break
            if prev_done and domain_points:
                reasons.append("前置知识已掌握，可以进入当前阶段")

        # 掌握度分析
        if record:
            if record.mastery_score < 30:
                reasons.append("当前掌握度较低，建议优先学习")
            elif record.mastery_score < 60:
                reasons.append("掌握度有待提升")
            elif record.consecutive_errors >= 3:
                reasons.append("连续错误较多，需要重新巩固")

        # 知识点重要度
        if point.difficulty and point.difficulty <= 2:
            reasons.append("基础知识点，建议先掌握")
        elif point.difficulty and point.difficulty >= 4:
            reasons.append("进阶知识点，学完可以解锁更多内容")

        if not reasons:
            reasons.append("按学习顺序推荐的下一个知识点")

        return "；".join(reasons)
