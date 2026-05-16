import base64
import requests
from typing import Optional
from app.core.config import settings


class OCRService:
    def __init__(self, api_key: str, secret_key: str):
        self.api_key = api_key
        self.secret_key = secret_key
        self.access_token: Optional[str] = None

    def get_access_token(self) -> str:
        token_url = "https://aip.baidubce.com/oauth/2.0/token"
        params = {
            "grant_type": "client_credentials",
            "client_id": self.api_key,
            "client_secret": self.secret_key
        }
        response = requests.get(token_url, params=params)
        result = response.json()
        if "access_token" in result:
            self.access_token = result["access_token"]
            return self.access_token
        raise Exception(f"获取Access Token失败: {result.get('error_description', '未知错误')}")

    def recognize_text(self, image_base64: str) -> dict:
        if not self.access_token:
            self.get_access_token()

        request_url = "https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic"
        params = {
            "access_token": self.access_token,
            "image": image_base64
        }
        headers = {'Content-Type': 'application/x-www-form-urlencoded'}

        response = requests.post(request_url, data=params, headers=headers)
        result = response.json()

        if "error_code" in result:
            error_msg = result.get("error_msg", "未知错误")
            if result["error_code"] == 110:
                self.access_token = None
                self.get_access_token()
                return self.recognize_text(image_base64)
            raise Exception(f"OCR识别失败 [{result['error_code']}]: {error_msg}")

        return result


def get_ocr_service(user_id: str) -> Optional[OCRService]:
    from app.crud.api_settings import api_settings_crud
    from app.db.database import SessionLocal

    db = SessionLocal()
    try:
        setting = api_settings_crud.get_setting(db, user_id, "ocr")
        if setting and setting.api_key and setting.secret_key:
            return OCRService(setting.api_key, setting.secret_key)
        return None
    finally:
        db.close()
