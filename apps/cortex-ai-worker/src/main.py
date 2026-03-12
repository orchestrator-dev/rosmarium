from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Rosmarium AI Worker")

class HealthResponse(BaseModel):
    status: str

@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(status="ok")
