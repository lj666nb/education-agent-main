import os
import sys
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.dependencies import get_current_user, CurrentUser
from app.core.config import settings

router = APIRouter(prefix="/code", tags=["code"])

EXECUTION_TIMEOUT = 30  # seconds


class CodeExecuteRequest(BaseModel):
    language: str  # python, javascript, java, c, cpp
    code: str


class CodeExecuteResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    execution_time: float


def _write_temp_file(suffix: str) -> tuple[str, str]:
    """Create a temp file and return (file_path, dir_path)."""
    tmp_dir = tempfile.mkdtemp(prefix="code_exec_")
    file_path = os.path.join(tmp_dir, f"Main{suffix}")
    return file_path, tmp_dir


def _cleanup(dir_path: str):
    """Remove temp directory and its contents."""
    import shutil
    try:
        shutil.rmtree(dir_path, ignore_errors=True)
    except Exception:
        pass


def _execute(cmd: list[str], cwd: str) -> tuple[str, str, int, float]:
    """Execute a command and return (stdout, stderr, exit_code, execution_time)."""
    start = time.time()
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=EXECUTION_TIMEOUT,
        )
        execution_time = time.time() - start
        return result.stdout, result.stderr, result.returncode, execution_time
    except subprocess.TimeoutExpired:
        execution_time = time.time() - start
        return "", f"执行超时（超过 {EXECUTION_TIMEOUT} 秒）", -1, execution_time
    except FileNotFoundError as e:
        return "", f"找不到编译器/解释器: {e}", -2, 0
    except Exception as e:
        return "", f"执行出错: {str(e)}", -3, 0


def _execute_python(code: str) -> CodeExecuteResponse:
    file_path, tmp_dir = _write_temp_file(".py")
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code)
        python_exe = getattr(sys, 'executable', 'python3')
        stdout, stderr, exit_code, exec_time = _execute([python_exe, file_path], tmp_dir)
        return CodeExecuteResponse(stdout=stdout, stderr=stderr, exit_code=exit_code, execution_time=round(exec_time, 3))
    finally:
        _cleanup(tmp_dir)


def _execute_javascript(code: str) -> CodeExecuteResponse:
    file_path, tmp_dir = _write_temp_file(".js")
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code)
        stdout, stderr, exit_code, exec_time = _execute(["node", file_path], tmp_dir)
        return CodeExecuteResponse(stdout=stdout, stderr=stderr, exit_code=exit_code, execution_time=round(exec_time, 3))
    finally:
        _cleanup(tmp_dir)


def _execute_java(code: str) -> CodeExecuteResponse:
    # Java needs the file name to match the class name
    # Try to extract class name from code
    import re
    class_match = re.search(r'(?:public\s+)?(?:class|interface)\s+(\w+)', code)
    class_name = class_match.group(1) if class_match else "Main"

    file_path, tmp_dir = _write_temp_file(f".java")
    file_path = os.path.join(tmp_dir, f"{class_name}.java")
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code)
        # Compile
        _, compile_stderr, compile_code, compile_time = _execute(["javac", file_path], tmp_dir)
        if compile_code != 0:
            return CodeExecuteResponse(stdout="", stderr=f"编译错误:\n{compile_stderr}", exit_code=compile_code, execution_time=round(compile_time, 3))
        # Run
        stdout, stderr, exit_code, exec_time = _execute(["java", "-cp", tmp_dir, class_name], tmp_dir)
        return CodeExecuteResponse(stdout=stdout, stderr=stderr, exit_code=exit_code, execution_time=round(exec_time, 3))
    finally:
        _cleanup(tmp_dir)


def _execute_c(code: str) -> CodeExecuteResponse:
    file_path, tmp_dir = _write_temp_file(".c")
    binary_path = os.path.join(tmp_dir, "Main")
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code)
        # Compile
        _, compile_stderr, compile_code, compile_time = _execute(["gcc", file_path, "-o", binary_path], tmp_dir)
        if compile_code != 0:
            return CodeExecuteResponse(stdout="", stderr=f"编译错误:\n{compile_stderr}", exit_code=compile_code, execution_time=round(compile_time, 3))
        # Run
        stdout, stderr, exit_code, exec_time = _execute([binary_path], tmp_dir)
        return CodeExecuteResponse(stdout=stdout, stderr=stderr, exit_code=exit_code, execution_time=round(exec_time, 3))
    finally:
        _cleanup(tmp_dir)


def _execute_cpp(code: str) -> CodeExecuteResponse:
    file_path, tmp_dir = _write_temp_file(".cpp")
    binary_path = os.path.join(tmp_dir, "Main")
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code)
        # Compile
        _, compile_stderr, compile_code, compile_time = _execute(["g++", file_path, "-o", binary_path], tmp_dir)
        if compile_code != 0:
            return CodeExecuteResponse(stdout="", stderr=f"编译错误:\n{compile_stderr}", exit_code=compile_code, execution_time=round(compile_time, 3))
        # Run
        stdout, stderr, exit_code, exec_time = _execute([binary_path], tmp_dir)
        return CodeExecuteResponse(stdout=stdout, stderr=stderr, exit_code=exit_code, execution_time=round(exec_time, 3))
    finally:
        _cleanup(tmp_dir)


LANGUAGE_EXECUTORS = {
    "python": _execute_python,
    "javascript": _execute_javascript,
    "java": _execute_java,
    "c": _execute_c,
    "cpp": _execute_cpp,
}


def _require_code_execution_enabled(kind: str = "code") -> None:
    enabled = (
        settings.ENABLE_PLOT_CODE_EXECUTION
        if kind == "plot"
        else settings.ENABLE_CODE_EXECUTION
    )
    if not enabled:
        raise HTTPException(
            status_code=403,
            detail=(
                "Code execution is disabled because this deployment does not "
                "provide a sandbox. Enable it only in an isolated environment."
            ),
        )


class PlotExecuteRequest(BaseModel):
    code: str


class PlotExecuteResponse(BaseModel):
    image: Optional[str] = None  # base64-encoded PNG
    stdout: str = ""
    stderr: str = ""
    success: bool = False


def _execute_plot(code: str) -> PlotExecuteResponse:
    """Execute matplotlib code and return the generated plot as base64 PNG.

    Injects matplotlib Agg backend, runs user code, then saves any open
    Matplotlib figures as a PNG image encoded in base64.
    """
    # Detect which optional libraries the user code needs
    code_lower = code.lower()
    needs_networkx = 'networkx' in code_lower or 'nx.' in code or 'import nx' in code or 'from nx' in code
    needs_pandas = 'pandas' in code_lower or 'pd.' in code or 'import pd' in code or 'from pd' in code
    needs_patches = any(kw in code for kw in ('Ellipse', 'Circle', 'FancyBbox', 'FancyArrow',
                                               'Arc', 'Wedge', 'Polygon', 'Rectangle', 'PathPatch',
                                               'mpatches', 'mpath', 'mlines'))

    # Inject: Agg backend + minimal imports (heavy libs loaded only if needed)
    # Font config before user code (in case AI code creates text elements)
    injected = (
        "import matplotlib\n"
        "matplotlib.use('Agg')\n"
        "import matplotlib.pyplot as plt\n"
        "import io, base64, sys\n"
        "import numpy as np\n"
        "# ── 中文字体（用户代码之前设置）──\n"
        "plt.rcParams['font.sans-serif'] = ['Noto Sans CJK SC', 'Noto Sans CJK TC', 'Noto Sans CJK JP', 'DejaVu Sans']\n"
        "plt.rcParams['axes.unicode_minus'] = False\n"
    )
    if needs_pandas:
        injected += (
            "try:\n"
            "    import pandas as pd\n"
            "except ImportError:\n"
            "    pd = None\n"
        )
    if needs_networkx:
        injected += "import networkx as nx\n"
    if needs_patches:
        injected += (
            "from matplotlib.patches import Ellipse, Circle, FancyBboxPatch, FancyArrowPatch\n"
            "from matplotlib.patches import Arc, Wedge, Polygon, Rectangle, PathPatch\n"
            "import matplotlib.patches as mpatches\n"
            "import matplotlib.path as mpath\n"
            "import matplotlib.lines as mlines\n"
        )
    injected += (
        "\n# ── 用户代码 ──\n"
        f"{code}\n\n"
        "# ── 恢复字体配置（防止用户代码覆盖）──\n"
        "plt.rcParams['font.sans-serif'] = ['Noto Sans CJK SC', 'Noto Sans CJK TC', 'Noto Sans CJK JP', 'DejaVu Sans']\n"
        "plt.rcParams['axes.unicode_minus'] = False\n"
        "\n# ── 捕获图表 ──\n"
        "figs = [plt.figure(i) for i in plt.get_fignums()]\n"
        "if figs:\n"
        "    buf = io.BytesIO()\n"
        "    figs[0].savefig(buf, format='png', dpi=150, bbox_inches='tight',\n"
        "                   facecolor='white', edgecolor='none')\n"
        "    buf.seek(0)\n"
        "    encoded = base64.b64encode(buf.read()).decode()\n"
        "    print('---PLOT_IMAGE_START---')\n"
        "    print(encoded)\n"
        "    print('---PLOT_IMAGE_END---')\n"
        "    plt.close('all')\n"
    )

    file_path, tmp_dir = _write_temp_file(".py")
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(injected)

        python_exe = getattr(sys, 'executable', 'python3')
        stdout, stderr, exit_code, exec_time = _execute([python_exe, file_path], tmp_dir)

        image: Optional[str] = None
        # Extract base64 image from stdout
        lines = stdout.split('\n')
        clean_stdout_lines = []
        in_image = False
        for line in lines:
            if '---PLOT_IMAGE_START---' in line:
                in_image = True
                continue
            if '---PLOT_IMAGE_END---' in line:
                in_image = False
                continue
            if in_image:
                if image is None:
                    image = 'data:image/png;base64,' + line.strip()
                continue
            clean_stdout_lines.append(line)

        return PlotExecuteResponse(
            image=image,
            stdout='\n'.join(clean_stdout_lines).strip(),
            stderr=stderr.strip(),
            success=exit_code == 0,
        )
    finally:
        _cleanup(tmp_dir)


@router.post("/plot", response_model=PlotExecuteResponse)
async def execute_plot(
    request: PlotExecuteRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """执行 matplotlib 代码并返回生成的图表图片（base64 PNG）

    支持：函数图像、数据分析图表、韦恩图、哈斯图、树/图等包含文字标注的可视化。
    """
    _require_code_execution_enabled("plot")
    if not request.code.strip():
        raise HTTPException(status_code=400, detail="代码不能为空")
    return _execute_plot(request.code)


@router.post("/execute", response_model=CodeExecuteResponse)
async def execute_code(
    request: CodeExecuteRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_code_execution_enabled("code")
    if not request.code.strip():
        raise HTTPException(status_code=400, detail="代码不能为空")
    if request.language not in LANGUAGE_EXECUTORS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的语言: {request.language}。支持的语言: {', '.join(LANGUAGE_EXECUTORS.keys())}"
        )

    executor = LANGUAGE_EXECUTORS[request.language]
    return executor(request.code)
