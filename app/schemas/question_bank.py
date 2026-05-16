from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime


# ===== Subject / KnowledgeDomain / KnowledgePoint =====

class KnowledgePointCreate(BaseModel):
    name: str
    description: Optional[str] = None
    difficulty: int = 1
    sort_order: int = 0


class KnowledgePointResponse(BaseModel):
    id: UUID
    domain_id: UUID
    name: str
    description: Optional[str] = None
    difficulty: int
    sort_order: int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class KnowledgeDomainCreate(BaseModel):
    name: str
    description: Optional[str] = None
    sort_order: int = 0


class KnowledgeDomainResponse(BaseModel):
    id: UUID
    subject_id: UUID
    name: str
    description: Optional[str] = None
    sort_order: int
    created_at: datetime
    updated_at: datetime
    knowledge_points: List[KnowledgePointResponse] = []
    model_config = {"from_attributes": True}


class SubjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    sort_order: int = 0


class SubjectResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    cover_image: Optional[str] = None
    creator_id: Optional[UUID] = None
    sort_order: int
    created_at: datetime
    updated_at: datetime
    domains: List[KnowledgeDomainResponse] = []
    model_config = {"from_attributes": True}


class SubjectListResponse(BaseModel):
    subjects: List[SubjectResponse]
    total: int


# ===== Question Bank =====

class QuestionBankCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    subject_id: UUID
    description: Optional[str] = None
    visibility: str = "private"
    tags: List[str] = []


class QuestionBankUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    visibility: Optional[str] = None
    tags: Optional[List[str]] = None


class QuestionBankResponse(BaseModel):
    id: UUID
    owner_id: UUID
    subject_id: UUID
    name: str
    description: Optional[str] = None
    visibility: str = "private"
    total_questions: int = 0
    tags: List[str] = []
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class QuestionBankListResponse(BaseModel):
    banks: List[QuestionBankResponse]
    total: int


# ===== Question =====

class AnswerSchema(BaseModel):
    correct_answer: List[str] = Field(default_factory=list)
    explanation: str = ""
    difficulty_rationale: str = ""
    suggested_time_seconds: int = 60


class QuestionCreate(BaseModel):
    type: str = Field(..., pattern=r"^(single_choice|multiple_choice|fill_blank|true_false|short_answer|programming|essay)$")
    content: Dict[str, Any] = Field(default_factory=dict)
    answer: Dict[str, Any] = Field(default_factory=dict)
    difficulty: str = "basic"
    priority: int = 0
    knowledge_point_uuids: List[str] = Field(default_factory=list)
    tags: List[str] = []
    ai_generated: bool = False
    source: str = "manual"
    status: str = "published"


class QuestionUpdate(BaseModel):
    type: Optional[str] = None
    content: Optional[Dict[str, Any]] = None
    answer: Optional[Dict[str, Any]] = None
    difficulty: Optional[str] = None
    priority: Optional[int] = None
    knowledge_point_uuids: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None


class QuestionResponse(BaseModel):
    id: UUID
    bank_id: UUID
    type: str
    content: Dict[str, Any]
    answer: Dict[str, Any]
    difficulty: str
    priority: int
    knowledge_point_uuids: List[str] = []
    tags: List[str] = []
    ai_generated: bool = False
    source: str = "manual"
    status: str = "published"
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class QuestionListResponse(BaseModel):
    questions: List[QuestionResponse]
    total: int
    page: int
    page_size: int


# ===== Practice =====

class DomainQuestionCount(BaseModel):
    """章节题目计数"""
    domain_id: str
    domain_name: str
    total: int
    unanswered: int = 0
    wrong: int = 0


class PracticeConfig(BaseModel):
    """自测配置"""
    time_limit_minutes: Optional[int] = Field(None, description="时间限制（分钟），null=无限制")
    question_count: Optional[int] = Field(None, ge=1, le=200, description="题目数量，null=全部")
    question_types: List[str] = Field(default_factory=list, description="题型过滤，空=全部")
    domain_ids: List[str] = Field(default_factory=list, description="章节ID过滤，空=全部")
    only_unanswered: bool = Field(False, description="只做未做过的")
    only_wrong: bool = Field(False, description="只做错题")
    answer_mode: str = Field("during", description="答案显示模式: during=边测边看, after=测后看答案")


class PracticeQuestionResponse(BaseModel):
    """练习用题目"""
    id: UUID
    type: str
    content: Dict[str, Any]
    answer: Dict[str, Any] = Field(default_factory=dict)
    difficulty: str
    knowledge_point_uuids: List[str] = []
    tags: List[str] = []
    model_config = {"from_attributes": True}


class AnswerSubmitRequest(BaseModel):
    """单题答案提交"""
    answer_content: Dict[str, Any] = Field(default_factory=dict)
    is_correct: bool = False
    time_spent_seconds: Optional[int] = None


class AnswerSubmitResponse(BaseModel):
    is_correct: bool


class BatchAnswerItem(BaseModel):
    question_id: str
    answer_content: Dict[str, Any] = Field(default_factory=dict)
    is_correct: bool = False
    time_spent_seconds: Optional[int] = None


class BatchAnswerSubmitRequest(BaseModel):
    answers: List[BatchAnswerItem]


class BatchAnswerSubmitResponse(BaseModel):
    results: List[AnswerSubmitResponse]


# ===== Practice Session =====

class PracticeSessionCreate(BaseModel):
    """创建练习会话"""
    mode: str = "random"
    answer_mode: str = "during"
    question_order: List[str] = Field(default_factory=list)


class PracticeSessionUpdate(BaseModel):
    """更新练习会话"""
    status: Optional[str] = None
    current_index: Optional[int] = None
    stats: Optional[Dict[str, Any]] = None
    finished_at: Optional[datetime] = None


class PracticeSessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    bank_id: UUID
    mode: str
    status: str
    question_order: List[str] = []
    current_index: int = 0
    stats: Dict[str, Any] = {}
    answer_mode: str = "during"
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class PracticeSessionListResponse(BaseModel):
    sessions: List[PracticeSessionResponse]
    total: int


# ===== Exam Paper =====

class ExamPaperSection(BaseModel):
    name: str
    question_type: str
    count: int = Field(ge=1, le=200)
    score_per_question: int = Field(1, ge=1, le=100)
    question_ids: List[str] = Field(default_factory=list)
    difficulty: Optional[str] = None
    domain_ids: List[str] = Field(default_factory=list)


class ExamPaperCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    total_score: int = Field(100, ge=1, le=1000)
    time_limit_minutes: Optional[int] = Field(None, ge=1, le=600)
    generate_method: str = "manual"
    sections: List[ExamPaperSection] = Field(default_factory=list)


class ExamPaperUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    total_score: Optional[int] = None
    time_limit_minutes: Optional[int] = None
    status: Optional[str] = None


class ExamPaperListItem(BaseModel):
    id: UUID
    bank_id: UUID
    title: str
    description: Optional[str] = None
    generate_method: str
    status: str
    total_questions: int
    total_score: int
    time_limit_minutes: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class ExamPaperDetailResponse(BaseModel):
    id: UUID
    bank_id: UUID
    title: str
    description: Optional[str] = None
    config: Dict[str, Any] = {}
    generate_method: str
    status: str
    total_questions: int
    total_score: int
    time_limit_minutes: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    sections: List[Dict[str, Any]] = []
    model_config = {"from_attributes": True}


class ExamPaperListResponse(BaseModel):
    papers: List[ExamPaperListItem]
    total: int


class SuggestQuestionsRequest(BaseModel):
    sections: List[ExamPaperSection]
    exclude_question_ids: List[str] = Field(default_factory=list)


class SuggestQuestionsResponse(BaseModel):
    sections: List[Dict[str, Any]]
    total_questions: int


class ParseUploadResponse(BaseModel):
    filename: str
    suggested_title: str
    parsed_sections: List[Dict[str, Any]] = Field(default_factory=list)
    full_text: str = ""


class AIGenerateExamResponse(BaseModel):
    generated_questions: List[Dict[str, Any]]
    total: int


class StartExamPracticeResponse(BaseModel):
    session_id: str
    practice_url: str
