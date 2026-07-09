from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional
from collections import defaultdict
import json
import logging

from app.db.database import get_db
from app.db.neo4j import get_neo4j, Neo4jConnection
from app.models.question_bank import (
    Subject, KnowledgeDomain, KnowledgePoint, QuestionBank, Question,
    StudentAnswer,
)
from app.models.user import User
from app.schemas.coding import (
    CodingTreeResponse, CodingProblemResponse, DomainNode, PointNode, ProblemSummary,
    AnalyzeRequest, SubmitResultRequest, SubmitResultResponse,
)
from app.services.code_analyzer import CodeAnalyzer
from app.api.dependencies import get_current_active_user
from app.crud.api_settings import api_settings_crud
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/coding", tags=["Coding Practice"])

SEED_SUBJECT_ID = "d91a4645-ab5f-4819-8379-d9e6524f0937"


def _resolve_api_creds(db: Session) -> dict:
    """解析 API 凭证：系统环境 → 用户设置。"""
    if settings.QWEN_API_KEY and "your-qwen" not in settings.QWEN_API_KEY:
        return {"api_key": settings.QWEN_API_KEY, "base_url": settings.QWEN_BASE_URL, "model": "qwen-plus"}
    if settings.DEEPSEEK_API_KEY and "your-deepseek" not in settings.DEEPSEEK_API_KEY:
        return {"api_key": settings.DEEPSEEK_API_KEY, "base_url": settings.DEEPSEEK_BASE_URL, "model": "deepseek-v4-flash"}
    user = db.query(User).filter(User.username == "guoketg").first()
    if user:
        for provider, base_url, model in [
            ("qwen", settings.QWEN_BASE_URL, "qwen-plus"),
            ("deepseek", settings.DEEPSEEK_BASE_URL, "deepseek-v4-flash"),
        ]:
            try:
                cfg = api_settings_crud.get_setting_value(db, str(user.id), provider)
                if cfg and cfg.get("api_key"):
                    return {"api_key": cfg["api_key"], "base_url": cfg.get("base_url") or base_url, "model": model}
            except Exception:
                continue
    return {}


# ── GET /coding/tree ──

@router.get("/tree", response_model=CodingTreeResponse)
async def get_coding_tree(
    subject_id: Optional[str] = Query(None),
    source: Optional[str] = Query(None, description="题目来源过滤，如 dotcpp_coding；不传显示全部"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """获取编程题知识点目录树（含用户完成状态）。"""
    sid = subject_id or SEED_SUBJECT_ID

    # 获取该学科下已发布的编程题
    filters = [
        Question.type == "programming",
        Question.status == "published",
        QuestionBank.subject_id == sid,
    ]
    if source and source != "*":
        filters.append(Question.source == source)

    all_problems = (
        db.query(Question)
        .join(QuestionBank, Question.bank_id == QuestionBank.id)
        .filter(*filters)
        .all()
    )

    # 获取知识点结构
    domains = (
        db.query(KnowledgeDomain)
        .filter(KnowledgeDomain.subject_id == sid)
        .order_by(KnowledgeDomain.sort_order)
        .all()
    )

    # 用户完成状态
    completed = set()
    attempted = set()
    if all_problems:
        problem_ids = [q.id for q in all_problems]
        answers = (
            db.query(StudentAnswer)
            .filter(
                StudentAnswer.user_id == current_user.student_id,
                StudentAnswer.question_id.in_(problem_ids),
            )
            .all()
        )
        for a in answers:
            if a.is_correct:
                completed.add(str(a.question_id))
            else:
                attempted.add(str(a.question_id))

    # 构建目录树
    domain_nodes = []
    for domain in domains:
        points = (
            db.query(KnowledgePoint)
            .filter(KnowledgePoint.domain_id == domain.id)
            .order_by(KnowledgePoint.sort_order)
            .all()
        )

        point_nodes = []
        domain_total = 0
        domain_completed = 0

        for pt in points:
            pt_uuid_str = str(pt.id)
            pt_problems = [
                q for q in all_problems
                if pt_uuid_str in (q.knowledge_point_uuids or [])
            ]
            if not pt_problems:
                continue

            problem_summaries = []
            for q in pt_problems:
                qid = str(q.id)
                content = q.content or {}
                title = (
                    content.get("stem") or
                    content.get("description") or
                    "未命名题目"
                )
                status = (
                    "completed" if qid in completed else
                    "attempted" if qid in attempted else
                    "not_started"
                )
                problem_summaries.append(ProblemSummary(
                    id=qid,
                    title=str(title)[:60],
                    difficulty=q.difficulty,
                    status=status,
                ))
                domain_total += 1
                if status == "completed":
                    domain_completed += 1

            point_nodes.append(PointNode(
                point_id=pt_uuid_str,
                point_name=pt.name,
                problems=problem_summaries,
            ))

        if point_nodes:
            domain_nodes.append(DomainNode(
                domain_id=str(domain.id),
                domain_name=domain.name,
                sort_order=domain.sort_order,
                total_problems=domain_total,
                completed_count=domain_completed,
                points=point_nodes,
            ))

    return CodingTreeResponse(domains=domain_nodes)


# ── GET /coding/problems/{problem_id} ──

@router.get("/problems/{problem_id}", response_model=CodingProblemResponse)
async def get_coding_problem(
    problem_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """获取编程题详情（含用户上次代码）。"""
    question = db.query(Question).filter(Question.id == problem_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在")

    content = question.content or {}

    # 获取用户上次提交的代码
    last_code = None
    last_answer = (
        db.query(StudentAnswer)
        .filter(
            StudentAnswer.user_id == current_user.student_id,
            StudentAnswer.question_id == problem_id,
        )
        .order_by(StudentAnswer.created_at.desc())
        .first()
    )
    if last_answer and last_answer.answer_content:
        ac = last_answer.answer_content
        if isinstance(ac, dict):
            last_code = ac.get("code")

    return CodingProblemResponse(
        id=str(question.id),
        title=content.get("stem") or content.get("description") or "未命名题目",
        type=question.type,
        content=content,
        difficulty=question.difficulty,
        knowledge_point_uuids=question.knowledge_point_uuids or [],
        tags=question.tags or [],
        user_last_code=last_code,
    )


# ── POST /coding/analyze (SSE) ──

@router.post("/analyze")
async def analyze_code(
    request: AnalyzeRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """AI 分析代码并 SSE 流式返回执行追踪数据。"""
    question = db.query(Question).filter(Question.id == request.problem_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在")

    content = question.content or {}
    desc_parts = []
    for key, label in [("description", "题目"), ("stem", ""), ("input_format", "输入"), ("output_format", "输出")]:
        val = content.get(key, "")
        if val:
            prefix = f"{label}: " if label else ""
            desc_parts.append(f"{prefix}{val}")
    problem_desc = "\n".join(desc_parts) if desc_parts else str(content)

    creds = _resolve_api_creds(db)
    if not creds:
        raise HTTPException(status_code=400, detail="AI 分析需要 API Key，请在设置中配置 DeepSeek 或 Qwen API")

    analyzer = CodeAnalyzer(
        api_key=creds["api_key"],
        base_url=creds["base_url"],
        model=creds["model"],
    )

    async def event_stream():
        try:
            async for event_str in analyzer.analyze_stream(
                code=request.code,
                problem_description=problem_desc,
                language=request.language,
            ):
                yield f"data: {event_str}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ── POST /coding/submit-result ──

@router.post("/submit-result", response_model=SubmitResultResponse)
async def submit_coding_result(
    request: SubmitResultRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """保存编程题作答结果。"""
    import uuid as _uuid_mod

    question = db.query(Question).filter(Question.id == request.problem_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在")

    answer = StudentAnswer(
        user_id=current_user.student_id,
        question_id=request.problem_id,
        bank_id=question.bank_id,
        answer_content={"code": request.code, "language": request.language},
        is_correct=request.is_correct,
        time_spent_seconds=request.time_spent_seconds,
    )
    db.add(answer)
    db.commit()
    db.refresh(answer)

    return SubmitResultResponse(
        success=True,
        answer_id=str(answer.id),
    )
