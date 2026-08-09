"""Production entry point serving the API and built frontend from one image."""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from vision_app.main import app as api_app


app = FastAPI(title="Camera Detection Web App")
app.mount("/api", api_app)
app.mount("/", StaticFiles(directory="/app/frontend", html=True), name="frontend")
