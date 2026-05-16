from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.api.dependencies import CurrentUser, get_current_user
from app.core.ocr import get_ocr_service

router = APIRouter(prefix="/ocr", tags=["OCR 文字识别"])


@router.post("/recognize")
async def recognize_text(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="只支持图片文件")

    ocr_service = get_ocr_service(str(current_user.student_id))
    if not ocr_service:
        raise HTTPException(status_code=400, detail="未配置 OCR API，请先在设置中添加百度OCR凭证")

    try:
        contents = await file.read()
        import base64
        image_base64 = base64.b64encode(contents).decode('utf-8')

        result = ocr_service.recognize_text(image_base64)

        texts = []
        if 'words_result' in result:
            texts = [item.get('words', '') for item in result['words_result']]

        return {
            "success": True,
            "texts": texts,
            "count": result.get('words_result_num', len(texts))
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR识别失败: {str(e)}")
