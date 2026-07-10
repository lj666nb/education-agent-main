"""Minimal isolated Python runner served over a Unix domain socket.

The runner container has no network, no project/database mounts and a read-only
root filesystem. Each submission runs as the unprivileged ``nobody`` user with
CPU, memory, file-size, process and file-descriptor limits.
"""

from __future__ import annotations

import json
import os
import resource
import shutil
import signal
import socket
import subprocess
import tempfile
import time
from pathlib import Path


SOCKET_PATH = os.getenv("CODE_RUNNER_SOCKET", "/run/code-runner/runner.sock")
TIMEOUT_SECONDS = float(os.getenv("CODE_RUNNER_TIMEOUT", "3"))
MAX_CODE_BYTES = 64 * 1024
MAX_INPUT_BYTES = 64 * 1024
MAX_OUTPUT_BYTES = 64 * 1024
MAX_TRACE_STEPS = 160

TRACE_WRAPPER = r'''
import atexit
import json
import linecache
import os
import runpy
import sys

events = []
target = os.environ["TRACE_TARGET"]
output = os.environ["TRACE_OUTPUT"]
limit = int(os.environ.get("TRACE_LIMIT", "160"))

def safe(value, depth=0):
    if depth > 2:
        return "..."
    if value is None or isinstance(value, (bool, int, float, str)):
        text = value if not isinstance(value, str) else value[:160]
        return text
    if isinstance(value, (list, tuple)):
        return [safe(item, depth + 1) for item in list(value)[:30]]
    if isinstance(value, dict):
        return {str(key)[:50]: safe(item, depth + 1) for key, item in list(value.items())[:30]}
    if isinstance(value, set):
        return sorted(safe(item, depth + 1) for item in list(value)[:30])
    try:
        return repr(value)[:160]
    except Exception:
        return f"<{type(value).__name__}>"

def tracer(frame, event, arg):
    if event == "line" and frame.f_code.co_filename == target and len(events) < limit:
        events.append({
            "line": frame.f_lineno,
            "line_code": linecache.getline(target, frame.f_lineno).strip(),
            "variables": {
                key: safe(value)
                for key, value in frame.f_locals.items()
                if not key.startswith("__")
            },
        })
    return tracer

def write_trace():
    try:
        with open(output, "w", encoding="utf-8") as handle:
            json.dump(events, handle, ensure_ascii=False)
    except Exception:
        pass

atexit.register(write_trace)
sys.settrace(tracer)
runpy.run_path(target, run_name="__main__")
'''


def _limit_child() -> None:
    os.setgroups([])
    os.setgid(65534)
    os.setuid(65534)
    resource.setrlimit(resource.RLIMIT_CPU, (2, 2))
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_FSIZE, (1024 * 1024, 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_NPROC, (16, 16))
    resource.setrlimit(resource.RLIMIT_NOFILE, (32, 32))


def _bounded(value: bytes) -> str:
    return value[:MAX_OUTPUT_BYTES].decode("utf-8", errors="replace")


def execute(payload: dict) -> dict:
    language = str(payload.get("language", "python"))
    code = str(payload.get("code", ""))
    stdin = str(payload.get("stdin", ""))
    trace_enabled = bool(payload.get("trace", False))

    if language != "python":
        return {"stdout": "", "stderr": "当前安全运行器仅支持 Python", "exit_code": -4, "execution_time": 0, "trace": []}
    if not code.strip():
        return {"stdout": "", "stderr": "代码不能为空", "exit_code": -4, "execution_time": 0, "trace": []}
    if len(code.encode("utf-8")) > MAX_CODE_BYTES or len(stdin.encode("utf-8")) > MAX_INPUT_BYTES:
        return {"stdout": "", "stderr": "代码或测试输入超过大小限制", "exit_code": -4, "execution_time": 0, "trace": []}

    workdir = tempfile.mkdtemp(prefix="judge_", dir="/tmp")
    os.chmod(workdir, 0o755)
    source_path = Path(workdir) / "Main.py"
    source_path.write_text(code, encoding="utf-8")
    os.chmod(source_path, 0o644)

    trace_path = Path(workdir) / "trace.json"
    trace_path.write_text("[]", encoding="utf-8")
    os.chmod(trace_path, 0o666)
    wrapper_path = Path(workdir) / "trace_wrapper.py"
    wrapper_path.write_text(TRACE_WRAPPER, encoding="utf-8")
    os.chmod(wrapper_path, 0o644)

    command = ["python3", "-I", "-B", str(wrapper_path if trace_enabled else source_path)]
    env = {
        "PATH": "/usr/local/bin:/usr/bin:/bin",
        "LANG": "C.UTF-8",
        "PYTHONIOENCODING": "utf-8",
    }
    if trace_enabled:
        env.update({
            "TRACE_TARGET": str(source_path),
            "TRACE_OUTPUT": str(trace_path),
            "TRACE_LIMIT": str(MAX_TRACE_STEPS),
        })

    started = time.monotonic()
    stdout_path = Path(workdir) / "stdout.txt"
    stderr_path = Path(workdir) / "stderr.txt"
    process = None
    try:
        # Redirect output to files governed by RLIMIT_FSIZE. Using PIPE here
        # would let a print loop grow the daemon's memory until the container
        # is OOM-killed before the wall-clock timeout can intervene.
        with stdout_path.open("w+b") as stdout_file, stderr_path.open("w+b") as stderr_file:
            process = subprocess.Popen(
                command,
                cwd=workdir,
                stdin=subprocess.PIPE,
                stdout=stdout_file,
                stderr=stderr_file,
                env=env,
                preexec_fn=_limit_child,
                start_new_session=True,
            )
            process.communicate(stdin.encode("utf-8"), timeout=TIMEOUT_SECONDS)
            exit_code = process.returncode
            # RLIMIT_CPU terminates a busy loop with SIGXCPU or SIGKILL before
            # the wall-clock timeout branch runs. Normalize both signals so
            # the API can report a clear time-limit verdict.
            if exit_code in (-signal.SIGXCPU, -signal.SIGKILL):
                exit_code = -1
    except subprocess.TimeoutExpired:
        if process is not None:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()
        exit_code = -1
    except Exception as exc:
        exit_code = -3

    stdout = stdout_path.read_bytes()[:MAX_OUTPUT_BYTES] if stdout_path.exists() else b""
    stderr = stderr_path.read_bytes()[:MAX_OUTPUT_BYTES] if stderr_path.exists() else b""
    if exit_code == -1:
        stderr += f"\n执行超时（超过 {TIMEOUT_SECONDS:g} 秒）".encode("utf-8")
    elif exit_code == -3:
        stderr += "\n安全运行器启动执行进程失败".encode("utf-8")
    elif stdout_path.exists() and stdout_path.stat().st_size > MAX_OUTPUT_BYTES:
        stderr += "\n输出超过 64 KB 限制，已截断".encode("utf-8")

    trace: list[dict] = []
    if trace_enabled:
        try:
            loaded = json.loads(trace_path.read_text(encoding="utf-8"))
            if isinstance(loaded, list):
                trace = loaded[:MAX_TRACE_STEPS]
        except Exception:
            trace = []

    elapsed = round(time.monotonic() - started, 4)
    shutil.rmtree(workdir, ignore_errors=True)
    return {
        "stdout": _bounded(stdout),
        "stderr": _bounded(stderr).strip(),
        "exit_code": exit_code,
        "execution_time": elapsed,
        "trace": trace,
    }


def handle_connection(connection: socket.socket) -> None:
    connection.settimeout(8)
    buffer = b""
    while b"\n" not in buffer and len(buffer) <= 256 * 1024:
        chunk = connection.recv(65536)
        if not chunk:
            break
        buffer += chunk
    try:
        payload = json.loads(buffer.split(b"\n", 1)[0].decode("utf-8"))
        response = execute(payload)
    except Exception as exc:
        response = {"stdout": "", "stderr": f"请求格式错误：{exc}", "exit_code": -4, "execution_time": 0, "trace": []}
    connection.sendall((json.dumps(response, ensure_ascii=False) + "\n").encode("utf-8"))


def serve() -> None:
    socket_file = Path(SOCKET_PATH)
    socket_file.parent.mkdir(parents=True, exist_ok=True)
    if socket_file.exists():
        socket_file.unlink()
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as server:
        server.bind(SOCKET_PATH)
        os.chmod(SOCKET_PATH, 0o660)
        server.listen(32)
        print(f"CODE_RUNNER_READY {SOCKET_PATH}", flush=True)
        while True:
            connection, _ = server.accept()
            with connection:
                handle_connection(connection)


if __name__ == "__main__":
    serve()
