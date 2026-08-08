"""Tải các model YuNet và SFace chính thức từ OpenCV Zoo."""

from __future__ import annotations

from pathlib import Path
from urllib.request import urlopen


MODEL_DIR = Path(__file__).resolve().parent / "models"
MODELS = {
    "face_detection_yunet_2023mar.onnx": (
        "https://github.com/opencv/opencv_zoo/raw/main/models/"
        "face_detection_yunet/face_detection_yunet_2023mar.onnx"
    ),
    "face_recognition_sface_2021dec.onnx": (
        "https://github.com/opencv/opencv_zoo/raw/main/models/"
        "face_recognition_sface/face_recognition_sface_2021dec.onnx"
    ),
}


def download(name: str, url: str) -> None:
    destination = MODEL_DIR / name
    if destination.exists() and destination.stat().st_size > 100_000:
        print(f"Đã có: {destination.name}")
        return

    print(f"Đang tải {name}...")
    temporary = destination.with_suffix(".download")
    with urlopen(url, timeout=120) as response, temporary.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    if temporary.stat().st_size <= 100_000:
        temporary.unlink(missing_ok=True)
        raise RuntimeError(f"File tải về không hợp lệ: {name}")
    temporary.replace(destination)
    print(f"Hoàn thành: {destination} ({destination.stat().st_size / 1024 / 1024:.1f} MB)")


def main() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    for name, url in MODELS.items():
        download(name, url)


if __name__ == "__main__":
    main()

