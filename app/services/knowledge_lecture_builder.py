"""Build sourced reading handouts for learning-path knowledge points."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


BASE_NOTES_URL = "https://ri-nai-bit-se.github.io/Data-Structure-Notes/%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84/"
BASE_LINEAR_LIST_URL = (
    "https://ri-nai-bit-se.github.io/Data-Structure-Notes/"
    "%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84/%E7%BA%BF%E6%80%A7%E8%A1%A8/"
)
ADVANCED_NOTES_URL = "https://www.cnblogs.com/Ck-0ff/p/15712553.html"


@dataclass(frozen=True)
class LectureSourcePack:
    key: str
    title: str
    base_url: str
    advanced_url: str
    base_points: tuple[str, ...]
    advanced_points: tuple[str, ...]
    comparisons: tuple[str, ...]


REFERENCE_PACKS: dict[str, LectureSourcePack] = {
    "linear_list": LectureSourcePack(
        key="linear_list",
        title="线性表",
        base_url=BASE_LINEAR_LIST_URL,
        advanced_url=f"{ADVANCED_NOTES_URL}#%E7%BA%BF%E6%80%A7%E8%A1%A8%E4%B8%A4%E7%A7%8D%E5%AD%98%E5%82%A8%E7%BB%93%E6%9E%84",
        base_points=(
            "从逻辑结构看，线性表是一组有限、同类型、具有一对一前驱后继关系的数据元素序列。",
            "顺序表用连续存储空间承载逻辑相邻关系，适合按下标随机访问。",
            "单链表用结点和指针保存后继关系，适合长度变化频繁的场景。",
            "循环链表、双向链表是在单链表基础上增强边界处理和双向移动能力。",
        ),
        advanced_points=(
            "讲清楚“逻辑结构”和“存储结构”不是同一层概念：线性表是逻辑结构，顺序表和链表是实现方式。",
            "拔高时要围绕初始化、求长、按值查找、按位查找、插入、删除、判空、销毁等基本操作建立复杂度表。",
            "顺序表插入删除的代价来自元素搬移；链表插入删除看似 O(1)，但定位到第 i 个位置通常仍需顺序扫描。",
            "动态顺序表涉及容量、扩容增量、重分配失败、下标越界和尾插摊还分析。",
        ),
        comparisons=(
            "随机访问：顺序表 O(1)，链表 O(n)。",
            "已定位后的插入删除：顺序表需要搬移元素，链表主要改指针。",
            "空间：顺序表存储密度高但可能预留容量；链表多出指针域但更灵活。",
        ),
    ),
    "stack_queue": LectureSourcePack(
        key="stack_queue",
        title="栈和队列",
        base_url=f"{BASE_NOTES_URL}%E6%A0%88%E5%92%8C%E9%98%9F%E5%88%97/",
        advanced_url=f"{ADVANCED_NOTES_URL}#%E6%A0%88%E5%92%8C%E9%98%9F%E5%88%97",
        base_points=(
            "栈强调后进先出，核心操作是入栈、出栈和取栈顶。",
            "队列强调先进先出，核心操作是入队、出队和取队头。",
            "顺序存储和链式存储都能实现栈与队列，关键是边界条件。",
        ),
        advanced_points=(
            "循环队列需要用取模处理队尾回绕，并明确队满与队空判定策略。",
            "栈常用于括号匹配、表达式求值、递归模拟；队列常用于 BFS、缓冲区和层序遍历。",
            "双端队列和优先队列不是普通队列的简单替换，要明确操作约束和适用问题。",
        ),
        comparisons=(
            "栈解决“最近未完成”的问题，队列解决“最早等待”的问题。",
            "顺序实现更紧凑，链式实现更方便动态扩展。",
        ),
    ),
    "array": LectureSourcePack(
        key="array",
        title="数组和广义表",
        base_url=f"{BASE_NOTES_URL}%E6%95%B0%E7%BB%84%E5%92%8C%E5%B9%BF%E4%B9%89%E8%A1%A8/",
        advanced_url=f"{ADVANCED_NOTES_URL}#%E6%95%B0%E7%BB%84",
        base_points=(
            "数组是定长、同类型元素的多维线性扩展，重点在下标到地址的映射。",
            "特殊矩阵可以利用对称性或稀疏性压缩存储。",
            "广义表允许元素本身仍是表，适合表达递归结构。",
        ),
        advanced_points=(
            "拔高讲解应覆盖行优先/列优先地址公式，以及为什么公式本质是偏移量计算。",
            "稀疏矩阵三元组、十字链表、快速转置体现的是用额外索引换取操作效率。",
            "广义表要区分表头、表尾、深度和长度，避免把嵌套层级与元素个数混淆。",
        ),
        comparisons=(
            "普通数组追求 O(1) 定位；压缩存储追求节省空间。",
            "矩阵压缩是否划算，取决于零元素比例和常用操作。",
        ),
    ),
    "tree": LectureSourcePack(
        key="tree",
        title="树和二叉树",
        base_url=f"{BASE_NOTES_URL}%E6%A0%91%E5%92%8C%E4%BA%8C%E5%8F%89%E6%A0%91/",
        advanced_url=f"{ADVANCED_NOTES_URL}#%E6%A0%91%E4%B8%8E%E4%BA%8C%E5%8F%89%E6%A0%91",
        base_points=(
            "树表示层次关系，二叉树是每个结点最多有两个孩子的特殊树结构。",
            "遍历是树算法的基本语言，前序、中序、后序和层序各有语义。",
            "二叉树可以用顺序结构或链式结构存储。",
        ),
        advanced_points=(
            "拔高内容应覆盖二叉树性质、遍历序列还原、树森林与二叉树互转。",
            "线索二叉树利用空指针域保存遍历前驱/后继，是空间复用思想。",
            "哈夫曼树与编码体现带权路径长度最小化，要从贪心选择证明理解。",
        ),
        comparisons=(
            "顺序存储适合完全二叉树，普通树形结构更常用链式存储。",
            "递归遍历易写，非递归遍历更能暴露栈和访问时机。",
        ),
    ),
    "graph": LectureSourcePack(
        key="graph",
        title="图",
        base_url=f"{BASE_NOTES_URL}%E5%9B%BE/",
        advanced_url=f"{ADVANCED_NOTES_URL}#%E5%9B%BE",
        base_points=(
            "图描述多对多关系，基础概念包括顶点、边、度、路径、连通性和权值。",
            "邻接矩阵适合稠密图，邻接表适合稀疏图。",
            "DFS 与 BFS 是图算法的两种基础遍历框架。",
        ),
        advanced_points=(
            "最小生成树、最短路径、拓扑排序和关键路径都应从问题建模出发，而不只是记算法步骤。",
            "邻接矩阵、邻接表、十字链表和邻接多重表的取舍取决于图类型和操作频率。",
            "图算法常见失误是忽略有向/无向、带权/无权、连通/非连通的前提差异。",
        ),
        comparisons=(
            "邻接矩阵查边快但空间 O(n^2)，邻接表省空间但查指定边较慢。",
            "DFS偏向深入探索，BFS按距离层次推进。",
        ),
    ),
    "search": LectureSourcePack(
        key="search",
        title="查找",
        base_url=f"{BASE_NOTES_URL}%E6%9F%A5%E6%89%BE/",
        advanced_url=f"{ADVANCED_NOTES_URL}#%E6%9F%A5%E6%89%BE",
        base_points=(
            "查找关注在集合中定位目标元素，常用指标是平均查找长度和时间复杂度。",
            "顺序查找适合无序表，折半查找要求有序且支持随机访问。",
            "散列表通过散列函数把关键字映射到存储位置。",
        ),
        advanced_points=(
            "动态查找表要关注插入删除后的结构维护，例如二叉排序树和平衡树。",
            "散列表拔高点是冲突处理、装填因子和散列函数设计。",
            "B-树和 B+树要结合外存块读写理解，而不是只背结点阶数。",
        ),
        comparisons=(
            "折半查找快，但前提比顺序查找更严格。",
            "散列追求平均 O(1)，但最坏情况受冲突和装填因子影响。",
        ),
    ),
    "sort": LectureSourcePack(
        key="sort",
        title="排序",
        base_url=f"{BASE_NOTES_URL}%E6%8E%92%E5%BA%8F/",
        advanced_url=f"{ADVANCED_NOTES_URL}#%E6%8E%92%E5%BA%8F",
        base_points=(
            "排序是把记录按关键字重新排列，核心评价维度是时间、空间和稳定性。",
            "插入、交换、选择、归并等方法体现不同的数据移动策略。",
            "内部排序关注内存内操作，外部排序还要考虑磁盘读写。",
        ),
        advanced_points=(
            "拔高讲解要比较最好、平均、最坏复杂度，而不是只记一个 O 表达式。",
            "稳定性取决于相等关键字的相对顺序是否保持，常影响多关键字排序。",
            "快速排序、堆排序、归并排序的优势分别来自分治、选择最大/最小、合并有序序列。",
        ),
        comparisons=(
            "快排平均快但最坏退化；归并稳定但需要额外空间；堆排空间省但不稳定。",
            "数据规模、初始有序程度和稳定性要求会改变排序选择。",
        ),
    ),
}


GENERAL_PACK = LectureSourcePack(
    key="general",
    title="数据结构通用知识点",
    base_url=BASE_NOTES_URL,
    advanced_url=ADVANCED_NOTES_URL,
    base_points=(
        "先判断知识点属于逻辑结构、存储结构还是操作算法，再展开讲解。",
        "基础讲义应解释定义、用途、核心操作和复杂度直觉。",
        "所有数据结构都要回到“数据如何组织、如何存储、如何操作”这三个问题。",
    ),
    advanced_points=(
        "拔高讲解要补充适用场景、边界条件、复杂度来源和与相邻知识点的对比。",
        "如果涉及算法，应说明输入条件、关键不变量、终止条件和常见退化情况。",
        "如果涉及存储结构，应说明空间代价、访问方式和修改成本。",
    ),
    comparisons=(
        "逻辑结构回答元素之间是什么关系；存储结构回答这种关系怎样落到内存。",
        "复杂度结论要绑定前提，脱离前提的 O 表达式容易误导。",
    ),
)


def select_reference_pack(point_name: str, domain_name: str, subject_name: str = "") -> LectureSourcePack:
    text = f"{subject_name} {domain_name} {point_name}".lower()
    aliases: tuple[tuple[str, tuple[str, ...]], ...] = (
        ("linear_list", ("线性表", "顺序表", "链表", "单链表", "双向链表", "循环链表", "linear list", "linked list")),
        ("stack_queue", ("栈", "队列", "stack", "queue")),
        ("array", ("数组", "广义表", "矩阵", "稀疏", "array", "matrix")),
        ("tree", ("树", "二叉树", "哈夫曼", "线索", "森林", "tree", "binary")),
        ("graph", ("图", "最短路径", "拓扑", "关键路径", "生成树", "dfs", "bfs", "graph")),
        ("search", ("查找", "散列", "哈希", "b树", "b+树", "二叉排序", "search", "hash")),
        ("sort", ("排序", "快排", "归并", "堆排序", "插入排序", "选择排序", "sort")),
    )
    for key, words in aliases:
        if any(word in text for word in words):
            return REFERENCE_PACKS[key]
    return GENERAL_PACK


def build_lecture_prompt(
    *,
    subject_name: str,
    domain_name: str,
    point_name: str,
    description: str,
) -> str:
    pack = select_reference_pack(point_name, domain_name, subject_name)
    return f"""你是数据结构课程讲义编写助手。请为学习路径中的知识点生成一份 Markdown 阅读讲义。

学科：{subject_name or "未命名学科"}
章节：{domain_name or "未分组章节"}
知识点：{point_name}
知识点描述：{description or "无"}

资料依据：
1. 基础讲解参考《数据结构与算法设计复习笔记》的"{pack.title}"章节，资料链接：{pack.base_url}
   可采用的讲解骨架：
{_format_bullets(pack.base_points)}

2. 知识拔高参考《数据结构复习笔记 - CK_0ff》中相关目录，资料链接：{pack.advanced_url}
   可采用的拔高角度：
{_format_bullets(pack.advanced_points)}

3. 对比和易错依据：
{_format_bullets(pack.comparisons)}

输出要求：
- 必须输出 Markdown，不要输出 JSON。
- 不要照抄参考网页原文，要用自己的语言重新组织。
- 结构固定为：
  # {point_name} 阅读讲义
  ## 基础讲解
  ## 知识拔高
  ## 易错点与辨析
  ## 练习导向
  ## 自测清单
  ## 参考来源
- "基础讲解"要像教材，讲清定义、结构、操作和复杂度直觉。
- "知识拔高"要比基础讲解更深入，包含前提、边界、实现细节、复杂度来源或工程取舍。
- "练习导向"给出 3 个适合本知识点的练习方向，不要编造具体题号。
- "参考来源"必须列出上面的两个 URL。
- 语言用中文，准确、可学习，不要空泛鼓励。

**图文讲解要求——重要**：
- 必须在「基础讲解」或「知识拔高」部分，根据内容需要插入至少 1 张 Mermaid 图表，用 [MERMAID]...[/MERMAID] 包裹。
- 图表类型根据知识点选择：
  - 数据结构的分类或层次关系 → graph TD（自顶向下流程图）或 mindmap（思维导图）
  - 算法流程或操作步骤 → graph TD 或 graph LR（流程图）
  - 数据结构的存储关系 → graph LR（结构示意图）
  - 多个概念对比 → graph TD（概念关系图）
- 图表要简洁清晰，中文字符用双引号包裹（例如 A[“顺序表”]）。
- Mermaid 代码示例格式：
[MERMAID]
graph TD
    A["线性表"] --> B["顺序存储"]
    A --> C[“链式存储”]
    B --> D[“数组实现”]
    C --> E[“单链表”]
    C --> F[“双向链表”]
[/MERMAID]
- 图表应紧跟在相关文字讲解之后，图文呼应。
- 你的回复中不要提到"mermaid"、"图表代码"等词汇——所有图表自动渲染为可视化图形。"""


def build_source_based_lecture(
    *,
    subject_name: str,
    domain_name: str,
    point_name: str,
    description: str,
) -> str:
    pack = select_reference_pack(point_name, domain_name, subject_name)
    context_line = f'{point_name} 属于"{domain_name or pack.title}"中的知识点。'
    if description:
        context_line += f" 当前知识图谱描述为：{description}"

    return f"""# {point_name} 阅读讲义

> 资料参考讲义：当前未调用大模型，内容根据项目知识点信息和公开数据结构复习资料的结构化要点生成。配置 DeepSeek 或 Qwen 后，可点击更新生成更贴合个人学习记录的版本。

## 基础讲解

{context_line}

{_format_bullets(pack.base_points)}

学习时先抓住三个问题：它表达什么关系、通常怎样存储、常见操作的代价来自哪里。这样再看代码或题目时，就不会只背结论。

## 知识拔高

{_format_bullets(pack.advanced_points)}

拔高部分建议把每个复杂度结论都追问一次"为什么"：是因为需要扫描、移动元素、维护指针，还是因为额外结构减少了查找成本。

## 易错点与辨析

{_format_bullets(pack.comparisons)}

常见错误是把抽象概念和具体实现混在一起。答题时先说明前提，再给出结论；如果前提变化，复杂度和适用场景也可能变化。

## 练习导向

- 画出本知识点的逻辑结构和一种典型存储结构，并标注关键字段或下标含义。
- 手写至少两个基本操作的过程，重点标出边界条件和失败返回。
- 对比本知识点与相邻知识点的访问、插入、删除或遍历代价。

## 自测清单

- 我能否用一句话区分"逻辑结构"和"存储结构"？
- 我能否说出这个知识点最适合解决什么问题、不适合什么问题？
- 我能否解释复杂度结论背后的数据移动、指针修改或扫描过程？

## 参考来源

- [数据结构与算法设计复习笔记：{pack.title}]({pack.base_url})
- [数据结构复习笔记 - CK_0ff：{pack.title}]({pack.advanced_url})
"""


def _format_bullets(items: Iterable[str]) -> str:
    return "\n".join(f"- {item}" for item in items)
