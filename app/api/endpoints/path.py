"""学习路径 V3 API — 动态学习路径系统（含状态机）+ AI 个性化路径

- POST /path/generate                        AI 个性化路径生成（LLM混合）
- GET  /path/check-api                      检查 LLM API 可用性
- POST /path/style-assessment               提交学习风格评估
- POST /path/init                           初始化学习路径（创建状态机）
- GET  /path/state                          获取当前路径执行状态
- POST /path/progress                       上报节点进度，推进状态机
- POST /path/restart                        重新开始路径
- GET  /path/current                        获取学习路径（节点状态 + DAG 图数据）
- GET  /path/agent/recommend                获取 Agent 推荐列表
- POST /path/agent/accept                   接受 Agent 建议
- POST /path/agent/reject                   拒绝 Agent 建议
- GET  /path/knowledge/{point_id}           获取知识点详情
- POST /path/knowledge/{point_id}/record-study  记录知识点了解
- GET  /path/history                        获取路径调整历史
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
import logging

from sqlalchemy.orm import Session
from app.db.database import get_db
from app.api.dependencies import CurrentUser, get_current_user
from app.models.question_bank import (
    KnowledgePoint, KnowledgeDomain, Subject,
    KnowledgePointRecord, PathHistory, Question,
)
from app.models.path_state import LearningPathState
from app.schemas.question_bank import (
    KnowledgePointRecordResponse, PathNodeStatus,
    LearningPathMarkdownResponse, PathHistoryItem, PathHistoryResponse,
    AgentRecommendation, AgentRecommendationListResponse,
)
from app.services.path_generator import build_summary, generate_empty_path
from app.services.mastery_calculator import calculate_mastery
from app.services.learning_agent import LearningAgent
from app.services.path_planner import PathPlanner
from app.services.path_state_manager import PathStateManager
from app.services.knowledge_lecture_builder import (
    build_lecture_prompt,
    build_source_based_lecture,
)
from app.core.config import settings
from app.db.neo4j import get_neo4j
from app.schemas.question_bank import DagData, DagNode, DagEdge
from app.schemas.path_state import (
    PathStateResponse, PathInitRequest, PathInitResponse,
    PathProgressRequest,
)
from app.schemas.path_personalization import (
    PathGenerationRequest, PathGenerationResponse,
    ApiCheckResponse, StyleAssessmentRequest, StyleAssessmentResponse,
    ConfirmPathRequest, ConfirmPathResponse,
)
from app.services.profile_aggregator import get_profile_aggregator
from app.services.path_planning_engine import get_path_planning_engine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/path", tags=["Learning Path V2"])


class RecordStudyRequest(BaseModel):
    study_duration_seconds: int = 30  # 浏览时长
    action: str = "mark"  # "mark" or "unmark"


class AgentActionRequest(BaseModel):
    recommendation_type: str
    point_id: Optional[str] = None
    action: str = "accept"  # accept / reject


class PathHistoryCreate(BaseModel):
    snapshot_data: dict
    agent_reason: Optional[str] = None


class PathReplanRequest(BaseModel):
    state_id: str = ""
    trigger: str = "manual"


@router.get("/current", response_model=LearningPathMarkdownResponse)
async def get_current_path(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    goal_type: str = Query("", description="目标类型: 学期提升/升学备考/考级考证"),
):
    """获取学习路径（知识点状态列表 + DAG 图数据）"""
    user_id = str(current_user.student_id)
    subjects = (
        db.query(Subject)
        .order_by(Subject.sort_order)
        .all()
    )

    # 获取所有知识点记录
    records = (
        db.query(KnowledgePointRecord)
        .filter(KnowledgePointRecord.user_id == user_id)
        .all()
    )
    records_map = {str(r.point_id): r for r in records}

    # 构建困难点集合（连续错误 >= 3 且掌握度 < 60）
    difficult_points = set()
    for r in records:
        if r.consecutive_errors >= 3 and r.mastery_score < 60:
            difficult_points.add(str(r.point_id))

    # 构建带层级的数据结构
    subject_data = []
    for subj in subjects:
        domains = (
            db.query(KnowledgeDomain)
            .filter(KnowledgeDomain.subject_id == subj.id)
            .order_by(KnowledgeDomain.sort_order)
            .all()
        )
        domain_data = []
        for dom in domains:
            points = (
                db.query(KnowledgePoint)
                .filter(KnowledgePoint.domain_id == dom.id)
                .order_by(KnowledgePoint.sort_order)
                .all()
            )
            point_data = []
            for pt in points:
                point_data.append({
                    "id": pt.id,
                    "name": pt.name,
                    "difficulty": pt.difficulty,
                    "sort_order": pt.sort_order,
                })
            domain_data.append({
                "name": dom.name,
                "id": dom.id,
                "sort_order": dom.sort_order,
                "knowledge_points": point_data,
            })
        subject_data.append({
            "name": subj.name,
            "id": subj.id,
            "domains": domain_data,
        })

    # 空数据检查
    if not subject_data:
        return LearningPathMarkdownResponse(
            nodes=[],
            summary={"total": 0, "mastered": 0, "learning": 0, "not_started": 0, "reviewing": 0, "difficult": 0},
        )

    # 构建节点状态列表
    nodes = []
    for subj in subject_data:
        for dom in subj["domains"]:
            for pt in dom["knowledge_points"]:
                pid = str(pt["id"])
                record = records_map.get(pid)
                nodes.append(PathNodeStatus(
                    point_id=pid,
                    point_name=pt["name"],
                    domain_name=dom["name"],
                    domain_sort_order=dom["sort_order"],
                    sort_order=pt["sort_order"],
                    mastery_score=record.mastery_score if record else 0,
                    status=record.status if record else "not_started",
                    is_difficult=pid in difficult_points,
                    needs_review=(record.status == "reviewing") if record else False,
                ))

    summary = build_summary(subject_data, {
        str(r.point_id): {
            "mastery_score": r.mastery_score,
            "status": r.status,
        }
        for r in records
    }, difficult_points)

    # 获取 DAG 图数据（Neo4j 路径规划）
    dag_data = DagData()
    try:
        neo4j = get_neo4j()
        if neo4j.verify_connectivity():
            planner = PathPlanner(neo4j)
            plan_result = await planner.plan(user_id, goal_type=goal_type)
            if plan_result.get("nodes"):
                dag_data = DagData(
                    nodes=[
                        DagNode(
                            id=n["id"],
                            point_id=n["id"],
                            label=n["data"]["label"],
                            progress=n["data"].get("progress", "not_started"),
                            mastery_score=n["data"].get("score") or 0,
                            is_weak=n["data"].get("is_weak", False),
                            domain=n["data"].get("domain", ""),
                            subject=n["data"].get("subject", ""),
                        )
                        for n in plan_result["nodes"]
                    ],
                    edges=[
                        DagEdge(
                            id=e["id"],
                            source=e["source"],
                            target=e["target"],
                            label=e.get("label", ""),
                            type="PREREQUISITE" if "前置" in e.get("label", "") else "RELATED_TO",
                            animated=e.get("animated", False),
                        )
                        for e in plan_result["edges"]
                    ],
                    metadata=plan_result.get("metadata", {}),
                )
    except Exception as e:
        logger.warning(f"获取 DAG 图数据失败（降级）: {e}")

    # 若 DAG 没有足够的边（Neo4j 无边数据），用 sort_order 生成降级边
    if dag_data.nodes and (not dag_data.edges or len(dag_data.edges) < max(1, len(dag_data.nodes) - 5)):
        # 获取 DAG 中存在的节点 ID 集合
        dag_node_ids = {dn.id for dn in dag_data.nodes}
        # 从 PathNodeStatus 中筛选出也在 DAG 中的节点，按排序排列
        dag_sorted_nodes = sorted(
            [n for n in nodes if n.point_id in dag_node_ids],
            key=lambda n: (n.domain_sort_order, n.sort_order),
        )
        if dag_sorted_nodes:
            fallback_edges = []
            prev_id = dag_sorted_nodes[0].point_id
            for n in dag_sorted_nodes[1:]:
                fallback_edges.append(DagEdge(
                    id=f"{prev_id}->{n.point_id}",
                    source=prev_id,
                    target=n.point_id,
                    label="顺序",
                    type="PREREQUISITE",
                    animated=True,
                ))
                prev_id = n.point_id
            dag_data.edges = fallback_edges
            dag_data.metadata["degraded_edges"] = True
            dag_data.metadata["fallback_edge_count"] = len(fallback_edges)

    return LearningPathMarkdownResponse(
        nodes=nodes,
        summary=summary,
        dag_data=dag_data,
    )


@router.get("/agent/recommend", response_model=AgentRecommendationListResponse)
async def get_agent_recommendations(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    subject_id: Optional[str] = Query(None, description="可选：按学科过滤推荐"),
):
    """获取 Agent 推荐列表"""
    user_id = str(current_user.student_id)
    agent = LearningAgent(db)
    recs = agent.get_recommendations(user_id, subject_id=subject_id)
    return AgentRecommendationListResponse(
        recommendations=recs,
        total=len(recs),
    )


@router.post("/agent/accept")
async def accept_recommendation(
    body: AgentActionRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """接受 Agent 建议（记录到路径历史）"""
    user_id = current_user.student_id
    if body.point_id:
        record = (
            db.query(KnowledgePointRecord)
            .filter(
                KnowledgePointRecord.user_id == user_id,
                KnowledgePointRecord.point_id == body.point_id,
            )
            .first()
        )
        if record and record.status == "not_started":
            record.status = "learning"

    # 记录到路径历史
    history = PathHistory(
        user_id=user_id,
        snapshot_data={
            "action": "accept",
            "recommendation_type": body.recommendation_type,
            "point_id": body.point_id,
        },
        agent_reason=f"用户接受了 {body.recommendation_type} 建议",
    )
    db.add(history)
    db.commit()

    return {"message": "建议已接受", "success": True}


@router.post("/agent/reject")
async def reject_recommendation(
    body: AgentActionRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """拒绝 Agent 建议（记录到路径历史）"""
    user_id = current_user.student_id

    history = PathHistory(
        user_id=user_id,
        snapshot_data={
            "action": "reject",
            "recommendation_type": body.recommendation_type,
            "point_id": body.point_id,
        },
        agent_reason=f"用户拒绝了 {body.recommendation_type} 建议",
    )
    db.add(history)
    db.commit()

    return {"message": "建议已忽略，将重新规划", "success": True}


@router.get("/knowledge/{point_id}", response_model=KnowledgePointRecordResponse)
async def get_knowledge_detail(
    point_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取单个知识点的学习详情"""
    user_id = current_user.student_id
    pid = UUID(point_id) if len(point_id) == 36 else point_id

    record = (
        db.query(KnowledgePointRecord)
        .filter(
            KnowledgePointRecord.user_id == user_id,
            KnowledgePointRecord.point_id == pid,
        )
        .first()
    )

    point = db.query(KnowledgePoint).filter(KnowledgePoint.id == pid).first()
    if not point:
        raise HTTPException(status_code=404, detail="知识点不存在")

    domain_name = ""
    if point.domain:
        domain_name = point.domain.name

    subject_name = ""
    if point.domain and point.domain.subject:
        subject_name = point.domain.subject.name

    # 统计该知识点在题库中的总题目数
    total_questions = db.query(Question).filter(
        Question.knowledge_point_uuids.contains([str(pid)])
    ).count()

    if record:
        return KnowledgePointRecordResponse(
            point_id=str(point.id),
            point_name=point.name,
            domain_name=domain_name,
            subject_name=subject_name,
            mastery_score=record.mastery_score,
            recent_accuracy=record.recent_accuracy,
            consecutive_errors=record.consecutive_errors,
            total_practiced=record.total_practiced,
            total_correct=record.total_correct,
            total_questions=total_questions,
            total_time_spent_seconds=record.total_time_spent_seconds,
            study_count=record.study_count,
            last_study_at=record.last_study_at,
            last_practice_at=record.last_practice_at,
            next_review_at=record.next_review_at,
            status=record.status,
            video_url=point.video_url,
            review_material=record.review_material,
        )

    return KnowledgePointRecordResponse(
        point_id=str(point.id),
        point_name=point.name,
        domain_name=domain_name,
        subject_name=subject_name,
        status="not_started",
        video_url=point.video_url,
        total_questions=total_questions,
    )


class VideoUrlRequest(BaseModel):
    video_url: str


def _get_lecture_llm_config(db: Session, user_id: str) -> Optional[dict]:
    """Return a compatible chat-completions config for lecture generation."""
    from app.models.api_settings import ApiSettings

    provider_defaults = {
        "qwen": {
            "base_url": settings.QWEN_BASE_URL,
            "model": settings.QWEN_MODEL or "qwen-plus",
            "env_key": settings.QWEN_API_KEY,
        },
        "deepseek": {
            "base_url": settings.DEEPSEEK_BASE_URL,
            "model": settings.DEEPSEEK_MODEL or "deepseek-chat",
            "env_key": settings.DEEPSEEK_API_KEY,
        },
    }

    for provider in ("qwen", "deepseek"):
        user_setting = (
            db.query(ApiSettings)
            .filter(
                ApiSettings.user_id == user_id,
                ApiSettings.provider == provider,
                ApiSettings.is_enabled == True,
            )
            .first()
        )
        defaults = provider_defaults[provider]
        if user_setting and user_setting.api_key:
            return {
                "provider": provider,
                "api_key": user_setting.api_key,
                "base_url": user_setting.base_url or defaults["base_url"],
                "model": user_setting.model_version or defaults["model"],
            }

    for provider in ("qwen", "deepseek"):
        defaults = provider_defaults[provider]
        if defaults["env_key"]:
            return {
                "provider": provider,
                "api_key": defaults["env_key"],
                "base_url": defaults["base_url"],
                "model": defaults["model"],
            }

    return None


def _save_review_material(
    db: Session,
    *,
    user_id,
    point_id,
    point_name: str,
    content: str,
) -> None:
    record = (
        db.query(KnowledgePointRecord)
        .filter(
            KnowledgePointRecord.user_id == user_id,
            KnowledgePointRecord.point_id == point_id,
        )
        .first()
    )
    if not record:
        record = KnowledgePointRecord(
            user_id=user_id,
            point_id=point_id,
            point_name=point_name,
        )
        db.add(record)
    record.review_material = content
    db.commit()


@router.put("/knowledge/{point_id}/video-url")
async def update_knowledge_video_url(
    point_id: str,
    body: VideoUrlRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """设置/更新知识点的精讲视频链接"""
    pid = UUID(point_id) if len(point_id) == 36 else point_id
    point = db.query(KnowledgePoint).filter(KnowledgePoint.id == pid).first()
    if not point:
        raise HTTPException(status_code=404, detail="知识点不存在")
    point.video_url = body.video_url
    db.commit()
    return {"success": True, "video_url": body.video_url}


@router.post("/knowledge/{point_id}/review-material")
async def generate_review_material(
    point_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """生成知识点阅读讲义"""
    import httpx

    pid = UUID(point_id) if len(point_id) == 36 else point_id
    point = db.query(KnowledgePoint).filter(KnowledgePoint.id == pid).first()
    if not point:
        raise HTTPException(status_code=404, detail="知识点不存在")

    user_id_str = str(current_user.student_id)

    domain_name = point.domain.name if point.domain else ""
    subject_name = point.domain.subject.name if point.domain and point.domain.subject else ""
    description = point.description or ""

    llm_config = _get_lecture_llm_config(db, user_id_str)
    if not llm_config:
        content = build_source_based_lecture(
            subject_name=subject_name,
            domain_name=domain_name,
            point_name=point.name,
            description=description,
        )
        _save_review_material(
            db,
            user_id=current_user.student_id,
            point_id=pid,
            point_name=point.name,
            content=content,
        )
        return {
            "success": True,
            "content": content,
            "source_mode": "reference",
            "message": "未配置 DeepSeek/Qwen，已生成资料参考讲义。",
        }

    prompt = build_lecture_prompt(
        subject_name=subject_name,
        domain_name=domain_name,
        point_name=point.name,
        description=description,
    )

    try:
        chat_url = f"{llm_config['base_url'].rstrip('/')}/chat/completions"
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                chat_url,
                headers={
                    "Authorization": f"Bearer {llm_config['api_key']}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": llm_config["model"],
                    "messages": [
                        {
                            "role": "system",
                            "content": "你是数据结构课程讲义编写助手，只输出 Markdown 阅读讲义。",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.45,
                    "max_tokens": 4096,
                },
            )
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail=f"讲义生成失败：LLM 调用返回 {r.status_code}")

        payload = r.json()
        content = payload["choices"][0]["message"]["content"].strip()
        if not content:
            raise HTTPException(status_code=502, detail="讲义生成失败：模型返回内容为空")

        # 后处理：[DRAWIO] 块 → PNG 图片
        if "[DRAWIO]" in content:
            import re as _re
            def _render_drawio(match):
                xml = match.group(1).strip()
                xml = _re.sub(r'^```[a-zA-Z]*\n?', '', xml)
                xml = _re.sub(r'\n?```$', '', xml)
                if not xml.strip():
                    return "\n\n> ⚠️ 图表内容为空\n\n"
                try:
                    from app.services.drawio_export import save_drawio_png
                    png_url, _ = save_drawio_png(xml)
                    if png_url:
                        return f"\n\n![图表]({png_url})\n\n"
                except Exception:
                    pass
                return match.group(0)
            content = _re.sub(r'\[DRAWIO\]([\s\S]*?)\[/DRAWIO\]', _render_drawio, content)

        _save_review_material(
            db,
            user_id=current_user.student_id,
            point_id=pid,
            point_name=point.name,
            content=content,
        )

        return {
            "success": True,
            "content": content,
            "source_mode": llm_config["provider"],
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"生成阅读讲义失败: {str(e)[:200]}")


class AssessResultRequest(BaseModel):
    answers: list  # [{question_id: str, user_choice: str}]


@router.post("/knowledge/{point_id}/assess")
async def start_mastery_assessment(
    point_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """获取知识点掌握度测评题目（最多5题，不含正确答案）"""
    from app.models.question_bank import Question, QuestionBank

    pid = UUID(point_id) if len(point_id) == 36 else point_id
    point = db.query(KnowledgePoint).filter(KnowledgePoint.id == pid).first()
    if not point:
        raise HTTPException(status_code=404, detail="知识点不存在")

    # 找到包含该知识点的客观选择题（排除简答/编程等主观题）
    OBJECTIVE_TYPES = ["single_choice", "multiple_choice", "true_false"]
    questions = (
        db.query(Question)
        .filter(Question.knowledge_point_uuids.contains([str(pid)]))
        .filter(Question.status == "published")
        .filter(Question.type.in_(OBJECTIVE_TYPES))
        .limit(5)
        .all()
    )

    if not questions:
        raise HTTPException(status_code=404, detail="该知识点暂无可自动批改的选择题，请先在题库中添加选择题")

    # 返回题目（包含答案供前端校验）
    result = []
    for q in questions:
        q_content = q.content or {}
        q_answer = q.answer or {}
        options = q_content.get("options", [])
        raw_answer = q_answer.get("correct_answer", "")
        # 归一化：列表取首元素（如 ["D"] → "D"），字符串直接使用
        if isinstance(raw_answer, list):
            correct = raw_answer[0] if raw_answer else ""
        else:
            correct = str(raw_answer)
        result.append({
            "question_id": str(q.id),
            "type": q.type or "single_choice",
            "stem": q_content.get("stem", ""),
            "options": options,
            "correct_answer": correct,
            "explanation": q_answer.get("explanation", ""),
        })

    bank_id = str(questions[0].bank_id)
    return {"bank_id": bank_id, "point_name": point.name, "questions": result, "total": len(result)}


@router.post("/knowledge/{point_id}/assess/submit")
async def submit_mastery_assessment(
    point_id: str,
    body: AssessResultRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """提交掌握度测评答案，计算并更新掌握度"""
    from app.models.question_bank import Question, StudentAnswer
    from app.schemas.question_bank import AnswerSubmitResponse

    pid = UUID(point_id) if len(point_id) == 36 else point_id
    student_id = str(current_user.student_id)

    correct = 0
    total = len(body.answers)
    for ans in body.answers:
        qid = ans.get("question_id", "")
        user_choice = ans.get("user_choice", "")
        if not qid:
            total -= 1
            continue

        question = db.query(Question).filter(Question.id == UUID(qid)).first()
        if not question:
            total -= 1
            continue

        q_answer = question.answer or {}
        raw_answer = q_answer.get("correct_answer", "")
        if isinstance(raw_answer, list):
            correct_answer = raw_answer[0] if raw_answer else ""
        else:
            correct_answer = str(raw_answer)
        is_correct = (user_choice == correct_answer)

        if is_correct:
            correct += 1

        # 记录答案
        record = StudentAnswer(
            user_id=current_user.student_id,
            question_id=UUID(qid),
            bank_id=question.bank_id,
            answer_content={"user_choice": user_choice},
            is_correct=is_correct,
        )
        db.add(record)
        db.commit()

        # 更新知识点掌握度
        try:
            kp_names_uuids: list[tuple[str, str]] = []
            for uid in (question.knowledge_point_uuids or []):
                kp = db.query(KnowledgePoint).filter(KnowledgePoint.id == UUID(uid)).first()
                if kp:
                    kp_names_uuids.append((kp.name, uid))

            for name, uuid_str in kp_names_uuids:
                pt_id = UUID(uuid_str)
                kpr = db.query(KnowledgePointRecord).filter(
                    KnowledgePointRecord.user_id == student_id,
                    KnowledgePointRecord.point_id == pt_id,
                ).first()

                if not kpr:
                    kpr = KnowledgePointRecord(
                        user_id=UUID(student_id),
                        point_id=pt_id,
                        point_name=name,
                        status="learning",
                    )
                    db.add(kpr)

                kpr.total_practiced = (kpr.total_practiced or 0) + 1
                if is_correct:
                    kpr.total_correct = (kpr.total_correct or 0) + 1
                    kpr.consecutive_errors = 0
                else:
                    kpr.consecutive_errors = (kpr.consecutive_errors or 0) + 1
                kpr.last_practice_at = datetime.utcnow()

                if kpr.total_practiced > 0:
                    kpr.mastery_score = int((kpr.total_correct or 0) / (kpr.total_practiced or 1) * 100)

                if kpr.mastery_score >= 80 and kpr.total_practiced >= 3:
                    kpr.status = "mastered"
                elif kpr.consecutive_errors >= 3:
                    kpr.status = "reviewing"
                elif kpr.total_practiced > 0:
                    kpr.status = "learning"

                db.commit()

                try:
                    neo4j = get_neo4j()
                    if neo4j.verify_connectivity():
                        neo4j.add_knowledge_mastery(
                            student_id, name,
                            kpr.mastery_score / 100.0,
                            min(1.0, kpr.total_practiced / 20.0),
                            knowledge_point_uuid=uuid_str,
                        )
                except Exception:
                    pass
        except Exception:
            pass

    # 同步状态机：更新 node_order 中的 mastery_score
    try:
        active_state = db.query(LearningPathState).filter(
            LearningPathState.user_id == student_id,
            LearningPathState.phase != "completed",
        ).order_by(LearningPathState.updated_at.desc()).first()
        if active_state and active_state.node_order:
            node_order = list(active_state.node_order)
            kpr = db.query(KnowledgePointRecord).filter(
                KnowledgePointRecord.user_id == student_id,
                KnowledgePointRecord.point_id == pid,
            ).first()
            if kpr:
                updated = False
                for item in node_order:
                    if item.get("node_id") == str(pid):
                        item["mastery_score"] = kpr.mastery_score
                        updated = True
                if updated:
                    active_state.node_order = node_order
                    active_state.updated_at = datetime.utcnow()
                    db.commit()
    except Exception:
        pass

    path_replan_result = None
    try:
        active_state = db.query(LearningPathState).filter(
            LearningPathState.user_id == student_id,
            LearningPathState.phase != "completed",
        ).order_by(LearningPathState.updated_at.desc()).first()
        if active_state:
            manager = PathStateManager(db)
            path_replan_result = manager.replan_path(
                user_id=student_id,
                state_id=str(active_state.id),
                trigger="assessment",
            )
    except Exception as e:
        logger.warning(f"掌握度测评后动态调整路径失败: {e}")

    score = round(correct / max(total, 1) * 100)
    return {
        "success": True,
        "correct": correct,
        "total": total,
        "score": score,
        "path_replanned": bool(path_replan_result and path_replan_result.get("success")),
        "path_changed_count": (path_replan_result or {}).get("changed_count", 0),
    }


@router.post("/knowledge/{point_id}/record-study")
async def record_knowledge_study(
    point_id: str,
    body: RecordStudyRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """记录"知识点了解"行为

    用户点击浏览知识点内容超过30秒时调用。
    """
    user_id = current_user.student_id
    pid = UUID(point_id) if len(point_id) == 36 else point_id

    point = db.query(KnowledgePoint).filter(KnowledgePoint.id == pid).first()
    if not point:
        raise HTTPException(status_code=404, detail="知识点不存在")

    record = (
        db.query(KnowledgePointRecord)
        .filter(
            KnowledgePointRecord.user_id == user_id,
            KnowledgePointRecord.point_id == pid,
        )
        .first()
    )

    if body.action == "unmark":
        if record:
            record.study_count = max(0, (record.study_count or 0) - 1)
            record.last_study_at = None if record.study_count == 0 else record.last_study_at
            if record.study_count == 0:
                record.status = "not_started"
            record.mastery_score = 0
    else:
        if not record:
            record = KnowledgePointRecord(
                user_id=user_id,
                point_id=pid,
                point_name=point.name,
                study_count=1,
                mastery_score=5,
                last_study_at=datetime.utcnow(),
                status="learning",
            )
            db.add(record)
        else:
            record.study_count = (record.study_count or 0) + 1
            record.last_study_at = datetime.utcnow()
            if record.status == "not_started":
                record.status = "learning"

    db.commit()

    return {
        "message": "已记录学习行为" if body.action == "mark" else "已取消学习标记",
        "study_count": record.study_count if record else 0,
        "status": record.status if record else "not_started",
    }


@router.get("/history", response_model=PathHistoryResponse)
async def get_path_history(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取路径调整历史"""
    user_id = current_user.student_id
    items = (
        db.query(PathHistory)
        .filter(PathHistory.user_id == user_id)
        .order_by(PathHistory.created_at.desc())
        .limit(50)
        .all()
    )

    return PathHistoryResponse(
        items=[
            PathHistoryItem(
                id=str(h.id),
                agent_reason=h.agent_reason,
                snapshot_data=h.snapshot_data,
                created_at=h.created_at,
            )
            for h in items
        ],
        total=len(items),
    )


# ═══════════════════════════════════════════════════════════════
#  AI 个性化路径生成 API
# ═══════════════════════════════════════════════════════════════

@router.post("/generate", response_model=PathGenerationResponse)
async def generate_personalized_path(
    body: PathGenerationRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI 个性化路径生成

    流程：
    1. ProfileAggregator 聚合用户全部画像数据
    2. PathPlanningEngine 生成个性化路径（Neo4j拓扑 + LLM优化）
    3. 返回完整路径（阶段划分、每日建议、策略说明）

    用户必须已配置 LLM API（deepseek 或 qwen），否则直接返回 400。
    """
    user_id = str(current_user.student_id)

    # 验证学科存在
    if not body.subject_id:
        raise HTTPException(status_code=400, detail="请选择学科")

    subject = db.query(Subject).filter(Subject.id == body.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="学科不存在")

    # 聚合用户画像
    aggregator = get_profile_aggregator(db)
    ctx = await aggregator.collect(
        user_id=user_id,
        subject_id=body.subject_id,
        goal_type=body.goal_type,
        goal_description=body.goal_description,
        target_score=body.target_score,
        deadline=body.deadline,
    )

    # 检查 LLM 可用性
    if not ctx.has_llm_configured:
        return PathGenerationResponse(
            path_name="",
            description="请先配置 AI 服务（DeepSeek 或 Qwen），才能使用个性化路径规划。",
            total_days=0,
            total_nodes=0,
            phases=[],
            daily_suggestion=None,
            strategy_notes=["请前往「API 设置」页面配置 DeepSeek 或 Qwen API Key"],
            generation_reason="用户未配置 AI 服务",
            nodes=[],
            edges=[],
        )
        # Note: 不抛 400，让前端友好展示引导信息

    # 生成个性化路径
    engine = get_path_planning_engine(db)
    result = await engine.generate(ctx, goal_type=body.goal_type)

    # 记录到路径历史
    history = PathHistory(
        user_id=current_user.student_id,
        snapshot_data={
            "action": "ai_generate_path",
            "subject_id": body.subject_id,
            "goal_type": body.goal_type,
            "goal_description": body.goal_description,
            "path_name": result.path_name,
            "total_nodes": result.total_nodes,
            "total_days": result.total_days,
            "phases": len(result.phases),
            "is_cold_start": ctx.is_cold_start,
        },
        agent_reason=f"AI 生成个性化路径：{result.path_name}（{result.total_nodes} 知识点，{result.total_days} 天）",
    )
    db.add(history)
    db.commit()

    return result


@router.get("/check-api", response_model=ApiCheckResponse)
async def check_api_availability(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """检查用户是否已配置 LLM API 以及是否有认知风格数据

    前端在点击"生成学习路径"按钮前调用此接口：
    - has_llm=false → 按钮灰色，提示配置 API
    - has_cognitive_data=false → 弹出风格评估弹窗
    """
    user_id = str(current_user.student_id)

    # 检查 API 配置：优先检查系统 .env 配置，其次用户个人配置
    from app.core.config import settings

    has_llm = False
    providers = []

    # 1. 检查系统全局配置（.env 文件）
    if settings.DEEPSEEK_API_KEY:
        has_llm = True
        providers.append("deepseek")
    elif settings.QWEN_API_KEY:
        has_llm = True
        providers.append("qwen")

    # 2. 如果系统未配置，检查用户个人配置（ApiSettings 表）
    if not has_llm:
        from app.models.api_settings import ApiSettings
        api_settings = (
            db.query(ApiSettings)
            .filter(
                ApiSettings.user_id == user_id,
                ApiSettings.is_enabled == True,
            )
            .all()
        )

        for s in api_settings:
            if s.provider in ("deepseek", "qwen") and s.api_key:
                has_llm = True
                providers.append(s.provider)

    # 检查认知风格数据
    has_cognitive_data = False
    try:
        neo4j = get_neo4j()
        if neo4j.verify_connectivity():
            style = neo4j.get_cognitive_style(user_id)
            if style and style.get("style_type"):
                has_cognitive_data = True
    except Exception:
        pass

    if not has_llm:
        return ApiCheckResponse(
            has_llm=False,
            has_cognitive_data=has_cognitive_data,
            message="请先配置 AI 服务（DeepSeek 或 Qwen），才能使用个性化路径规划",
            providers=[],
        )

    return ApiCheckResponse(
        has_llm=True,
        has_cognitive_data=has_cognitive_data,
        message="可以生成个性化路径" + ("，需先完成风格评估" if not has_cognitive_data else ""),
        providers=providers,
    )


@router.post("/style-assessment", response_model=StyleAssessmentResponse)
async def submit_style_assessment(
    body: StyleAssessmentRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """提交学习风格评估结果

    用户在新手引导中完成 3 道选择题后提交。
    结果存储到 Neo4j（认知风格）和 MongoDB（活跃时段）。
    如果没有 MongoDB/Neo4j 连接，降级到 PostgreSQL 存储。
    """
    user_id = str(current_user.student_id)

    # ── 解析 Q1 → 认知风格 ──
    q1_map = {
        "video": "visual",
        "doc": "reading_writing",
        "practice": "kinesthetic",
        "audio": "auditory",
        "unknown": "mixed",
    }
    cognitive_style = q1_map.get(body.q1, "mixed")

    # ── 解析 Q3 → 活跃时段权重 ──
    time_labels = ["morning", "afternoon", "evening", "night"]
    active_hours = {"morning": 0.1, "afternoon": 0.1, "evening": 0.1, "night": 0.1}
    q3_map = {"morning": 0, "afternoon": 1, "evening": 2, "night": 3}
    if body.q3 in q3_map:
        idx = q3_map[body.q3]
        active_hours[time_labels[idx]] = 0.7
        # 给相邻时段也分配一些
        for offset in [-1, 1]:
            adj = idx + offset
            if 0 <= adj < 4:
                active_hours[time_labels[adj]] = max(0.1, active_hours[time_labels[adj]] + 0.2)

    # ── 存储到 Neo4j ──
    try:
        neo4j = get_neo4j()
        if neo4j.verify_connectivity():
            neo4j.set_cognitive_style(
                user_id,
                cognitive_style,
                {
                    "q1": body.q1,
                    "q2": body.q2,
                    "q3": body.q3,
                    "confidence": 0.6,  # 3题问卷，置信度较低
                },
            )
            neo4j.save_error_prone_topics(user_id, [])  # 初始化空列表
            logger.info(f"Neo4j 认知风格已保存: user={user_id}, style={cognitive_style}")
    except Exception as e:
        logger.warning(f"Neo4j 认知风格保存失败（非致命）: {e}")

    # ── 存储到 MongoDB ──
    try:
        from app.db.mongodb import get_mongodb
        mongo = get_mongodb()
        if mongo.verify_connectivity():
            mongo.upsert_student_profile(user_id, {
                "dimensions.active_hours": active_hours,
                "dimensions.learning_rhythm.scalar": 0.5,
                "dimensions.learning_rhythm.trend": 0.0,
                "assessment_source": "quick_3q",
                "assessment_date": datetime.utcnow().isoformat(),
            })
            logger.info(f"MongoDB 活跃时段已保存: user={user_id}")
    except Exception as e:
        logger.warning(f"MongoDB 活跃时段保存失败（非致命）: {e}")

    # ── 同步更新 PostgreSQL UserProfile ──
    try:
        from app.models.user import UserProfile
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        if profile:
            # 保存认知风格到 profile 的某个字段（如果没有专用字段，用备注方式）
            if hasattr(profile, 'learning_goal'):
                # 追加风格信息到 learning_goal（不会覆盖原内容）
                suffix = f"\n[认知风格: {cognitive_style}]"
                if suffix not in (profile.learning_goal or ""):
                    profile.learning_goal = (profile.learning_goal or "") + suffix
            db.commit()
    except Exception as e:
        db.rollback()
        logger.warning(f"PostgreSQL 风格同步失败（非致命）: {e}")

    style_labels = {
        "visual": "视觉型 — 推荐多看图表、视频类资源",
        "auditory": "听觉型 — 推荐多听讲解、音频类资源",
        "reading_writing": "读写型 — 推荐阅读文档、整理笔记",
        "kinesthetic": "动手型 — 推荐动手练习、项目实践",
        "mixed": "混合型 — 平衡各类学习资源",
    }

    return StyleAssessmentResponse(
        cognitive_style=cognitive_style,
        active_hours=active_hours,
        message=f"评估完成！你的学习风格是：{style_labels.get(cognitive_style, cognitive_style)}",
    )


@router.post("/confirm", response_model=ConfirmPathResponse)
async def confirm_path(
    body: ConfirmPathRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """确认 AI 生成的个性化路径，持久化到状态机

    用户在预览页点击「确认路径并开始学习」后调用。
    将 AI 生成的 node_order、阶段划分、策略建议写入 LearningPathState。
    """
    user_id = str(current_user.student_id)

    if not body.subject_id or not body.generated_path:
        raise HTTPException(status_code=400, detail="缺少学科ID或路径数据")

    # 验证学科存在
    subject = db.query(Subject).filter(Subject.id == body.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="学科不存在")

    manager = PathStateManager(db)
    result = manager.confirm_path(
        user_id=user_id,
        subject_id=body.subject_id,
        goal_type=body.goal_type,
        goal_description=body.goal_description,
        generated_path=body.generated_path,
    )

    # 记录到路径历史
    history = PathHistory(
        user_id=current_user.student_id,
        snapshot_data={
            "action": "confirm_ai_path",
            "subject_id": body.subject_id,
            "goal_type": body.goal_type,
            "path_name": body.generated_path.get("path_name", ""),
            "total_nodes": result.total_nodes,
            "phases": len(body.generated_path.get("phases", [])),
            "generation_reason": body.generated_path.get("generation_reason", ""),
        },
        agent_reason=f"用户确认 AI 个性化路径：「{body.generated_path.get('path_name', '')}」（{result.total_nodes} 知识点）",
    )
    db.add(history)
    db.commit()

    return ConfirmPathResponse(
        state_id=result.state_id,
        message=result.message,
        phase=result.phase,
        total_nodes=result.total_nodes,
    )


@router.get("/list")
async def list_paths(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取用户所有活跃的学习路径列表（用于路径选择页）

    返回用户所有未完成的路径，按更新时间倒序排列。
    """
    user_id = str(current_user.student_id)

    states = (
        db.query(LearningPathState)
        .filter(
            LearningPathState.user_id == user_id,
            LearningPathState.phase != "completed",
        )
        .order_by(LearningPathState.updated_at.desc())
        .all()
    )

    from app.models.question_bank import Subject

    paths = []
    for state in states:
        subject_name = ""
        if state.subject_id:
            subj = db.query(Subject).filter(Subject.id == state.subject_id).first()
            if subj:
                subject_name = subj.name

        ai_meta = state.ai_metadata or {}
        done = state.completed_nodes or 0
        total = state.total_nodes or 0
        progress_pct = round(done / max(total, 1) * 100)

        paths.append({
            "state_id": str(state.id),
            "path_name": ai_meta.get("path_name", "") or f"{subject_name}学习路径",
            "subject_id": str(state.subject_id) if state.subject_id else "",
            "subject_name": subject_name,
            "goal_type": state.goal_type or "",
            "phase": state.phase,
            "total_nodes": total,
            "completed_nodes": done,
            "progress_pct": progress_pct,
            "total_days": ai_meta.get("total_days", 0),
            "phases_count": len(ai_meta.get("phases", [])),
            "created_at": state.created_at.isoformat() if state.created_at else "",
            "updated_at": state.updated_at.isoformat() if state.updated_at else "",
        })

    return {"paths": paths, "total": len(paths)}


# ═══════════════════════════════════════════════════════════════
#  V3 新增：路径执行状态机 API
# ═══════════════════════════════════════════════════════════════

@router.post("/init", response_model=PathInitResponse)
async def init_learning_path(
    body: PathInitRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """初始化学习路径

    选择科目和目标后调用，系统会：
    1. 获取该学科下所有知识点（按层级排序）
    2. 融合用户掌握度数据
    3. 生成持久化的 node_order 执行顺序
    4. 设置第一个未掌握节点为焦点节点
    """
    user_id = str(current_user.student_id)

    # 验证学科存在
    subject = db.query(Subject).filter(Subject.id == body.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="学科不存在")

    # 验证学科下有知识点
    domain_count = (
        db.query(KnowledgeDomain)
        .filter(KnowledgeDomain.subject_id == body.subject_id)
        .count()
    )
    if domain_count == 0:
        raise HTTPException(
            status_code=400,
            detail="该学科下暂无知识点，请先在学习路径管理中添加知识点",
        )

    manager = PathStateManager(db)
    result = manager.init_path(
        user_id=user_id,
        subject_id=body.subject_id,
        goal_type=body.goal_type,
        goal_description=body.goal_description,
    )

    # 记录到路径历史
    history = PathHistory(
        user_id=current_user.student_id,
        snapshot_data={
            "action": "init_path",
            "subject_id": body.subject_id,
            "goal_type": body.goal_type,
            "goal_description": body.goal_description,
            "state_id": result.state_id,
            "total_nodes": result.total_nodes,
        },
        agent_reason=f"用户创建学习路径：{subject.name} - {body.goal_description or body.goal_type}",
    )
    db.add(history)
    db.commit()

    return result


@router.get("/state", response_model=PathStateResponse)
async def get_path_state(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    state_id: Optional[str] = Query(None, description="指定路径ID；不传则返回最近的活跃路径"),
):
    """获取当前路径执行状态

    支持可选 state_id 参数来选择查看特定路径。
    """
    user_id = str(current_user.student_id)
    manager = PathStateManager(db)
    return manager.get_state(user_id, state_id=state_id)


@router.post("/progress")
async def update_path_progress(
    body: PathProgressRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """上报节点学习进度

    action:
    - complete: 标记节点为已完成，推进到下一个节点
    - skip: 跳过该节点
    - unskip: 取消跳过，恢复为待学习
    """
    user_id = str(current_user.student_id)

    # 验证节点存在
    point = db.query(KnowledgePoint).filter(KnowledgePoint.id == body.node_id).first()
    if not point:
        raise HTTPException(status_code=404, detail="知识点不存在")

    manager = PathStateManager(db)
    result = manager.update_progress(
        user_id=user_id,
        node_id=body.node_id,
        action=body.action,
        state_id=body.state_id or None,
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "操作失败"))

    # 如果是完成操作，同时更新 KnowledgePointRecord
    if body.action == "complete":
        record = (
            db.query(KnowledgePointRecord)
            .filter(
                KnowledgePointRecord.user_id == current_user.student_id,
                KnowledgePointRecord.point_id == body.node_id,
            )
            .first()
        )
        if not record:
            record = KnowledgePointRecord(
                user_id=current_user.student_id,
                point_id=UUID(body.node_id),
                point_name=point.name,
                study_count=1,
                mastery_score=5,
                last_study_at=datetime.utcnow(),
                status="learning",
            )
            db.add(record)
        else:
            record.study_count = (record.study_count or 0) + 1
            record.last_study_at = datetime.utcnow()
            if record.status == "not_started":
                record.status = "learning"
        db.commit()

    # 记录到路径历史
    action_labels = {"complete": "完成", "skip": "跳过", "unskip": "取消跳过"}
    history = PathHistory(
        user_id=current_user.student_id,
        snapshot_data={
            "action": body.action,
            "node_id": body.node_id,
            "node_name": point.name,
        },
        agent_reason=f"用户{action_labels.get(body.action, body.action)}了知识点「{point.name}」",
    )
    db.add(history)
    db.commit()

    return result


@router.post("/replan")
async def replan_learning_path(
    body: PathReplanRequest = PathReplanRequest(),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """根据最新掌握度、错题和复习状态动态调整未完成路径。"""
    user_id = str(current_user.student_id)
    manager = PathStateManager(db)
    result = manager.replan_path(
        user_id=user_id,
        state_id=body.state_id or None,
        trigger=body.trigger or "manual",
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "路径重排失败"))

    history = PathHistory(
        user_id=current_user.student_id,
        snapshot_data={
            "action": "dynamic_replan",
            "state_id": body.state_id,
            "trigger": body.trigger,
            "changed_count": result.get("changed_count", 0),
            "current_node": result.get("current_node"),
        },
        agent_reason="系统根据最新掌握度和错题记录动态调整了未完成路径",
    )
    db.add(history)
    db.commit()

    return result


@router.post("/restart")
async def restart_learning_path(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """重新开始学习路径（结束当前路径，保留历史）"""
    user_id = str(current_user.student_id)
    manager = PathStateManager(db)
    result = manager.restart_path(user_id)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "操作失败"))

    return result
