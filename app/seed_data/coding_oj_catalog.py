"""Curated programming catalog derived from public problem metadata.

Problem statements, examples, hints and tests are independently written for
this educational project. Source ids and links are retained for attribution and
further practice; no hidden tests or third-party solutions are copied.
"""

from __future__ import annotations

import inspect
import textwrap
import uuid


CODE_BANK_ID = "49be0683-e59c-594c-b5e6-6181457ed75e"
CATALOG_NAMESPACE = uuid.UUID("dc3a40aa-50b4-4b54-950b-01f426a8f4f2")
DIFFICULTY_PRIORITY = {"basic": 300, "intermediate": 200, "advanced": 100}


def _clean(value: str) -> str:
    return textwrap.dedent(value).strip() + "\n"


def _test(name: str, input_data: str, expected_output: str, public: bool = False) -> dict:
    return {
        "name": name,
        "input": inspect.cleandoc(input_data).strip() + "\n",
        "expected_output": inspect.cleandoc(expected_output).strip() + "\n",
        "is_public": public,
        "comparator": "trim_lines",
    }


def _problem(
    *, point: str, title: str, difficulty: str, source_id: str, source_url: str,
    source_platform: str, description: str, objectives: list[str], task_steps: list[str],
    input_format: str, output_format: str, constraints: list[str], starter: str,
    solution: str, hints: list[str], complexity: str, visual_type: str,
    tests: list[dict],
) -> dict:
    public_tests = [item for item in tests if item["is_public"]]
    examples = [
        {
            "input": item["input"].strip(),
            "output": item["expected_output"].strip(),
            "explanation": f"公开测试：{item['name']}。",
        }
        for item in public_tests
    ]
    return {
        "id": str(uuid.uuid5(CATALOG_NAMESPACE, source_id)),
        "bank_id": CODE_BANK_ID,
        "primary_knowledge_point_name": point,
        "type": "programming",
        "difficulty": difficulty,
        "status": "published",
        "priority": DIFFICULTY_PRIORITY[difficulty],
        "content": {
            "stem": title,
            "description": description,
            "learning_objectives": objectives,
            "task_steps": task_steps,
            "input_format": input_format,
            "output_format": output_format,
            "examples": examples,
            "sample_input": examples[0]["input"] if examples else "",
            "sample_output": examples[0]["output"] if examples else "",
            "constraints": constraints,
            "edge_cases": ["最小规模输入", "重复元素或重复边", "空结构或不可达情况（若题意允许）"],
            "interface": {"mode": "stdin", "language": "python", "entry": "solve"},
            "supported_languages": ["python"],
            "code_template": {"python": _clean(starter)},
            "hints": [
                {"level": index + 1, "title": title_text, "content": content}
                for index, (title_text, content) in enumerate(zip(
                    ["读题拆解", "核心思路", "伪代码与边界"], hints,
                ))
            ],
            "source_problem_id": source_id,
            "source_url": source_url,
            "source_platform": source_platform,
            "visual_type": visual_type,
            "judge_mode": "stdin_stdout",
        },
        "answer": {
            "standard_answer": {"python": _clean(solution)},
            "explanation": f"参考实现围绕“{objectives[0]}”展开。先保证所有公开测试通过，再检查隐藏边界测试。",
            "complexity": complexity,
            "suggested_time_seconds": {"basic": 900, "intermediate": 1800, "advanced": 2700}[difficulty],
        },
        "test_cases": tests,
        "knowledge_point_names": [point],
        "tags": ["数据结构", "代码题", source_platform, point, {"basic": "简单", "intermediate": "中等", "advanced": "困难"}[difficulty]],
        "ai_generated": False,
        "source": "oj_curated",
        "created_by": None,
        "created_at": "2026-07-10T00:00:00",
        "updated_at": "2026-07-10T00:00:00",
    }


CATALOG: list[dict] = [
    # ── 数组与矩阵 ─────────────────────────────────────────────
    _problem(
        point="数组顺序存储", title="矩阵转置", difficulty="basic",
        source_id="nowcoder-noob50", source_platform="牛客",
        source_url="https://www.nowcoder.com/practice/351b3d03e410496ab5a407b7ca3fd841",
        description="给定一个 n 行 m 列的整数矩阵，请交换它的行列，输出 m 行 n 列的转置矩阵。",
        objectives=["理解二维数组的行列索引变换", "正确处理单行、单列矩阵"],
        task_steps=["读取 n、m 和矩阵", "令结果[j][i] = matrix[i][j]", "逐行输出结果"],
        input_format="第一行是 n 和 m；接下来 n 行，每行 m 个整数。",
        output_format="输出 m 行，每行 n 个整数，空格分隔。",
        constraints=["1 ≤ n,m ≤ 100", "矩阵元素绝对值不超过 10^9"], visual_type="array",
        starter='''
        import sys

        def transpose(matrix):
            # TODO：返回转置后的新矩阵
            pass

        def solve(data):
            values = list(map(int, data.split()))
            n, m = values[0], values[1]
            matrix = [values[2 + i*m:2 + (i+1)*m] for i in range(n)]
            result = transpose(matrix)
            return "\\n".join(" ".join(map(str, row)) for row in result)

        if __name__ == "__main__":
            print(solve(sys.stdin.read()))
        ''',
        solution='''
        import sys

        def transpose(matrix):
            return [list(row) for row in zip(*matrix)]

        def solve(data):
            values = list(map(int, data.split()))
            n, m = values[0], values[1]
            matrix = [values[2 + i*m:2 + (i+1)*m] for i in range(n)]
            return "\\n".join(" ".join(map(str, row)) for row in transpose(matrix))

        if __name__ == "__main__":
            print(solve(sys.stdin.read()))
        ''',
        hints=["输出的第 j 行来自原矩阵的第 j 列。", "用两层循环交换 i、j，或使用 zip。", "创建 m×n 结果；遍历 i∈[0,n)、j∈[0,m)，写入 result[j][i]。"],
        complexity="时间 O(nm)，额外空间 O(nm)。",
        tests=[
            _test("普通矩阵", """2 3
            1 2 3
            4 5 6""", """1 4
            2 5
            3 6""", True),
            _test("单行矩阵", "1 4\n7 8 9 10", "7\n8\n9\n10", True),
            _test("单元素", "1 1\n-5", "-5"),
            _test("方阵", "2 2\n1 0\n-2 3", "1 -2\n0 3"),
        ],
    ),
    _problem(
        point="数组顺序存储", title="向右轮转数组", difficulty="intermediate",
        source_id="leetcode-189", source_platform="力扣",
        source_url="https://leetcode.cn/problems/rotate-array/",
        description="给定整数数组和非负整数 k，将数组整体向右移动 k 个位置。请输出移动后的数组。",
        objectives=["掌握数组分段与原地翻转", "处理 k 大于数组长度的情况"],
        task_steps=["将 k 对 n 取模", "选择额外数组或三次翻转方案", "输出轮转结果"],
        input_format="第一行 n 和 k；第二行 n 个整数。",
        output_format="一行输出轮转后的 n 个整数。",
        constraints=["1 ≤ n ≤ 2×10^5", "0 ≤ k ≤ 10^9"], visual_type="array",
        starter='''
        import sys

        def rotate(nums, k):
            # TODO：返回向右轮转 k 位后的数组
            pass

        def solve(data):
            values = list(map(int, data.split()))
            n, k = values[0], values[1]
            return " ".join(map(str, rotate(values[2:2+n], k)))

        if __name__ == "__main__":
            print(solve(sys.stdin.read()))
        ''',
        solution='''
        import sys

        def rotate(nums, k):
            k %= len(nums)
            return nums[-k:] + nums[:-k] if k else nums[:]

        def solve(data):
            values = list(map(int, data.split()))
            n, k = values[0], values[1]
            return " ".join(map(str, rotate(values[2:2+n], k)))

        if __name__ == "__main__":
            print(solve(sys.stdin.read()))
        ''',
        hints=["真正移动的次数是 k % n。", "最后 k 个元素会来到最前面。", "k 取模；答案是 nums[n-k:] 与 nums[:n-k] 的拼接。"],
        complexity="时间 O(n)，额外空间 O(n)；三次翻转可做到 O(1) 额外空间。",
        tests=[
            _test("常规轮转", "7 3\n1 2 3 4 5 6 7", "5 6 7 1 2 3 4", True),
            _test("k 大于 n", "4 6\n-1 -100 3 99", "3 99 -1 -100", True),
            _test("不移动", "3 0\n2 4 6", "2 4 6"),
            _test("单元素", "1 999\n8", "8"),
        ],
    ),
    _problem(
        point="数组顺序存储", title="两个有序数组的中位数", difficulty="advanced",
        source_id="leetcode-4", source_platform="力扣",
        source_url="https://leetcode.cn/problems/median-of-two-sorted-arrays/",
        description="给定两个升序整数数组，在不完整合并全部数据的前提下求总体中位数。输出整数或以 .5 结尾的小数。",
        objectives=["使用二分划分两个有序数组", "正确处理奇偶长度与空数组"],
        task_steps=["始终在较短数组上二分", "寻找左右两侧元素数量相等的划分", "根据总长度奇偶计算中位数"],
        input_format="第一行 n、m；第二、三行分别为两个升序数组（长度为0时该行可空）。",
        output_format="输出中位数；整数不带小数点，半整数以 .5 结尾。",
        constraints=["0 ≤ n,m ≤ 2×10^5", "n+m ≥ 1", "期望 O(log(min(n,m)))"], visual_type="array",
        starter='''
        import sys

        def median_two_sorted(a, b):
            # TODO：在较短数组上二分划分
            pass

        def solve(data):
            lines = data.splitlines()
            n, m = map(int, lines[0].split())
            a = list(map(int, lines[1].split())) if n else []
            b = list(map(int, lines[2].split())) if m and len(lines) > 2 else []
            value = median_two_sorted(a, b)
            return str(int(value)) if value == int(value) else str(value)

        if __name__ == "__main__":
            print(solve(sys.stdin.read()))
        ''',
        solution='''
        import sys

        def median_two_sorted(a, b):
            if len(a) > len(b):
                a, b = b, a
            total = len(a) + len(b)
            half = (total + 1) // 2
            lo, hi = 0, len(a)
            inf = float("inf")
            while lo <= hi:
                i = (lo + hi) // 2
                j = half - i
                al = -inf if i == 0 else a[i-1]
                ar = inf if i == len(a) else a[i]
                bl = -inf if j == 0 else b[j-1]
                br = inf if j == len(b) else b[j]
                if al <= br and bl <= ar:
                    if total % 2:
                        return float(max(al, bl))
                    return (max(al, bl) + min(ar, br)) / 2
                if al > br:
                    hi = i - 1
                else:
                    lo = i + 1
            raise ValueError("invalid sorted arrays")

        def solve(data):
            lines = data.splitlines()
            n, m = map(int, lines[0].split())
            a = list(map(int, lines[1].split())) if n else []
            b = list(map(int, lines[2].split())) if m and len(lines) > 2 else []
            value = median_two_sorted(a, b)
            return str(int(value)) if value == int(value) else str(value)

        if __name__ == "__main__":
            print(solve(sys.stdin.read()))
        ''',
        hints=["把两个数组切成左右两半，左侧元素总数固定。", "在短数组上猜切分 i，长数组切分 j=half-i。", "满足 A左≤B右 且 B左≤A右时找到答案，否则移动 i。"],
        complexity="时间 O(log(min(n,m)))，额外空间 O(1)。",
        tests=[
            _test("奇数总长度", "2 1\n1 3\n2", "2", True),
            _test("偶数总长度", "2 2\n1 2\n3 4", "2.5", True),
            _test("一个空数组", "0 3\n\n2 3 4", "3"),
            _test("含重复与负数", "3 4\n-5 -1 -1\n-2 -1 3 9", "-1"),
        ],
    ),

    # ── 单链表 ─────────────────────────────────────────────────
    _problem(
        point="单链表", title="反转单链表", difficulty="basic",
        source_id="nowcoder-noob113", source_platform="牛客",
        source_url="https://www.nowcoder.com/practice/75e878df47f24fdc9dc3e400ec6058ca",
        description="给定一个单链表，请原地调整 next 指针并返回新的头结点。输入输出使用结点值序列表示。",
        objectives=["掌握 prev、cur、next 三指针反转", "正确处理空链表和单结点"],
        task_steps=["保存 cur.next", "令 cur.next 指向 prev", "同步向后移动 prev 与 cur"],
        input_format="第一行 n；第二行 n 个结点值，n=0 时可省略。",
        output_format="输出反转后的结点值，空链表输出 Empty。",
        constraints=["0 ≤ n ≤ 2×10^5", "要求 O(1) 额外链表空间"], visual_type="linked_list",
        starter='''
        import sys

        class Node:
            def __init__(self, value, next_node=None):
                self.value, self.next = value, next_node

        def reverse_list(head):
            # TODO：只修改 next 指针，返回新头结点
            pass

        def solve(data):
            values = list(map(int, data.split()))
            n, items = values[0], values[1:]
            head = None
            for value in reversed(items[:n]):
                head = Node(value, head)
            head = reverse_list(head)
            result = []
            while head:
                result.append(head.value)
                head = head.next
            return " ".join(map(str, result)) if result else "Empty"

        if __name__ == "__main__":
            print(solve(sys.stdin.read()))
        ''',
        solution='''
        import sys

        class Node:
            def __init__(self, value, next_node=None):
                self.value, self.next = value, next_node

        def reverse_list(head):
            prev, cur = None, head
            while cur:
                next_node = cur.next
                cur.next = prev
                prev, cur = cur, next_node
            return prev

        def solve(data):
            values = list(map(int, data.split()))
            n, items = values[0], values[1:]
            head = None
            for value in reversed(items[:n]):
                head = Node(value, head)
            head = reverse_list(head)
            result = []
            while head:
                result.append(head.value)
                head = head.next
            return " ".join(map(str, result)) if result else "Empty"

        if __name__ == "__main__":
            print(solve(sys.stdin.read()))
        ''',
        hints=["反转的是箭头方向，不是交换结点值。", "每次改 cur.next 前必须先保存原后继。", "prev=None；循环保存 next、反向、双指针前进；最后 prev 是新头。"],
        complexity="时间 O(n)，额外空间 O(1)。",
        tests=[
            _test("普通链表", "3\n1 2 3", "3 2 1", True),
            _test("空链表", "0", "Empty", True),
            _test("单结点", "1\n9", "9"),
            _test("含重复值", "5\n1 1 2 1 3", "3 1 2 1 1"),
        ],
    ),
    _problem(
        point="单链表", title="链表表示的两数相加", difficulty="intermediate",
        source_id="leetcode-2", source_platform="力扣",
        source_url="https://leetcode.cn/problems/add-two-numbers/",
        description="两个非负整数以逆序数字链表表示。逐位相加并返回同样采用逆序表示的结果链表。",
        objectives=["在链表遍历中维护进位", "处理两条链表长度不同和末尾进位"],
        task_steps=["同步读取两个当前结点", "计算当前位与 carry", "创建结果结点并推进指针"],
        input_format="四行：n、第一条链表的 n 个数字、m、第二条链表的 m 个数字。",
        output_format="输出结果链表的数字，保持逆序表示。",
        constraints=["1 ≤ n,m ≤ 100", "每个结点值为0到9", "除数字0外没有多余前导零"], visual_type="linked_list",
        starter='''
        import sys

        def add_numbers(a, b):
            # a、b 是逆序数字列表；TODO：返回结果的逆序数字列表
            pass

        def solve(data):
            lines = data.splitlines()
            a = list(map(int, lines[1].split()))
            b = list(map(int, lines[3].split()))
            return " ".join(map(str, add_numbers(a, b)))

        if __name__ == "__main__":
            print(solve(sys.stdin.read()))
        ''',
        solution='''
        import sys

        def add_numbers(a, b):
            result, carry, i = [], 0, 0
            while i < len(a) or i < len(b) or carry:
                total = carry
                if i < len(a): total += a[i]
                if i < len(b): total += b[i]
                result.append(total % 10)
                carry = total // 10
                i += 1
            return result

        def solve(data):
            lines = data.splitlines()
            a = list(map(int, lines[1].split()))
            b = list(map(int, lines[3].split()))
            return " ".join(map(str, add_numbers(a, b)))

        if __name__ == "__main__":
            print(solve(sys.stdin.read()))
        ''',
        hints=["逆序表示意味着可以从链表头直接处理个位。", "循环条件要覆盖任一链表未结束或仍有进位。", "sum=x+y+carry；当前位=sum%10，新进位=sum//10。"],
        complexity="时间 O(max(n,m))，结果空间 O(max(n,m))。",
        tests=[
            _test("等长链表", "3\n2 4 3\n3\n5 6 4", "7 0 8", True),
            _test("产生新高位", "1\n9\n2\n9 9", "8 0 1", True),
            _test("数字零", "1\n0\n1\n0", "0"),
            _test("长度差异", "4\n9 9 9 9\n1\n1", "0 0 0 0 1"),
        ],
    ),
    _problem(
        point="单链表", title="合并 K 个升序链表", difficulty="advanced",
        source_id="leetcode-23", source_platform="力扣",
        source_url="https://leetcode.cn/problems/merge-k-sorted-lists/",
        description="给定 K 个各自升序的链表，将所有结点合并成一条升序链表。输入以 K 行有序序列模拟链表。",
        objectives=["使用最小堆维护 K 个当前候选结点", "分析多路归并复杂度"],
        task_steps=["把每条非空链表的首元素入堆", "反复取最小值加入结果", "把该链表的下一个元素入堆"],
        input_format="第一行 K；接下来 K 行，每行先给长度，再给该链表的升序元素。",
        output_format="输出合并后的升序元素；全部为空时输出 Empty。",
        constraints=["0 ≤ K ≤ 10^4", "所有结点总数不超过 2×10^5"], visual_type="heap",
        starter='''
        import heapq
        import sys

        def merge_k_lists(lists):
            # TODO：使用最小堆完成多路归并
            pass

        def solve(data):
            lines = data.splitlines()
            k = int(lines[0])
            lists = []
            for line in lines[1:1+k]:
                values = list(map(int, line.split()))
                lists.append(values[1:1+values[0]])
            result = merge_k_lists(lists)
            return " ".join(map(str, result)) if result else "Empty"

        if __name__ == "__main__":
            print(solve(sys.stdin.read()))
        ''',
        solution='''
        import heapq
        import sys

        def merge_k_lists(lists):
            heap = []
            for list_index, values in enumerate(lists):
                if values:
                    heapq.heappush(heap, (values[0], list_index, 0))
            result = []
            while heap:
                value, list_index, item_index = heapq.heappop(heap)
                result.append(value)
                next_index = item_index + 1
                if next_index < len(lists[list_index]):
                    heapq.heappush(heap, (lists[list_index][next_index], list_index, next_index))
            return result

        def solve(data):
            lines = data.splitlines()
            k = int(lines[0])
            lists = []
            for line in lines[1:1+k]:
                values = list(map(int, line.split()))
                lists.append(values[1:1+values[0]])
            result = merge_k_lists(lists)
            return " ".join(map(str, result)) if result else "Empty"

        if __name__ == "__main__":
            print(solve(sys.stdin.read()))
        ''',
        hints=["任意时刻，全局最小值一定在某条链表当前头部。", "堆元素需要同时记录值、链表编号和该链表中的位置。", "初始化K个表头；循环pop最小项并push同表下一项。"],
        complexity="设总元素数为 N，时间 O(N log K)，额外空间 O(K)。",
        tests=[
            _test("三路归并", "3\n3 1 4 5\n3 1 3 4\n2 2 6", "1 1 2 3 4 4 5 6", True),
            _test("包含空链表", "3\n0\n1 2\n0", "2", True),
            _test("全部为空", "2\n0\n0", "Empty"),
            _test("负数与重复", "3\n3 -5 -1 2\n2 -5 3\n3 0 0 8", "-5 -5 -1 0 0 2 3 8"),
        ],
    ),

    # ── 栈 ─────────────────────────────────────────────────────
    _problem(
        point="栈的定义", title="栈的基本操作", difficulty="basic",
        source_id="nowcoder-noob83", source_platform="牛客",
        source_url="https://www.nowcoder.com/practice/cdf02ea916454957b575585634e5773a",
        description="维护一个初始为空的栈，依次处理 push、pop、query、size 操作。对需要查询的操作输出结果。",
        objectives=["理解后进先出规则", "正确处理空栈操作"],
        task_steps=["用列表保存栈元素", "push 在尾部加入", "pop/query 始终访问尾部"],
        input_format="第一行 q；接下来 q 行为 push x、pop、query 或 size。",
        output_format="query 与 size 输出结果；空栈 query 输出 Empty。",
        constraints=["1 ≤ q ≤ 2×10^5", "push 的整数绝对值不超过 10^9"], visual_type="stack",
        starter='''
        import sys

        def process(commands):
            stack, output = [], []
            # TODO：依次执行命令，并把需要输出的内容加入 output
            return output

        def solve(data):
            lines = data.strip().splitlines()
            return "\\n".join(process(lines[1:1+int(lines[0])] ))

        if __name__ == "__main__":
            print(solve(sys.stdin.read()))
        ''',
        solution='''
        import sys

        def process(commands):
            stack, output = [], []
            for command in commands:
                parts = command.split()
                if parts[0] == "push": stack.append(int(parts[1]))
                elif parts[0] == "pop":
                    if stack: stack.pop()
                elif parts[0] == "query": output.append(str(stack[-1]) if stack else "Empty")
                elif parts[0] == "size": output.append(str(len(stack)))
            return output

        def solve(data):
            lines = data.strip().splitlines()
            return "\\n".join(process(lines[1:1+int(lines[0])]))

        if __name__ == "__main__":
            print(solve(sys.stdin.read()))
        ''',
        hints=["列表尾部就是栈顶。", "query 不删除元素，pop 才删除。", "按命令首词分支；空栈 query 输出 Empty，空栈 pop 不输出。"],
        complexity="每次操作均摊 O(1)，空间 O(q)。",
        tests=[
            _test("基本命令", """7
            push 1
            push 2
            size
            query
            pop
            pop
            query""", "2\n2\nEmpty", True),
            _test("空栈", "3\nquery\npop\nsize", "Empty\n0", True),
            _test("负数", "4\npush -3\nquery\npop\nquery", "-3\nEmpty"),
            _test("交替操作", "6\npush 1\npop\npush 8\nsize\nquery\npop", "1\n8"),
        ],
    ),
    _problem(
        point="栈的定义", title="逆波兰表达式求值", difficulty="intermediate",
        source_id="leetcode-150", source_platform="力扣",
        source_url="https://leetcode.cn/problems/evaluate-reverse-polish-notation/",
        description="给定合法的逆波兰表达式 token 序列，计算表达式的整数结果。除法向零截断。",
        objectives=["使用栈保存尚未参与运算的操作数", "保持减法与除法的左右操作数顺序"],
        task_steps=["数字直接入栈", "遇到运算符弹出右、左操作数", "计算后把结果压回栈"],
        input_format="第一行 token 数量 n；第二行 n 个 token。",
        output_format="输出表达式计算结果。",
        constraints=["1 ≤ n ≤ 10^4", "运算结果与中间值在32位整数范围内"], visual_type="stack",
        starter='''
        import sys

        def evaluate(tokens):
            # TODO：用栈计算逆波兰表达式
            pass

        def solve(data):
            tokens = data.split()
            return str(evaluate(tokens[1:1+int(tokens[0])]))

        if __name__ == "__main__":
            print(solve(sys.stdin.read()))
        ''',
        solution='''
        import sys

        def evaluate(tokens):
            stack = []
            for token in tokens:
                if token not in {"+", "-", "*", "/"}:
                    stack.append(int(token))
                    continue
                right, left = stack.pop(), stack.pop()
                if token == "+": value = left + right
                elif token == "-": value = left - right
                elif token == "*": value = left * right
                else: value = int(left / right)
                stack.append(value)
            return stack[-1]

        def solve(data):
            tokens = data.split()
            return str(evaluate(tokens[1:1+int(tokens[0])]))

        if __name__ == "__main__":
            print(solve(sys.stdin.read()))
        ''',
        hints=["操作符出现时，它前面的两个未使用数字就是操作数。", "先弹出的是右操作数，后弹出的是左操作数。", "遍历token：数字push；运算符pop两次、计算、push；最后栈顶是答案。"],
        complexity="时间 O(n)，空间 O(n)。",
        tests=[
            _test("基础表达式", "5\n2 1 + 3 *", "9", True),
            _test("含除法", "5\n4 13 5 / +", "6", True),
            _test("负数与截断", "3\n7 -3 /", "-2"),
            _test("复合表达式", "13\n10 6 9 3 + -11 * / * 17 + 5 +", "22"),
        ],
    ),
    _problem(
        point="栈的定义", title="柱状图中的最大矩形", difficulty="advanced",
        source_id="leetcode-84", source_platform="力扣",
        source_url="https://leetcode.cn/problems/largest-rectangle-in-histogram/",
        description="给定每根宽度为1的柱子高度，求柱状图中能形成的最大矩形面积。",
        objectives=["使用单调递增栈确定左右边界", "理解元素出栈时计算面积的时机"],
        task_steps=["在末尾追加高度0的哨兵", "当前高度更小时持续弹栈", "以弹出高度乘可扩展宽度更新答案"],
        input_format="第一行 n；第二行 n 个非负高度。",
        output_format="输出最大矩形面积。",
        constraints=["1 ≤ n ≤ 2×10^5", "0 ≤ height ≤ 10^9"], visual_type="stack",
        starter='''
        import sys

        def largest_rectangle(heights):
            # TODO：维护单调递增下标栈
            pass

        def solve(data):
            values = list(map(int, data.split()))
            return str(largest_rectangle(values[1:1+values[0]]))

        if __name__ == "__main__":
            print(solve(sys.stdin.read()))
        ''',
        solution='''
        import sys

        def largest_rectangle(heights):
            stack, best = [], 0
            for index, height in enumerate(heights + [0]):
                start = index
                while stack and stack[-1][1] > height:
                    start_index, old_height = stack.pop()
                    best = max(best, old_height * (index - start_index))
                    start = start_index
                stack.append((start, height))
            return best

        def solve(data):
            values = list(map(int, data.split()))
            return str(largest_rectangle(values[1:1+values[0]]))

        if __name__ == "__main__":
            print(solve(sys.stdin.read()))
        ''',
        hints=["柱子何时能确定向右延伸的终点？遇到更矮柱时。", "栈保存递增高度及它最早可延伸到的下标。", "遍历 heights+[0]；弹出更高柱并算 h*(i-start)，新柱继承最早start。"],
        complexity="时间 O(n)，空间 O(n)。",
        tests=[
            _test("经典样例", "6\n2 1 5 6 2 3", "10", True),
            _test("两个柱子", "2\n2 4", "4", True),
            _test("严格递增", "5\n1 2 3 4 5", "9"),
            _test("含零高度", "6\n2 0 2 3 0 4", "4"),
        ],
    ),

    # ── 队列 ───────────────────────────────────────────────────
    _problem(
        point="队列定义", title="队列的基本操作", difficulty="basic",
        source_id="nowcoder-noob93", source_platform="牛客",
        source_url="https://www.nowcoder.com/practice/1137c8f6ffac4d5d94cc1b0cb08723f9",
        description="维护一个先进先出的整数队列，完成入队、出队、查询队首和查询长度操作。",
        objectives=["理解先进先出规则", "使用 deque 实现 O(1) 队首删除"],
        task_steps=["操作1把元素放到队尾", "操作2删除队首", "操作3/4输出队首或长度"],
        input_format="第一行 q；随后 q 行：1 x 入队、2 出队、3 查询队首、4 查询长度。",
        output_format="按顺序输出操作3、4结果；非法出队或查询输出对应 ERR 文本。",
        constraints=["1 ≤ q ≤ 2×10^5"], visual_type="queue",
        starter='''
        from collections import deque
        import sys

        def process(commands):
            queue, output = deque(), []
            # TODO：执行队列命令
            return output

        def solve(data):
            lines = data.strip().splitlines()
            return "\\n".join(process(lines[1:1+int(lines[0])]))

        if __name__ == "__main__":
            print(solve(sys.stdin.read()))
        ''',
        solution='''
        from collections import deque
        import sys

        def process(commands):
            queue, output = deque(), []
            for command in commands:
                parts = command.split()
                if parts[0] == "1": queue.append(int(parts[1]))
                elif parts[0] == "2":
                    if queue: queue.popleft()
                    else: output.append("ERR_CANNOT_POP")
                elif parts[0] == "3": output.append(str(queue[0]) if queue else "ERR_CANNOT_QUERY")
                elif parts[0] == "4": output.append(str(len(queue)))
            return output

        def solve(data):
            lines = data.strip().splitlines()
            return "\\n".join(process(lines[1:1+int(lines[0])]))

        if __name__ == "__main__":
            print(solve(sys.stdin.read()))
        ''',
        hints=["入队在右端，出队在左端。", "Python 列表 pop(0) 是 O(n)，优先使用 deque。", "append入队、popleft出队、queue[0]查队首、len查长度。"],
        complexity="每次操作 O(1)，空间 O(q)。",
        tests=[
            _test("基本命令", "7\n1 10\n1 20\n3\n4\n2\n3\n2", "10\n2\n20", True),
            _test("非法操作", "3\n2\n3\n4", "ERR_CANNOT_POP\nERR_CANNOT_QUERY\n0", True),
            _test("重复入队", "5\n1 7\n1 7\n2\n3\n4", "7\n1"),
            _test("交替", "6\n1 -1\n3\n2\n1 8\n4\n3", "-1\n1\n8"),
        ],
    ),
    _problem(
        point="队列定义", title="设计循环队列", difficulty="intermediate",
        source_id="leetcode-622", source_platform="力扣",
        source_url="https://leetcode.cn/problems/design-circular-queue/",
        description="用固定长度数组实现循环队列，支持入队、出队、读取队首/队尾以及判空判满。",
        objectives=["掌握 front、size 与取模运算", "区分队空与队满状态"],
        task_steps=["创建容量为 k 的数组", "用 (front+size)%k 定位队尾写入点", "更新 size 并实现查询"],
        input_format="第一行容量 k 和操作数 q；随后 q 行为 en x、de、front、rear、empty、full。",
        output_format="除成功出入队外，每个查询输出一行；de 输出 true/false。",
        constraints=["1 ≤ k,q ≤ 10^5"], visual_type="queue",
        starter='''
        import sys

        class CircularQueue:
            def __init__(self, capacity):
                # TODO：初始化固定数组、队首与长度
                pass
            def enqueue(self, value): pass
            def dequeue(self): pass
            def front_value(self): pass
            def rear_value(self): pass
            def is_empty(self): pass
            def is_full(self): pass

        def solve(data):
            lines = data.strip().splitlines()
            k, q = map(int, lines[0].split())
            queue, output = CircularQueue(k), []
            for line in lines[1:1+q]:
                parts = line.split(); op = parts[0]
                if op == "en": output.append(str(queue.enqueue(int(parts[1]))).lower())
                elif op == "de": output.append(str(queue.dequeue()).lower())
                elif op == "front": output.append(str(queue.front_value()))
                elif op == "rear": output.append(str(queue.rear_value()))
                elif op == "empty": output.append(str(queue.is_empty()).lower())
                elif op == "full": output.append(str(queue.is_full()).lower())
            return "\\n".join(output)

        if __name__ == "__main__": print(solve(sys.stdin.read()))
        ''',
        solution='''
        import sys

        class CircularQueue:
            def __init__(self, capacity):
                self.data = [0] * capacity
                self.capacity = capacity
                self.front = 0
                self.size = 0
            def enqueue(self, value):
                if self.is_full(): return False
                self.data[(self.front + self.size) % self.capacity] = value
                self.size += 1
                return True
            def dequeue(self):
                if self.is_empty(): return False
                self.front = (self.front + 1) % self.capacity
                self.size -= 1
                return True
            def front_value(self): return -1 if self.is_empty() else self.data[self.front]
            def rear_value(self): return -1 if self.is_empty() else self.data[(self.front + self.size - 1) % self.capacity]
            def is_empty(self): return self.size == 0
            def is_full(self): return self.size == self.capacity

        def solve(data):
            lines = data.strip().splitlines()
            k, q = map(int, lines[0].split())
            queue, output = CircularQueue(k), []
            for line in lines[1:1+q]:
                parts = line.split(); op = parts[0]
                if op == "en": output.append(str(queue.enqueue(int(parts[1]))).lower())
                elif op == "de": output.append(str(queue.dequeue()).lower())
                elif op == "front": output.append(str(queue.front_value()))
                elif op == "rear": output.append(str(queue.rear_value()))
                elif op == "empty": output.append(str(queue.is_empty()).lower())
                elif op == "full": output.append(str(queue.is_full()).lower())
            return "\\n".join(output)

        if __name__ == "__main__": print(solve(sys.stdin.read()))
        ''',
        hints=["用 size 可以无歧义地区分空和满。", "队尾元素下标是 (front+size-1)%capacity。", "入队写(front+size)%k并size+1；出队front=(front+1)%k并size-1。"],
        complexity="所有操作 O(1)，空间 O(k)。",
        tests=[
            _test("循环复用", "3 8\nen 1\nen 2\nen 3\nfull\nde\nen 4\nrear\nfront", "true\ntrue\ntrue\ntrue\ntrue\ntrue\n4\n2", True),
            _test("容量一", "1 6\nempty\nen 7\nfull\nfront\nde\nrear", "true\ntrue\ntrue\n7\ntrue\n-1", True),
            _test("满队入队失败", "2 4\nen 1\nen 2\nen 3\nrear", "true\ntrue\nfalse\n2"),
            _test("空队出队失败", "2 3\nde\nfront\nempty", "false\n-1\ntrue"),
        ],
    ),
    _problem(
        point="队列定义", title="滑动窗口最大值", difficulty="advanced",
        source_id="leetcode-239", source_platform="力扣",
        source_url="https://leetcode.cn/problems/sliding-window-maximum/",
        description="给定数组与窗口宽度 k，窗口每次向右移动一格，输出每个窗口中的最大值。",
        objectives=["使用单调双端队列维护候选下标", "及时移除过期元素"],
        task_steps=["移除队首中已离开窗口的下标", "移除队尾不大于当前值的下标", "窗口形成后记录队首值"],
        input_format="第一行 n 和 k；第二行 n 个整数。",
        output_format="输出 n-k+1 个窗口最大值。",
        constraints=["1 ≤ k ≤ n ≤ 2×10^5"], visual_type="queue",
        starter='''
        from collections import deque
        import sys

        def window_maximum(nums, k):
            # TODO：队列中保存仍可能成为最大值的下标
            pass

        def solve(data):
            values = list(map(int, data.split()))
            n, k = values[0], values[1]
            return " ".join(map(str, window_maximum(values[2:2+n], k)))

        if __name__ == "__main__": print(solve(sys.stdin.read()))
        ''',
        solution='''
        from collections import deque
        import sys

        def window_maximum(nums, k):
            queue, result = deque(), []
            for index, value in enumerate(nums):
                while queue and queue[0] <= index - k: queue.popleft()
                while queue and nums[queue[-1]] <= value: queue.pop()
                queue.append(index)
                if index >= k - 1: result.append(nums[queue[0]])
            return result

        def solve(data):
            values = list(map(int, data.split()))
            n, k = values[0], values[1]
            return " ".join(map(str, window_maximum(values[2:2+n], k)))

        if __name__ == "__main__": print(solve(sys.stdin.read()))
        ''',
        hints=["队列保存下标，才能判断元素是否离开窗口。", "队列对应值保持严格递减，队首就是最大值。", "先弹过期队首，再弹不大于当前值的队尾，push当前下标。"],
        complexity="时间 O(n)，空间 O(k)。",
        tests=[
            _test("经典样例", "8 3\n1 3 -1 -3 5 3 6 7", "3 3 5 5 6 7", True),
            _test("窗口为一", "4 1\n4 2 12 3", "4 2 12 3", True),
            _test("整个数组", "5 5\n-2 -1 -7 -3 -4", "-1"),
            _test("重复最大值", "6 2\n2 2 1 2 2 0", "2 2 2 2 2"),
        ],
    ),

    # ── 哈希表 ─────────────────────────────────────────────────
    _problem(
        point="哈希表", title="两数之和", difficulty="basic",
        source_id="nowcoder-noob120", source_platform="牛客",
        source_url="https://www.nowcoder.com/practice/c4a4f030ca374d9bb9df5c0bdf388626",
        description="给定整数数组和目标值，找出恰好一对元素之和等于目标值，输出它们的1-based下标。",
        objectives=["使用哈希表把查找补数降到 O(1)", "避免同一个元素被使用两次"],
        task_steps=["从左到右遍历数组", "检查 target-value 是否已出现", "未匹配时记录 value 到下标的映射"],
        input_format="第一行 n 和 target；第二行 n 个整数。保证恰有一组解。",
        output_format="输出较小下标和较大下标，均从1开始。",
        constraints=["2 ≤ n ≤ 2×10^5"], visual_type="hash_table",
        starter='''
        import sys

        def two_sum(nums, target):
            # TODO：返回两个1-based下标
            pass

        def solve(data):
            values = list(map(int, data.split()))
            n, target = values[0], values[1]
            return " ".join(map(str, two_sum(values[2:2+n], target)))

        if __name__ == "__main__": print(solve(sys.stdin.read()))
        ''',
        solution='''
        import sys

        def two_sum(nums, target):
            seen = {}
            for index, value in enumerate(nums, start=1):
                if target - value in seen:
                    return [seen[target - value], index]
                seen[value] = index
            return []

        def solve(data):
            values = list(map(int, data.split()))
            n, target = values[0], values[1]
            return " ".join(map(str, two_sum(values[2:2+n], target)))

        if __name__ == "__main__": print(solve(sys.stdin.read()))
        ''',
        hints=["遍历到 x 时，需要知道 target-x 是否在前面出现。", "哈希表记录数值到下标；先查询再写入可避免使用自身。", "for i,x：若 target-x in seen 返回 seen[...]、i；否则 seen[x]=i。"],
        complexity="时间 O(n)，空间 O(n)。",
        tests=[
            _test("牛客样例", "4 9\n0 7 2 1", "2 3", True),
            _test("负数", "4 -1\n-3 4 3 -5", "2 4", True),
            _test("重复值", "2 6\n3 3", "1 2"),
            _test("答案在两端", "5 10\n8 1 2 3 2", "1 3"),
        ],
    ),
    _problem(
        point="哈希表", title="字母异位词分组", difficulty="intermediate",
        source_id="leetcode-49", source_platform="力扣",
        source_url="https://leetcode.cn/problems/group-anagrams/",
        description="把由小写字母组成的字符串按“字符种类及次数完全相同”分组。为便于判题，每组内部和组之间都按字典序输出。",
        objectives=["设计稳定的哈希键表示字符频次", "输出确定顺序的分组结果"],
        task_steps=["为每个字符串计算26维频次数组", "以频次元组作为哈希键分组", "排序后逐组输出"],
        input_format="第一行 n；接下来 n 行每行一个非空小写字符串。",
        output_format="每组一行，组内字符串空格分隔；各组按首个字符串排序。",
        constraints=["1 ≤ n ≤ 10^4", "字符串总长度不超过 2×10^5"], visual_type="hash_table",
        starter='''
        import sys

        def group_anagrams(words):
            # TODO：返回按要求排序后的二维列表
            pass

        def solve(data):
            lines = data.strip().splitlines()
            groups = group_anagrams(lines[1:1+int(lines[0])])
            return "\\n".join(" ".join(group) for group in groups)

        if __name__ == "__main__": print(solve(sys.stdin.read()))
        ''',
        solution='''
        from collections import defaultdict
        import sys

        def group_anagrams(words):
            groups = defaultdict(list)
            for word in words:
                counts = [0] * 26
                for char in word: counts[ord(char) - 97] += 1
                groups[tuple(counts)].append(word)
            result = [sorted(group) for group in groups.values()]
            return sorted(result, key=lambda group: group[0])

        def solve(data):
            lines = data.strip().splitlines()
            return "\\n".join(" ".join(group) for group in group_anagrams(lines[1:1+int(lines[0])]))

        if __name__ == "__main__": print(solve(sys.stdin.read()))
        ''',
        hints=["异位词排序后相同，但频次数组可以避免重复排序。", "长度26的计数元组可以作为字典键。", "groups[counts].append(word)；最后组内排序，再按group[0]排序。"],
        complexity="设字符总数为 S，时间 O(S + 排序开销)，空间 O(S)。",
        tests=[
            _test("经典分组", "6\neat\ntea\ntan\nate\nnat\nbat", "ate eat tea\nbat\nnat tan", True),
            _test("单字符串", "1\na", "a", True),
            _test("重复字符串", "4\nab\nba\nab\nabc", "ab ab ba\nabc"),
            _test("不同长度", "5\na\naa\nb\naba\naab", "a\naa\naab aba\nb"),
        ],
    ),
    _problem(
        point="哈希表", title="直线上最多的点数", difficulty="advanced",
        source_id="leetcode-149", source_platform="力扣",
        source_url="https://leetcode.cn/problems/max-points-on-a-line/",
        description="给定平面上的整数点，求一条直线最多可以经过多少个点。所有输入点互不重复。",
        objectives=["用最大公约数规范化斜率哈希键", "统一处理垂直线和斜率符号"],
        task_steps=["枚举每个点作为基准", "统计它到后续点的规范化方向", "更新最大同方向数量"],
        input_format="第一行 n；接下来 n 行每行两个整数 x、y。",
        output_format="输出同一直线上的最大点数。",
        constraints=["1 ≤ n ≤ 300", "坐标绝对值不超过 10^4"], visual_type="hash_table",
        starter='''
        import math
        import sys

        def max_points(points):
            # TODO：枚举基准点并统计规范化斜率
            pass

        def solve(data):
            values = list(map(int, data.split()))
            n = values[0]
            points = [(values[i], values[i+1]) for i in range(1, 2*n+1, 2)]
            return str(max_points(points))

        if __name__ == "__main__": print(solve(sys.stdin.read()))
        ''',
        solution='''
        import math
        import sys

        def max_points(points):
            if len(points) <= 2: return len(points)
            answer = 2
            for i, (x1, y1) in enumerate(points):
                slopes = {}
                for x2, y2 in points[i+1:]:
                    dx, dy = x2 - x1, y2 - y1
                    divisor = math.gcd(dx, dy)
                    dx, dy = dx // divisor, dy // divisor
                    if dx < 0 or (dx == 0 and dy < 0): dx, dy = -dx, -dy
                    key = (dy, dx)
                    slopes[key] = slopes.get(key, 0) + 1
                    answer = max(answer, slopes[key] + 1)
            return answer

        def solve(data):
            values = list(map(int, data.split()))
            n = values[0]
            points = [(values[i], values[i+1]) for i in range(1, 2*n+1, 2)]
            return str(max_points(points))

        if __name__ == "__main__": print(solve(sys.stdin.read()))
        ''',
        hints=["浮点斜率会有精度问题，用约分后的(dy,dx)。", "用gcd约分，并把负号统一放在固定一侧。", "对每个基准点清空哈希表；每个方向计数+1代表还要加上基准点。"],
        complexity="时间 O(n²)，空间 O(n)。",
        tests=[
            _test("全部共线", "3\n1 1\n2 2\n3 3", "3", True),
            _test("多条直线", "6\n1 1\n3 2\n5 3\n4 1\n2 3\n1 4", "4", True),
            _test("垂直线", "4\n2 1\n2 3\n2 -1\n0 0", "3"),
            _test("单点", "1\n7 -2", "1"),
        ],
    ),

    # ── 二叉树遍历 ─────────────────────────────────────────────
    _problem(
        point="二叉树遍历", title="二叉树前序遍历", difficulty="basic",
        source_id="leetcode-144", source_platform="力扣",
        source_url="https://leetcode.cn/problems/binary-tree-preorder-traversal/",
        description="给定二叉树的层序序列，null 表示空孩子，请输出根—左—右顺序的前序遍历。",
        objectives=["理解前序遍历的访问顺序", "用显式栈实现迭代遍历"],
        task_steps=["构建层序数组表示", "栈先压右孩子再压左孩子", "弹栈时记录当前结点"],
        input_format="一行层序 token，以空格分隔；null 表示空位置。",
        output_format="输出前序遍历结点值；空树输出 Empty。",
        constraints=["结点数不超过 2×10^5"], visual_type="tree",
        starter='''
        import sys

        def preorder(values):
            # values 是层序数组（None 表示空）；TODO：返回前序结果
            pass

        def solve(data):
            values = [None if x == "null" else int(x) for x in data.split()]
            result = preorder(values)
            return " ".join(map(str, result)) if result else "Empty"

        if __name__ == "__main__": print(solve(sys.stdin.read()))
        ''',
        solution='''
        import sys

        def preorder(values):
            if not values or values[0] is None: return []
            result, stack = [], [0]
            while stack:
                index = stack.pop()
                if index >= len(values) or values[index] is None: continue
                result.append(values[index])
                stack.append(index * 2 + 2)
                stack.append(index * 2 + 1)
            return result

        def solve(data):
            values = [None if x == "null" else int(x) for x in data.split()]
            result = preorder(values)
            return " ".join(map(str, result)) if result else "Empty"

        if __name__ == "__main__": print(solve(sys.stdin.read()))
        ''',
        hints=["前序顺序是根、左、右。", "栈后进先出，所以要先压右孩子。", "pop索引；若有效则记录值，再push 2i+2、2i+1。"],
        complexity="时间 O(n)，空间 O(h) 到 O(n)。",
        tests=[
            _test("普通树", "1 2 3 4 5 null 6", "1 2 4 5 3 6", True),
            _test("空树", "null", "Empty", True),
            _test("单结点", "8", "8"),
            _test("左斜结构", "1 2 null 3", "1 2 3"),
        ],
    ),
    _problem(
        point="二叉树遍历", title="二叉树层序遍历", difficulty="intermediate",
        source_id="leetcode-102", source_platform="力扣",
        source_url="https://leetcode.cn/problems/binary-tree-level-order-traversal/",
        description="按层从左到右遍历二叉树。每层单独输出一行。输入采用完整数组下标规则的层序 token。",
        objectives=["使用队列按层处理二叉树", "在每轮固定当前层结点数量"],
        task_steps=["队列初始化根索引", "每轮读取当前队列长度", "扩展有效左右孩子并输出本层"],
        input_format="一行层序 token，null 表示空位置。",
        output_format="每层一行，结点值空格分隔；空树输出 Empty。",
        constraints=["结点数不超过 2×10^5"], visual_type="tree",
        starter='''
        from collections import deque
        import sys

        def level_order(values):
            # TODO：返回二维列表，每个子列表是一层
            pass

        def solve(data):
            values = [None if x == "null" else int(x) for x in data.split()]
            levels = level_order(values)
            return "\\n".join(" ".join(map(str, level)) for level in levels) if levels else "Empty"

        if __name__ == "__main__": print(solve(sys.stdin.read()))
        ''',
        solution='''
        from collections import deque
        import sys

        def level_order(values):
            if not values or values[0] is None: return []
            queue, result = deque([0]), []
            while queue:
                level = []
                for _ in range(len(queue)):
                    index = queue.popleft()
                    level.append(values[index])
                    for child in (index * 2 + 1, index * 2 + 2):
                        if child < len(values) and values[child] is not None: queue.append(child)
                result.append(level)
            return result

        def solve(data):
            values = [None if x == "null" else int(x) for x in data.split()]
            levels = level_order(values)
            return "\\n".join(" ".join(map(str, level)) for level in levels) if levels else "Empty"

        if __name__ == "__main__": print(solve(sys.stdin.read()))
        ''',
        hints=["广度优先遍历天然使用队列。", "进入一层前先保存 len(queue)，只处理这些结点。", "每轮for range(size)弹出结点并压入有效孩子，收集本层列表。"],
        complexity="时间 O(n)，空间 O(n)。",
        tests=[
            _test("三层树", "3 9 20 null null 15 7", "3\n9 20\n15 7", True),
            _test("空树", "null", "Empty", True),
            _test("完全二叉树", "1 2 3 4 5 6 7", "1\n2 3\n4 5 6 7"),
            _test("含负数", "-1 -2 -3 null 4", "-1\n-2 -3\n4"),
        ],
    ),
    _problem(
        point="二叉树遍历", title="二叉树中的最大路径和", difficulty="advanced",
        source_id="leetcode-124", source_platform="力扣",
        source_url="https://leetcode.cn/problems/binary-tree-maximum-path-sum/",
        description="二叉树路径可从任意结点开始和结束，但相邻结点必须有父子关系且每个结点最多经过一次。求最大路径和。",
        objectives=["用后序遍历计算向上贡献值", "区分返回给父结点的单边路径与当前完整路径"],
        task_steps=["递归得到左右子树最大非负贡献", "用 node+left+right 更新全局答案", "向父结点返回 node+max(left,right)"],
        input_format="一行层序 token，null 表示空位置；保证根结点存在。",
        output_format="输出最大路径和。",
        constraints=["1 ≤ 结点数 ≤ 3×10^4", "结点值范围 [-1000,1000]"], visual_type="tree",
        starter='''
        import sys

        def max_path_sum(values):
            # TODO：后序遍历数组表示的二叉树
            pass

        def solve(data):
            values = [None if x == "null" else int(x) for x in data.split()]
            return str(max_path_sum(values))

        if __name__ == "__main__": print(solve(sys.stdin.read()))
        ''',
        solution='''
        import sys

        def max_path_sum(values):
            best = -10**18
            def gain(index):
                nonlocal best
                if index >= len(values) or values[index] is None: return 0
                left = max(0, gain(index * 2 + 1))
                right = max(0, gain(index * 2 + 2))
                best = max(best, values[index] + left + right)
                return values[index] + max(left, right)
            gain(0)
            return best

        def solve(data):
            values = [None if x == "null" else int(x) for x in data.split()]
            return str(max_path_sum(values))

        if __name__ == "__main__": print(solve(sys.stdin.read()))
        ''',
        hints=["向父结点延伸的路径不能同时包含左右两边。", "但以当前结点为最高点的答案可以同时接左右贡献。", "gain=max(0,left/right)；best=max(best,node+left+right)；return node+max(left,right)。"],
        complexity="时间 O(n)，递归栈 O(h)。",
        tests=[
            _test("跨越根结点", "-10 9 20 null null 15 7", "42", True),
            _test("单结点", "-3", "-3", True),
            _test("全负数", "-2 -1 -4", "-1"),
            _test("只取一侧", "5 4 8 11 null 13 4 7 2", "48"),
        ],
    ),

    # ── 图遍历 ─────────────────────────────────────────────────
    _problem(
        point="图的定义", title="图中是否存在路径", difficulty="basic",
        source_id="leetcode-1971", source_platform="力扣",
        source_url="https://leetcode.cn/problems/find-if-path-exists-in-graph/",
        description="给定一个无向图及起点、终点，判断是否存在从起点到终点的路径。",
        objectives=["用邻接表表示稀疏图", "用 BFS/DFS 避免重复访问"],
        task_steps=["根据边构建双向邻接表", "从 source 开始遍历", "访问 destination 时返回 true"],
        input_format="第一行 n、m；接下来 m 行无向边 u v；最后一行 source destination。",
        output_format="存在路径输出 true，否则 false。",
        constraints=["1 ≤ n ≤ 2×10^5", "0 ≤ m ≤ 2×10^5"], visual_type="graph",
        starter='''
        from collections import deque
        import sys

        def valid_path(n, edges, source, destination):
            # TODO：构建邻接表并遍历
            pass

        def solve(data):
            values = list(map(int, data.split()))
            n, m = values[0], values[1]
            edges = [(values[i], values[i+1]) for i in range(2, 2+2*m, 2)]
            source, destination = values[2+2*m], values[3+2*m]
            return str(valid_path(n, edges, source, destination)).lower()

        if __name__ == "__main__": print(solve(sys.stdin.read()))
        ''',
        solution='''
        from collections import deque
        import sys

        def valid_path(n, edges, source, destination):
            graph = [[] for _ in range(n)]
            for u, v in edges:
                graph[u].append(v); graph[v].append(u)
            queue, seen = deque([source]), {source}
            while queue:
                node = queue.popleft()
                if node == destination: return True
                for neighbor in graph[node]:
                    if neighbor not in seen:
                        seen.add(neighbor); queue.append(neighbor)
            return False

        def solve(data):
            values = list(map(int, data.split()))
            n, m = values[0], values[1]
            edges = [(values[i], values[i+1]) for i in range(2, 2+2*m, 2)]
            return str(valid_path(n, edges, values[2+2*m], values[3+2*m])).lower()

        if __name__ == "__main__": print(solve(sys.stdin.read()))
        ''',
        hints=["无向边需要同时加入 u→v 与 v→u。", "visited 必须在入队时标记，避免重复入队。", "BFS：queue=[source]；循环弹出、检查终点、扩展未访问邻居。"],
        complexity="时间 O(n+m)，空间 O(n+m)。",
        tests=[
            _test("存在路径", "3 3\n0 1\n1 2\n2 0\n0 2", "true", True),
            _test("两个连通分量", "6 3\n0 1\n2 3\n4 5\n0 5", "false", True),
            _test("起终点相同", "1 0\n0 0", "true"),
            _test("链式图", "5 4\n0 1\n1 2\n2 3\n3 4\n0 4", "true"),
        ],
    ),
    _problem(
        point="图的定义", title="岛屿数量", difficulty="intermediate",
        source_id="leetcode-200", source_platform="力扣",
        source_url="https://leetcode.cn/problems/number-of-islands/",
        description="由0和1组成的网格中，上下左右相邻的1属于同一座岛屿。求岛屿数量。",
        objectives=["把二维网格视为隐式图", "从每个未访问陆地启动一次遍历"],
        task_steps=["遍历所有格子", "遇到未访问的1时答案加一", "BFS/DFS 标记整座岛屿"],
        input_format="第一行 n、m；接下来 n 行为长度 m 的01字符串。",
        output_format="输出岛屿数量。",
        constraints=["1 ≤ n,m ≤ 500"], visual_type="graph",
        starter='''
        from collections import deque
        import sys

        def count_islands(grid):
            # TODO：遍历网格并标记连通陆地
            pass

        def solve(data):
            lines = data.strip().splitlines()
            n, m = map(int, lines[0].split())
            return str(count_islands(lines[1:1+n]))

        if __name__ == "__main__": print(solve(sys.stdin.read()))
        ''',
        solution='''
        from collections import deque
        import sys

        def count_islands(grid):
            n, m = len(grid), len(grid[0])
            seen, answer = set(), 0
            for row in range(n):
                for col in range(m):
                    if grid[row][col] == "0" or (row, col) in seen: continue
                    answer += 1
                    queue, seen = deque([(row, col)]), seen | {(row, col)}
                    while queue:
                        r, c = queue.popleft()
                        for nr, nc in ((r-1,c),(r+1,c),(r,c-1),(r,c+1)):
                            if 0 <= nr < n and 0 <= nc < m and grid[nr][nc] == "1" and (nr,nc) not in seen:
                                seen.add((nr,nc)); queue.append((nr,nc))
            return answer

        def solve(data):
            lines = data.strip().splitlines()
            n, m = map(int, lines[0].split())
            return str(count_islands(lines[1:1+n]))

        if __name__ == "__main__": print(solve(sys.stdin.read()))
        ''',
        hints=["每发现一个未访问的1，就找到了新岛屿。", "从该格开始遍历，只扩展上下左右的1。", "双层循环；新陆地answer+1并BFS；用seen避免重复访问。"],
        complexity="时间 O(nm)，空间 O(nm)。",
        tests=[
            _test("一座岛", "4 5\n11110\n11010\n11000\n00000", "1", True),
            _test("三座岛", "4 5\n11000\n11000\n00100\n00011", "3", True),
            _test("全是水", "2 3\n000\n000", "0"),
            _test("对角不连通", "3 3\n101\n010\n101", "5"),
        ],
    ),
    _problem(
        point="图的定义", title="无向图中的关键连接", difficulty="advanced",
        source_id="leetcode-1192", source_platform="力扣",
        source_url="https://leetcode.cn/problems/critical-connections-in-a-network/",
        description="无向连通图中，删除某条边后若图不再连通，则该边是关键连接（桥）。输出所有桥。",
        objectives=["掌握 Tarjan 时间戳与 low 值", "根据 low[child] > dfn[parent] 判断桥"],
        task_steps=["DFS 记录每个结点首次访问时间", "用返祖边更新 low", "回溯时判断树边是否为桥"],
        input_format="第一行 n、m；接下来 m 行为无向边 u v。图保证连通。",
        output_format="每行输出桥的两个端点（小值在前），所有边按字典序排序；无桥输出 None。",
        constraints=["2 ≤ n ≤ 10^5", "n-1 ≤ m ≤ 2×10^5"], visual_type="graph",
        starter='''
        import sys
        sys.setrecursionlimit(1_000_000)

        def critical_connections(n, edges):
            # TODO：Tarjan DFS，返回桥的端点对
            pass

        def solve(data):
            values = list(map(int, data.split()))
            n, m = values[0], values[1]
            edges = [(values[i], values[i+1]) for i in range(2, 2+2*m, 2)]
            bridges = critical_connections(n, edges)
            return "\\n".join(f"{u} {v}" for u,v in bridges) if bridges else "None"

        if __name__ == "__main__": print(solve(sys.stdin.read()))
        ''',
        solution='''
        import sys
        sys.setrecursionlimit(1_000_000)

        def critical_connections(n, edges):
            graph = [[] for _ in range(n)]
            for edge_id, (u, v) in enumerate(edges):
                graph[u].append((v, edge_id)); graph[v].append((u, edge_id))
            dfn, low, timer, bridges = [-1]*n, [0]*n, 0, []
            def dfs(node, parent_edge):
                nonlocal timer
                dfn[node] = low[node] = timer; timer += 1
                for neighbor, edge_id in graph[node]:
                    if edge_id == parent_edge: continue
                    if dfn[neighbor] == -1:
                        dfs(neighbor, edge_id)
                        low[node] = min(low[node], low[neighbor])
                        if low[neighbor] > dfn[node]: bridges.append(tuple(sorted((node, neighbor))))
                    else:
                        low[node] = min(low[node], dfn[neighbor])
            dfs(0, -1)
            return sorted(bridges)

        def solve(data):
            values = list(map(int, data.split()))
            n, m = values[0], values[1]
            edges = [(values[i], values[i+1]) for i in range(2, 2+2*m, 2)]
            bridges = critical_connections(n, edges)
            return "\\n".join(f"{u} {v}" for u,v in bridges) if bridges else "None"

        if __name__ == "__main__": print(solve(sys.stdin.read()))
        ''',
        hints=["桥意味着子树无法通过返祖边回到当前结点或更早结点。", "dfn记录访问时间，low记录子树能到达的最早时间。", "DFS child 后：low[u]=min(low[u],low[v])；若 low[v]>dfn[u]，(u,v)是桥。"],
        complexity="时间 O(n+m)，空间 O(n+m)。",
        tests=[
            _test("一个桥", "4 4\n0 1\n1 2\n2 0\n1 3", "1 3", True),
            _test("树上全是桥", "4 3\n0 1\n1 2\n1 3", "0 1\n1 2\n1 3", True),
            _test("环中无桥", "5 5\n0 1\n1 2\n2 3\n3 4\n4 0", "None"),
            _test("两个环由桥连接", "6 7\n0 1\n1 2\n2 0\n2 3\n3 4\n4 5\n5 3", "2 3"),
        ],
    ),
]


def build_curated_coding_questions(point_id_by_name: dict[str, str]) -> list[dict]:
    """Return seed-ready questions and resolve existing course knowledge points."""
    questions: list[dict] = []
    slots: set[tuple[str, str]] = set()
    for source in CATALOG:
        point_name = source["primary_knowledge_point_name"]
        point_id = point_id_by_name.get(point_name)
        if not point_id:
            raise ValueError(f"编程题目录引用了不存在的知识点：{point_name}")
        slot = (point_id, source["difficulty"])
        if slot in slots:
            raise ValueError(f"知识点 {point_name} 的 {source['difficulty']} 难度重复")
        slots.add(slot)
        question = {key: value for key, value in source.items() if key not in {
            "primary_knowledge_point_name", "knowledge_point_names", "test_cases",
        }}
        question["primary_knowledge_point_id"] = point_id
        question["knowledge_point_uuids"] = [point_id]
        question["test_cases"] = source["test_cases"]
        questions.append(question)
    return questions
