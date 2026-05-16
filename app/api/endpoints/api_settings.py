from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.api.dependencies import CurrentUser, get_current_user
from app.schemas.api_settings import (
    ApiSettingCreate,
    ApiSettingUpdate,
    ApiSettingResponse,
    ApiSettingInfo,
    ApiSettingListResponse,
)
from app.crud.api_settings import api_settings_crud

router = APIRouter(prefix="/api-settings", tags=["API 设置"])

SUPPORTED_PROVIDERS = ["deepseek", "qwen", "ocr", "websearch", "text_embedding"]


PROVIDER_MODEL_MAP = {
    "deepseek": ["deepseek-v4-flash", "deepseek-v4-pro"],
    "qwen": ["qwen3.5-plus", "qwen3.6-plus"],
}


@router.get("/", response_model=ApiSettingListResponse)
async def get_api_settings(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    settings_info = api_settings_crud.get_all_settings_info(db, str(current_user.student_id))
    return ApiSettingListResponse(settings=[ApiSettingInfo(**s) for s in settings_info])


@router.post("/", response_model=ApiSettingResponse)
async def save_api_setting(
    request: ApiSettingCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if request.provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的 provider: {request.provider}，支持的类型: {SUPPORTED_PROVIDERS}"
        )
    if not request.api_key or not request.api_key.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API Key 不能为空"
        )
    if request.provider == "ocr" and not request.secret_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OCR API 需要 Secret Key"
        )
    setting = api_settings_crud.upsert_setting(
        db, str(current_user.student_id), request.provider, request
    )
    return setting


@router.get("/{provider}", response_model=ApiSettingResponse)
async def get_api_setting(
    provider: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    setting = api_settings_crud.get_setting(db, str(current_user.student_id), provider)
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"未找到 {provider} 的 API 配置"
        )
    return setting


@router.delete("/{provider}")
async def delete_api_setting(
    provider: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    success = api_settings_crud.delete_setting(db, str(current_user.student_id), provider)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"未找到 {provider} 的 API 配置"
        )
    return {"message": f"{provider} API 配置已删除"}


@router.get("/available/models")
async def get_available_models(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = str(current_user.student_id)
    available = []
    unavailable = []
    for provider, models in PROVIDER_MODEL_MAP.items():
        is_available = api_settings_crud.is_provider_available(db, user_id, provider)
        for model in models:
            if is_available:
                available.append(model)
            else:
                unavailable.append(model)
    return {
        "available": available,
        "unavailable": unavailable,
        "all": list(PROVIDER_MODEL_MAP.keys())
    }
