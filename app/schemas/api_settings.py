from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class ApiSettingCreate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    provider: str = Field(..., description="API provider: deepseek, qwen, ocr, websearch, text_embedding")
    api_key: str = Field(..., description="API key")
    secret_key: Optional[str] = Field(None, description="Secret key (required for OCR)")
    base_url: Optional[str] = Field(None, description="Custom base URL (optional)")
    model_version: Optional[str] = Field(None, description="Model version for text-embedding: v1, v2, v3")
    is_enabled: bool = Field(True, description="Whether this API is enabled")


class ApiSettingUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    api_key: Optional[str] = None
    secret_key: Optional[str] = None
    base_url: Optional[str] = None
    model_version: Optional[str] = None
    is_enabled: Optional[bool] = None


class ApiSettingResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=(), from_attributes=True)

    id: UUID
    user_id: UUID
    provider: str
    api_key: str
    secret_key: Optional[str] = None
    base_url: Optional[str]
    model_version: Optional[str] = None
    is_enabled: bool
    is_system: bool
    created_at: datetime
    updated_at: datetime


class ApiSettingInfo(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    provider: str
    is_configured: bool
    is_enabled: bool
    model_version: Optional[str] = None


class ApiSettingListResponse(BaseModel):
    settings: List[ApiSettingInfo]
