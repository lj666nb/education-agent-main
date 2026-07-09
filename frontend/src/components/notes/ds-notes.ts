/* ── 数据结构笔记内容 ── */

export interface NoteChapter {
  id: string
  title: string
  icon: string
  sections: NoteSection[]
}

export interface NoteSection {
  id: string
  title: string
  content: string  // Markdown（含 <!-- LANG:xxx --> 多语言代码块）
}

export const chapters: NoteChapter[] = [
  {
    id: 'basics',
    title: '零、数据结构基础',
    icon: '📐',
    sections: [
      {
        id: 'logical-physical',
        title: '0.1 逻辑结构与物理结构',
        content: `## 数据结构基本概念

数据结构是计算机存储、组织数据的方式，包含三个要素：**逻辑结构**、**存储结构**和**数据的运算**。

### 逻辑结构（Logical Structure）

逻辑结构是数据元素之间的抽象关系，独立于计算机存储，分为四种类型：

| 类型 | 特点 | 实例 |
|------|------|------|
| **集合结构** | 元素间无逻辑关系，组织形式松散 | 集合、哈希集 |
| **线性结构** | 元素间存在「一对一」的线性关系 | 数组、链表、栈、队列 |
| **树形结构** | 元素间存在「一对多」的层次关系 | 二叉树、B树、文件系统 |
| **图形结构** | 元素间存在「多对多」的网状关系 | 社交网络、地图导航 |

### 物理结构（Storage Structure）

物理结构是数据在计算机内存中的存放方式，分为两种：

| 存储方式 | 特点 | 优点 | 缺点 |
|---------|------|------|------|
| **顺序存储** | 地址连续，逻辑与物理关系一致 | 随机存取 O(1)，空间利用率高 | 需要整块连续空间，可能产生外部碎片 |
| **链式存储** | 借助指针链接，物理上可不连续 | 无碎片，充分利用零散空间 | 额外存储指针，只能顺序存取 |

![顺序存储与链式存储](/images/ds-notes/377bc986fa784c40a68825479e96b332.png)

> **核心思想**：逻辑结构与物理结构分离。线性表是逻辑结构，顺序表（数组）和链表是物理实现。同一逻辑结构可有多种存储方式。

### 数据结构三要素

1. **逻辑结构** — 数据元素间的抽象关系（面向问题）
2. **存储结构** — 数据在计算机中的存放方式（面向机器）
3. **数据运算** — 施加在数据上的操作（插入、删除、查找、排序等）

> 算法的设计取决于逻辑结构，算法的实现依赖于存储结构。`
      },
      {
        id: 'complexity',
        title: '0.2 算法复杂度分析',
        content: `## 算法复杂度分析

### 时间复杂度

**定义**：算法中基本操作重复执行的次数是问题规模 n 的函数 T(n)，若有辅助函数 f(n)，使 n→∞ 时 T(n)/f(n) 的极限为非零常数，则称 **T(n) = O(f(n))** 为算法的渐进时间复杂度。

![常见数量阶](/images/ds-notes/b0a9352ec69a4eff8d530e088b6e54c9.png)

### 时间复杂度的计算规则

| 规则 | 说明 | 示例 |
|------|------|------|
| 基本操作 | 常数项 → O(1) | 赋值、比较、算术运算 |
| 顺序结构 | **加法**规则 | T = T₁+T₂ ⇒ O(max(f₁, f₂)) |
| 循环结构 | **乘法**规则 | T = T₁×T₂ ⇒ O(f₁×f₂) |
| 分支结构 | 取最大值 | 只关注最坏情况 |
| 忽略次要项 | 只保留最高次项 | 3n²+2n+1 → O(n²) |

### 常见时间复杂度排序

O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(n³) < O(2ⁿ) < O(n!) < O(nⁿ)

### 空间复杂度

空间复杂度 S(n) 定义为算法所耗费的存储空间，是问题规模 n 的函数。

![空间复杂度](/images/ds-notes/8a6c5bf4a79f4d009bbc42a8e7f28c13.png)

| 类型 | 说明 |
|------|------|
| **算法原地工作** | 辅助空间为常量，即 O(1) |
| **输入数据所占空间** | 取决于问题本身，不计入算法空间复杂度 |
| **递归栈空间** | 递归算法的空间复杂度 = 递归深度 × 每层所需空间 |

> 判断算法效率时，通常**只关注最高次项**，次要项和常数项可忽略。无特殊说明时，时间复杂度均指**最坏时间复杂度**。`
      }
    ]
  },
  {
    id: 'linear-list',
    title: '一、线性表',
    icon: '📋',
    sections: [
      {
        id: 'array',
        title: '1.1 顺序表（数组）',
        content: `## 顺序表（数组）

顺序表是最基础的数据结构，用**一组连续的内存空间**存储数据，支持通过下标 **O(1)** 随机访问。

![顺序存储](/images/ds-notes/377bc986fa784c40a68825479e96b332.png)

### 核心特性

| 操作 | 时间复杂度 | 说明 |
|------|-----------|------|
| 随机访问 | O(1) | 通过下标直接定位 |
| 末尾插入 | O(1) | 不需要移动元素 |
| 中间插入 | O(n) | 需要将后续元素后移 |
| 删除 | O(n) | 需要将后续元素前移 |
| 查找 | O(n) | 遍历查找 |

### 代码实现

<!-- LANG:python -->
\`\`\`python
class ArrayList:
    def __init__(self, capacity=10):
        self.data = [None] * capacity
        self.size = 0

    def get(self, index):
        if index < 0 or index >= self.size:
            raise IndexError("下标越界")
        return self.data[index]

    def add(self, value):
        if self.size == len(self.data):
            self._resize(len(self.data) * 2)
        self.data[self.size] = value
        self.size += 1

    def insert(self, index, value):
        if index < 0 or index > self.size:
            raise IndexError("下标越界")
        if self.size == len(self.data):
            self._resize(len(self.data) * 2)
        # 将 index 及之后的元素后移一位
        for i in range(self.size, index, -1):
            self.data[i] = self.data[i - 1]
        self.data[index] = value
        self.size += 1

    def remove(self, index):
        if index < 0 or index >= self.size:
            raise IndexError("下标越界")
        removed = self.data[index]
        # 前移元素
        for i in range(index, self.size - 1):
            self.data[i] = self.data[i + 1]
        self.data[self.size - 1] = None
        self.size -= 1
        return removed

    def _resize(self, new_capacity):
        new_data = [None] * new_capacity
        for i in range(self.size):
            new_data[i] = self.data[i]
        self.data = new_data

    def __str__(self):
        return str([self.data[i] for i in range(self.size)])
\`\`\`
<!-- /LANG -->

<!-- LANG:cpp -->
\`\`\`cpp
#include <iostream>
#include <stdexcept>
using namespace std;

class ArrayList {
private:
    int *data;
    int size_;
    int capacity_;

    void resize(int new_capacity) {
        int *new_data = new int[new_capacity];
        for (int i = 0; i < size_; i++)
            new_data[i] = data[i];
        delete[] data;
        data = new_data;
        capacity_ = new_capacity;
    }

public:
    ArrayList(int capacity = 10) : size_(0), capacity_(capacity) {
        data = new int[capacity];
    }

    ~ArrayList() { delete[] data; }

    int get(int index) {
        if (index < 0 || index >= size_)
            throw out_of_range("下标越界");
        return data[index];
    }

    void add(int value) {
        if (size_ == capacity_) resize(capacity_ * 2);
        data[size_++] = value;
    }

    void insert(int index, int value) {
        if (index < 0 || index > size_)
            throw out_of_range("下标越界");
        if (size_ == capacity_) resize(capacity_ * 2);
        // 后移 index 及之后的元素
        for (int i = size_; i > index; i--)
            data[i] = data[i - 1];
        data[index] = value;
        size_++;
    }

    int remove(int index) {
        if (index < 0 || index >= size_)
            throw out_of_range("下标越界");
        int removed = data[index];
        // 前移后续元素
        for (int i = index; i < size_ - 1; i++)
            data[i] = data[i + 1];
        size_--;
        return removed;
    }

    int size() const { return size_; }
};
\`\`\`
<!-- /LANG -->

<!-- LANG:c -->
\`\`\`c
#include <stdio.h>
#include <stdlib.h>

typedef struct {
    int *data;
    int size;
    int capacity;
} ArrayList;

/* 初始化顺序表 */
void al_init(ArrayList *al, int capacity) {
    al->data = (int*)malloc(capacity * sizeof(int));
    al->size = 0;
    al->capacity = capacity;
}

/* 获取下标元素 */
int al_get(ArrayList *al, int index) {
    if (index < 0 || index >= al->size) {
        fprintf(stderr, "下标越界\\n");
        exit(1);
    }
    return al->data[index];
}

/* 扩容 */
static void al_resize(ArrayList *al, int new_capacity) {
    al->data = (int*)realloc(al->data, new_capacity * sizeof(int));
    al->capacity = new_capacity;
}

/* 末尾追加 */
void al_add(ArrayList *al, int value) {
    if (al->size == al->capacity)
        al_resize(al, al->capacity * 2);
    al->data[al->size++] = value;
}

/* 中间插入 */
void al_insert(ArrayList *al, int index, int value) {
    if (index < 0 || index > al->size) {
        fprintf(stderr, "下标越界\\n");
        exit(1);
    }
    if (al->size == al->capacity)
        al_resize(al, al->capacity * 2);
    for (int i = al->size; i > index; i--)
        al->data[i] = al->data[i - 1];
    al->data[index] = value;
    al->size++;
}

/* 删除元素 */
int al_remove(ArrayList *al, int index) {
    if (index < 0 || index >= al->size) {
        fprintf(stderr, "下标越界\\n");
        exit(1);
    }
    int removed = al->data[index];
    for (int i = index; i < al->size - 1; i++)
        al->data[i] = al->data[i + 1];
    al->size--;
    return removed;
}

/* 释放内存 */
void al_free(ArrayList *al) {
    free(al->data);
    al->data = NULL;
    al->size = al->capacity = 0;
}
\`\`\`
<!-- /LANG -->

### 关键要点

> **扩容策略**：当数组满时，通常扩容为原来的 **2 倍**，均摊时间复杂度为 O(1)

> **插入/删除代价**：在头部插入时最差，需要移动所有元素，所以频繁在头部操作的场景应使用链表`
      },
      {
        id: 'linked-list',
        title: '1.2 链表',
        content: `## 链表

链表通过**指针**将零散的内存块串联起来，每个节点包含**数据域**和**指针域**。

![链式存储](/images/ds-notes/93e6ec67d1054c6296b28752968f8307.png)

### 链表类型

| 类型 | 特点 |
|------|------|
| 单链表 | 每个节点只有一个后继指针 |
| 双链表 | 每个节点有前驱和后继两个指针 |
| 循环链表 | 尾节点指向头节点 |

### 与数组对比

| | 数组 | 链表 |
|---|------|------|
| 随机访问 | O(1) | O(n) |
| 插入/删除 | O(n) | O(1)（已知位置） |
| 内存 | 连续, 需预分配 | 离散, 动态分配 |
| CPU缓存 | 友好 | 不友好 |

### 代码实现

<!-- LANG:python -->
\`\`\`python
class Node:
    def __init__(self, val):
        self.val = val
        self.next = None

class LinkedList:
    def __init__(self):
        self.head = None
        self.length = 0

    def add_first(self, val):
        """头插法 — O(1)"""
        node = Node(val)
        node.next = self.head
        self.head = node
        self.length += 1

    def add_last(self, val):
        """尾插法 — O(n)"""
        if not self.head:
            self.head = Node(val)
        else:
            cur = self.head
            while cur.next:
                cur = cur.next
            cur.next = Node(val)
        self.length += 1

    def remove(self, val):
        """删除第一个值为 val 的节点"""
        if not self.head: return
        if self.head.val == val:
            self.head = self.head.next
            self.length -= 1
            return
        cur = self.head
        while cur.next and cur.next.val != val:
            cur = cur.next
        if cur.next:
            cur.next = cur.next.next
            self.length -= 1

    def reverse(self):
        """反转链表 — 迭代法 O(n)"""
        prev, cur = None, self.head
        while cur:
            nxt = cur.next
            cur.next = prev
            prev = cur
            cur = nxt
        self.head = prev

    def to_list(self):
        result = []
        cur = self.head
        while cur:
            result.append(cur.val)
            cur = cur.next
        return result

    def __str__(self):
        return ' → '.join(str(x) for x in self.to_list())
\`\`\`
<!-- /LANG -->

<!-- LANG:cpp -->
\`\`\`cpp
#include <iostream>
using namespace std;

struct Node {
    int val;
    Node *next;
    Node(int v) : val(v), next(nullptr) {}
};

class LinkedList {
private:
    Node *head;
    int length_;

public:
    LinkedList() : head(nullptr), length_(0) {}

    ~LinkedList() {
        Node *cur = head;
        while (cur) {
            Node *nxt = cur->next;
            delete cur;
            cur = nxt;
        }
    }

    void addFirst(int val) {
        Node *node = new Node(val);
        node->next = head;
        head = node;
        length_++;
    }

    void addLast(int val) {
        Node *node = new Node(val);
        if (!head) {
            head = node;
        } else {
            Node *cur = head;
            while (cur->next) cur = cur->next;
            cur->next = node;
        }
        length_++;
    }

    void remove(int val) {
        if (!head) return;
        if (head->val == val) {
            Node *tmp = head;
            head = head->next;
            delete tmp;
            length_--;
            return;
        }
        Node *cur = head;
        while (cur->next && cur->next->val != val)
            cur = cur->next;
        if (cur->next) {
            Node *tmp = cur->next;
            cur->next = cur->next->next;
            delete tmp;
            length_--;
        }
    }

    void reverse() {
        Node *prev = nullptr, *cur = head;
        while (cur) {
            Node *nxt = cur->next;
            cur->next = prev;
            prev = cur;
            cur = nxt;
        }
        head = prev;
    }

    int length() const { return length_; }

    void print() const {
        Node *cur = head;
        while (cur) {
            cout << cur->val;
            if (cur->next) cout << " → ";
            cur = cur->next;
        }
        cout << endl;
    }
};
\`\`\`
<!-- /LANG -->

<!-- LANG:c -->
\`\`\`c
#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int val;
    struct Node *next;
} Node;

typedef struct {
    Node *head;
    int length;
} LinkedList;

/* 创建新节点 */
Node* node_new(int val) {
    Node *n = (Node*)malloc(sizeof(Node));
    n->val = val;
    n->next = NULL;
    return n;
}

/* 头插法 O(1) */
void ll_add_first(LinkedList *ll, int val) {
    Node *node = node_new(val);
    node->next = ll->head;
    ll->head = node;
    ll->length++;
}

/* 尾插法 O(n) */
void ll_add_last(LinkedList *ll, int val) {
    Node *node = node_new(val);
    if (!ll->head) {
        ll->head = node;
    } else {
        Node *cur = ll->head;
        while (cur->next) cur = cur->next;
        cur->next = node;
    }
    ll->length++;
}

/* 删除第一个值为 val 的节点 */
void ll_remove(LinkedList *ll, int val) {
    if (!ll->head) return;
    if (ll->head->val == val) {
        Node *tmp = ll->head;
        ll->head = ll->head->next;
        free(tmp);
        ll->length--;
        return;
    }
    Node *cur = ll->head;
    while (cur->next && cur->next->val != val)
        cur = cur->next;
    if (cur->next) {
        Node *tmp = cur->next;
        cur->next = cur->next->next;
        free(tmp);
        ll->length--;
    }
}

/* 反转链表 O(n) */
void ll_reverse(LinkedList *ll) {
    Node *prev = NULL, *cur = ll->head;
    while (cur) {
        Node *nxt = cur->next;
        cur->next = prev;
        prev = cur;
        cur = nxt;
    }
    ll->head = prev;
}

/* 打印链表 */
void ll_print(LinkedList *ll) {
    Node *cur = ll->head;
    while (cur) {
        printf("%d", cur->val);
        if (cur->next) printf(" → ");
        cur = cur->next;
    }
    printf("\\n");
}

/* 释放内存 */
void ll_free(LinkedList *ll) {
    Node *cur = ll->head;
    while (cur) {
        Node *nxt = cur->next;
        free(cur);
        cur = nxt;
    }
    ll->head = NULL;
    ll->length = 0;
}
\`\`\`
<!-- /LANG -->

### 常见面试题

1. **反转链表**：迭代/递归两种写法
2. **检测环**：快慢指针法，相遇则有环
3. **合并有序链表**：双指针归并
4. **删除倒数第 N 个节点**：快慢指针间隔 N 步
5. **求中间节点**：快指针走两步，慢指针走一步`
      },
      {
        id: 'sparse-matrix',
        title: '1.3 稀疏矩阵与三元组',
        content: `## 稀疏矩阵与三元组

### 数组的存储与下标计算

数组是 $n$ 个相同类型数据元素的有限序列。多维数组在内存中按一维排列，有两种存储方式：

- **以行序为主（行优先）**：按行号从小到大，依次存储每一行的元素（C/C++、Python NumPy 默认）
- **以列序为主（列优先）**：按列号从小到大，依次存储每一列的元素（Fortran、MATLAB 默认）

对于 $m \\times n$ 的二维数组，元素 $a_{ij}$ 的地址公式：

行优先：$LOC(i,j) = LOC(0,0) + (i \\times n + j) \\times L$
列优先：$LOC(i,j) = LOC(0,0) + (j \\times m + i) \\times L$

其中 $L$ 是每个元素占用的字节数。

### 特殊矩阵的压缩存储

**对称矩阵**：$a_{ij} = a_{ji}$，只需存储上三角或下三角（含对角线）。若存储下三角，元素位置为：

- 当 $i \\geq j$ 时：$k = \\frac{i(i-1)}{2} + j - 1$（下标从 1 开始）
- 当 $i < j$ 时：对称取 $a_{ji}$

**三角矩阵**：上三角或下三角区域为常数（通常为 0 或同一值），只需存储非常数区域加一个常数。

### 稀疏矩阵与三元组

当矩阵中**非零元素远少于零元素**（通常非零元占比 < 5%）时，称为稀疏矩阵。直接存储所有元素浪费大量空间，应只存储非零元。

**三元组表示法**：每个非零元用 $(i, j, v)$ 表示行号、列号和值。

\`\`\`c
typedef struct {
    int i, j;     // 行坐标、列坐标
    ElemType e;    // 元素值
} Triple;

typedef struct {
    Triple data[MAXSIZE + 1];  // 0 号单元不用
    int mu, nu, tu;            // 行数、列数、非零元个数
} TSMatrix;
\`\`\`

<!-- LANG:python -->
\`\`\`python
class SparseMatrix:
    def __init__(self, rows: int, cols: int):
        self.rows = rows
        self.cols = cols
        self.data: list[tuple[int, int, float]] = []  # (row, col, value)

    def add(self, row: int, col: int, value: float) -> None:
        if value != 0:
            self.data.append((row, col, value))

    def get(self, row: int, col: int) -> float:
        for r, c, v in self.data:
            if r == row and c == col:
                return v
        return 0.0
\`\`\`
<!-- /LANG -->

### 矩阵转置

**朴素转置**（以列序为主序）：

遍历原矩阵每一列，找到该列所有元素，交换行列坐标放入新矩阵：

\`\`\`c
void TransposeSMatrix(TSMatrix *T1, TSMatrix *T2) {
    T2->mu = T1->nu; T2->nu = T1->mu; T2->tu = T1->tu;
    if (T1->tu == 0) return;
    int q = 1;
    for (int col = 1; col <= T1->nu; col++)      // 按列扫描
        for (int p = 1; p <= T1->tu; p++)          // 遍历所有元素
            if (T1->data[p].j == col) {
                T2->data[q].i = T1->data[p].j;
                T2->data[q].j = T1->data[p].i;
                T2->data[q].e = T1->data[p].e;
                q++;
            }
}
\`\`\`

> 时间复杂度 $O(nu \\times tu)$，当矩阵较满时退化为 $O(nu^2 \\times mu)$

**快速转置**：

预先统计每列非零元个数和起始位置，一次遍历即可完成转置：

\`\`\`c
void FastTransposeSMatrix(TSMatrix *T1, TSMatrix *T2) {
    int num[T1->nu + 1], cpot[T1->nu + 1];
    T2->mu = T1->nu; T2->nu = T1->mu; T2->tu = T1->tu;
    if (T1->tu == 0) return;

    for (int col = 1; col <= T1->nu; col++) num[col] = 0;
    for (int t = 1; t <= T1->tu; t++) ++num[T1->data[t].j];

    cpot[1] = 1;
    for (int col = 2; col <= T1->nu; col++)
        cpot[col] = cpot[col - 1] + num[col - 1];

    for (int p = 1; p <= T1->tu; p++) {
        int col = T1->data[p].j;
        int q = cpot[col]++;
        T2->data[q].i = T1->data[p].j;
        T2->data[q].j = T1->data[p].i;
        T2->data[q].e = T1->data[p].e;
    }
}
\`\`\`

> 时间复杂度 $O(nu + tu)$，用空间换时间

<!-- LANG:python -->
\`\`\`python
def fast_transpose(sparse: SparseMatrix) -> SparseMatrix:
    result = SparseMatrix(sparse.cols, sparse.rows)
    if not sparse.data:
        return result

    # 统计每列非零元个数
    col_counts = {}
    for r, c, v in sparse.data:
        col_counts[c] = col_counts.get(c, 0) + 1

    # 计算每列起始位置
    positions = {}
    pos = 0
    for c in range(sparse.cols):
        if col_counts.get(c, 0) > 0:
            positions[c] = pos
            pos += col_counts[c]

    # 预分配并填充
    result.data = [None] * len(sparse.data)
    for r, c, v in sparse.data:
        result.data[positions[c]] = (c, r, v)
        positions[c] += 1

    return result
\`\`\`
<!-- /LANG -->

### 其他稀疏矩阵存储方式

| 方式 | 特点 | 适用场景 |
|------|------|---------|
| **三元组顺序表** | 简单、按行或列有序 | 矩阵创建后不再增删非零元 |
| **行逻辑链接** | 增加行起始索引，加速按行访问 | 需要频繁按行遍历 |
| **十字链表** | 每个非零元同时链接到同行和同列的下一个 | 频繁增删非零元 |

> **核心思想**：压缩存储的本质是用额外的索引信息换取空间节省。选择哪种方式取决于主要操作——是按行遍历、随机访问还是频繁修改。`
      }
    ]
  },
  {
    id: 'stack-queue',
    title: '二、栈和队列',
    icon: '📚',
    sections: [
      {
        id: 'stack',
        title: '2.1 栈',
        content: `## 栈（Stack）

栈是一种**后进先出（LIFO）**的线性结构，只能在一端（栈顶）进行插入和删除操作。

### 核心操作

| 操作 | 说明 | 复杂度 |
|------|------|--------|
| push | 入栈 | O(1) |
| pop | 出栈 | O(1) |
| peek | 查看栈顶 | O(1) |
| isEmpty | 判空 | O(1) |

### 代码实现

<!-- LANG:python -->
\`\`\`python
class Stack:
    def __init__(self):
        self.items = []

    def push(self, val):
        self.items.append(val)

    def pop(self):
        if self.is_empty():
            raise IndexError("栈为空")
        return self.items.pop()

    def peek(self):
        if self.is_empty():
            raise IndexError("栈为空")
        return self.items[-1]

    def is_empty(self):
        return len(self.items) == 0

    def size(self):
        return len(self.items)
\`\`\`
<!-- /LANG -->

<!-- LANG:cpp -->
\`\`\`cpp
#include <vector>
#include <stdexcept>
using namespace std;

template<typename T>
class Stack {
private:
    vector<T> items;
public:
    void push(const T& val) { items.push_back(val); }

    T pop() {
        if (items.empty()) throw runtime_error("栈为空");
        T val = items.back();
        items.pop_back();
        return val;
    }

    T& peek() {
        if (items.empty()) throw runtime_error("栈为空");
        return items.back();
    }

    bool isEmpty() const { return items.empty(); }
    int size() const { return items.size(); }
};
\`\`\`
<!-- /LANG -->

<!-- LANG:c -->
\`\`\`c
#include <stdio.h>
#include <stdlib.h>

typedef struct {
    int *data;
    int top;
    int capacity;
} Stack;

void stack_init(Stack *s, int capacity) {
    s->data = (int*)malloc(capacity * sizeof(int));
    s->top = -1;
    s->capacity = capacity;
}

void stack_push(Stack *s, int val) {
    if (s->top + 1 == s->capacity) {
        s->capacity *= 2;
        s->data = (int*)realloc(s->data, s->capacity * sizeof(int));
    }
    s->data[++s->top] = val;
}

int stack_pop(Stack *s) {
    if (s->top == -1) {
        fprintf(stderr, "栈为空\\n");
        exit(1);
    }
    return s->data[s->top--];
}

int stack_peek(Stack *s) {
    if (s->top == -1) {
        fprintf(stderr, "栈为空\\n");
        exit(1);
    }
    return s->data[s->top];
}

int stack_is_empty(Stack *s) { return s->top == -1; }
int stack_size(Stack *s) { return s->top + 1; }
void stack_free(Stack *s) { free(s->data); }
\`\`\`
<!-- /LANG -->

### 经典应用

- **括号匹配**：遇到左括号入栈，右括号与栈顶匹配
- **表达式求值**：中缀转后缀，用栈计算
- **函数调用栈**：递归的底层实现
- **撤销操作**：Ctrl+Z 的原理
- **浏览器前进后退**：两个栈配合

\`\`\`python
def is_valid_parentheses(s):
    """括号匹配 — 栈的典型应用"""
    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    for ch in s:
        if ch in '([{':
            stack.append(ch)
        elif ch in ')]}':
            if not stack or stack.pop() != pairs[ch]:
                return False
    return len(stack) == 0
\`\`\``
      },
      {
        id: 'queue',
        title: '2.2 队列',
        content: `## 队列（Queue）

队列是一种**先进先出（FIFO）**的线性结构，在队尾插入、队头删除。

### 核心操作

| 操作 | 说明 | 复杂度 |
|------|------|--------|
| enqueue | 入队 | O(1) |
| dequeue | 出队 | O(1) |
| peek | 查看队头 | O(1) |

### 代码实现

<!-- LANG:python -->
\`\`\`python
from collections import deque

class Queue:
    def __init__(self):
        self.items = deque()

    def enqueue(self, val):
        self.items.append(val)

    def dequeue(self):
        if self.is_empty():
            raise IndexError("队列为空")
        return self.items.popleft()

    def peek(self):
        if self.is_empty():
            raise IndexError("队列为空")
        return self.items[0]

    def is_empty(self):
        return len(self.items) == 0

    def size(self):
        return len(self.items)
\`\`\`
<!-- /LANG -->

<!-- LANG:cpp -->
\`\`\`cpp
#include <queue>
#include <stdexcept>
using namespace std;

template<typename T>
class Queue {
private:
    deque<T> items;
public:
    void enqueue(const T& val) { items.push_back(val); }

    T dequeue() {
        if (items.empty()) throw runtime_error("队列为空");
        T val = items.front();
        items.pop_front();
        return val;
    }

    T& peek() {
        if (items.empty()) throw runtime_error("队列为空");
        return items.front();
    }

    bool isEmpty() const { return items.empty(); }
    int size() const { return items.size(); }
};
\`\`\`
<!-- /LANG -->

<!-- LANG:c -->
\`\`\`c
#include <stdio.h>
#include <stdlib.h>

typedef struct {
    int *data;
    int head, tail;
    int capacity;
} Queue;

void queue_init(Queue *q, int capacity) {
    q->data = (int*)malloc(capacity * sizeof(int));
    q->head = 0;
    q->tail = -1;
    q->capacity = capacity;
}

void queue_enqueue(Queue *q, int val) {
    if (q->tail + 1 == q->capacity) {
        q->capacity *= 2;
        q->data = (int*)realloc(q->data, q->capacity * sizeof(int));
    }
    q->data[++q->tail] = val;
}

int queue_dequeue(Queue *q) {
    if (q->head > q->tail) {
        fprintf(stderr, "队列为空\\n");
        exit(1);
    }
    return q->data[q->head++];
}

int queue_peek(Queue *q) {
    if (q->head > q->tail) {
        fprintf(stderr, "队列为空\\n");
        exit(1);
    }
    return q->data[q->head];
}

int queue_is_empty(Queue *q) { return q->head > q->tail; }
int queue_size(Queue *q) { return q->tail - q->head + 1; }
void queue_free(Queue *q) { free(q->data); }
\`\`\`
<!-- /LANG -->

### 变种

| 类型 | 特点 | 应用场景 |
|------|------|---------|
| 循环队列 | 头尾相连，节省空间 | 缓冲区 |
| 双端队列 | 两端都可入/出 | 滑动窗口 |
| 优先队列 | 按优先级出队 | 任务调度、Dijkstra |

### 经典应用

- **BFS（广度优先搜索）**：核心数据结构
- **消息队列**：系统解耦、异步处理
- **滑动窗口最大值**：双端队列 O(n)
- **生产者-消费者模型**：线程间通信`
      },
      {
        id: 'string',
        title: '2.3 字符串',
        content: `## 字符串（String）

串（String）是由零个或多个字符组成的有限序列，记为 **S = 'a₁a₂…aₙ'**（n ≥ 0）。

### 基本概念

| 术语 | 说明 |
|------|------|
| **串长** | 串中字符个数 n，n=0 时为空串 |
| **子串** | 串中任意连续字符组成的子序列 |
| **主串** | 包含子串的串 |
| **空格串** | 由一个或多个空格组成的串（≠ 空串） |
| **串相等** | 长度相等且每个对应位置字符相等 |

### 存储方式

| 方式 | 特点 | 适用场景 |
|------|------|---------|
| **定长顺序存储** | 预定义最大长度，超出截断 | 已知最大长度 |
| **堆分配存储** | 动态分配数组，按需扩容 | 通用场景 |
| **块链存储** | 链表节点存放多个字符 | 插入/删除频繁 |

### KMP 模式匹配算法

KMP 算法的核心是利用已匹配部分的信息，避免主串指针回溯，时间复杂度 **O(n+m)**。

<!-- LANG:python -->
\`\`\`python
def kmp_search(text, pattern):
    """KMP 字符串匹配 — O(n+m)"""
    if not pattern: return 0

    # 构建 next 数组（部分匹配表）
    next_arr = [0] * len(pattern)
    j = 0
    for i in range(1, len(pattern)):
        while j > 0 and pattern[i] != pattern[j]:
            j = next_arr[j - 1]
        if pattern[i] == pattern[j]:
            j += 1
            next_arr[i] = j

    # 匹配过程
    j = 0
    for i, ch in enumerate(text):
        while j > 0 and ch != pattern[j]:
            j = next_arr[j - 1]
        if ch == pattern[j]:
            j += 1
        if j == len(pattern):
            return i - j + 1  # 匹配成功，返回起始位置
    return -1

print(kmp_search("ababcabcacbab", "abcac"))  # 5
\`\`\`
<!-- /LANG -->

<!-- LANG:cpp -->
\`\`\`cpp
#include <vector>
#include <string>
using namespace std;

vector<int> buildNext(const string& pat) {
    int m = pat.size();
    vector<int> next(m, 0);
    for (int i = 1, j = 0; i < m; i++) {
        while (j > 0 && pat[i] != pat[j]) j = next[j - 1];
        if (pat[i] == pat[j]) next[i] = ++j;
    }
    return next;
}

int kmpSearch(const string& txt, const string& pat) {
    if (pat.empty()) return 0;
    auto next = buildNext(pat);
    for (int i = 0, j = 0; i < txt.size(); i++) {
        while (j > 0 && txt[i] != pat[j]) j = next[j - 1];
        if (txt[i] == pat[j]) j++;
        if (j == pat.size()) return i - j + 1;
    }
    return -1;
}
\`\`\`
<!-- /LANG -->

<!-- LANG:c -->
\`\`\`c
#include <string.h>
#include <stdlib.h>

/* 构建 next 数组 */
void build_next(const char *pat, int *next, int m) {
    next[0] = 0;
    for (int i = 1, j = 0; i < m; i++) {
        while (j > 0 && pat[i] != pat[j]) j = next[j - 1];
        if (pat[i] == pat[j]) j++;
        next[i] = j;
    }
}

/* KMP 匹配，返回首次匹配位置，未找到返回 -1 */
int kmp_search(const char *txt, const char *pat) {
    int n = strlen(txt), m = strlen(pat);
    if (m == 0) return 0;
    int *next = (int*)malloc(m * sizeof(int));
    build_next(pat, next, m);
    int j = 0, result = -1;
    for (int i = 0; i < n; i++) {
        while (j > 0 && txt[i] != pat[j]) j = next[j - 1];
        if (txt[i] == pat[j]) j++;
        if (j == m) { result = i - m + 1; break; }
    }
    free(next);
    return result;
}
\`\`\`
<!-- /LANG -->

### 算法对比

| 算法 | 时间复杂度 | 特点 |
|------|-----------|------|
| **暴力匹配** | O(n×m) | 简单直观，主串指针回溯 |
| **KMP** | O(n+m) | 避免回溯，需预处理 next 数组 |
| **BM** | 最好 O(n/m) | 从右向左匹配，坏字符+好后缀 |
| **Sunday** | 平均 O(n) | 比 KMP 更简单高效 |`
      }
    ]
  },
  {
    id: 'tree',
    title: '三、树和二叉树',
    icon: '🌳',
    sections: [
      {
        id: 'binary-tree',
        title: '3.1 二叉树基础',
        content: `## 二叉树

二叉树是每个节点**最多有两个子节点**的树结构，分别称为左子节点和右子节点。

### 基本概念

- **根节点**：树的顶层节点
- **叶子节点**：没有子节点的节点
- **深度**：从根到该节点的边数
- **高度**：从该节点到最远叶子的边数
- **满二叉树**：每层节点数都达到最大
- **完全二叉树**：除最后一层外每层都满，最后一层靠左排列

### 存储 + 三种遍历

<!-- LANG:python -->
\`\`\`python
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

#     1
#    / \\
#   2   3
#  / \\
# 4   5
root = TreeNode(1,
    TreeNode(2, TreeNode(4), TreeNode(5)),
    TreeNode(3)
)

def preorder(root):
    """前序：根→左→右"""
    if not root: return []
    return [root.val] + preorder(root.left) + preorder(root.right)

def inorder(root):
    """中序：左→根→右（迭代）"""
    result, stack = [], []
    cur = root
    while cur or stack:
        while cur:
            stack.append(cur)
            cur = cur.left
        cur = stack.pop()
        result.append(cur.val)
        cur = cur.right
    return result

def level_order(root):
    """层序：BFS"""
    if not root: return []
    from collections import deque
    result, q = [], deque([root])
    while q:
        node = q.popleft()
        result.append(node.val)
        if node.left: q.append(node.left)
        if node.right: q.append(node.right)
    return result
\`\`\`
<!-- /LANG -->

<!-- LANG:cpp -->
\`\`\`cpp
#include <iostream>
#include <vector>
#include <queue>
#include <stack>
using namespace std;

struct TreeNode {
    int val;
    TreeNode *left, *right;
    TreeNode(int v) : val(v), left(nullptr), right(nullptr) {}
};

vector<int> preorder(TreeNode *root) {
    vector<int> res;
    if (!root) return res;
    stack<TreeNode*> st;
    st.push(root);
    while (!st.empty()) {
        TreeNode *node = st.top(); st.pop();
        res.push_back(node->val);
        if (node->right) st.push(node->right);
        if (node->left) st.push(node->left);
    }
    return res;
}

vector<int> inorder(TreeNode *root) {
    vector<int> res;
    stack<TreeNode*> st;
    TreeNode *cur = root;
    while (cur || !st.empty()) {
        while (cur) { st.push(cur); cur = cur->left; }
        cur = st.top(); st.pop();
        res.push_back(cur->val);
        cur = cur->right;
    }
    return res;
}

vector<int> levelOrder(TreeNode *root) {
    vector<int> res;
    if (!root) return res;
    queue<TreeNode*> q;
    q.push(root);
    while (!q.empty()) {
        TreeNode *node = q.front(); q.pop();
        res.push_back(node->val);
        if (node->left) q.push(node->left);
        if (node->right) q.push(node->right);
    }
    return res;
}
\`\`\`
<!-- /LANG -->

<!-- LANG:c -->
\`\`\`c
#include <stdio.h>
#include <stdlib.h>

typedef struct TreeNode {
    int val;
    struct TreeNode *left, *right;
} TreeNode;

TreeNode* tn_new(int val) {
    TreeNode *n = (TreeNode*)malloc(sizeof(TreeNode));
    n->val = val; n->left = n->right = NULL;
    return n;
}

void preorder(TreeNode *root) {
    if (!root) return;
    printf("%d ", root->val);
    preorder(root->left);
    preorder(root->right);
}

void inorder(TreeNode *root) {
    if (!root) return;
    inorder(root->left);
    printf("%d ", root->val);
    inorder(root->right);
}

void postorder(TreeNode *root) {
    if (!root) return;
    postorder(root->left);
    postorder(root->right);
    printf("%d ", root->val);
}

/* 使用示例:
 * TreeNode *root = tn_new(1);
 * root->left = tn_new(2);  root->right = tn_new(3);
 * preorder(root);  // 1 2 3
 */
\`\`\`
<!-- /LANG -->

### 遍历方式对比

| 遍历方式 | 顺序 | 用途 |
|---------|------|------|
| 前序 | 根→左→右 | 序列化、复制树 |
| 中序 | 左→根→右 | BST 得到有序序列 |
| 后序 | 左→右→根 | 删除树、计算高度 |
| 层序 | 逐层 | BFS、求深度 |`
      },
      {
        id: 'bst',
        title: '3.2 二叉搜索树（BST）',
        content: `## 二叉搜索树（BST）

BST 满足以下性质：**左子树所有节点值 < 根节点值 < 右子树所有节点值**。

### 核心操作

| 操作 | 平均 | 最坏（退化成链表） |
|------|------|-------------------|
| 查找 | O(log n) | O(n) |
| 插入 | O(log n) | O(n) |
| 删除 | O(log n) | O(n) |

### 代码实现

<!-- LANG:python -->
\`\`\`python
class BST:
    def __init__(self):
        self.root = None

    def search(self, val):
        """查找 — O(h)"""
        cur = self.root
        while cur:
            if val == cur.val: return cur
            cur = cur.left if val < cur.val else cur.right
        return None

    def insert(self, val):
        """插入 — 总是插到叶子位置"""
        if not self.root:
            self.root = TreeNode(val)
            return
        cur = self.root
        while True:
            if val < cur.val:
                if not cur.left:
                    cur.left = TreeNode(val)
                    return
                cur = cur.left
            else:
                if not cur.right:
                    cur.right = TreeNode(val)
                    return
                cur = cur.right

    def delete(self, val):
        self.root = self._delete(self.root, val)

    def _delete(self, node, val):
        if not node: return None
        if val < node.val:
            node.left = self._delete(node.left, val)
        elif val > node.val:
            node.right = self._delete(node.right, val)
        else:
            if not node.left and not node.right: return None
            if not node.left: return node.right
            if not node.right: return node.left
            # 找后继（右子树最小值）
            succ = node.right
            while succ.left: succ = succ.left
            node.val = succ.val
            node.right = self._delete(node.right, succ.val)
        return node
\`\`\`
<!-- /LANG -->

<!-- LANG:cpp -->
\`\`\`cpp
class BST {
private:
    TreeNode *root;

    TreeNode* _delete(TreeNode *node, int val) {
        if (!node) return nullptr;
        if (val < node->val)
            node->left = _delete(node->left, val);
        else if (val > node->val)
            node->right = _delete(node->right, val);
        else {
            if (!node->left && !node->right) {
                delete node; return nullptr;
            }
            if (!node->left) { auto r = node->right; delete node; return r; }
            if (!node->right) { auto l = node->left; delete node; return l; }
            TreeNode *succ = node->right;
            while (succ->left) succ = succ->left;
            node->val = succ->val;
            node->right = _delete(node->right, succ->val);
        }
        return node;
    }

public:
    BST() : root(nullptr) {}

    TreeNode* search(int val) {
        TreeNode *cur = root;
        while (cur) {
            if (val == cur->val) return cur;
            cur = val < cur->val ? cur->left : cur->right;
        }
        return nullptr;
    }

    void insert(int val) {
        if (!root) { root = new TreeNode(val); return; }
        TreeNode *cur = root;
        while (true) {
            if (val < cur->val) {
                if (!cur->left) { cur->left = new TreeNode(val); return; }
                cur = cur->left;
            } else {
                if (!cur->right) { cur->right = new TreeNode(val); return; }
                cur = cur->right;
            }
        }
    }

    void remove(int val) { root = _delete(root, val); }
};
\`\`\`
<!-- /LANG -->

<!-- LANG:c -->
\`\`\`c
/* 查找 O(h) */
TreeNode* bst_search(TreeNode *root, int val) {
    TreeNode *cur = root;
    while (cur) {
        if (val == cur->val) return cur;
        cur = val < cur->val ? cur->left : cur->right;
    }
    return NULL;
}

/* 插入 O(h) */
TreeNode* bst_insert(TreeNode *root, int val) {
    if (!root) return tn_new(val);
    if (val < root->val)
        root->left = bst_insert(root->left, val);
    else
        root->right = bst_insert(root->right, val);
    return root;
}

/* 查找最小值 */
TreeNode* bst_min(TreeNode *root) {
    while (root && root->left) root = root->left;
    return root;
}

/* 删除 O(h) */
TreeNode* bst_delete(TreeNode *root, int val) {
    if (!root) return NULL;
    if (val < root->val)
        root->left = bst_delete(root->left, val);
    else if (val > root->val)
        root->right = bst_delete(root->right, val);
    else {
        if (!root->left) { TreeNode *r = root->right; free(root); return r; }
        if (!root->right) { TreeNode *l = root->left; free(root); return l; }
        TreeNode *succ = bst_min(root->right);
        root->val = succ->val;
        root->right = bst_delete(root->right, succ->val);
    }
    return root;
}
\`\`\`
<!-- /LANG -->

### 平衡问题

> 普通 BST 在插入有序数据时会**退化成链表**，所有操作变成 O(n)。解决方法是使用**平衡二叉搜索树**（AVL、红黑树），通过旋转操作保持树的高度在 O(log n)。`
      },
      {
        id: 'avl',
        title: '3.4 平衡二叉树（AVL）',
        content: `## 平衡二叉树（AVL）

AVL 树是**任意节点左右子树高度差不超过 1** 的二叉搜索树，通过**旋转**操作保持平衡。

### 平衡因子

**平衡因子 = 左子树高度 − 右子树高度**，AVL 树中每个节点的平衡因子只能是 **-1、0、1**。

![AVL 树](/images/ds-notes/b4f24d04f0274274821775224a8932d0.png)

### 四种旋转

当插入导致失衡时，通过旋转恢复平衡：

| 类型 | 插入位置 | 旋转方式 |
|------|---------|---------|
| **LL** | 左子树的左子树 | 右单旋 |
| **RR** | 右子树的右子树 | 左单旋 |
| **LR** | 左子树的右子树 | 先左旋后右旋 |
| **RL** | 右子树的左子树 | 先右旋后左旋 |

![LL旋转](/images/ds-notes/c2399b3e07024ff9960b97128395db0e.png)
![RR旋转](/images/ds-notes/d25b8b2dab554ab59f81bac6a2753d86.png)
![LR旋转](/images/ds-notes/ec481fa5c1a4412bb3d6b0222539fb86.png)
![RL旋转](/images/ds-notes/e1d7759e463346939cef623989eb23e3.png)

### 操作复杂度

| 操作 | 时间复杂度 | 说明 |
|------|-----------|------|
| 查找 | O(log n) | 与普通 BST 相同 |
| 插入 | O(log n) | 最多 1 次旋转（单旋或双旋） |
| 删除 | O(log n) | 可能需要 O(log n) 次旋转 |

### 与红黑树对比

| 特性 | AVL 树 | 红黑树 |
|------|--------|--------|
| 平衡条件 | 严格（高度差 ≤1） | 宽松（最长 ≤ 最短×2） |
| 查找 | 更快（更平衡） | 略慢 |
| 插入/删除 | 旋转次数多 | 旋转次数少 |
| 适用场景 | 频繁查找 | 频繁插入/删除 |
| 典型应用 | 数据库索引 | C++ map/set, Java TreeMap |

> **记忆诀窍**：LL → 右单旋（提起左孩子），RR → 左单旋（提起右孩子），LR → 先左后右（左孩子先左旋→再整体右旋），RL → 先右后左（右孩子先右旋→再整体左旋）。`
      },
      {
        id: 'btree',
        title: '3.5 B树与B+树',
        content: `## B树与B+树

B树是一种**多路平衡查找树**，广泛应用于文件系统和数据库索引。

### B树（B-Tree）

**m 阶 B 树**满足以下性质：
- 每个节点最多 **m** 个孩子，最多 **m-1** 个关键字
- 非根非叶节点至少有 **⌈m/2⌉** 个孩子
- 根节点至少 2 个孩子（非叶时）
- 所有叶节点在同一层
- 节点内关键字有序排列

![B树结构](/images/ds-notes/174cdd08ed644e5a92e88d49a9c8005a.png)

### B+树

B+树是 B 树的变形，广泛应用于数据库索引（MySQL InnoDB）：

![B+树结构](/images/ds-notes/bd254def21d042e5a4f1feced51b2ba3.png)

### B树 vs B+树

| 特性 | B树 | B+树 |
|------|-----|------|
| **数据存储** | 所有节点都存数据 | 仅叶子节点存数据 |
| **内部节点** | 存关键字+数据指针 | 仅存关键字索引 |
| **叶子节点** | 独立 | 通过链表连接（范围查询） |
| **查找** | 可能在内部节点结束 | 必须到叶子节点 |
| **范围查询** | 需中序遍历 | O(log n + k)，链表遍历 |
| **应用** | 文件系统 | 数据库索引（MySQL） |

> MySQL InnoDB 使用 B+ 树作为聚簇索引，数据按主键顺序存于叶子节点；非聚簇索引的叶子节点存主键值，需回表查询。`
      },
      {
        id: 'heap',
        title: '3.3 堆与优先队列',
        content: `## 堆（Heap）

堆是一种**完全二叉树**，满足**堆序性质**：每个节点的值都 ≥（大顶堆）或 ≤（小顶堆）其子节点的值。

### 核心特性

- 用**数组**存储，索引从 0 开始：
  - 父节点: \`(i-1)//2\`
  - 左子节点: \`2i+1\`
  - 右子节点: \`2i+2\`
- 插入和删除都是 **O(log n)**

### 代码实现

<!-- LANG:python -->
\`\`\`python
class MinHeap:
    def __init__(self):
        self.heap = []

    def push(self, val):
        """上浮 — O(log n)"""
        self.heap.append(val)
        self._sift_up(len(self.heap) - 1)

    def pop(self):
        """下沉 — O(log n)"""
        if not self.heap: raise IndexError("堆为空")
        if len(self.heap) == 1: return self.heap.pop()
        root = self.heap[0]
        self.heap[0] = self.heap.pop()
        self._sift_down(0)
        return root

    def _sift_up(self, i):
        while i > 0:
            parent = (i - 1) // 2
            if self.heap[i] >= self.heap[parent]: break
            self.heap[i], self.heap[parent] = self.heap[parent], self.heap[i]
            i = parent

    def _sift_down(self, i):
        n = len(self.heap)
        while True:
            smallest = i
            left, right = 2 * i + 1, 2 * i + 2
            if left < n and self.heap[left] < self.heap[smallest]:
                smallest = left
            if right < n and self.heap[right] < self.heap[smallest]:
                smallest = right
            if smallest == i: break
            self.heap[i], self.heap[smallest] = self.heap[smallest], self.heap[i]
            i = smallest

    def peek(self):
        return self.heap[0] if self.heap else None
\`\`\`
<!-- /LANG -->

<!-- LANG:cpp -->
\`\`\`cpp
#include <vector>
#include <stdexcept>
using namespace std;

class MinHeap {
private:
    vector<int> heap;

    void siftUp(int i) {
        while (i > 0) {
            int p = (i - 1) / 2;
            if (heap[i] >= heap[p]) break;
            swap(heap[i], heap[p]);
            i = p;
        }
    }

    void siftDown(int i) {
        int n = heap.size();
        while (true) {
            int smallest = i;
            int l = 2 * i + 1, r = 2 * i + 2;
            if (l < n && heap[l] < heap[smallest]) smallest = l;
            if (r < n && heap[r] < heap[smallest]) smallest = r;
            if (smallest == i) break;
            swap(heap[i], heap[smallest]);
            i = smallest;
        }
    }

public:
    void push(int val) { heap.push_back(val); siftUp(heap.size() - 1); }

    int pop() {
        if (heap.empty()) throw runtime_error("堆为空");
        int root = heap[0];
        heap[0] = heap.back(); heap.pop_back();
        if (!heap.empty()) siftDown(0);
        return root;
    }

    int peek() const {
        if (heap.empty()) throw runtime_error("堆为空");
        return heap[0];
    }

    bool empty() const { return heap.empty(); }
};
\`\`\`
<!-- /LANG -->

<!-- LANG:c -->
\`\`\`c
typedef struct {
    int *data;
    int size;
    int capacity;
} MinHeap;

void heap_init(MinHeap *h, int cap) {
    h->data = (int*)malloc(cap * sizeof(int));
    h->size = 0; h->capacity = cap;
}

static void sift_up(MinHeap *h, int i) {
    while (i > 0) {
        int p = (i - 1) / 2;
        if (h->data[i] >= h->data[p]) break;
        int tmp = h->data[i]; h->data[i] = h->data[p]; h->data[p] = tmp;
        i = p;
    }
}

static void sift_down(MinHeap *h, int i) {
    int n = h->size;
    while (1) {
        int s = i, l = 2*i+1, r = 2*i+2;
        if (l < n && h->data[l] < h->data[s]) s = l;
        if (r < n && h->data[r] < h->data[s]) s = r;
        if (s == i) break;
        int tmp = h->data[i]; h->data[i] = h->data[s]; h->data[s] = tmp;
        i = s;
    }
}

void heap_push(MinHeap *h, int val) {
    if (h->size == h->capacity) {
        h->capacity *= 2;
        h->data = (int*)realloc(h->data, h->capacity * sizeof(int));
    }
    h->data[h->size] = val;
    sift_up(h, h->size++);
}

int heap_pop(MinHeap *h) {
    int root = h->data[0];
    h->data[0] = h->data[--h->size];
    if (h->size > 0) sift_down(h, 0);
    return root;
}

void heap_free(MinHeap *h) { free(h->data); }
\`\`\`
<!-- /LANG -->

### 应用场景

- **Top K 问题**：用小顶堆维护最大的 K 个元素
- **堆排序**：建堆 → 依次弹出
- **Dijkstra 最短路径**：用优先队列每次取最近节点
- **合并 K 个有序链表**：用堆维护 K 个指针

> Python 标准库 \`heapq\` 提供了 \`heappush\`、\`heappop\`、\`heapify\` 等操作，底层也是数组实现的小顶堆。`
      },
      {
        id: 'huffman-tree',
        title: '3.6 哈夫曼树与编码',
        content: `## 哈夫曼树（Huffman Tree）

### 基本概念

- **路径**：从一个结点到另一个结点所经过的分支序列
- **路径长度**：路径上的分支数目
- **结点的权**：为结点赋予的有意义的数值
- **带权路径长度**：从根到该结点的路径长度 × 该结点的权
- **树的带权路径长度（WPL）**：所有**叶子结点**的带权路径长度之和：

$$WPL = \\sum_{k=1}^{n} w_k \\times l_k$$

其中 $w_k$ 是第 $k$ 个叶子结点的权值，$l_k$ 是从根到该叶子的路径长度。

**哈夫曼树（最优二叉树）**：在含有 $n$ 个带权叶子结点的二叉树中，WPL 最小的那棵。

### 哈夫曼树的构造

**贪心策略**：每次从森林中选择两棵根结点权值最小的树合并，新树的根结点权值为两棵子树权值之和。

<!-- LANG:python -->
\`\`\`python
import heapq
from dataclasses import dataclass

@dataclass
class HuffmanNode:
    char: str | None
    freq: int
    left: 'HuffmanNode | None' = None
    right: 'HuffmanNode | None' = None

    def __lt__(self, other: 'HuffmanNode') -> bool:
        return self.freq < other.freq

def build_huffman_tree(freq_map: dict[str, int]) -> HuffmanNode | None:
    \"\"\"构造哈夫曼树，返回根结点\"\"\"
    heap: list[HuffmanNode] = []
    for char, freq in freq_map.items():
        heapq.heappush(heap, HuffmanNode(char, freq))

    while len(heap) > 1:
        left = heapq.heappop(heap)
        right = heapq.heappop(heap)
        parent = HuffmanNode(None, left.freq + right.freq, left, right)
        heapq.heappush(heap, parent)

    return heap[0] if heap else None

def generate_codes(root: HuffmanNode) -> dict[str, str]:
    \"\"\"遍历哈夫曼树生成编码表：左 0，右 1\"\"\"
    codes: dict[str, str] = {}

    def dfs(node: HuffmanNode, code: str) -> None:
        if node.char is not None:  # 叶子结点
            codes[node.char] = code
            return
        if node.left:
            dfs(node.left, code + '0')
        if node.right:
            dfs(node.right, code + '1')

    if root:
        dfs(root, '')
    return codes

# 示例
text = "ABRACADABRA"
freq = {}
for ch in text:
    freq[ch] = freq.get(ch, 0) + 1

tree = build_huffman_tree(freq)
codes = generate_codes(tree)
print("编码表:", codes)
\`\`\`
<!-- /LANG -->

<!-- LANG:c -->
\`\`\`c
// 哈夫曼树结点
typedef struct {
    int weight;          // 权值
    int parent, lchild, rchild;  // 双亲及左右孩子下标
} HTNode, *HuffmanTree;

// 构造哈夫曼树：n 个叶子结点，总共 2n-1 个结点
void CreateHuffmanTree(HuffmanTree *HT, int *w, int n) {
    if (n <= 1) return;
    int m = 2 * n - 1;  // 结点总数
    *HT = (HuffmanTree)malloc((m + 1) * sizeof(HTNode));

    // 初始化前 n 个叶子结点
    for (int i = 1; i <= n; i++) {
        (*HT)[i].weight = w[i - 1];
        (*HT)[i].parent = (*HT)[i].lchild = (*HT)[i].rchild = 0;
    }
    // 初始化后 n-1 个内部结点
    for (int i = n + 1; i <= m; i++) {
        (*HT)[i].weight = (*HT)[i].parent = (*HT)[i].lchild = (*HT)[i].rchild = 0;
    }

    // 构建哈夫曼树
    for (int i = n + 1; i <= m; i++) {
        int s1, s2;
        Select(*HT, i - 1, &s1, &s2);  // 选择 parent=0 且 weight 最小的两个
        (*HT)[s1].parent = (*HT)[s2].parent = i;
        (*HT)[i].lchild = s1;
        (*HT)[i].rchild = s2;
        (*HT)[i].weight = (*HT)[s1].weight + (*HT)[s2].weight;
    }
}
\`\`\`
<!-- /LANG -->

### 哈夫曼编码

哈夫曼编码是一种**可变字长编码（VLC）**，根据字符出现频率构造不等长编码：

- **高频字符** → 短编码
- **低频字符** → 长编码
- 任意编码不是另一个编码的前缀（**前缀编码**）

**编码过程**：从根到叶子，左分支标记为 0，右分支标记为 1，叶子结点的路径序列即为其编码。

| 字符 | 频率 | 哈夫曼编码 |
|------|------|-----------|
| A | 5 | 0 |
| B | 2 | 10 |
| R | 2 | 110 |
| C | 1 | 1110 |
| D | 1 | 1111 |

> **关键性质**：哈夫曼树中不存在度为 1 的结点（只有度为 0 的叶子和度为 2 的内部结点）。对于 n 个叶子，总共有 2n−1 个结点。

### 应用场景

- **文件压缩**：ZIP、JPEG、MP3 中的熵编码
- **通信传输**：减少传输数据量
- **最优决策树**：以概率为权值构建最优判定流程`
      },
      {
        id: 'threaded-binary-tree',
        title: '3.7 线索二叉树',
        content: `## 线索二叉树（Threaded Binary Tree）

### 引入动机

普通二叉树的二叉链表有 $n+1$ 个空链域（$n$ 个结点，共 $2n$ 个指针域，其中 $n-1$ 个指向孩子，剩余 $n+1$ 个为 NULL）。线索二叉树**利用这些空链域存储前驱/后继信息**，加速遍历。

### 线索化规则

在每个结点中增加两个标志位：

- **ltag = 0**：lchild 指向左孩子；**ltag = 1**：lchild 指向前驱
- **rtag = 0**：rchild 指向右孩子；**rtag = 1**：rchild 指向后继

\`\`\`c
typedef enum { Link, Thread } PointerTag;  // Link=0, Thread=1

typedef struct BiThrNode {
    ElemType data;
    struct BiThrNode *lchild, *rchild;
    PointerTag ltag, rtag;
} BiThrNode, *BiThrTree;
\`\`\`

<!-- LANG:python -->
\`\`\`python
from dataclasses import dataclass

@dataclass
class ThreadedNode:
    data: int
    left: 'ThreadedNode | None' = None
    right: 'ThreadedNode | None' = None
    ltag: int = 0  # 0: child, 1: thread (predecessor)
    rtag: int = 0  # 0: child, 1: thread (successor)

def inorder_thread(root: ThreadedNode | None) -> None:
    \"\"\"中序线索化二叉树\"\"\"
    prev = None

    def dfs(node: ThreadedNode | None) -> None:
        nonlocal prev
        if node is None:
            return
        dfs(node.left)  # 递归左子树
        if node.left is None:
            node.ltag = 1
            node.left = prev   # 左指针指向前驱
        if prev is not None and prev.right is None:
            prev.rtag = 1
            prev.right = node  # 前驱的右指针指向当前（后继）
        prev = node
        dfs(node.right)  # 递归右子树

    dfs(root)
\`\`\`
<!-- /LANG -->

### 线索化的三种类型

| 类型 | 线索指向 |
|------|---------|
| **先序线索化** | 按根→左→右顺序建立前驱后继线索 |
| **中序线索化** | 按左→根→右顺序建立前驱后继线索（最常用） |
| **后序线索化** | 按左→右→根顺序建立前驱后继线索 |

### 中序线索二叉树的遍历

线索化后，可以不用递归/栈实现遍历：

\`\`\`c
// 中序遍历线索二叉树（非递归）
void InOrderTraverse_Thr(BiThrTree T) {
    BiThrTree p = T->lchild;  // p 指向根结点
    while (p != T) {          // 空树或遍历结束时 p == T
        while (p->ltag == Link)  // 找到最左子结点
            p = p->lchild;
        visit(p->data);         // 访问
        while (p->rtag == Thread && p->rchild != T) {
            p = p->rchild;      // 沿线索访问后继
            visit(p->data);
        }
        p = p->rchild;         // 转向右子树
    }
}
\`\`\`

<!-- LANG:python -->
\`\`\`python
def inorder_traverse_threaded(root: ThreadedNode) -> list[int]:
    \"\"\"遍历中序线索二叉树，无需递归\"\"\"
    result = []
    curr = root
    # 找到最左边的结点
    while curr.left is not None and curr.ltag == 0:
        curr = curr.left

    while curr is not None:
        result.append(curr.data)
        # 如果有后继线索，直接跳转
        if curr.rtag == 1 and curr.right is not None:
            curr = curr.right
        else:
            # 否则找右子树的最左结点
            curr = curr.right
            while curr is not None and curr.ltag == 0 and curr.left is not None:
                curr = curr.left
    return result
\`\`\`
<!-- /LANG -->

### 线索二叉树的优势

| 操作 | 普通二叉树 | 线索二叉树 |
|------|-----------|-----------|
| 找中序前驱/后继 | O(n) 或需要栈 | O(1) 沿线索直接跳转 |
| 遍历实现 | 需要递归或显式栈 | 线性循环，无额外空间 |
| 空间开销 | 2n 个指针，空 n+1 | 额外 2n 个标记位 |

> **核心思想**：线索化是用空间换时间的思想——用微小的标记位代价，让空指针从"浪费"变成"加速"。中序线索二叉树最常用，因为它能方便地找到任一结点的前驱和后继，实现高效的顺序遍历。`
      }
    ]
  },
  {
    id: 'graph',
    title: '四、图',
    icon: '🕸️',
    sections: [
      {
        id: 'graph-basics',
        title: '4.1 图的基本概念与存储',
        content: `## 图的基本概念

图由**顶点集合 V** 和**边集合 E** 组成，记为 G = (V, E)。

### 基本术语

| 术语 | 说明 |
|------|------|
| 有向图 | 边有方向 |
| 无向图 | 边无方向 |
| 权值 | 边上的数值（距离、代价等） |
| 度 | 与顶点相连的边数 |
| 路径 | 顶点序列 v₁→v₂→...→vₙ |
| 连通图 | 任意两顶点间都有路径 |

### 代码实现

<!-- LANG:python -->
\`\`\`python
# 1. 邻接矩阵 — O(V²) 空间，适合稠密图
graph_matrix = [
    [0, 1, 0, 1],
    [1, 0, 1, 0],
    [0, 1, 0, 1],
    [1, 0, 1, 0],
]

# 2. 邻接表 — O(V+E) 空间，最常用
graph_adj = {
    0: [(1, 5), (3, 2)],     # (邻居, 权值)
    1: [(0, 5), (2, 3)],
    2: [(1, 3), (3, 8)],
    3: [(0, 2), (2, 8)],
}
\`\`\`
<!-- /LANG -->

<!-- LANG:cpp -->
\`\`\`cpp
#include <vector>
using namespace std;

// 邻接表 — 最常用
vector<pair<int,int>> graph[] = {
    {{1, 5}, {3, 2}},   // 0 → [(1,5), (3,2)]
    {{0, 5}, {2, 3}},   // 1 → [(0,5), (2,3)]
    {{1, 3}, {3, 8}},   // 2 → [(1,3), (3,8)]
    {{0, 2}, {2, 8}},   // 3 → [(0,2), (2,8)]
};

// 邻接矩阵
int graph_matrix[4][4] = {
    {0, 1, 0, 1},
    {1, 0, 1, 0},
    {0, 1, 0, 1},
    {1, 0, 1, 0},
};
\`\`\`
<!-- /LANG -->

<!-- LANG:c -->
\`\`\`c
#include <stdio.h>

/* 邻接表节点 */
typedef struct EdgeNode {
    int neighbor;
    int weight;
    struct EdgeNode *next;
} EdgeNode;

typedef struct {
    EdgeNode **adj;   /* 邻接表数组 */
    int V;            /* 顶点数 */
} Graph;

void graph_init(Graph *g, int V) {
    g->V = V;
    g->adj = (EdgeNode**)calloc(V, sizeof(EdgeNode*));
}

void graph_add_edge(Graph *g, int u, int v, int w) {
    EdgeNode *e = (EdgeNode*)malloc(sizeof(EdgeNode));
    e->neighbor = v; e->weight = w;
    e->next = g->adj[u];
    g->adj[u] = e;   /* 头插 */
}

void graph_free(Graph *g) {
    for (int i = 0; i < g->V; i++) {
        EdgeNode *cur = g->adj[i];
        while (cur) { EdgeNode *nxt = cur->next; free(cur); cur = nxt; }
    }
    free(g->adj);
}
\`\`\`
<!-- /LANG -->

### 选择建议

> **邻接表**是绝大多数场景的首选：空间效率高、遍历快。**邻接矩阵**只在需要频繁判断两点是否相邻（O(1)）的稠密图中使用。`
      },
      {
        id: 'graph-traversal',
        title: '4.2 图的遍历（BFS & DFS）',
        content: `## 图的遍历

### BFS（广度优先搜索）

使用**队列**，逐层遍历。适合求**最短路径**（无权图）。

### DFS（深度优先搜索）

使用**栈**（或递归），沿一条路径走到底再回溯。

### 代码实现

<!-- LANG:python -->
\`\`\`python
from collections import deque

def bfs(graph, start):
    visited = set([start])
    queue = deque([start])
    result = []
    while queue:
        node = queue.popleft()
        result.append(node)
        for neighbor, _ in graph.get(node, []):
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)
    return result

def dfs(graph, start):
    visited = set()
    result = []
    def _dfs(node):
        visited.add(node)
        result.append(node)
        for neighbor, _ in graph.get(node, []):
            if neighbor not in visited:
                _dfs(neighbor)
    _dfs(start)
    return result

# 迭代版 DFS（显式栈）
def dfs_iter(graph, start):
    visited = set([start])
    stack = [start]
    result = []
    while stack:
        node = stack.pop()
        result.append(node)
        for neighbor, _ in graph.get(node, []):
            if neighbor not in visited:
                visited.add(neighbor)
                stack.append(neighbor)
    return result
\`\`\`
<!-- /LANG -->

<!-- LANG:cpp -->
\`\`\`cpp
#include <vector>
#include <queue>
#include <stack>
#include <unordered_set>
using namespace std;

void bfs(vector<pair<int,int>> graph[], int start, int V) {
    vector<bool> visited(V, false);
    queue<int> q;
    visited[start] = true; q.push(start);
    while (!q.empty()) {
        int u = q.front(); q.pop();
        cout << u << " ";
        for (auto& [v, w] : graph[u]) {
            if (!visited[v]) {
                visited[v] = true;
                q.push(v);
            }
        }
    }
}

void dfs_iter(vector<pair<int,int>> graph[], int start, int V) {
    vector<bool> visited(V, false);
    stack<int> st;
    st.push(start);
    while (!st.empty()) {
        int u = st.top(); st.pop();
        if (visited[u]) continue;
        visited[u] = true;
        cout << u << " ";
        for (auto& [v, w] : graph[u]) {
            if (!visited[v]) st.push(v);
        }
    }
}
\`\`\`
<!-- /LANG -->

<!-- LANG:c -->
\`\`\`c
#include <stdbool.h>

void bfs(Graph *g, int start) {
    bool *visited = (bool*)calloc(g->V, sizeof(bool));
    int *q = (int*)malloc(g->V * sizeof(int));
    int front = 0, rear = 0;

    visited[start] = true; q[rear++] = start;
    while (front < rear) {
        int u = q[front++];
        printf("%d ", u);
        for (EdgeNode *e = g->adj[u]; e; e = e->next) {
            if (!visited[e->neighbor]) {
                visited[e->neighbor] = true;
                q[rear++] = e->neighbor;
            }
        }
    }
    free(visited); free(q);
}

void dfs(Graph *g, int start) {
    bool *visited = (bool*)calloc(g->V, sizeof(bool));
    int *st = (int*)malloc(g->V * sizeof(int));
    int top = 0;
    st[top++] = start;
    while (top > 0) {
        int u = st[--top];
        if (visited[u]) continue;
        visited[u] = true;
        printf("%d ", u);
        for (EdgeNode *e = g->adj[u]; e; e = e->next)
            if (!visited[e->neighbor]) st[top++] = e->neighbor;
    }
    free(visited); free(st);
}
\`\`\`
<!-- /LANG -->

### 复杂度对比

| | BFS | DFS |
|---|-----|-----|
| 时间 | O(V+E) | O(V+E) |
| 空间 | O(V) | O(h) h为递归深度 |
| 用途 | 最短路径、层序遍历 | 拓扑排序、连通分量、环检测 |
| 数据结构 | 队列 | 栈（递归） |`
      },
      {
        id: 'dijkstra',
        title: '4.3 最短路径（Dijkstra）',
        content: `## Dijkstra 最短路径算法

Dijkstra 算法求**单源最短路径**：从起点出发，每次选择距离最小的未访问节点，更新其邻居的距离。

> **限制**：不能处理负权边（负权边用 Bellman-Ford）

### 算法步骤

1. 初始化：起点距离 = 0，其他节点距离 = ∞
2. 从优先队列中取出距离最小的节点 u
3. 遍历 u 的邻居 v，如果 dist[u] + w(u,v) < dist[v]，更新 dist[v]
4. 重复步骤 2-3，直到队列为空

### 代码实现

<!-- LANG:python -->
\`\`\`python
import heapq

def dijkstra(graph, start):
    """返回 start 到所有节点的最短距离"""
    dist = {node: float('inf') for node in graph}
    dist[start] = 0
    pq = [(0, start)]  # (距离, 节点)
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]: continue  # 跳过过期记录
        for v, w in graph[u]:
            new_dist = dist[u] + w
            if new_dist < dist[v]:
                dist[v] = new_dist
                heapq.heappush(pq, (new_dist, v))
    return dist

graph = {0: [(1,4), (2,1)], 1: [(3,1)], 2: [(1,2), (3,5)], 3: []}
print(dijkstra(graph, 0))  # {0:0, 1:3, 2:1, 3:4}
\`\`\`
<!-- /LANG -->

<!-- LANG:cpp -->
\`\`\`cpp
#include <vector>
#include <queue>
using namespace std;

vector<int> dijkstra(vector<pair<int,int>> graph[], int start, int V) {
    const int INF = 1e9;
    vector<int> dist(V, INF);
    priority_queue<pair<int,int>, vector<pair<int,int>>, greater<>> pq;

    dist[start] = 0;
    pq.push({0, start});

    while (!pq.empty()) {
        auto [d, u] = pq.top(); pq.pop();
        if (d > dist[u]) continue;
        for (auto& [v, w] : graph[u]) {
            if (dist[u] + w < dist[v]) {
                dist[v] = dist[u] + w;
                pq.push({dist[v], v});
            }
        }
    }
    return dist;
}
\`\`\`
<!-- /LANG -->

<!-- LANG:c -->
\`\`\`c
#include <limits.h>

/* 简化版：O(V²) 实现，适合稠密图 */
void dijkstra(int **graph, int start, int V, int *dist) {
    int *visited = (int*)calloc(V, sizeof(int));
    for (int i = 0; i < V; i++) dist[i] = INT_MAX;
    dist[start] = 0;

    for (int i = 0; i < V - 1; i++) {
        int u = -1, min_d = INT_MAX;
        for (int j = 0; j < V; j++)
            if (!visited[j] && dist[j] < min_d)
                min_d = dist[j], u = j;
        if (u == -1) break;
        visited[u] = 1;
        for (int v = 0; v < V; v++)
            if (!visited[v] && graph[u][v] &&
                dist[u] + graph[u][v] < dist[v])
                dist[v] = dist[u] + graph[u][v];
    }
    free(visited);
}
\`\`\`
<!-- /LANG -->

### 复杂度

- **时间**：O((V+E) log V)，使用二叉堆优化
- **空间**：O(V)，存储距离表

### 扩展

| 算法 | 适用场景 |
|------|---------|
| Bellman-Ford | 可处理负权边 |
| Floyd-Warshall | 多源最短路径 |
| A* | 带启发式的寻路 |`
      },
      {
        id: 'graph-mst',
        title: '4.4 最小生成树（Prim & Kruskal）',
        content: `## 最小生成树（MST）

最小生成树是连通带权图的**极小连通子图**，包含所有顶点，且边权值之和最小。

### Prim 算法（加点法）

从任意顶点开始，每次选择**连接已选集合和未选集合的最小权边**，将对应顶点加入。

![Prim算法](/images/ds-notes/c27ac192ad0142fc857c5d1f958f990e.png)

- **时间复杂度**：O(V²) 朴素实现，O((V+E)log V) 堆优化
- **适用**：稠密图

### Kruskal 算法（加边法）

按边权升序排列，依次选择**不构成环的最小权边**，直到选出 V-1 条边。

![Kruskal算法](/images/ds-notes/62cba09c6a5749939744f625ed2fdcf1.png)

- **时间复杂度**：O(E log E)，主要耗时在排序
- **适用**：稀疏图

### 对比

| | Prim | Kruskal |
|---|------|---------|
| 核心思想 | 加点 | 加边 |
| 数据结构 | 优先队列 | 并查集 |
| 适合图类型 | 稠密图 | 稀疏图 |
| 时间复杂度 | O(V²) / O(E log V) | O(E log E) |`
      },
      {
        id: 'graph-topo',
        title: '4.5 拓扑排序与关键路径',
        content: `## 拓扑排序

拓扑排序是将**有向无环图（DAG）** 的所有顶点排成一个线性序列，满足：若存在边 u→v，则 u 在序列中出现在 v 之前。

![拓扑排序](/images/ds-notes/d3e314b7f24a40a88c7f12f99dae646e.png)

### Kahn 算法（BFS）

1. 计算所有顶点的入度
2. 入度为 0 的顶点入队
3. 出队时将其邻居入度减 1，新入度为 0 则入队
4. 若最终序列长度 < V，说明存在环

<!-- LANG:python -->
\`\`\`python
from collections import deque

def topological_sort(graph, V):
    indegree = [0] * V
    for u in graph:
        for v, _ in graph[u]:
            indegree[v] += 1
    q = deque([i for i in range(V) if indegree[i] == 0])
    result = []
    while q:
        u = q.popleft()
        result.append(u)
        for v, _ in graph.get(u, []):
            indegree[v] -= 1
            if indegree[v] == 0:
                q.append(v)
    return result if len(result) == V else []  # 空列表 = 有环
\`\`\`
<!-- /LANG -->

### 关键路径

关键路径是项目中**决定总工期的最长路径**，关键路径上的活动不能有任何延误。

### AOE 网概念

| 概念 | 说明 |
|------|------|
| **AOE 网** | 边表示活动（Activity On Edge），顶点表示事件 |
| **事件最早发生时间 ve** | 从源点到该事件的最长路径 |
| **事件最晚发生时间 vl** | 不推迟工期的前提下，事件最晚发生时间 |
| **活动最早开始 e** | e(i) = ve(活动起点) |
| **活动最晚开始 l** | l(i) = vl(活动终点) − 活动持续时间 |
| **关键活动** | e(i) = l(i) 的活动，即无时间余量 |

![关键路径](/images/ds-notes/b8151fe5f476449abd9b9837ac913647.png)

> 求关键路径步骤：① 拓扑排序求各事件 ve ② 逆拓扑求各事件 vl ③ 计算各活动 e 和 l ④ e = l 的活动为关键活动。`
      }
    ]
  },
  {
    id: 'search',
    title: '五、查找',
    icon: '🔍',
    sections: [
      {
        id: 'binary-search',
        title: '5.1 二分查找',
        content: `## 二分查找

二分查找在**有序数组**中通过不断折半来定位目标值，时间复杂度 **O(log n)**。

### 前提条件

- 数据必须**有序**
- 支持**随机访问**（数组，不能是链表）

### 代码实现

<!-- LANG:python -->
\`\`\`python
def binary_search(arr, target):
    """标准二分查找 — 返回下标，未找到返回 -1"""
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = left + (right - left) // 2  # 防止溢出
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1

def lower_bound(arr, target):
    """查找第一个 ≥ target 的位置"""
    left, right = 0, len(arr)
    while left < right:
        mid = left + (right - left) // 2
        if arr[mid] >= target:
            right = mid
        else:
            left = mid + 1
    return left

def upper_bound(arr, target):
    """查找第一个 > target 的位置"""
    left, right = 0, len(arr)
    while left < right:
        mid = left + (right - left) // 2
        if arr[mid] > target:
            right = mid
        else:
            left = mid + 1
    return left
\`\`\`
<!-- /LANG -->

<!-- LANG:cpp -->
\`\`\`cpp
#include <vector>
using namespace std;

/* 标准二分查找 */
int binarySearch(vector<int>& arr, int target) {
    int left = 0, right = arr.size() - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (arr[mid] == target) return mid;
        else if (arr[mid] < target) left = mid + 1;
        else right = mid - 1;
    }
    return -1;
}

/* 第一个 ≥ target 的位置 (lower_bound) */
int lowerBound(vector<int>& arr, int target) {
    int left = 0, right = arr.size();
    while (left < right) {
        int mid = left + (right - left) / 2;
        if (arr[mid] >= target) right = mid;
        else left = mid + 1;
    }
    return left;
}

/* 第一个 > target 的位置 (upper_bound) */
int upperBound(vector<int>& arr, int target) {
    int left = 0, right = arr.size();
    while (left < right) {
        int mid = left + (right - left) / 2;
        if (arr[mid] > target) right = mid;
        else left = mid + 1;
    }
    return left;
}
\`\`\`
<!-- /LANG -->

<!-- LANG:c -->
\`\`\`c
/* 标准二分查找 */
int binary_search(int arr[], int n, int target) {
    int left = 0, right = n - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (arr[mid] == target) return mid;
        else if (arr[mid] < target) left = mid + 1;
        else right = mid - 1;
    }
    return -1;
}

/* 第一个 ≥ target 的位置 */
int lower_bound(int arr[], int n, int target) {
    int left = 0, right = n;
    while (left < right) {
        int mid = left + (right - left) / 2;
        if (arr[mid] >= target) right = mid;
        else left = mid + 1;
    }
    return left;
}
\`\`\`
<!-- /LANG -->

### 常见变种

| 变种 | 功能 |
|------|------|
| lower_bound | 第一个 ≥ target |
| upper_bound | 第一个 > target |
| 旋转数组查找 | 分段有序 |
| 二分答案 | 在值域上二分 |

### 常见错误

1. \`mid = (left + right) // 2\` 可能**整数溢出**（Python 无此问题，C/C++ 需注意）
2. 循环条件写成 \`left < right\` 漏掉最后一个元素
3. 边界更新写成 \`left = mid\` 导致死循环`
      },
      {
        id: 'search-analysis',
        title: '5.2 查找算法分析',
        content: `## 查找算法分析

### 平均查找长度（ASL）

**ASL = Σ(Pᵢ × Cᵢ)**，Pᵢ 为查找第 i 个元素的概率，Cᵢ 为查找所需的比较次数。

![ASL](/images/ds-notes/2630afa057ce49e19eb5f43bee0112b1.png)

### 顺序查找 vs 折半查找

| | 顺序查找 | 折半查找 |
|---|---------|---------|
| **前提** | 无要求 | 有序表 + 随机存取 |
| **ASL(成功)** | (n+1)/2 | log₂(n+1)−1 |
| **ASL(失败)** | n | ⌊log₂n⌋+1 |
| **时间复杂度** | O(n) | O(log n) |
| **存储结构** | 均可 | 仅顺序表 |

![折半查找](/images/ds-notes/9846670db92642f99f701264f0814063.png)

### 分块查找（索引顺序查找）

数据分块，块间有序、块内无序。先查索引定位块，再块内顺序查找。

![分块查找](/images/ds-notes/8600df6bed524e14bd9a11e6d43d512d.png)

| 特性 | 说明 |
|------|------|
| **时间复杂度** | O(√n)（最优分块大小 = √n） |
| **优点** | 插入删除方便 |
| **适用** | 动态变化的查找表 |

> 分块查找兼顾了查找效率和插入删除的灵活性，是折半与顺序的折中。`
      },
      {
        id: 'hash-table',
        title: '5.3 哈希表',
        content: `## 哈希表

哈希表通过**哈希函数**将键映射到数组下标，实现 O(1) 平均查找时间。

### 核心概念

- **哈希函数**：key → index 的映射函数
- **冲突处理**：两个不同 key 映射到同一 index

### 冲突解决方法

| 方法 | 原理 | Python 实现 |
|------|------|------------|
| 链地址法 | 每个桶存链表 | dict 默认 |
| 开放寻址法 | 冲突时找下一个空位 | set 默认 |

### 代码实现（链地址法）

<!-- LANG:python -->
\`\`\`python
class MyHashMap:
    def __init__(self, capacity=16):
        self.capacity = capacity
        self.buckets = [[] for _ in range(capacity)]
        self.size = 0

    def _hash(self, key):
        return hash(key) % self.capacity

    def put(self, key, value):
        idx = self._hash(key)
        for i, (k, v) in enumerate(self.buckets[idx]):
            if k == key:
                self.buckets[idx][i] = (key, value)
                return
        self.buckets[idx].append((key, value))
        self.size += 1
        if self.size / self.capacity > 0.75:
            self._resize(self.capacity * 2)

    def get(self, key):
        idx = self._hash(key)
        for k, v in self.buckets[idx]:
            if k == key: return v
        raise KeyError(key)

    def remove(self, key):
        idx = self._hash(key)
        for i, (k, v) in enumerate(self.buckets[idx]):
            if k == key:
                del self.buckets[idx][i]
                self.size -= 1
                return
        raise KeyError(key)

    def _resize(self, new_cap):
        old = self.buckets
        self.capacity = new_cap
        self.buckets = [[] for _ in range(new_cap)]
        self.size = 0
        for bucket in old:
            for k, v in bucket:
                self.put(k, v)
\`\`\`
<!-- /LANG -->

### 应用场景

- **去重**：set 判重
- **计数**：Counter 统计频率
- **缓存**：LRU、LFU
- **两数之和**：存遍历过的值和下标

### 注意事项

> Python dict/set 是无序的（3.7+ 保留插入顺序）。哈希表在**最坏情况**（全部冲突）下退化为 O(n)，但通过好的哈希函数和扩容策略，实际使用中极少发生。`
      }
    ]
  },
  {
    id: 'sort',
    title: '六、排序',
    icon: '📊',
    sections: [
      {
        id: 'basic-sorts',
        title: '6.1 基础排序算法',
        content: `## 基础排序算法

### 冒泡排序

每一轮将最大的元素"冒泡"到末尾。

<!-- LANG:python -->
\`\`\`python
def bubble_sort(arr):
    n = len(arr)
    for i in range(n - 1):
        swapped = False
        for j in range(n - 1 - i):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                swapped = True
        if not swapped:  # 提前终止优化
            break
    return arr
\`\`\`
<!-- /LANG -->

<!-- LANG:cpp -->
\`\`\`cpp
void bubbleSort(vector<int>& arr) {
    int n = arr.size();
    for (int i = 0; i < n - 1; i++) {
        bool swapped = false;
        for (int j = 0; j < n - 1 - i; j++) {
            if (arr[j] > arr[j + 1]) {
                swap(arr[j], arr[j + 1]);
                swapped = true;
            }
        }
        if (!swapped) break;
    }
}
\`\`\`
<!-- /LANG -->

<!-- LANG:c -->
\`\`\`c
void bubble_sort(int arr[], int n) {
    for (int i = 0; i < n - 1; i++) {
        int swapped = 0;
        for (int j = 0; j < n - 1 - i; j++) {
            if (arr[j] > arr[j + 1]) {
                int tmp = arr[j]; arr[j] = arr[j+1]; arr[j+1] = tmp;
                swapped = 1;
            }
        }
        if (!swapped) break;
    }
}
\`\`\`
<!-- /LANG -->

- 时间：最好 O(n)，平均 O(n²) | 空间：O(1) | 稳定：是

### 插入排序

将每个元素插入到已排序部分的正确位置。

<!-- LANG:python -->
\`\`\`python
def insertion_sort(arr):
    for i in range(1, len(arr)):
        key = arr[i]
        j = i - 1
        while j >= 0 and arr[j] > key:
            arr[j + 1] = arr[j]
            j -= 1
        arr[j + 1] = key
    return arr
\`\`\`
<!-- /LANG -->

<!-- LANG:cpp -->
\`\`\`cpp
void insertionSort(vector<int>& arr) {
    for (int i = 1; i < arr.size(); i++) {
        int key = arr[i], j = i - 1;
        while (j >= 0 && arr[j] > key) {
            arr[j + 1] = arr[j];
            j--;
        }
        arr[j + 1] = key;
    }
}
\`\`\`
<!-- /LANG -->

<!-- LANG:c -->
\`\`\`c
void insertion_sort(int arr[], int n) {
    for (int i = 1; i < n; i++) {
        int key = arr[i], j = i - 1;
        while (j >= 0 && arr[j] > key) {
            arr[j + 1] = arr[j];
            j--;
        }
        arr[j + 1] = key;
    }
}
\`\`\`
<!-- /LANG -->

- 时间：最好 O(n)，平均 O(n²) | 空间：O(1) | 稳定：是 | 适用：小规模或基本有序

### 选择排序

每一轮选择最小元素放到已排序部分的末尾。

<!-- LANG:python -->
\`\`\`python
def selection_sort(arr):
    n = len(arr)
    for i in range(n - 1):
        min_idx = i
        for j in range(i + 1, n):
            if arr[j] < arr[min_idx]:
                min_idx = j
        arr[i], arr[min_idx] = arr[min_idx], arr[i]
    return arr
\`\`\`
<!-- /LANG -->

<!-- LANG:cpp -->
\`\`\`cpp
void selectionSort(vector<int>& arr) {
    int n = arr.size();
    for (int i = 0; i < n - 1; i++) {
        int minIdx = i;
        for (int j = i + 1; j < n; j++)
            if (arr[j] < arr[minIdx]) minIdx = j;
        swap(arr[i], arr[minIdx]);
    }
}
\`\`\`
<!-- /LANG -->

<!-- LANG:c -->
\`\`\`c
void selection_sort(int arr[], int n) {
    for (int i = 0; i < n - 1; i++) {
        int min_i = i;
        for (int j = i + 1; j < n; j++)
            if (arr[j] < arr[min_i]) min_i = j;
        int tmp = arr[i]; arr[i] = arr[min_i]; arr[min_i] = tmp;
    }
}
\`\`\`
<!-- /LANG -->

- 时间：始终 O(n²) | 空间：O(1) | 稳定：否 | 特点：交换次数最少`
      },
      {
        id: 'advanced-sorts',
        title: '6.2 高级排序算法',
        content: `## 高级排序算法

### 快速排序

分治法：选 pivot，将数组分为小于和大于 pivot 的两部分，递归排序。

<!-- LANG:python -->
\`\`\`python
def quick_sort(arr):
    if len(arr) <= 1: return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    mid = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + mid + quick_sort(right)

# 原地版本
def quick_sort_inplace(arr, low=0, high=None):
    if high is None: high = len(arr) - 1
    if low >= high: return
    pivot = arr[high]
    i = low  # i 指向第一个 > pivot 的位置
    for j in range(low, high):
        if arr[j] <= pivot:
            arr[i], arr[j] = arr[j], arr[i]
            i += 1
    arr[i], arr[high] = arr[high], arr[i]
    quick_sort_inplace(arr, low, i - 1)
    quick_sort_inplace(arr, i + 1, high)
\`\`\`
<!-- /LANG -->

<!-- LANG:cpp -->
\`\`\`cpp
int partition(vector<int>& arr, int low, int high) {
    int pivot = arr[high], i = low;
    for (int j = low; j < high; j++)
        if (arr[j] <= pivot)
            swap(arr[i++], arr[j]);
    swap(arr[i], arr[high]);
    return i;
}

void quickSort(vector<int>& arr, int low, int high) {
    if (low >= high) return;
    int pi = partition(arr, low, high);
    quickSort(arr, low, pi - 1);
    quickSort(arr, pi + 1, high);
}
\`\`\`
<!-- /LANG -->

<!-- LANG:c -->
\`\`\`c
static int partition(int arr[], int low, int high) {
    int pivot = arr[high], i = low;
    for (int j = low; j < high; j++)
        if (arr[j] <= pivot) {
            int tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
            i++;
        }
    int tmp = arr[i]; arr[i] = arr[high]; arr[high] = tmp;
    return i;
}

void quick_sort(int arr[], int low, int high) {
    if (low >= high) return;
    int pi = partition(arr, low, high);
    quick_sort(arr, low, pi - 1);
    quick_sort(arr, pi + 1, high);
}
\`\`\`
<!-- /LANG -->

- 时间：平均 O(n log n)，最坏 O(n²) | 空间：O(log n) | 稳定：否

### 归并排序

分治法：将数组二分，分别排序后合并。

<!-- LANG:python -->
\`\`\`python
def merge_sort(arr):
    if len(arr) <= 1: return arr
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    return merge(left, right)

def merge(left, right):
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i]); i += 1
        else:
            result.append(right[j]); j += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result
\`\`\`
<!-- /LANG -->

<!-- LANG:cpp -->
\`\`\`cpp
void merge(vector<int>& arr, int l, int m, int r) {
    vector<int> L(arr.begin()+l, arr.begin()+m+1);
    vector<int> R(arr.begin()+m+1, arr.begin()+r+1);
    int i = 0, j = 0, k = l;
    while (i < L.size() && j < R.size())
        arr[k++] = (L[i] <= R[j]) ? L[i++] : R[j++];
    while (i < L.size()) arr[k++] = L[i++];
    while (j < R.size()) arr[k++] = R[j++];
}

void mergeSort(vector<int>& arr, int l, int r) {
    if (l >= r) return;
    int m = l + (r - l) / 2;
    mergeSort(arr, l, m);
    mergeSort(arr, m + 1, r);
    merge(arr, l, m, r);
}
\`\`\`
<!-- /LANG -->

<!-- LANG:c -->
\`\`\`c
static void merge(int arr[], int l, int m, int r) {
    int n1 = m - l + 1, n2 = r - m;
    int *L = (int*)malloc(n1 * sizeof(int));
    int *R = (int*)malloc(n2 * sizeof(int));
    for (int i = 0; i < n1; i++) L[i] = arr[l + i];
    for (int j = 0; j < n2; j++) R[j] = arr[m + 1 + j];
    int i = 0, j = 0, k = l;
    while (i < n1 && j < n2)
        arr[k++] = (L[i] <= R[j]) ? L[i++] : R[j++];
    while (i < n1) arr[k++] = L[i++];
    while (j < n2) arr[k++] = R[j++];
    free(L); free(R);
}

void merge_sort(int arr[], int l, int r) {
    if (l >= r) return;
    int m = l + (r - l) / 2;
    merge_sort(arr, l, m);
    merge_sort(arr, m + 1, r);
    merge(arr, l, m, r);
}
\`\`\`
<!-- /LANG -->

- 时间：始终 O(n log n) | 空间：O(n) | 稳定：是 | 适用：链表排序、外部排序

### 排序算法对比

| 算法 | 平均时间 | 最坏时间 | 空间 | 稳定 |
|------|---------|---------|------|------|
| 冒泡 | O(n²) | O(n²) | O(1) | ✓ |
| 插入 | O(n²) | O(n²) | O(1) | ✓ |
| 选择 | O(n²) | O(n²) | O(1) | ✗ |
| 快排 | O(n log n) | O(n²) | O(log n) | ✗ |
| 归并 | O(n log n) | O(n log n) | O(n) | ✓ |
| 堆排 | O(n log n) | O(n log n) | O(1) | ✗ |

> **选择建议**：通用场景用快排；需要稳定用归并；内存受限用堆排；数据量小用插入排序。`
      }
    ]
  }
]
