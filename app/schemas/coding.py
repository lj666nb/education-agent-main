from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime


# ── 目录树 ──

class ProblemSummary(BaseModel):
    id: str
    title: str
    difficulty: str
    status: str = "not_started"


class PointNode(BaseModel):
    point_id: str
    point_name: str
    problems: List[ProblemSummary] = Field(default_factory=list)


class DomainNode(BaseModel):
    domain_id: str
    domain_name: str
    sort_order: int = 0
    total_problems: int = 0
    completed_count: int = 0
    points: List[PointNode] = Field(default_factory=list)


class CodingTreeResponse(BaseModel):
    domains: List[DomainNode]


# ── 题目详情 ──

class CodingProblemResponse(BaseModel):
    id: str
    title: str
    type: str = "programming"
    content: Dict[str, Any]
    answer: Dict[str, Any] = Field(default_factory=dict)
    difficulty: str
    knowledge_point_uuids: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    source: Optional[str] = None
    user_last_code: Optional[str] = None
    attempt_count: int = 0
    public_cases: List[Dict[str, Any]] = Field(default_factory=list)


# ── AI 分析 ──

class AnalyzeRequest(BaseModel):
    problem_id: str = Field(..., description="题目ID")
    code: str = Field(..., min_length=1, description="学生代码")
    language: str = Field(default="python", description="编程语言")


# ── 提交结果 ──

class SubmitResultRequest(BaseModel):
    problem_id: str
    code: str
    language: str = "python"
    is_correct: bool
    time_spent_seconds: Optional[int] = None


class SubmitResultResponse(BaseModel):
    success: bool
    answer_id: str


# ── 安全判题 ──

class JudgeRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=65536)
    language: str = Field(default="python")
    trace: bool = Field(default=False)


class JudgeCaseResult(BaseModel):
    case_no: int
    name: str
    visibility: str
    status: str
    passed: bool
    input: Optional[str] = None
    expected: Optional[str] = None
    actual: Optional[str] = None
    stderr: str = ""
    execution_time: float = 0


class JudgeResponse(BaseModel):
    verdict: str
    passed_cases: int
    total_cases: int
    all_passed: bool
    runtime: float
    cases: List[JudgeCaseResult]
    trace: List[Dict[str, Any]] = Field(default_factory=list)
    submission_id: Optional[str] = None


class SubmissionHistoryItem(BaseModel):
    id: str
    created_at: datetime
    language: str
    verdict: str
    is_correct: bool
    passed_cases: int
    total_cases: int
    runtime: float
