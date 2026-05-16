from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from uuid import UUID
from datetime import datetime
import re


class UserRegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="用户名，3-50位字母、数字或下划线")
    password: str = Field(..., min_length=6, max_length=100, description="密码，至少6位")
    email: Optional[EmailStr] = Field(None, description="邮箱（选填）")
    major: str = Field(..., min_length=1, max_length=200, description="专业")

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9_]+$", v):
            raise ValueError("用户名仅支持字母、数字和下划线")
        if len(v) < 3:
            raise ValueError("用户名长度3-50位")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("密码长度至少6位")
        return v


class UserLoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class UserProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(None, max_length=100)
    university: Optional[str] = Field(None, max_length=200)
    major: Optional[str] = Field(None, max_length=200)
    grade: Optional[str] = Field(None, max_length=50)
    learning_goal: Optional[str] = None
    avatar_url: Optional[str] = Field(None, max_length=500)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: UUID
    username: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserProfileResponse(BaseModel):
    user_id: UUID
    full_name: Optional[str] = None
    university: Optional[str] = None
    major: str
    grade: Optional[str] = None
    learning_goal: Optional[str] = None
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class UserWithProfileResponse(BaseModel):
    id: UUID
    username: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str
    status: str
    created_at: datetime
    updated_at: datetime
    profile: Optional[UserProfileResponse] = None

    class Config:
        from_attributes = True


class RegisterResponse(BaseModel):
    student_id: UUID
    username: str
    message: str


class MessageResponse(BaseModel):
    message: str
