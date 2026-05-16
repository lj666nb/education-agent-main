from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ProjectResponse(ProjectBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    prompt_count: int = 0
    document_count: int = 0

    class Config:
        from_attributes = True


class PromptBase(BaseModel):
    name: str
    content: str
    is_active: bool = True
    order: int = 0


class PromptCreate(PromptBase):
    pass


class PromptUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    is_active: Optional[bool] = None
    order: Optional[int] = None


class PromptResponse(PromptBase):
    id: str
    project_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentBase(BaseModel):
    name: str
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    content_text: Optional[str] = None


class DocumentCreate(DocumentBase):
    pass


class DocumentResponse(DocumentBase):
    id: str
    project_id: str
    chunk_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class ChunkResponse(BaseModel):
    id: str
    content: str
    chunk_index: int
    chunk_metadata: Optional[dict] = None

    class Config:
        from_attributes = True


class RetrievalRequest(BaseModel):
    query: str
    top_k: int = 5
    alpha: float = 0.7


class RetrievalResponse(BaseModel):
    chunks: List[dict]
    query: str