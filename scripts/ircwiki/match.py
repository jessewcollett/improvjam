#!/usr/bin/env python3
"""Match IRC wiki records to the live catalog snapshot. Does not touch the sheet."""
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
IRC = DATA / "ircwiki"
OUT = DATA / "ircwiki"

ALIASES = {
    "yesand": "yesyesand",
    "zipzapzop": "zipzapzop",
    "onewordstory": "onewordstory",
    "harolds": "harold",
    "theharold": "harold",
    "scenepainting": "scenepainting",
    "tagout": "tagout",
    "sweepedit": "sweepedit",
    "monoscene": "themonoscene",
    "themonoscene": "themonoscene",
    "passtheclap": "passclap",
    "passclap": "passclap",
    "themovie": "movie",
    "movie": "movie",
    "threelinescenes": "3linegame",
    "redball": "redball",
    "thedocumentary": "documentary",
    "whatareyoudoing": "whatareyoudoing",
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
        for syn in re.split(r"[|,;/]", str(row.get("synonyms") or "")):
            syn_key = norm_name(syn)
            if syn_key and syn_key not in out:
                out[syn_key] = row
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


def title_variants(title: str) -> list[str]:
    raw = (title or "").strip()
    out = [raw]
    stripped = re.sub(r"\s*\([^)]*\)\s*", " ", raw).strip()
    if stripped and stripped not in out:
        out.append(stripped)
    if stripped.lower().startswith("the "):
        out.append(stripped[4:])
    else:
        out.append(f"The {stripped}")
    return out


def find_exact(item: dict, by_norm: dict[str, dict]) -> tuple[dict | None, str]:
    names = title_variants(item["title"])
    keys = [norm_name(n) for n in names if n]
    for key in keys:
        if key in by_norm:
            return by_norm[key], f"exact:{key}"
        alias = ALIASES.get(key)
        if alias and alias in by_norm:
            return by_norm[alias], f"alias:{key}->{alias}"
    return None, ""


def find_match(item: dict, by_norm: dict[str, dict], allow_fuzzy: bool = True) -> tuple[dict | None, str]:
    match, via = find_exact(item, by_norm)
    if match:
        return match, via
    if not allow_fuzzy:
        return None, ""
    names = title_variants(item["title"])
    keys = [norm_name(n) for n in names if n]
    fuzzy, score, how = best_fuzzy(keys[0] if keys else "", item["title"], by_norm)
    other_name = (fuzzy or {}).get("name") or (fuzzy or {}).get("term") or ""
    overlap = 0.0
    title_tokens = tokens(item["title"])
    other_tokens = tokens(other_name)
    if title_tokens and other_tokens:
        overlap = len(title_tokens & other_tokens) / len(title_tokens | other_tokens)
    if fuzzy and score >= 0.9 and overlap >= 0.4:
        return fuzzy, f"fuzzy:{score:.2f}:{how}"
    return None, ""


def main() -> None:
    snap = load_snapshot()
    games = json.loads((IRC / "irc-games.json").read_text(encoding="utf-8"))
    terms = json.loads((IRC / "irc-terms.json").read_text(encoding="utf-8"))
    games_by = index_items(snap.get("games") or [], "name")
    terms_by = index_items(snap.get("terms") or [], "term")

    rows = []
    for item in games + terms:
        kind = item["kind"]
        primary = games_by if kind == "game" else terms_by
        other = terms_by if kind == "game" else games_by
        match, via = find_match(item, primary)
        matched_kind = kind
        if not match:
            match, via = find_match(item, other, allow_fuzzy=False)
            if match:
                matched_kind = "term" if kind == "game" else "game"
        if match:
            status = "existing"
            action = "cite+opening" if item.get("opening") else "cite"
            rows.append({
                "kind": matched_kind,
                "status": status,
                "via": via,
                "slug": item["slug"],
                "title": item["title"],
                "id": match.get("id"),
                "name": match.get("name") or match.get("term"),
                "opening": item.get("opening"),
                "url": item["url"],
                "action": action,
            })
        else:
            rows.append({
                "kind": kind,
                "status": "new",
                "via": "",
                "slug": item["slug"],
                "title": item["title"],
                "id": f"irc-{item['slug']}",
                "name": item["title"],
                "opening": item.get("opening"),
                "url": item["url"],
                "action": "import",
                "jamCategory": item.get("jamCategory"),
            })

    extra_openings = []
    opening_ids = {row["id"] for row in rows if row.get("opening") and row.get("status") == "existing"}
    for game in snap.get("games") or []:
        name = game.get("name") or ""
        key = norm_name(name)
        tags = str(game.get("tags") or "") + " " + str(game.get("category") or "")
        looks_opening = "opening" in key or "opening" in tags.lower() or key in {
            "patterngame", "invocation", "organicopening", "scenepainting",
            "doubleopening", "goonriver", "atoc", "monologue",
        }
        if looks_opening and game.get("id") not in opening_ids:
            extra_openings.append({
                "kind": "game",
                "status": "existing",
                "via": "catalog-opening",
                "slug": "",
                "title": name,
                "id": game.get("id"),
                "name": name,
                "opening": True,
                "url": "",
                "action": "opening-only",
            })

    all_rows = rows + extra_openings
    summary = {
        "snapshotGames": len(snap.get("games") or []),
        "snapshotTerms": len(snap.get("terms") or []),
        "ircGames": len(games),
        "ircTerms": len(terms),
        "existing": sum(1 for r in rows if r["status"] == "existing"),
        "new": sum(1 for r in rows if r["status"] == "new"),
        "extraOpenings": len(extra_openings),
    }
    (OUT / "match-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    (OUT / "review-matches.json").write_text(json.dumps(all_rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    csv_path = OUT / "review-matches.csv"
    fields = ["kind", "status", "action", "via", "slug", "title", "id", "name", "opening", "url", "jamCategory"]
    with csv_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(all_rows)
    print(json.dumps(summary, indent=2))
    print(f"review csv: {csv_path} ({len(all_rows)} rows)")


if __name__ == "__main__":
    main()
