"""Client and helpers for the isolated coding runner."""

from __future__ import annotations

import json
import socket
from dataclasses import dataclass
from typing import Any

from app.core.config import settings


@dataclass
class JudgeExecution:
    stdout: str
    stderr: str
    exit_code: int
    execution_time: float
    trace: list[dict[str, Any]]


def normalize_output(value: str) -> str:
    return "\n".join(line.rstrip() for line in value.strip().splitlines())


def execute_in_sandbox(code: str, language: str, stdin: str, trace: bool = False) -> JudgeExecution:
    payload = json.dumps({
        "code": code,
        "language": language,
        "stdin": stdin,
        "trace": trace,
    }, ensure_ascii=False).encode("utf-8") + b"\n"

    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
            client.settimeout(settings.CODE_EXECUTION_TIMEOUT)
            client.connect(settings.CODE_RUNNER_SOCKET)
            client.sendall(payload)
            buffer = b""
            while b"\n" not in buffer and len(buffer) <= 512 * 1024:
                chunk = client.recv(65536)
                if not chunk:
                    break
                buffer += chunk
    except (OSError, TimeoutError) as exc:
        raise RuntimeError("安全代码运行器暂不可用，请稍后重试") from exc

    try:
        data = json.loads(buffer.split(b"\n", 1)[0].decode("utf-8"))
    except (ValueError, UnicodeDecodeError) as exc:
        raise RuntimeError("安全代码运行器返回了无法解析的结果") from exc

    return JudgeExecution(
        stdout=str(data.get("stdout", "")),
        stderr=str(data.get("stderr", "")),
        exit_code=int(data.get("exit_code", -3)),
        execution_time=float(data.get("execution_time", 0)),
        trace=data.get("trace", []) if isinstance(data.get("trace"), list) else [],
    )


def trace_to_steps(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    steps: list[dict[str, Any]] = []
    for index, event in enumerate(events, start=1):
        variables = event.get("variables") if isinstance(event.get("variables"), dict) else {}
        data_structure = _infer_data_structure(variables)
        steps.append({
            "step": index,
            "line": int(event.get("line", 0)),
            "line_code": str(event.get("line_code", "")),
            "action": "准备执行当前代码行",
            "variables": variables,
            "data_structure": data_structure,
            "explanation": f"即将执行第 {event.get('line', 0)} 行；右侧是执行前的真实变量状态。",
        })
    return steps


def _infer_data_structure(variables: dict[str, Any]) -> dict[str, Any] | None:
    priority_names = ("stack", "queue", "deque", "heap", "result", "res", "arr", "nums", "values")
    ordered = sorted(variables.items(), key=lambda item: (priority_names.index(item[0]) if item[0] in priority_names else 99))
    for name, value in ordered:
        if not isinstance(value, list):
            continue
        structure_type = "array"
        lowered = name.lower()
        if "stack" in lowered:
            structure_type = "stack"
        elif "queue" in lowered or "deque" in lowered:
            structure_type = "queue"
        elif "heap" in lowered:
            structure_type = "heap"
        return {"type": structure_type, "elements": value[:30], "name": name}
    return None
