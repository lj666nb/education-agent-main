from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Uuid, Integer
from sqlalchemy.orm import relationship
from app.db.database import Base
import uuid


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String(100), primary_key=True)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(String(100), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(200), nullable=False, default="新对话")
    model = Column(String(50), nullable=False, default="deepseek-v4-flash")
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)
    message_count = Column(Integer, nullable=False, default=0)

    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")
    attachments = relationship("ChatAttachment", back_populates="session", cascade="all, delete-orphan")
    project = relationship("Project", foreign_keys=[project_id])


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id = Column(String(100), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    reasoning_content = Column(Text, nullable=True)
    model = Column(String(50), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.now)

    session = relationship("ChatSession", back_populates="messages")


class ChatAttachment(Base):
    __tablename__ = "chat_attachments"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id = Column(String(100), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    file_id = Column(String(100), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(255), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.now)

    session = relationship("ChatSession", back_populates="attachments")