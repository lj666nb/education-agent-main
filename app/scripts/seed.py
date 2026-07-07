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
    Subject, KnowledgeDomain, KnowledgePoint, QuestionBank, Question,
)
from app.models.resource import KnowledgeResource
from app.models.user import User, UserProfile, UserRole, UserStatus
from app.core.security import get_password_hash

logger = logging.getLogger("uvicorn")

# ── 系统常量 ──
SYSTEM_OWNER_ID = UUID("00000000-0000-0000-0000-000000000000")
SEED_BANK_NAME = "数据结构题库"
SEED_SUBJECT_NAME = "数据结构"

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
    ("01_seqlist.py",            ["顺序表实现", "顺序表操作"],
     "【顺序表】实现与基本操作"),
    ("02_linkedlist.py",         ["单链表"],
     "【单链表】定义与基本操作"),
    ("03_doubly_linkedlist.py",  ["双向链表"],
     "【双向链表】实现与基本操作"),
    ("04_stack.py",              ["顺序栈"],
     "【顺序栈】实现与基本操作"),
    ("05_circular_queue.py",     ["循环队列"],
     "【循环队列】实现与基本操作"),
    ("06_bracket_matching.py",   ["栈的应用"],
     "【栈的应用】括号匹配与表达式求值"),
    ("07_binary_tree.py",        ["二叉树定义", "二叉树遍历"],
     "【二叉树】链式存储与遍历"),
    ("08_huffman.py",            ["哈夫曼树"],
     "【哈夫曼树】构建与编码"),
    ("09_adjacency_matrix.py",   ["邻接矩阵"],
     "【邻接矩阵】图的存储结构"),
    ("10_dfs.py",                ["DFS"],
     "【DFS】深度优先搜索"),
    ("11_bfs.py",                ["BFS"],
     "【BFS】广度优先搜索"),
    ("12_dijkstra.py",           ["Dijkstra"],
     "【Dijkstra】最短路径算法"),
    ("13_bubble_sort.py",        ["冒泡排序"],
     "【冒泡排序】排序算法"),
    ("14_quick_sort.py",         ["快速排序"],
     "【快速排序】排序算法"),
    ("15_merge_sort.py",         ["归并排序"],
     "【归并排序】分治排序"),
    ("16_heap_sort.py",          ["堆排序"],
     "【堆排序】排序算法"),
    ("17_binary_search.py",      ["折半查找"],
     "【折半查找】查找算法"),
    ("18_bst.py",                ["BST"],
     "【BST】二叉排序树"),
    ("19_avl.py",                ["AVL"],
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
    """综合种子数据主入口 — 在 app 启动时自动执行（幂等）"""
    db: Session = SessionLocal()
    try:
        # ====== 1. 创建测试用户 ======
        _ensure_test_user(db)

        # ====== 2. 注入学科数据（使用完整 Python 数据结构） ======
        _seed_comprehensive_data(db)

        # ====== 3. 注入代码案例 ======
        _seed_code_cases(db)

        db.commit()
        logger.info("🎉 所有种子数据加载完成")

    except Exception as e:
        db.rollback()
        logger.error(f"❌ 种子数据加载失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


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


def _seed_comprehensive_data(db: Session):
    """使用 Python 数据定义注入完整的学科、题库数据（幂等）"""
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
