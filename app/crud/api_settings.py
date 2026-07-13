from sqlalchemy.orm import Session
from typing import Optional, List, Dict
from app.models.api_settings import ApiSettings
from app.schemas.api_settings import ApiSettingCreate
import httpx
import logging

logger = logging.getLogger(__name__)


class ApiSettingsCRUD:
    PROVIDERS = ["deepseek", "qwen", "bailian", "ocr", "tavily", "text_embedding", "tts", "unsplash"]

    # 每个 provider 的实际验证端点
    VALIDATION_CONFIG = {
        "deepseek": {
            "url": "https://api.deepseek.com/v1/models",
            "method": "GET",
            "auth_header": "Authorization",
            "auth_template": "Bearer {api_key}",
            "expected_status": [200],
        },
        "qwen": {
            "url": "https://dashscope.aliyuncs.com/compatible-mode/v1/models",
            "method": "GET",
            "auth_header": "Authorization",
            "auth_template": "Bearer {api_key}",
            "expected_status": [200],
        },
        "bailian": {
            "url": "https://dashscope.aliyuncs.com/compatible-mode/v1/models",
            "method": "GET",
            "auth_header": "Authorization",
            "auth_template": "Bearer {api_key}",
            "expected_status": [200],
        },
        "ocr": {
            "url": "https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id={api_key}&client_secret={secret_key}",
            "method": "POST",
            "auth_header": None,
            "auth_template": None,
            "expected_status": [200],
            "optional_secret": True,
        },
        "tavily": {
            "url": "https://api.tavily.com/search",
            "method": "POST",
            "auth_header": "Authorization",
            "auth_template": "Bearer {api_key}",
            "expected_status": [200],
            "validate_body": {"query": "test", "max_results": 1},
        },
        "unsplash": {
            "url": None,
            "format_check": lambda k: len(k) > 8,
        },
        "text_embedding": {
            "url": "https://dashscope.aliyuncs.com/compatible-mode/v1/models",
            "method": "GET",
            "auth_header": "Authorization",
            "auth_template": "Bearer {api_key}",
            "expected_status": [200],
        },
        "tts": {
            "url": "https://dashscope.aliyuncs.com/compatible-mode/v1/models",
            "method": "GET",
            "auth_header": "Authorization",
            "auth_template": "Bearer {api_key}",
            "expected_status": [200],
        },
    }

    def get_setting(self, db: Session, user_id: str, provider: str) -> Optional[ApiSettings]:
        return db.query(ApiSettings).filter(
            ApiSettings.user_id == user_id,
            ApiSettings.provider == provider
        ).first()

    def get_setting_value(self, db: Session, user_id: str, provider: str) -> Optional[dict]:
        user_setting = self.get_setting(db, user_id, provider)
        if user_setting and user_setting.api_key and user_setting.is_enabled:
            return {
                "api_key": user_setting.api_key,
                "secret_key": getattr(user_setting, 'secret_key', None),
                "base_url": user_setting.base_url,
                "model_version": getattr(user_setting, 'model_version', None),
            }
        return None

    def is_provider_available(self, db: Session, user_id: str, provider: str) -> bool:
        """检查 provider 是否可用（Key 存在即认为可用，因为保存时已验证过有效性）"""
        setting = self.get_setting(db, user_id, provider)
        return bool(setting and setting.api_key)

    def validate_provider_key(self, provider: str, api_key: str, secret_key: Optional[str] = None) -> bool:
        """实际验证 API Key 的有效性

        对每个 provider 尝试真正的 API 调用验证 Key 是否可用。
        - deepseek/qwen: GET /v1/models
        - ocr: 尝试获取 access_token
        - 其他: 格式检查（最小长度）
        """
        config = self.VALIDATION_CONFIG.get(provider)
        if not config:
            return bool(api_key and len(api_key) > 8)

        # 有 format_check 的仅做格式校验
        if config.get("format_check"):
            return config["format_check"](api_key)

        # 有 URL 的做实际 HTTP 验证
        url = config.get("url")
        if not url:
            return bool(api_key and len(api_key) > 8)

        try:
            method = config.get("method", "GET")
            auth_template = config.get("auth_template")
            auth_header = config.get("auth_header")

            headers = {}
            if auth_header and auth_template:
                headers[auth_header] = auth_template.format(api_key=api_key)

            formatted_url = url.format(api_key=api_key, secret_key=secret_key or "")

            with httpx.Client(timeout=10.0) as client:
                if method == "GET":
                    resp = client.get(formatted_url, headers=headers)
                else:
                    # POST: support JSON body with API key
                    body = None
                    validate_body = config.get("validate_body")
                    if validate_body:
                        import json
                        body = json.dumps({k: v.format(api_key=api_key, secret_key=secret_key or "") if isinstance(v, str) else v for k, v in validate_body.items()})
                        headers.setdefault("Content-Type", "application/json")
                    resp = client.post(formatted_url, headers=headers, content=body)

                expected = config.get("expected_status", [200])
                is_valid = resp.status_code in expected

                if not is_valid:
                    logger.warning(f"{provider} Key 验证失败: status={resp.status_code}, body={resp.text[:200]}")

                return is_valid

        except httpx.TimeoutException:
            logger.warning(f"{provider} Key 验证超时（网络不可达）")
            return False
        except httpx.ConnectError:
            logger.warning(f"{provider} Key 验证连接失败（URL 可能错误）")
            return False
        except Exception as e:
            logger.warning(f"{provider} Key 验证异常: {e}")
            return False

    def upsert_setting(
        self, db: Session, user_id: str, provider: str, data: ApiSettingCreate
    ) -> ApiSettings:
        existing = self.get_setting(db, user_id, provider)
        if existing:
            existing.api_key = data.api_key
            if data.secret_key is not None:
                existing.secret_key = data.secret_key
            if data.base_url is not None:
                existing.base_url = data.base_url
            if data.model_version is not None:
                existing.model_version = data.model_version
            existing.is_enabled = data.is_enabled
            db.commit()
            db.refresh(existing)
            result = existing
        else:
            new_setting = ApiSettings(
                user_id=user_id,
                provider=provider,
                api_key=data.api_key,
                secret_key=getattr(data, 'secret_key', None),
                base_url=data.base_url,
                model_version=getattr(data, 'model_version', None),
                is_enabled=data.is_enabled,
                is_system=False
            )
            db.add(new_setting)
            db.commit()
            db.refresh(new_setting)
            result = new_setting

        # 当保存 qwen 时，自动同步 text_embedding 和 tts（共享 DashScope API Key）
        if provider == "qwen":
            for cascade_provider in ["text_embedding", "tts"]:
                cascade_existing = self.get_setting(db, user_id, cascade_provider)
                if cascade_existing:
                    cascade_existing.api_key = data.api_key
                    cascade_existing.is_enabled = data.is_enabled
                else:
                    cascade_new = ApiSettings(
                        user_id=user_id,
                        provider=cascade_provider,
                        api_key=data.api_key,
                        is_enabled=data.is_enabled,
                        is_system=False
                    )
                    db.add(cascade_new)
            db.commit()

        return result

    def delete_setting(self, db: Session, user_id: str, provider: str) -> bool:
        setting = self.get_setting(db, user_id, provider)
        if setting:
            db.delete(setting)
            db.commit()
            return True
        return False

    def get_all_settings_info(self, db: Session, user_id: str) -> List[dict]:
        result = []
        for provider in self.PROVIDERS:
            user_setting = self.get_setting(db, user_id, provider)
            has_user_key = bool(user_setting and user_setting.api_key)
            is_enabled = bool(user_setting.is_enabled) if user_setting and user_setting.is_enabled is not None else True
            model_version = user_setting.model_version if user_setting else None

            # Mask the key for list display (show last 4 chars)
            api_key_masked = ""
            secret_key_masked = ""
            if user_setting and user_setting.api_key:
                raw = user_setting.api_key
                if len(raw) > 4:
                    api_key_masked = "****" + raw[-4:]
                else:
                    api_key_masked = "****"
            if user_setting and hasattr(user_setting, 'secret_key') and user_setting.secret_key:
                raw = user_setting.secret_key
                if len(raw) > 4:
                    secret_key_masked = "****" + raw[-4:]
                else:
                    secret_key_masked = "****"

            result.append({
                "provider": provider,
                "is_configured": has_user_key,
                "is_enabled": is_enabled,
                "model_version": model_version,
                "api_key_masked": api_key_masked,
                "secret_key_masked": secret_key_masked,
            })
        return result


api_settings_crud = ApiSettingsCRUD()
