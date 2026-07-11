from pydantic import BaseModel, Field, field_validator
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

    @field_validator("tags", mode="before")
    @classmethod
    def coerce_tags(cls, v):
        return v if v is not None else []

    @field_validator("ai_generated", mode="before")
    @classmethod
    def coerce_ai_generated(cls, v):
        return False if v is None else v

    @field_validator("source", mode="before")
    @classmethod
    def coerce_source(cls, v):
        return "manual" if v is None else v


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
    knowledge_point_uuids: List[str] = Field(default_factory=list, description="知识点UUID过滤，空=全部")
    only_unanswered: bool = Field(False, description="只做未做过的")
    only_wrong: bool = Field(False, description="只做错题")
    only_error_prone: bool = Field(False, description="仅易错题")
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
    session_id: Optional[str] = Field(None, description="练习会话ID")


class AnswerSubmitResponse(BaseModel):
    is_correct: bool
    recommended_resources: List[dict] = Field(default_factory=list, description="答错时推荐的已有学习资源")


class BatchAnswerItem(BaseModel):
    question_id: str
    answer_content: Dict[str, Any] = Field(default_factory=dict)
    is_correct: bool = False
    time_spent_seconds: Optional[int] = None
    session_id: Optional[str] = None


class BatchAnswerSubmitRequest(BaseModel):
    answers: List[BatchAnswerItem]


class BatchAnswerSubmitResponse(BaseModel):
    results: List[AnswerSubmitResponse]


# ===== Self-Grade =====

class SelfGradeRequest(BaseModel):
    """单题自评提交"""
    self_grade: float = Field(..., ge=0.0, le=1.0, description="自评分数 0.0-1.0")


class SelfGradeItem(BaseModel):
    """批量自评中的单项"""
    answer_id: str
    self_grade: float = Field(..., ge=0.0, le=1.0)


class BatchSelfGradeRequest(BaseModel):
    """批量自评提交"""
    grades: List[SelfGradeItem]


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


# ===== Wrong Answer Book =====

class WrongAnswerItem(BaseModel):
    id: UUID
    question_id: str
    bank_id: str
    wrong_count: int
    first_wrong_at: datetime
    last_wrong_at: datetime
    question: QuestionResponse
    model_config = {"from_attributes": True}


class WrongAnswerListResponse(BaseModel):
    items: List[WrongAnswerItem]
    total: int


# ===== Session Answers (Test History Detail) =====

class SessionAnswerItem(BaseModel):
    answer_id: str
    question_id: str
    question: Optional[QuestionResponse] = None
    answer_content: Dict[str, Any] = {}
    is_correct: bool
    self_grade: Optional[float] = None  # 自评分数 0.0-1.0
    time_spent_seconds: Optional[int] = None
    answered_at: Optional[datetime] = None


class SessionAnswerListResponse(BaseModel):
    session_id: str
    items: List[SessionAnswerItem]
    total: int


# ===== Daily Stats =====

class DailyStatsItem(BaseModel):
    date: str
    total_questions: int = 0
    correct_count: int = 0
    incorrect_count: int = 0
    total_time_spent_seconds: int = 0
    session_count: int = 0
    accuracy: float = 0.0


class DailyStatsResponse(BaseModel):
    items: List[DailyStatsItem]
    total: int


# ===== Learning Path V2 =====

class KnowledgePointRecordResponse(BaseModel):
    """知识点学习记录"""
    point_id: str
    point_name: str
    domain_name: str = ""
    subject_name: str = ""
    mastery_score: int = 0
    recent_accuracy: int = 0
    consecutive_errors: int = 0
    total_practiced: int = 0
    total_correct: int = 0
    total_questions: int = 0    # 该知识点在题库中的总题目数
    total_time_spent_seconds: int = 0
    study_count: int = 0
    last_study_at: Optional[datetime] = None
    last_practice_at: Optional[datetime] = None
    next_review_at: Optional[datetime] = None
    status: str = "not_started"
    video_url: Optional[str] = None       # 精讲视频链接
    review_material: Optional[str] = None  # 公共原文讲义（兼容旧字段名）
    review_source_url: Optional[str] = None
    review_source_mode: Optional[str] = None
    coding_problem_id: Optional[str] = None
    coding_problem_title: Optional[str] = None
    coding_problem_difficulty: Optional[str] = None
    model_config = {"from_attributes": True}


class PathNodeStatus(BaseModel):
    """路径中某个节点的状态"""
    point_id: str
    point_name: str
    domain_name: str = ""
    domain_sort_order: int = 0  # 领域排序序号
    sort_order: int = 0  # 知识点排序序号
    mastery_score: int = 0
    status: str = "not_started"  # not_started / learning / mastered / reviewing
    is_difficult: bool = False  # 困难点标记
    needs_review: bool = False  # 待复习标记


class DagNode(BaseModel):
    """DAG 节点（ReactFlow 格式）"""
    id: str
    point_id: str = ""
    label: str
    progress: str = "not_started"  # completed / in_progress / not_started
    mastery_score: int = 0
    is_weak: bool = False
    domain: str = ""
    subject: str = ""


class DagEdge(BaseModel):
    """DAG 边（ReactFlow 格式）"""
    id: str
    source: str
    target: str
    label: str = ""
    type: str = "PREREQUISITE"  # PREREQUISITE / RELATED_TO
    animated: bool = False


class DagData(BaseModel):
    """DAG 图数据"""
    nodes: List[DagNode] = []
    edges: List[DagEdge] = []
    metadata: dict = {}


class LearningPathMarkdownResponse(BaseModel):
    """学习路径响应：节点状态列表 + DAG 图数据"""
    nodes: List[PathNodeStatus]
    summary: dict = {}  # {total, mastered, learning, not_started, difficult}
    dag_data: DagData = Field(default_factory=DagData, description="ReactFlow DAG 图数据（含真实依赖边）")


class AgentRecommendation(BaseModel):
    """Agent 推荐卡片"""
    type: str  # review / practice / study_rest / unlock / breakthrough
    title: str
    description: str
    priority: str = "normal"  # high / normal / low
    related_point_id: Optional[str] = None
    related_point_name: Optional[str] = None
    action_label: str = "查看详情"
    action_url: str = ""


class AgentRecommendationListResponse(BaseModel):
    recommendations: List[AgentRecommendation]
    total: int


class PathHistoryItem(BaseModel):
    id: str
    agent_reason: Optional[str] = None
    snapshot_data: dict = {}
    created_at: datetime
    model_config = {"from_attributes": True}


class PathHistoryResponse(BaseModel):
    items: List[PathHistoryItem]
    total: int
