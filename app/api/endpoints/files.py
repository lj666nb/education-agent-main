import os
import uuid
import base64
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.api.dependencies import CurrentUser, get_current_user

router = APIRouter(prefix="/files", tags=["文件管理"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")

    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.pdf', '.pptx', '.ppt', '.docx', '.doc']:
        raise HTTPException(status_code=400, detail="不支持的文件类型，仅支持图片、PDF、PPT和Word文件")

    content = await file.read()

    MAX_FILE_SIZE = 50 * 1024 * 1024
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="文件过大，单个文件不能超过 50MB，请压缩后重新上传")

    file_id = str(uuid.uuid4())
    filename = f"{file_id}{file_ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    async with aiofiles.open(filepath, 'wb') as f:
        await f.write(content)

    return {
        "file_id": file_id,
        "filename": filename,
        "original_name": file.filename,
        "url": f"/api/v1/files/{file_id}/download"
    }


@router.get("/{file_id}/info")
async def get_file_info(
    file_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    for ext in ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.pdf', '.pptx', '.ppt', '.docx', '.doc']:
        filepath = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")
        if os.path.exists(filepath):
            with open(filepath, 'rb') as f:
                content = f.read()

            is_image = ext in ['.png', '.jpg', '.jpeg', '.gif', '.bmp']
            is_pptx = ext == '.pptx'
            is_ppt = ext == '.ppt'
            is_docx = ext == '.docx'
            is_doc = ext == '.doc'
            if is_image:
                mime_type = f"image/{ext[1:]}"
                file_type = "image"
            elif is_pptx:
                mime_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                file_type = "pptx"
            elif is_ppt:
                mime_type = "application/vnd.ms-powerpoint"
                file_type = "ppt"
            elif is_docx:
                mime_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                file_type = "docx"
            elif is_doc:
                mime_type = "application/msword"
                file_type = "doc"
            else:
                mime_type = "application/pdf"
                file_type = "pdf"

            return {
                "file_id": file_id,
                "filename": f"{file_id}{ext}",
                "file_type": file_type,
                "mime_type": mime_type,
                "size": len(content),
                "base64": base64.b64encode(content).decode('utf-8')
            }

    raise HTTPException(status_code=404, detail="文件不存在")


@router.get("/{file_id}/download")
async def download_file(
    file_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    for ext in ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.pdf', '.pptx', '.ppt', '.docx', '.doc']:
        filepath = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")
        if os.path.exists(filepath):
            from fastapi.responses import FileResponse
            return FileResponse(filepath)

    raise HTTPException(status_code=404, detail="文件不存在")


@router.delete("/{file_id}")
async def delete_file(
    file_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    for ext in ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.pdf', '.pptx', '.ppt', '.docx', '.doc']:
        filepath = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")
        if os.path.exists(filepath):
            os.remove(filepath)
            return {"success": True}

    raise HTTPException(status_code=404, detail="文件不存在")
