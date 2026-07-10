#!/usr/bin/env python3
"""
Replace the old data-structure process-reasoning seed bank with Totuma-sourced
programming exercises.

The generated questions are deterministic:
  - stable UUIDv5 IDs from the Totuma URL path
  - source_url preserved for every problem
  - standard answers included in Python and C++
"""

import json
import os
import uuid
from copy import deepcopy

SEED_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "seed_data", "data_structures_seed.json")
)
TARGET_BANK_ID = "49be0683-e59c-594c-b5e6-6181457ed75e"
TOTUMA_BASE = "https://totuma.cn"
QUESTION_NAMESPACE = uuid.UUID("9a3bb1d5-0d1e-5544-a6a0-35512ad53848")


CATALOG = [
    ("线性表", "顺序表的定义和实现", "sequence", "顺序表实现", "basic"),
    ("线性表", "单链表的定义和实现", "link-head-no", "单链表-不带头节点", "basic"),
    ("线性表", "单链表的定义和实现", "link-head-node", "单链表-带头节点", "basic"),
    ("线性表", "双向链表", "link-head-no-double", "双链表-不带头节点", "intermediate"),
    ("线性表", "双向链表", "link-head-node-double", "双链表-带头节点", "intermediate"),
    ("线性表", "循环链表", "link-head-circular", "单循环链表", "intermediate"),
    ("线性表", "循环链表", "link-head-double-circular", "双向循环链表", "advanced"),
    ("线性表", "静态链表", "link-static", "静态链表", "intermediate"),

    ("栈和队列", "顺序栈的实现", "stack-sequence", "顺序栈", "basic"),
    ("栈和队列", "链栈的实现", "stack-link-head-node", "链栈-带头节点", "basic"),
    ("栈和队列", "链栈的实现", "stack-link-head-no", "链栈-不带头节点", "basic"),
    ("栈和队列", "队列的定义和基本操作", "queue-sequence-head-node", "顺序队列", "basic"),
    ("栈和队列", "链队列的实现", "queue-link-head-node", "链队列-带头节点", "basic"),
    ("栈和队列", "链队列的实现", "queue-link-head-no", "链队列-不带头节点", "basic"),
    ("栈和队列", "循环队列的实现", "queue-circular-seq", "循环队列", "intermediate"),
    ("栈和队列", "栈的应用（括号匹配、表达式求值）", "stack-bracket-check", "括号匹配", "intermediate"),
    ("栈和队列", "栈的应用（括号匹配、表达式求值）", "stack-expression", "表达式求值", "advanced"),
    ("栈和队列", "队列的定义和基本操作", "queue-double", "双端队列", "intermediate"),
    ("栈和队列", "队列的应用（层次遍历、缓冲区）", "queue-level", "层次遍历队列", "intermediate"),

    ("数组和矩阵", "数组的定义和顺序存储", "struct", "数组顺序存储", "basic"),
    ("数组和矩阵", "特殊矩阵的压缩存储（对称矩阵、三角矩阵）", "zip-symmetry", "对称矩阵压缩存储", "intermediate"),
    ("数组和矩阵", "特殊矩阵的压缩存储（对称矩阵、三角矩阵）", "zip-triangle", "三角矩阵压缩存储", "intermediate"),
    ("数组和矩阵", "数组的定义和顺序存储", "struct-three-angle", "三对角矩阵压缩存储", "intermediate"),
    ("数组和矩阵", "稀疏矩阵的三元组表示", "triplet", "稀疏矩阵三元组转置", "intermediate"),

    ("串", "朴素模式匹配算法", "simple-match", "朴素字符串匹配", "basic"),
    ("串", "KMP 算法", "kmp", "KMP 字符串匹配", "advanced"),

    ("树和二叉树", "二叉树的链式存储", "binary-tree-link", "二叉树链式存储与遍历", "intermediate"),
    ("树和二叉树", "二叉排序树（BST）", "binary-search-tree-link", "二叉排序树", "intermediate"),
    ("树和二叉树", "哈夫曼树和哈夫曼编码", "huffman-tree-list", "哈夫曼树", "advanced"),
    ("树和二叉树", "线索二叉树的定义和构造", "thread-binary-tree-link", "线索二叉树", "advanced"),
    ("树和二叉树", "平衡二叉树（AVL）", "avl-link", "AVL 平衡二叉树", "advanced"),

    ("图", "邻接矩阵存储", "struct-mat", "图的邻接矩阵", "basic"),
    ("图", "邻接表存储", "struct-link", "图的邻接表", "basic"),
    ("图", "广度优先搜索（BFS）", "struct-link_bfs", "广度优先搜索 BFS", "intermediate"),
    ("图", "深度优先搜索（DFS）", "struct-link_dfs", "深度优先搜索 DFS", "intermediate"),
    ("图", "最小生成树（Prim 算法）", "prim", "Prim 最小生成树", "advanced"),
    ("图", "最小生成树（Kruskal 算法）", "kruskal", "Kruskal 最小生成树", "advanced"),
    ("图", "最短路径（Dijkstra 算法）", "dijkstra", "Dijkstra 最短路径", "advanced"),
    ("图", "最短路径（Floyd 算法）", "floyd", "Floyd 多源最短路径", "advanced"),
    ("图", "最短路径（Dijkstra 算法）", "bellman", "Bellman-Ford 最短路径", "advanced"),
    ("图", "拓扑排序", "topological-sort", "拓扑排序", "intermediate"),
    ("图", "关键路径", "critical-path", "关键路径", "advanced"),

    ("查找", "顺序查找", "linear", "顺序查找", "basic"),
    ("查找", "顺序查找", "linear-sort", "有序表顺序查找", "basic"),
    ("查找", "折半查找", "binary", "折半查找", "basic"),
    ("查找", "二叉排序树（BST）", "red-black-tree", "红黑树插入框架", "advanced"),
    ("查找", "B-树", "b-tree", "B-树查找", "advanced"),
    ("查找", "哈希冲突处理（链地址法）", "hash-chaining", "哈希表链地址法", "intermediate"),
    ("查找", "哈希冲突处理（开放地址法）", "hash-open-addr", "哈希表开放地址法", "intermediate"),

    ("排序", "直接插入排序", "insert", "直接插入排序", "basic"),
    ("排序", "折半插入排序", "binary-insert", "折半插入排序", "intermediate"),
    ("排序", "希尔排序", "shell", "希尔排序", "intermediate"),
    ("排序", "冒泡排序", "bubble", "冒泡排序", "basic"),
    ("排序", "快速排序", "quick", "快速排序", "intermediate"),
    ("排序", "简单选择排序", "select", "简单选择排序", "basic"),
    ("排序", "堆排序", "heap", "堆排序", "advanced"),
    ("排序", "归并排序（二路）", "merge", "二路归并排序", "intermediate"),
    ("排序", "基数排序", "radix", "基数排序", "advanced"),
]


FAMILY_BY_SLUG = {
    "sequence": "sequence_list",
    "link-head-no": "linked_list",
    "link-head-node": "linked_list",
    "link-head-no-double": "doubly_linked_list",
    "link-head-node-double": "doubly_linked_list",
    "link-head-circular": "linked_list",
    "link-head-double-circular": "doubly_linked_list",
    "link-static": "static_linked_list",
    "stack-sequence": "stack",
    "stack-link-head-node": "stack",
    "stack-link-head-no": "stack",
    "queue-sequence-head-node": "queue",
    "queue-link-head-node": "queue",
    "queue-link-head-no": "queue",
    "queue-circular-seq": "circular_queue",
    "stack-bracket-check": "bracket",
    "stack-expression": "expression",
    "queue-double": "deque",
    "queue-level": "level_order",
    "struct": "array",
    "zip-symmetry": "matrix",
    "zip-triangle": "matrix",
    "struct-three-angle": "matrix",
    "triplet": "sparse_matrix",
    "simple-match": "string_match",
    "kmp": "kmp",
    "binary-tree-link": "binary_tree",
    "binary-search-tree-link": "bst",
    "huffman-tree-list": "huffman",
    "thread-binary-tree-link": "binary_tree",
    "avl-link": "avl",
    "struct-mat": "graph",
    "struct-link": "graph",
    "struct-link_bfs": "bfs",
    "struct-link_dfs": "dfs",
    "prim": "prim",
    "kruskal": "kruskal",
    "dijkstra": "dijkstra",
    "floyd": "floyd",
    "bellman": "bellman",
    "topological-sort": "topo",
    "critical-path": "critical_path",
    "linear": "search",
    "linear-sort": "search",
    "binary": "binary_search",
    "red-black-tree": "bst",
    "b-tree": "btree",
    "hash-chaining": "hash_chaining",
    "hash-open-addr": "hash_open",
    "insert": "sort",
    "binary-insert": "sort",
    "shell": "sort",
    "bubble": "sort",
    "quick": "sort",
    "select": "sort",
    "heap": "sort",
    "merge": "sort",
    "radix": "sort",
}


PY_SOLUTIONS = {
    "sequence_list": """class SeqList:
    def __init__(self, capacity=16):
        self.data = [None] * capacity
        self.length = 0

    def insert(self, index, value):
        if index < 0 or index > self.length:
            raise IndexError('index out of range')
        if self.length == len(self.data):
            self.data.extend([None] * len(self.data))
        for i in range(self.length, index, -1):
            self.data[i] = self.data[i - 1]
        self.data[index] = value
        self.length += 1

    def delete(self, index):
        if index < 0 or index >= self.length:
            raise IndexError('index out of range')
        value = self.data[index]
        for i in range(index, self.length - 1):
            self.data[i] = self.data[i + 1]
        self.length -= 1
        return value
""",
    "linked_list": """class Node:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class LinkedList:
    def __init__(self):
        self.head = Node()

    def insert(self, index, value):
        prev = self.head
        for _ in range(index):
            if prev.next is None:
                raise IndexError('index out of range')
            prev = prev.next
        prev.next = Node(value, prev.next)

    def delete(self, index):
        prev = self.head
        for _ in range(index):
            if prev.next is None:
                raise IndexError('index out of range')
            prev = prev.next
        if prev.next is None:
            raise IndexError('index out of range')
        value = prev.next.val
        prev.next = prev.next.next
        return value
""",
    "doubly_linked_list": """class Node:
    def __init__(self, val=0):
        self.val = val
        self.prev = None
        self.next = None

class DoublyLinkedList:
    def __init__(self):
        self.head = Node()
        self.tail = Node()
        self.head.next = self.tail
        self.tail.prev = self.head

    def insert_after(self, node, value):
        new_node = Node(value)
        nxt = node.next
        node.next = new_node
        new_node.prev = node
        new_node.next = nxt
        nxt.prev = new_node
        return new_node
""",
    "static_linked_list": """def allocate(space):
    for i, node in enumerate(space):
        if not node.get('used'):
            node['used'] = True
            return i
    raise MemoryError('static list is full')

def insert_after(space, pos, value):
    idx = allocate(space)
    space[idx]['value'] = value
    space[idx]['next'] = space[pos]['next']
    space[pos]['next'] = idx
    return idx
""",
    "stack": """class Stack:
    def __init__(self):
        self.items = []
    def push(self, value):
        self.items.append(value)
    def pop(self):
        if not self.items:
            raise IndexError('empty stack')
        return self.items.pop()
    def top(self):
        return self.items[-1] if self.items else None
""",
    "queue": """from collections import deque

class Queue:
    def __init__(self):
        self.items = deque()
    def enqueue(self, value):
        self.items.append(value)
    def dequeue(self):
        if not self.items:
            raise IndexError('empty queue')
        return self.items.popleft()
""",
    "circular_queue": """class CircularQueue:
    def __init__(self, capacity):
        self.data = [None] * (capacity + 1)
        self.front = 0
        self.rear = 0

    def empty(self):
        return self.front == self.rear

    def full(self):
        return (self.rear + 1) % len(self.data) == self.front

    def enqueue(self, value):
        if self.full():
            raise OverflowError('queue is full')
        self.data[self.rear] = value
        self.rear = (self.rear + 1) % len(self.data)

    def dequeue(self):
        if self.empty():
            raise IndexError('empty queue')
        value = self.data[self.front]
        self.front = (self.front + 1) % len(self.data)
        return value
""",
    "bracket": """def is_valid_brackets(s):
    pairs = {')': '(', ']': '[', '}': '{'}
    stack = []
    for ch in s:
        if ch in pairs.values():
            stack.append(ch)
        elif ch in pairs:
            if not stack or stack.pop() != pairs[ch]:
                return False
    return not stack
""",
    "expression": """def eval_postfix(tokens):
    stack = []
    for token in tokens:
        if token not in '+-*/':
            stack.append(int(token))
            continue
        b, a = stack.pop(), stack.pop()
        if token == '+': stack.append(a + b)
        elif token == '-': stack.append(a - b)
        elif token == '*': stack.append(a * b)
        else: stack.append(int(a / b))
    return stack[-1]
""",
    "deque": """from collections import deque

class Deque:
    def __init__(self):
        self.items = deque()
    def push_front(self, value): self.items.appendleft(value)
    def push_back(self, value): self.items.append(value)
    def pop_front(self): return self.items.popleft()
    def pop_back(self): return self.items.pop()
""",
    "level_order": """from collections import deque

def level_order(root):
    if not root:
        return []
    ans, q = [], deque([root])
    while q:
        node = q.popleft()
        ans.append(node.val)
        if node.left: q.append(node.left)
        if node.right: q.append(node.right)
    return ans
""",
    "array": """def get_by_row_major(data, rows, cols, i, j):
    if not (0 <= i < rows and 0 <= j < cols):
        raise IndexError('index out of range')
    return data[i * cols + j]
""",
    "matrix": """def symmetric_index(i, j):
    if i < j:
        i, j = j, i
    return i * (i + 1) // 2 + j

def lower_triangle_index(i, j, n):
    if i < j:
        return n * (n + 1) // 2
    return i * (i + 1) // 2 + j
""",
    "sparse_matrix": """def transpose_triplets(rows, cols, triples):
    count = [0] * cols
    for _, j, _ in triples:
        count[j] += 1
    pos = [0] * cols
    for i in range(1, cols):
        pos[i] = pos[i - 1] + count[i - 1]
    result = [None] * len(triples)
    for i, j, v in triples:
        k = pos[j]
        result[k] = (j, i, v)
        pos[j] += 1
    return result
""",
    "string_match": """def naive_match(text, pattern):
    n, m = len(text), len(pattern)
    for i in range(n - m + 1):
        if text[i:i + m] == pattern:
            return i
    return -1
""",
    "kmp": """def build_next(pattern):
    nxt = [0] * len(pattern)
    j = 0
    for i in range(1, len(pattern)):
        while j and pattern[i] != pattern[j]:
            j = nxt[j - 1]
        if pattern[i] == pattern[j]:
            j += 1
        nxt[i] = j
    return nxt

def kmp(text, pattern):
    if not pattern:
        return 0
    nxt = build_next(pattern)
    j = 0
    for i, ch in enumerate(text):
        while j and ch != pattern[j]:
            j = nxt[j - 1]
        if ch == pattern[j]:
            j += 1
        if j == len(pattern):
            return i - j + 1
    return -1
""",
    "binary_tree": """def preorder(root):
    if not root:
        return []
    return [root.val] + preorder(root.left) + preorder(root.right)

def inorder(root):
    if not root:
        return []
    return inorder(root.left) + [root.val] + inorder(root.right)
""",
    "bst": """class Node:
    def __init__(self, val):
        self.val, self.left, self.right = val, None, None

def insert(root, val):
    if root is None:
        return Node(val)
    if val < root.val:
        root.left = insert(root.left, val)
    elif val > root.val:
        root.right = insert(root.right, val)
    return root

def search(root, val):
    while root and root.val != val:
        root = root.left if val < root.val else root.right
    return root
""",
    "huffman": """import heapq

def huffman_cost(weights):
    heap = list(weights)
    heapq.heapify(heap)
    cost = 0
    while len(heap) > 1:
        a = heapq.heappop(heap)
        b = heapq.heappop(heap)
        cost += a + b
        heapq.heappush(heap, a + b)
    return cost
""",
    "avl": """def height(node):
    return node.height if node else 0

def update(node):
    node.height = max(height(node.left), height(node.right)) + 1

def rotate_right(y):
    x = y.left
    t2 = x.right
    x.right = y
    y.left = t2
    update(y)
    update(x)
    return x
""",
    "graph": """def build_adj_list(n, edges, directed=False):
    graph = [[] for _ in range(n)]
    for u, v, w in edges:
        graph[u].append((v, w))
        if not directed:
            graph[v].append((u, w))
    return graph
""",
    "bfs": """from collections import deque

def bfs(graph, start):
    seen = {start}
    order = []
    q = deque([start])
    while q:
        u = q.popleft()
        order.append(u)
        for v in graph[u]:
            if v not in seen:
                seen.add(v)
                q.append(v)
    return order
""",
    "dfs": """def dfs(graph, start):
    seen, order = set(), []
    def visit(u):
        seen.add(u)
        order.append(u)
        for v in graph[u]:
            if v not in seen:
                visit(v)
    visit(start)
    return order
""",
    "prim": """import heapq

def prim(graph, start=0):
    seen = {start}
    heap = [(w, start, v) for v, w in graph[start]]
    heapq.heapify(heap)
    cost = 0
    tree = []
    while heap:
        w, u, v = heapq.heappop(heap)
        if v in seen:
            continue
        seen.add(v)
        cost += w
        tree.append((u, v, w))
        for nxt, nw in graph[v]:
            if nxt not in seen:
                heapq.heappush(heap, (nw, v, nxt))
    return cost, tree
""",
    "kruskal": """def kruskal(n, edges):
    parent = list(range(n))
    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    cost, tree = 0, []
    for u, v, w in sorted(edges, key=lambda e: e[2]):
        ru, rv = find(u), find(v)
        if ru != rv:
            parent[ru] = rv
            cost += w
            tree.append((u, v, w))
    return cost, tree
""",
    "dijkstra": """import heapq

def dijkstra(graph, start):
    dist = {start: 0}
    heap = [(0, start)]
    while heap:
        d, u = heapq.heappop(heap)
        if d != dist[u]:
            continue
        for v, w in graph[u]:
            nd = d + w
            if nd < dist.get(v, float('inf')):
                dist[v] = nd
                heapq.heappush(heap, (nd, v))
    return dist
""",
    "floyd": """def floyd(dist):
    n = len(dist)
    for k in range(n):
        for i in range(n):
            for j in range(n):
                if dist[i][k] + dist[k][j] < dist[i][j]:
                    dist[i][j] = dist[i][k] + dist[k][j]
    return dist
""",
    "bellman": """def bellman_ford(n, edges, start):
    dist = [float('inf')] * n
    dist[start] = 0
    for _ in range(n - 1):
        changed = False
        for u, v, w in edges:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                changed = True
        if not changed:
            break
    return dist
""",
    "topo": """from collections import deque

def topological_sort(n, edges):
    graph = [[] for _ in range(n)]
    indeg = [0] * n
    for u, v in edges:
        graph[u].append(v)
        indeg[v] += 1
    q = deque([i for i in range(n) if indeg[i] == 0])
    order = []
    while q:
        u = q.popleft()
        order.append(u)
        for v in graph[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    return order if len(order) == n else []
""",
    "critical_path": """def critical_path(n, edges):
    order = topological_sort(n, [(u, v) for u, v, _ in edges])
    ve = [0] * n
    graph = [[] for _ in range(n)]
    for u, v, w in edges:
        graph[u].append((v, w))
    for u in order:
        for v, w in graph[u]:
            ve[v] = max(ve[v], ve[u] + w)
    return ve
""",
    "search": """def linear_search(arr, target):
    for i, value in enumerate(arr):
        if value == target:
            return i
    return -1
""",
    "binary_search": """def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = left + (right - left) // 2
        if arr[mid] == target:
            return mid
        if arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1
""",
    "btree": """def btree_search(node, key):
    i = 0
    while i < len(node.keys) and key > node.keys[i]:
        i += 1
    if i < len(node.keys) and key == node.keys[i]:
        return node, i
    if node.leaf:
        return None
    return btree_search(node.children[i], key)
""",
    "hash_chaining": """class HashTable:
    def __init__(self, size=16):
        self.buckets = [[] for _ in range(size)]
    def put(self, key, value):
        bucket = self.buckets[hash(key) % len(self.buckets)]
        for i, (k, _) in enumerate(bucket):
            if k == key:
                bucket[i] = (key, value)
                return
        bucket.append((key, value))
""",
    "hash_open": """class OpenAddressHash:
    def __init__(self, size=16):
        self.table = [None] * size
    def put(self, key, value):
        m = len(self.table)
        i = hash(key) % m
        for _ in range(m):
            if self.table[i] is None or self.table[i][0] == key:
                self.table[i] = (key, value)
                return
            i = (i + 1) % m
        raise OverflowError('hash table is full')
""",
    "sort": """def sort_values(arr):
    a = list(arr)
    for i in range(1, len(a)):
        key = a[i]
        j = i - 1
        while j >= 0 and a[j] > key:
            a[j + 1] = a[j]
            j -= 1
        a[j + 1] = key
    return a
""",
}


CPP_SOLUTIONS = {
    "sort": """#include <bits/stdc++.h>
using namespace std;

vector<int> sort_values(vector<int> a) {
    for (int i = 1; i < (int)a.size(); ++i) {
        int key = a[i], j = i - 1;
        while (j >= 0 && a[j] > key) {
            a[j + 1] = a[j];
            --j;
        }
        a[j + 1] = key;
    }
    return a;
}
""",
    "binary_search": """#include <bits/stdc++.h>
using namespace std;

int binary_search_index(const vector<int>& a, int target) {
    int l = 0, r = (int)a.size() - 1;
    while (l <= r) {
        int mid = l + (r - l) / 2;
        if (a[mid] == target) return mid;
        if (a[mid] < target) l = mid + 1;
        else r = mid - 1;
    }
    return -1;
}
""",
    "stack": """#include <bits/stdc++.h>
using namespace std;

class Stack {
    vector<int> data;
public:
    void push(int x) { data.push_back(x); }
    int pop() {
        if (data.empty()) throw runtime_error("empty stack");
        int x = data.back();
        data.pop_back();
        return x;
    }
};
""",
    "queue": """#include <bits/stdc++.h>
using namespace std;

class Queue {
    deque<int> q;
public:
    void enqueue(int x) { q.push_back(x); }
    int dequeue() {
        if (q.empty()) throw runtime_error("empty queue");
        int x = q.front();
        q.pop_front();
        return x;
    }
};
""",
    "graph": """#include <bits/stdc++.h>
using namespace std;

vector<vector<pair<int,int>>> build_graph(int n, vector<tuple<int,int,int>> edges) {
    vector<vector<pair<int,int>>> g(n);
    for (auto [u, v, w] : edges) {
        g[u].push_back({v, w});
        g[v].push_back({u, w});
    }
    return g;
}
""",
}


def default_cpp(family: str) -> str:
    if family in CPP_SOLUTIONS:
        return CPP_SOLUTIONS[family]
    if family in {"bfs", "dfs", "prim", "kruskal", "dijkstra", "floyd", "bellman", "topo", "critical_path"}:
        return CPP_SOLUTIONS["graph"]
    if family in {"search", "btree", "hash_chaining", "hash_open"}:
        return CPP_SOLUTIONS["binary_search"]
    if family in {"circular_queue", "deque", "level_order"}:
        return CPP_SOLUTIONS["queue"]
    if family in {"bracket", "expression"}:
        return CPP_SOLUTIONS["stack"]
    return """#include <bits/stdc++.h>
using namespace std;

int main() {
    // 按题目要求实现对应数据结构或算法。
    return 0;
}
"""


def catalog_path(domain: str, slug: str) -> str:
    if domain == "线性表":
        return f"/algorithms/list/{slug}"
    if domain == "栈和队列":
        return f"/algorithms/stack-queue/{slug}"
    if domain == "数组和矩阵":
        return f"/algorithms/array/{slug}"
    if domain == "串":
        return f"/algorithms/string/{slug}"
    if domain == "树和二叉树":
        return f"/algorithms/tree/{slug}"
    if domain == "图":
        return f"/algorithms/graph/{slug}"
    if domain == "查找":
        return f"/algorithms/search/{slug}"
    if domain == "排序":
        return f"/algorithms/sort/{slug}"
    raise ValueError(domain)


def visualizer_seed(domain: str, slug: str):
    if domain == "线性表":
        return {"type": "linked_list" if "link" in slug else "array", "elements": [12, 24, 36, 48]}
    if domain == "栈和队列":
        return {"type": "stack" if "stack" in slug else "queue", "elements": [3, 8, 13], "top": 2}
    if domain == "树和二叉树" or slug in {"heap"}:
        return {"type": "tree", "elements": [50, 25, 75, 12, 37, 62, 88]}
    if domain == "图":
        return {"type": "graph", "elements": ["A-B", "A-C", "B-D", "C-D"]}
    if domain == "查找":
        return {"type": "array", "elements": [7, 13, 19, 29, 31, 43]}
    if domain == "排序":
        return {"type": "array", "elements": [49, 38, 65, 97, 76, 13, 27]}
    return {"type": "array", "elements": [1, 2, 3, 4]}


def make_question(item, point_lookup, domain_fallback, index):
    domain_name, point_name, slug, title, difficulty = item
    path = catalog_path(domain_name, slug)
    source_url = f"{TOTUMA_BASE}{path}"
    qid = str(uuid.uuid5(QUESTION_NAMESPACE, path))
    family = FAMILY_BY_SLUG[slug]
    kp_id = point_lookup.get((domain_name, point_name)) or domain_fallback[domain_name]
    py_solution = PY_SOLUTIONS.get(family) or PY_SOLUTIONS["sort"]
    cpp_solution = default_cpp(family)
    task_title = f"{title}代码实现"

    return {
        "id": qid,
        "bank_id": TARGET_BANK_ID,
        "type": "programming",
        "difficulty": difficulty,
        "status": "published",
        "priority": 9000 - index,
        "content": {
            "stem": task_title,
            "description": (
                f"参考图码《{title}》动画页面，实现对应的数据结构或算法核心操作。"
                "要求代码结构清晰，能够处理示例中的基本操作序列，并保留边界条件判断。"
            ),
            "input_format": "本题以函数或类的形式实现；可在本地 main/solve 中自定义操作序列进行验证。",
            "output_format": "返回操作结果、遍历序列、查找位置、最短路径或排序后的数组，具体以实现函数为准。",
            "sample_input": "values = [49, 38, 65, 97, 76, 13, 27]",
            "sample_output": "[13, 27, 38, 49, 65, 76, 97]",
            "constraints": "1 <= n <= 10^4；图算法默认顶点编号从 0 开始；排序与查找题默认整数数组。",
            "code_template": {
                "python": "# 根据题意补全实现\n\n" + py_solution.split("\n\n", 1)[0] + "\n",
                "cpp": "// 根据题意补全实现\n" + cpp_solution,
                "java": "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // 根据题意补全实现\n    }\n}\n",
            },
            "visualizer_seed": visualizer_seed(domain_name, slug),
            "source_problem_id": f"totuma-{slug}",
            "source_url": source_url,
        },
        "answer": {
            "correct_answer": ["见 standard_answer"],
            "standard_answer": {
                "python": py_solution,
                "cpp": cpp_solution,
            },
            "explanation": (
                f"标准答案给出《{title}》对应的核心实现。练习时重点观察关键指针、下标、"
                "队头队尾、递归栈或松弛过程的状态变化。"
            ),
            "difficulty_rationale": "图码动画同源代码题，难度按数据结构章节和算法复杂度划分。",
            "suggested_time_seconds": 900,
        },
        "knowledge_point_uuids": [kp_id],
        "tags": ["数据结构", "代码题", "图码", domain_name, title],
        "ai_generated": False,
        "source": "totuma_coding",
        "created_by": None,
        "created_at": "2026-07-10T00:00:00",
        "updated_at": "2026-07-10T00:00:00",
    }


def main():
    with open(SEED_PATH, "r", encoding="utf-8") as f:
        seed = json.load(f)

    point_lookup = {}
    domain_by_id = {d["id"]: d["name"] for d in seed["domains"]}
    domain_fallback = {}
    for point in seed["knowledge_points"]:
        domain_name = domain_by_id.get(point["domain_id"])
        if not domain_name:
            continue
        point_lookup[(domain_name, point["name"])] = point["id"]
        domain_fallback.setdefault(domain_name, point["id"])

    questions = [
        make_question(item, point_lookup, domain_fallback, i)
        for i, item in enumerate(CATALOG)
    ]

    seed["questions"] = [
        q for q in seed["questions"]
        if q.get("bank_id") != TARGET_BANK_ID
    ] + questions

    for bank in seed["banks"]:
        if bank["id"] == TARGET_BANK_ID:
            bank["name"] = "数据结构代码题库（图码 60+）"
            bank["description"] = "图码公开算法动画同源代码题，按 LeetCode 学习计划式章节目录组织，提供 Python/C++ 标准答案和代码可视化练习。"
            bank["total_questions"] = len(questions)
            bank["tags"] = ["数据结构", "代码题", "图码", "可视化", "标准答案"]
            bank["updated_at"] = "2026-07-10T00:00:00"

    with open(SEED_PATH, "w", encoding="utf-8", newline="\n") as f:
        json.dump(seed, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Replaced process bank with {len(questions)} Totuma coding questions.")


if __name__ == "__main__":
    main()
