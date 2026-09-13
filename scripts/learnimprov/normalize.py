#!/usr/bin/env python3
"""Turn Learn Improv WP HTML into structured games and terms. Does not write the sheet."""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "scripts" / "data" / "learnimprov" / "raw"
OUT = ROOT / "scripts" / "data" / "learnimprov"

SKIP_SLUGS = {"blog"}
GAME_CATS = {"warm-up", "handle", "long-form", "exercise"}
TERM_CATS = {"problem", "solving", "ask-for"}
DEPRECATED = "deprecated"

SECTION_MAP = {
    "synonyms": "synonyms",
    "synonym": "synonyms",
    "introduction": "introduction",
    "ask-for": "introduction",
    "ask for": "introduction",
    "description": "description",
    "setting up": "setup",
    "setup": "setup",
    "setting up a harold": "setup",
    "how to play": "howToPlay",
    "how it is played": "howToPlay",
    "the most common format": "howToPlay",
    "format": "howToPlay",
    "gimmicks": "gimmicks",
    "gimmick": "gimmicks",
    "variations": "variations",
    "variation": "variations",
    "credits": "credits",
    "credit": "credits",
    "see also": "related",
    "related": "related",
}


def slugify(text: str) -> str:
    s = html.unescape(text).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "item"


def strip_tags(raw: str) -> str:
    text = html.unescape(raw or "")
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</p>", "\n", text, flags=re.I)
    text = re.sub(r"<li[^>]*>", "• ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return re.sub(r"[ \t]+", " ", text).strip()


def parse_sections(content_html: str) -> dict[str, str]:
    text = content_html or ""
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</p>", "\n", text)
    text = re.sub(r"(?i)<p[^>]*>", "\n", text)
    text = re.sub(r"(?i)<h[1-4][^>]*>(.*?)</h[1-4]>", r"\n\1\n", text)
    text = re.sub(r"(?i)<strong[^>]*>(.*?)</strong>", r"\n\1\n", text)
    text = strip_tags(text)
    sections: dict[str, list[str]] = {}
    current = "description"
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        key = SECTION_MAP.get(line.lower().rstrip(":"))
        if key and len(line) < 48:
            current = key
            continue
        sections.setdefault(current, []).append(line)
    return {k: "\n".join(v).strip() for k, v in sections.items() if v}


def related_slugs(content_html: str) -> list[str]:
    found = []
    for href in re.findall(r'href="(https?://(?:www\.)?learnimprov\.com/[^"]+)"', content_html or ""):
        path = re.sub(r"https?://(?:www\.)?learnimprov\.com/", "", href).strip("/")
        slug = path.split("/")[0]
        if slug and slug not in {"category", "tag", "about", "wp-content"}:
            found.append(slug)
    return sorted(set(found))


def cat_slugs(post: dict, id_to_slug: dict[int, str]) -> list[str]:
    return [id_to_slug[i] for i in post.get("categories") or [] if i in id_to_slug]


def jam_category(slugs: list[str]) -> str:
    if "long-form" in slugs:
        return "Long Form"
    if "handle" in slugs:
        return "Short Form"
    if "warm-up" in slugs:
        return "Warm-Up"
    if "exercise" in slugs:
        return "Exercise"
    if "ask-for" in slugs:
        return "Ask-for"
    return "Short Form"


def is_game(slugs: list[str]) -> bool:
    return any(s in GAME_CATS for s in slugs)


def is_term(slugs: list[str]) -> bool:
    if is_game(slugs):
        return False
    return any(s in TERM_CATS or s == "problem" for s in slugs) or not slugs


def main() -> None:
    posts = json.loads((RAW / "posts.json").read_text(encoding="utf-8"))
    cats = json.loads((RAW / "categories.json").read_text(encoding="utf-8"))
    id_to_slug = {c["id"]: c["slug"] for c in cats}
    id_to_name = {c["id"]: c["name"] for c in cats}

    games = []
    terms = []
    skipped = []
    for post in posts:
        slugs = cat_slugs(post, id_to_slug)
        slug = post.get("slug") or slugify(post.get("title", {}).get("rendered") or "")
        title = strip_tags(post.get("title", {}).get("rendered") or slug)
        url = post.get("link") or f"https://www.learnimprov.com/{slug}/"
        html_body = post.get("content", {}).get("rendered") or ""
        sections = parse_sections(html_body)
        deprecated = DEPRECATED in slugs
        if "blog" in slugs and not is_game(slugs):
            skipped.append({"slug": slug, "reason": "blog"})
            continue
        record = {
            "slug": slug,
            "title": title,
            "url": url,
            "categories": [id_to_name[i] for i in post.get("categories") or [] if i in id_to_name],
            "categorySlugs": slugs,
            "synonyms": [s.strip() for s in re.split(r"[,;/]|\n", sections.get("synonyms") or "") if s.strip()],
            "introduction": sections.get("introduction") or "",
            "description": sections.get("description") or strip_tags(html_body)[:1200],
            "setup": sections.get("setup") or "",
            "howToPlay": sections.get("howToPlay") or "",
            "gimmicks": sections.get("gimmicks") or "",
            "variations": [s.strip(" •") for s in re.split(r"\n+", sections.get("variations") or "") if s.strip()],
            "credits": sections.get("credits") or "",
            "relatedSlugs": related_slugs(html_body),
            "deprecated": deprecated,
            "license": "CC BY-SA 4.0",
            "sourceId": "src-learnimprov",
        }
        if is_game(slugs):
            record["jamCategory"] = jam_category(slugs)
            games.append(record)
        elif is_term(slugs) or slug in {"lace", "steps", "triangle", "accepting"}:
            record["jamCategory"] = "Encyclopedia"
            terms.append(record)
        else:
            skipped.append({"slug": slug, "reason": ",".join(slugs) or "uncategorized"})

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "li-games.json").write_text(json.dumps(games, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (OUT / "li-terms.json").write_text(json.dumps(terms, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (OUT / "li-skipped.json").write_text(json.dumps(skipped, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"games={len(games)} terms={len(terms)} skipped={len(skipped)}")


if __name__ == "__main__":
    main()
