from sqlalchemy.orm import Session
from app.models.project import Project, ProjectPrompt, ProjectDocument, DocumentChunk
from app.schemas.project import ProjectCreate, ProjectUpdate, PromptCreate, PromptUpdate, DocumentCreate
from typing import List, Optional
import uuid


def create_project(db: Session, user_id: str, project: ProjectCreate) -> Project:
    db_project = Project(
        id=str(uuid.uuid4()),
        user_id=str(user_id),
        name=project.name,
        description=project.description
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


def get_projects(db: Session, user_id: str, skip: int = 0, limit: int = 100) -> List[Project]:
    return db.query(Project).filter(Project.user_id == str(user_id)).order_by(Project.updated_at.desc()).offset(skip).limit(limit).all()


def get_project(db: Session, project_id: str, user_id: str) -> Optional[Project]:
    return db.query(Project).filter(Project.id == project_id, Project.user_id == str(user_id)).first()


def update_project(db: Session, project_id: str, user_id: str, project: ProjectUpdate) -> Optional[Project]:
    db_project = get_project(db, project_id, user_id)
    if not db_project:
        return None

    if project.name is not None:
        db_project.name = project.name
    if project.description is not None:
        db_project.description = project.description

    db.commit()
    db.refresh(db_project)
    return db_project


def delete_project(db: Session, project_id: str, user_id: str) -> bool:
    db_project = get_project(db, project_id, user_id)
    if not db_project:
        return False

    db.delete(db_project)
    db.commit()
    return True


def create_prompt(db: Session, project_id: str, prompt: PromptCreate) -> ProjectPrompt:
    db_prompt = ProjectPrompt(
        id=str(uuid.uuid4()),
        project_id=project_id,
        name=prompt.name,
        content=prompt.content,
        is_active=prompt.is_active,
        order=prompt.order
    )
    db.add(db_prompt)
    db.commit()
    db.refresh(db_prompt)
    return db_prompt


def get_prompts(db: Session, project_id: str, active_only: bool = False) -> List[ProjectPrompt]:
    query = db.query(ProjectPrompt).filter(ProjectPrompt.project_id == project_id)
    if active_only:
        query = query.filter(ProjectPrompt.is_active == True)
    return query.order_by(ProjectPrompt.order).all()


def update_prompt(db: Session, prompt_id: str, prompt: PromptUpdate) -> Optional[ProjectPrompt]:
    db_prompt = db.query(ProjectPrompt).filter(ProjectPrompt.id == prompt_id).first()
    if not db_prompt:
        return None

    if prompt.name is not None:
        db_prompt.name = prompt.name
    if prompt.content is not None:
        db_prompt.content = prompt.content
    if prompt.is_active is not None:
        db_prompt.is_active = prompt.is_active
    if prompt.order is not None:
        db_prompt.order = prompt.order

    db.commit()
    db.refresh(db_prompt)
    return db_prompt


def delete_prompt(db: Session, prompt_id: str) -> bool:
    db_prompt = db.query(ProjectPrompt).filter(ProjectPrompt.id == prompt_id).first()
    if not db_prompt:
        return False

    db.delete(db_prompt)
    db.commit()
    return True


def create_document(db: Session, project_id: str, document: DocumentCreate) -> ProjectDocument:
    db_document = ProjectDocument(
        id=str(uuid.uuid4()),
        project_id=project_id,
        name=document.name,
        file_type=document.file_type,
        file_size=document.file_size,
        content_text=document.content_text.replace('\x00', '') if document.content_text else document.content_text
    )
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    return db_document


def get_documents(db: Session, project_id: str) -> List[ProjectDocument]:
    return db.query(ProjectDocument).filter(ProjectDocument.project_id == project_id).order_by(ProjectDocument.created_at.desc()).all()


def delete_document(db: Session, document_id: str) -> bool:
    db_document = db.query(ProjectDocument).filter(ProjectDocument.id == document_id).first()
    if not db_document:
        return False

    db.delete(db_document)
    db.commit()
    return True


def get_document_chunks(db: Session, document_id: str) -> List[DocumentChunk]:
    return db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).order_by(DocumentChunk.chunk_index).all()


def create_document_chunk(db: Session, document_id: str, chunk_data: dict) -> DocumentChunk:
    db_chunk = DocumentChunk(
        id=str(uuid.uuid4()),
        document_id=document_id,
        content=chunk_data["content"].replace('\x00', '') if chunk_data.get("content") else chunk_data["content"],
        chunk_index=chunk_data["chunk_index"],
        chunk_metadata=chunk_data.get("chunk_metadata")
    )
    db.add(db_chunk)
    db.commit()
    db.refresh(db_chunk)
    return db_chunk


def create_chunks(db: Session, document_id: str, chunks: List[dict]) -> None:
    for idx, chunk_data in enumerate(chunks):
        if "chunk_index" not in chunk_data:
            chunk_data = {**chunk_data, "chunk_index": idx}
        create_document_chunk(db, document_id, chunk_data)


def retrieve_relevant_chunks(db: Session, project_id: str, query: str, top_k: int = 5, user_id: Optional[str] = None) -> List[dict]:
    from app.core.vector_store import hybrid_search
    from app.models.api_settings import ApiSettings

    documents = db.query(ProjectDocument).filter(ProjectDocument.project_id == project_id).all()
    if not documents:
        return []

    chunks = []
    for doc in documents:
        db_chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).all()
        for chunk in db_chunks:
            chunks.append({
                "id": chunk.id,
                "content": chunk.content,
                "metadata": chunk.chunk_metadata,
                "document_name": doc.name
            })

    if not chunks:
        return []

    api_key = None
    model_version = None
    if user_id:
        embedding_setting = db.query(ApiSettings).filter(
            ApiSettings.user_id == str(user_id),
            ApiSettings.provider == "text_embedding",
            ApiSettings.is_enabled == True
        ).first()
        if embedding_setting:
            api_key = embedding_setting.api_key
            model_version = embedding_setting.model_version

    if not api_key:
        return [{"chunk": c, "score": 0.0} for c in chunks[:top_k]]

    try:
        results = hybrid_search(project_id, query, chunks, api_key=api_key, top_k=top_k, alpha=0.7, model_name=model_version)
        return results
    except Exception as e:
        import logging
        logging.warning(f"向量检索失败，回退到关键词检索: {e}")

    query_lower = query.lower()
    for chunk in chunks:
        chunk["score"] = 1.0 if query_lower in chunk["content"].lower() else 0.0

    chunks_with_score = [(c, c["score"]) for c in chunks]
    chunks_with_score.sort(key=lambda x: x[1], reverse=True)
    return [{"chunk": c[0], "score": c[1]} for c in chunks_with_score[:top_k]]


def count_project_chunks(db: Session, project_id: str) -> int:
    return db.query(DocumentChunk).join(ProjectDocument).filter(
        ProjectDocument.project_id == project_id
    ).count()


def get_text_embedding_api_key(db: Session, user_id: str) -> Optional[dict]:
    from app.models.api_settings import ApiSettings
    setting = db.query(ApiSettings).filter(
        ApiSettings.user_id == str(user_id),
        ApiSettings.provider == "text_embedding",
        ApiSettings.is_enabled == True
    ).first()
    if setting and setting.api_key:
        return {
            "api_key": setting.api_key,
            "model_version": setting.model_version
        }
    return None


def build_vector_index(db: Session, project_id: str, user_id: str) -> Optional[str]:
    from app.core.vector_store import build_project_index_sync
    from app.db.database import SessionLocal

    setting_info = get_text_embedding_api_key(db, user_id)
    if not setting_info:
        return None

    import threading
    thread = threading.Thread(
        target=build_project_index_sync,
        args=(SessionLocal, project_id, user_id, setting_info["api_key"]),
        kwargs={"model_name": setting_info.get("model_version")},
        daemon=True
    )
    thread.start()
    return "向量索引构建任务已提交，将在后台继续处理，完成后可通过查询状态接口获取结果"
