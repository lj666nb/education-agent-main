"""
综合种子数据脚本 — 在 app 启动时自动执行。

职责（按顺序）：
  1. 创建测试用户 guoketg（如不存在）
  2. 注入完整学科数据（知识点、题库、题目）
  3. 注入代码案例资源（供测试用户查看）
  4. 构建 Neo4j 知识图谱

所有操作幂等：已存在的数据会跳过，不会重复创建。
"""
import json
import logging
import os
import sys
import uuid as _uuid
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.db.neo4j import get_neo4j, Neo4jConnection
from app.models.question_bank import (
    Subject, KnowledgeDomain, KnowledgePoint, QuestionBank, Question, CodingTestCase,
    KnowledgePointRecord, KnowledgePointLecture,
)
from app.models.path_state import LearningPathState
from app.models.resource import KnowledgeResource
from app.models.user import User, UserProfile, UserRole, UserStatus
from app.core.security import get_password_hash
from app.services.knowledge_lecture_builder import build_source_based_lecture, get_lecture_source
from datetime import datetime, timezone, timedelta

logger = logging.getLogger("uvicorn")

# ── 系统常量 ──
SYSTEM_OWNER_ID = UUID("00000000-0000-0000-0000-000000000000")
SEED_BANK_ID = UUID("2ce6ee7d-ed5a-42a1-8a26-6ad6856afd3e")
SEED_BANK_NAME = "数据结构题库"
SEED_SUBJECT_NAME = "数据结构"

# All source markers used by seed-generated questions — used to identify
# seed-owned questions during cleanup so user-created questions are never touched.
_SEED_SOURCES = {"curated_seed", "oj_curated", "ai_objective", "dotcpp_exam", "totuma_coding", "manual"}

# ── 章节与知识点定义 ──
# 格式: [(章节名, 章节描述, [(知识点名, 难度1-5, 排序), ...]), ...]
DOMAINS = [
    ("绪论", "数据结构的基本概念、算法描述和算法分析",
     [("数据结构的基本概念", 1, 1),
      ("抽象数据类型", 1, 2),
      ("算法和算法描述", 1, 3),
      ("算法时间复杂度分析", 2, 4),
      ("算法空间复杂度分析", 2, 5),
      ("最坏情况和平均情况", 2, 6)]),

    ("线性表", "线性表的定义、顺序存储和链式存储结构",
     [("线性表的定义和逻辑结构", 1, 1),
      ("顺序表的定义和实现", 1, 2),
      ("顺序表的基本操作（插入、删除、查找）", 2, 3),
      ("单链表的定义和实现", 2, 4),
      ("单链表的基本操作", 2, 5),
      ("循环链表", 3, 6),
      ("双向链表", 3, 7),
      ("静态链表", 3, 8),
      ("顺序表和链表的比较", 2, 9)]),

    ("栈和队列", "栈和队列的定义、存储结构和应用",
     [("栈的定义和基本操作", 1, 1),
      ("顺序栈的实现", 1, 2),
      ("链栈的实现", 2, 3),
      ("栈的应用（括号匹配、表达式求值）", 3, 4),
      ("队列的定义和基本操作", 1, 5),
      ("循环队列的实现", 2, 6),
      ("链队列的实现", 2, 7),
      ("队列的应用（层次遍历、缓冲区）", 3, 8)]),

    ("串", "串的定义、存储结构和模式匹配算法",
     [("串的定义和基本操作", 1, 1),
      ("串的顺序存储", 1, 2),
      ("串的链式存储", 2, 3),
      ("朴素模式匹配算法", 2, 4),
      ("KMP 算法", 4, 5),
      ("next 数组的求解", 4, 6)]),

    ("数组和广义表", "数组的顺序存储、特殊矩阵的压缩存储和广义表",
     [("数组的定义和顺序存储", 1, 1),
      ("特殊矩阵的压缩存储（对称矩阵、三角矩阵）", 3, 2),
      ("稀疏矩阵的三元组表示", 3, 3),
      ("稀疏矩阵的十字链表表示", 4, 4),
      ("广义表的定义和基本操作", 3, 5),
      ("广义表的存储结构", 3, 6)]),

    ("树和二叉树", "树的定义、二叉树的遍历、线索二叉树、树和森林",
     [("树的定义和基本术语", 1, 1),
      ("二叉树的定义和性质", 1, 2),
      ("二叉树的顺序存储", 1, 3),
      ("二叉树的链式存储", 2, 4),
      ("二叉树的先序遍历", 2, 5),
      ("二叉树的中序遍历", 2, 6),
      ("二叉树的后序遍历", 2, 7),
      ("二叉树的层次遍历", 2, 8),
      ("根据遍历序列重建二叉树", 3, 9),
      ("线索二叉树的定义和构造", 3, 10),
      ("树的存储结构（双亲、孩子、兄弟）", 2, 11),
      ("森林与二叉树的转换", 3, 12),
      ("树和森林的遍历", 2, 13),
      ("哈夫曼树和哈夫曼编码", 3, 14),
      ("并查集", 3, 15)]),

    ("图", "图的定义、存储结构、遍历和最小生成树、最短路径等算法",
     [("图的定义和基本术语", 1, 1),
      ("邻接矩阵存储", 2, 2),
      ("邻接表存储", 2, 3),
      ("深度优先搜索（DFS）", 2, 4),
      ("广度优先搜索（BFS）", 2, 5),
      ("最小生成树（Prim 算法）", 3, 6),
      ("最小生成树（Kruskal 算法）", 3, 7),
      ("最短路径（Dijkstra 算法）", 4, 8),
      ("最短路径（Floyd 算法）", 4, 9),
      ("拓扑排序", 3, 10),
      ("关键路径", 4, 11)]),

    ("查找", "静态查找表、动态查找表和哈希表",
     [("顺序查找", 1, 1),
      ("折半查找", 2, 2),
      ("分块查找", 3, 3),
      ("二叉排序树（BST）", 2, 4),
      ("二叉排序树的插入和删除", 3, 5),
      ("平衡二叉树（AVL）", 4, 6),
      ("B-树", 4, 7),
      ("B+树", 4, 8),
      ("哈希表的定义和构造方法", 3, 9),
      ("哈希冲突处理（开放地址法）", 3, 10),
      ("哈希冲突处理（链地址法）", 3, 11),
      ("哈希表的查找和分析", 3, 12)]),

    ("排序", "各种内部排序方法",
     [("排序的基本概念", 1, 1),
      ("直接插入排序", 2, 2),
      ("折半插入排序", 2, 3),
      ("希尔排序", 3, 4),
      ("冒泡排序", 2, 5),
      ("快速排序", 3, 6),
      ("简单选择排序", 2, 7),
      ("堆排序", 4, 8),
      ("归并排序（二路）", 3, 9),
      ("基数排序", 3, 10),
      ("各种排序方法的比较", 3, 11)]),
]

# ── 题目定义 ──
# (知识点序号_从1开始, 题型, 难度, 题干, 选项列表/None, 答案, 解析)
QUESTIONS_DATA = [
    # ── 绪论 —— 知识点 1~6 ──
    (1, "single_choice", 1,
     "数据结构是指（ ）。",
     [{"key": "A", "text": "数据元素的集合"}, {"key": "B", "text": "数据的存储结构"},
      {"key": "C", "text": "相互之间存在一种或多种特定关系的数据元素的集合"}, {"key": "D", "text": "数据的逻辑结构"}],
     "C", "数据结构是相互之间存在一种或多种特定关系的数据元素的集合。"),
    (1, "single_choice", 1,
     "数据的逻辑结构可以分为（ ）。",
     [{"key": "A", "text": "顺序结构和链式结构"}, {"key": "B", "text": "线性结构和非线性结构"},
      {"key": "C", "text": "存储结构和逻辑结构"}, {"key": "D", "text": "静态结构和动态结构"}],
     "B", "逻辑结构分为线性结构（线性表、栈、队列等）和非线性结构（树、图等）。"),
    (4, "single_choice", 2,
     "算法的时间复杂度取决于（ ）。",
     [{"key": "A", "text": "问题的规模"}, {"key": "B", "text": "待处理数据的初态"},
      {"key": "C", "text": "A和B"}, {"key": "D", "text": "以上都不对"}],
     "C", "时间复杂度与问题规模和数据初态都有关。"),
    (4, "single_choice", 2,
     "下面程序段的时间复杂度是：\nfor(i=0; i<n; i++)\n  for(j=0; j<n; j++)\n    x++;",
     [{"key": "A", "text": "O(n)"}, {"key": "B", "text": "O(n²)"}, {"key": "C", "text": "O(log n)"}, {"key": "D", "text": "O(n³)"}],
     "B", "双层循环，外层n次，内层n次，总执行次数为n²。"),
    (4, "single_choice", 3,
     "下面程序段的时间复杂度是：\ni=1;\nwhile(i<=n)\n  i=i*2;",
     [{"key": "A", "text": "O(n)"}, {"key": "B", "text": "O(n²)"}, {"key": "C", "text": "O(log₂n)"}, {"key": "D", "text": "O(2ⁿ)"}],
     "C", "i每次翻倍，执行次数k满足2^k≤n，即k≈log₂n。"),
    (5, "single_choice", 2,
     "算法的空间复杂度是指（ ）。",
     [{"key": "A", "text": "算法程序中的语句条数"}, {"key": "B", "text": "算法程序所占的存储空间"},
      {"key": "C", "text": "算法执行过程中所需的存储空间"}, {"key": "D", "text": "算法程序的大小"}],
     "C", "空间复杂度是算法执行过程中所需的额外存储空间。"),

    # ── 线性表 —— 知识点 7~15 ──
    (7, "single_choice", 1,
     "线性表采用顺序存储时，其地址（ ）。",
     [{"key": "A", "text": "必须是连续的"}, {"key": "B", "text": "可以是不连续的"},
      {"key": "C", "text": "部分连续部分不连续"}, {"key": "D", "text": "以上都不对"}],
     "A", "顺序存储的线性表，其物理地址必须是连续的。"),
    (8, "single_choice", 2,
     "在顺序表中插入一个元素，平均需要移动的元素个数是（ ）。",
     [{"key": "A", "text": "n"}, {"key": "B", "text": "n/2"}, {"key": "C", "text": "(n+1)/2"}, {"key": "D", "text": "n-1"}],
     "B", "在第i个位置插入需移动n-i+1个元素，平均移动n/2个元素。"),
    (9, "single_choice", 2,
     "单链表中，在p指向的结点后插入q指向的新结点，正确的操作是（ ）。",
     [{"key": "A", "text": "p->next = q; q->next = p->next;"}, {"key": "B", "text": "q->next = p->next; p->next = q;"},
      {"key": "C", "text": "p->next = q; q->next = p;"}, {"key": "D", "text": "q->next = p; p->next = q;"}],
     "B", "先让q指向p的后继结点，再让p指向q，防止链表断裂。"),
    (9, "single_choice", 2,
     "单链表中，删除p指向的结点的后继结点，正确的操作是（ ）。",
     [{"key": "A", "text": "p = p->next;"}, {"key": "B", "text": "p->next = p->next->next;"},
      {"key": "C", "text": "p->next = p;"}, {"key": "D", "text": "free(p->next);"}],
     "B", "跳过p的后继结点，将其指向下下个结点。"),
    (9, "single_choice", 1,
     "链表不具备的特点是（ ）。",
     [{"key": "A", "text": "可随机访问任意元素"}, {"key": "B", "text": "插入删除不需要移动元素"},
      {"key": "C", "text": "存储空间不必连续"}, {"key": "D", "text": "所需空间与线性表长度成正比"}],
     "A", "链表只能顺序访问，不支持随机访问。"),
    (10, "single_choice", 3,
     "在循环链表中，判断某链表L为空的条件是（ ）。",
     [{"key": "A", "text": "L == NULL"}, {"key": "B", "text": "L->next == NULL"},
      {"key": "C", "text": "L->next == L"}, {"key": "D", "text": "L != NULL"}],
     "C", "带头结点的循环链表为空时，头结点的next指向自身。"),

    # ── 栈和队列 —— 知识点 16~23 ──
    (16, "single_choice", 1,
     "栈的特点是（ ）。",
     [{"key": "A", "text": "先进先出"}, {"key": "B", "text": "先进后出"},
      {"key": "C", "text": "随机访问"}, {"key": "D", "text": "两端都可以插入删除"}],
     "B", "栈是后进先出（LIFO）的线性表。"),
    (16, "single_choice", 1,
     "一个栈的入栈序列是a,b,c,d,e，则栈不可能的输出序列是（ ）。",
     [{"key": "A", "text": "edcba"}, {"key": "B", "text": "decba"}, {"key": "C", "text": "dceab"}, {"key": "D", "text": "abcde"}],
     "C", "d出栈时a,b,c还在栈中，顺序应为c,b,a，所以e不可能在a之前。"),
    (19, "single_choice", 3,
     "表达式a*(b+c)-d的后缀表达式是（ ）。",
     [{"key": "A", "text": "abc+*d-"}, {"key": "B", "text": "abc*+d-"}, {"key": "C", "text": "ab+c*d-"}, {"key": "D", "text": "abc+d*-"}],
     "A", "先算b+c→bc+，再乘a→abc+*，最后减d→abc+*d-。"),
    (20, "single_choice", 1,
     "队列的特点是（ ）。",
     [{"key": "A", "text": "先进先出"}, {"key": "B", "text": "先进后出"},
      {"key": "C", "text": "随机访问"}, {"key": "D", "text": "只能在队尾删除"}],
     "A", "队列是先进先出（FIFO）的线性表。"),
    (21, "single_choice", 2,
     "循环队列中，判断队列满的条件是（front指向队头，rear指向队尾的下一个位置）。",
     [{"key": "A", "text": "front == rear"}, {"key": "B", "text": "(rear+1)%MAXSIZE == front"},
      {"key": "C", "text": "rear+1 == front"}, {"key": "D", "text": "front == MAXSIZE"}],
     "B", "循环队列常用牺牲一个空间来区分队空和队满。"),

    # ── 串 —— 知识点 24~29 ──
    (24, "single_choice", 2,
     "字符串“ABCDEF”的子串个数是（ ）。",
     [{"key": "A", "text": "21"}, {"key": "B", "text": "22"}, {"key": "C", "text": "27"}, {"key": "D", "text": "28"}],
     "B", "长度为n的字符串的子串个数为n(n+1)/2+1（含空串）=6×7/2+1=22。"),
    (27, "single_choice", 4,
     "KMP算法的核心思想是（ ）。",
     [{"key": "A", "text": "每次匹配失败后模式串右移一位"}, {"key": "B", "text": "利用已匹配部分的信息避免不必要的比较"},
      {"key": "C", "text": "从后往前匹配"}, {"key": "D", "text": "使用哈希函数加速比较"}],
     "B", "KMP通过next数组利用已匹配的信息，避免主串回溯，提高效率。"),

    # ── 树和二叉树 —— 知识点 30~44 ──
    (31, "single_choice", 1,
     "二叉树第i层（i≥1）最多有（ ）个结点。",
     [{"key": "A", "text": "2ⁱ"}, {"key": "B", "text": "2ⁱ⁻¹"}, {"key": "C", "text": "2ⁱ⁺¹"}, {"key": "D", "text": "i"}],
     "B", "二叉树第i层最多有2^(i-1)个结点（i≥1）。"),
    (32, "single_choice", 2,
     "二叉树中，叶子结点个数为n₀，度为2的结点个数为n₂，则n₀和n₂的关系是（ ）。",
     [{"key": "A", "text": "n₀ = n₂ + 1"}, {"key": "B", "text": "n₀ = n₂"},
      {"key": "C", "text": "n₀ = n₂ - 1"}, {"key": "D", "text": "n₀ = 2n₂"}],
     "A", "在任何非空二叉树中，叶子结点数=度为2的结点数+1。"),
    (36, "single_choice", 2,
     "已知二叉树先序遍历序列为ABDCEF，中序遍历序列为DBAECF，则后序遍历序列为（ ）。",
     [{"key": "A", "text": "DBEFCA"}, {"key": "B", "text": "DBEFAC"}, {"key": "C", "text": "BDAECF"}, {"key": "D", "text": "DBFECA"}],
     "A", "先序A为根，中序DBAECF分为左(DB)右(ECF)子树，递归可得后序DBEFCA。"),
    (43, "single_choice", 3,
     "哈夫曼树中，带权路径长度（WPL）是指（ ）。",
     [{"key": "A", "text": "所有叶子结点的权值之和"}, {"key": "B", "text": "所有叶子结点到根结点的路径长度之和"},
      {"key": "C", "text": "所有叶子结点的权值×路径长度之和"}, {"key": "D", "text": "所有内部结点的权值之和"}],
     "C", "WPL=∑(叶子结点权值×路径长度)。"),
    (43, "single_choice", 3,
     "一组权值{7,5,2,4}构造的哈夫曼树的带权路径长度WPL是（ ）。",
     [{"key": "A", "text": "35"}, {"key": "B", "text": "36"}, {"key": "C", "text": "37"}, {"key": "D", "text": "38"}],
     "A", "构造哈夫曼树：2+4=6, 5+6=11, 7+11=18。WPL=(7×1+5×2+2×3+4×3)=7+10+6+12=35。"),

    # ── 图 —— 知识点 45~55 ──
    (45, "single_choice", 1,
     "图中路径的定义是（ ）。",
     [{"key": "A", "text": "从一个顶点到另一个顶点的任意边"}, {"key": "B", "text": "顶点序列(v₁,v₂,...,vₖ)，相邻顶点间有边"},
      {"key": "C", "text": "边的集合"}, {"key": "D", "text": "顶点的集合"}],
     "B", "路径是由顶点序列组成的，且序列中相邻顶点间都存在边。"),
    (46, "single_choice", 2,
     "n个顶点的无向图，邻接矩阵的大小是（ ）。",
     [{"key": "A", "text": "n×n"}, {"key": "B", "text": "n×(n-1)"}, {"key": "C", "text": "(n-1)×(n-1)"}, {"key": "D", "text": "n"}],
     "A", "邻接矩阵是n×n的方阵，n为顶点数。"),
    (48, "single_choice", 3,
     "DFS遍历图的时间复杂度（邻接表存储）是（ ）。",
     [{"key": "A", "text": "O(n)"}, {"key": "B", "text": "O(n+e)"}, {"key": "C", "text": "O(n²)"}, {"key": "D", "text": "O(n×e)"}],
     "B", "邻接表DFS：访问所有顶点O(n)，遍历所有边O(e)，总O(n+e)。"),
    (50, "short_answer", 3,
     "简述Prim算法和Kruskal算法的区别。",
     None,
     "Prim算法：从某个顶点开始，每次选择与当前集合相连的最小权边，适合稠密图。Kruskal算法：每次选择全局最小权边，边数到n-1为止，适合稀疏图。",
     "Prim从顶点出发扩展，Kruskal从边出发选择。"),
    (52, "single_choice", 4,
     "Dijkstra算法不能处理（ ）。",
     [{"key": "A", "text": "有向图"}, {"key": "B", "text": "无向图"}, {"key": "C", "text": "带权图"}, {"key": "D", "text": "负权边"}],
     "D", "Dijkstra算法基于贪心，不能处理负权边（负权边需用Floyd或Bellman-Ford）。"),

    # ── 查找 —— 知识点 56~67 ──
    (57, "single_choice", 2,
     "在有序表{1,3,9,12,32,41,62,75,77,82,95,100}中折半查找62，需要比较（ ）次。",
     [{"key": "A", "text": "1"}, {"key": "B", "text": "2"}, {"key": "C", "text": "3"}, {"key": "D", "text": "4"}],
     "C", "第一次mid=41→右半，第二次mid=75→左半，第三次mid=62→找到。"),
    (61, "single_choice", 4,
     "平衡二叉树（AVL树）中，每个结点的平衡因子取值范围是（ ）。",
     [{"key": "A", "text": "[-2, 2]"}, {"key": "B", "text": "[-1, 1]"}, {"key": "C", "text": "[0, 1]"}, {"key": "D", "text": "[-1, 2]"}],
     "B", "AVL树中每个结点的平衡因子（左高-右高）的绝对值不超过1。"),
    (62, "single_choice", 4,
     "下列关于B-树的说法，错误的是（ ）。",
     [{"key": "A", "text": "B-树是一棵平衡的多路查找树"}, {"key": "B", "text": "B-树的所有叶子结点在同一层"},
      {"key": "C", "text": "B-树中一个结点可以有多个关键字"}, {"key": "D", "text": "B-树只能在叶子结点中查找"}],
     "D", "B-树的查找可以在所有结点中进行，不仅仅是叶子结点。"),
    (64, "single_choice", 3,
     "哈希查找中，冲突是指（ ）。",
     [{"key": "A", "text": "两个关键字的值相同"}, {"key": "B", "text": "两个关键字映射到同一个地址"},
      {"key": "C", "text": "关键字与地址相同"}, {"key": "D", "text": "关键字个数超过表长"}],
     "B", "两个不同的关键字被散列函数映射到同一个地址称为冲突。"),

    # ── 排序 —— 知识点 68~78 ──
    (69, "single_choice", 2,
     "直接插入排序的时间复杂度是（ ）。",
     [{"key": "A", "text": "O(n)"}, {"key": "B", "text": "O(n²)"}, {"key": "C", "text": "O(nlog n)"}, {"key": "D", "text": "O(n³)"}],
     "B", "直接插入排序平均和最坏情况时间复杂度为O(n²)。"),
    (73, "single_choice", 2,
     "冒泡排序中，当初始序列为升序时，比较次数是（ ）。",
     [{"key": "A", "text": "n-1"}, {"key": "B", "text": "n"}, {"key": "C", "text": "n(n-1)/2"}, {"key": "D", "text": "n²/2"}],
     "A", "初始已有序时，只需一趟遍历进行n-1次比较，无交换。"),
    (74, "single_choice", 3,
     "快速排序在最坏情况下的时间复杂度是（ ）。",
     [{"key": "A", "text": "O(n)"}, {"key": "B", "text": "O(nlog n)"}, {"key": "C", "text": "O(n²)"}, {"key": "D", "text": "O(n³)"}],
     "C", "当每次划分极不平衡时（如已有序），快排退化为O(n²)。"),
    (75, "single_choice", 2,
     "简单选择排序中，交换元素的次数是（ ）。",
     [{"key": "A", "text": "O(n)"}, {"key": "B", "text": "O(n²)"}, {"key": "C", "text": "O(log n)"}, {"key": "D", "text": "O(1)"}],
     "A", "每趟选择后交换一次，共n-1趟，交换O(n)次。"),
    (76, "single_choice", 4,
     "堆排序中，建堆的时间复杂度是（ ）。",
     [{"key": "A", "text": "O(n)"}, {"key": "B", "text": "O(nlog n)"}, {"key": "C", "text": "O(n²)"}, {"key": "D", "text": "O(log n)"}],
     "A", "建堆的向上/下调整可在线性时间内完成，为O(n)。"),
    (77, "single_choice", 3,
     "二路归并排序的时间复杂度是（ ）。",
     [{"key": "A", "text": "O(n)"}, {"key": "B", "text": "O(n²)"}, {"key": "C", "text": "O(nlog n)"}, {"key": "D", "text": "O(log n)"}],
     "C", "归并排序每趟O(n)，共log₂n趟，总O(nlog n)。"),
    (78, "single_choice", 3,
     "以下排序算法中，稳定的是（ ）。",
     [{"key": "A", "text": "快速排序"}, {"key": "B", "text": "堆排序"}, {"key": "C", "text": "直接插入排序"}, {"key": "D", "text": "简单选择排序"}],
     "C", "直接插入排序是稳定的，快排、堆排、选择排序都不稳定。"),
]

# ── 代码案例定义 ──
CODE_FILES = [
    ("01_seqlist.py",            ["顺序表实现", "顺序表的定义和实现", "顺序表操作", "顺序表的基本操作（插入、删除、查找）"],
     "【顺序表】实现与基本操作"),
    ("02_linkedlist.py",         ["单链表", "单链表的定义和实现", "单链表的基本操作"],
     "【单链表】定义与基本操作"),
    ("03_doubly_linkedlist.py",  ["双链表", "双向链表"],
     "【双向链表】实现与基本操作"),
    ("04_stack.py",              ["顺序栈", "顺序栈的实现"],
     "【顺序栈】实现与基本操作"),
    ("05_circular_queue.py",     ["循环队列", "循环队列的实现"],
     "【循环队列】实现与基本操作"),
    ("06_bracket_matching.py",   ["栈的应用", "栈的应用（括号匹配、表达式求值）"],
     "【栈的应用】括号匹配与表达式求值"),
    ("07_binary_tree.py",        ["二叉树定义", "二叉树的定义和性质", "二叉树遍历", "二叉树的链式存储"],
     "【二叉树】链式存储与遍历"),
    ("08_huffman.py",            ["哈夫曼树", "哈夫曼树和哈夫曼编码"],
     "【哈夫曼树】构建与编码"),
    ("09_adjacency_matrix.py",   ["邻接矩阵", "邻接矩阵存储"],
     "【邻接矩阵】图的存储结构"),
    ("10_dfs.py",                ["DFS", "深度优先搜索（DFS）"],
     "【DFS】深度优先搜索"),
    ("11_bfs.py",                ["BFS", "广度优先搜索（BFS）"],
     "【BFS】广度优先搜索"),
    ("12_dijkstra.py",           ["Dijkstra", "最短路径（Dijkstra 算法）"],
     "【Dijkstra】最短路径算法"),
    ("13_bubble_sort.py",        ["冒泡排序"],
     "【冒泡排序】排序算法"),
    ("14_quick_sort.py",         ["快速排序"],
     "【快速排序】排序算法"),
    ("15_merge_sort.py",         ["归并排序", "归并排序（二路）"],
     "【归并排序】分治排序"),
    ("16_heap_sort.py",          ["堆排序"],
     "【堆排序】排序算法"),
    ("17_binary_search.py",      ["折半查找"],
     "【折半查找】查找算法"),
    ("18_bst.py",                ["BST", "二叉排序树（BST）"],
     "【BST】二叉排序树"),
    ("19_avl.py",                ["AVL", "平衡二叉树（AVL）"],
     "【AVL】平衡二叉树"),
]

# ── 辅助函数 ──

def _sync_subject_to_neo4j(neo4j: Neo4jConnection, subject: Subject):
    with neo4j.connect().session() as session:
        session.run(
            "MERGE (s:Subject {uuid: $uuid}) SET s.name = $name",
            uuid=str(subject.id), name=subject.name
        )


def _sync_domain_to_neo4j(neo4j: Neo4jConnection, domain: KnowledgeDomain, subject_id: UUID):
    with neo4j.connect().session() as session:
        session.run(
            """
            MERGE (d:KnowledgeDomain {uuid: $uuid}) SET d.name = $name
            WITH d MATCH (s:Subject {uuid: $sid})
            MERGE (d)-[:BELONGS_TO]->(s)
            """, uuid=str(domain.id), name=domain.name, sid=str(subject_id)
        )


def _sync_point_to_neo4j(neo4j: Neo4jConnection, point: KnowledgePoint, domain_id: UUID):
    with neo4j.connect().session() as session:
        session.run(
            """
            MERGE (p:KnowledgePoint {uuid: $uuid})
            SET p.name = $name, p.description = $desc, p.difficulty = $diff
            WITH p MATCH (d:KnowledgeDomain {uuid: $did})
            MERGE (d)-[:HAS_SUB]->(p)
            """,
            uuid=str(point.id), name=point.name, desc=point.description or "",
            diff=point.difficulty, did=str(domain_id)
        )


def _sync_question_to_neo4j(neo4j: Neo4jConnection, question: Question):
    with neo4j.connect().session() as session:
        session.run("MERGE (q:Question {uuid: $uuid})", uuid=str(question.id))
        session.run(
            "MATCH (q:Question {uuid: $uuid})-[r:TESTS]->() DELETE r",
            uuid=str(question.id)
        )
        for kp_uuid in (question.knowledge_point_uuids or []):
            session.run(
                """
                MATCH (q:Question {uuid: $quid})
                MATCH (kp:KnowledgePoint {uuid: $kpuuid})
                MERGE (q)-[:TESTS]->(kp)
                """, quid=str(question.id), kpuuid=kp_uuid
            )


def _kp_exists(db: Session, name: str, domain_id: UUID) -> bool:
    return db.query(KnowledgePoint).filter(
        KnowledgePoint.domain_id == domain_id,
        KnowledgePoint.name == name
    ).first() is not None


def _bank_exists(db: Session, name: str) -> bool:
    return db.query(QuestionBank).filter(QuestionBank.name == name).first() is not None


# ── 主入口 ──

def seed_database():
    """综合种子数据主入口 — 在 app 启动时自动执行（幂等）

    采用两阶段提交策略，确保关键数据（用户、学科、题库题目）不会因为
    非关键步骤（演示资源、学习路径、讲义）的失败而回滚。
    """
    # ── Phase 1: 关键数据（用户 + 学科数据） ──────────────────────
    # 使用独立事务，即使 Phase 2 失败，Phase 1 的更改也会保留。
    db1: Session = SessionLocal()
    phase1_ok = False
    try:
        # ====== 1. 创建测试用户和管理员 ======
        _ensure_test_user(db1)
        _ensure_admin_user(db1)

        # ====== 2. 注入学科数据（科目、章节、知识点、题库、题目） ======
        _seed_comprehensive_data(db1)

        db1.commit()
        phase1_ok = True
        logger.info("✅ 核心种子数据加载完成（用户 + 题库）")
    except Exception as e:
        db1.rollback()
        logger.error(f"❌ 核心种子数据加载失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db1.close()

    # ── Phase 2: 辅助数据（资源 / 学习路径 / 讲义 / 复习材料） ──
    # 这些步骤失败不应影响已提交的题库数据。
    db2: Session = SessionLocal()
    try:
        # ====== 3. 注入代码案例 ======
        _seed_code_cases(db2)

        # ====== 4. 注入演示资源（图文讲解/视频脚本/文档/思维导图） ======
        _seed_demo_resources(db2)

        # ====== 5. 为测试用户创建演示学习路径（数据结构） ======
        _seed_demo_learning_path(db2)

        # ====== 6. 为测试用户的知识点补全阅读讲义 ======
        _seed_knowledge_point_lectures(db2)
        _seed_review_materials(db2)

        db2.commit()
        logger.info("🎉 所有种子数据加载完成")
    except Exception as e:
        db2.rollback()
        logger.warning(f"⚠️ 辅助种子数据加载失败（不影响题库使用）: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db2.close()


def _ensure_test_user(db: Session):
    """创建测试用户 guoketg（如不存在）"""
    user = db.query(User).filter(User.username == "guoketg").first()
    if user:
        logger.info("👤 测试用户 guoketg 已存在")
        return

    user = User(
        id=_uuid.uuid4(),
        username="guoketg",
        password_hash=get_password_hash("123456"),
        role=UserRole.STUDENT.value,
        status=UserStatus.ACTIVE.value,
    )
    db.add(user)
    db.flush()
    logger.info("✅ 创建测试用户：guoketg / 123456")


def _ensure_admin_user(db: Session):
    """创建管理员用户 admin（如不存在）"""
    user = db.query(User).filter(User.username == "admin").first()
    if user:
        logger.info("👤 管理员用户 admin 已存在")
        return

    user = User(
        id=_uuid.uuid4(),
        username="admin",
        password_hash=get_password_hash("admin123"),
        role=UserRole.ADMIN.value,
        status=UserStatus.ACTIVE.value,
    )
    db.add(user)
    db.flush()
    logger.info("✅ 创建管理员用户：admin / admin123")


def _seed_data_structures_from_json(db: Session) -> bool:
    """Load the curated data-structures seed file and replace the system seed bank.

    Tries the comprehensive full seed first (data_structures_full_seed.json),
    falling back to the base curated seed (data_structures_seed.json).
    """
    seed_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "seed_data"))
    full_seed_path = os.path.join(seed_dir, "data_structures_full_seed.json")
    base_seed_path = os.path.join(seed_dir, "data_structures_seed.json")
    seed_path = full_seed_path if os.path.isfile(full_seed_path) else base_seed_path
    if not os.path.isfile(seed_path):
        logger.warning(f"数据结构种子文件不存在: {seed_path}")
        return False

    with open(seed_path, "r", encoding="utf-8") as f:
        seed = json.load(f)

    subject_data = seed["subject"]
    # Support both singular "bank" (legacy) and plural "banks" (full seed export)
    bank_data = seed.get("bank") or (seed.get("banks", [{}])[0] if seed.get("banks") else {})
    domains_data = seed.get("domains", [])
    points_data = seed.get("knowledge_points", [])
    questions_data = seed.get("questions", [])

    system_user = db.query(User).filter(User.id == SYSTEM_OWNER_ID).first()
    if not system_user:
        system_user = User(
            id=SYSTEM_OWNER_ID,
            username="system",
            password_hash=get_password_hash(str(_uuid.uuid4())),
            role=UserRole.ADMIN.value,
            status=UserStatus.ACTIVE.value,
        )
        db.add(system_user)
        db.flush()

    legacy_subject_names = {subject_data["name"], SEED_SUBJECT_NAME, "���ݽṹ", "鏁版嵁缁撴瀯"}
    subject = db.query(Subject).filter(Subject.name.in_(legacy_subject_names)).first()
    if not subject:
        subject = Subject(id=UUID(subject_data["id"]))
        db.add(subject)

    subject.name = subject_data["name"]
    subject.description = subject_data.get("description")
    subject.sort_order = subject_data.get("sort_order", 1)
    db.flush()

    neo4j = get_neo4j()
    try:
        _sync_subject_to_neo4j(neo4j, subject)
    except Exception as e:
        logger.warning(f"Neo4j 同步学科失败: {e}")

    domain_by_seed_id: dict[str, KnowledgeDomain] = {}
    for domain_data in sorted(domains_data, key=lambda x: x.get("sort_order", 0)):
        domain = db.query(KnowledgeDomain).filter(
            KnowledgeDomain.subject_id == subject.id,
            KnowledgeDomain.sort_order == domain_data.get("sort_order", 0),
        ).first()
        if not domain:
            domain = db.query(KnowledgeDomain).filter(
                KnowledgeDomain.subject_id == subject.id,
                KnowledgeDomain.name == domain_data["name"],
            ).first()
        if not domain:
            domain = KnowledgeDomain(id=UUID(domain_data["id"]), subject_id=subject.id)
            db.add(domain)

        domain.name = domain_data["name"]
        domain.description = domain_data.get("description")
        domain.sort_order = domain_data.get("sort_order", 0)
        db.flush()
        domain_by_seed_id[domain_data["id"]] = domain
        try:
            _sync_domain_to_neo4j(neo4j, domain, subject.id)
        except Exception as e:
            logger.warning(f"Neo4j 同步领域失败: {e}")

    point_by_seed_id: dict[str, KnowledgePoint] = {}
    for point_data in sorted(points_data, key=lambda x: (x.get("domain_id", ""), x.get("sort_order", 0))):
        domain = domain_by_seed_id.get(point_data["domain_id"])
        if not domain:
            continue
        point = db.query(KnowledgePoint).filter(
            KnowledgePoint.domain_id == domain.id,
            KnowledgePoint.sort_order == point_data.get("sort_order", 0),
        ).first()
        if not point:
            point = db.query(KnowledgePoint).filter(
                KnowledgePoint.domain_id == domain.id,
                KnowledgePoint.name == point_data["name"],
            ).first()
        if not point:
            point = KnowledgePoint(id=UUID(point_data["id"]), domain_id=domain.id)
            db.add(point)

        point.name = point_data["name"]
        point.description = point_data.get("description")
        point.video_url = point_data.get("video_url")
        point.difficulty = point_data.get("difficulty", 1)
        point.sort_order = point_data.get("sort_order", 0)
        db.flush()
        point_by_seed_id[point_data["id"]] = point
        try:
            _sync_point_to_neo4j(neo4j, point, domain.id)
        except Exception as e:
            logger.warning(f"Neo4j 同步知识点失败: {e}")

    desired_domain_ids = {domain.id for domain in domain_by_seed_id.values()}
    for domain in db.query(KnowledgeDomain).filter(KnowledgeDomain.subject_id == subject.id).all():
        if domain.id not in desired_domain_ids:
            db.delete(domain)

    desired_point_names_by_domain = {
        domain_by_seed_id[domain_id].id: {
            point["name"] for point in points_data if point.get("domain_id") == domain_id
        }
        for domain_id in domain_by_seed_id
    }
    for domain_id, desired_names in desired_point_names_by_domain.items():
        for point in db.query(KnowledgePoint).filter(KnowledgePoint.domain_id == domain_id).all():
            if point.name not in desired_names:
                db.delete(point)
    db.flush()

    banks_data = seed.get("banks") or [bank_data]

    # Replace legacy generic programming rows with the curated OJ catalog. The
    # source JSON still carries objective questions; programming data lives in a
    # dedicated module so cases, scaffolds and hints remain reviewable.
    # Skip this when using the full seed (which already contains all questions).
    from app.seed_data.coding_oj_catalog import build_curated_coding_questions, CODE_BANK_ID
    if seed_path == base_seed_path:
        point_id_by_name = {point.name: str(point.id) for point in point_by_seed_id.values()}
        curated_coding_questions = build_curated_coding_questions(point_id_by_name)
        questions_data = [item for item in questions_data if item.get("type") != "programming"] + curated_coding_questions

    for item in banks_data:
        if item["id"] == CODE_BANK_ID:
            item["name"] = "数据结构编程训练（简单 / 中等 / 困难）"
            item["description"] = "每个核心知识点最多三题，难度各一；提供结构化题面、Python 脚手架、真实多用例判题与运行轨迹。"
            item["tags"] = ["数据结构", "编程题", "牛客", "力扣", "真实判题"]

    bank_by_seed_id: dict[str, QuestionBank] = {}
    desired_bank_ids = {UUID(item["id"]) for item in banks_data}

    for item in banks_data:
        bank_id = UUID(item["id"])
        bank = db.query(QuestionBank).filter(QuestionBank.id == bank_id).first()
        if not bank:
            bank = QuestionBank(id=bank_id, owner_id=SYSTEM_OWNER_ID, subject_id=subject.id)
            db.add(bank)

        bank.owner_id = SYSTEM_OWNER_ID
        bank.subject_id = subject.id
        bank.name = item["name"]
        bank.description = item.get("description")
        bank.visibility = item.get("visibility", "public")
        bank.tags = item.get("tags", [])
        bank_by_seed_id[item["id"]] = bank

    db.flush()

    for obsolete in db.query(QuestionBank).filter(
        QuestionBank.owner_id == SYSTEM_OWNER_ID,
        QuestionBank.subject_id == subject.id,
    ).all():
        if obsolete.id not in desired_bank_ids:
            db.query(Question).filter(Question.bank_id == obsolete.id).delete(synchronize_session=False)
            db.delete(obsolete)
    db.flush()

    # ── Seed version detection ──────────────────────────────────────
    # Count how many valid (non-essay/short_answer) questions the seed file carries.
    _desired_ids: set[str] = set()
    for qd in questions_data:
        qt = qd.get("type", "single_choice")
        if qt not in {"short_answer", "essay"}:
            _desired_ids.add(qd["id"])
    _seed_question_count = len(_desired_ids)

    # Count how many seed-source questions currently live in the target banks.
    _existing_seed_questions = db.query(Question).filter(
        Question.bank_id.in_(list(desired_bank_ids)),
        Question.source.in_(_SEED_SOURCES),
        Question.status == "published",
    ).all()
    _existing_seed_count = len(_existing_seed_questions)

    _needs_full_reseed = _existing_seed_count > 0 and _existing_seed_count < _seed_question_count
    _seed_shrunk = _existing_seed_count > _seed_question_count

    if _needs_full_reseed or _seed_shrunk:
        _verb = "增长" if _needs_full_reseed else "缩减"
        logger.info(
            "🔧 检测到种子数据版本变更（数据库 %d 道 → 种子文件 %d 道，%s），"
            "正在同步…",
            _existing_seed_count, _seed_question_count, _verb,
        )

    if _needs_full_reseed or _seed_shrunk:
        # Archive ALL seed-source questions that are no longer in the current seed,
        # regardless of their specific source tag.  Questions still present in the
        # new seed will be updated in-place; truly obsolete ones are archived so
        # historical StudentAnswer records remain valid.
        _archived = 0
        for q in _existing_seed_questions:
            if str(q.id) not in _desired_ids:
                q.status = "archived"
                _archived += 1
        if _archived:
            logger.info("   📦 已归档 %d 道不再存在于种子数据中的题目", _archived)

    # Build lookup for existing questions (including archived — they will be
    # revived if they reappear in the seed).
    existing_questions = db.query(Question).filter(
        Question.bank_id.in_(list(desired_bank_ids))
    ).all()
    existing_by_id = {str(q.id): q for q in existing_questions}

    upserted = 0
    for question_data in questions_data:
        question_type = question_data.get("type", "single_choice")
        if question_type in {"short_answer", "essay"}:
            continue
        bank_id = UUID(question_data.get("bank_id") or banks_data[0]["id"])
        if bank_id not in desired_bank_ids:
            continue

        # Resolve knowledge-point references.  The seed JSON carries KP ids
        # that match the seed data, but the actual database may use different
        # UUIDs when the KP was matched by name (e.g. old seed vs new seed).
        # Build a lookup that covers both seed ids and real DB ids.
        points_by_real_id = {str(item.id): item for item in point_by_seed_id.values()}

        def _resolve_kp(seed_kp_id: str):
            """Return the actual DB KnowledgePoint for a seed KP id, or None."""
            return point_by_seed_id.get(seed_kp_id) or points_by_real_id.get(str(seed_kp_id))

        kp_ids = []
        for seed_kp_id in question_data.get("knowledge_point_uuids", []):
            point = _resolve_kp(seed_kp_id)
            if point:
                kp_ids.append(str(point.id))

        question = existing_by_id.get(question_data["id"])
        if not question:
            question = Question(id=UUID(question_data["id"]))
            db.add(question)
        elif question.status == "archived":
            # Revive a question that was archived by a previous seed version but
            # reappears in the current seed data.
            question.status = "published"

        # Resolve primary_knowledge_point_id through the same lookup to avoid
        # foreign-key violations when the seed UUID differs from the DB UUID.
        primary_point_seed_id = question_data.get("primary_knowledge_point_id")
        primary_point = _resolve_kp(primary_point_seed_id) if primary_point_seed_id else None
        if primary_point_seed_id and not primary_point:
            logger.warning(
                "   ⚠️ 题目 %s 的主知识点 %s 在数据库中不存在，已跳过关联",
                question_data["id"], primary_point_seed_id,
            )

        question.bank_id = bank_id
        question.type = question_type
        question.difficulty = question_data.get("difficulty", "basic")
        question.status = question_data.get("status", "published")
        question.priority = question_data.get("priority", 0)
        question.content = question_data.get("content", {})
        question.answer = question_data.get("answer", {})
        question.knowledge_point_uuids = kp_ids
        question.primary_knowledge_point_id = primary_point.id if primary_point else None
        question.tags = question_data.get("tags", [])
        question.ai_generated = question_data.get("ai_generated", False)
        question.source = question_data.get("source", "curated_seed")
        question.created_by = SYSTEM_OWNER_ID
        db.flush()

        if question_type == "programming":
            db.query(CodingTestCase).filter(CodingTestCase.question_id == question.id).delete(synchronize_session=False)
            for case_order, case in enumerate(question_data.get("test_cases", []), start=1):
                db.add(CodingTestCase(
                    id=_uuid.uuid5(_uuid.UUID("1238254c-d167-4878-9e09-7a09ecbbcf77"), f"{question.id}:{case_order}"),
                    question_id=question.id,
                    case_order=case_order,
                    name=case.get("name") or f"测试 {case_order}",
                    visibility="sample" if case.get("is_public") else "hidden",
                    input_data=case.get("input", ""),
                    expected_output=case.get("expected_output", ""),
                    comparator=case.get("comparator", "trim_lines"),
                    time_limit_ms=case.get("time_limit_ms", 3000),
                    memory_limit_mb=case.get("memory_limit_mb", 256),
                ))

        upserted += 1
        try:
            _sync_question_to_neo4j(neo4j, question)
        except Exception as e:
            logger.warning(f"Neo4j 同步题目失败: {e}")

    for bank_id in desired_bank_ids:
        bank = db.query(QuestionBank).filter(QuestionBank.id == bank_id).first()
        if bank:
            actual_count = db.query(Question).filter(
                Question.bank_id == bank_id,
                Question.status == "published"
            ).count()
            bank.total_questions = actual_count
    db.flush()

    # Summary: report what happened during this seed run.
    _final_published = db.query(Question).filter(
        Question.bank_id.in_(list(desired_bank_ids)),
        Question.status == "published",
    ).count()
    if _needs_full_reseed:
        _action = "重新导入"
    elif _seed_shrunk:
        _action = "缩减同步"
    elif _existing_seed_count == 0:
        _action = "初始化"
    else:
        _action = "同步"
    logger.info(
        "📚 数据结构系统题库已%s：%d 个题库，%d 章，%d 个知识点，"
        "本次处理 %d 道题，当前共 %d 道已发布题目",
        _action, len(banks_data), len(domains_data), len(points_data),
        upserted, _final_published,
    )
    return True

def _seed_comprehensive_data(db: Session):
    """使用 Python 数据定义注入完整的学科、题库数据（幂等）"""
    if _seed_data_structures_from_json(db):
        return

    if _bank_exists(db, SEED_BANK_NAME):
        logger.info(f"📚 种子题库「{SEED_BANK_NAME}」已存在，跳过学科数据注入")
        return

    neo4j = get_neo4j()

    # 2a. 创建学科
    subject = db.query(Subject).filter(Subject.name == SEED_SUBJECT_NAME).first()
    if not subject:
        subject = Subject(
            id=_uuid.uuid4(),
            name=SEED_SUBJECT_NAME,
            description="数据结构（C语言版 第2版）—— 严蔚敏、吴伟民",
            sort_order=1,
        )
        db.add(subject)
        db.flush()
        logger.info(f"✅ 创建学科：{SEED_SUBJECT_NAME}")
        try:
            _sync_subject_to_neo4j(neo4j, subject)
        except Exception as e:
            logger.warning(f"Neo4j 同步学科失败: {e}")

    # 2b. 创建章节（知识领域）和知识点
    domain_map = {}   # domain_name -> KnowledgeDomain
    kp_flat = []      # [(kp_name, kp_id, domain_name), ...]

    for di, (dom_name, dom_desc, points) in enumerate(DOMAINS):
        domain = db.query(KnowledgeDomain).filter(
            KnowledgeDomain.subject_id == subject.id,
            KnowledgeDomain.name == dom_name
        ).first()
        if not domain:
            domain = KnowledgeDomain(
                id=_uuid.uuid4(),
                subject_id=subject.id,
                name=dom_name,
                description=dom_desc,
                sort_order=di + 1,
            )
            db.add(domain)
            db.flush()
            try:
                _sync_domain_to_neo4j(neo4j, domain, subject.id)
            except Exception as e:
                logger.warning(f"Neo4j 同步领域失败: {e}")

        domain_map[dom_name] = domain

        for pi, (kp_name, difficulty, sort_order) in enumerate(points):
            if _kp_exists(db, kp_name, domain.id):
                kp = db.query(KnowledgePoint).filter(
                    KnowledgePoint.domain_id == domain.id,
                    KnowledgePoint.name == kp_name
                ).first()
            else:
                kp = KnowledgePoint(
                    id=_uuid.uuid4(),
                    domain_id=domain.id,
                    name=kp_name,
                    description=f"{dom_name} — {kp_name}",
                    difficulty=difficulty,
                    sort_order=sort_order,
                )
                db.add(kp)
                db.flush()
                try:
                    _sync_point_to_neo4j(neo4j, kp, domain.id)
                except Exception as e:
                    logger.warning(f"Neo4j 同步知识点失败: {e}")

            kp_flat.append((kp_name, str(kp.id), dom_name))

        logger.info(f"  📖 {dom_name} — {len(points)} 个知识点")

    db.flush()
    logger.info(f"✅ 共创建 {len(DOMAINS)} 个章节，{len(kp_flat)} 个知识点")

    # 构建 KPMap (kp_name -> kp_id) 用于题目关联
    kp_name_to_id = {name: uid for name, uid, _ in kp_flat}

    # 2c. 创建题库
    bank = QuestionBank(
        id=_uuid.uuid4(),
        owner_id=SYSTEM_OWNER_ID,
        subject_id=subject.id,
        name=SEED_BANK_NAME,
        description="数据结构（C语言版 第2版）配套题库",
        visibility="public",
        total_questions=0,
        tags=["数据结构", "考研", "C语言"],
    )
    db.add(bank)
    db.flush()
    logger.info(f"✅ 创建题库：{bank.name}")

    # 2d. 创建题目
    q_count = 0
    skipped_q = 0
    for (kp_idx, qtype, difficulty, stem, options, answer, explanation) in QUESTIONS_DATA:
        if kp_idx < 1 or kp_idx > len(kp_flat):
            logger.warning(f"  跳过题目（知识点序号{kp_idx}超出范围）")
            skipped_q += 1
            continue

        kp_name, kp_id, _ = kp_flat[kp_idx - 1]

        content = {"stem": stem}
        if qtype != "short_answer" and options:
            content["options"] = options

        question = Question(
            id=_uuid.uuid4(),
            bank_id=bank.id,
            type=qtype,
            difficulty=str(difficulty),
            status="published",
            priority=q_count + 1,
            content=content,
            answer={"correct_answer": answer, "explanation": explanation},
            knowledge_point_uuids=[kp_id],
            tags=["数据结构"],
            ai_generated=False,
            source="manual",
            created_by=SYSTEM_OWNER_ID,
        )
        db.add(question)
        q_count += 1

        try:
            _sync_question_to_neo4j(neo4j, question)
        except Exception as e:
            logger.warning(f"Neo4j 同步题目失败: {e}")

    bank.total_questions = q_count
    db.flush()
    logger.info(f"✅ 共创建 {q_count} 道题目（跳过 {skipped_q} 道）")

    # 2e. Neo4j 知识图谱 — 建立 PREREQUISITE 和 RELATED_TO 关系
    try:
        if neo4j and neo4j.verify_connectivity():
            with neo4j.connect().session() as neo4j_s:
                # 同一章节内按顺序建立 PREREQUISITE
                for _, _, points in DOMAINS:
                    for i in range(len(points) - 1):
                        subj = points[i][0]
                        obj = points[i + 1][0]
                        neo4j_s.run(
                            "MATCH (a:KnowledgePoint {name: $s}), (b:KnowledgePoint {name: $o}) "
                            "MERGE (a)-[:PREREQUISITE]->(b)",
                            s=subj, o=obj
                        )

                # 章节间建立 PREREQUISITE（前一章最后 → 后一章第一）
                for di in range(len(DOMAINS) - 1):
                    prev_last = DOMAINS[di][2][-1][0]
                    next_first = DOMAINS[di + 1][2][0][0]
                    neo4j_s.run(
                        "MATCH (a:KnowledgePoint {name: $s}), (b:KnowledgePoint {name: $o}) "
                        "MERGE (a)-[:PREREQUISITE]->(b)",
                        s=prev_last, o=next_first
                    )

                # RELATED_TO 关系
                related_pairs = [
                    ("顺序表的基本操作（插入、删除、查找）", "单链表的基本操作"),
                    ("栈的定义和基本操作", "队列的定义和基本操作"),
                    ("二叉树的先序遍历", "二叉树的中序遍历"),
                    ("深度优先搜索（DFS）", "广度优先搜索（BFS）"),
                    ("最小生成树（Prim 算法）", "最小生成树（Kruskal 算法）"),
                    ("直接插入排序", "折半插入排序"),
                    ("冒泡排序", "快速排序"),
                    ("二叉排序树（BST）", "平衡二叉树（AVL）"),
                ]
                for s, o in related_pairs:
                    neo4j_s.run(
                        "MATCH (a:KnowledgePoint {name: $s}), (b:KnowledgePoint {name: $o}) "
                        "MERGE (a)-[:RELATED_TO]->(b)",
                        s=s, o=o
                    )
            logger.info("✅ Neo4j 知识图谱关系已构建")
    except Exception as e:
        logger.warning(f"⚠️ Neo4j 知识图谱构建失败（非致命）: {e}")


def _seed_code_cases(db: Session):
    """为测试用户注入代码案例资源（幂等）"""
    user = db.query(User).filter(User.username == "guoketg").first()
    if not user:
        logger.warning("跳过代码案例注入：测试用户 guoketg 不存在")
        return

    # 获取所有知识点名称→ID 映射
    all_kps = db.query(KnowledgePoint).all()
    kp_by_name: dict[str, str] = {kp.name: str(kp.id) for kp in all_kps}

    # 代码案例文件目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    examples_dir = os.path.join(script_dir, "code_examples")

    if not os.path.isdir(examples_dir):
        logger.warning(f"代码案例目录不存在: {examples_dir}")
        return

    created = 0
    skipped = 0
    not_found_kps = []

    for filename, kp_names, title in CODE_FILES:
        # 查找知识点（取第一个匹配的）
        kp_uuid = None
        matched_kp_name = None
        for kn in kp_names:
            if kn in kp_by_name:
                kp_uuid = kp_by_name[kn]
                matched_kp_name = kn
                break

        if not kp_uuid:
            not_found_kps.append(kp_names[0])
            continue

        # 读取代码文件
        filepath = os.path.join(examples_dir, filename)
        if not os.path.exists(filepath):
            logger.warning(f"  ⚠️ 文件不存在: {filename}")
            continue

        with open(filepath, "r", encoding="utf-8") as f:
            code_content = f.read()

        # 检查是否已存在
        existing = (
            db.query(KnowledgeResource)
            .filter(
                KnowledgeResource.user_id == user.id,
                KnowledgeResource.title == title,
                KnowledgeResource.resource_type == "code_case",
            )
            .first()
        )
        if existing:
            skipped += 1
            continue

        resource = KnowledgeResource(
            user_id=user.id,
            title=title,
            resource_type="code_case",
            content=code_content,
            knowledge_points=[matched_kp_name],
            source="manual",
        )
        db.add(resource)
        db.flush()
        created += 1

    logger.info(f"📝 代码案例：新增 {created} 个，跳过 {skipped} 个")
    if not_found_kps:
        logger.info(f"   ⚠️ 未匹配知识点的代码案例: {', '.join(not_found_kps[:5])}")


# ── 演示资源（从本地数据库导出 → seed_resources.json） ──
# 这些是 AI 实时生成的学习资源，导出为种子数据后，新用户无需配置 API Key 即可查看


def _seed_demo_resources(db: Session):
    """为测试用户注入演示资源（从 seed_resources.json 加载），幂等"""
    user = db.query(User).filter(User.username == "guoketg").first()
    if not user:
        logger.warning("跳过演示资源注入：测试用户 guoketg 不存在")
        return

    # 加载 JSON 数据文件
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(script_dir, "seed_resources.json")
    if not os.path.isfile(json_path):
        logger.warning(f"演示资源数据文件不存在: {json_path}")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        demo_resources = json.load(f)

    # 获取知识点名称→ID 映射
    all_kps = db.query(KnowledgePoint).all()
    kp_by_name: dict[str, str] = {kp.name: str(kp.id) for kp in all_kps}

    type_labels = {
        "image_text": "图文讲解",
        "video_script": "视频脚本",
        "document": "文档",
        "mind_map": "思维导图",
        "exercise": "练习题",
        "video": "视频讲解",
    }

    created = 0
    skipped = 0
    failed_kps = set()

    for item in demo_resources:
        resource_type = item["resource_type"]
        title = item["title"]
        kp_names = item.get("knowledge_points", [])
        content = item.get("content", "")

        # 查找知识点（取第一个匹配的）
        matched_kp_name = None
        for kn in kp_names:
            if kn in kp_by_name:
                matched_kp_name = kn
                break

        if not matched_kp_name:
            failed_kps.add(kp_names[0] if kp_names else "(空)")
            continue

        # 检查是否已存在（同标题+同类型+同用户）
        existing = (
            db.query(KnowledgeResource)
            .filter(
                KnowledgeResource.user_id == user.id,
                KnowledgeResource.title == title,
                KnowledgeResource.resource_type == resource_type,
            )
            .first()
        )
        if existing:
            skipped += 1
            continue

        resource = KnowledgeResource(
            user_id=user.id,
            title=title,
            resource_type=resource_type,
            content=content,
            knowledge_points=[matched_kp_name],
            source="seed",
        )
        db.add(resource)
        db.flush()
        created += 1

    from collections import Counter
    type_count = Counter(item["resource_type"] for item in demo_resources)

    logger.info(f"🎨 演示资源（来自 seed_resources.json）：新增 {created} 个，跳过 {skipped} 个")
    for rt, count in sorted(type_count.items()):
        label = type_labels.get(rt, rt)
        logger.info(f"   {label}: {count} 个")
    if failed_kps:
        logger.info(f"   ⚠️ 未匹配知识点的资源: {', '.join(sorted(failed_kps)[:8])}")


def _seed_demo_learning_path(db: Session):
    """为测试用户 guoketg 创建「数据结构」演示学习路径（幂等）

    模拟真实用户正在学习数据结构的状态：
    - 前 2 章（绪论、线性表）大部分已完成
    - 中间章节部分学习中
    - 后面章节待学习

    使得新用户访问首页时能看到学习路径，而非空状态。
    """
    user = db.query(User).filter(User.username == "guoketg").first()
    if not user:
        logger.warning("跳过演示学习路径：测试用户 guoketg 不存在")
        return

    subject = db.query(Subject).filter(Subject.name == "数据结构").first()
    if not subject:
        logger.warning("跳过演示学习路径：学科「数据结构」不存在")
        return

    user_id = str(user.id)
    subject_id = str(subject.id)

    # 幂等检查：已有活跃路径则跳过
    existing = (
        db.query(LearningPathState)
        .filter(
            LearningPathState.user_id == user.id,
            LearningPathState.subject_id == subject.id,
            LearningPathState.phase != "completed",
        )
        .first()
    )
    if existing:
        # 更新已有路径的 is_seed 标记（确保旧路径也会被识别为种子路径）
        ai_meta = existing.ai_metadata or {}
        if not ai_meta.get("is_seed"):
            ai_meta["is_seed"] = True
            existing.ai_metadata = ai_meta
            db.flush()
            logger.info("📚 演示学习路径已存在，已更新 is_seed 标记")
        else:
            logger.info("📚 演示学习路径已存在，跳过创建")
        return

    # 获取所有知识点（按章节排序）
    domains = (
        db.query(KnowledgeDomain)
        .filter(KnowledgeDomain.subject_id == subject.id)
        .order_by(KnowledgeDomain.sort_order)
        .all()
    )

    if not domains:
        logger.warning("跳过演示学习路径：学科下无章节数据")
        return

    # 定义每章的完成策略：前 2 章已完成，中间 2 章部分学习中，其余待学习
    CHINA_TZ = timezone(timedelta(hours=8))
    now = datetime.now(CHINA_TZ)

    node_order = []
    all_points = []  # (point, domain)

    for domain in domains:
        points = (
            db.query(KnowledgePoint)
            .filter(KnowledgePoint.domain_id == domain.id)
            .order_by(KnowledgePoint.sort_order)
            .all()
        )
        for pt in points:
            all_points.append((pt, domain))

    # 为前几章的知识点创建掌握度记录
    for idx, (pt, domain) in enumerate(all_points):
        pid = str(pt.id)

        # 前 2 章 (~15 个知识点) 已掌握
        if idx < 15:
            mastery = 85 + (idx % 10)  # 85~94
            status = "done"
            completed_at = (now - timedelta(days=15 - idx)).isoformat()
            study_count = 3 + (idx % 3)
            total_practiced = 5 + (idx % 10)
            total_correct = max(1, total_practiced - (idx % 3))
        # 第 3~4 章 (~14 个知识点) 学习中
        elif idx < 29:
            mastery = 30 + (idx % 40)  # 30~69
            status = "pending"
            completed_at = None
            study_count = 1 + (idx % 3)
            total_practiced = 2 + (idx % 4)
            total_correct = max(1, total_practiced - (idx % 2))
        # 其余待学习
        else:
            mastery = 0
            status = "pending"
            completed_at = None
            study_count = 0
            total_practiced = 0
            total_correct = 0

        # 创建 KnowledgePointRecord（幂等）
        existing_record = (
            db.query(KnowledgePointRecord)
            .filter(
                KnowledgePointRecord.user_id == user.id,
                KnowledgePointRecord.point_id == pt.id,
            )
            .first()
        )
        if not existing_record:
            record = KnowledgePointRecord(
                user_id=user.id,
                point_id=pt.id,
                point_name=pt.name,
                mastery_score=mastery,
                recent_accuracy=mastery - (idx % 10),
                consecutive_errors=0 if mastery >= 60 else (idx % 3),
                total_practiced=total_practiced,
                total_correct=total_correct,
                total_time_spent_seconds=total_practiced * 120,
                study_count=study_count,
                last_study_at=now - timedelta(days=idx % 7) if study_count > 0 else None,
                last_practice_at=now - timedelta(days=idx % 5) if total_practiced > 0 else None,
                next_review_at=now + timedelta(days=1) if status == "done" and idx % 3 == 0 else None,
                status=(
                    "mastered" if mastery >= 80
                    else "learning" if mastery > 0
                    else "not_started"
                ),
            )
            db.add(record)

        node_order.append({
            "node_id": pid,
            "name": pt.name,
            "domain_name": domain.name,
            "status": status,
            "mastery_score": mastery,
            "sort_order": pt.sort_order,
            "started_at": None,
            "completed_at": completed_at,
        })

    db.flush()

    # 设置第一个 pending 节点为当前焦点
    first_pending = next((n for n in node_order if n["status"] == "pending"), None)
    current_node_id = None
    current_node_name = None
    if first_pending:
        first_pending["status"] = "active"
        current_node_id = UUID(first_pending["node_id"])
        current_node_name = first_pending["name"]

    total_nodes = len(node_order)
    done_count = sum(1 for n in node_order if n["status"] == "done")

    # 创建路径状态
    state = LearningPathState(
        id=_uuid.uuid4(),
        user_id=user.id,
        subject_id=subject.id,
        goal_type="学期提升",
        goal_description="系统掌握数据结构课程全部核心知识点，为期末考试打好基础",
        phase="learning",
        current_node_id=current_node_id,
        current_node_name=current_node_name,
        node_order=node_order,
        total_nodes=total_nodes,
        completed_nodes=done_count,
        version=1,
        metadata={
            "path_name": "数据结构系统学习路径",
            "description": "按教材章节循序渐进，先掌握基础概念和线性结构，再攻克树、图、查找、排序等高级主题",
            "total_days": 45,
            "phases": [
                {"name": "基础入门", "description": "绪论 + 线性表", "days": 7, "point_count": 15},
                {"name": "栈队列串", "description": "栈和队列 + 串", "days": 7, "point_count": 14},
                {"name": "树和图", "description": "数组矩阵 + 树 + 图", "days": 14, "point_count": 32},
                {"name": "算法进阶", "description": "查找 + 排序", "days": 14, "point_count": 23},
                {"name": "综合复习", "description": "全面复习和刷题", "days": 3, "point_count": 84},
            ],
            "strategy_notes": [
                "前两章已完成，当前重点攻克栈和队列的应用",
                "树和图是数据结构核心难点，建议多画图理解",
                "查找和排序算法需配合编程练习巩固",
            ],
            "daily_suggestion": "建议每天学习 2-3 个知识点，配合题库练习巩固",
            "generation_reason": "种子演示数据 — 基于数据结构教材章节顺序编排",
            "is_seed": True,
        },
    )
    db.add(state)
    db.flush()

    logger.info(f"📚 演示学习路径已创建：{subject.name}（{total_nodes} 知识点，{done_count} 已完成）")


def _seed_knowledge_point_lectures(db: Session):
    """幂等注入数据结构知识点的公共阅读讲义。

    公共讲义挂在知识点而不是测试用户上，因此新注册用户、全新数据库和
    Docker/服务器重建后都会读取到同一份受版本控制的种子内容。
    """
    points = (
        db.query(KnowledgePoint)
        .join(KnowledgeDomain, KnowledgePoint.domain_id == KnowledgeDomain.id)
        .join(Subject, KnowledgeDomain.subject_id == Subject.id)
        .filter(Subject.name == SEED_SUBJECT_NAME)
        .all()
    )
    seeded = 0
    for point in points:
        domain = point.domain
        source = get_lecture_source(point.name, domain.name)
        content = build_source_based_lecture(
            subject_name=SEED_SUBJECT_NAME,
            domain_name=domain.name,
            point_name=point.name,
            description=point.description or "",
        )
        lecture = db.query(KnowledgePointLecture).filter(
            KnowledgePointLecture.point_id == point.id
        ).first()
        if not lecture:
            lecture = KnowledgePointLecture(point_id=point.id)
            db.add(lecture)
        lecture.content = content
        lecture.source_url = source.url
        lecture.source_mode = source.mode
        seeded += 1

    db.flush()
    logger.info(f"📚 公共阅读讲义种子已同步：{seeded} 个知识点")


def _seed_review_materials(db: Session):
    """让演示账号的旧用户级讲义同步到最新公共种子版本。

    仅处理固定演示账号；普通用户自行生成的个性化讲义不会被覆盖。
    """
    user = db.query(User).filter(User.username == "guoketg").first()
    if not user:
        return

    # 演示账号属于种子数据，启动时始终与公共讲义保持一致。
    records = (
        db.query(KnowledgePointRecord)
        .filter(KnowledgePointRecord.user_id == user.id)
        .all()
    )

    if not records:
        logger.info("📖 演示账号暂无知识点记录，跳过用户级讲义同步")
        return

    generated = 0
    for record in records:
        try:
            # 获取知识点的章节和学科信息
            point = db.query(KnowledgePoint).filter(
                KnowledgePoint.id == record.point_id
            ).first()
            if not point:
                continue

            domain = db.query(KnowledgeDomain).filter(
                KnowledgeDomain.id == point.domain_id
            ).first()
            domain_name = domain.name if domain else ""
            subject_name = ""
            if domain:
                subj = db.query(Subject).filter(Subject.id == domain.subject_id).first()
                if subj:
                    subject_name = subj.name

            content = (
                point.seed_lecture.content
                if point.seed_lecture
                else build_source_based_lecture(
                    subject_name=subject_name,
                    domain_name=domain_name,
                    point_name=point.name,
                    description=point.description or "",
                )
            )
            record.review_material = content
            generated += 1

        except Exception as e:
            logger.warning(f"  生成讲义失败 [{point.name if point else '?'}]: {e}")

    if generated > 0:
        db.flush()
        logger.info(f"📖 演示账号阅读讲义已同步：{generated} 个知识点")
