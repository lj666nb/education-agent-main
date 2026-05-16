from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer, Boolean, JSON
from sqlalchemy.orm import relationship
from app.db.database import Base
import uuid


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(100), primary_key=True)
    user_id = Column(String(100), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)

    prompts = relationship("ProjectPrompt", back_populates="project", cascade="all, delete-orphan")
    documents = relationship("ProjectDocument", back_populates="project", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="project")


class ProjectPrompt(Base):
    __tablename__ = "project_prompts"

    id = Column(String(100), primary_key=True)
    project_id = Column(String(100), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)
    order = Column(Integer, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)

    project = relationship("Project", back_populates="prompts")


class ProjectDocument(Base):
    __tablename__ = "project_documents"

    id = Column(String(100), primary_key=True)
    project_id = Column(String(100), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(500), nullable=False)
    file_type = Column(String(255), nullable=True)
    file_size = Column(Integer, nullable=True)
    content_text = Column(Text, nullable=True)
    chunk_count = Column(Integer, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.now)

    project = relationship("Project", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String(100), primary_key=True)
    document_id = Column(String(100), ForeignKey("project_documents.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    chunk_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)

    document = relationship("ProjectDocument", back_populates="chunks")