#!/usr/bin/env python3
"""Turn IRC wiki wikitext into rehearsal records. Does not write the sheet."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "scripts" / "data" / "ircwiki" / "raw"
OUT = ROOT / "scripts" / "data" / "ircwiki"

SKIP_TITLES = {
    "list of short form games",
    "shortform",
    "improv jam",
    "improv coach",
}
SKIP_TITLE_RE = re.compile(r"\b(dick|fuck|shit|porn|nsfw)\b", re.I)
STUB_RE = re.compile(r"\{\{\s*stub\s*\}\}", re.I)
REDIRECT_RE = re.compile(r"^#redirect\s*:?\s*\[\[([^\]]+)\]\]", re.I)


def slugify(text: str) -> str:
    s = (text or "").lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "item"


def wiki_lines(raw: str) -> str:
    text = raw or ""
    text = REDIRECT_RE.sub("", text)
    text = re.sub(r"\{\{[^{}]*\}\}", " ", text)
    text = re.sub(r"\{\{[^{}]*\}\}", " ", text)
    text = re.sub(r"\[\[(?:File|Image|Category):[^\]]*\]\]", "\n", text, flags=re.I)
    text = re.sub(r"\[\[[^\]|]*\|([^\]]+)\]\]", r"\1", text)
    text = re.sub(r"\[\[([^\]]+)\]\]", r"\1", text)
    text = re.sub(r"\[https?://[^\s\]]+\s+([^\]]+)\]", r"\1", text)
    text = re.sub(r"'{2,}", "", text)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</p>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"^[#*;]+\s*", "", text, flags=re.M)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


HEADING_MAP = {
    "form": "howToPlay",
    "structure": "howToPlay",
    "format": "howToPlay",
    "how to play": "howToPlay",
    "how it works": "howToPlay",
    "gameplay": "howToPlay",
    "the game": "howToPlay",
    "rules": "howToPlay",
    "play": "howToPlay",
    "warmup": "howToPlay",
    "warm-up": "howToPlay",
    "warm up": "howToPlay",
    "exercise": "howToPlay",
    "frequent incarnations": "howToPlay",
    "example": "howToPlay",
    "examples": "howToPlay",
    "setup": "setup",
    "setting": "setup",
    "set up": "setup",
    "purpose": "gimmicks",
    "tips": "gimmicks",
    "notes": "gimmicks",
    "gimmicks": "gimmicks",
    "gimmick": "gimmicks",
    "teaching": "gimmicks",
    "variations": "variations",
    "variation": "variations",
    "variants": "variations",
}

SKIP_HEADINGS = {
    "see also",
    "external links",
    "references",
    "popular uses",
    "music and dress",
    "history",
    "etymology",
    "cast",
    "rosters",
    "links",
}


def split_sections(wikitext: str) -> list[tuple[str, str]]:
    text = wikitext or ""
    text = re.sub(r"^[=]{2,}\s*(.*?)\s*[=]{2,}\s*$", r"\n==\1==\n", text, flags=re.M)
    parts = re.split(r"\n==+\s*(.*?)\s*==+\n", text)
    sections = [("description", parts[0] if parts else "")]
    for i in range(1, len(parts), 2):
        heading = re.sub(r"[=]+", "", parts[i] or "").strip().lower()
        body = parts[i + 1] if i + 1 < len(parts) else ""
        sections.append((heading, body))
    return sections


def clip(text: str, limit: int) -> str:
    out = re.sub(r"\s+", " ", (text or "").strip())
    if len(out) <= limit:
        return out
    cut = out[:limit].rsplit(" ", 1)[0]
    return cut.rstrip(" ,;:") + "…"


def bullets_or_text(text: str) -> str:
    lines = [ln.strip(" -*") for ln in (text or "").splitlines() if ln.strip()]
    if len(lines) >= 2:
        return "\n".join(f"• {ln}" if not ln.startswith("•") else ln for ln in lines)
    return " ".join(lines)


def is_weak_lead(text: str) -> bool:
    low = text.lower().strip()
    return low.startswith("for the ") or low.startswith("this page ") or "of the same name" in low


def rehearsal_fields(wikitext: str) -> dict[str, str]:
    buckets = {"description": [], "setup": [], "howToPlay": [], "gimmicks": [], "variations": []}
    for heading, body in split_sections(wikitext):
        plain = wiki_lines(body)
        if not plain:
            continue
        if heading in SKIP_HEADINGS:
            continue
        key = HEADING_MAP.get(heading, "description" if heading == "description" else "howToPlay")
        if heading == "description":
            key = "description"
        buckets[key].append(plain)

    lead = wiki_lines("\n\n".join(buckets["description"]))
    paras = [p.strip() for p in re.split(r"\n\s*\n", lead) if p.strip()]
    if paras and is_weak_lead(paras[0]) and len(paras) > 1:
        paras = paras[1:]
    description = clip(" ".join(paras[:2]), 700)
    sentences = re.split(r"(?<=[.!?])\s+", description)
    if sentences and is_weak_lead(sentences[0]) and len(sentences) > 1:
        description = clip(" ".join(sentences[1:]), 700)
    how = bullets_or_text("\n\n".join(buckets["howToPlay"]))
    if not how and len(paras) > 1:
        how = clip(" ".join(paras[1:4]), 1200)
    if not how:
        how = clip(lead, 900)
    return {
        "description": description,
        "setup": clip(wiki_lines("\n".join(buckets["setup"])), 500),
        "howToPlay": clip(how, 1400),
        "gimmicks": clip(wiki_lines("\n".join(buckets["gimmicks"])), 500),
        "variations": clip(wiki_lines("\n".join(buckets["variations"])), 500),
        "definition": clip(lead or how, 900),
    }


def first_sentences(text: str, limit: int = 2) -> str:
    parts = re.split(r"(?<=[.!?])\s+", text)
    kept = []
    for part in parts:
        if len(part) < 8:
            continue
        kept.append(part)
        if len(kept) >= limit:
            break
    out = " ".join(kept).strip()
    if len(out) > 420:
        out = out[:417].rsplit(" ", 1)[0] + "…"
    return out


def kind_for(cats: set[str]) -> str:
    if "Category:Improv Forms" in cats or "Category:Warm Ups" in cats or "Category:Openings" in cats:
        return "game"
    if "Category:Concepts" in cats:
        return "term"
    return "skip"


def jam_category(cats: set[str]) -> str:
    if "Category:Warm Ups" in cats:
        return "Warm-Up"
    if "Category:Improv Forms" in cats:
        return "Long Form"
    if "Category:Openings" in cats:
        return "Long Form"
    return "Encyclopedia"


def term_category(title: str) -> str:
    lower = title.lower()
    if lower in {"edit", "sweep edit", "tag-out", "cut-to", "blackout (concept)", "button"}:
        return "Editing Moves"
    if lower in {"yes and", "offers", "matching", "heightening", "justification", "initiation"}:
        return "Essentials"
    if lower in {"steamrolling", "denial", "talking heads", "transaction scene"}:
        return "Pitfalls"
    if lower in {"walk-on", "sideline", "backline"}:
        return "Support Moves"
    return "Encyclopedia"


def should_skip(title: str, wikitext: str) -> str:
    key = title.strip().lower()
    if key in SKIP_TITLES:
        return "index"
    if SKIP_TITLE_RE.search(title):
        return "nsfw"
    if REDIRECT_RE.match((wikitext or "").lstrip()):
        return "redirect"
    plain = wiki_lines(wikitext)
    if STUB_RE.search(wikitext or "") and len(plain) < 80:
        return "stub"
    if len(plain) < 40:
        return "thin"
    return ""


def main() -> None:
    payload = json.loads((RAW / "pages.json").read_text(encoding="utf-8"))
    cat_map = payload.get("categories") or {}
    title_cats: dict[str, set[str]] = {}
    for cat, titles in cat_map.items():
        for title in titles:
            title_cats.setdefault(title, set()).add(cat)

    games = []
    terms = []
    skipped = []
    pages = payload.get("pages") or {}
    seen_titles: set[str] = set()
    for asked, page in pages.items():
        title = page.get("title") or asked
        title_key = title.strip().lower()
        if title_key in seen_titles:
            continue
        seen_titles.add(title_key)
        wikitext = page.get("wikitext") or ""
        cats = set()
        for name in {asked, title, page.get("redirectedFrom") or ""}:
            cats |= title_cats.get(name) or set()
        reason = should_skip(title, wikitext)
        if reason:
            skipped.append({"title": title, "reason": reason})
            continue
        kind = kind_for(cats)
        if kind == "skip":
            skipped.append({"title": title, "reason": "uncategorized"})
            continue
        plain = wiki_lines(wikitext)
        fields = rehearsal_fields(wikitext)
        extract = fields["description"] or first_sentences(plain, 4)
        url = page.get("fullurl") or f"https://wiki.improvresourcecenter.com/index.php?title={title.replace(' ', '_')}"
        record = {
            "slug": slugify(title),
            "title": title,
            "url": url,
            "wikiCategories": sorted(cats),
            "opening": "Category:Openings" in cats,
            "extract": extract,
            "description": fields["description"] or extract,
            "setup": fields["setup"],
            "howToPlay": fields["howToPlay"],
            "gimmicks": fields["gimmicks"],
            "variations": fields["variations"],
            "definition": fields["definition"] or extract,
            "plainLength": len(plain),
            "sourceId": "src-irc-wiki",
        }
        if kind == "game":
            record["kind"] = "game"
            record["jamCategory"] = jam_category(cats)
            games.append(record)
        else:
            record["kind"] = "term"
            record["jamCategory"] = term_category(title)
            terms.append(record)

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "irc-games.json").write_text(json.dumps(games, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (OUT / "irc-terms.json").write_text(json.dumps(terms, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (OUT / "irc-skipped.json").write_text(json.dumps(skipped, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"games={len(games)} terms={len(terms)} skipped={len(skipped)}")


if __name__ == "__main__":
    main()
