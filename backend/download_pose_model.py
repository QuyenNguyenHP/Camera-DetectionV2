"""Download the official YOLO26 nano pose checkpoint into backend/models."""
from pathlib import Path
from ultralytics import YOLO

if __name__ == "__main__":
    destination = Path(__file__).resolve().parent / "models" / "yolo26n-pose.pt"
    destination.parent.mkdir(parents=True, exist_ok=True)
    YOLO(str(destination), task="pose")
    print(f"Pose model ready: {destination}")
