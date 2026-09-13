#!/usr/bin/env python3
"""Download Learn Improv WordPress posts into scripts/data/learnimprov/raw/."""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "scripts" / "data" / "learnimprov" / "raw"
BASE = "https://www.learnimprov.com/wp-json/wp/v2"
UA = "ImprovJamCatalogBot/1.0 (+https://improv-jam.vercel.app; attribution: CC BY-SA 4.0)"


def get(url: str) -> tuple[bytes, dict[str, str]]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as res:
        headers = {k.lower(): v for k, v in res.headers.items()}
        return res.read(), headers


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    cats_body, _ = get(f"{BASE}/categories?per_page=100")
    RAW.joinpath("categories.json").write_bytes(cats_body)
    cats = json.loads(cats_body)
    print(f"categories={len(cats)}")

    posts: list[dict] = []
    page = 1
    total_pages = 1
    while page <= total_pages:
        dest = RAW / f"posts-page-{page:02d}.json"
        if dest.exists() and dest.stat().st_size > 20:
            chunk = json.loads(dest.read_text(encoding="utf-8"))
            posts.extend(chunk)
            print(f"page {page}: cached {len(chunk)}")
            page += 1
            continue
        url = f"{BASE}/posts?per_page=100&page={page}&status=publish"
        try:
            body, headers = get(url)
        except urllib.error.HTTPError as err:
            if err.code == 400 and page > 1:
                break
            raise
        dest.write_bytes(body)
        chunk = json.loads(body)
        if not isinstance(chunk, list):
            raise SystemExit(f"Unexpected posts payload on page {page}")
        posts.extend(chunk)
        total_pages = int(headers.get("x-wp-totalpages") or total_pages)
        print(f"page {page}/{total_pages}: {len(chunk)}")
        page += 1
        time.sleep(0.25)

    RAW.joinpath("posts.json").write_text(json.dumps(posts, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {len(posts)} posts → {RAW / 'posts.json'}")


if __name__ == "__main__":
    main()
