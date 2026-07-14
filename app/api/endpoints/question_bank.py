from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from uuid import UUID
from typing import List, Optional, Dict, Any, AsyncGenerator
from collections import defaultdict
import json
import os
import re
import httpx
import logging
from datetime import datetime

from app.db.database import get_db
from app.db.neo4j import get_neo4j, Neo4jConnection
from app.db.mongodb import get_mongodb, MongoDBConnection
from app.models.question_bank import (
    Subject, KnowledgeDomain, KnowledgePoint, QuestionBank, Question, StudentAnswer, PracticeSession,
    WrongAnswerRecord, DailyPracticeRecord, KnowledgePointRecord,
)
from app.models.path_state import LearningPathState
from app.models.resource import KnowledgeResource
from app.services.path_state_manager import PathStateManager
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
    SelfGradeRequest, SelfGradeItem, BatchSelfGradeRequest,
    DomainQuestionCount,
    PracticeSessionCreate, PracticeSessionUpdate, PracticeSessionResponse, PracticeSessionListResponse,
    WrongAnswerItem, WrongAnswerListResponse,
    SessionAnswerItem, SessionAnswerListResponse,
    DailyStatsItem, DailyStatsResponse,
)
from app.api.dependencies import get_current_active_user
from app.core.config import settings
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/question-bank", tags=["Question Bank"])


# ─── 单题重生成请求 ─────────────────────────────────────

class QuestionRegenerateRequest(BaseModel):
    feedback: str = Field(..., min_length=1, description="用户对题目的反馈，指出需要改进的地方")


REGENERATE_PROMPT_TEMPLATE = """你是一个专业的AI出题助手，根据用户反馈重新生成一道题目。

数学公式必须用 LaTeX：行内用 $...$，独立用 $$...$$，禁止纯文本数学符号。

原题：
@@QUESTION_JSON@@

反馈：@@FEEDBACK@@

要求：
1. 与原题知识点一致，但题干和答案完全不同
2. 题目有深度，解析详细
3. 数学公式必须用 LaTeX

回复格式：第一行 [[GENERATE]]，换行输出单个题目的JSON"""


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


# System-owned public banks are visible to every user.
SYSTEM_OWNER_ID = UUID("00000000-0000-0000-0000-000000000000")
SEED_BANK_ID = UUID("2ce6ee7d-ed5a-42a1-8a26-6ad6856afd3e")


def _system_public_bank_clause():
    return and_(
        QuestionBank.owner_id == SYSTEM_OWNER_ID,
        QuestionBank.visibility == "public",
    )


def _get_readable_bank(db: Session, bank_id: UUID, user_id: UUID) -> Optional[QuestionBank]:
    """获取用户可读的题库（自己的 或 种子题库）"""
    return db.query(QuestionBank).filter(
        QuestionBank.id == bank_id,
        or_(QuestionBank.owner_id == user_id, _system_public_bank_clause())
    ).first()


def _get_writable_bank(db: Session, bank_id: UUID, user_id: UUID) -> Optional[QuestionBank]:
    """获取用户可写的题库（仅自己的）"""
    return db.query(QuestionBank).filter(
        QuestionBank.id == bank_id,
        QuestionBank.owner_id == user_id
    ).first()


def _safe_uuid(val: Any) -> Optional[UUID]:
    """安全地将字符串或 UUID 对象转换为 UUID，兼容 urn:uuid: 前缀"""
    if val is None:
        return None
    if isinstance(val, UUID):
        return val
    if isinstance(val, str):
        return UUID(val.replace('urn:uuid:', '').replace('urn:', ''))
    return UUID(val)


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
    # 仅检查当前用户可见的学科中是否有同名（种子学科 + 自己创建的）
    existing = db.query(Subject).filter(
        Subject.name == data.name,
        or_(Subject.id == UUID("d91a4645-ab5f-4819-8379-d9e6524f0937"), Subject.creator_id == current_user.student_id)
    ).first()
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
    # 禁止删除种子学科（数据结构）
    if subject.id == UUID("d91a4645-ab5f-4819-8379-d9e6524f0937"):
        raise HTTPException(status_code=403, detail="种子学科不可删除")
    # 仅创建者可以删除自己的学科
    if subject.creator_id and subject.creator_id != current_user.student_id:
        raise HTTPException(status_code=403, detail="无权删除该学科")
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
    query = db.query(QuestionBank).filter(
        or_(QuestionBank.owner_id == current_user.student_id, _system_public_bank_clause())
    )
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
    bank = _get_readable_bank(db, bank_id, current_user.student_id)
    if not bank: raise HTTPException(status_code=404, detail="题库不存在")
    return QuestionBankResponse.model_validate(bank)


@router.get("/knowledge-points/{kp_uuid}/practice-bank")
async def get_knowledge_point_practice_bank(
    kp_uuid: str, db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """获取某个知识点对应的题库（用于直接练习）"""
    question = db.query(Question).filter(
        Question.knowledge_point_uuids.contains([kp_uuid])
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="该知识点暂无题目")
    bank = _get_readable_bank(db, question.bank_id, current_user.student_id)
    if not bank:
        raise HTTPException(status_code=404, detail="题库不存在")
    return {"bank_id": str(bank.id), "bank_name": bank.name}


@router.put("/banks/{bank_id}", response_model=QuestionBankResponse)
async def update_bank(
    bank_id: UUID, data: QuestionBankUpdate, db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    bank = _get_writable_bank(db, bank_id, current_user.student_id)
    if not bank: raise HTTPException(status_code=404, detail="题库不存在或无权修改")
    for k, v in data.model_dump(exclude_unset=True).items(): setattr(bank, k, v)
    db.commit(); db.refresh(bank)
    return QuestionBankResponse.model_validate(bank)


@router.delete("/banks/{bank_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bank(bank_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    bank = _get_writable_bank(db, bank_id, current_user.student_id)
    if not bank: raise HTTPException(status_code=404, detail="题库不存在或无权删除")
    db.delete(bank); db.commit()


# ═══════════════════════════════════════════════════════════════
#  Questions — 核心：知识点关联 + Neo4j 同步
# ═══════════════════════════════════════════════════════════════

@router.get("/banks/{bank_id}/questions", response_model=QuestionListResponse)
async def list_questions(
    bank_id: UUID, question_type: Optional[str] = Query(None, alias="type"),
    difficulty: Optional[str] = Query(None), status_filter: Optional[str] = Query(None, alias="status"),
    kp_uuid: Optional[str] = Query(None, alias="knowledge_point_uuid"),
    search: Optional[str] = Query(None), page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db), current_user=Depends(get_current_active_user)
):
    bank = _get_readable_bank(db, bank_id, current_user.student_id)
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
    bank = _get_writable_bank(db, bank_id, current_user.student_id)
    if not bank: raise HTTPException(status_code=404, detail="题库不存在或无权出题")

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


# ═══════════════════════════════════════════════════════════════
#  Error-Prone Tags (F5) — 动态易错标签（必须放在 {question_id} 路由之前）
# ═══════════════════════════════════════════════════════════════


class ErrorProneTagResponse(BaseModel):
    question_id: str
    tags: List[str]


class ErrorProneListResponse(BaseModel):
    questions: List[QuestionResponse]
    total: int


@router.get("/questions/error-prone", response_model=ErrorProneListResponse)
async def list_error_prone_questions(
    bank_id: Optional[UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    neo4j: Neo4jConnection = Depends(get_neo4j),
    current_user=Depends(get_current_active_user),
):
    """获取当前用户的易错题列表（被自动标记为"易错"的题目）"""
    student_id = str(current_user.student_id)
    error_prone_ids = neo4j.get_error_prone_question_ids(student_id)

    if not error_prone_ids:
        return ErrorProneListResponse(questions=[], total=0)

    uuids = []
    for eid in error_prone_ids:
        try:
            uuids.append(UUID(eid))
        except Exception:
            pass

    if not uuids:
        return ErrorProneListResponse(questions=[], total=0)

    query = db.query(Question).filter(Question.id.in_(uuids))
    if bank_id:
        query = query.filter(Question.bank_id == bank_id)

    total = query.count()
    questions = query.order_by(Question.updated_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    return ErrorProneListResponse(
        questions=[QuestionResponse.model_validate(q) for q in questions],
        total=total,
    )


@router.post("/questions/{question_id}/tag-error-prone", response_model=ErrorProneTagResponse)
async def tag_question_error_prone_endpoint(
    question_id: UUID,
    db: Session = Depends(get_db),
    neo4j: Neo4jConnection = Depends(get_neo4j),
    current_user=Depends(get_current_active_user),
):
    """手动标记题目为易错题"""
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在")
    bank = _get_writable_bank(db, question.bank_id, current_user.student_id)
    if not bank:
        raise HTTPException(status_code=403, detail="无权操作该题目")

    current_tags = list(question.tags or [])
    if "易错" not in current_tags:
        current_tags.append("易错")
        question.tags = current_tags
        db.commit()
        db.refresh(question)

    try:
        neo4j.tag_question_error_prone(str(question_id))
    except Exception:
        pass

    return ErrorProneTagResponse(question_id=str(question_id), tags=question.tags)


@router.delete("/questions/{question_id}/untag-error-prone", response_model=ErrorProneTagResponse)
async def untag_question_error_prone_endpoint(
    question_id: UUID,
    db: Session = Depends(get_db),
    neo4j: Neo4jConnection = Depends(get_neo4j),
    current_user=Depends(get_current_active_user),
):
    """移除题目的易错标签"""
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在")
    bank = _get_writable_bank(db, question.bank_id, current_user.student_id)
    if not bank:
        raise HTTPException(status_code=403, detail="无权操作该题目")

    current_tags = list(question.tags or [])
    if "易错" in current_tags:
        current_tags.remove("易错")
        question.tags = current_tags
        db.commit()
        db.refresh(question)

    try:
        neo4j.untag_question_error_prone(str(question_id))
    except Exception:
        pass

    return ErrorProneTagResponse(question_id=str(question_id), tags=question.tags)


# ═══════════════════════════════════════════════════════════════
#  Wrong Answer Book — 错题本
# ═══════════════════════════════════════════════════════════════


@router.get("/wrong-answers", response_model=WrongAnswerListResponse)
async def list_wrong_answers(
    bank_id: Optional[UUID] = Query(None),
    subject_id: Optional[UUID] = Query(None),
    domain_id: Optional[UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """列出错题本，支持按题库/学科/章节过滤"""
    query = db.query(WrongAnswerRecord).filter(
        WrongAnswerRecord.user_id == current_user.student_id
    )

    if bank_id:
        query = query.filter(WrongAnswerRecord.bank_id == bank_id)

    records = query.order_by(WrongAnswerRecord.last_wrong_at.desc()).all()

    # 按学科/章节过滤
    if subject_id or domain_id:
        filtered = []
        for wr in records:
            q = db.query(Question).filter(Question.id == wr.question_id).first()
            if not q:
                continue
            if subject_id:
                bank = db.query(QuestionBank).filter(QuestionBank.id == wr.bank_id).first()
                if not bank or str(bank.subject_id) != str(subject_id):
                    continue
            if domain_id:
                kp_ids = db.query(KnowledgePoint.id).filter(
                    KnowledgePoint.domain_id == domain_id
                ).all()
                kp_uuid_set = {str(kp[0]) for kp in kp_ids}
                q_kp_set = set(q.knowledge_point_uuids or [])
                if not (q_kp_set & kp_uuid_set):
                    continue
            filtered.append(wr)
        records = filtered

    total = len(records)
    records = records[(page - 1) * page_size : page * page_size]

    items = []
    for wr in records:
        q = db.query(Question).filter(Question.id == wr.question_id).first()
        if q:
            items.append(WrongAnswerItem(
                id=wr.id,
                question_id=str(wr.question_id),
                bank_id=str(wr.bank_id),
                wrong_count=wr.wrong_count,
                first_wrong_at=wr.first_wrong_at,
                last_wrong_at=wr.last_wrong_at,
                question=QuestionResponse.model_validate(q),
            ))

    return WrongAnswerListResponse(items=items, total=total)


@router.delete("/wrong-answers/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_wrong_answer(
    record_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """从错题本移除（不删除答题历史）"""
    record = db.query(WrongAnswerRecord).filter(
        WrongAnswerRecord.id == record_id,
        WrongAnswerRecord.user_id == current_user.student_id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    db.delete(record)
    db.commit()


# ═══════════════════════════════════════════════════════════════
#  Wrong Answer Diagnosis — LLM 智能错因分析
# ═══════════════════════════════════════════════════════════════

DIAGNOSE_PROMPT = """你是一位资深的AI辅导老师，正在帮助学生分析一道做错的题目。

请根据以下信息，给出深度诊断分析：

【题目信息】
- 题型：{qtype}
- 题干：{stem}
{options_text}
【正确答案】{correct_answer}

【解析】{explanation}

【学生作答】
- 学生答案：{student_answer}

【学生在该知识点的学习情况】
- 知识点掌握度：{mastery}%
- 练习次数：{practiced} 次
- 连续错误数：{consecutive_errors}
- 近期正确率：{accuracy}%

请从以下维度分析：
1. **错误类型**（选择最匹配的一个）：概念混淆 / 计算失误 / 审题不清 / 知识盲区 / 逻辑错误 / 粗心大意
2. **根因分析**（1-2句话）：为什么学生可能犯这个错误
3. **补救建议**（2-3条具体可操作的建议）

请直接输出 JSON（不要其他文字）：
{{
  "error_type": "错误类型",
  "error_type_label": "中文标签",
  "root_cause": "根因分析",
  "suggestions": ["建议1", "建议2", "建议3"],
  "recommended_action": "推荐下一步操作（如：先复习XX概念，再做3道基础题）"
}}
"""


class DiagnoseResponse(BaseModel):
    error_type: str
    error_type_label: str
    root_cause: str
    suggestions: List[str]
    recommended_action: str


@router.post("/wrong-answers/{record_id}/diagnose", response_model=DiagnoseResponse)
async def diagnose_wrong_answer(
    record_id: UUID,
    db: Session = Depends(get_db),
    neo4j: Neo4jConnection = Depends(get_neo4j),
    current_user=Depends(get_current_active_user),
):
    """AI 智能诊断错题原因，给出针对性补救建议"""
    # 1. 获取错题记录
    record = db.query(WrongAnswerRecord).filter(
        WrongAnswerRecord.id == record_id,
        WrongAnswerRecord.user_id == current_user.student_id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="错题记录不存在")

    # 2. 获取题目信息
    question = db.query(Question).filter(Question.id == record.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在")

    # 3. 获取学生的实际答案（最近一次错误答案）
    student_answer = db.query(StudentAnswer).filter(
        StudentAnswer.user_id == current_user.student_id,
        StudentAnswer.question_id == record.question_id,
        StudentAnswer.is_correct == False,
    ).order_by(StudentAnswer.created_at.desc()).first()

    student_ans_text = "未记录"
    if student_answer and student_answer.answer_content:
        ac = student_answer.answer_content
        if isinstance(ac, dict):
            student_ans_text = ac.get("selected", str(ac))
        elif isinstance(ac, list):
            student_ans_text = ", ".join(str(x) for x in ac)
        else:
            student_ans_text = str(ac)

    # 4. 获取该知识点的掌握情况
    mastery = 0
    practiced = 0
    consecutive_errors = 0
    accuracy = 0
    kp_records = []
    if question.knowledge_point_uuids:
        kp_records = db.query(KnowledgePointRecord).filter(
            KnowledgePointRecord.user_id == current_user.student_id,
            KnowledgePointRecord.point_id.in_(
                [UUID(uid) for uid in question.knowledge_point_uuids if uid]
            ),
        ).all()
    if kp_records:
        r = kp_records[0]
        mastery = r.mastery_score or 0
        practiced = r.total_practiced or 0
        consecutive_errors = r.consecutive_errors or 0
        accuracy = r.recent_accuracy or 0

    # 5. 构建选项文本
    options_text = ""
    content = question.content or {}
    if isinstance(content, dict):
        opts = content.get("options", [])
        if opts:
            options_text = "【选项】\n" + "\n".join(
                f"{o.get('key', '')}. {o.get('text', '')}" for o in opts
            )

    # 6. 获取正确答案和解稀文本
    answer_data = question.answer or {}
    correct_answer = ""
    explanation = ""
    if isinstance(answer_data, dict):
        ca = answer_data.get("correct_answer", "")
        correct_answer = ", ".join(ca) if isinstance(ca, list) else str(ca)
        explanation = answer_data.get("explanation", "")

    # 7. 构建 prompt
    qtype_labels = {
        "single_choice": "单选题", "multiple_choice": "多选题",
        "fill_blank": "填空题", "true_false": "判断题",
        "short_answer": "简答题", "programming": "编程题", "essay": "论述题",
    }
    prompt = DIAGNOSE_PROMPT.format(
        qtype=qtype_labels.get(question.type, question.type),
        stem=content.get("stem", "")[:600] if isinstance(content, dict) else str(content)[:600],
        options_text=options_text,
        correct_answer=correct_answer,
        explanation=explanation[:400],
        student_answer=student_ans_text,
        mastery=mastery,
        practiced=practiced,
        consecutive_errors=consecutive_errors,
        accuracy=accuracy,
    )

    # 8. 调用 LLM
    from app.crud.api_settings import api_settings_crud
    api_key = settings.DEEPSEEK_API_KEY
    base_url = settings.DEEPSEEK_BASE_URL
    model = "deepseek-v4-flash"

    if not api_key:
        api_key = settings.QWEN_API_KEY
        base_url = settings.QWEN_BASE_URL
        model = settings.QWEN_MODEL
        if model == settings.QWEN_MODEL:
            model = "qwen-turbo"

    if not api_key:
        for provider, default_url, provider_model in [
            ("deepseek", settings.DEEPSEEK_BASE_URL, settings.DEEPSEEK_MODEL),
            ("qwen", settings.QWEN_BASE_URL, settings.QWEN_MODEL),
        ]:
            user_cfg = api_settings_crud.get_setting_value(
                db, str(current_user.student_id), provider
            )
            if user_cfg:
                api_key = user_cfg["api_key"]
                base_url = user_cfg.get("base_url") or default_url
                model = provider_model
                if provider == "deepseek":
                    model = "deepseek-v4-flash"
                break

    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="AI 诊断需要配置 API Key。请在「设置」中配置 DeepSeek 或 Qwen API"
        )

    try:
        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": "请分析这道错题"},
        ]
        reply = await _call_llm_for_questions(
            messages,
            api_key_override=api_key,
            base_url_override=base_url,
            model_override=model,
            max_tokens_override=1024,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 诊断出错: {str(e)}")

    # 9. 解析 LLM 响应
    try:
        json_str = reply.strip()
        json_str = re.sub(r'^```(?:json)?\s*', '', json_str)
        json_str = re.sub(r'\s*```$', '', json_str)
        result = _safe_parse_json(json_str)
        return DiagnoseResponse(
            error_type=result.get("error_type", "unknown"),
            error_type_label=result.get("error_type_label", "未知"),
            root_cause=result.get("root_cause", "无法分析"),
            suggestions=result.get("suggestions", ["重新审题", "查看解析", "做同类练习"]),
            recommended_action=result.get("recommended_action", "建议重新练习该知识点"),
        )
    except Exception:
        # LLM 返回了非 JSON，尝试从中提取
        return DiagnoseResponse(
            error_type="unknown",
            error_type_label="待分析",
            root_cause=reply[:300] if reply else "AI 返回异常",
            suggestions=["建议查看题目解析", "重新练习该题", "向老师求助"],
            recommended_action="重新练习该知识点",
        )


@router.post("/wrong-answers/generate-practice", response_model=List[PracticeQuestionResponse])
async def generate_practice_from_wrong_answers(
    bank_id: Optional[UUID] = Query(None),
    question_count: Optional[int] = Query(None, ge=1, le=200),
    domain_ids: Optional[List[str]] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """从错题本生成练习题目（bank_id 可选，不传则包含所有题库的错题）"""
    query = db.query(WrongAnswerRecord).filter(
        WrongAnswerRecord.user_id == current_user.student_id,
    )
    if bank_id:
        query = query.filter(WrongAnswerRecord.bank_id == bank_id)
    records = query.order_by(WrongAnswerRecord.last_wrong_at.desc()).all()
    question_ids = [_safe_uuid(r.question_id) for r in records if r.question_id]

    if not question_ids:
        return []

    questions_query = db.query(Question).filter(
        Question.id.in_(question_ids),
        Question.status == "published",
    )

    if domain_ids:
        kp_ids = db.query(KnowledgePoint.id).filter(
            KnowledgePoint.domain_id.in_([UUID(d) for d in domain_ids])
        ).all()
        kp_uuid_set = {str(kp[0]) for kp in kp_ids}
        all_qs = questions_query.all()
        questions = [q for q in all_qs if kp_uuid_set & set(q.knowledge_point_uuids or [])]
    else:
        questions = questions_query.all()

    import random
    random.shuffle(questions)

    if question_count and question_count < len(questions):
        questions = questions[:question_count]

    return [PracticeQuestionResponse(
        id=q.id, type=q.type, content=q.content,
        answer=q.answer, difficulty=q.difficulty,
        knowledge_point_uuids=q.knowledge_point_uuids or [],
        tags=q.tags or [],
    ) for q in questions]


# ═══════════════════════════════════════════════════════════════
#  Test History — 测试历史详情
# ═══════════════════════════════════════════════════════════════


@router.get("/practice-sessions/{session_id}/answers", response_model=SessionAnswerListResponse)
async def get_session_answers(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """获取某次练习会话中每道题的答题详情"""
    session = db.query(PracticeSession).filter(
        PracticeSession.id == session_id,
        PracticeSession.user_id == current_user.student_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="练习会话不存在")

    answers = db.query(StudentAnswer).filter(
        StudentAnswer.session_id == session_id,
        StudentAnswer.user_id == current_user.student_id,
    ).order_by(StudentAnswer.created_at).all()

    items = []
    for ans in answers:
        q = db.query(Question).filter(Question.id == ans.question_id).first()
        items.append(SessionAnswerItem(
            answer_id=str(ans.id),
            question_id=str(ans.question_id),
            question=QuestionResponse.model_validate(q) if q else None,
            answer_content=ans.answer_content,
            is_correct=ans.is_correct,
            self_grade=ans.self_grade,
            time_spent_seconds=ans.time_spent_seconds,
            answered_at=ans.created_at,
        ))

    return SessionAnswerListResponse(
        session_id=str(session_id),
        items=items,
        total=len(items),
    )


# ═══════════════════════════════════════════════════════════════
#  Daily Stats — 每日练习统计
# ═══════════════════════════════════════════════════════════════


@router.get("/daily-stats", response_model=DailyStatsResponse)
async def get_daily_stats(
    bank_id: Optional[UUID] = Query(None),
    mode: Optional[str] = Query(None),
    days: int = Query(7, ge=1, le=365),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """获取每日练习统计（折线图数据），支持日期范围"""
    from datetime import timedelta

    query = db.query(DailyPracticeRecord).filter(
        DailyPracticeRecord.user_id == current_user.student_id
    )

    if bank_id:
        query = query.filter(DailyPracticeRecord.bank_id == bank_id)
    if mode:
        query = query.filter(DailyPracticeRecord.mode == mode)

    now = datetime.utcnow()
    end = now
    if end_date:
        try:
            end = datetime.fromisoformat(end_date) + timedelta(days=1)
        except Exception:
            pass

    start = end - timedelta(days=days)
    if start_date:
        try:
            start = datetime.fromisoformat(start_date)
        except Exception:
            pass

    query = query.filter(
        DailyPracticeRecord.record_date >= start,
        DailyPracticeRecord.record_date <= end,
    )

    records = query.order_by(DailyPracticeRecord.record_date).all()

    items = [DailyStatsItem(
        date=r.record_date.strftime("%Y-%m-%d"),
        total_questions=r.total_questions,
        correct_count=max(0, r.correct_count),
        incorrect_count=max(0, r.incorrect_count),
        total_time_spent_seconds=max(0, r.total_time_spent_seconds),
        session_count=max(0, r.session_count),
        accuracy=round(max(0, r.correct_count) / max(max(0, r.correct_count) + max(0, r.incorrect_count), 1) * 100, 1),
    ) for r in records]

    return DailyStatsResponse(items=items, total=len(items))


@router.get("/questions/{question_id}", response_model=QuestionResponse)
async def get_question(question_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question: raise HTTPException(status_code=404, detail="题目不存在")
    bank = _get_readable_bank(db, question.bank_id, current_user.student_id)
    if not bank: raise HTTPException(status_code=403, detail="无权访问该题目")
    return QuestionResponse.model_validate(question)


@router.put("/questions/{question_id}", response_model=QuestionResponse)
async def update_question(
    question_id: UUID, data: QuestionUpdate, db: Session = Depends(get_db),
    neo4j: Neo4jConnection = Depends(get_neo4j), current_user=Depends(get_current_active_user)
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question: raise HTTPException(status_code=404, detail="题目不存在")
    bank = _get_writable_bank(db, question.bank_id, current_user.student_id)
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
    bank = _get_writable_bank(db, question.bank_id, current_user.student_id)
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

    # 重生成使用 Flash 模型加速输出
    model = "deepseek-v4-flash"

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
        reply = await _call_llm_for_questions(messages, api_key_override=api_key, base_url_override=base_url, model_override=model, max_tokens_override=8192)
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
    bank = _get_writable_bank(db, question.bank_id, current_user.student_id)
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
    neo4j: Neo4jConnection = Depends(get_neo4j),
    current_user=Depends(get_current_active_user),
):
    """获取自测题目列表（不含答案），支持多种过滤条件"""
    # 1. 验证题库归属（可见即可练）
    bank = _get_readable_bank(db, bank_id, current_user.student_id)
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

    # 4.5 知识点UUID过滤
    if config.knowledge_point_uuids:
        from sqlalchemy import or_
        conditions = [Question.knowledge_point_uuids.contains([uid]) for uid in config.knowledge_point_uuids]
        query = query.filter(or_(*conditions))

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

    # 6.5 仅易错题（被自动标记为"易错"的题目）
    if config.only_error_prone:
        error_prone_ids = neo4j.get_error_prone_question_ids(str(current_user.student_id))
        if error_prone_ids:
            uuids = []
            for eid in error_prone_ids:
                try:
                    uuids.append(UUID(eid))
                except Exception:
                    pass
            if uuids:
                query = query.filter(Question.id.in_(uuids))
        else:
            return []

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
    bank = _get_readable_bank(db, bank_id, current_user.student_id)
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
    if config.knowledge_point_uuids:
        from sqlalchemy import or_
        conditions = [Question.knowledge_point_uuids.contains([uid]) for uid in config.knowledge_point_uuids]
        questions_query = questions_query.filter(or_(*conditions))
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


# ═══════════════════════════════════════════════════════════════
#  随学随新：答题后自动更新画像
# ═══════════════════════════════════════════════════════════════

def _update_profile_after_answer(
    student_id: str,
    question: Question,
    is_correct: bool,
    time_spent_seconds: Optional[int],
    db: Session,
    neo4j: Neo4jConnection,
    mongodb: MongoDBConnection,
):
    """答题后自动更新学习画像（知识掌握度、易错点、行为事件、活跃时段）"""
    try:
        # 1. 确保学生节点存在
        neo4j.create_student_node(student_id)

        # 2. 查询知识点（名称 + UUID）
        kp_list: List[tuple[str, str]] = []  # (name, uuid_str)
        kp_uuids = list(question.knowledge_point_uuids or [])
        if kp_uuids:
            uuids = []
            for uid in kp_uuids:
                try:
                    uuids.append(UUID(uid))
                except Exception:
                    pass
            if uuids:
                pts = db.query(KnowledgePoint).filter(KnowledgePoint.id.in_(uuids)).all()
                kp_list = [(p.name, str(p.id)) for p in pts]

        # 4. 答错时累加易错点 + Neo4j ANSWERED_WRONG + 动态易错标签
        if not is_correct:
            # 创建 Neo4j ANSWERED_WRONG 关系（用于错误推荐查询）
            try:
                with neo4j.connect().session() as session:
                    session.run(
                        """
                        MATCH (s:Student {student_id: $sid})
                        MERGE (q:Question {uuid: $qid})
                        MERGE (s)-[:ANSWERED_WRONG]->(q)
                        """,
                        sid=student_id, qid=str(question.id),
                    )
            except Exception:
                pass

            for name, uuid_str in kp_list:
                try:
                    neo4j.add_error_prone_topic(student_id, name, 1)
                except Exception:
                    pass

            # 检查该题是否达到易错阈值（答错 >= 2 次 → 自动打上"易错"标签）
            try:
                wrong_count = db.query(StudentAnswer).filter(
                    StudentAnswer.user_id == student_id,
                    StudentAnswer.question_id == question.id,
                    StudentAnswer.is_correct == False,
                ).count()
                # 达到阈值且尚未标记，自动打标签
                if wrong_count >= 2:
                    current_tags = list(question.tags or [])
                    if "易错" not in current_tags:
                        current_tags.append("易错")
                        question.tags = current_tags
                        db.commit()
                        # 同步到 Neo4j
                        try:
                            neo4j.tag_question_error_prone(str(question.id))
                        except Exception:
                            pass
            except Exception:
                pass

            # 7. 维护错题本记录（WrongAnswerRecord）
            try:
                existing = db.query(WrongAnswerRecord).filter(
                    WrongAnswerRecord.user_id == student_id,
                    WrongAnswerRecord.question_id == question.id,
                ).first()
                if existing:
                    existing.wrong_count = (existing.wrong_count or 0) + 1
                    existing.last_wrong_at = datetime.utcnow()
                else:
                    record = WrongAnswerRecord(
                        user_id=UUID(student_id) if isinstance(student_id, str) else student_id,
                        question_id=question.id,
                        bank_id=question.bank_id,
                        wrong_count=1,
                        first_wrong_at=datetime.utcnow(),
                        last_wrong_at=datetime.utcnow(),
                    )
                    db.add(record)
                db.commit()
            except Exception:
                pass

        # 8. 更新知识点学习记录（KnowledgePointRecord）
        try:
            for name, uuid_str in kp_list:
                point_id = UUID(uuid_str)
                kpr = db.query(KnowledgePointRecord).filter(
                    KnowledgePointRecord.user_id == student_id,
                    KnowledgePointRecord.point_id == point_id,
                ).first()

                if not kpr:
                    kpr = KnowledgePointRecord(
                        user_id=UUID(student_id) if isinstance(student_id, str) else student_id,
                        point_id=point_id,
                        point_name=name,
                        mastery_score=0,
                        total_practiced=0,
                        total_correct=0,
                        consecutive_errors=0,
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

                # 计算最近5题正确率
                recent_answers = (
                    db.query(StudentAnswer)
                    .filter(
                        StudentAnswer.user_id == student_id,
                        StudentAnswer.question_id == Question.id,
                    )
                    .join(Question, StudentAnswer.question_id == Question.id)
                    .filter(Question.knowledge_point_uuids.contains([uuid_str]))
                    .order_by(StudentAnswer.created_at.desc())
                    .limit(5)
                    .all()
                )
                if recent_answers:
                    recent_correct = sum(1 for a in recent_answers if a.is_correct)
                    kpr.recent_accuracy = int((recent_correct / len(recent_answers)) * 100)
                else:
                    # 无历史记录时首次答题,用保守值避免虚高
                    kpr.recent_accuracy = 60 if is_correct else 0

                # 计算综合掌握度
                from app.services.mastery_calculator import calculate_mastery
                kpr.mastery_score = calculate_mastery(
                    kpr.total_practiced, kpr.total_correct,
                    kpr.recent_accuracy, kpr.study_count or 0,
                    kpr.consecutive_errors, kpr.last_practice_at,
                )

                # 同步到 Neo4j：用 PostgreSQL 综合计算结果覆盖独立 delta（0-100 → 0.0-1.0）
                # 置信度基于练习量: 练满 20 题 confidence=1.0
                try:
                    sync_conf = min(1.0, (kpr.total_practiced or 0) / 20.0)
                    neo4j.add_knowledge_mastery(
                        student_id, name,
                        kpr.mastery_score / 100.0,
                        sync_conf,
                        knowledge_point_uuid=uuid_str,
                    )
                except Exception:
                    pass

                # 状态流转
                if kpr.mastery_score >= 80 and kpr.total_practiced >= 3:
                    kpr.status = "mastered"
                    # 设置艾宾浩斯首次复习时间（1天后）
                    from app.services.mastery_calculator import calculate_review_interval
                    interval = calculate_review_interval(kpr.study_count or 0)
                    from datetime import timedelta
                    kpr.next_review_at = datetime.utcnow() + timedelta(days=interval)
                elif kpr.consecutive_errors >= 3:
                    kpr.status = "reviewing"

            db.commit()
        except Exception as e:
            logger.warning(f"更新知识点学习记录失败: {e}")
            pass

        # 5. 记录行为事件 + 时间线到 MongoDB
        try:
            event_data = {
                "question_id": str(question.id),
                "question_type": question.type,
                "difficulty": question.difficulty,
                "is_correct": is_correct,
                "time_spent_seconds": time_spent_seconds,
                "knowledge_points": [name for name, _ in kp_list],
                "bank_id": str(question.bank_id),
            }
            mongodb.record_behavior_event(student_id, "answer_submit", event_data)
            mongodb.add_timeline_event(student_id, "answer_submit", event_data)
        except Exception:
            pass

        # 6. 更新活跃时段（指数移动平均）
        try:
            hour = datetime.utcnow().hour
            period = "morning" if 6 <= hour < 12 else "afternoon" if 12 <= hour < 18 else "evening" if 18 <= hour < 22 else "night"

            profile = mongodb.get_student_profile(student_id)
            if profile:
                dims = profile.get("dimensions", {})
                ah = dict(dims.get("active_hours", {"morning": 0.25, "afternoon": 0.25, "evening": 0.25, "night": 0.25}))
                ah[period] = ah.get(period, 0) * 0.9 + 1.0 * 0.1
                total = sum(ah.values())
                if total > 0:
                    for k in ah:
                        ah[k] /= total
                mongodb.update_student_profile(student_id, active_hours=ah)
            else:
                ah = {"morning": 0.0, "afternoon": 0.0, "evening": 0.0, "night": 0.0}
                ah[period] = 1.0
                try:
                    mongodb.create_student_profile(student_id, active_hours=ah)
                except Exception:
                    pass
        except Exception:
            pass

        # 7. 更新动态画像三个维度(元认知校准/注意力特征/学习节奏)
        try:
            from app.services.profile_dimensions import update_all_dimensions

            profile = mongodb.get_student_profile(student_id)
            current_dims = profile.get("dimensions", {}) if profile else {}

            # 自评分数: 以答题正确为基础,按题目难度调整
            difficulty_map = {"beginner": 0.8, "basic": 0.7, "intermediate": 0.5, "advanced": 0.3, "competition": 0.2}
            self_assessed = difficulty_map.get(question.difficulty, 0.5)

            event_data = {
                "self_assessed_score": self_assessed,
                "actual_score": 1.0 if is_correct else 0.0,
                "dwell_time": time_spent_seconds or 30,
                "interaction_count": 1,
                "navigation_jumps": 0,
                "task_duration": time_spent_seconds or 60,
                "unit_time": time_spent_seconds or 120,
                "rest_interval": 300,
            }

            updated_dims = update_all_dimensions(current_dims, event_data)

            mongodb.update_student_profile(
                student_id,
                metacognitive_calibration=updated_dims.get("metacognitive_calibration"),
                attention_feature=updated_dims.get("attention_feature"),
                learning_rhythm_scalar=updated_dims.get("learning_rhythm", {}).get("scalar"),
                learning_rhythm_trend=updated_dims.get("learning_rhythm", {}).get("trend"),
            )

            # 记录告警事件
            for alert in updated_dims.get("_alerts", []):
                mongodb.add_timeline_event(student_id, "profile_alert", {"message": alert})
        except Exception:
            pass
    except Exception:
        pass  # 画像更新失败不影响答题主流程


# ═══════════════════════════════════════════════════════════════
#  错题推荐已有资源
# ═══════════════════════════════════════════════════════════════

def _get_recommended_resources(
    db: Session, student_id: UUID, kp_names: List[str], max_results: int = 3,
) -> list[dict]:
    """答错时推荐已有的学习资源（按知识点匹配）"""
    if not kp_names:
        return []
    try:
        resources = (
            db.query(KnowledgeResource)
            .filter(
                (KnowledgeResource.user_id == student_id) |
                (KnowledgeResource.is_public == True),
                KnowledgeResource.knowledge_points.overlap(kp_names),
            )
            .order_by(KnowledgeResource.updated_at.desc())
            .limit(max_results)
            .all()
        )
        return [
            {
                "id": str(r.id),
                "title": r.title,
                "resource_type": r.resource_type,
                "knowledge_points": list(r.knowledge_points or []),
            }
            for r in resources
        ]
    except Exception:
        return []


def _replan_active_path_after_practice(db: Session, student_id: UUID, trigger: str = "practice") -> None:
    try:
        active_state = (
            db.query(LearningPathState)
            .filter(
                LearningPathState.user_id == student_id,
                LearningPathState.phase != "completed",
            )
            .order_by(LearningPathState.updated_at.desc())
            .first()
        )
        if active_state:
            PathStateManager(db).replan_path(
                user_id=str(student_id),
                state_id=str(active_state.id),
                trigger=trigger,
            )
    except Exception as e:
        logger.warning(f"练习后动态调整路径失败: {e}")


@router.post("/questions/{question_id}/submit-answer", response_model=AnswerSubmitResponse)
async def submit_answer(
    question_id: UUID, data: AnswerSubmitRequest,
    db: Session = Depends(get_db),
    neo4j: Neo4jConnection = Depends(get_neo4j),
    mongodb: MongoDBConnection = Depends(get_mongodb),
    current_user=Depends(get_current_active_user),
):
    """记录单题答案（随学随新：自动更新画像）"""
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
        session_id=UUID(data.session_id) if data.session_id else None,
    )
    db.add(record)
    db.commit()

    # 随学随新：更新学习画像
    _update_profile_after_answer(
        str(current_user.student_id), question,
        data.is_correct, data.time_spent_seconds,
        db, neo4j, mongodb,
    )
    _replan_active_path_after_practice(db, current_user.student_id, trigger="practice_answer")

    # 答错时推荐已有资源
    recommended = []
    if not data.is_correct and question.knowledge_point_uuids:
        try:
            uuids = []
            for uid in question.knowledge_point_uuids:
                try:
                    uuids.append(UUID(uid))
                except Exception:
                    pass
            if uuids:
                pts = db.query(KnowledgePoint).filter(KnowledgePoint.id.in_(uuids)).all()
                kp_names = [p.name for p in pts if p.name]
                if kp_names:
                    recommended = _get_recommended_resources(db, current_user.student_id, kp_names)
        except Exception:
            pass

    return AnswerSubmitResponse(is_correct=data.is_correct, recommended_resources=recommended)


@router.post("/banks/{bank_id}/submit-answers", response_model=BatchAnswerSubmitResponse)
async def submit_answers_batch(
    bank_id: UUID, data: BatchAnswerSubmitRequest,
    db: Session = Depends(get_db),
    neo4j: Neo4jConnection = Depends(get_neo4j),
    mongodb: MongoDBConnection = Depends(get_mongodb),
    current_user=Depends(get_current_active_user),
):
    """批量提交答案（随学随新：自动更新画像）"""
    bank = _get_readable_bank(db, bank_id, current_user.student_id)
    if not bank:
        raise HTTPException(status_code=404, detail="题库不存在")

    # 先记录所有答案
    results = []
    answer_items = []
    for item in data.answers:
        record = StudentAnswer(
            user_id=current_user.student_id,
            question_id=item.question_id,
            bank_id=bank_id,
            answer_content=item.answer_content,
            is_correct=item.is_correct,
            time_spent_seconds=item.time_spent_seconds,
            session_id=UUID(item.session_id) if item.session_id else None,
        )
        db.add(record)
        results.append(AnswerSubmitResponse(is_correct=item.is_correct))
        answer_items.append((item.question_id, item.is_correct, item.time_spent_seconds))

    db.commit()

    # 随学随新：批量更新画像 + 错题推荐资源
    student_id = current_user.student_id
    student_id_str = str(student_id)
    for idx, (q_id, is_correct, time_spent) in enumerate(answer_items):
        question = db.query(Question).filter(Question.id == q_id).first()
        if question:
            _update_profile_after_answer(
                student_id_str, question, is_correct, time_spent, db, neo4j, mongodb,
            )
            # 答错时推荐已有资源
            if not is_correct and question.knowledge_point_uuids:
                try:
                    uuids = []
                    for uid in question.knowledge_point_uuids:
                        try:
                            uuids.append(UUID(uid))
                        except Exception:
                            pass
                    if uuids:
                        pts = db.query(KnowledgePoint).filter(KnowledgePoint.id.in_(uuids)).all()
                        kp_names = [p.name for p in pts if p.name]
                        if kp_names:
                            results[idx].recommended_resources = _get_recommended_resources(
                                db, student_id, kp_names,
                            )
                except Exception:
                    pass

    _replan_active_path_after_practice(db, student_id, trigger="practice_batch")

    return BatchAnswerSubmitResponse(results=results)


# ═══════════════════════════════════════════════════════════════
#  Self-Grade — 主观题自评
# ═══════════════════════════════════════════════════════════════


@router.post("/answers/{answer_id}/self-grade", response_model=dict)
async def self_grade_answer(
    answer_id: UUID,
    data: SelfGradeRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """提交单题自评分数（0.0-1.0）"""
    answer = db.query(StudentAnswer).filter(
        StudentAnswer.id == answer_id,
        StudentAnswer.user_id == current_user.student_id,
    ).first()
    if not answer:
        raise HTTPException(status_code=404, detail="答题记录不存在")
    if not (0.0 <= data.self_grade <= 1.0):
        raise HTTPException(status_code=400, detail="自评分数必须在 0.0-1.0 之间")
    answer.self_grade = data.self_grade
    db.commit()
    return {"answer_id": str(answer_id), "self_grade": data.self_grade}


@router.post("/sessions/{session_id}/self-grade", response_model=dict)
async def self_grade_batch(
    session_id: UUID,
    data: BatchSelfGradeRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """批量提交一场练习中的所有主观题自评分数"""
    session = db.query(PracticeSession).filter(
        PracticeSession.id == session_id,
        PracticeSession.user_id == current_user.student_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="练习会话不存在")

    updated = []
    for item in data.grades:
        answer = db.query(StudentAnswer).filter(
            StudentAnswer.id == item.answer_id,
            StudentAnswer.user_id == current_user.student_id,
            StudentAnswer.session_id == session_id,
        ).first()
        if answer:
            if not (0.0 <= item.self_grade <= 1.0):
                raise HTTPException(
                    status_code=400,
                    detail=f"自评分数必须在 0.0-1.0 之间 (answer_id={item.answer_id})",
                )
            answer.self_grade = item.self_grade
            updated.append({"answer_id": str(item.answer_id), "self_grade": item.self_grade})

    db.commit()
    return {"session_id": str(session_id), "updated": updated}


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


def _get_existing_questions_context(db: Session, bank_id: UUID, max_count: int = 30) -> str:
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

你的任务是直接根据用户需求快速生成题目，不要引导或多问。

必要的信息（用户一次性提供就直接生成）：
1. 知识点（至少1个，可以是已有的或全新的）
2. 题型（single_choice=单选题, multiple_choice=多选题, fill_blank=填空题, true_false=判断题, programming=编程题；不要生成简答题或论述题）
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

【速度优化——严格遵循】
1. 如果用户一次性提供了全部4项必要信息（知识点+题型+数量+难度），立即生成，不要问任何问题，直接输出 [[GENERATE]] + JSON，不要输出其他文字
2. 如果缺少1-2项，用一句话简短询问，用户补充后立即生成
3. 不要闲聊、问候或寒暄
4. 生成格式：
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
- 信息完整时：只输出 [[GENERATE]] + JSON，不要输出任何其他文字
- 信息不足时：一句话简短询问
- 确保题目内容准确、解析详细"""


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
                # 验证已有的知识点 UUID 是否属于当前学科，防止跨学科引用
                try:
                    kp = db.query(KnowledgePoint).join(KnowledgeDomain).filter(
                        KnowledgePoint.id == kp_ref,
                        KnowledgeDomain.subject_id == subject_id,
                    ).first()
                    if kp:
                        new_list.append(kp_ref)
                except Exception:
                    pass
        q["knowledge_point_uuids"] = new_list
    return questions


# ─── AI 对话持久化（Redis，每个题库一个对话，最多10轮） ──────────

AI_GEN_TTL = 86400  # 24 小时自动过期


def _save_ai_context(bank_id: UUID, history: List[Dict], params: dict, generated_questions: list = None):
    """保存 AI 出题对话到 Redis"""
    from app.core.security import _get_redis
    key = f"ai_gen_ctx:{bank_id}"
    # 只保留最近 10 轮 (20 条消息)
    trimmed = history[-20:] if len(history) > 20 else history
    data = json.dumps({
        "history": trimmed,
        "params": params,
        "generated_questions": generated_questions or [],
    })
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
            return (
                ctx.get("history", []),
                ctx.get("params", {}),
                ctx.get("generated_questions", []),
            )
    except Exception:
        pass
    return [], {}, []


def _clear_ai_context(bank_id: UUID):
    """清除 AI 出题对话"""
    from app.core.security import _get_redis
    key = f"ai_gen_ctx:{bank_id}"
    try:
        _get_redis().delete(key)
    except Exception:
        pass


def _parse_generated_questions(json_str: str) -> list:
    """解析 [[GENERATE]] 后面的 JSON，兼容数组和单对象两种格式"""
    json_str = re.sub(r'^```(?:json)?\s*', '', json_str)
    json_str = re.sub(r'\s*```$', '', json_str)
    # 1. 先尝试标准数组格式 [{...}, {...}]
    arr_start = json_str.find("[")
    arr_end = json_str.rfind("]")
    if arr_start != -1 and arr_end != -1:
        try:
            parsed = _safe_parse_json(json_str[arr_start:arr_end + 1])
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass
    # 2. 尝试流式多对象格式：用 }\n{ 或 }\n\n{ 分割
    #    LLM 有时输出 {...} {...} 无外层数组
    import re as _re
    parts = _re.split(r'}\s*\n\s*{', json_str)
    if len(parts) > 1:
        results = []
        for i, part in enumerate(parts):
            item_str = part.strip()
            if i > 0:
                item_str = "{" + item_str
            if i < len(parts) - 1:
                item_str = item_str + "}"
            try:
                parsed = _safe_parse_json(item_str)
                if isinstance(parsed, dict) and "content" in parsed:
                    results.append(parsed)
            except Exception:
                pass
        if results:
            return results

    # 3. 尝试单对象格式 {...}
    obj_start = json_str.find("{")
    obj_end = json_str.rfind("}")
    if obj_start != -1 and obj_end != -1:
        try:
            parsed = _safe_parse_json(json_str[obj_start:obj_end + 1])
            if isinstance(parsed, dict) and "content" in parsed:
                return [parsed]
        except Exception:
            pass

    # 4. 用 JSONDecoder 逐段解析（兜底）
    try:
        import json as _json
        decoder = _json.JSONDecoder()
        idx = 0
        results = []
        while idx < len(json_str):
            while idx < len(json_str) and json_str[idx].isspace():
                idx += 1
            if idx >= len(json_str):
                break
            if json_str[idx] == "{":
                try:
                    obj, end = decoder.raw_decode(json_str, idx)
                    if isinstance(obj, dict) and "content" in obj:
                        results.append(obj)
                    idx = end
                except Exception:
                    idx += 1
            else:
                idx += 1
        if results:
            return results
    except Exception:
        pass

    return []


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


async def _call_llm_for_questions(messages: List[Dict[str, str]], api_key_override: Optional[str] = None, base_url_override: Optional[str] = None, model_override: Optional[str] = None, max_tokens_override: Optional[int] = None) -> str:
    """调用 LLM 生成出题回复，优先使用传入的 API 配置"""
    api_key = api_key_override or settings.DEEPSEEK_API_KEY
    base_url = base_url_override or settings.DEEPSEEK_BASE_URL
    model = model_override or settings.DEEPSEEK_MODEL
    max_tokens = max_tokens_override or 4096

    if not api_key:
        api_key = settings.QWEN_API_KEY
        base_url = settings.QWEN_BASE_URL
        model = settings.QWEN_MODEL

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI 出题功能未配置 API Key，请在设置中配置 DeepSeek 或 Qwen API"
        )

    # 使用 Flash 模型加速出题（单题重生成已验证其可用性）
    if model == settings.DEEPSEEK_MODEL:
        model = "deepseek-v4-flash"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": max_tokens,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
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

    # 使用 Flash 模型加速出题
    if model == settings.DEEPSEEK_MODEL:
        model = "deepseek-v4-flash"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 4096,
        "stream": True,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
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
    # 1. 验证题库归属（AI 出题为写操作，需拥有题库）
    bank = _get_writable_bank(db, bank_id, current_user.student_id)
    if not bank:
        raise HTTPException(status_code=404, detail="题库不存在或无权操作")

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
                generated_questions = _parse_generated_questions(json_part)
                if generated_questions:
                    try:
                        generated_questions = _ensure_knowledge_points(
                            neo4j, db, bank.subject_id, generated_questions
                        )
                    except Exception:
                        pass

            # 7. 持久化对话
            updated_history = list(request.conversation_history)
            updated_history.append({"role": "user", "content": request.message})
            updated_history.append({"role": "assistant", "content": full_reply})
            _save_ai_context(bank_id, updated_history, request.collected_params, generated_questions)

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
    # 1. 验证题库归属（AI 出题为写操作，需拥有题库）
    bank = _get_writable_bank(db, bank_id, current_user.student_id)
    if not bank:
        raise HTTPException(status_code=404, detail="题库不存在或无权操作")

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
        json_part = reply.split("[[GENERATE]]", 1)[1].strip()
        generated_questions = _parse_generated_questions(json_part)
        if generated_questions:
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
    _save_ai_context(bank_id, updated_history, updated_params, generated_questions)

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
    generated_questions: List[Dict[str, Any]] = Field(default_factory=list)


@router.get("/banks/{bank_id}/ai-context", response_model=AIContextResponse)
async def get_ai_context(
    bank_id: UUID,
    current_user=Depends(get_current_active_user),
):
    """获取题库的 AI 出题对话上下文"""
    history, params, generated_questions = _load_ai_context(bank_id)
    return AIContextResponse(
        has_context=bool(history),
        history=history,
        collected_params=params,
        generated_questions=generated_questions,
    )


@router.delete("/banks/{bank_id}/ai-context", status_code=status.HTTP_204_NO_CONTENT)
async def clear_ai_context(
    bank_id: UUID,
    current_user=Depends(get_current_active_user),
):
    """清除题库的 AI 出题对话上下文"""
    _clear_ai_context(bank_id)


class UpdateSavedQuestionsRequest(BaseModel):
    saved_indices: List[int]


@router.post("/banks/{bank_id}/ai-context/saved-questions")
async def update_saved_questions(
    bank_id: UUID,
    data: UpdateSavedQuestionsRequest,
    current_user=Depends(get_current_active_user),
):
    """更新已保存的题目索引（存入 params，随上下文持久化）"""
    history, params, generated_questions = _load_ai_context(bank_id)
    params["saved_indices"] = data.saved_indices
    _save_ai_context(bank_id, history, params, generated_questions)
    return {"success": True, "saved_indices": data.saved_indices}


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
    bank = _get_readable_bank(db, bank_id, current_user.student_id)
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

    # 练习完成时更新每日统计
    if data.status == "completed" and data.stats:
        try:
            today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

            daily = db.query(DailyPracticeRecord).filter(
                DailyPracticeRecord.user_id == session.user_id,
                DailyPracticeRecord.bank_id == session.bank_id,
                DailyPracticeRecord.mode == session.mode,
                DailyPracticeRecord.record_date == today,
            ).first()

            correct = data.stats.get("correct", 0)
            incorrect = data.stats.get("incorrect", 0)
            total = correct + incorrect
            # 通过汇总会话答案计算用时
            answers = db.query(StudentAnswer).filter(
                StudentAnswer.session_id == session.id
            ).all()
            time_spent = sum(a.time_spent_seconds or 0 for a in answers)

            if daily:
                daily.total_questions += total
                daily.correct_count += correct
                daily.incorrect_count += incorrect
                daily.total_time_spent_seconds += time_spent
                daily.session_count += 1
            else:
                daily = DailyPracticeRecord(
                    user_id=session.user_id,
                    bank_id=session.bank_id,
                    mode=session.mode,
                    record_date=today,
                    total_questions=total,
                    correct_count=correct,
                    incorrect_count=incorrect,
                    total_time_spent_seconds=time_spent,
                    session_count=1,
                )
                db.add(daily)
            db.commit()
        except Exception:
            pass

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


@router.get("/practice-sessions/{session_id}/questions", response_model=List[PracticeQuestionResponse])
async def get_practice_session_questions(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """按会话保存的题目 ID 和顺序精确返回题目。

    试卷练习不能复用题库分页接口，否则题目不在第一页时会被静默丢失。
    """
    session = db.query(PracticeSession).filter(
        PracticeSession.id == session_id,
        PracticeSession.user_id == current_user.student_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="练习会话不存在")

    ordered_ids: List[UUID] = []
    for question_id in session.question_order or []:
        try:
            ordered_ids.append(UUID(str(question_id)))
        except (ValueError, TypeError):
            continue
    if not ordered_ids:
        return []

    questions = db.query(Question).filter(
        Question.id.in_(ordered_ids),
        Question.bank_id == session.bank_id,
    ).all()
    question_map = {q.id: q for q in questions}
    return [
        PracticeQuestionResponse.model_validate(question_map[question_id])
        for question_id in ordered_ids
        if question_id in question_map
    ]


# ====== Wrong Review (错题复习) ======

class WrongReviewItem(BaseModel):
    question_id: str
    stem: str
    type: str
    options: Optional[Any] = None
    user_answer: str
    correct_answer: List[str]
    explanation: Optional[str] = None
    knowledge_points: List[str]
    wrong_count: int
    last_wrong_at: str


class WrongReviewResponse(BaseModel):
    wrong_records: List[WrongReviewItem]
    total: int
    bank_name: str


@router.get("/banks/{bank_id}/wrong-review", response_model=WrongReviewResponse)
async def get_wrong_review(
    bank_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """获取章节错题详情，用于针对性复习。

    返回该章节中用户所有错题的详细信息，包括题干、用户答案、正确答案、
    知识点、错误次数等，按最近错误时间降序排列。
    """
    user_id = current_user.student_id

    # 1. 校验章节存在
    bank = db.query(QuestionBank).filter(QuestionBank.id == bank_id).first()
    if not bank:
        raise HTTPException(status_code=404, detail="章节不存在")
    bank_name = bank.name

    # 2. 查询该用户在该章节的所有错题，按最近错误时间降序
    wrong_records = db.query(WrongAnswerRecord).filter(
        WrongAnswerRecord.user_id == user_id,
        WrongAnswerRecord.bank_id == bank_id,
    ).order_by(WrongAnswerRecord.last_wrong_at.desc()).all()

    if not wrong_records:
        return WrongReviewResponse(wrong_records=[], total=0, bank_name=bank_name)

    question_ids = [wr.question_id for wr in wrong_records]

    # 3. 批量查询题目
    questions = db.query(Question).filter(Question.id.in_(question_ids)).all()
    question_map = {q.id: q for q in questions}

    # 4. 批量查询用户对该章节所有错题的错误答案，取每道题最近一次
    all_wrong_answers = db.query(StudentAnswer).filter(
        StudentAnswer.user_id == user_id,
        StudentAnswer.question_id.in_(question_ids),
        StudentAnswer.is_correct == False,
    ).order_by(StudentAnswer.created_at.desc()).all()

    # 构建 question_id -> latest wrong answer 映射（第一即是最近）
    answer_map: dict = {}
    for sa in all_wrong_answers:
        if sa.question_id not in answer_map:
            answer_map[sa.question_id] = sa

    # 5. 批量查询知识点
    all_kp_uuids = set()
    for q in questions:
        for kp_uuid in (q.knowledge_point_uuids or []):
            if kp_uuid:
                all_kp_uuids.add(kp_uuid)

    kp_map: dict[str, str] = {}
    if all_kp_uuids:
        try:
            kp_uuid_objs = [UUID(uid) for uid in all_kp_uuids]
            kps = db.query(KnowledgePoint).filter(KnowledgePoint.id.in_(kp_uuid_objs)).all()
            kp_map = {str(kp.id): kp.name for kp in kps}
        except (ValueError, TypeError):
            pass

    # 6. 构建响应列表
    items: list[WrongReviewItem] = []
    for wr in wrong_records:
        question = question_map.get(wr.question_id)
        if not question:
            continue

        content = question.content if isinstance(question.content, dict) else (question.content or {})
        answer_json = question.answer if isinstance(question.answer, dict) else (question.answer or {})

        # 用户答案
        latest_sa = answer_map.get(wr.question_id)
        user_answer = ""
        if latest_sa and latest_sa.answer_content:
            user_answer = latest_sa.answer_content.get("user_answer", "")

        # 正确答案 & 解析（兼容字符串和列表两种存储格式）
        raw_answer = answer_json.get("correct_answer", [])
        if isinstance(raw_answer, str):
            correct_answer = [raw_answer]
        elif isinstance(raw_answer, list):
            correct_answer = raw_answer
        else:
            correct_answer = []
        explanation = answer_json.get("explanation", None)
        # 确保 explanation 是字符串（数据库可能存为非字符串类型）
        if explanation is not None and not isinstance(explanation, str):
            if isinstance(explanation, dict) or isinstance(explanation, list):
                try:
                    explanation = json.dumps(explanation, ensure_ascii=False)
                except Exception:
                    explanation = str(explanation)
            else:
                explanation = str(explanation)

        # 知识点名称
        kp_names = [
            kp_map[str(kp_uuid)]
            for kp_uuid in (question.knowledge_point_uuids or [])
            if kp_uuid and str(kp_uuid) in kp_map
        ]

        items.append(WrongReviewItem(
            question_id=str(wr.question_id),
            stem=str(content.get("stem", "") or ""),
            type=question.type or "",
            options=content.get("options", None),
            user_answer=str(user_answer or ""),
            correct_answer=correct_answer,
            explanation=str(explanation) if explanation else None,
            knowledge_points=kp_names,
            wrong_count=wr.wrong_count,
            last_wrong_at=wr.last_wrong_at.isoformat() if wr.last_wrong_at else "",
        ))

    return WrongReviewResponse(
        wrong_records=items,
        total=len(items),
        bank_name=bank_name,
    )


# ── 章节完成检测 ──

class DomainCompletionResponse(BaseModel):
    domain_id: str
    domain_name: str
    total_questions: int
    answered_questions: int
    wrong_count: int
    all_done: bool

    class Config:
        from_attributes = True


@router.get("/domains/{domain_id}/completion", response_model=DomainCompletionResponse)
async def get_domain_completion(
    domain_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """检测用户是否完成了某个章节（domain）的全部题目"""
    domain = db.query(KnowledgeDomain).filter(KnowledgeDomain.id == domain_id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="章节不存在")

    # 1. 找到该章节下所有知识点
    kps = db.query(KnowledgePoint).filter(KnowledgePoint.domain_id == domain_id).all()
    kp_uuids = [str(kp.id) for kp in kps]

    if not kp_uuids:
        return DomainCompletionResponse(
            domain_id=str(domain_id), domain_name=domain.name,
            total_questions=0, answered_questions=0, wrong_count=0, all_done=True,
        )

    # 2. 找到关联这些知识点的题目
    # knowledge_point_uuids 是 JSONB UUID 数组，用 Python 侧过滤
    all_qs = db.query(Question).all()
    questions = []
    kp_set = set(kp_uuids)
    for q in all_qs:
        q_kps = set(str(u) for u in (q.knowledge_point_uuids or []))
        if q_kps & kp_set:
            questions.append(q)
    total_qs = len(questions)
    question_ids = [q.id for q in questions]

    if total_qs == 0:
        return DomainCompletionResponse(
            domain_id=str(domain_id), domain_name=domain.name,
            total_questions=0, answered_questions=0, wrong_count=0, all_done=True,
        )

    # 3. 已答题目数
    student_id = current_user.student_id
    answered = db.query(StudentAnswer.question_id).filter(
        StudentAnswer.question_id.in_(question_ids),
        StudentAnswer.user_id == student_id,
    ).distinct().count()

    # 4. 错题数
    wrong_count = db.query(StudentAnswer.question_id).filter(
        StudentAnswer.question_id.in_(question_ids),
        StudentAnswer.user_id == student_id,
        StudentAnswer.is_correct == False,
    ).distinct().count()

    return DomainCompletionResponse(
        domain_id=str(domain_id),
        domain_name=domain.name,
        total_questions=total_qs,
        answered_questions=answered,
        wrong_count=wrong_count,
        all_done=(answered >= total_qs),
    )


# ── 标记章节知识点为已掌握 ──

class MarkMasteredResponse(BaseModel):
    success: bool
    marked_count: int
    message: str


@router.post("/domains/{domain_id}/mark-mastered", response_model=MarkMasteredResponse)
async def mark_domain_mastered(
    domain_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """将该章节下所有知识点标记为已掌握"""
    domain = db.query(KnowledgeDomain).filter(KnowledgeDomain.id == domain_id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="章节不存在")

    kps = db.query(KnowledgePoint).filter(KnowledgePoint.domain_id == domain_id).all()
    now = datetime.utcnow()
    count = 0

    for kp in kps:
        record = db.query(KnowledgePointRecord).filter(
            KnowledgePointRecord.user_id == current_user.student_id,
            KnowledgePointRecord.point_id == kp.id,
        ).first()
        if record:
            record.mastery_score = 100
            record.status = "mastered"
            record.updated_at = now
        else:
            record = KnowledgePointRecord(
                user_id=current_user.student_id,
                point_id=kp.id,
                point_name=kp.name,
                domain_id=domain_id,
                mastery_score=100,
                status="mastered",
                total_practiced=0,
                consecutive_errors=0,
            )
            db.add(record)
        count += 1

    db.commit()
    return MarkMasteredResponse(
        success=True,
        marked_count=count,
        message=f"已将 {count} 个知识点标记为已掌握",
    )
