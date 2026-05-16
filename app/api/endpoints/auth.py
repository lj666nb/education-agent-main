from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime

from app.db.database import get_db
from app.models.user import User, UserProfile
from app.models.user import UserStatus, UserRole
from app.schemas.user import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    RegisterResponse,
    MessageResponse
)
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    check_login_failure,
    increment_login_failure,
    clear_login_failure,
    init_session_cache
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(request: UserRegisterRequest, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.username == request.username).first()
    if existing_user:
        if existing_user.status == UserStatus.DELETED.value:
            existing_user.password_hash = get_password_hash(request.password)
            existing_user.email = request.email
            existing_user.status = UserStatus.ACTIVE.value
            existing_user.role = UserRole.STUDENT.value
            existing_user.created_at = datetime.utcnow()
            existing_user.updated_at = datetime.utcnow()

            if existing_user.profile:
                existing_user.profile.major = request.major
            else:
                user_profile = UserProfile(
                    user_id=existing_user.id,
                    major=request.major
                )
                db.add(user_profile)

            db.commit()
            db.refresh(existing_user)

            access_token = create_access_token(subject=existing_user.id, role=existing_user.role)
            refresh_token = create_refresh_token(subject=existing_user.id)
            init_session_cache(existing_user.id)

            return RegisterResponse(
                student_id=existing_user.id,
                username=existing_user.username,
                message="账号已重新激活"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该用户名已被注册，请使用其他用户名"
            )

    if request.email:
        existing_email = db.query(User).filter(User.email == request.email).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该邮箱已被注册，可使用邮箱登录"
            )

    user = User(
        username=request.username,
        password_hash=get_password_hash(request.password),
        email=request.email,
        role=UserRole.STUDENT.value,
        status=UserStatus.ACTIVE.value
    )
    db.add(user)
    db.flush()

    user_profile = UserProfile(
        user_id=user.id,
        major=request.major
    )
    db.add(user_profile)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(subject=user.id, role=user.role)
    refresh_token = create_refresh_token(subject=user.id)

    init_session_cache(user.id)

    return RegisterResponse(
        student_id=user.id,
        username=user.username,
        message="用户注册成功"
    )


@router.post("/login", response_model=TokenResponse)
async def login(request: UserLoginRequest, db: Session = Depends(get_db)):
    is_locked, failure_count = check_login_failure(request.username)
    if is_locked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="登录失败次数过多，账号已锁定。请15分钟后重试"
        )

    user = db.query(User).filter(User.username == request.username).first()
    if not user:
        increment_login_failure(request.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="该账号未注册，请先注册"
        )

    if not verify_password(request.password, user.password_hash):
        increment_login_failure(request.username)
        remaining = 4 - failure_count
        if remaining > 0:
            if remaining == 1:
                detail = "密码错误，这是最后一次尝试机会"
            else:
                detail = f"密码错误，还可以尝试{remaining}次"
        else:
            detail = "登录失败次数过多，账号已锁定。请15分钟后重试"
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail
        )

    if user.status == UserStatus.DELETED.value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="该账号未注册，请先注册"
        )

    if user.status == UserStatus.SUSPENDED.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户账号已停用，请联系管理员"
        )

    clear_login_failure(request.username)

    access_token = create_access_token(subject=user.id, role=user.role)
    refresh_token = create_refresh_token(subject=user.id)

    init_session_cache(user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(refresh_token: str, db: Session = Depends(get_db)):
    from app.core.security import decode_token

    payload = decode_token(refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="刷新令牌无效"
        )

    student_id = payload.get("sub")
    user = db.query(User).filter(User.id == UUID(student_id)).first()

    if user is None or user.status != UserStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户无效或账号未激活"
        )

    access_token = create_access_token(subject=user.id, role=user.role)
    new_refresh_token = create_refresh_token(subject=user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token
    )
