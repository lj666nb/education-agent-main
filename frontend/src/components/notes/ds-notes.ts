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
  content: string  // Markdown
}

export const chapters: NoteChapter[] = [
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

### 核心特性

| 操作 | 时间复杂度 | 说明 |
|------|-----------|------|
| 随机访问 | O(1) | 通过下标直接定位 |
| 末尾插入 | O(1) | 不需要移动元素 |
| 中间插入 | O(n) | 需要将后续元素后移 |
| 删除 | O(n) | 需要将后续元素前移 |
| 查找 | O(n) | 遍历查找 |

### Python 实现

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

### 关键要点

> **扩容策略**：当数组满时，通常扩容为原来的 **2 倍**，均摊时间复杂度为 O(1)

> **插入/删除代价**：在头部插入时最差，需要移动所有元素，所以频繁在头部操作的场景应使用链表`
      },
      {
        id: 'linked-list',
        title: '1.2 链表',
        content: `## 链表

链表通过**指针**将零散的内存块串联起来，每个节点包含**数据域**和**指针域**。

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

### Python 实现

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

### 常见面试题

1. **反转链表**：迭代/递归两种写法
2. **检测环**：快慢指针法，相遇则有环
3. **合并有序链表**：双指针归并
4. **删除倒数第 N 个节点**：快慢指针间隔 N 步
5. **求中间节点**：快指针走两步，慢指针走一步`
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

### Python 实现

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

### Python 实现

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

### 存储方式

\`\`\`python
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

# 示例：构建二叉树
#     1
#    / \\
#   2   3
#  / \\
# 4   5
root = TreeNode(1)
root.left = TreeNode(2)
root.right = TreeNode(3)
root.left.left = TreeNode(4)
root.left.right = TreeNode(5)
\`\`\`

### 三种遍历

| 遍历方式 | 顺序 | 用途 |
|---------|------|------|
| 前序 | 根→左→右 | 序列化、复制树 |
| 中序 | 左→根→右 | BST 得到有序序列 |
| 后序 | 左→右→根 | 删除树、计算高度 |

\`\`\`python
def preorder(root):
    """前序遍历 — 递归"""
    if not root: return []
    return [root.val] + preorder(root.left) + preorder(root.right)

def inorder(root):
    """中序遍历 — 迭代"""
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
    """层序遍历 — BFS"""
    if not root: return []
    from collections import deque
    result, q = [], deque([root])
    while q:
        node = q.popleft()
        result.append(node.val)
        if node.left: q.append(node.left)
        if node.right: q.append(node.right)
    return result
\`\`\``
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

### Python 实现

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
        """删除 — 三种情况"""
        self.root = self._delete(self.root, val)

    def _delete(self, node, val):
        if not node: return None
        if val < node.val:
            node.left = self._delete(node.left, val)
        elif val > node.val:
            node.right = self._delete(node.right, val)
        else:
            # 情况1: 无子节点 → 直接删
            if not node.left and not node.right:
                return None
            # 情况2: 一个子节点 → 子节点替换
            if not node.left: return node.right
            if not node.right: return node.left
            # 情况3: 两个子节点 → 找后继（右子树最小值）替换
            successor = self._min(node.right)
            node.val = successor.val
            node.right = self._delete(node.right, successor.val)
        return node

    def _min(self, node):
        while node.left: node = node.left
        return node
\`\`\`

### 平衡问题

> 普通 BST 在插入有序数据时会**退化成链表**，所有操作变成 O(n)。解决方法是使用**平衡二叉搜索树**（AVL、红黑树），通过旋转操作保持树的高度在 O(log n)。`
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

### Python 实现（小顶堆）

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

### 应用场景

- **Top K 问题**：用小顶堆维护最大的 K 个元素
- **堆排序**：建堆 → 依次弹出
- **Dijkstra 最短路径**：用优先队列每次取最近节点
- **合并 K 个有序链表**：用堆维护 K 个指针

> Python 标准库 \`heapq\` 提供了 \`heappush\`、\`heappop\`、\`heapify\` 等操作，底层也是数组实现的小顶堆。`
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

### 两种存储方式

\`\`\`python
# 1. 邻接矩阵 — O(V²) 空间
# 适合稠密图
graph_matrix = [
    [0, 1, 0, 1],
    [1, 0, 1, 0],
    [0, 1, 0, 1],
    [1, 0, 1, 0],
]

# 2. 邻接表 — O(V+E) 空间, 最常用
graph_adj = {
    0: [(1, 5), (3, 2)],     # (邻居, 权值)
    1: [(0, 5), (2, 3)],
    2: [(1, 3), (3, 8)],
    3: [(0, 2), (2, 8)],
}
\`\`\`

### 选择建议

> **邻接表**是绝大多数场景的首选：空间效率高、遍历快。**邻接矩阵**只在需要频繁判断两点是否相邻（O(1)）的稠密图中使用。`
      },
      {
        id: 'graph-traversal',
        title: '4.2 图的遍历（BFS & DFS）',
        content: `## 图的遍历

### BFS（广度优先搜索）

使用**队列**，逐层遍历。适合求**最短路径**（无权图）。

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
\`\`\`

### DFS（深度优先搜索）

使用**栈**（或递归），沿一条路径走到底再回溯。

\`\`\`python
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

# 迭代版（显式栈）
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

### 复杂度

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

### Python 实现

\`\`\`python
import heapq

def dijkstra(graph, start):
    """返回 start 到所有节点的最短距离"""
    dist = {node: float('inf') for node in graph}
    dist[start] = 0
    pq = [(0, start)]  # (距离, 节点)

    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:  # 跳过过期记录
            continue
        for v, w in graph[u]:
            new_dist = dist[u] + w
            if new_dist < dist[v]:
                dist[v] = new_dist
                heapq.heappush(pq, (new_dist, v))
    return dist

# 使用示例
graph = {
    0: [(1, 4), (2, 1)],
    1: [(3, 1)],
    2: [(1, 2), (3, 5)],
    3: []
}
print(dijkstra(graph, 0))  # {0:0, 1:3, 2:1, 3:4}
\`\`\`

### 复杂度

- **时间**：O((V+E) log V)，使用二叉堆优化
- **空间**：O(V)，存储距离表

### 扩展

| 算法 | 适用场景 |
|------|---------|
| Bellman-Ford | 可处理负权边 |
| Floyd-Warshall | 多源最短路径 |
| A* | 带启发式的寻路 |`
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

### Python 实现

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

### 常见变种

| 变种 | 功能 |
|------|------|
| lower_bound | 第一个 ≥ target |
| upper_bound | 第一个 > target |
| 旋转数组查找 | 分段有序 |
| 二分答案 | 在值域上二分 |

### 常见错误

1. \`mid = (left + right) // 2\` 可能**整数溢出**（Python 无此问题）
2. 循环条件写成 \`left < right\` 漏掉最后一个元素
3. 边界更新写成 \`left = mid\` 导致死循环`
      },
      {
        id: 'hash-table',
        title: '5.2 哈希表',
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

### 简单实现（链地址法）

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
        bucket = self.buckets[idx]
        for i, (k, v) in enumerate(bucket):
            if k == key:
                bucket[i] = (key, value)
                return
        bucket.append((key, value))
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
        bucket = self.buckets[idx]
        for i, (k, v) in enumerate(bucket):
            if k == key:
                del bucket[i]
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

- 时间：最好 O(n)，平均 O(n²)
- 空间：O(1)
- 稳定：是

### 插入排序

将每个元素插入到已排序部分的正确位置。

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

- 时间：最好 O(n)，平均 O(n²)
- 空间：O(1)
- 稳定：是
- 适用：小规模数据或基本有序数据

### 选择排序

每一轮选择最小元素放到已排序部分的末尾。

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

- 时间：始终 O(n²)
- 空间：O(1)
- 稳定：否
- 特点：交换次数最少（每轮最多 1 次）`
      },
      {
        id: 'advanced-sorts',
        title: '6.2 高级排序算法',
        content: `## 高级排序算法

### 快速排序

分治法：选 pivot，将数组分为小于和大于 pivot 的两部分，递归排序。

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

- 时间：平均 O(n log n)，最坏 O(n²)
- 空间：O(log n)（递归栈）
- 稳定：否

### 归并排序

分治法：将数组二分，分别排序后合并。

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

- 时间：始终 O(n log n)
- 空间：O(n)
- 稳定：是
- 适用：链表排序、外部排序

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
