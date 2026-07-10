from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from fastapi.concurrency import run_in_threadpool
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
    StudentAnswer, CodingTestCase,
)
from app.schemas.coding import (
    CodingTreeResponse, CodingProblemResponse, DomainNode, PointNode, ProblemSummary,
    AnalyzeRequest, SubmitResultRequest, SubmitResultResponse,
    JudgeRequest, JudgeCaseResult, JudgeResponse, SubmissionHistoryItem,
)
from app.services.code_analyzer import CodeAnalyzer
from app.services.code_judge import execute_in_sandbox, normalize_output, trace_to_steps
from app.api.dependencies import get_current_active_user
from app.crud.api_settings import api_settings_crud
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/coding", tags=["Coding Practice"])

SEED_SUBJECT_ID = "78997bed-68b2-5269-8ede-52d9cf7f1494"
SEED_SUBJECT_NAME = "数据结构"


def _resolve_api_creds(db: Session, user_id: str) -> dict:
    """解析当前用户的 API 凭证：系统环境 → 用户设置。"""
    if settings.QWEN_API_KEY and "your-qwen" not in settings.QWEN_API_KEY:
        return {"api_key": settings.QWEN_API_KEY, "base_url": settings.QWEN_BASE_URL, "model": "qwen-plus"}
    if settings.DEEPSEEK_API_KEY and "your-deepseek" not in settings.DEEPSEEK_API_KEY:
        return {"api_key": settings.DEEPSEEK_API_KEY, "base_url": settings.DEEPSEEK_BASE_URL, "model": "deepseek-v4-flash"}
    for provider, base_url, model in [
        ("qwen", settings.QWEN_BASE_URL, "qwen-plus"),
        ("deepseek", settings.DEEPSEEK_BASE_URL, "deepseek-v4-flash"),
    ]:
        try:
            cfg = api_settings_crud.get_setting_value(db, user_id, provider)
            if cfg and cfg.get("api_key"):
                return {"api_key": cfg["api_key"], "base_url": cfg.get("base_url") or base_url, "model": model}
        except Exception:
            continue
    return {}


def _resolve_subject_id(db: Session, subject_id: Optional[str]) -> str:
    """Resolve the data-structure subject for both fresh and upgraded seed DBs."""
    if subject_id:
        return subject_id
    subject = db.query(Subject).filter(Subject.name == SEED_SUBJECT_NAME).first()
    return str(subject.id) if subject else SEED_SUBJECT_ID


# ── GET /coding/tree ──

@router.get("/tree", response_model=CodingTreeResponse)
async def get_coding_tree(
    subject_id: Optional[str] = Query(None),
    source: Optional[str] = Query(None, description="题目来源过滤，如 dotcpp_coding；不传显示全部"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """获取编程题知识点目录树（含用户完成状态）。"""
    sid = _resolve_subject_id(db, subject_id)

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
            pt_problems = [q for q in all_problems if (
                str(q.primary_knowledge_point_id) == pt_uuid_str
                or (q.primary_knowledge_point_id is None and pt_uuid_str in (q.knowledge_point_uuids or []))
            )]
            if not pt_problems:
                continue

            # A knowledge point has at most one published problem in each of the
            # easy/medium/hard slots. The database partial unique index enforces
            # the same rule for the curated catalog.
            difficulty_order = {"basic": 0, "intermediate": 1, "advanced": 2}
            selected_by_difficulty = {}
            for problem in sorted(pt_problems, key=lambda item: (-item.priority, str(item.id))):
                if problem.difficulty in difficulty_order and problem.difficulty not in selected_by_difficulty:
                    selected_by_difficulty[problem.difficulty] = problem
            pt_problems = sorted(selected_by_difficulty.values(), key=lambda item: difficulty_order[item.difficulty])[:3]

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
    question = db.query(Question).filter(
        Question.id == problem_id,
        Question.type == "programming",
        Question.status == "published",
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在")

    content = question.content or {}

    # 获取用户上次提交的代码和真实尝试次数
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
    attempt_count = (
        db.query(StudentAnswer)
        .filter(StudentAnswer.user_id == current_user.student_id, StudentAnswer.question_id == problem_id)
        .count()
    )
    if last_answer and last_answer.answer_content:
        ac = last_answer.answer_content
        if isinstance(ac, dict):
            last_code = ac.get("code")

    public_cases = (
        db.query(CodingTestCase)
        .filter(CodingTestCase.question_id == question.id, CodingTestCase.visibility == "sample")
        .order_by(CodingTestCase.case_order)
        .all()
    )
    # Never expose standard answers or hidden judge cases in the detail API.
    safe_answer = {
        "explanation": (question.answer or {}).get("explanation", ""),
        "complexity": (question.answer or {}).get("complexity", ""),
        "suggested_time_seconds": (question.answer or {}).get("suggested_time_seconds"),
    }

    return CodingProblemResponse(
        id=str(question.id),
        title=content.get("stem") or content.get("description") or "未命名题目",
        type=question.type,
        content=content,
        answer=safe_answer,
        difficulty=question.difficulty,
        knowledge_point_uuids=question.knowledge_point_uuids or [],
        tags=question.tags or [],
        source=question.source,
        user_last_code=last_code,
        attempt_count=attempt_count,
        public_cases=[{
            "id": str(case.id),
            "name": case.name,
            "input": case.input_data,
            "expected_output": case.expected_output,
        } for case in public_cases],
    )


# ── POST /coding/analyze (SSE) ──

@router.post("/analyze")
async def analyze_code(
    request: AnalyzeRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """AI 分析代码并 SSE 流式返回执行追踪数据。"""
    question = db.query(Question).filter(
        Question.id == request.problem_id,
        Question.type == "programming",
        Question.status == "published",
    ).first()
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

    creds = _resolve_api_creds(db, str(current_user.student_id))
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


# ── Real judge: public run / hidden submit / history ──

def _judge_status(exit_code: int, stderr: str, passed: bool) -> str:
    if exit_code == -1:
        return "time_limit"
    if exit_code != 0:
        if any(name in stderr for name in ("SyntaxError", "IndentationError", "TabError")):
            return "compile_error"
        return "runtime_error"
    return "accepted" if passed else "wrong_answer"


async def _judge_cases(
    question: Question,
    cases: list[CodingTestCase],
    request: JudgeRequest,
    reveal_hidden: bool,
) -> JudgeResponse:
    supported_languages = (question.content or {}).get("supported_languages", ["python"])
    if request.language not in supported_languages:
        raise HTTPException(status_code=400, detail=f"本题暂不支持 {request.language}，请选择 Python")
    if not cases:
        raise HTTPException(status_code=409, detail="本题尚未配置测试用例，请联系管理员")

    results: list[JudgeCaseResult] = []
    trace_steps: list[dict] = []
    total_runtime = 0.0
    for index, case in enumerate(cases, start=1):
        try:
            execution = await run_in_threadpool(
                execute_in_sandbox,
                request.code,
                request.language,
                case.input_data,
                request.trace and index == 1,
            )
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

        actual = normalize_output(execution.stdout)
        expected = normalize_output(case.expected_output)
        passed = execution.exit_code == 0 and actual == expected
        status = _judge_status(execution.exit_code, execution.stderr, passed)
        total_runtime += execution.execution_time
        is_hidden = case.visibility == "hidden"
        results.append(JudgeCaseResult(
            case_no=index,
            name=case.name if not is_hidden else f"隐藏测试 {index}",
            visibility=case.visibility,
            status=status,
            passed=passed,
            input=case.input_data if not is_hidden or reveal_hidden else None,
            expected=case.expected_output if not is_hidden or reveal_hidden else None,
            actual=execution.stdout if not is_hidden or reveal_hidden else None,
            stderr=execution.stderr if not is_hidden else ("运行错误" if execution.stderr else ""),
            execution_time=execution.execution_time,
        ))
        if request.trace and index == 1:
            trace_steps = trace_to_steps(execution.trace)

    passed_cases = sum(1 for result in results if result.passed)
    verdict = "accepted"
    for candidate in ("compile_error", "runtime_error", "time_limit", "wrong_answer"):
        if any(result.status == candidate for result in results):
            verdict = candidate
            break
    return JudgeResponse(
        verdict=verdict,
        passed_cases=passed_cases,
        total_cases=len(results),
        all_passed=passed_cases == len(results),
        runtime=round(total_runtime, 4),
        cases=results,
        trace=trace_steps,
    )


@router.post("/problems/{problem_id}/run", response_model=JudgeResponse)
async def run_coding_problem(
    problem_id: UUID,
    request: JudgeRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """运行公开测试，并可返回第一条公开用例的真实 Python 行级轨迹。"""
    question = db.query(Question).filter(
        Question.id == problem_id,
        Question.type == "programming",
        Question.status == "published",
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="代码题不存在或已下线")
    cases = db.query(CodingTestCase).filter(
        CodingTestCase.question_id == problem_id,
        CodingTestCase.visibility == "sample",
    ).order_by(CodingTestCase.case_order).all()
    return await _judge_cases(question, cases, request, reveal_hidden=False)


@router.post("/problems/{problem_id}/submit", response_model=JudgeResponse)
async def submit_coding_problem(
    problem_id: UUID,
    request: JudgeRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """由服务端运行全部测试并持久化判题结果；不接受客户端自报正确。"""
    question = db.query(Question).filter(
        Question.id == problem_id,
        Question.type == "programming",
        Question.status == "published",
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="代码题不存在或已下线")
    cases = db.query(CodingTestCase).filter(
        CodingTestCase.question_id == problem_id,
    ).order_by(CodingTestCase.case_order).all()
    response = await _judge_cases(question, cases, request, reveal_hidden=False)

    answer = StudentAnswer(
        user_id=current_user.student_id,
        question_id=problem_id,
        bank_id=question.bank_id,
        answer_content={
            "kind": "code_submission",
            "code": request.code,
            "language": request.language,
            "verdict": response.verdict,
            "passed_cases": response.passed_cases,
            "total_cases": response.total_cases,
            "runtime": response.runtime,
            "case_results": [
                {
                    "case_no": result.case_no,
                    "visibility": result.visibility,
                    "status": result.status,
                    "execution_time": result.execution_time,
                }
                for result in response.cases
            ],
        },
        is_correct=response.all_passed,
    )
    db.add(answer)
    db.commit()
    db.refresh(answer)
    response.submission_id = str(answer.id)
    return response


@router.get("/problems/{problem_id}/submissions", response_model=list[SubmissionHistoryItem])
async def list_coding_submissions(
    problem_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    rows = (
        db.query(StudentAnswer)
        .filter(
            StudentAnswer.user_id == current_user.student_id,
            StudentAnswer.question_id == problem_id,
            StudentAnswer.answer_content["kind"].astext == "code_submission",
        )
        .order_by(StudentAnswer.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    result = []
    for row in rows:
        content = row.answer_content if isinstance(row.answer_content, dict) else {}
        result.append(SubmissionHistoryItem(
            id=str(row.id),
            created_at=row.created_at,
            language=content.get("language", "python"),
            verdict=content.get("verdict", "accepted" if row.is_correct else "wrong_answer"),
            is_correct=row.is_correct,
            passed_cases=int(content.get("passed_cases", 0)),
            total_cases=int(content.get("total_cases", 0)),
            runtime=float(content.get("runtime", 0)),
        ))
    return result


@router.get("/problems/{problem_id}/solution")
async def reveal_coding_solution(
    problem_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    attempts = db.query(StudentAnswer).filter(
        StudentAnswer.user_id == current_user.student_id,
        StudentAnswer.question_id == problem_id,
        StudentAnswer.answer_content["kind"].astext == "code_submission",
    ).count()
    if attempts == 0:
        raise HTTPException(status_code=403, detail="至少提交一次后才能查看参考解法")
    question = db.query(Question).filter(
        Question.id == problem_id,
        Question.type == "programming",
        Question.status == "published",
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在")
    answer = question.answer or {}
    return {
        "explanation": answer.get("explanation", ""),
        "complexity": answer.get("complexity", ""),
        "standard_answer": answer.get("standard_answer", {}),
    }


@router.post("/submit-result", response_model=SubmitResultResponse, deprecated=True)
async def submit_coding_result_legacy(
    request: SubmitResultRequest,
    current_user=Depends(get_current_active_user),
):
    """旧客户端自报正确接口已停用，防止伪造完成状态。"""
    raise HTTPException(status_code=410, detail="旧提交接口已停用，请刷新页面后使用服务端判题")
