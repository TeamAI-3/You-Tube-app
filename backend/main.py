import os
import time
from typing import Dict, Any

import httpx
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()


YT_API_KEY = os.getenv("YT_API_KEY", "").strip()

allowed = os.getenv("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS = [o.strip() for o in allowed.split(",")] if allowed else ["*"]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if ALLOWED_ORIGINS == ["*"] else ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CACHE: Dict[str, Any] = {}
CACHE_TTL_SEC = 120
YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"

@app.get("/")
def root():
    return {"ok": True, "endpoints": ["/ping", "/search?q=cat"]}


@app.get("/ping")
def ping():
    return {"ok": True}


@app.get("/search")
async def search(q: str = Query(min_length=1, max_length=80), max_results: int = 12):
    if not YT_API_KEY:
        raise HTTPException(status_code=500, detail="YT_API_KEY is not set on server")

    q_norm = q.strip().lower()
    now = time.time()

    if q_norm in CACHE:
        ts, data = CACHE[q_norm]
        if now - ts < CACHE_TTL_SEC:
            return {"cached": True, "items": data}

    max_results = max(1, min(int(max_results), 25))

    params = {
        "part": "snippet",
        "type": "video",
        "q": q,
        "maxResults": max_results,
        "videoEmbeddable": "true",
        "safeSearch": "none",
        "key": YT_API_KEY,
    }

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(YOUTUBE_SEARCH_URL, params=params)

    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"YouTube API error: {r.text[:200]}")

    payload = r.json()
    items = []

    for it in payload.get("items", []):
        vid = (it.get("id") or {}).get("videoId")
        sn = it.get("snippet") or {}
        if not vid:
            continue

        thumbs = sn.get("thumbnails") or {}
        thumb = (
            (thumbs.get("medium") or {}).get("url")
            or (thumbs.get("default") or {}).get("url")
            or ""
        )

        items.append({
            "videoId": vid,
            "title": sn.get("title", ""),
            "channelTitle": sn.get("channelTitle", ""),
            "publishedAt": sn.get("publishedAt", ""),
            "thumbnail": thumb,
        })

    CACHE[q_norm] = (now, items)
    return {"cached": False, "items": items}
