"""试卷系统 API 端点"""
import json
import io
import random
import re
from typing import List, Optional, Dict, Any
from uuid import UUID
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.neo4j import get_neo4j, Neo4jConnection
from app.models.question_bank import (
    QuestionBank, Question, ExamPaper, PracticeSession, KnowledgePoint,
)
from app.schemas.question_bank import (
    ExamPaperCreate, ExamPaperUpdate, ExamPaperListItem, ExamPaperDetailResponse,
    ExamPaperListResponse, SuggestQuestionsRequest, SuggestQuestionsResponse,
    ParseUploadResponse, AIGenerateExamResponse, StartExamPracticeResponse,
)
from app.api.dependencies import get_current_active_user
from app.services.exam_optimizer import ExamOptimizer
from app.services.exam_export import export_pdf, export_word

router = APIRouter(prefix="/question-bank", tags=["Exam Paper"])


# ── 交互式 AI 出题 schema（复用题库出题逻辑）──

class AIGenerateRequest(BaseModel):
    message: str
    conversation_history: List[Dict[str, str]] = Field(default_factory=list)
    collected_params: Dict[str, Any] = Field(default_factory=dict)


class AIGenerateResponse(BaseModel):
    reply: str
    collected_params: Dict[str, Any] = Field(default_factory=dict)
    generated_questions: List[Dict[str, Any]] = Field(default_factory=list)
    is_complete: bool = False


AI_EXAM_SYSTEM_PROMPT = """你是一个专业的AI出题助手，正在为试卷「{exam_title}」生成全新的题目。

所属学科：{subject_name}

该学科已有的知识点结构如下（包含知识点ID）：
{knowledge_tree}

{existing_questions_context}

【关键规则】
1. 你生成的题目必须和题库中已有的题目完全不相同！不能重复出题。
2. 如果某个知识点区域已有大量题目，你必须出全新的、不重复的题目。
3. 你拥有完整的知识点操作权限，可以使用已有的知识点ID，也可以用 __new__:章节名:知识点名 创建新的。

你的任务是引导用户明确出题需求，然后生成试卷题目。

需要收集的信息：
1. 知识点（至少1个）
2. 题型（single_choice=单选题, multiple_choice=多选题, fill_blank=填空题, true_false=判断题, programming=编程题；不要生成简答题或论述题）
3. 题目数量（建议1-10题）
4. 难度（beginner=入门, basic=基础, intermediate=进阶, advanced=挑战, competition=竞赛）

已经收集到的信息：
{collected_info}

【难度要求——非常重要】
- 这道试卷是期末考试级别，必须出有深度、有区分度的题目
- 避免简单的概念复述题（如"什么是XX"），必须考察学生的深度理解和综合应用能力
- 对于选择题：选项设计要有迷惑性，考察易混淆概念，不能一眼看出答案
- 适当设置陷阱选项，考查学生对概念边界的掌握
- 难度建议：至少以 intermediate（进阶）或 advanced（挑战）为主

对话规则：
1. 信息不足时，礼貌地询问缺少的信息
2. 所有信息收集完毕后，第一行输出 [[GENERATE]]，换行后输出JSON数组
3. 每个题目格式：
{{
  "type": "题型",
  "content": {{"stem": "题干", "options": [{{"key": "A", "text": "选项文本"}}]}},
  "answer": {{"correct_answer": [...], "explanation": "解析"}},
  "difficulty": "难度",
  "knowledge_point_uuids": ["知识点ID"],
  "tags": ["标签"],
  "priority": 0
}}"""


SYSTEM_OWNER_ID = UUID("00000000-0000-0000-0000-000000000000")
SEED_BANK_ID = UUID("2ce6ee7d-ed5a-42a1-8a26-6ad6856afd3e")


def _get_bank(bank_id: UUID, db: Session, user) -> QuestionBank:
    """获取用户可读的题库（自己的或种子题库）"""
    from sqlalchemy import and_, or_
    bank = db.query(QuestionBank).filter(
        QuestionBank.id == bank_id,
        or_(
            QuestionBank.owner_id == user.student_id,
            and_(QuestionBank.owner_id == SYSTEM_OWNER_ID, QuestionBank.visibility == "public"),
        )
    ).first()
    if not bank:
        raise HTTPException(404, detail="题库不存在")
    return bank


def _get_paper(paper_id: UUID, db: Session, user) -> ExamPaper:
    paper = db.query(ExamPaper).filter(ExamPaper.id == paper_id).first()
    if not paper:
        raise HTTPException(404, detail="试卷不存在")
    _get_bank(paper.bank_id, db, user)  # 校验归属
    return paper


def _build_detail(paper: ExamPaper, db: Session) -> ExamPaperDetailResponse:
    sections = (paper.config or {}).get("sections", [])
    resolved = []
    for sec in sections:
        qids = []
        for qid_str in sec.get("question_ids", []):
            try:
                qids.append(UUID(qid_str))
            except ValueError:
                pass
        questions = []
        if qids:
            qs = db.query(Question).filter(Question.id.in_(qids)).all()
            qm = {str(q.id): q for q in qs}
            for qid_str in sec.get("question_ids", []):
                q = qm.get(qid_str)
                if q:
                    questions.append({
                        "id": str(q.id),
                        "type": q.type,
                        "content": q.content,
                        "difficulty": q.difficulty,
                    })
        resolved.append({**sec, "questions": questions})
    return ExamPaperDetailResponse(
        id=paper.id, bank_id=paper.bank_id,
        title=paper.title, description=paper.description,
        config=paper.config, generate_method=paper.generate_method,
        status=paper.status, total_questions=paper.total_questions,
        total_score=paper.total_score,
        time_limit_minutes=paper.time_limit_minutes,
        created_at=paper.created_at, updated_at=paper.updated_at,
        sections=resolved,
    )


# ═════════ CRUD ═════════

@router.post("/banks/{bank_id}/exam-papers", response_model=ExamPaperDetailResponse, status_code=201)
async def create_exam_paper(
    bank_id: UUID, data: ExamPaperCreate,
    db: Session = Depends(get_db), current_user=Depends(get_current_active_user),
):
    bank = _get_bank(bank_id, db, current_user)
    all_qids = []
    for sec in data.sections:
        all_qids.extend(sec.question_ids)
    if all_qids:
        cnt = db.query(Question).filter(
            Question.id.in_([UUID(q) for q in all_qids]),
            Question.bank_id == bank_id,
        ).count()
        if cnt != len(all_qids):
            raise HTTPException(400, detail="部分题目不存在或不属于该题库")
    config = {
        "sections": [s.model_dump() for s in data.sections],
        "total_score": data.total_score,
        "time_limit_minutes": data.time_limit_minutes,
    }
    paper = ExamPaper(
        bank_id=bank_id, owner_id=current_user.student_id,
        title=data.title, description=data.description,
        config=config, generate_method=data.generate_method,
        total_questions=len(all_qids), total_score=data.total_score,
        time_limit_minutes=data.time_limit_minutes,
    )
    db.add(paper)
    db.commit()
    db.refresh(paper)
    return _build_detail(paper, db)


@router.get("/banks/{bank_id}/exam-papers", response_model=ExamPaperListResponse)
async def list_exam_papers(
    bank_id: UUID, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db), current_user=Depends(get_current_active_user),
):
    _get_bank(bank_id, db, current_user)
    q = db.query(ExamPaper).filter(ExamPaper.bank_id == bank_id)
    total = q.count()
    papers = q.order_by(ExamPaper.updated_at.desc()).offset(
        (page - 1) * page_size).limit(page_size).all()
    return ExamPaperListResponse(
        papers=[ExamPaperListItem.model_validate(p) for p in papers], total=total,
    )


@router.get("/exam-papers/{paper_id}", response_model=ExamPaperDetailResponse)
async def get_exam_paper(
    paper_id: UUID, db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    paper = _get_paper(paper_id, db, current_user)
    return _build_detail(paper, db)


@router.put("/exam-papers/{paper_id}", response_model=ExamPaperDetailResponse)
async def update_exam_paper(
    paper_id: UUID, data: ExamPaperUpdate,
    db: Session = Depends(get_db), current_user=Depends(get_current_active_user),
):
    paper = _get_paper(paper_id, db, current_user)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(paper, k, v)
    db.commit()
    db.refresh(paper)
    return _build_detail(paper, db)


@router.delete("/exam-papers/{paper_id}", status_code=204)
async def delete_exam_paper(
    paper_id: UUID, db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    paper = _get_paper(paper_id, db, current_user)
    db.delete(paper)
    db.commit()


# ═════════ 题目推荐 ═════════

@router.post("/banks/{bank_id}/exam-papers/suggest-questions", response_model=SuggestQuestionsResponse)
async def suggest_questions(
    bank_id: UUID, data: SuggestQuestionsRequest,
    db: Session = Depends(get_db), current_user=Depends(get_current_active_user),
):
    _get_bank(bank_id, db, current_user)
    optimizer = ExamOptimizer(db=db, bank_id=bank_id)
    exclude_ids = []
    for eid in data.exclude_question_ids:
        try:
            exclude_ids.append(UUID(eid))
        except ValueError:
            pass

    result = []
    for section in data.sections:
        questions = optimizer.get_available(
            question_type=section.question_type,
            difficulty=section.difficulty,
            domain_ids=section.domain_ids or None,
            exclude_ids=exclude_ids,
        )
        available = len(questions)
        selected = optimizer.select_balanced(
            questions, section.count, section.domain_ids,
        )
        exclude_ids.extend([UUID(s) for s in selected])
        result.append({
            "name": section.name,
            "question_type": section.question_type,
            "question_ids": selected,
            "count": len(selected),
            "score_per_question": section.score_per_question,
            "available_count": available,
        })
    return SuggestQuestionsResponse(
        sections=result, total_questions=sum(s["count"] for s in result),
    )


# ═════════ 上传解析 ═════════

@router.post("/banks/{bank_id}/exam-papers/parse-upload", response_model=ParseUploadResponse)
async def parse_upload(
    bank_id: UUID, file: UploadFile = File(...),
    db: Session = Depends(get_db), current_user=Depends(get_current_active_user),
):
    _get_bank(bank_id, db, current_user)
    content = await file.read()
    filename = file.filename or "unknown"
    full_text = ""

    if filename.endswith(".pdf"):
        import fitz
        doc = fitz.open(stream=content, filetype="pdf")
        for page in doc:
            full_text += page.get_text()
    elif filename.endswith((".docx", ".doc")):
        from app.services.docx_parser import extract_docx_text
        full_text = extract_docx_text(content, max_chars=0)
    else:
        raise HTTPException(400, detail="不支持的文件格式，请上传 PDF 或 Word 文件")

    if not full_text.strip():
        raise HTTPException(400, detail="无法从文件中提取文本内容")

    import re
    lines = full_text.strip().split("\n")
    parsed = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if re.match(r'^[一二三四五六七八九十]+[、．.]', line) or re.match(r'^\d+[、．.]', line):
            parsed.append({"name": line, "original_text": ""})
    if not parsed:
        parsed.append({"name": "全部题目", "original_text": full_text})

    suggested = (filename.rsplit(".", 1)[0] or "上传试卷") + "-仿制"
    return ParseUploadResponse(
        filename=filename, suggested_title=suggested,
        parsed_sections=parsed, full_text=full_text,
    )


# ═════════ AI 生成 ═════════

@router.post("/banks/{bank_id}/exam-papers/ai-generate", response_model=AIGenerateResponse)
async def ai_generate_exam(
    bank_id: UUID, request: AIGenerateRequest,
    db: Session = Depends(get_db), neo4j: Neo4jConnection = Depends(get_neo4j),
    current_user=Depends(get_current_active_user),
):
    """交互式 AI 出题：通过对话引导用户明确需求，生成全新题目（不与题库重复）"""
    bank = _get_bank(bank_id, db, current_user)
    from app.api.endpoints.question_bank import (
        _build_knowledge_context, _call_llm_for_questions,
        _ensure_knowledge_points, _get_existing_questions_context,
        Subject,
    )

    subject = db.query(Subject).filter(Subject.id == bank.subject_id).first()
    knowledge_tree = _build_knowledge_context(db, bank.subject_id)
    existing_ctx = _get_existing_questions_context(db, bank_id)
    collected_info_str = json.dumps(request.collected_params, ensure_ascii=False) if request.collected_params else "暂未收集"

    system_prompt = AI_EXAM_SYSTEM_PROMPT.format(
        exam_title=bank.name,
        subject_name=subject.name if subject else "未知",
        knowledge_tree=knowledge_tree,
        existing_questions_context=existing_ctx,
        collected_info=collected_info_str,
    )

    messages = [{"role": "system", "content": system_prompt}]
    for msg in request.conversation_history[-20:]:
        messages.append(msg)
    messages.append({"role": "user", "content": request.message})

    # 获取 API Key（优先用户配置，其次系统默认）
    from app.core.config import settings
    from app.crud.api_settings import api_settings_crud
    api_key = settings.DEEPSEEK_API_KEY
    base_url = settings.DEEPSEEK_BASE_URL
    if not api_key:
        api_key = settings.QWEN_API_KEY
        base_url = settings.QWEN_BASE_URL
    if not api_key:
        for provider, default_url in [("deepseek", settings.DEEPSEEK_BASE_URL), ("qwen", settings.QWEN_BASE_URL)]:
            user_cfg = api_settings_crud.get_setting_value(db, str(current_user.student_id), provider)
            if user_cfg:
                api_key = user_cfg["api_key"]
                base_url = user_cfg.get("base_url") or default_url
                break
    if not api_key:
        raise HTTPException(400, detail="AI 出题功能未配置。请先在「设置」中配置 DeepSeek 或 Qwen API Key")

    try:
        reply = await _call_llm_for_questions(
            messages, api_key_override=api_key, base_url_override=base_url,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"AI 出题出错: {str(e)}")

    is_complete = False
    generated_questions = []

    if "[[GENERATE]]" in reply:
        is_complete = True
        json_part = reply.split("[[GENERATE]]", 1)[1].strip()
        # 去除 markdown 代码块标记
        json_part = re.sub(r'^```(?:json)?\s*', '', json_part)
        json_part = re.sub(r'\s*```$', '', json_part)
        json_start = json_part.find("[")
        json_end = json_part.rfind("]")
        if json_start != -1 and json_end != -1:
            json_str = json_part[json_start:json_end + 1]
            try:
                generated_questions = json.loads(json_str)
                if not isinstance(generated_questions, list):
                    generated_questions = []
                else:
                    try:
                        generated_questions = _ensure_knowledge_points(
                            neo4j, db, bank.subject_id, generated_questions
                        )
                    except Exception:
                        pass
            except json.JSONDecodeError:
                is_complete = False
                reply = reply.replace("[[GENERATE]]", "").strip()

    updated_params = dict(request.collected_params)
    if is_complete:
        updated_params["generated_count"] = len(generated_questions)

    return AIGenerateResponse(
        reply=reply,
        collected_params=updated_params,
        generated_questions=generated_questions,
        is_complete=is_complete,
    )


# ═════════ 导出 ═════════

@router.get("/exam-papers/{paper_id}/export/pdf")
async def export_exam_paper_pdf(
    paper_id: UUID, db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    paper = _get_paper(paper_id, db, current_user)
    sections = (paper.config or {}).get("sections", [])
    all_qids = []
    for s in sections:
        all_qids.extend(s.get("question_ids", []))
    questions = db.query(Question).filter(
        Question.id.in_([UUID(q) for q in all_qids])
    ).all() if all_qids else []
    qmap = {str(q.id): q for q in questions}
    buf = export_pdf(paper.title, sections, qmap, paper.total_score, paper.time_limit_minutes)
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(paper.title + '.pdf')}"},
    )


@router.get("/exam-papers/{paper_id}/export/word")
async def export_exam_paper_word(
    paper_id: UUID, db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    paper = _get_paper(paper_id, db, current_user)
    sections = (paper.config or {}).get("sections", [])
    all_qids = []
    for s in sections:
        all_qids.extend(s.get("question_ids", []))
    questions = db.query(Question).filter(
        Question.id.in_([UUID(q) for q in all_qids])
    ).all() if all_qids else []
    qmap = {str(q.id): q for q in questions}
    buf = export_word(paper.title, sections, qmap, paper.total_score, paper.time_limit_minutes)
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(paper.title + '.docx')}"},
    )


# ═════════ 开始练习 ═════════

@router.post("/exam-papers/{paper_id}/start-practice", response_model=StartExamPracticeResponse)
async def start_exam_practice(
    paper_id: UUID, db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    paper = _get_paper(paper_id, db, current_user)
    sections = (paper.config or {}).get("sections", [])
    question_order = []
    for s in sections:
        question_order.extend(s.get("question_ids", []))
    if not question_order:
        raise HTTPException(400, detail="试卷没有题目")

    session = PracticeSession(
        user_id=current_user.student_id,
        bank_id=paper.bank_id,
        mode="exam",
        answer_mode="after",
        question_order=question_order,
        stats={
            "total": len(question_order), "completed": 0,
            "correct": 0, "incorrect": 0,
            "exam_paper_id": str(paper.id),
            "exam_title": paper.title,
            "time_limit_minutes": paper.time_limit_minutes,
        },
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return StartExamPracticeResponse(
        session_id=str(session.id),
        practice_url=f"/banks/{paper.bank_id}/practice?session_id={session.id}",
    )
