from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional, Dict, Any, AsyncGenerator
from collections import defaultdict
import json
import os
import re
import httpx

from app.db.database import get_db
from app.db.neo4j import get_neo4j, Neo4jConnection
from app.models.question_bank import (
    Subject, KnowledgeDomain, KnowledgePoint, QuestionBank, Question, StudentAnswer, PracticeSession
)
from app.schemas.question_bank import (
    SubjectCreate, SubjectResponse,
    KnowledgeDomainCreate, KnowledgeDomainResponse,
    KnowledgePointCreate, KnowledgePointResponse,
    SubjectListResponse,
    QuestionBankCreate, QuestionBankUpdate, QuestionBankResponse, QuestionBankListResponse,
    QuestionCreate, QuestionUpdate, QuestionResponse, QuestionListResponse,
    PracticeConfig, PracticeQuestionResponse,
    AnswerSubmitRequest, AnswerSubmitResponse,
    BatchAnswerSubmitRequest, BatchAnswerSubmitResponse,
    DomainQuestionCount,
    PracticeSessionCreate, PracticeSessionUpdate, PracticeSessionResponse, PracticeSessionListResponse,
)
from app.api.dependencies import get_current_active_user
from app.core.config import settings
from pydantic import BaseModel, Field

router = APIRouter(prefix="/question-bank", tags=["Question Bank"])


# ─── 单题重生成请求 ─────────────────────────────────────

class QuestionRegenerateRequest(BaseModel):
    feedback: str = Field(..., min_length=1, description="用户对题目的反馈，指出需要改进的地方")


REGENERATE_PROMPT_TEMPLATE = """你是一个专业的AI出题助手，需要根据用户反馈重新生成一道题目。

【重要要求——数学公式必须用 LaTeX 渲染】
涉及数学符号、公式、表达式的地方，必须使用 LaTeX 格式：
- 行内公式用 $...$，例如：$x + y = z$，$a < b$，$\forall x \exists y$
- 独立公式用 $$...$$，例如：$$\sum_{{}}$$
- 变量符号如 x, y, a, b 等必须用 $x$, $y$ 包裹，不能直接写纯文本 x
- 逻辑符号：$\forall$（全称量词）、$\exists$（存在量词）、$\land$（合取）、$\lor$（析取）、$\neg$（否定）、$\rightarrow$（蕴含）、$\leftrightarrow$（双蕴含）
- 集合符号：$\in$（属于）、$\subseteq$（子集）、$\cap$（交集）、$\cup$（并集）、$\emptyset$（空集）
- 关系符号：$<$、$>$、$\leq$、$\geq$、$\neq$
- 绝对不能出现纯文本的"x"、"a<b"、"P(x,y)"等形式，所有数学表达式必须用 LaTeX 包裹

以下是需要重新生成的题目：
@@QUESTION_JSON@@

用户的反馈意见：
@@FEEDBACK@@

请根据反馈意见重新生成这道题。确保：
1. 所有数学符号和公式都用 LaTeX 渲染（$...$ 或 $$...$$）
2. 题目质量更高，有深度
3. 与原题知识点一致，但题干和答案完全不同
4. 解析要详细，解析中的公式也要用 LaTeX

回复格式：第一行输出 [[GENERATE]]，换行后输出单个题目的JSON对象（不要数组）"""


# ─── Neo4j sync helpers ───────────────────────────────────────

def _sync_subject_to_neo4j(neo4j: Neo4jConnection, subject: Subject):
    with neo4j.connect().session() as session:
        session.run(
            "MERGE (s:Subject {uuid: $uuid}) SET s.name = $name",
            uuid=str(subject.id), name=subject.name
        )


def _sync_domain_to_neo4j(neo4j: Neo4jConnection, domain: KnowledgeDomain, subject_id: UUID):
    with neo4j.connect().session() as session:
        session.run(
            """
            MERGE (d:KnowledgeDomain {uuid: $uuid}) SET d.name = $name
            WITH d MATCH (s:Subject {uuid: $sid})
            MERGE (d)-[:BELONGS_TO]->(s)
            """, uuid=str(domain.id), name=domain.name, sid=str(subject_id)
        )


def _sync_point_to_neo4j(neo4j: Neo4jConnection, point: KnowledgePoint, domain_id: UUID):
    with neo4j.connect().session() as session:
        session.run(
            """
            MERGE (p:KnowledgePoint {uuid: $uuid})
            SET p.name = $name, p.description = $desc, p.difficulty = $diff
            WITH p MATCH (d:KnowledgeDomain {uuid: $did})
            MERGE (d)-[:HAS_SUB]->(p)
            """,
            uuid=str(point.id), name=point.name, desc=point.description or "",
            diff=point.difficulty, did=str(domain_id)
        )


def _sync_question_to_neo4j(neo4j: Neo4jConnection, question: Question):
    """
    在 Neo4j 创建/更新 Question 节点，并建立 [:TESTS] 关系到知识点。
    knowledge_point_uuids 字段存储了目标知识点的 UUID 列表。
    """
    with neo4j.connect().session() as session:
        # 创建或更新 Question 节点
        session.run(
            "MERGE (q:Question {uuid: $uuid})",
            uuid=str(question.id)
        )
        # 删除旧的 TESTS 关系
        session.run(
            "MATCH (q:Question {uuid: $uuid})-[r:TESTS]->() DELETE r",
            uuid=str(question.id)
        )
        # 建立新的 TESTS 关系到每个知识点
        for kp_uuid in (question.knowledge_point_uuids or []):
            session.run(
                """
                MATCH (q:Question {uuid: $quid})
                MATCH (kp:KnowledgePoint {uuid: $kpuuid})
                MERGE (q)-[:TESTS]->(kp)
                """, quid=str(question.id), kpuuid=kp_uuid
            )


def _delete_question_from_neo4j(neo4j: Neo4jConnection, question_id: UUID):
    with neo4j.connect().session() as session:
        session.run(
            "MATCH (q:Question {uuid: $uuid}) DETACH DELETE q",
            uuid=str(question_id)
        )


# ═══════════════════════════════════════════════════════════════
#  Subjects
# ═══════════════════════════════════════════════════════════════

@router.get("/subjects", response_model=SubjectListResponse)
async def list_subjects(db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    subjects = db.query(Subject).order_by(Subject.sort_order, Subject.name).all()
    return SubjectListResponse(
        subjects=[SubjectResponse.model_validate(s) for s in subjects],
        total=len(subjects)
    )


@router.post("/subjects", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
async def create_subject(
    data: SubjectCreate, db: Session = Depends(get_db),
    neo4j: Neo4jConnection = Depends(get_neo4j), current_user=Depends(get_current_active_user)
):
    existing = db.query(Subject).filter(Subject.name == data.name).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"学科「{data.name}」已存在")
    subject = Subject(creator_id=current_user.student_id, **data.model_dump())
    db.add(subject); db.commit(); db.refresh(subject)
    try: _sync_subject_to_neo4j(neo4j, subject)
    except: pass
    return SubjectResponse.model_validate(subject)


@router.get("/subjects/{subject_id}", response_model=SubjectResponse)
async def get_subject(subject_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject: raise HTTPException(status_code=404, detail="学科不存在")
    return SubjectResponse.model_validate(subject)


@router.put("/subjects/{subject_id}", response_model=SubjectResponse)
async def update_subject(
    subject_id: UUID, data: SubjectCreate, db: Session = Depends(get_db),
    neo4j: Neo4jConnection = Depends(get_neo4j), current_user=Depends(get_current_active_user)
):
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject: raise HTTPException(status_code=404, detail="学科不存在")
    for k, v in data.model_dump().items(): setattr(subject, k, v)
    db.commit(); db.refresh(subject)
    try: _sync_subject_to_neo4j(neo4j, subject)
    except: pass
    return SubjectResponse.model_validate(subject)


@router.delete("/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject(subject_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject: raise HTTPException(status_code=404, detail="学科不存在")
    db.delete(subject); db.commit()


# ═══════════════════════════════════════════════════════════════
#  Knowledge Domains
# ═══════════════════════════════════════════════════════════════

@router.get("/subjects/{subject_id}/domains", response_model=List[KnowledgeDomainResponse])
async def list_domains(subject_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    domains = db.query(KnowledgeDomain).filter(KnowledgeDomain.subject_id == subject_id
        ).order_by(KnowledgeDomain.sort_order, KnowledgeDomain.name).all()
    return [KnowledgeDomainResponse.model_validate(d) for d in domains]


@router.post("/subjects/{subject_id}/domains", response_model=KnowledgeDomainResponse, status_code=status.HTTP_201_CREATED)
async def create_domain(
    subject_id: UUID, data: KnowledgeDomainCreate, db: Session = Depends(get_db),
    neo4j: Neo4jConnection = Depends(get_neo4j), current_user=Depends(get_current_active_user)
):
    domain = KnowledgeDomain(subject_id=subject_id, **data.model_dump())
    db.add(domain); db.commit(); db.refresh(domain)
    try: _sync_domain_to_neo4j(neo4j, domain, subject_id)
    except: pass
    return KnowledgeDomainResponse.model_validate(domain)


@router.put("/domains/{domain_id}", response_model=KnowledgeDomainResponse)
async def update_domain(
    domain_id: UUID, data: KnowledgeDomainCreate, db: Session = Depends(get_db),
    neo4j: Neo4jConnection = Depends(get_neo4j), current_user=Depends(get_current_active_user)
):
    domain = db.query(KnowledgeDomain).filter(KnowledgeDomain.id == domain_id).first()
    if not domain: raise HTTPException(status_code=404, detail="知识领域不存在")
    for k, v in data.model_dump().items(): setattr(domain, k, v)
    db.commit(); db.refresh(domain)
    try: _sync_domain_to_neo4j(neo4j, domain, domain.subject_id)
    except: pass
    return KnowledgeDomainResponse.model_validate(domain)


@router.delete("/domains/{domain_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_domain(domain_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    domain = db.query(KnowledgeDomain).filter(KnowledgeDomain.id == domain_id).first()
    if not domain: raise HTTPException(status_code=404, detail="知识领域不存在")
    db.delete(domain); db.commit()


# ═══════════════════════════════════════════════════════════════
#  Knowledge Points
# ═══════════════════════════════════════════════════════════════

@router.get("/domains/{domain_id}/points", response_model=List[KnowledgePointResponse])
async def list_points(domain_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    points = db.query(KnowledgePoint).filter(KnowledgePoint.domain_id == domain_id
        ).order_by(KnowledgePoint.sort_order, KnowledgePoint.name).all()
    return [KnowledgePointResponse.model_validate(p) for p in points]


@router.post("/domains/{domain_id}/points", response_model=KnowledgePointResponse, status_code=status.HTTP_201_CREATED)
async def create_point(
    domain_id: UUID, data: KnowledgePointCreate, db: Session = Depends(get_db),
    neo4j: Neo4jConnection = Depends(get_neo4j), current_user=Depends(get_current_active_user)
):
    point = KnowledgePoint(domain_id=domain_id, **data.model_dump())
    db.add(point); db.commit(); db.refresh(point)
    try: _sync_point_to_neo4j(neo4j, point, domain_id)
    except: pass
    return KnowledgePointResponse.model_validate(point)


@router.put("/points/{point_id}", response_model=KnowledgePointResponse)
async def update_point(
    point_id: UUID, data: KnowledgePointCreate, db: Session = Depends(get_db),
    neo4j: Neo4jConnection = Depends(get_neo4j), current_user=Depends(get_current_active_user)
):
    point = db.query(KnowledgePoint).filter(KnowledgePoint.id == point_id).first()
    if not point: raise HTTPException(status_code=404, detail="知识点不存在")
    for k, v in data.model_dump().items(): setattr(point, k, v)
    db.commit(); db.refresh(point)
    try: _sync_point_to_neo4j(neo4j, point, point.domain_id)
    except: pass
    return KnowledgePointResponse.model_validate(point)


@router.delete("/points/{point_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_point(point_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    point = db.query(KnowledgePoint).filter(KnowledgePoint.id == point_id).first()
    if not point: raise HTTPException(status_code=404, detail="知识点不存在")
    db.delete(point); db.commit()


# ═══════════════════════════════════════════════════════════════
#  Question Banks
# ═══════════════════════════════════════════════════════════════

@router.get("/banks", response_model=QuestionBankListResponse)
async def list_banks(
    subject_id: Optional[UUID] = Query(None), search: Optional[str] = Query(None),
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db), current_user=Depends(get_current_active_user)
):
    query = db.query(QuestionBank).filter(QuestionBank.owner_id == current_user.student_id)
    if subject_id: query = query.filter(QuestionBank.subject_id == subject_id)
    if search: query = query.filter(QuestionBank.name.ilike(f"%{search}%"))
    total = query.count()
    banks = query.order_by(QuestionBank.updated_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return QuestionBankListResponse(banks=[QuestionBankResponse.model_validate(b) for b in banks], total=total)


@router.post("/banks", response_model=QuestionBankResponse, status_code=status.HTTP_201_CREATED)
async def create_bank(
    data: QuestionBankCreate, db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    bank = QuestionBank(owner_id=current_user.student_id, **data.model_dump())
    db.add(bank); db.commit(); db.refresh(bank)
    return QuestionBankResponse.model_validate(bank)


@router.get("/banks/{bank_id}", response_model=QuestionBankResponse)
async def get_bank(bank_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    bank = db.query(QuestionBank).filter(QuestionBank.id == bank_id, QuestionBank.owner_id == current_user.student_id).first()
    if not bank: raise HTTPException(status_code=404, detail="题库不存在")
    return QuestionBankResponse.model_validate(bank)


@router.put("/banks/{bank_id}", response_model=QuestionBankResponse)
async def update_bank(
    bank_id: UUID, data: QuestionBankUpdate, db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    bank = db.query(QuestionBank).filter(QuestionBank.id == bank_id, QuestionBank.owner_id == current_user.student_id).first()
    if not bank: raise HTTPException(status_code=404, detail="题库不存在")
    for k, v in data.model_dump(exclude_unset=True).items(): setattr(bank, k, v)
    db.commit(); db.refresh(bank)
    return QuestionBankResponse.model_validate(bank)


@router.delete("/banks/{bank_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bank(bank_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    bank = db.query(QuestionBank).filter(QuestionBank.id == bank_id, QuestionBank.owner_id == current_user.student_id).first()
    if not bank: raise HTTPException(status_code=404, detail="题库不存在")
    db.delete(bank); db.commit()


# ═══════════════════════════════════════════════════════════════
#  Questions — 核心：知识点关联 + Neo4j 同步
# ═══════════════════════════════════════════════════════════════

@router.get("/banks/{bank_id}/questions", response_model=QuestionListResponse)
async def list_questions(
    bank_id: UUID, question_type: Optional[str] = Query(None, alias="type"),
    difficulty: Optional[str] = Query(None), status_filter: Optional[str] = Query(None, alias="status"),
    kp_uuid: Optional[str] = Query(None, alias="knowledge_point_uuid"),
    search: Optional[str] = Query(None), page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db), current_user=Depends(get_current_active_user)
):
    bank = db.query(QuestionBank).filter(QuestionBank.id == bank_id, QuestionBank.owner_id == current_user.student_id).first()
    if not bank: raise HTTPException(status_code=404, detail="题库不存在")

    query = db.query(Question).filter(Question.bank_id == bank_id)
    if question_type: query = query.filter(Question.type == question_type)
    if difficulty: query = query.filter(Question.difficulty == difficulty)
    if status_filter: query = query.filter(Question.status == status_filter)
    if kp_uuid: query = query.filter(Question.knowledge_point_uuids.contains([kp_uuid]))
    if search: query = query.filter(Question.content["stem"].astext.ilike(f"%{search}%"))

    total = query.count()
    questions = query.order_by(Question.priority.desc(), Question.created_at.desc()).offset(
        (page - 1) * page_size).limit(page_size).all()
    return QuestionListResponse(
        questions=[QuestionResponse.model_validate(q) for q in questions],
        total=total, page=page, page_size=page_size,
    )


@router.post("/banks/{bank_id}/questions", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
async def create_question(
    bank_id: UUID, data: QuestionCreate, db: Session = Depends(get_db),
    neo4j: Neo4jConnection = Depends(get_neo4j), current_user=Depends(get_current_active_user)
):
    bank = db.query(QuestionBank).filter(QuestionBank.id == bank_id, QuestionBank.owner_id == current_user.student_id).first()
    if not bank: raise HTTPException(status_code=404, detail="题库不存在")

    question = Question(
        bank_id=bank_id, created_by=current_user.student_id, **data.model_dump()
    )
    db.add(question); db.commit(); db.refresh(question)

    # 同步到 Neo4j：创建 Question 节点 + [:TESTS] 关系
    try:
        _sync_question_to_neo4j(neo4j, question)
    except Exception:
        pass

    # 更新题库题目计数
    bank.total_questions = db.query(Question).filter(Question.bank_id == bank_id).count()
    db.commit()

    return QuestionResponse.model_validate(question)


@router.get("/questions/{question_id}", response_model=QuestionResponse)
async def get_question(question_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question: raise HTTPException(status_code=404, detail="题目不存在")
    bank = db.query(QuestionBank).filter(QuestionBank.id == question.bank_id, QuestionBank.owner_id == current_user.student_id).first()
    if not bank: raise HTTPException(status_code=403, detail="无权访问该题目")
    return QuestionResponse.model_validate(question)


@router.put("/questions/{question_id}", response_model=QuestionResponse)
async def update_question(
    question_id: UUID, data: QuestionUpdate, db: Session = Depends(get_db),
    neo4j: Neo4jConnection = Depends(get_neo4j), current_user=Depends(get_current_active_user)
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question: raise HTTPException(status_code=404, detail="题目不存在")
    bank = db.query(QuestionBank).filter(QuestionBank.id == question.bank_id, QuestionBank.owner_id == current_user.student_id).first()
    if not bank: raise HTTPException(status_code=403, detail="无权修改该题目")

    for k, v in data.model_dump(exclude_unset=True).items(): setattr(question, k, v)
    db.commit(); db.refresh(question)

    try: _sync_question_to_neo4j(neo4j, question)
    except: pass
    return QuestionResponse.model_validate(question)


@router.post("/questions/{question_id}/regenerate", response_model=QuestionResponse)
async def regenerate_question(
    question_id: UUID, data: QuestionRegenerateRequest,
    db: Session = Depends(get_db),
    neo4j: Neo4jConnection = Depends(get_neo4j),
    current_user=Depends(get_current_active_user),
):
    """根据用户反馈重新生成单道题目，强调 LaTeX 渲染"""
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question: raise HTTPException(status_code=404, detail="题目不存在")
    bank = db.query(QuestionBank).filter(
        QuestionBank.id == question.bank_id,
        QuestionBank.owner_id == current_user.student_id
    ).first()
    if not bank: raise HTTPException(status_code=403, detail="无权修改该题目")

    # 检查 API 配置（同时检查用户配置）
    from app.crud.api_settings import api_settings_crud
    api_key = settings.DEEPSEEK_API_KEY
    base_url = settings.DEEPSEEK_BASE_URL
    model = settings.DEEPSEEK_MODEL
    if not api_key:
        api_key = settings.QWEN_API_KEY
        base_url = settings.QWEN_BASE_URL
        model = settings.QWEN_MODEL
    if not api_key:
        for provider, default_url, provider_model in [
            ("deepseek", settings.DEEPSEEK_BASE_URL, settings.DEEPSEEK_MODEL),
            ("qwen", settings.QWEN_BASE_URL, settings.QWEN_MODEL),
        ]:
            user_cfg = api_settings_crud.get_setting_value(db, str(current_user.student_id), provider)
            if user_cfg:
                api_key = user_cfg["api_key"]
                base_url = user_cfg.get("base_url") or default_url
                model = provider_model
                break
    if not api_key:
        raise HTTPException(status_code=400, detail="AI 出题功能未配置 API Key，请在设置中配置")

    # 构建提示词
    question_json = json.dumps({
        "type": question.type,
        "content": question.content,
        "answer": question.answer,
        "difficulty": question.difficulty,
        "tags": question.tags,
    }, ensure_ascii=False, indent=2)

    prompt = REGENERATE_PROMPT_TEMPLATE.replace("@@QUESTION_JSON@@", question_json).replace("@@FEEDBACK@@", data.feedback)

    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": f"请根据以下反馈重新生成这道题：{data.feedback}"},
    ]

    try:
        reply = await _call_llm_for_questions(messages, api_key_override=api_key, base_url_override=base_url, model_override=model)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 重生成出错: {str(e)}")

    # 解析 [[GENERATE]]
    if "[[GENERATE]]" not in reply:
        raise HTTPException(status_code=500, detail="AI 未能生成有效题目，请重试或调整反馈")

    json_part = reply.split("[[GENERATE]]", 1)[1].strip()
    json_part = re.sub(r'^```(?:json)?\s*', '', json_part)
    json_part = re.sub(r'\s*```$', '', json_part)

    # 可能是单个对象或数组
    if json_part.startswith("["):
        json_start = json_part.find("[")
        json_end = json_part.rfind("]")
        items = _safe_parse_json(json_part[json_start:json_end + 1])
        new_q_data = items[0] if items else None
    else:
        new_q_data = _safe_parse_json(json_part)

    if not new_q_data:
        raise HTTPException(status_code=500, detail="AI 返回的题目数据为空")

    # 保留原始知识点关联，题目不因重生成而改变所属知识点
    original_kp_uuids = list(question.knowledge_point_uuids or [])
    # 处理 __new__ 知识点
    try:
        new_q_data = _ensure_knowledge_points(neo4j, db, bank.subject_id, [new_q_data])[0]
    except Exception:
        pass

    # 更新题目
    for field in ["type", "difficulty", "priority"]:
        if field in new_q_data:
            setattr(question, field, new_q_data[field])
    if "content" in new_q_data:
        question.content = new_q_data["content"]
    if "answer" in new_q_data:
        question.answer = new_q_data["answer"]
    if "tags" in new_q_data:
        question.tags = new_q_data["tags"]
    # 保留原始知识点关联（不让 AI 改变题目所属知识点）
    question.knowledge_point_uuids = original_kp_uuids
    question.ai_generated = True
    question.source = "ai_regen"

    db.commit()
    db.refresh(question)

    try:
        _sync_question_to_neo4j(neo4j, question)
    except Exception:
        pass

    return QuestionResponse.model_validate(question)


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: UUID, db: Session = Depends(get_db),
    neo4j: Neo4jConnection = Depends(get_neo4j), current_user=Depends(get_current_active_user)
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question: raise HTTPException(status_code=404, detail="题目不存在")
    bank = db.query(QuestionBank).filter(QuestionBank.id == question.bank_id, QuestionBank.owner_id == current_user.student_id).first()
    if not bank: raise HTTPException(status_code=403, detail="无权删除该题目")

    bank_id = question.bank_id
    db.delete(question); db.commit()

    # 更新题库计数
    bank.total_questions = db.query(Question).filter(Question.bank_id == bank_id).count()
    db.commit()

    try: _delete_question_from_neo4j(neo4j, question_id)
    except: pass


# ═══════════════════════════════════════════════════════════════
#  Practice — 学生自测
# ═══════════════════════════════════════════════════════════════


@router.post("/banks/{bank_id}/practice-questions", response_model=List[PracticeQuestionResponse])
async def get_practice_questions(
    bank_id: UUID, config: PracticeConfig,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """获取自测题目列表（不含答案），支持多种过滤条件"""
    # 1. 验证题库归属
    bank = db.query(QuestionBank).filter(
        QuestionBank.id == bank_id, QuestionBank.owner_id == current_user.student_id
    ).first()
    if not bank:
        raise HTTPException(status_code=404, detail="题库不存在")

    # 2. 构建基础查询
    query = db.query(Question).filter(
        Question.bank_id == bank_id,
        Question.status == "published",
    )

    # 3. 题型过滤
    if config.question_types:
        query = query.filter(Question.type.in_(config.question_types))

    # 4. 章节过滤（通过知识点）
    if config.domain_ids:
        from sqlalchemy import or_
        kp_ids = db.query(KnowledgePoint.id).filter(
            KnowledgePoint.domain_id.in_(config.domain_ids)
        ).all()
        kp_uuid_strs = [str(kp[0]) for kp in kp_ids]
        if kp_uuid_strs:
            conditions = [Question.knowledge_point_uuids.contains([uid]) for uid in kp_uuid_strs]
            query = query.filter(or_(*conditions))
        else:
            return []

    # 5. 只做未做的
    if config.only_unanswered:
        from sqlalchemy import not_, exists
        has_correct = exists().where(
            StudentAnswer.user_id == current_user.student_id,
            StudentAnswer.question_id == Question.id,
            StudentAnswer.is_correct == True,
        )
        query = query.filter(not_(has_correct))

    # 6. 只做错题
    if config.only_wrong:
        from sqlalchemy import exists
        has_wrong = exists().where(
            StudentAnswer.user_id == current_user.student_id,
            StudentAnswer.question_id == Question.id,
            StudentAnswer.is_correct == False,
        )
        query = query.filter(has_wrong)

    # 7. 获取所有符合条件的题目
    questions = query.order_by(Question.priority.desc(), Question.created_at.desc()).all()

    # 8. 打乱顺序
    import random
    random.shuffle(questions)

    # 9. 限制数量
    if config.question_count and config.question_count < len(questions):
        questions = questions[:config.question_count]

    # 10. 返回
    result = []
    for q in questions:
        result.append(PracticeQuestionResponse(
            id=q.id,
            type=q.type,
            content=q.content,
            answer=q.answer,
            difficulty=q.difficulty,
            knowledge_point_uuids=q.knowledge_point_uuids or [],
            tags=q.tags or [],
        ))
    return result


@router.post("/banks/{bank_id}/domain-counts", response_model=List[DomainQuestionCount])
async def get_domain_question_counts(
    bank_id: UUID,
    config: PracticeConfig,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """获取各章节的题目数量（支持过滤条件）"""
    bank = db.query(QuestionBank).filter(
        QuestionBank.id == bank_id, QuestionBank.owner_id == current_user.student_id
    ).first()
    if not bank:
        raise HTTPException(status_code=404, detail="题库不存在")

    # 获取该题库下的所有领域
    domains = db.query(KnowledgeDomain).filter(
        KnowledgeDomain.subject_id == bank.subject_id
    ).order_by(KnowledgeDomain.sort_order).all()

    # 获取所有已发布的题目
    questions_query = db.query(Question).filter(
        Question.bank_id == bank_id,
        Question.status == "published",
    )
    if config.question_types:
        questions_query = questions_query.filter(Question.type.in_(config.question_types))
    all_questions = questions_query.all()

    # 按知识点分组统计
    domain_question_map = defaultdict(list)

    for domain in domains:
        kp_ids = db.query(KnowledgePoint.id).filter(
            KnowledgePoint.domain_id == domain.id
        ).all()
        kp_uuid_strs = {str(kp[0]) for kp in kp_ids}
        for q in all_questions:
            q_kps = set(q.knowledge_point_uuids or [])
            if q_kps & kp_uuid_strs:
                domain_question_map[domain.id].append(q)

    # 统计（始终返回所有章节，前端自行处理选中状态）
    result = []
    for domain in domains:
        total = 0
        unanswered = 0
        wrong = 0
        questions = domain_question_map.get(domain.id, [])

        for q in questions:
            total += 1

            # 统计未做题
            has_answered = db.query(StudentAnswer).filter(
                StudentAnswer.user_id == current_user.student_id,
                StudentAnswer.question_id == q.id,
            ).first()
            if not has_answered:
                unanswered += 1

            # 统计错题（最近一次答错）
            last_answer = db.query(StudentAnswer).filter(
                StudentAnswer.user_id == current_user.student_id,
                StudentAnswer.question_id == q.id,
            ).order_by(StudentAnswer.created_at.desc()).first()
            if last_answer and not last_answer.is_correct:
                wrong += 1

        # 计算最终数量（考虑 only_unanswered / only_wrong）
        if config.only_unanswered:
            total = unanswered
        elif config.only_wrong:
            total = wrong

        result.append(DomainQuestionCount(
            domain_id=str(domain.id),
            domain_name=domain.name,
            total=total,
            unanswered=unanswered,
            wrong=wrong,
        ))

    return result


@router.post("/questions/{question_id}/submit-answer", response_model=AnswerSubmitResponse)
async def submit_answer(
    question_id: UUID, data: AnswerSubmitRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """记录单题答案"""
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在")

    record = StudentAnswer(
        user_id=current_user.student_id,
        question_id=question_id,
        bank_id=question.bank_id,
        answer_content=data.answer_content,
        is_correct=data.is_correct,
        time_spent_seconds=data.time_spent_seconds,
    )
    db.add(record)
    db.commit()
    return AnswerSubmitResponse(is_correct=data.is_correct)


@router.post("/banks/{bank_id}/submit-answers", response_model=BatchAnswerSubmitResponse)
async def submit_answers_batch(
    bank_id: UUID, data: BatchAnswerSubmitRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """批量提交答案"""
    bank = db.query(QuestionBank).filter(
        QuestionBank.id == bank_id, QuestionBank.owner_id == current_user.student_id
    ).first()
    if not bank:
        raise HTTPException(status_code=404, detail="题库不存在")

    results = []
    for item in data.answers:
        record = StudentAnswer(
            user_id=current_user.student_id,
            question_id=item.question_id,
            bank_id=bank_id,
            answer_content=item.answer_content,
            is_correct=item.is_correct,
            time_spent_seconds=item.time_spent_seconds,
        )
        db.add(record)
        results.append(AnswerSubmitResponse(is_correct=item.is_correct))

    db.commit()
    return BatchAnswerSubmitResponse(results=results)


# ═══════════════════════════════════════════════════════════════
#  AI Question Generation — 交互式出题助手
# ═══════════════════════════════════════════════════════════════

class AIGenerateRequest(BaseModel):
    message: str
    conversation_history: List[Dict[str, str]] = Field(default_factory=list)
    collected_params: Dict[str, Any] = Field(default_factory=dict)


class AIGenerateResponse(BaseModel):
    reply: str
    collected_params: Dict[str, Any] = Field(default_factory=dict)
    generated_questions: List[Dict[str, Any]] = Field(default_factory=list)
    is_complete: bool = False


def _build_knowledge_context(db: Session, subject_id: UUID) -> str:
    """构建知识点树文本，包含名称和 UUID 映射"""
    domains = db.query(KnowledgeDomain).filter(
        KnowledgeDomain.subject_id == subject_id
    ).order_by(KnowledgeDomain.sort_order).all()

    lines = []
    for domain in domains:
        points = db.query(KnowledgePoint).filter(
            KnowledgePoint.domain_id == domain.id
        ).order_by(KnowledgePoint.sort_order).all()
        if points:
            lines.append(f"  【{domain.name}】")
            for pt in points:
                lines.append(f"    - {pt.name} (ID: {pt.id})")
    return "\n".join(lines) if lines else "  暂无知识点"


def _get_existing_questions_context(db: Session, bank_id: UUID, max_count: int = 200) -> str:
    """
    获取题库中已有的题目，按标签分组，用于 AI 去重提示。
    AI 可以清楚看到每个标签下已有题目，避免重复出题。
    """
    questions = db.query(Question).filter(
        Question.bank_id == bank_id,
        Question.status == "published",
    ).order_by(Question.created_at.desc()).limit(max_count).all()

    if not questions:
        return ""

    # 按标签分组
    from collections import defaultdict
    tag_groups = defaultdict(list)
    untagged = []

    for q in questions:
        stem = (q.content or {}).get("stem", "")
        tags = q.tags or []
        if tags:
            for tag in tags:
                if len(tag_groups[tag]) < 5:  # 每个标签最多显示5题
                    tag_groups[tag].append(stem)
        else:
            if len(untagged) < 10:
                untagged.append(stem)

    lines = ["【以下为题库中已有的题目（按标签分组），生成新题目时请确保完全不相同，不得与同标签下的任何题目重复】"]
    for tag, stems in sorted(tag_groups.items()):
        lines.append(f"\n  标签「{tag}」:")
        for s in stems:
            lines.append(f"    - {s[:80]}{'...' if len(s) > 80 else ''}")

    if untagged:
        lines.append(f"\n  其他题目:")
        for s in untagged:
            lines.append(f"    - {s[:80]}{'...' if len(s) > 80 else ''}")

    return "\n".join(lines)


AI_SYSTEM_PROMPT = """你是一个专业的AI出题助手，正在题库「{bank_name}」中帮助用户生成题目。

所属学科：{subject_name}

该学科已有的知识点结构如下（包含知识点ID）：
{knowledge_tree}

【重要】你拥有完整的题库操作权限：
1. 可以使用已有的知识点（使用上述ID）
2. 也可以创建全新的知识点和章节 —— 当用户需要新的主题时，在 knowledge_point_uuids 中使用格式 __new__:章节名:知识点名
   例如：["__new__:存储系统:Cache映射方式"] 表示创建"存储系统"章节下的"Cache映射方式"知识点

{existing_questions_context}

你的任务是引导用户明确出题需求，然后生成题目。

需要收集的信息：
1. 知识点（至少1个，可以是已有的或全新的）
2. 题型（single_choice=单选题, multiple_choice=多选题, fill_blank=填空题, true_false=判断题, short_answer=简答题, programming=编程题, essay=论述题）
3. 题目数量（建议1-10题）
4. 难度（beginner=入门, basic=基础, intermediate=进阶, advanced=挑战, competition=竞赛）

【关键规则】你生成的题目必须和题库中已有的题目完全不同！不能和已有题目的题干相似或重复。
如果用户要求生成的知识点区域已经有题目存在，你必须出全新的、不一样的题目来丰富题库。

【难度要求——非常重要】
- 你出的题必须是有深度的、能区分学生水平的题目
- 避免简单的概念复述（如"什么是XX的定义"），必须考察深度理解和综合应用
- 对于选择题：选项要有迷惑性，考察易混淆的概念
- 对于简答/论述题：需要多步推理、证明或应用，不能是单一知识点背诵
- 适当设置陷阱选项，考查学生对概念边界的掌握程度
- 除非用户明确要求"简单题"，否则默认出 intermediate（进阶）及以上难度的题目

已经收集到的信息：
{collected_info}

对话规则：
1. 信息不足时，礼貌地询问缺少的信息
2. 将用户描述的知识点名称匹配到已有的知识点ID，新知识点用 __new__ 格式
3. 所有信息收集完毕后，生成题目
4. 生成题目时，每个题目必须严格遵循以下格式：
{{
  "type": "题型",
  "content": {{"stem": "题干", "options": [{{"key": "A", "text": "选项文本"}}]}},
  "answer": {{"correct_answer": ["正确答案（如 A,B）"], "explanation": "解析"}},
  "difficulty": "难度",
  "knowledge_point_uuids": ["知识点ID 或 __new__:章节名:知识点名"],
  "tags": ["标签"],
  "priority": 0
}}

回复规则：
- 信息不足时：正常用中文回复，询问缺少的信息
- 信息足够时：第一行输出 [[GENERATE]]，换行后输出JSON数组（包含所有生成的题目）
- 确保生成的题目内容准确、解析详细"""


def _ensure_knowledge_points(neo4j, db: Session, subject_id: UUID, questions: List[Dict]) -> List[Dict]:
    """
    扫描生成的题目，对 __new__:章节名:知识点名 格式的引用自动创建领域和知识点。
    返回替换为真实 UUID 后的题目列表。
    """
    for q in questions:
        kp_uuids = q.get("knowledge_point_uuids", [])
        new_list = []
        for kp_ref in kp_uuids:
            if isinstance(kp_ref, str) and kp_ref.startswith("__new__:"):
                parts = kp_ref.split(":", 3)
                if len(parts) < 3:
                    new_list.append(kp_ref)
                    continue
                domain_name = parts[1].strip()
                point_name = parts[2].strip()

                # 查找或创建领域
                domain = db.query(KnowledgeDomain).filter(
                    KnowledgeDomain.subject_id == subject_id,
                    KnowledgeDomain.name == domain_name,
                ).first()
                if not domain:
                    max_sort = db.query(KnowledgeDomain.sort_order).filter(
                        KnowledgeDomain.subject_id == subject_id
                    ).order_by(KnowledgeDomain.sort_order.desc()).first()
                    domain = KnowledgeDomain(
                        subject_id=subject_id, name=domain_name,
                        sort_order=(max_sort[0] + 1 if max_sort else 999)
                    )
                    db.add(domain)
                    db.commit()
                    db.refresh(domain)
                    try:
                        _sync_domain_to_neo4j(neo4j, domain, subject_id)
                    except Exception:
                        pass

                # 查找或创建知识点
                point = db.query(KnowledgePoint).filter(
                    KnowledgePoint.domain_id == domain.id,
                    KnowledgePoint.name == point_name,
                ).first()
                if not point:
                    max_sort = db.query(KnowledgePoint.sort_order).filter(
                        KnowledgePoint.domain_id == domain.id
                    ).order_by(KnowledgePoint.sort_order.desc()).first()
                    point = KnowledgePoint(
                        domain_id=domain.id, name=point_name,
                        sort_order=(max_sort[0] + 1 if max_sort else 0),
                        difficulty=1,
                    )
                    db.add(point)
                    db.commit()
                    db.refresh(point)
                    try:
                        _sync_point_to_neo4j(neo4j, point, domain.id)
                    except Exception:
                        pass

                new_list.append(str(point.id))
            else:
                new_list.append(kp_ref)
        q["knowledge_point_uuids"] = new_list
    return questions


# ─── AI 对话持久化（Redis，每个题库一个对话，最多10轮） ──────────

AI_GEN_TTL = 86400  # 24 小时自动过期


def _save_ai_context(bank_id: UUID, history: List[Dict], params: dict):
    """保存 AI 出题对话到 Redis"""
    from app.core.security import _get_redis
    key = f"ai_gen_ctx:{bank_id}"
    # 只保留最近 10 轮 (20 条消息)
    trimmed = history[-20:] if len(history) > 20 else history
    data = json.dumps({"history": trimmed, "params": params})
    try:
        _get_redis().setex(key, AI_GEN_TTL, data)
    except Exception:
        pass  # Redis 不可用时静默降级


def _load_ai_context(bank_id: UUID):
    """从 Redis 加载 AI 出题对话"""
    from app.core.security import _get_redis
    key = f"ai_gen_ctx:{bank_id}"
    try:
        data = _get_redis().get(key)
        if data:
            ctx = json.loads(data)
            return ctx.get("history", []), ctx.get("params", {})
    except Exception:
        pass
    return [], {}


def _clear_ai_context(bank_id: UUID):
    """清除 AI 出题对话"""
    from app.core.security import _get_redis
    key = f"ai_gen_ctx:{bank_id}"
    try:
        _get_redis().delete(key)
    except Exception:
        pass


def _fix_latex_json(json_str: str) -> str:
    """修复 LLM 返回的 JSON 中 LaTeX 反斜杠未转义的问题。

    LLM 经常直接在 JSON 字符串中输出 \forall、\exists 等 LaTeX 命令，
    但 Python 的 json.loads 只认 \\"、\\\\、\\/、\\b、\\f、\\n、\\r、\\t、\\uXXXX 这几种转义。
    此函数将非法转义序列 \\X 替换为 \\\\X（如 \\forall → \\\\forall）。
    """
    VALID_ESCAPES = {'"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'}
    result = []
    i = 0
    while i < len(json_str):
        if json_str[i] == '\\' and i + 1 < len(json_str):
            if json_str[i + 1] not in VALID_ESCAPES:
                result.append('\\\\')
            else:
                result.append('\\')
            i += 1
        else:
            result.append(json_str[i])
        i += 1
    return ''.join(result)


def _safe_parse_json(json_str: str) -> Any:
    """安全解析 LLM 返回的 JSON，自动修复 LaTeX 反斜杠问题。"""
    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        fixed = _fix_latex_json(json_str)
        try:
            return json.loads(fixed)
        except json.JSONDecodeError as e:
            raise json.JSONDecodeError(
                f"JSON 解析失败（已尝试修复 LaTeX 转义）: {e.msg}",
                fixed, e.pos
            )


async def _call_llm_for_questions(messages: List[Dict[str, str]], api_key_override: Optional[str] = None, base_url_override: Optional[str] = None, model_override: Optional[str] = None) -> str:
    """调用 LLM 生成出题回复，优先使用传入的 API 配置"""
    api_key = api_key_override or settings.DEEPSEEK_API_KEY
    base_url = base_url_override or settings.DEEPSEEK_BASE_URL
    model = model_override or settings.DEEPSEEK_MODEL

    if not api_key:
        api_key = settings.QWEN_API_KEY
        base_url = settings.QWEN_BASE_URL
        model = settings.QWEN_MODEL

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI 出题功能未配置 API Key，请在设置中配置 DeepSeek 或 Qwen API"
        )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 16384,
    }

    async with httpx.AsyncClient(timeout=300.0) as client:
        response = await client.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json=payload
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"AI 出题调用失败: {response.text}"
            )

        result = response.json()
        return result["choices"][0]["message"]["content"]


async def _call_llm_stream(
    messages: List[Dict[str, str]],
    api_key_override: Optional[str] = None,
    base_url_override: Optional[str] = None,
    model_override: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """调用 LLM 流式输出，yield SSE 事件字符串（不含 "data: " 前缀和 "\n\n" 后缀）"""
    api_key = api_key_override or settings.DEEPSEEK_API_KEY
    base_url = base_url_override or settings.DEEPSEEK_BASE_URL
    model = model_override or settings.DEEPSEEK_MODEL

    if not api_key:
        api_key = settings.QWEN_API_KEY
        base_url = settings.QWEN_BASE_URL
        model = settings.QWEN_MODEL

    if not api_key:
        yield json.dumps({"type": "error", "content": "AI 出题功能未配置 API Key"})
        return

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 16384,
        "stream": True,
    }

    async with httpx.AsyncClient(timeout=300.0) as client:
        async with client.stream("POST", f"{base_url}/chat/completions", headers=headers, json=payload) as resp:
            if resp.status_code != 200:
                error_body = await resp.aread()
                yield json.dumps({"type": "error", "content": f"AI 调用失败: {error_body.decode(errors='ignore')}"})
                return

            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:].strip()
                if data_str == "[DONE]":
                    continue
                try:
                    data = json.loads(data_str)
                    delta = data.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield json.dumps({"type": "chunk", "content": content})
                except json.JSONDecodeError:
                    continue


@router.post("/banks/{bank_id}/ai-generate-stream")
async def ai_generate_questions_stream(
    bank_id: UUID,
    request: AIGenerateRequest,
    db: Session = Depends(get_db),
    neo4j: Neo4jConnection = Depends(get_neo4j),
    current_user=Depends(get_current_active_user),
):
    """流式 AI 出题：SSE 流式输出回复内容，最后发送 complete 事件携带生成的题目"""
    # 1. 验证题库归属
    bank = db.query(QuestionBank).filter(
        QuestionBank.id == bank_id,
        QuestionBank.owner_id == current_user.student_id
    ).first()
    if not bank:
        raise HTTPException(status_code=404, detail="题库不存在")

    # 2. 获取学科与知识结构
    subject = db.query(Subject).filter(Subject.id == bank.subject_id).first()
    knowledge_tree = _build_knowledge_context(db, bank.subject_id)

    # 3. 检查 API 配置
    from app.crud.api_settings import api_settings_crud
    api_key = settings.DEEPSEEK_API_KEY
    base_url = settings.DEEPSEEK_BASE_URL
    model = settings.DEEPSEEK_MODEL
    if not api_key:
        api_key = settings.QWEN_API_KEY
        base_url = settings.QWEN_BASE_URL
        model = settings.QWEN_MODEL
    if not api_key:
        for provider, default_url, provider_model in [
            ("deepseek", settings.DEEPSEEK_BASE_URL, settings.DEEPSEEK_MODEL),
            ("qwen", settings.QWEN_BASE_URL, settings.QWEN_MODEL),
        ]:
            user_cfg = api_settings_crud.get_setting_value(db, str(current_user.student_id), provider)
            if user_cfg:
                api_key = user_cfg["api_key"]
                base_url = user_cfg.get("base_url") or default_url
                model = provider_model
                break
    if not api_key:
        raise HTTPException(status_code=400, detail="AI 出题功能未配置。请先在「设置」中配置 DeepSeek 或 Qwen API Key")

    # 4. 构建提示词
    collected_info_str = json.dumps(request.collected_params, ensure_ascii=False) if request.collected_params else "暂未收集"
    existing_ctx = _get_existing_questions_context(db, bank_id)
    system_prompt = AI_SYSTEM_PROMPT.format(
        bank_name=bank.name,
        subject_name=subject.name if subject else "未知",
        knowledge_tree=knowledge_tree,
        existing_questions_context=existing_ctx,
        collected_info=collected_info_str,
    )
    messages = [{"role": "system", "content": system_prompt}]
    for msg in request.conversation_history[-6:]:
        messages.append(msg)
    messages.append({"role": "user", "content": request.message})

    # 5. 流式读取 + 缓冲完整回复
    async def event_stream():
        full_reply = ""
        try:
            async for event_str in _call_llm_stream(messages, api_key_override=api_key, base_url_override=base_url, model_override=model):
                event_data = json.loads(event_str)
                if event_data.get("type") == "chunk":
                    full_reply += event_data["content"]
                yield f"data: {event_str}\n\n"

            # 6. 解析 [[GENERATE]]
            is_complete = False
            generated_questions = []
            if "[[GENERATE]]" in full_reply:
                is_complete = True
                json_part = full_reply.split("[[GENERATE]]", 1)[1].strip()
                json_part = re.sub(r'^```(?:json)?\s*', '', json_part)
                json_part = re.sub(r'\s*```$', '', json_part)
                json_start = json_part.find("[")
                json_end = json_part.rfind("]")
                if json_start != -1 and json_end != -1:
                    try:
                        generated_questions = _safe_parse_json(json_part[json_start:json_end + 1])
                        if isinstance(generated_questions, list):
                            generated_questions = _ensure_knowledge_points(
                                neo4j, db, bank.subject_id, generated_questions
                            )
                    except (json.JSONDecodeError, Exception):
                        pass

            # 7. 持久化对话
            updated_history = list(request.conversation_history)
            updated_history.append({"role": "user", "content": request.message})
            updated_history.append({"role": "assistant", "content": full_reply})
            _save_ai_context(bank_id, updated_history, request.collected_params)

            # 8. 发送 complete 事件
            yield f"data: {json.dumps({'type': 'complete', 'reply': full_reply, 'generated_questions': generated_questions, 'is_complete': is_complete, 'collected_params': request.collected_params})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/banks/{bank_id}/ai-generate", response_model=AIGenerateResponse)
async def ai_generate_questions(
    bank_id: UUID,
    request: AIGenerateRequest,
    db: Session = Depends(get_db),
    neo4j: Neo4jConnection = Depends(get_neo4j),
    current_user=Depends(get_current_active_user),
):
    """
    AI 交互式出题：接收用户描述，通过对话收集需求，最终生成题目。
    支持多轮对话，信息不足时 AI 会主动询问。
    """
    # 1. 验证题库归属
    bank = db.query(QuestionBank).filter(
        QuestionBank.id == bank_id,
        QuestionBank.owner_id == current_user.student_id
    ).first()
    if not bank:
        raise HTTPException(status_code=404, detail="题库不存在")

    # 2. 获取学科与知识结构
    subject = db.query(Subject).filter(Subject.id == bank.subject_id).first()
    knowledge_tree = _build_knowledge_context(db, bank.subject_id)

    # 3. 检查 API 配置 — 优先使用用户配置，其次系统默认
    from app.crud.api_settings import api_settings_crud

    api_key = settings.DEEPSEEK_API_KEY
    base_url = settings.DEEPSEEK_BASE_URL
    model = settings.DEEPSEEK_MODEL

    if not api_key:
        api_key = settings.QWEN_API_KEY
        base_url = settings.QWEN_BASE_URL
        model = settings.QWEN_MODEL

    if not api_key:
        # 尝试获取用户自己的 API 配置
        user_providers = [
            ("deepseek", settings.DEEPSEEK_BASE_URL, settings.DEEPSEEK_MODEL),
            ("qwen", settings.QWEN_BASE_URL, settings.QWEN_MODEL),
        ]
        for provider, default_url, provider_model in user_providers:
            user_cfg = api_settings_crud.get_setting_value(db, str(current_user.student_id), provider)
            if user_cfg:
                api_key = user_cfg["api_key"]
                base_url = user_cfg.get("base_url") or default_url
                model = provider_model
                break

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="AI 出题功能未配置。请先在「设置」中配置 DeepSeek 或 Qwen API Key"
        )

    # 4. 构建提示词（含去重上下文）
    collected_info_str = json.dumps(request.collected_params, ensure_ascii=False) if request.collected_params else "暂未收集"
    existing_ctx = _get_existing_questions_context(db, bank_id)
    system_prompt = AI_SYSTEM_PROMPT.format(
        bank_name=bank.name,
        subject_name=subject.name if subject else "未知",
        knowledge_tree=knowledge_tree,
        existing_questions_context=existing_ctx,
        collected_info=collected_info_str,
    )

    # 5. 构建消息列表
    messages = [{"role": "system", "content": system_prompt}]
    for msg in request.conversation_history[-6:]:
        messages.append(msg)
    messages.append({"role": "user", "content": request.message})

    # 6. 调用 LLM
    try:
        reply = await _call_llm_for_questions(messages, api_key_override=api_key, base_url_override=base_url, model_override=model)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI 出题出错: {str(e)}"
        )

    # 7. 解析回复
    is_complete = False
    generated_questions = []

    if "[[GENERATE]]" in reply:
        is_complete = True
        # 提取 JSON 部分
        json_part = reply.split("[[GENERATE]]", 1)[1].strip()
        # 去除 markdown 代码块标记
        json_part = re.sub(r'^```(?:json)?\s*', '', json_part)
        json_part = re.sub(r'\s*```$', '', json_part)
        # 找到 JSON 数组
        # 找到 JSON 数组
        json_start = json_part.find("[")
        json_end = json_part.rfind("]")
        if json_start != -1 and json_end != -1:
            json_str = json_part[json_start:json_end + 1]
            try:
                generated_questions = _safe_parse_json(json_str)
                if not isinstance(generated_questions, list):
                    generated_questions = []
                else:
                    # 自动创建新的知识点（__new__:章节名:知识点名）
                    try:
                        generated_questions = _ensure_knowledge_points(
                            neo4j, db, bank.subject_id, generated_questions
                        )
                    except Exception:
                        pass
            except json.JSONDecodeError:
                # JSON 解析失败，返回原始回复
                is_complete = False
                reply = reply.replace("[[GENERATE]]", "").strip()

    # 8. 更新 collected_params（从回复中提取已收集的信息）
    updated_params = dict(request.collected_params)
    if is_complete:
        updated_params["generated_count"] = len(generated_questions)

    # 9. 持久化对话到 Redis（自动保存上下文）
    updated_history = list(request.conversation_history)
    updated_history.append({"role": "user", "content": request.message})
    if reply:
        updated_history.append({"role": "assistant", "content": reply})
    _save_ai_context(bank_id, updated_history, updated_params)

    return AIGenerateResponse(
        reply=reply,
        collected_params=updated_params,
        generated_questions=generated_questions,
        is_complete=is_complete,
    )


class AIContextResponse(BaseModel):
    has_context: bool
    history: List[Dict[str, str]] = Field(default_factory=list)
    collected_params: Dict[str, Any] = Field(default_factory=dict)


@router.get("/banks/{bank_id}/ai-context", response_model=AIContextResponse)
async def get_ai_context(
    bank_id: UUID,
    current_user=Depends(get_current_active_user),
):
    """获取题库的 AI 出题对话上下文"""
    history, params = _load_ai_context(bank_id)
    return AIContextResponse(
        has_context=bool(history),
        history=history,
        collected_params=params,
    )


@router.delete("/banks/{bank_id}/ai-context", status_code=status.HTTP_204_NO_CONTENT)
async def clear_ai_context(
    bank_id: UUID,
    current_user=Depends(get_current_active_user),
):
    """清除题库的 AI 出题对话上下文"""
    _clear_ai_context(bank_id)


# ═══════════════════════════════════════════════════════════════
#  Practice Sessions — 练习会话持久化
# ═══════════════════════════════════════════════════════════════


@router.post("/banks/{bank_id}/practice-sessions", response_model=PracticeSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_practice_session(
    bank_id: UUID,
    data: PracticeSessionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """创建练习会话"""
    bank = db.query(QuestionBank).filter(
        QuestionBank.id == bank_id, QuestionBank.owner_id == current_user.student_id
    ).first()
    if not bank:
        raise HTTPException(status_code=404, detail="题库不存在")

    session = PracticeSession(
        user_id=current_user.student_id,
        bank_id=bank_id,
        mode=data.mode,
        answer_mode=data.answer_mode,
        question_order=data.question_order,
        stats={"total": len(data.question_order), "completed": 0, "correct": 0, "incorrect": 0},
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return PracticeSessionResponse.model_validate(session)


@router.put("/practice-sessions/{session_id}", response_model=PracticeSessionResponse)
async def update_practice_session(
    session_id: UUID,
    data: PracticeSessionUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """更新练习会话（结束、更新进度等）"""
    session = db.query(PracticeSession).filter(
        PracticeSession.id == session_id,
        PracticeSession.user_id == current_user.student_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="练习会话不存在")

    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(session, k, v)
    db.commit()
    db.refresh(session)
    return PracticeSessionResponse.model_validate(session)


@router.get("/practice-sessions", response_model=PracticeSessionListResponse)
async def list_practice_sessions(
    bank_id: Optional[UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """获取练习会话历史"""
    query = db.query(PracticeSession).filter(
        PracticeSession.user_id == current_user.student_id
    )
    if bank_id:
        query = query.filter(PracticeSession.bank_id == bank_id)

    total = query.count()
    sessions = query.order_by(PracticeSession.started_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    return PracticeSessionListResponse(
        sessions=[PracticeSessionResponse.model_validate(s) for s in sessions],
        total=total,
    )


@router.get("/practice-sessions/{session_id}", response_model=PracticeSessionResponse)
async def get_practice_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """获取单个练习会话详情"""
    session = db.query(PracticeSession).filter(
        PracticeSession.id == session_id,
        PracticeSession.user_id == current_user.student_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="练习会话不存在")
    return PracticeSessionResponse.model_validate(session)
