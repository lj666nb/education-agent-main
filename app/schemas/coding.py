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
    problems: List[ProblemSummary] = []


class DomainNode(BaseModel):
    domain_id: str
    domain_name: str
    sort_order: int = 0
    total_problems: int = 0
    completed_count: int = 0
    points: List[PointNode] = []


class CodingTreeResponse(BaseModel):
    domains: List[DomainNode]


# ── 题目详情 ──

class CodingProblemResponse(BaseModel):
    id: str
    title: str
    type: str = "programming"
    content: Dict[str, Any]
    difficulty: str
    knowledge_point_uuids: List[str] = []
    tags: List[str] = []
    user_last_code: Optional[str] = None


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
