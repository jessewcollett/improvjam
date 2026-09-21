#!/usr/bin/env python3
"""Download IRC wiki rehearsal pages into scripts/data/ircwiki/raw/."""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "scripts" / "data" / "ircwiki" / "raw"
API = "https://wiki.improvresourcecenter.com/api.php"
UA = "ImprovJamCatalogBot/1.0 (+https://improv-jam.vercel.app; attribution: IRC Improv Wiki)"

CATEGORIES = [
    "Category:Improv Forms",
    "Category:Warm Ups",
    "Category:Concepts",
    "Category:Openings",
]


def get(params: dict) -> dict:
    query = {"format": "json", **params}
    url = API + "?" + urllib.parse.urlencode(query)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.loads(res.read().decode("utf-8"))


def next_continue(payload: dict, list_key: str) -> dict:
    cont = payload.get("continue")
    if isinstance(cont, dict):
        return {k: v for k, v in cont.items() if k != "continue"}
    qc = payload.get("query-continue")
    if isinstance(qc, dict) and list_key in qc:
        return dict(qc[list_key])
    return {}


def category_members(title: str) -> list[dict]:
    members: list[dict] = []
    extra: dict = {}
    while True:
        payload = get({
            "action": "query",
            "list": "categorymembers",
            "cmtitle": title,
            "cmlimit": "500",
            "cmnamespace": "0",
            **extra,
        })
        members.extend((payload.get("query") or {}).get("categorymembers") or [])
        extra = next_continue(payload, "categorymembers")
        if not extra:
            break
        time.sleep(0.2)
    return members


def revisions(titles: list[str]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for i in range(0, len(titles), 20):
        chunk = titles[i : i + 20]
        payload = get({
            "action": "query",
            "prop": "revisions|info",
            "rvprop": "content",
            "inprop": "url",
            "redirects": "1",
            "titles": "|".join(chunk),
        })
        query = payload.get("query") or {}
        redirects = {r["from"]: r["to"] for r in query.get("redirects") or []}
        normalized = {n["from"]: n["to"] for n in query.get("normalized") or []}
        pages = query.get("pages") or {}
        by_title = {}
        for page in pages.values():
            if page.get("missing") is not None:
                continue
            by_title[page.get("title")] = page
        for asked in chunk:
            title = redirects.get(normalized.get(asked, asked), normalized.get(asked, asked))
            page = by_title.get(title)
            if not page:
                continue
            revs = page.get("revisions") or []
            wikitext = ""
            if revs:
                wikitext = revs[0].get("*") or revs[0].get("slots", {}).get("main", {}).get("*") or ""
            out[asked] = {
                "pageid": page.get("pageid"),
                "title": page.get("title") or title,
                "fullurl": page.get("fullurl") or "",
                "wikitext": wikitext,
                "redirectedFrom": asked if asked != page.get("title") else "",
            }
        time.sleep(0.25)
    return out


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    members: dict[str, list[dict]] = {}
    titles: dict[str, set[str]] = {}
    for cat in CATEGORIES:
        rows = category_members(cat)
        members[cat] = rows
        titles[cat] = {row["title"] for row in rows if row.get("ns") == 0 and row.get("title")}
        print(f"{cat}: {len(titles[cat])}")

    all_titles = sorted({title for group in titles.values() for title in group})
    pages = revisions(all_titles)
    payload = {
        "categories": {cat: sorted(list(group)) for cat, group in titles.items()},
        "members": members,
        "pages": pages,
    }
    dest = RAW / "pages.json"
    dest.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(pages)} pages → {dest}")


if __name__ == "__main__":
    main()
