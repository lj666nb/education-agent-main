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

SUPPORTED_PROVIDERS = ["deepseek", "qwen", "bailian", "ocr", "tavily", "text_embedding", "tts", "unsplash"]


PROVIDER_MODEL_MAP = {
    "deepseek": ["deepseek-v4-flash", "deepseek-v4-pro"],
    "qwen": ["qwen3.5-plus", "qwen3.6-plus"],
    "bailian": ["qwen3.5-plus", "qwen3.6-plus"],
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

    # 如果用户提交的是 masked key（"****..."），保留现有 key
    is_masked = request.api_key.startswith("****")

    if not is_masked and (not request.api_key or not request.api_key.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API Key 不能为空"
        )
    if request.provider == "ocr" and not request.secret_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OCR API 需要 Secret Key"
        )

    # 如果用户提交的是 masked key，保留现有 key 不变
    if is_masked:
        existing = api_settings_crud.get_setting(db, str(current_user.student_id), request.provider)
        if existing and existing.api_key:
            request.api_key = existing.api_key
            request.secret_key = getattr(existing, 'secret_key', None) or request.secret_key
        # 不验证 masked key（因为是已有 key）

    # 保存前实时验证 Key 是否有效（仅对新 key 或显式修改的 key 验证）
    should_validate = not is_masked
    if should_validate:
        is_valid = api_settings_crud.validate_provider_key(
            request.provider, request.api_key, request.secret_key
        )
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{request.provider} API Key 验证失败，请检查 Key 是否正确或是否已过期"
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


@router.post("/validate")
async def validate_api_setting(
    request: ApiSettingCreate,
    current_user: CurrentUser = Depends(get_current_user),
):
    """验证 API Key 是否真正可用（发起实际 API 调用测试）"""
    if request.provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"不支持的 provider: {request.provider}")

    is_valid = api_settings_crud.validate_provider_key(
        request.provider, request.api_key, request.secret_key
    )
    return {"provider": request.provider, "is_valid": is_valid, "message": "API Key 有效" if is_valid else "API Key 无效，请检查"}


@router.post("/validate-all")
async def validate_all_api_settings(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """重新验证当前用户所有已配置的 API Key"""
    results = {}
    for provider in SUPPORTED_PROVIDERS:
        setting = api_settings_crud.get_setting(db, str(current_user.student_id), provider)
        if setting and setting.api_key:
            is_valid = api_settings_crud.validate_provider_key(
                provider, setting.api_key, getattr(setting, 'secret_key', None)
            )
            results[provider] = {"is_valid": is_valid, "has_key": True}
        else:
            results[provider] = {"is_valid": False, "has_key": False}
    return {"results": results}


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
    """获取当前用户可用的模型列表。

    可用性判断优先级：
    1. 系统全局配置（settings.DEEPSEEK_API_KEY / settings.QWEN_API_KEY）
    2. 用户个人配置（ApiSettings 表）
    """
    from app.core.config import settings

    user_id = str(current_user.student_id)
    available = []
    unavailable = []

    # 检查系统全局配置
    env_keys = {
        "deepseek": settings.DEEPSEEK_API_KEY,
        "qwen": settings.QWEN_API_KEY,
    }

    for provider, models in PROVIDER_MODEL_MAP.items():
        # 优先检查全局 .env 配置
        has_env_key = bool(env_keys.get(provider))
        if has_env_key:
            is_available = True
        else:
            # 其次检查用户个人配置
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
