"""Draw.io XML → PNG 渲染服务

将 draw.io 格式的 XML 图表渲染为 PNG 图片。
优先级：本地 Playwright > 远程 API > 返回原始 XML
"""

from __future__ import annotations

import logging
import os
import subprocess
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

# 缓存的渲染输出目录，需要在 app 目录内以便 Docker 卷挂载
OUTPUT_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "drawio"


def _render_via_playwright(xml: str) -> bytes | None:
    """使用 Playwright + headless Chromium 渲染 draw.io XML → PNG"""
    try:
        # 检查 playwright 是否可用
        result = subprocess.run(
            ["python", "-c", "from playwright.sync_api import sync_playwright; print('ok')"],
            capture_output=True, text=True, timeout=10
        )
        if "ok" not in result.stdout:
            logger.info("[drawio-export] Playwright 未安装，跳过")
            return None
    except Exception:
        logger.info("[drawio-export] 无法检测 Playwright")
        return None

    # 创建临时 HTML 文件：嵌入 draw.io viewer 并自动导出
    html_content = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<script>
// 将 XML 嵌入页面，用 draw.io viewer 渲染后导出
const xml = {__import__('json').dumps(xml)};
// 使用 postMessage 触发导出
window.onload = function() {{
    // 构建 viewer URL
    const encoded = btoa(unescape(encodeURIComponent(xml)));
    const url = 'https://viewer.diagrams.net/?lightbox=1&edit=_blank#R' + encoded;
    window.location.href = url;
}};
</script>
</body>
</html>"""

    with tempfile.NamedTemporaryFile(suffix=".html", mode="w", encoding="utf-8", delete=False) as f:
        f.write(html_content)
        html_path = f.name

    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1200, "height": 800})
            page.goto(f"file:///{html_path}", wait_until="networkidle", timeout=30000)
            # 等待 draw.io 加载
            page.wait_for_timeout(5000)
            # 截图
            screenshot = page.screenshot(full_page=True, type="png")
            browser.close()
            return screenshot
    except Exception as e:
        logger.error(f"[drawio-export] Playwright 渲染失败: {e}")
        return None
    finally:
        try:
            os.unlink(html_path)
        except OSError:
            pass


def render_drawio_to_png(xml: str) -> bytes | None:
    """将 draw.io XML 渲染为 PNG 字节数据

    尝试顺序：
    1. 本地 Playwright (headless Chromium)
    2. （未来可扩展远程 API）
    3. 返回 None（调用方应保留原始 [DRAWIO] 标记）
    """
    # 确保输出目录存在
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # 方法 1：Playwright
    png = _render_via_playwright(xml)
    if png and len(png) > 500:
        logger.info(f"[drawio-export] Playwright 渲染成功: {len(png)} bytes")
        return png

    # 所有方法失败
    logger.warning("[drawio-export] 所有渲染方法均失败，保留原始 XML")
    return None


def save_drawio_png(xml: str) -> tuple[str | None, str | None]:
    """渲染并保存 draw.io XML 为 PNG 文件

    Returns:
        (png_url, xml_path) — png_url 为前端可访问的 URL 路径，xml_path 为原始 XML 文件路径
    """
    import uuid

    drawio_id = uuid.uuid4().hex[:12]
    png_filename = f"drawio_{drawio_id}.png"
    xml_filename = f"drawio_{drawio_id}.xml"

    # 保存原始 XML
    xml_path = OUTPUT_DIR / xml_filename
    with open(xml_path, "w", encoding="utf-8") as f:
        f.write(xml)

    # 渲染 PNG
    png_bytes = render_drawio_to_png(xml)
    if png_bytes:
        png_path = OUTPUT_DIR / png_filename
        with open(png_path, "wb") as f:
            f.write(png_bytes)
        url = f"/api/v1/chat/drawio/{png_filename}"
        return url, str(xml_path)

    return None, str(xml_path)
