from sqlalchemy import Column, String, DateTime, Uuid, Float, ForeignKey, Text, Integer
from sqlalchemy.orm import relationship
from app.db.database import Base
from datetime import datetime
import uuid
from typing import Optional, Dict, List, Any
from pydantic import BaseModel, Field
from enum import Enum


class CognitiveStyleType(str, Enum):
    VISUAL = "visual"
    AUDITORY = "auditory"
    READING_WRITING = "reading_writing"
    KINESTHETIC = "kinesthetic"
    MIXED = "mixed"


class KnowledgeMasteryData(BaseModel):
    knowledge_point: str
    score: float = 0.0
    confidence: float = 0.3
    last_updated: Optional[Any] = None


class CognitiveStyleData(BaseModel):
    style_type: CognitiveStyleType
    confidence: float = 0.5
    last_updated: Optional[Any] = None


class ErrorProneTopicData(BaseModel):
    topic: str
    error_count: int = 1
    last_updated: Optional[Any] = None


class ActiveHoursData(BaseModel):
    morning: float = Field(default=0.25, ge=0, le=1)
    afternoon: float = Field(default=0.25, ge=0, le=1)
    evening: float = Field(default=0.25, ge=0, le=1)
    night: float = Field(default=0.25, ge=0, le=1)


class LearningRhythmData(BaseModel):
    scalar: float = Field(default=0.5, ge=0, le=1)
    trend: float = Field(default=0.0, ge=-1, le=1)


class ProfileDimensionsData(BaseModel):
    active_hours: ActiveHoursData = ActiveHoursData()
    learning_rhythm: LearningRhythmData = LearningRhythmData()
    metacognitive_calibration: float = Field(default=0.0, ge=-1, le=1)
    attention_feature: float = Field(default=0.5, ge=0, le=1)


class TimelineEventData(BaseModel):
    event_id: str
    event_type: str
    event_data: Dict[str, Any]
    timestamp: Any


class StudentProfileDB(Base):
    __tablename__ = "student_preference_vectors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Uuid, nullable=False, index=True, unique=True)
    preference_vector = Column(Text, nullable=True)
    multimodal_preference = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class ProfileCreateRequest(BaseModel):
    student_id: str
    cognitive_style: Optional[CognitiveStyleType] = None
    cognitive_style_confidence: float = 0.5
    active_hours: Optional[Dict[str, float]] = None
    learning_rhythm_scalar: float = 0.5
    learning_rhythm_trend: float = 0.0
    metacognitive_calibration: float = 0.0
    attention_feature: float = 0.5
    knowledge_points: Optional[List[Dict[str, float]]] = None


class ProfileUpdateRequest(BaseModel):
    cognitive_style: Optional[CognitiveStyleType] = None
    cognitive_style_confidence: Optional[float] = None
    active_hours: Optional[Dict[str, float]] = None
    learning_rhythm_scalar: Optional[float] = None
    learning_rhythm_trend: Optional[float] = None
    metacognitive_calibration: Optional[float] = None
    attention_feature: Optional[float] = None


class KnowledgeMasteryUpdateRequest(BaseModel):
    knowledge_point: str
    score: Optional[float] = None
    confidence: Optional[float] = None


class PreferenceVectorRequest(BaseModel):
    student_id: str
    vector_data: List[float] = Field(..., min_length=512, max_length=512)


class ProfileResponse(BaseModel):
    student_id: str
    knowledge_mastery: List[KnowledgeMasteryData] = []
    cognitive_style: Optional[CognitiveStyleData] = None
    error_prone_topics: List[ErrorProneTopicData] = []
    active_hours: Dict[str, float] = {}
    learning_rhythm: Dict[str, float] = {}
    metacognitive_calibration: float = 0.0
    attention_feature: float = 0.5
    created_at: Optional[Any] = None
    updated_at: Optional[Any] = None

    class Config:
        from_attributes = True


class ProfileSummaryResponse(BaseModel):
    student_id: str
    cognitive_style: Optional[str] = None
    metacognitive_calibration: float = 0.0
    attention_feature: float = 0.5
    knowledge_point_count: int = 0
    error_prone_topic_count: int = 0

    class Config:
        from_attributes = True
