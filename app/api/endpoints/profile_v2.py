from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.db.database import get_db
from app.api.dependencies import CurrentUser, get_current_user, get_admin_user
from app.crud.profile import ProfileCRUD, get_profile_crud
from app.models.profile import (
    ProfileCreateRequest,
    ProfileUpdateRequest,
    KnowledgeMasteryUpdateRequest,
    PreferenceVectorRequest,
    ProfileResponse,
    ProfileSummaryResponse,
    CognitiveStyleType
)
from pydantic import BaseModel, Field


router = APIRouter(prefix="/profile/v2", tags=["Profile V2"])


class MessageResponse(BaseModel):
    message: str


class BehaviorEventRequest(BaseModel):
    event_type: str
    event_data: dict = Field(default_factory=dict)


class ErrorProneTopicRequest(BaseModel):
    topic: str
    error_count: int = 1


class KnowledgePointRequest(BaseModel):
    knowledge_point: str
    score: float = 0.0
    confidence: float = 0.3


class CreateProfileRequest(BaseModel):
    cognitive_style: Optional[CognitiveStyleType] = None
    cognitive_style_confidence: float = 0.5
    active_hours: Optional[dict] = None
    learning_rhythm_scalar: float = 0.5
    learning_rhythm_trend: float = 0.0
    metacognitive_calibration: float = 0.0
    attention_feature: float = 0.5
    knowledge_points: Optional[List[KnowledgePointRequest]] = None


class UpdateProfileRequest(BaseModel):
    cognitive_style: Optional[CognitiveStyleType] = None
    cognitive_style_confidence: Optional[float] = None
    active_hours: Optional[dict] = None
    learning_rhythm_scalar: Optional[float] = None
    learning_rhythm_trend: Optional[float] = None
    metacognitive_calibration: Optional[float] = None
    attention_feature: Optional[float] = None


class KnowledgeMasteryUpdateRequestV2(BaseModel):
    knowledge_point: str
    score: Optional[float] = None
    confidence: Optional[float] = None


@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def create_profile(
    request: CreateProfileRequest,
    current_user: CurrentUser = Depends(get_current_user),
    crud: ProfileCRUD = Depends(get_profile_crud)
):
    profile_request = ProfileCreateRequest(
        student_id=str(current_user.student_id),
        cognitive_style=request.cognitive_style,
        cognitive_style_confidence=request.cognitive_style_confidence,
        active_hours=request.active_hours,
        learning_rhythm_scalar=request.learning_rhythm_scalar,
        learning_rhythm_trend=request.learning_rhythm_trend,
        metacognitive_calibration=request.metacognitive_calibration,
        attention_feature=request.attention_feature,
        knowledge_points=[kp.model_dump() for kp in request.knowledge_points] if request.knowledge_points else None
    )

    success = crud.create_profile(profile_request)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建画像失败"
        )

    return MessageResponse(message="画像创建成功")


@router.get("", response_model=ProfileResponse)
async def get_profile(
    current_user: CurrentUser = Depends(get_current_user),
    crud: ProfileCRUD = Depends(get_profile_crud)
):
    profile = crud.get_profile(str(current_user.student_id))
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="画像不存在，请先创建"
        )
    return profile


@router.get("/summary", response_model=ProfileSummaryResponse)
async def get_profile_summary(
    current_user: CurrentUser = Depends(get_current_user),
    crud: ProfileCRUD = Depends(get_profile_crud)
):
    summary = crud.get_profile_summary(str(current_user.student_id))
    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="画像不存在"
        )
    return summary


@router.put("", response_model=MessageResponse)
async def update_profile(
    request: UpdateProfileRequest,
    current_user: CurrentUser = Depends(get_current_user),
    crud: ProfileCRUD = Depends(get_profile_crud)
):
    profile_request = ProfileUpdateRequest(
        cognitive_style=request.cognitive_style,
        cognitive_style_confidence=request.cognitive_style_confidence,
        active_hours=request.active_hours,
        learning_rhythm_scalar=request.learning_rhythm_scalar,
        learning_rhythm_trend=request.learning_rhythm_trend,
        metacognitive_calibration=request.metacognitive_calibration,
        attention_feature=request.attention_feature
    )

    success = crud.update_profile(str(current_user.student_id), profile_request)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新画像失败"
        )

    return MessageResponse(message="画像更新成功")


@router.post("/knowledge", response_model=MessageResponse)
async def add_knowledge_mastery(
    request: KnowledgePointRequest,
    current_user: CurrentUser = Depends(get_current_user),
    crud: ProfileCRUD = Depends(get_profile_crud)
):
    success = crud.add_knowledge_mastery(
        str(current_user.student_id),
        request.knowledge_point,
        request.score,
        request.confidence
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="添加知识点失败"
        )

    return MessageResponse(message="知识点添加成功")


@router.put("/knowledge", response_model=MessageResponse)
async def update_knowledge_mastery(
    request: KnowledgeMasteryUpdateRequestV2,
    current_user: CurrentUser = Depends(get_current_user),
    crud: ProfileCRUD = Depends(get_profile_crud)
):
    update_request = KnowledgeMasteryUpdateRequest(
        knowledge_point=request.knowledge_point,
        score=request.score,
        confidence=request.confidence
    )

    success = crud.update_knowledge_mastery(str(current_user.student_id), update_request)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新知识点失败"
        )

    return MessageResponse(message="知识点更新成功")


@router.delete("/knowledge/{knowledge_point}", response_model=MessageResponse)
async def delete_knowledge_mastery(
    knowledge_point: str,
    current_user: CurrentUser = Depends(get_current_user),
    crud: ProfileCRUD = Depends(get_profile_crud)
):
    success = crud.delete_knowledge_mastery(str(current_user.student_id), knowledge_point)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="知识点不存在"
        )

    return MessageResponse(message="知识点删除成功")


@router.post("/error-prone", response_model=MessageResponse)
async def add_error_prone_topic(
    request: ErrorProneTopicRequest,
    current_user: CurrentUser = Depends(get_current_user),
    crud: ProfileCRUD = Depends(get_profile_crud)
):
    success = crud.add_error_prone_topic(
        str(current_user.student_id),
        request.topic,
        request.error_count
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="添加易错点失败"
        )

    return MessageResponse(message="易错点添加成功")


@router.post("/behavior", response_model=MessageResponse)
async def record_behavior_event(
    request: BehaviorEventRequest,
    current_user: CurrentUser = Depends(get_current_user),
    crud: ProfileCRUD = Depends(get_profile_crud)
):
    success = crud.record_behavior_event(
        str(current_user.student_id),
        request.event_type,
        request.event_data
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="记录行为事件失败"
        )

    return MessageResponse(message="行为事件记录成功")


@router.get("/timeline")
async def get_timeline(
    limit: int = Query(default=50, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
    current_user: CurrentUser = Depends(get_current_user),
    crud: ProfileCRUD = Depends(get_profile_crud)
):
    timeline = crud.get_timeline(str(current_user.student_id), limit, skip)
    return {"events": timeline}


@router.get("/behavior")
async def get_behavior_events(
    event_type: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=500),
    skip: int = Query(default=0, ge=0),
    current_user: CurrentUser = Depends(get_current_user),
    crud: ProfileCRUD = Depends(get_profile_crud)
):
    events = crud.get_behavior_events(
        str(current_user.student_id),
        event_type,
        limit,
        skip
    )
    return {"events": events}


@router.delete("", response_model=MessageResponse)
async def delete_profile(
    current_user: CurrentUser = Depends(get_current_user),
    crud: ProfileCRUD = Depends(get_profile_crud)
):
    success = crud.delete_profile(str(current_user.student_id))
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除画像失败"
        )

    return MessageResponse(message="画像删除成功")
