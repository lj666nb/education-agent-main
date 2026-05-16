import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Uuid
from sqlalchemy.orm import relationship
from app.db.database import Base
import enum


class UserRole(str, enum.Enum):
    STUDENT = "student"
    ADMIN = "admin"


class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DELETED = "deleted"


class User(Base):
    __tablename__ = "users"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    email = Column(String(100), unique=True, nullable=True, index=True)
    phone = Column(String(20), nullable=True)
    role = Column(String(20), nullable=False, default=UserRole.STUDENT.value)
    status = Column(String(20), nullable=False, default=UserStatus.ACTIVE.value)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    full_name = Column(String(100), nullable=True)
    university = Column(String(200), nullable=True)
    major = Column(String(200), nullable=False)
    grade = Column(String(50), nullable=True)
    learning_goal = Column(Text, nullable=True)
    avatar_url = Column(String(500), nullable=True)

    user = relationship("User", back_populates="profile")
