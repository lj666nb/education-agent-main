"""Unsplash 图片搜索服务

使用官方 Unsplash API 搜索高质量图片。
支持：关键词搜索、随机图片、图片详情获取。
"""

import logging
import httpx
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


class UnsplashService:
    """Unsplash API 封装"""

    def __init__(self, access_key: str = ""):
        self.access_key = access_key

    def _headers(self) -> dict:
        return {
            "Authorization": f"Client-ID {self.access_key}",
            "Accept-Version": "v1",
        }

    async def search_photos(
        self,
        query: str,
        per_page: int = 10,
        orientation: str = "landscape",
    ) -> list[dict]:
        """搜索图片

        Args:
            query: 搜索关键词（中文/英文均可）
            per_page: 每页数量 (1-30)
            orientation: landscape / portrait / squarish

        Returns:
            图片信息列表，每项包含 id, urls, user, description 等
        """
        if not self.access_key:
            logger.warning("UNSPLASH_ACCESS_KEY 未配置，无法搜索图片")
            return []

        url = f"{settings.UNSPLASH_API_BASE}/search/photos"
        params = {
            "query": query,
            "per_page": min(per_page, 30),
            "orientation": orientation,
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url, headers=self._headers(), params=params)
                resp.raise_for_status()
                data = resp.json()
                results = data.get("results", [])
                logger.info(f"Unsplash 搜索 '{query}': 找到 {data.get('total', 0)} 张图片")
                return [
                    {
                        "id": img["id"],
                        "description": img.get("description") or img.get("alt_description") or "",
                        "url_raw": img["urls"]["raw"],
                        "url_full": img["urls"]["full"],
                        "url_regular": img["urls"]["regular"],
                        "url_small": img["urls"]["small"],
                        "url_thumb": img["urls"]["thumb"],
                        "author": img["user"]["name"],
                        "author_link": img["user"]["links"]["html"],
                        "width": img["width"],
                        "height": img["height"],
                        "download_location": img["links"]["download_location"],
                    }
                    for img in results
                ]
        except httpx.HTTPStatusError as e:
            logger.error(f"Unsplash API HTTP 错误: {e.response.status_code} {e.response.text}")
            return []
        except httpx.RequestError as e:
            logger.error(f"Unsplash API 请求失败: {e}")
            return []
        except Exception as e:
            logger.error(f"Unsplash 搜索异常: {e}")
            return []

    async def get_random_photo(
        self,
        query: Optional[str] = None,
        orientation: str = "landscape",
    ) -> Optional[dict]:
        """获取随机图片

        Args:
            query: 可选，按关键词筛选
            orientation: landscape / portrait / squarish

        Returns:
            单张图片信息，或 None
        """
        if not self.access_key:
            return None

        url = f"{UNSPLASH_API_BASE}/photos/random"
        params = {"orientation": orientation}
        if query:
            params["query"] = query

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url, headers=self._headers(), params=params)
                resp.raise_for_status()
                img = resp.json()
                return {
                    "id": img["id"],
                    "description": img.get("description") or img.get("alt_description") or "",
                    "url_raw": img["urls"]["raw"],
                    "url_full": img["urls"]["full"],
                    "url_regular": img["urls"]["regular"],
                    "url_small": img["urls"]["small"],
                    "url_thumb": img["urls"]["thumb"],
                    "author": img["user"]["name"],
                    "author_link": img["user"]["links"]["html"],
                    "width": img["width"],
                    "height": img["height"],
                    "download_location": img["links"]["download_location"],
                }
        except Exception as e:
            logger.error(f"Unsplash 随机图片获取失败: {e}")
            return None

    def search_photos_sync(
        self,
        query: str,
        per_page: int = 10,
        orientation: str = "landscape",
    ) -> list[dict]:
        """同步版搜索（用于非异步上下文）"""
        import requests

        if not self.access_key:
            return []

        url = f"{UNSPLASH_API_BASE}/search/photos"
        params = {
            "query": query,
            "per_page": min(per_page, 30),
            "orientation": orientation,
        }

        try:
            resp = requests.get(url, headers=self._headers(), params=params, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            return [
                {
                    "id": img["id"],
                    "description": img.get("description") or img.get("alt_description") or "",
                    "url_raw": img["urls"]["raw"],
                    "url_full": img["urls"]["full"],
                    "url_regular": img["urls"]["regular"],
                    "url_small": img["urls"]["small"],
                    "url_thumb": img["urls"]["thumb"],
                    "author": img["user"]["name"],
                    "author_link": img["user"]["links"]["html"],
                    "width": img["width"],
                    "height": img["height"],
                    "download_location": img["links"]["download_location"],
                }
                for img in data.get("results", [])
            ]
        except Exception as e:
            logger.error(f"Unsplash 同步搜索失败: {e}")
            return []

    async def track_download(self, download_location: str) -> bool:
        """跟踪下载（Unsplash API 要求：使用图片时必须调用）"""
        if not download_location:
            return False
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(download_location, headers=self._headers())
                return resp.status_code == 200
        except Exception:
            return False
