from fastapi import FastAPI

from app.auth.router import router


app = FastAPI(
    title="AI Executive Assistant API"
)


app.include_router(router)


@app.get("/")
def home():
    return {
        "message": "AI Assistant Backend Running"
    }