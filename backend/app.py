"""Khởi chạy backend FastAPI bằng lệnh: python3 app.py."""

from __future__ import annotations

import os
from pathlib import Path
import sys


BACKEND_DIR = Path(__file__).resolve().parent
VENV_DIR = BACKEND_DIR / ".venv"


def use_project_virtualenv() -> None:
    """Tự chạy lại bằng .venv để không cài package vào Python hệ thống."""
    if sys.prefix != sys.base_prefix:
        python_bin = str(Path(sys.executable).parent)
        os.environ["PATH"] = f"{python_bin}{os.pathsep}{os.environ.get('PATH', '')}"
        return

    venv_python = VENV_DIR / "bin" / "python3"
    if not venv_python.exists():
        raise SystemExit(
            "Không tìm thấy backend/.venv. Hãy tạo môi trường bằng:\n"
            "  python3 -m venv backend/.venv\n"
            "  backend/.venv/bin/python -m pip install -r backend/requirements-dev.txt"
        )

    # Bảo đảm các subprocess do Ultralytics gọi cũng dùng pip trong .venv.
    venv_bin = str(VENV_DIR / "bin")
    os.environ["PATH"] = f"{venv_bin}{os.pathsep}{os.environ.get('PATH', '')}"
    os.execv(str(venv_python), [str(venv_python), str(Path(__file__).resolve()), *sys.argv[1:]])


def main() -> None:
    use_project_virtualenv()

    import uvicorn
    from dotenv import load_dotenv

    # Bảo đảm .env và data/faces.json luôn được đọc từ thư mục backend.
    os.chdir(BACKEND_DIR)
    load_dotenv(BACKEND_DIR / ".env")

    uvicorn.run(
        "vision_app.main:app",
        host=os.getenv("BACKEND_HOST", "127.0.0.1"),
        port=int(os.getenv("BACKEND_PORT", "8000")),
        reload=os.getenv("BACKEND_RELOAD", "true").lower() in {"1", "true", "yes"},
    )


if __name__ == "__main__":
    main()
