import asyncio
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import model as ml

# https://docs.python.org/3/library/concurrent.futures.html
# one scoring job at a time 
_executor = ThreadPoolExecutor(max_workers=1)

# https://fastapi.tiangolo.com/advanced/events/#lifespan

#defines what runs before and after the app starts 
@asynccontextmanager
#controls app startup + shutdown
async def lifespan(app: FastAPI):
    #gets the system that runs background tasks 
    loop = asyncio.get_event_loop()
    #loads the model in a seperate thread so it doesnt become slow + blocks 
    await loop.run_in_executor(_executor, ml.load_model)
    #when startup is done the app can run 
    yield

app = FastAPI(title="Scholarship Scorer", lifespan=lifespan)

#CORS cofigured so local dev servers + deployments so the frontend can call it 
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PSRequest(BaseModel):
    academic_goals: str
    career_goals: str
    leadership_experience: str
    personal_statement: str


class ResumeRequest(BaseModel):
    resume_text: str

# ENDPOINTS
# https://fastapi.tiangolo.com/tutorial/handling-errors/
# https://medium.com/techtrends-digest/creating-your-first-api-endpoint-with-fastapi-1c995d375fc6

# (app.get) shows whether the server is up and models have finished loading
@app.get("/health")
def health():
    return {"ok": True, "model_loaded": ml.MODEL_LOADED}

# (app.post) accepts a personal statement essay and returns AI scores 
@app.post("/score/personal-statement")
async def score_ps(req: PSRequest):
    if not ml.MODEL_LOADED:
        raise HTTPException(status_code=503, detail="Model is still loading, try again shortly.")
    try:
        loop = asyncio.get_event_loop()
        scores = await loop.run_in_executor(_executor, ml.score_statement, req.personal_statement)
        return scores
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# (app.post) accepts a resume and returns AI scores 
@app.post("/score/resume")
async def score_resume(req: ResumeRequest):
    if not ml.MODEL_LOADED:
        raise HTTPException(status_code=503, detail="Model is still loading, try again shortly.")
    try:
        loop = asyncio.get_event_loop()
        scores = await loop.run_in_executor(_executor, ml.score_resume, req.resume_text)
        return scores
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
