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
YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"


def to_item(video_id: str, sn: Dict[str, Any]) -> Dict[str, Any]:
    thumbs = sn.get("thumbnails") or {}
    thumb = (
        (thumbs.get("medium") or {}).get("url")
        or (thumbs.get("default") or {}).get("url")
        or ""
    )
    return {
        "videoId": video_id,
        "title": sn.get("title", ""),
        "channelTitle": sn.get("channelTitle", ""),
        "publishedAt": sn.get("publishedAt", ""),
        "thumbnail": thumb,
    }


@app.get("/")
def root():
    return {"ok": True, "endpoints": ["/ping", "/search?q=cat", "/popular?region=RU"]}


@app.get("/ping")
def ping():
    return {"ok": True}


@app.get("/search")
async def search(q: str = Query(min_length=1, max_length=80), max_results: int = 12):
    if not YT_API_KEY:
        raise HTTPException(status_code=500, detail="YT_API_KEY is not set on server")

    q_norm = q.strip().lower()
    max_results = max(1, min(int(max_results), 25))
    cache_key = f"search:{q_norm}:{max_results}"

    now = time.time()
    if cache_key in CACHE:
        ts, data = CACHE[cache_key]
        if now - ts < CACHE_TTL_SEC:
            return {"cached": True, "items": data}

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
        items.append(to_item(vid, sn))

    CACHE[cache_key] = (now, items)
    return {"cached": False, "items": items}


@app.get("/popular")
async def popular(region: str = "RU", max_results: int = 12):
    if not YT_API_KEY:
        raise HTTPException(status_code=500, detail="YT_API_KEY is not set on server")

    max_results = max(1, min(int(max_results), 25))
    region = (region or "RU").upper()
    cache_key = f"popular:{region}:{max_results}"

    now = time.time()
    if cache_key in CACHE:
        ts, data = CACHE[cache_key]
        if now - ts < CACHE_TTL_SEC:
            return {"cached": True, "items": data}

    params = {
        "part": "snippet",
        "chart": "mostPopular",
        "regionCode": region,
        "maxResults": max_results,
        "key": YT_API_KEY,
    }

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(YOUTUBE_VIDEOS_URL, params=params)

    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"YouTube API error: {r.text[:200]}")

    payload = r.json()
    items = []

    for it in payload.get("items", []):
        vid = it.get("id")  # тут строка videoId
        sn = it.get("snippet") or {}
        if not vid:
            continue
        items.append(to_item(str(vid), sn))

    CACHE[cache_key] = (now, items)
    return {"cached": False, "items": items}
