from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.user import User, UserProfile, UserStatus
from app.schemas.user import (
    UserProfileUpdateRequest,
    UserWithProfileResponse,
    MessageResponse
)
from app.api.dependencies import CurrentUser, get_current_user, get_admin_user
from app.core.security import clear_session_cache

router = APIRouter(prefix="/profile", tags=["Profile"])


@router.get("", response_model=UserWithProfileResponse)
async def get_profile(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == current_user.student_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    return user


@router.put("", response_model=UserWithProfileResponse)
async def update_profile(
    request: UserProfileUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == current_user.student_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )

    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.student_id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.student_id)
        db.add(profile)

    if request.full_name is not None:
        profile.full_name = request.full_name
    if request.university is not None:
        profile.university = request.university
    if request.major is not None:
        profile.major = request.major
    if request.grade is not None:
        profile.grade = request.grade
    if request.learning_goal is not None:
        profile.learning_goal = request.learning_goal
    if request.avatar_url is not None:
        profile.avatar_url = request.avatar_url

    db.commit()
    db.refresh(user)
    return user


@router.delete("/account", response_model=MessageResponse)
async def delete_account(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == current_user.student_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )

    db.delete(user)
    db.commit()

    clear_session_cache(current_user.student_id)

    return MessageResponse(message="账号已删除")


@router.get("/users", response_model=List[UserWithProfileResponse])
async def list_all_users(
    current_user: CurrentUser = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    users = db.query(User).filter(User.status != UserStatus.DELETED.value).all()
    return users


@router.delete("/users/{user_id}", response_model=MessageResponse)
async def delete_user_by_admin(
    user_id: str,
    current_user: CurrentUser = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )

    if user.id == current_user.student_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能删除自己"
        )

    db.delete(user)
    db.commit()

    clear_session_cache(user_id)

    return MessageResponse(message=f"用户 {user.username} 已删除。")
