import uuid
from datetime import datetime
import enum
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Uuid, Integer, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.db.database import Base


class QuestionType(str, enum.Enum):
    """题目类型 — 七种题型"""
    SINGLE_CHOICE = "single_choice"          # 单选题
    MULTIPLE_CHOICE = "multiple_choice"      # 多选题
    FILL_BLANK = "fill_blank"                 # 填空题
    TRUE_FALSE = "true_false"                # 判断题
    SHORT_ANSWER = "short_answer"            # 简答题
    PROGRAMMING = "programming"              # 编程题
    ESSAY = "essay"                          # 论述题


class QuestionDifficulty(str, enum.Enum):
    """五级难度"""
    BEGINNER = "beginner"           # 入门
    BASIC = "basic"                 # 基础
    INTERMEDIATE = "intermediate"   # 进阶
    ADVANCED = "advanced"           # 挑战
    COMPETITION = "competition"     # 竞赛


class QuestionStatus(str, enum.Enum):
    DRAFT = "draft"
    REVIEWED = "reviewed"       # 已审核（AI自动或人工）
    PUBLISHED = "published"
    ARCHIVED = "archived"


class BankVisibility(str, enum.Enum):
    PRIVATE = "private"
    SHARED = "shared"
    PUBLIC = "public"


class Subject(Base):
    """学科 — 知识结构顶层"""
    __tablename__ = "subjects"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    name = Column(String(200), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    cover_image = Column(String(500), nullable=True)
    creator_id = Column(Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    domains = relationship("KnowledgeDomain", back_populates="subject", cascade="all, delete-orphan",
                           order_by="KnowledgeDomain.sort_order")


class KnowledgeDomain(Base):
    """知识领域（章节）— 第二层，如"CPU流水线"、”存储系统“"""
    __tablename__ = "knowledge_domains"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    subject_id = Column(Uuid, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    subject = relationship("Subject", back_populates="domains")
    knowledge_points = relationship("KnowledgePoint", back_populates="domain", cascade="all, delete-orphan",
                                    order_by="KnowledgePoint.sort_order")


class KnowledgePoint(Base):
    """具体知识点 — 第三层，如"Cache映射方式"、"流水线冒险" """
    __tablename__ = "knowledge_points"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    domain_id = Column(Uuid, ForeignKey("knowledge_domains.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    difficulty = Column(Integer, default=1)  # 1-5, 冗余字段
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    domain = relationship("KnowledgeDomain", back_populates="knowledge_points")


class QuestionBank(Base):
    """个人题库 — 归属用户，绑定学科，含练习进度统计"""
    __tablename__ = "question_banks"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id = Column(Uuid, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    visibility = Column(String(20), nullable=False, default=BankVisibility.PRIVATE.value)
    total_questions = Column(Integer, default=0)
    tags = Column(JSONB, default=list)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    questions = relationship("Question", back_populates="bank", cascade="all, delete-orphan",
                             order_by="Question.priority.desc(), Question.created_at.desc()")


class Question(Base):
    """
    题目 — 核心实体。

    存储分层:
    - PostgreSQL: 结构化元数据 + content JSONB + answer JSONB
    - Neo4j: Question 节点（轻量引用）+ [:TESTS]->(KnowledgePoint) 关系

    content JSONB 结构（按题型）:
    ```json
    // single_choice / multiple_choice
    {"stem": "题干", "options": [{"key": "A", "text": "选项"}, ...], "images": []}

    // fill_blank
    {"stem": "题干含___", "blanks_count": 2}

    // true_false
    {"stem": "判断题干"}

    // short_answer / essay
    {"stem": "问题描述"}

    // programming
    {"stem": "题目描述", "code_template": "def solution():\\n    pass", "test_cases": [...]}
    ```

    answer JSONB 结构:
    ```json
    {"correct_answer": ["B"], "explanation": "解析内容",
     "difficulty_rationale": "难度说明", "suggested_time_seconds": 60}
    ```

    knowledge_point_uuids: Neo4j 知识点 UUID 列表，关联到具体知识点
    """
    __tablename__ = "questions"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    bank_id = Column(Uuid, ForeignKey("question_banks.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(30), nullable=False, default=QuestionType.SINGLE_CHOICE.value)
    difficulty = Column(String(20), nullable=False, default=QuestionDifficulty.BASIC.value)
    status = Column(String(20), nullable=False, default=QuestionStatus.PUBLISHED.value)
    priority = Column(Integer, default=0)  # 优先级，数值越大越重要

    # 核心内容
    content = Column(JSONB, nullable=False, default=dict)  # 结构化题干
    answer = Column(JSONB, nullable=False, default=dict)   # 答案+解析

    # 知识点关联（核心：连接题库与知识图谱）
    knowledge_point_uuids = Column(JSONB, nullable=False, default=list)  # ["kp-uuid-1", ...]

    # 标签与来源
    tags = Column(JSONB, default=list)
    ai_generated = Column(Boolean, default=False)
    source = Column(String(50), default="manual")
    created_by = Column(Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    bank = relationship("QuestionBank", back_populates="questions")


class PracticeSession(Base):
    """练习会话 — 记录一次完整的练习活动"""
    __tablename__ = "practice_sessions"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    bank_id = Column(Uuid, ForeignKey("question_banks.id", ondelete="CASCADE"), nullable=False)
    mode = Column(String(20), nullable=False, default="random")  # random / sequential / adaptive / weak_point / exam
    status = Column(String(20), nullable=False, default="active")  # active / paused / completed
    question_order = Column(JSONB, default=list)  # 题目ID序列
    current_index = Column(Integer, default=0)
    stats = Column(JSONB, default=dict)  # {total, completed, correct, incorrect}
    answer_mode = Column(String(20), nullable=False, default="during")  # during / after
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class ExamPaper(Base):
    """试卷 — 从题库中选择题目组成试卷"""
    __tablename__ = "exam_papers"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    bank_id = Column(Uuid, ForeignKey("question_banks.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    config = Column(JSONB, nullable=False, default=dict)  # {sections: [{name, question_type, count, score_per_question, question_ids, difficulty, domain_ids}]}
    generate_method = Column(String(20), nullable=False, default="manual")  # manual / upload
    status = Column(String(20), nullable=False, default="draft")  # draft / published / archived
    total_questions = Column(Integer, default=0)
    total_score = Column(Integer, default=100)
    time_limit_minutes = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    bank = relationship("QuestionBank", backref="exam_papers")


class StudentAnswer(Base):
    """学生答题记录 — 跟踪用户对题目的作答情况"""
    __tablename__ = "question_answers"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(Uuid, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    bank_id = Column(Uuid, ForeignKey("question_banks.id", ondelete="CASCADE"), nullable=False, index=True)
    answer_content = Column(JSONB, nullable=False, default=dict)
    is_correct = Column(Boolean, nullable=False, default=False)
    time_spent_seconds = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
