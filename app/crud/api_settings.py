from sqlalchemy.orm import Session
from typing import Optional, List
from app.models.api_settings import ApiSettings
from app.schemas.api_settings import ApiSettingCreate


class ApiSettingsCRUD:
    PROVIDERS = ["deepseek", "qwen", "ocr", "websearch", "text_embedding"]

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
        setting = self.get_setting(db, user_id, provider)
        return bool(setting and setting.api_key)

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
            return existing
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
            return new_setting

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
            result.append({
                "provider": provider,
                "is_configured": has_user_key,
                "is_enabled": is_enabled,
                "model_version": model_version,
            })
        return result


api_settings_crud = ApiSettingsCRUD()
