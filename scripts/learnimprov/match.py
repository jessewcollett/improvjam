#!/usr/bin/env python3
"""Match Learn Improv records to the LIVE catalog snapshot. Writes a review list; does not touch the sheet."""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from extract_catalog import norm_name  # noqa: E402

DATA = ROOT / "scripts" / "data"
SNAP = DATA / "catalog-snapshot.json"
LI = DATA / "learnimprov"
OUT = DATA / "learnimprov"

ALIASES = {
    "bunnybunny": "bunny",
    "yesyesand": "yeslets",
    "zipzapzop": "whoosh",
    "questionsonly": "onlyquestions",
    "changenewchoice": "ding",
    "freezeclapfreeze": "freezetag",
    "partyquirks": "theparty",
    "silentreplay": "deafreplay",
    "lineinpocket": "pockets",
    "drknowitall": "wordatatimeexpert",
    "onewordstory": "wordatatimescene",
    "harold": "harold",
    "herald": "harold",
    "sheila": "harold",
    "entrancesandexits": "entrancesexits",
    "gibberishswitch": "switchgibberish",
    "conductedstorydie": "conductedstory",
    "ballpass": "passball",
    "openyourhands": "openyourhand",
    "tugofwar": "tugowar",
    "stuntdoubles": "stuntdouble",
    "yesand": "yesyesand",
    "mirrors": "mirror",
}


def tokens(name: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", name.lower()))


def levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            ins = cur[j - 1] + 1
            delete = prev[j] + 1
            sub = prev[j - 1] + (ca != cb)
            cur.append(min(ins, delete, sub))
        prev = cur
    return prev[-1]


def ratio(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return 1 - levenshtein(a, b) / max(len(a), len(b))


def load_snapshot() -> dict:
    if not SNAP.exists():
        raise SystemExit("Missing scripts/data/catalog-snapshot.json — run npm run catalog:snapshot first.")
    return json.loads(SNAP.read_text(encoding="utf-8"))


def index_items(rows: list[dict], name_key: str) -> dict[str, dict]:
    out = {}
    for row in rows:
        name = row.get(name_key) or row.get("name") or ""
        key = norm_name(name)
        if key:
            out[key] = row
    return out


def best_fuzzy(key: str, title: str, by_norm: dict[str, dict]) -> tuple[dict | None, float, str]:
    best = None
    best_score = 0.0
    how = ""
    title_tokens = tokens(title)
    for other_key, row in by_norm.items():
        score = ratio(key, other_key)
        other_name = row.get("name") or row.get("term") or ""
        overlap = 0.0
        if title_tokens:
            other_tokens = tokens(other_name)
            if other_tokens:
                overlap = len(title_tokens & other_tokens) / len(title_tokens | other_tokens)
        combined = max(score, overlap)
        if combined > best_score:
            best_score = combined
            best = row
            how = f"lev={score:.2f} jaccard={overlap:.2f}"
    return best, best_score, how


def match_group(li_rows: list[dict], snapshot_rows: list[dict], name_key: str, kind: str) -> tuple[list[dict], list[dict], list[dict]]:
    by_norm = index_items(snapshot_rows, name_key)
    auto = []
    review = []
    new = []
    used = set()
    for item in li_rows:
        names = [item["title"], *item.get("synonyms", [])]
        keys = [norm_name(n) for n in names if n]
        match = None
        via = ""
        for key in keys:
            if key in by_norm:
                match = by_norm[key]
                via = f"exact:{key}"
                break
            alias = ALIASES.get(key)
            if alias and alias in by_norm:
                match = by_norm[alias]
                via = f"alias:{key}->{alias}"
                break
        if match:
            auto.append({"kind": kind, "status": "auto", "via": via, "li": item["slug"], "liTitle": item["title"], "id": match.get("id"), "name": match.get(name_key) or match.get("name"), "deprecated": item.get("deprecated")})
            used.add(match.get("id"))
            continue
        fuzzy, score, how = best_fuzzy(keys[0] if keys else "", item["title"], by_norm)
        if fuzzy and score >= 0.82 and fuzzy.get("id") not in used:
            review.append({
                "kind": kind,
                "status": "review",
                "score": f"{score:.2f}",
                "via": how,
                "li": item["slug"],
                "liTitle": item["title"],
                "id": fuzzy.get("id"),
                "name": fuzzy.get(name_key) or fuzzy.get("name"),
                "action": "",
                "deprecated": item.get("deprecated"),
            })
        else:
            new.append({
                "kind": kind,
                "status": "new",
                "li": item["slug"],
                "liTitle": item["title"],
                "jamCategory": item.get("jamCategory"),
                "deprecated": item.get("deprecated"),
                "action": "import" if not item.get("deprecated") else "skip-deprecated",
            })
    return auto, review, new


def main() -> None:
    snap = load_snapshot()
    games = json.loads((LI / "li-games.json").read_text(encoding="utf-8"))
    terms = json.loads((LI / "li-terms.json").read_text(encoding="utf-8"))
    g_auto, g_review, g_new = match_group(games, snap.get("games") or [], "name", "game")
    t_auto, t_review, t_new = match_group(terms, snap.get("terms") or [], "term", "term")

    summary = {
        "snapshotGames": len(snap.get("games") or []),
        "snapshotTerms": len(snap.get("terms") or []),
        "snapshotGenerator": len(snap.get("generator") or []),
        "liGames": len(games),
        "liTerms": len(terms),
        "autoGames": len(g_auto),
        "autoTerms": len(t_auto),
        "reviewGames": len(g_review),
        "reviewTerms": len(t_review),
        "newGames": len(g_new),
        "newTerms": len(t_new),
        "source": {
            "id": "src-learnimprov",
            "name": "Learn Improv",
            "url": "https://www.learnimprov.com/",
            "note": "CC BY-SA 4.0. https://www.learnimprov.com/about/legal/",
        },
    }
    (OUT / "match-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    (OUT / "match-auto.json").write_text(json.dumps(g_auto + t_auto, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (OUT / "match-new.json").write_text(json.dumps(g_new + t_new, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    csv_path = OUT / "review-matches.csv"
    rows = g_review + t_review
    with csv_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=["kind", "status", "score", "via", "li", "liTitle", "id", "name", "action", "deprecated"])
        writer.writeheader()
        writer.writerows(rows)

    print(json.dumps(summary, indent=2))
    print(f"review csv: {csv_path} ({len(rows)} rows)")
    print("Set action=accept|reject|new on review rows before any sheet write.")


if __name__ == "__main__":
    main()
