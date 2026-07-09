"""知识图谱 API — PDF 上传 + LLM 提取 + Neo4j/PostgreSQL 导入

POST /knowledge-graph/upload    上传 PDF，启动异步 KG 提取流水线
GET  /knowledge-graph/status    获取提取任务状态
GET  /knowledge-graph/list      列出已构建的知识图谱
"""

import asyncio, json, hashlib, logging, os, re, time, uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

import fitz  # PyMuPDF
import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.database import get_db, SessionLocal
from app.api.dependencies import CurrentUser, get_current_user
from app.db.neo4j import get_neo4j

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/knowledge-graph", tags=["知识图谱"])

# ── 内存中的任务状态（生产环境应改用 Redis）──
_task_status: Dict[str, Dict[str, Any]] = {}

# ── LLM 抽取 Prompt ──
EXTRACTION_PROMPT = """你是一个知识图谱构建助手。从以下教材文本中提取「知识点实体」和它们之间的「关系」。

只输出 JSON，不要其他文字：
{
  "entities": [
    {"name": "知识点名称", "type": "concept|method|model|algorithm|framework|metric|technique", "difficulty": 1-5, "importance": 1-5}
  ],
  "triples": [
    {"subject": "实体A", "relation": "关系类型", "object": "实体B"}
  ]
}

关系类型: PREREQUISITE(学B前必须懂A), CONTAINS(A包含B), RELATED_TO(A与B紧密相关), APPLIES(A应用于B), DEPENDS_ON(A依赖B)

规则: 1)只提取学术/技术知识点 2)difficulty: 1=基础 3=中级 5=前沿 3)importance: 1=边缘 3=常规 5=核心 4)PREREQUISITE严格判断 5)每块≤15实体≤10关系"""

CHAT_SYSTEM_PROMPT = """你是一个知识图谱学习助手。根据提供的知识图谱结构和文档内容回答用户问题。

要求：
1. 回答基于提供的上下文（图谱结构 + 文档片段），不要编造信息
2. 引用具体的知识点名称和相关文档片段
3. 如果上下文不足以回答问题，明确说明
4. 回答使用中文，结构化呈现"""

KEYWORD_EXTRACTION_PROMPT = """从以下问题中提取关键词（用于检索知识图谱），只返回逗号分隔的关键词，不要其他内容：

问题：{question}
关键词："""

# ── 请求/响应模型 ──
class KGTaskStatus(BaseModel):
    task_id: str
    status: str  # pending / parsing / extracting / fusing / importing / done / failed
    progress: float = 0.0
    message: str = ""
    result: Optional[Dict] = None

class KGListResponse(BaseModel):
    knowledge_graphs: list

class KGChatRequest(BaseModel):
    question: str
    history: List[Dict[str, str]] = []


# ── JSON 解析辅助函数 ──

def sanitize_llm_json(text: str) -> str:
    """清理 LLM 返回的 JSON 字符串，处理常见格式问题。

    借鉴 GraphRAG llmExtractor.js 的 sanitizeJson 逻辑：
    - 提取 markdown 代码块中的 JSON
    - 清理中文标点（全角冒号/逗号/引号 → 半角）
    - 移除尾随逗号
    - 提取平衡的 JSON 对象
    """
    if not text or not isinstance(text, str):
        return "{}"

    text = text.strip()

    # Step 1: 从 markdown 代码块提取
    m = re.search(r'```(?:json)?\s*\n?([\s\S]*?)\n?\s*```', text, re.IGNORECASE)
    if m:
        text = m.group(1).strip()

    # Step 2: 尝试找到最外层的 { } 对
    if not text.startswith('{') and not text.startswith('['):
        first_brace = text.find('{')
        last_brace = text.rfind('}')
        if first_brace != -1 and last_brace > first_brace:
            text = text[first_brace:last_brace + 1]

    # Step 3: 提取平衡的 JSON 对象
    if not text.startswith('{'):
        text = _extract_json_object(text) or text

    # Step 4: 清理中文标点
    text = re.sub(r'"\s*：\s*', '": ', text)       # "key"： → "key":
    text = re.sub(r'：\s*"', ': "', text)           # key：" → key: "
    text = re.sub(r'：\s*\[', ': [', text)          # key：[ → key: [
    text = re.sub(r'：\s*\{', ': {', text)          # key：{ → key: {
    text = re.sub(r'：\s*(\d)', r': \1', text)      # key：123 → key: 123
    text = re.sub(r'"\s*，\s*"', '", "', text)      # "a"，"b" → "a", "b"
    text = re.sub(r'"\s*，\s*\{', '", {', text)     # "a"，{ → "a", {
    text = re.sub(r'\}\s*，\s*\{', '}, {', text)    # }，{ → }, {
    text = re.sub(r'\]\s*，\s*"', '], "', text)     # ]，" → ], "
    text = re.sub(r'"\s*，\s*\[', '", [', text)     # "a"，[ → "a", [
    # 中文引号 → ASCII
    text = re.sub(r'[“”‘’]', '"', text)
    # 移除尾随逗号
    text = re.sub(r',\s*([}\]])', r'\1', text)

    return text


def _extract_json_object(text: str) -> Optional[str]:
    """从字符串中提取最外层平衡的 JSON 对象"""
    start = text.find('{')
    if start == -1:
        return None
    depth = 0
    in_string = False
    escape = False
    for i, ch in enumerate(text[start:], start):
        if escape:
            escape = False
            continue
        if ch == '\\' and in_string:
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
    return None


def safe_parse_llm_json(content: str) -> dict:
    """安全解析 LLM 返回的 JSON"""
    try:
        return json.loads(content.strip())
    except json.JSONDecodeError:
        pass
    sanitized = sanitize_llm_json(content)
    try:
        return json.loads(sanitized)
    except json.JSONDecodeError:
        logger.warning(f"Failed to parse LLM JSON. Raw (first 500): {content[:500]}")
        return {"entities": [], "triples": []}


def extract_keywords_simple(question: str) -> List[str]:
    """简单中文/英文关键词提取（不依赖 LLM）。

    借鉴 GraphRAG textTokenizer.js：
    - 中文：移除标点和停用词后，提取 2-gram 和长词
    - 英文：按空格分词，过滤停用词和短词
    """
    STOP_WORDS = {'的', '是', '了', '在', '和', '也', '都', '就', '有', '与', '不',
                  '这', '那', '我', '你', '他', '她', '它', '们', '吗', '呢', '吧',
                  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
                  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
                  'should', 'may', 'might', 'can', 'shall', 'i', 'you', 'he', 'she',
                  'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'to', 'of',
                  'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about',
                  '什么', '怎么', '如何', '哪些', '哪个', '为什么', '是不是', '有没有',
                  '可以', '能', '会', '请', '问', '请问', '多少', '几个', 'and', 'or'}

    # 移除常见标点
    # 移除中英文标点符号
    cleaned = re.sub(r'[，。！？、；：""''【】《》（）(){}\[\]{},.!?;:\"\'`\s]+', ' ', question)

    keywords = []
    # 提取中文词（2-4 字组合）
    chinese_chars = re.findall(r'[一-鿿]+', cleaned)
    for word in chinese_chars:
        word = word.strip()
        if len(word) >= 2 and word not in STOP_WORDS:
            keywords.append(word)
            # 同时拆分为 2-gram
            if len(word) >= 4:
                for i in range(len(word) - 1):
                    bigram = word[i:i+2]
                    if bigram not in STOP_WORDS:
                        keywords.append(bigram)

    # 提取英文词
    english_words = re.findall(r'[a-zA-Z]+', cleaned)
    for w in english_words:
        wl = w.lower()
        if len(wl) >= 2 and wl not in STOP_WORDS:
            keywords.append(wl)

    # 去重 + 排序（长度优先，长词更有价值）
    seen = set()
    unique = []
    for kw in sorted(keywords, key=len, reverse=True):
        if kw not in seen:
            seen.add(kw)
            unique.append(kw)

    return unique[:20]  # 最多 20 个关键词


async def extract_keywords_llm(question: str, api_key: str) -> List[str]:
    """使用 LLM 提取关键词（更精准）"""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": "deepseek-chat",
                    "messages": [{"role": "user", "content": KEYWORD_EXTRACTION_PROMPT.format(question=question)}],
                    "temperature": 0.1, "max_tokens": 100,
                }
            )
        if r.status_code == 200:
            content = r.json()["choices"][0]["message"]["content"].strip()
            return [kw.strip() for kw in content.replace('，', ',').split(',') if kw.strip()]
    except Exception:
        pass
    return extract_keywords_simple(question)


async def _run_extraction_pipeline(task_id: str, file_content: bytes, filename: str, api_key: str, user_id: str = None):
    """后台运行完整的 PDF→KG 流水线"""
    try:
        # ══ Stage 1: Parse PDF ══
        _update_task(task_id, "parsing", 0.05, "正在解析 PDF 文件...")
        doc = fitz.open(stream=file_content, filetype="pdf")
        total_pages = doc.page_count

        # Extract text by chunks
        chunks = []
        for page_num in range(total_pages):
            page_text = doc[page_num].get_text()
            if not page_text or len(page_text.strip()) < 20:
                continue
            paragraphs = [p.strip() for p in page_text.split('\n\n') if len(p.strip()) > 30]
            for para in paragraphs:
                if len(para) < 30:
                    continue
                chunk_id = hashlib.md5(f'p{page_num}_{len(chunks)}'.encode()).hexdigest()[:10]
                chunks.append({'id': chunk_id, 'page': page_num + 1, 'text': para[:800], 'char_count': min(len(para), 800)})
                if len(chunks) >= 100:  # Max 100 chunks for async processing
                    break
            if len(chunks) >= 100:
                break
        doc.close()

        _update_task(task_id, "parsing", 0.15, f"PDF 解析完成：{total_pages} 页, {len(chunks)} 个文本块")

        # ── 创建 subject + 保存文本块（用于 RAG 关键词检索）──
        subj_id = str(uuid.uuid4())
        now_time = datetime.now(timezone.utc).isoformat()

        # Step A: 创建 subject（独立事务，确保导入阶段能找到）
        db_ctx = SessionLocal()
        try:
            db_ctx.execute(
                text("INSERT INTO subjects (id, name, description, creator_id, sort_order, created_at, updated_at) VALUES (:i, :n, :d, :cr, 1, :ca, :ua)"),
                {'i': subj_id, 'n': f'从{filename[:20]}提取', 'd': f'自动提取自PDF: {filename[:50]}',
                 'cr': user_id, 'ca': now_time, 'ua': now_time}
            )
            db_ctx.commit()
        except Exception as e:
            logger.warning(f"Subject creation failed: {e}")
        finally:
            db_ctx.close()

        # Step B: 保存文本块（失败不影响 KG 构建）
        if chunks:
            db_fc = SessionLocal()
            try:
                for ci, chunk in enumerate(chunks):
                    db_fc.execute(
                        text("INSERT INTO kg_file_contents (id, subject_id, file_name, chunk_id, page_number, content, chunk_index, created_at) VALUES (:i, :s, :f, :c, :p, :ct, :ci, :ca)"),
                        {'i': str(uuid.uuid4()), 's': subj_id, 'f': filename, 'c': chunk['id'],
                         'p': chunk['page'], 'ct': chunk['text'], 'ci': ci, 'ca': now_time}
                    )
                db_fc.commit()
            except Exception as e:
                logger.warning(f"File content storage failed: {e}")
            finally:
                db_fc.close()

        # ══ Stage 2: LLM Extraction ══
        _update_task(task_id, "extracting", 0.20, f"开始 LLM 实体抽取（{len(chunks)} 块）...")

        all_entities, all_triples = [], []
        for i, chunk in enumerate(chunks):
            progress = 0.20 + (i / len(chunks)) * 0.50
            _update_task(task_id, "extracting", progress, f"抽取中 [{i+1}/{len(chunks)}]...")

            try:
                async with httpx.AsyncClient(timeout=120) as client:
                    r = await client.post(
                        "https://api.deepseek.com/v1/chat/completions",
                        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                        json={
                            "model": "deepseek-chat",
                            "messages": [
                                {"role": "system", "content": EXTRACTION_PROMPT},
                                {"role": "user", "content": f"文本：{chunk['text']}\n请提取知识点实体和关系。"}
                            ],
                            "temperature": 0.3, "max_tokens": 2048,
                        }
                    )
                if r.status_code == 200:
                    content = r.json()["choices"][0]["message"]["content"]
                    data = safe_parse_llm_json(content)
                    all_entities.append(data.get("entities", []))
                    all_triples.append(data.get("triples", []))
            except Exception as e:
                logger.warning(f"Chunk {i} extraction failed: {e}")

            await asyncio.sleep(0.3)  # Rate limit

        total_e = sum(len(e) for e in all_entities)
        total_t = sum(len(t) for t in all_triples)
        _update_task(task_id, "extracting", 0.70, f"抽取完成：{total_e} 实体, {total_t} 关系")

        # ══ Stage 3: Knowledge Fusion ══
        _update_task(task_id, "fusing", 0.75, "正在知识融合与实体消歧...")

        entities = {}
        for chunk_entities in all_entities:
            for e in chunk_entities:
                name = e.get('name', '').strip()
                if not name or len(name) < 2: continue
                if name not in entities:
                    entities[name] = {'name': name, 'type': e.get('type', 'concept'),
                                      'difficulty': e.get('difficulty', 3), 'importance': e.get('importance', 3), 'count': 1}
                else:
                    prev = entities[name]
                    prev['difficulty'] = round((prev['difficulty'] * prev['count'] + e.get('difficulty', 3)) / (prev['count'] + 1))
                    prev['importance'] = round((prev['importance'] * prev['count'] + e.get('importance', 3)) / (prev['count'] + 1))
                    prev['count'] += 1

        triples = {}
        for chunk_triples in all_triples:
            for t in chunk_triples:
                subj, obj, rel = t.get('subject', '').strip(), t.get('object', '').strip(), t.get('relation', 'RELATED_TO')
                if not subj or not obj or subj == obj: continue
                key = f'{subj}|{rel}|{obj}'
                if key not in triples:
                    triples[key] = {'subject': subj, 'relation': rel, 'object': obj, 'confidence': 0.8}
                else:
                    triples[key]['confidence'] = min(1.0, triples[key]['confidence'] + 0.1)

        # Convert DEPENDS_ON to PREREQUISITE
        for key, t in list(triples.items()):
            if t['relation'] == 'DEPENDS_ON':
                pk = f"{t['subject']}|PREREQUISITE|{t['object']}"
                if pk not in triples:
                    triples[pk] = {'subject': t['subject'], 'relation': 'PREREQUISITE', 'object': t['object'], 'confidence': 0.85}

        _update_task(task_id, "fusing", 0.85, f"融合完成：{len(entities)} 实体, {len(triples)} 关系")

        # ══ Stage 4: Import to Neo4j + PostgreSQL ══
        _update_task(task_id, "importing", 0.90, "正在导入 Neo4j 和 PostgreSQL...")

        # Neo4j
        neo4j = get_neo4j()
        if neo4j.verify_connectivity():
            with neo4j.connect().session() as s:
                for e in list(entities.values())[:200]:
                    s.run('MERGE (k:KnowledgePoint {name: $n}) SET k.type=$t, k.difficulty=$d, k.importance=$i',
                          n=e['name'], t=e['type'], d=e['difficulty'], i=e['importance'])
                for t in list(triples.values())[:300]:
                    try:
                        s.run(f"MATCH (a:KnowledgePoint {{name: $s}}), (b:KnowledgePoint {{name: $o}}) MERGE (a)-[:{t['relation']}]->(b)",
                              s=t['subject'], o=t['object'])
                    except: pass

        # PostgreSQL (subject already created during parsing stage)
        try:
            db = SessionLocal()
            now_ts = datetime.now(timezone.utc).isoformat()
            did = str(uuid.uuid4())
            db.execute(
                text("INSERT INTO knowledge_domains (id, subject_id, name, sort_order, created_at, updated_at) VALUES (:i, :s, :n, 1, :ca, :ua)"),
                {'i': did, 's': subj_id, 'n': '自动提取', 'ca': now_ts, 'ua': now_ts}
            )
            for i, e in enumerate(list(entities.values())[:200]):
                pid = str(uuid.uuid4())
                db.execute(
                    text("INSERT INTO knowledge_points (id, domain_id, name, difficulty, sort_order, description, created_at, updated_at) VALUES (:i, :d, :n, :diff, :o, :desc, :ca, :ua)"),
                    {'i': pid, 'd': did, 'n': e['name'], 'diff': e['difficulty'], 'o': i, 'desc': f'自动提取 · 重要性{e["importance"]}/5', 'ca': now_ts, 'ua': now_ts}
                )
            db.commit()
            db.close()
        except Exception as e:
            logger.warning(f"PostgreSQL import failed: {e}")

        prereq_count = sum(1 for t in triples.values() if t['relation'] == 'PREREQUISITE')
        _update_task(task_id, "done", 1.0,
                     f"知识图谱构建完成！{len(entities)} 实体, {len(triples)} 关系, {prereq_count} 前置依赖",
                     result={"entities": len(entities), "triples": len(triples), "prerequisites": prereq_count,
                             "source": filename, "subject_id": subj_id,
                             "imported_to": ["Neo4j", "PostgreSQL"]})

    except Exception as e:
        logger.error(f"KG extraction failed: {e}", exc_info=True)
        _update_task(task_id, "failed", 0, f"构建失败: {str(e)[:200]}")


def _update_task(task_id: str, status: str, progress: float, message: str, result: Optional[Dict] = None):
    _task_status[task_id] = {"task_id": task_id, "status": status, "progress": progress, "message": message, "result": result}


# ═══════════════════════════════════════════════════════
#  API Endpoints
# ═══════════════════════════════════════════════════════

@router.post("/upload")
async def upload_pdf_for_kg(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """上传 PDF 文件，启动知识图谱提取流水线"""
    # Validate file type
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(400, detail="仅支持 PDF 文件")

    # Get user's API key
    from app.models.api_settings import ApiSettings
    api_setting = db.query(ApiSettings).filter(
        ApiSettings.user_id == str(current_user.student_id),
        ApiSettings.provider.in_(["deepseek", "qwen"]),
        ApiSettings.is_enabled == True,
    ).first()

    if not api_setting or not api_setting.api_key:
        raise HTTPException(400, detail="请先配置 DeepSeek 或 Qwen API Key 后再上传 PDF")

    # Read file
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(400, detail="PDF 文件不能超过 50MB")
    if len(content) < 1000:
        raise HTTPException(400, detail="PDF 文件内容过少，无法提取")

    # Create task
    task_id = str(uuid.uuid4())[:8]
    _update_task(task_id, "pending", 0, f"已接收文件: {file.filename}")

    # Start background processing
    asyncio.create_task(_run_extraction_pipeline(task_id, content, file.filename or "unknown.pdf", api_setting.api_key, str(current_user.student_id)))

    return {"task_id": task_id, "message": "PDF 已上传，正在后台构建知识图谱", "filename": file.filename}


@router.get("/status")
async def get_kg_task_status(task_id: str = Query(...)):
    """查询知识图谱提取任务状态"""
    status = _task_status.get(task_id)
    if not status:
        raise HTTPException(404, detail="任务不存在或已过期")
    return status


@router.get("/graph")
async def get_knowledge_graph_data(
    subject_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """获取指定学科的知识图谱可视化数据（节点 + 关系，仅种子或自己的学科）"""
    from app.models.question_bank import KnowledgePoint, KnowledgeDomain, Subject

    # 验证学科权限：仅种子学科或用户自己的学科可查看
    from sqlalchemy import or_
    from uuid import UUID
    seed_subject_id = UUID("d91a4645-ab5f-4819-8379-d9e6524f0937")
    sub = db.query(Subject).filter(
        Subject.id == subject_id,
        or_(Subject.id == seed_subject_id, Subject.creator_id == current_user.student_id)
    ).first()
    if not sub:
        raise HTTPException(404, detail="学科不存在或无权访问")
    from app.models.question_bank import KnowledgePoint, KnowledgeDomain

    # 1. 从 PostgreSQL 获取该学科的所有知识点
    kps = (
        db.query(KnowledgePoint)
        .join(KnowledgeDomain, KnowledgePoint.domain_id == KnowledgeDomain.id)
        .filter(KnowledgeDomain.subject_id == subject_id)
        .order_by(KnowledgePoint.sort_order)
        .all()
    )

    # 2. 构建节点（按领域分组）
    domains_cache: dict = {}
    domain_rows = (
        db.query(KnowledgeDomain)
        .filter(KnowledgeDomain.subject_id == subject_id)
        .order_by(KnowledgeDomain.sort_order)
        .all()
    )
    for d in domain_rows:
        domains_cache[str(d.id)] = d.name

    # 按领域分组节点（保持 sort_order）
    domain_kps: dict[str, list] = {}
    for kp in kps:
        domain_name = domains_cache.get(str(kp.domain_id), "未知")
        node = {
            "id": str(kp.id),
            "name": kp.name,
            "domain_id": str(kp.domain_id),
            "domain_name": domain_name,
            "difficulty": kp.difficulty or 3,
            "sort_order": kp.sort_order or 0,
        }
        domain_kps.setdefault(str(kp.domain_id), []).append(node)

    # 展平为节点列表，同时记录各领域的节点
    nodes = []
    domain_nodes_ordered: list[list[dict]] = []  # 保持领域顺序
    for d in domain_rows:
        did = str(d.id)
        d_nodes = domain_kps.get(did, [])
        d_nodes.sort(key=lambda x: x["sort_order"])
        domain_nodes_ordered.append(d_nodes)
        nodes.extend(d_nodes)

    # 3. 从 Neo4j 获取知识点之间的关系
    edges = []
    try:
        neo4j = get_neo4j()
        if neo4j.verify_connectivity():
            kp_names = [n["name"] for n in nodes if n["name"]]
            if kp_names:
                with neo4j.connect().session() as neo4j_session:
                    result = neo4j_session.run(
                        """
                        MATCH (a:KnowledgePoint)-[r]->(b:KnowledgePoint)
                        WHERE a.name IN $names AND b.name IN $names
                        RETURN a.name as source_name, b.name as target_name,
                               type(r) as relation
                        """,
                        names=kp_names,
                    )
                    for record in result:
                        source_name = record.get("source_name", "")
                        target_name = record.get("target_name", "")
                        relation = record.get("relation", "RELATED_TO")
                        source_node_n = next(
                            (n for n in nodes if n["name"] == source_name), None
                        )
                        target_node_n = next(
                            (n for n in nodes if n["name"] == target_name), None
                        )
                        if source_node_n and target_node_n:
                            edges.append({
                                "source": source_node_n["id"],
                                "target": target_node_n["id"],
                                "relation": relation,
                            })
    except Exception as e:
        logger.warning(f"Neo4j query failed: {e}")

    # 4. 如果 Neo4j 没有返回关系，从 PostgreSQL 结构推导
    if not edges and len(domain_nodes_ordered) >= 1:
        edge_set: set[str] = set()
        for d_nodes in domain_nodes_ordered:
            # 领域内：按 sort_order 连接 PREREQUISITE 链
            for i in range(len(d_nodes) - 1):
                key = f"{d_nodes[i]['id']}|PREREQUISITE|{d_nodes[i+1]['id']}"
                if key not in edge_set:
                    edge_set.add(key)
                    edges.append({
                        "source": d_nodes[i]["id"],
                        "target": d_nodes[i+1]["id"],
                        "relation": "PREREQUISITE",
                    })
            # 领域内：相邻节点添加 RELATED_TO 关联
            for i in range(len(d_nodes) - 1):
                key = f"{d_nodes[i]['id']}|RELATED_TO|{d_nodes[i+1]['id']}"
                if key not in edge_set:
                    edge_set.add(key)
                    edges.append({
                        "source": d_nodes[i]["id"],
                        "target": d_nodes[i+1]["id"],
                        "relation": "RELATED_TO",
                    })

        # 领域间：前一个领域的最后一个 → 后一个领域的第一个
        for di in range(len(domain_nodes_ordered) - 1):
            prev_last = domain_nodes_ordered[di][-1] if domain_nodes_ordered[di] else None
            next_first = domain_nodes_ordered[di + 1][0] if domain_nodes_ordered[di + 1] else None
            if prev_last and next_first:
                key = f"{prev_last['id']}|PREREQUISITE|{next_first['id']}"
                if key not in edge_set:
                    edge_set.add(key)
                    edges.append({
                        "source": prev_last["id"],
                        "target": next_first["id"],
                        "relation": "PREREQUISITE",
                    })

    return {"nodes": nodes, "edges": edges}


@router.get("/list")
async def list_knowledge_graphs(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """列出已构建的知识图谱（仅种子学科 + 用户自己创建的学科）"""
    from app.models.question_bank import Subject, KnowledgeDomain, KnowledgePoint
    from sqlalchemy import or_
    from uuid import UUID

    seed_subject_id = UUID("d91a4645-ab5f-4819-8379-d9e6524f0937")
    subjects = db.query(Subject).filter(
        or_(Subject.id == seed_subject_id, Subject.creator_id == current_user.student_id)
    ).order_by(Subject.sort_order, Subject.name).all()

    result = []
    for s in subjects:
        domains = db.query(KnowledgeDomain).filter(KnowledgeDomain.subject_id == s.id).all()
        d_count = len(domains)
        pts = 0
        for d in domains:
            pts += db.query(KnowledgePoint).filter(KnowledgePoint.domain_id == d.id).count()
        result.append({
            "id": str(s.id), "name": s.name, "description": s.description or "",
            "domains": d_count, "knowledge_points": pts,
        })
    return {"knowledge_graphs": result}


# ═══ RAG 端点 ═══

@router.post("/files/{subject_id}/search")
async def search_file_contents(
    subject_id: str,
    keywords: List[str] = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """在已存储的 PDF 文件内容中搜索关键词（用于 RAG 文档检索）。

    借鉴 GraphRAG server/routes/files.js 的搜索逻辑：
    对每个关键词逐文件匹配，提取上下文片段，按分数排序返回。
    """
    from app.models.question_bank import KgFileContent

    rows = db.query(KgFileContent).filter(KgFileContent.subject_id == subject_id).order_by(KgFileContent.chunk_index).all()
    if not rows:
        return {"results": [], "total_files": 0}

    # 按文件分组
    files_map: Dict[str, List[KgFileContent]] = {}
    for r in rows:
        files_map.setdefault(r.file_name, []).append(r)

    results = []
    for fname, chunks in files_map.items():
        score = 0
        snippets = []
        used_ranges: List[tuple] = []
        full_text = " ".join(c.content for c in chunks)

        for kw in keywords:
            kw_lower = kw.lower()
            search_from = 0
            text_lower = full_text.lower()
            while search_from < len(text_lower):
                idx = text_lower.find(kw_lower, search_from)
                if idx == -1:
                    break
                score += 1
                start = max(0, idx - 200)
                end = min(len(full_text), idx + len(kw) + 200)
                overlaps = any(r_start < end and r_end > start for r_start, r_end in used_ranges)
                if not overlaps:
                    snippets.append(full_text[start:end])
                    used_ranges.append((start, end))
                search_from = idx + len(kw)

        if score > 0:
            results.append({
                "file_name": fname,
                "score": score,
                "snippets": snippets[:8],
                "full_content": full_text[:4000] if score >= 2 else None,
                "page_count": len(set(c.page_number for c in chunks)),
            })

    results.sort(key=lambda x: x["score"], reverse=True)
    return {"results": results[:10], "total_files": len(files_map)}


@router.post("/chat/{subject_id}")
async def kg_rag_chat(
    subject_id: str,
    body: KGChatRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """知识图谱 RAG 智能问答（SSE 流式）。

    两阶段 RAG（借鉴 PageIndex chat_service.py）：
    1. Tree/Graph Search — 关键词提取 + Neo4j 图谱检索 + 文档内容检索
    2. Answer Generation — 上下文组装 + LLM 流式回答

    响应格式（SSE）：
        data: {"phase":"searching","message":"..."}
        data: {"phase":"nodes_found","node_ids":[...],"node_titles":[...]}
        data: {"phase":"generating","message":"..."}
        data: {"phase":"answer_chunk","content":"..."}
        data: {"phase":"done","referenced_nodes":[...],"tokens_used":{...}}
        data: {"phase":"error","message":"..."}
    """
    from app.models.question_bank import KnowledgePoint, KnowledgeDomain, Subject, KgFileContent
    from app.models.api_settings import ApiSettings

    # 1. 获取 LLM API Key
    api_setting = db.query(ApiSettings).filter(
        ApiSettings.user_id == str(current_user.student_id),
        ApiSettings.provider.in_(["deepseek", "qwen"]),
        ApiSettings.is_enabled == True,
    ).first()
    if not api_setting or not api_setting.api_key:
        raise HTTPException(400, detail="请先在设置中配置 AI API Key 后再使用问答功能")

    api_key = api_setting.api_key
    model = "deepseek-chat" if api_setting.provider == "deepseek" else "qwen-turbo"

    async def event_generator():
        try:
            # ══ Phase 1: 检索 ══
            yield f"data: {json.dumps({'phase': 'searching', 'message': '正在提取关键词...'})}\n\n"

            # 1a. 关键词提取
            keywords = await extract_keywords_llm(body.question, api_key)
            if not keywords:
                keywords = extract_keywords_simple(body.question)

            kw_str = chr(34) + ", ".join(keywords[:8]) + chr(34)
            yield "data: " + json.dumps({"phase": "searching", "message": "关键词: " + kw_str}) + "\n\n"

            # 1b. Graph 检索（从 Neo4j）
            yield f"data: {json.dumps({'phase': 'searching', 'message': '正在检索知识图谱...'})}\n\n"

            graph_context = {"nodes": [], "edges": []}
            seed_node_names = set()
            try:
                neo4j = get_neo4j()
                if neo4j.verify_connectivity():
                    with neo4j.connect().session() as ns:
                        # 查找匹配关键词的种子节点
                        for kw in keywords[:10]:
                            result = ns.run(
                                "MATCH (k:KnowledgePoint) WHERE k.name CONTAINS $kw RETURN k.name AS name",
                                kw=kw
                            )
                            for rec in result:
                                name = rec.get("name", "")
                                if name:
                                    seed_node_names.add(name)

                        if seed_node_names:
                            # BFS 扩展子图（深度=1, 从种子节点沿所有关系扩展）
                            sub_nodes = ns.run(
                                """
                                MATCH (k:KnowledgePoint)
                                WHERE k.name IN $names
                                OPTIONAL MATCH (k)-[r]-(neighbor:KnowledgePoint)
                                RETURN DISTINCT k.name AS name, neighbor.name AS neighbor_name,
                                       type(r) AS relation
                                """,
                                names=list(seed_node_names)[:20]
                            )
                            seen_nodes = set()
                            for rec in sub_nodes:
                                k_name = rec.get("name")
                                n_name = rec.get("neighbor_name")
                                rel = rec.get("relation")
                                if k_name and k_name not in seen_nodes:
                                    seen_nodes.add(k_name)
                                    graph_context["nodes"].append({"name": k_name, "is_seed": True})
                                if n_name and n_name not in seen_nodes:
                                    seen_nodes.add(n_name)
                                    graph_context["nodes"].append({"name": n_name, "is_seed": False})
                                if k_name and n_name and rel:
                                    graph_context["edges"].append({"source": k_name, "target": n_name, "relation": rel})
            except Exception as e:
                logger.warning(f"Neo4j RAG search failed: {e}")

            yield f"data: {json.dumps({'phase': 'nodes_found', 'node_ids': list(seed_node_names)[:20], 'node_titles': list(seed_node_names)[:20]})}\n\n"

            # 1c. 文档检索
            yield f"data: {json.dumps({'phase': 'searching', 'message': '正在检索文档内容...'})}\n\n"

            chunk_rows = db.query(KgFileContent).filter(
                KgFileContent.subject_id == subject_id
            ).order_by(KgFileContent.chunk_index).all()

            doc_results = []
            if chunk_rows:
                files_map: Dict[str, List[KgFileContent]] = {}
                for r in chunk_rows:
                    files_map.setdefault(r.file_name, []).append(r)

                for fname, chunks in files_map.items():
                    full_text = " ".join(c.content for c in chunks)
                    score = 0
                    snippets = []
                    text_lower = full_text.lower()
                    used_ranges = []
                    for kw in keywords[:8]:
                        kw_lower = kw.lower()
                        search_from = 0
                        while search_from < len(text_lower):
                            idx = text_lower.find(kw_lower, search_from)
                            if idx == -1:
                                break
                            score += 1
                            start = max(0, idx - 200)
                            end = min(len(full_text), idx + len(kw) + 200)
                            overlaps = any(r_start < end and r_end > start for r_start, r_end in used_ranges)
                            if not overlaps:
                                snippets.append(full_text[start:end])
                                used_ranges.append((start, end))
                            search_from = idx + len(kw)
                    if score > 0:
                        doc_results.append({"file_name": fname, "score": score, "snippets": snippets[:5],
                                            "full_text": full_text[:3000] if score >= 2 else None})
                doc_results.sort(key=lambda x: x["score"], reverse=True)

            # ══ Phase 2: 构建上下文并生成答案 ══
            yield f"data: {json.dumps({'phase': 'generating', 'message': '正在分析结果并生成答案...'})}\n\n"

            # 组装上下文（借鉴 GraphRAG formatCombinedContext）
            context_lines = []

            # 文档内容（主要参考）
            if doc_results:
                context_lines.append("=== 文档内容（主要参考依据）===")
                for dr in doc_results[:3]:
                    context_lines.append(f"\n【文件: {dr['file_name']}】")
                    if dr.get("full_text"):
                        context_lines.append(dr["full_text"].strip())
                    else:
                        for snip in dr["snippets"][:3]:
                            context_lines.append(snip.strip())
                            context_lines.append("...")

            # 图谱结构（辅助参考）
            if graph_context["nodes"]:
                context_lines.append("\n=== 知识图谱结构（辅助参考）===")
                context_lines.append("\n【知识点】")
                for n in graph_context["nodes"][:30]:
                    marker = " ★" if n.get("is_seed") else ""
                    context_lines.append(f"- {n['name']}{marker}")
                if graph_context["edges"]:
                    context_lines.append("\n【关系】")
                    for e in graph_context["edges"][:20]:
                        context_lines.append(f"- {e['source']} --[{e['relation']}]--> {e['target']}")

            context = "\n".join(context_lines)
            if len(context) > 8000:
                context = context[:8000] + "\n...（上下文过长，已截断）"

            # 构建消息
            messages = [
                {"role": "system", "content": CHAT_SYSTEM_PROMPT},
                {"role": "user", "content": f"上下文信息：\n{context}\n\n用户问题：{body.question}\n\n请基于以上上下文回答问题。"}
            ]
            if body.history:
                messages = [messages[0]] + body.history[-6:] + [messages[1]]

            # 流式生成
            async with httpx.AsyncClient(timeout=120) as client:
                async with client.stream(
                    "POST",
                    "https://api.deepseek.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={"model": model, "messages": messages, "temperature": 0.7, "max_tokens": 2048, "stream": True}
                ) as response:
                    if response.status_code != 200:
                        yield f"data: {json.dumps({'phase': 'error', 'message': f'AI API 请求失败: HTTP {response.status_code}'})}\n\n"
                        return

                    full_answer = ""
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            chunk_data = line[6:]
                            if chunk_data == "[DONE]":
                                break
                            try:
                                chunk = json.loads(chunk_data)
                                delta = chunk.get("choices", [{}])[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    full_answer += content
                                    yield f"data: {json.dumps({'phase': 'answer_chunk', 'content': content})}\n\n"
                            except json.JSONDecodeError:
                                continue

            yield f"data: {json.dumps({'phase': 'done', 'referenced_nodes': list(seed_node_names)[:20], 'full_answer': full_answer, 'tokens_used': {}})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'phase': 'error', 'message': f'问答生成失败: {str(e)[:200]}'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"})
