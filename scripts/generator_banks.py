"""Merge all generator banks onto unique rows with multi-category tags."""
from __future__ import annotations

import html
import re

from extra_suggestion_lists import (
    ACTIVITIES_EXTRA,
    ADJECTIVES,
    ANIMALS,
    CHARACTERS,
    COMPANIES,
    FAMOUS,
    GENRES,
    NOUNS,
    SCENES,
    SHAPES,
    SONGS,
    STORY_TITLES,
    VERBS,
    WORDS,
)
from locations import locations
from user_suggestion_lists import ACTIONS, EMOTIONS, INSTRUCTIONS, JOBS, OBJECTS, RELATIONSHIPS

TYPOS = {
    "Aggitated": "Agitated",
    "Apaty": "Apathy",
    "Invincable": "Invincible",
    "complement": "compliment",
}


def slug(name: str) -> str:
    s = name.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "item"


def clean_text(text: str) -> str:
    text = html.unescape(str(text or "")).replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text).strip(" ,.")
    for bad, good in TYPOS.items():
        text = re.sub(re.escape(bad), good, text, flags=re.I)
    if text:
        text = text[0].upper() + text[1:] if len(text) > 1 else text.upper()
    return text


def key(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def pretty_token(token: str) -> str:
    token = token.replace("-", " ").strip()
    if not token:
        return token
    if token.lower() in {"gps", "hq", "irs", "pta's", "dmv", "bbc", "cnn", "npr", "pbs", "hbo", "nasa", "ibm"}:
        return token.upper()
    return token[0].upper() + token[1:]


class BankBuilder:
    def __init__(self) -> None:
        self.rows: dict[str, dict] = {}

    def add(self, text: str, *categories: str, extra: str = "") -> None:
        text = clean_text(text)
        extra = clean_text(extra) if extra else ""
        if not text or len(text) < 2:
            return
        k = key(text)
        if not k:
            return
        cats = {c for c in categories if c}
        if k in self.rows:
            self.rows[k]["cat_set"].update(cats)
            if extra and not self.rows[k]["extra"]:
                self.rows[k]["extra"] = extra
            return
        self.rows[k] = {"text": text, "extra": extra, "cat_set": set(cats)}

    def add_all(self, items, *categories: str) -> None:
        for item in items:
            if isinstance(item, dict):
                self.add(item.get("text") or item.get("name") or "", *categories, extra=item.get("extra") or item.get("description") or "")
            else:
                self.add(str(item), *categories)

    def export(self) -> list[dict]:
        out = []
        for i, row in enumerate(sorted(self.rows.values(), key=lambda r: r["text"].lower()), start=1):
            cats = sorted(row["cat_set"])
            out.append(
                {
                    "id": f"gen-{i:04d}",
                    "categories": ", ".join(cats),
                    "category": cats[0] if cats else "",
                    "text": row["text"],
                    "extra": row["extra"],
                }
            )
        return out


def build_generator_rows(prompts: dict | None = None) -> list[dict]:
    b = BankBuilder()
    prompts = prompts or {}

    b.add_all(INSTRUCTIONS, "Instructions")
    b.add_all(EMOTIONS, "Emotions", "Adjectives")
    b.add_all(ACTIONS, "Activities")
    b.add_all(ACTIVITIES_EXTRA, "Activities")
    b.add_all(RELATIONSHIPS, "Relationships")
    b.add_all(JOBS, "Jobs")
    b.add_all(OBJECTS, "Objects", "Nouns")
    b.add_all(locations(), "Locations")
    b.add_all([pretty_token(x) for x in ANIMALS], "Animals", "Nouns")
    b.add_all([pretty_token(x) for x in ADJECTIVES], "Adjectives")
    b.add_all([pretty_token(x) for x in VERBS], "Verbs")
    b.add_all([pretty_token(x) for x in NOUNS], "Nouns")
    b.add_all([pretty_token(x) for x in WORDS], "Words")
    b.add_all([pretty_token(x) for x in GENRES], "Genres")
    b.add_all(FAMOUS, "Famous", "Characters")
    b.add_all(COMPANIES, "Companies")
    b.add_all(SONGS, "Songs")
    b.add_all(STORY_TITLES, "Story Titles")
    b.add_all([pretty_token(x) for x in SHAPES], "Shapes")
    b.add_all(CHARACTERS, "Characters")
    b.add_all(SCENES, "Scenes")

    core = prompts.get("core") or {}
    b.add_all(core.get("characters") or [], "Characters")
    b.add_all(core.get("objectives") or [], "Objectives", "Activities")
    b.add_all(core.get("relationships") or [], "Relationships")
    b.add_all(core.get("environments") or [], "Locations")
    sug = prompts.get("suggestions") or {}
    b.add_all(sug.get("locations") or [], "Locations")
    b.add_all(sug.get("objects") or [], "Objects", "Nouns")
    b.add_all(sug.get("occupations") or [], "Jobs")
    b.add_all(sug.get("relationships") or [], "Relationships")
    b.add_all(prompts.get("lines") or [], "Lines", "Words")
    b.add_all(prompts.get("twoPerson") or [], "Scenes")
    for style in prompts.get("playStyles") or []:
        b.add(style.get("name") or "", "PlayStyle", extra=style.get("description") or "")
    for fut in prompts.get("fut") or []:
        b.add(fut.get("reality") or "", "FUT", "Scenes", extra=fut.get("weirdThing") or "")

    for job in JOBS:
        b.add(f"World's worst {job.lower()}", "Scenes")

    return b.export()
