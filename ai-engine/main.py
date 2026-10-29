from fastapi import FastAPI
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(title="MexxicanMX AI Engine")

@app.get("/")
async def root():
    return {"message": "MexxicanMX AI Engine is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
