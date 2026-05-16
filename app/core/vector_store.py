import faiss
import numpy as np
import httpx
import time
import logging
from typing import List, Tuple, Optional
import pickle
import os
from app.core.config import settings

logger = logging.getLogger("uvicorn")

DASHSCOPE_EMBEDDING_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings"
EMBEDDING_MODEL = "text-embedding-v2"

MAX_RETRIES = 3
INITIAL_RETRY_DELAY = 1.0
RETRY_DELAY_MULTIPLIER = 2.0
TIMEOUT_SECONDS = 120.0


def resolve_model_name(model_version: Optional[str] = None) -> str:
    if model_version and model_version.startswith("v"):
        return f"text-embedding-{model_version}"
    return model_version or EMBEDDING_MODEL


def _get_embedding_with_retry(texts: List[str], api_key: str, text_type: str = "document", model_name: Optional[str] = None) -> List[List[float]]:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    model = resolve_model_name(model_name)

    payload = {
        "model": model,
        "input": texts,
        "parameters": {
            "text_type": text_type
        }
    }

    last_error = None
    delay = INITIAL_RETRY_DELAY

    for attempt in range(MAX_RETRIES):
        try:
            with httpx.Client(timeout=TIMEOUT_SECONDS) as client:
                response = client.post(DASHSCOPE_EMBEDDING_URL, json=payload, headers=headers)
                response.raise_for_status()
                result = response.json()

            if "data" not in result or not result["data"]:
                raise RuntimeError("嵌入API返回数据格式异常")

            embeddings = [item["embedding"] for item in result["data"]]
            return embeddings

        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            if status == 401:
                raise ValueError("API密钥认证失败，请检查您的text_embedding API密钥是否正确")
            elif status == 429:
                if attempt < MAX_RETRIES - 1:
                    logger.warning(f"API限流，{delay}秒后重试（第{attempt + 1}次）")
                    time.sleep(delay)
                    delay *= RETRY_DELAY_MULTIPLIER
                    continue
                raise RuntimeError("API请求过于频繁，请稍后重试")
            elif status >= 500:
                if attempt < MAX_RETRIES - 1:
                    logger.warning(f"API服务暂时不可用（{status}），{delay}秒后重试（第{attempt + 1}次）")
                    time.sleep(delay)
                    delay *= RETRY_DELAY_MULTIPLIER
                    continue
                raise RuntimeError(f"嵌入API服务暂时不可用（{status}），请稍后重试")
            else:
                raise RuntimeError(f"嵌入API请求失败（{status}）：{e.response.text}")

        except httpx.TimeoutException:
            if attempt < MAX_RETRIES - 1:
                logger.warning(f"嵌入API请求超时，{delay}秒后重试（第{attempt + 1}次）")
                time.sleep(delay)
                delay *= RETRY_DELAY_MULTIPLIER
                continue
            raise RuntimeError("嵌入API请求超时，请检查网络连接后重试")

        except httpx.RequestError as e:
            last_error = f"网络连接失败：{str(e)}"
            if attempt < MAX_RETRIES - 1:
                logger.warning(f"{last_error}，{delay}秒后重试（第{attempt + 1}次）")
                time.sleep(delay)
                delay *= RETRY_DELAY_MULTIPLIER
                continue
            raise RuntimeError(last_error)

    raise RuntimeError(f"嵌入API调用失败（已重试{MAX_RETRIES}次）：{last_error}")


class VectorStore:
    def __init__(self, dimension: int = 1536, index_path: Optional[str] = None):
        self.dimension = dimension
        self.index = faiss.IndexFlatIP(dimension)
        self.chunks: List[dict] = []
        self.index_path = index_path

    def add_texts(self, texts: List[str], metadata: List[dict], api_key: str, model_name: Optional[str] = None) -> None:
        if len(texts) != len(metadata):
            raise ValueError("texts 和 metadata 长度必须一致")

        embeddings = _get_embedding_with_retry(texts, api_key, text_type="document", model_name=model_name)
        embeddings_np = np.array(embeddings).astype('float32')

        faiss.normalize_L2(embeddings_np)
        self.index.add(embeddings_np)
        self.chunks.extend(metadata)

    def search(self, query: str, k: int = 5, api_key: Optional[str] = None, model_name: Optional[str] = None) -> List[Tuple[dict, float]]:
        if not api_key:
            raise ValueError("搜索需要提供API密钥")

        query_embeddings = _get_embedding_with_retry([query], api_key, text_type="query", model_name=model_name)
        query_np = np.array(query_embeddings).astype('float32')
        faiss.normalize_L2(query_np)

        distances, indices = self.index.search(query_np, min(k, self.index.ntotal))

        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx < len(self.chunks):
                results.append((self.chunks[idx], float(dist)))

        return results

    def save(self, path: str) -> None:
        faiss.write_index(self.index, f"{path}.index")
        with open(f"{path}.pkl", 'wb') as f:
            pickle.dump(self.chunks, f)

    def load(self, path: str) -> None:
        self.index = faiss.read_index(f"{path}.index")
        with open(f"{path}.pkl", 'rb') as f:
            self.chunks = pickle.load(f)

    def clear(self) -> None:
        self.index = faiss.IndexFlatIP(self.dimension)
        self.chunks = []

    @property
    def ntotal(self) -> int:
        return self.index.ntotal


_vector_store_cache: dict = {}

_build_tasks: dict = {}


def get_build_status(project_id: str) -> Optional[dict]:
    return _build_tasks.get(project_id)


def set_build_status(project_id: str, status: str, message: str = ""):
    _build_tasks[project_id] = {
        "status": status,
        "message": message
    }


def clear_build_status(project_id: str):
    _build_tasks.pop(project_id, None)


def build_project_index_sync(db_session_maker, project_id: str, user_id: str, api_key: str, model_name: Optional[str] = None):
    from app.models.project import ProjectDocument, DocumentChunk

    try:
        set_build_status(project_id, "building", "正在构建向量索引...")

        db = db_session_maker()
        try:
            documents = db.query(ProjectDocument).filter(ProjectDocument.project_id == project_id).all()
            if not documents:
                set_build_status(project_id, "error", "项目中没有文档")
                return

            chunks = []
            for doc in documents:
                db_chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).all()
                for chunk in db_chunks:
                    chunks.append({
                        "id": chunk.id,
                        "content": chunk.content,
                        "metadata": chunk.chunk_metadata,
                        "document_name": doc.name,
                        "chunk_index": chunk.chunk_index
                    })

            if not chunks:
                set_build_status(project_id, "error", "项目中没有文档块")
                return

            store = get_vector_store(project_id)
            store.clear()

            batch_size = 20
            total_batches = (len(chunks) + batch_size - 1) // batch_size

            for batch_idx in range(total_batches):
                start_idx = batch_idx * batch_size
                end_idx = min(start_idx + batch_size, len(chunks))
                batch_chunks = chunks[start_idx:end_idx]
                batch_texts = [c["content"] for c in batch_chunks]

                progress = f"正在处理第 {batch_idx + 1}/{total_batches} 批（共 {len(chunks)} 个文档块）"
                set_build_status(project_id, "building", progress)

                store.add_texts(batch_texts, batch_chunks, api_key, model_name=model_name)

            store.save(store.index_path)
            set_build_status(project_id, "completed", f"向量索引构建完成，共 {len(chunks)} 个文档块")
        finally:
            db.close()

    except Exception as e:
        error_msg = str(e)
        logger.error(f"向量索引构建失败: {error_msg}")
        set_build_status(project_id, "error", f"构建失败：{error_msg}")


def estimate_build_time(chunk_count: int) -> dict:
    BATCH_SIZE = 20
    SECONDS_PER_BATCH = 2.0

    total_batches = max(1, (chunk_count + BATCH_SIZE - 1) // BATCH_SIZE)
    estimated_seconds = total_batches * SECONDS_PER_BATCH

    if estimated_seconds < 60:
        time_str = f"约 {int(estimated_seconds)} 秒"
    elif estimated_seconds < 3600:
        minutes = int(estimated_seconds / 60)
        time_str = f"约 {minutes} 分钟"
    else:
        minutes = int(estimated_seconds / 60)
        time_str = f"约 {minutes} 分钟"

    return {
        "chunk_count": chunk_count,
        "total_batches": total_batches,
        "estimated_seconds": int(estimated_seconds),
        "estimated_time": time_str,
        "warning": True,
        "message": f"此过程可能需要较长时间（{time_str}），是否希望在后台继续处理并在完成后通知，或保持当前界面等待完成？"
    }


def get_vector_store(project_id: str) -> VectorStore:
    if project_id not in _vector_store_cache:
        index_path = os.path.join(settings.DATA_DIR, f"vectorstore_{project_id}")
        store = VectorStore(index_path=index_path)

        if os.path.exists(f"{index_path}.index"):
            try:
                store.load(index_path)
            except Exception:
                store = VectorStore(index_path=index_path)

        _vector_store_cache[project_id] = store

    return _vector_store_cache[project_id]


def hybrid_search(
    project_id: str,
    query: str,
    chunks: List[dict],
    api_key: str,
    top_k: int = 5,
    alpha: float = 0.7,
    model_name: Optional[str] = None
) -> List[dict]:
    if not chunks:
        return []

    store = get_vector_store(project_id)

    if store.ntotal == 0:
        chunk_texts = [chunk["content"] for chunk in chunks]
        store.add_texts(chunk_texts, chunks, api_key, model_name=model_name)
        store.save(store.index_path)

    vector_results = store.search(query, k=top_k, api_key=api_key, model_name=model_name)

    query_lower = query.lower()
    query_words = query_lower.split()

    bm25_scores = {}
    for i, chunk in enumerate(chunks):
        content_lower = chunk["content"].lower()
        score = 0
        for word in query_words:
            if word in content_lower:
                score += 1
        bm25_scores[i] = score

    max_bm25 = max(bm25_scores.values()) if bm25_scores.values() else 1

    hybrid_results = {}

    for chunk, vector_score in vector_results:
        chunk_idx = chunk.get("chunk_index", 0)
        bm25_score = bm25_scores.get(chunk_idx, 0) / max_bm25

        combined_score = alpha * vector_score + (1 - alpha) * bm25_score

        key = chunk["content"][:50]
        hybrid_results[key] = {
            "content": chunk["content"],
            "document_name": chunk.get("document_name", ""),
            "chunk_index": chunk.get("chunk_index", 0),
            "vector_score": vector_score,
            "bm25_score": bm25_score,
            "combined_score": combined_score
        }

    for i, chunk in enumerate(chunks):
        bm25_score = bm25_scores.get(i, 0) / max_bm25
        if bm25_score > 0:
            key = chunk["content"][:50]
            if key not in hybrid_results:
                hybrid_results[key] = {
                    "content": chunk["content"],
                    "document_name": chunk.get("document_name", ""),
                    "chunk_index": chunk.get("chunk_index", 0),
                    "vector_score": 0,
                    "bm25_score": bm25_score,
                    "combined_score": (1 - alpha) * bm25_score
                }
            else:
                if bm25_score > hybrid_results[key]["bm25_score"]:
                    hybrid_results[key]["bm25_score"] = bm25_score
                    hybrid_results[key]["combined_score"] = (
                        alpha * hybrid_results[key]["vector_score"] +
                        (1 - alpha) * bm25_score
                    )

    sorted_results = sorted(
        hybrid_results.values(),
        key=lambda x: x["combined_score"],
        reverse=True
    )

    return sorted_results[:top_k]
