#!/usr/bin/env python3
"""Turn IRC wiki matches into merge-safe sheet patches. Does not write the sheet."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "scripts" / "data" / "ircwiki"
GS = ROOT / "apps-script" / "IrcWikiPatches.gs"

SOURCE = {
    "id": "src-irc-wiki",
    "name": "IRC Improv Wiki",
    "url": "https://wiki.improvresourcecenter.com/",
    "note": "GFDL 1.2 / CC BY-SA 3.0. Rehearsal cards are adapted from https://wiki.improvresourcecenter.com/ with attribution.",
}

BLURBS = {
    "a-to-c": "Association opening. Start at the suggestion, then jump ideas that are only loosely related until the room is somewhere new. Use those distant ideas to start the set.",
    "a-to-c-exercise": "Circle association. One player says a word; the next says something related to that, not the original. Keep moving away from the start.",
    "answering-machine": "Opening. Players leave overlapping answering-machine messages inspired by the suggestion, then tap those messages for scenes.",
    "apocalypse": "Two-half long form: an Eventé that ends the world, then a monoscene in the aftermath.",
    "pattern-game": "Classic verbal opening. Riff on the suggestion in a circle, find repeating patterns and unusual ideas, then edit into scenes.",
    "organic-opening": "No preset game. The group discovers an opening together from the suggestion — sound, movement, or talk — then uses that discovery to start scenes.",
    "documentary-opening": "Interview-style opening: players talk to an unseen camera about the suggestion, then those interviews feed the set.",
    "evente": "Long-form built from a single originating event. Explore the people and places around that event rather than jumping to new premises.",
    "the-movie": "Improvised movie: disjointed situations inspired by the suggestion that converge by the end.",
    "the-documentary": "Long-form with interviews, narration, and scenes, as if shooting a documentary about the suggestion.",
    "form-2": "Paint a vivid still image from a location suggestion, then play scenes that lead up to recreating that picture.",
    "monologue-deconstruction": "One or more monologues, then scenes that pull apart the ideas inside them.",
    "count-to-20": "Group counts to 20. Anyone may say the next number; if two people speak at once, start over.",
    "categories": "Circle. A category is called (breakfast cereals, cities). Players fire examples without repeating or breaking rhythm.",
    "fortunately-unfortunately": "Two (or more) voices tell one story, alternating Fortunately… / Unfortunately…",
    "follow-the-follower": "No one leads. Mirror the group’s movement and sound until the room is one organism.",
    "pass-the-phrace": "Pass a made-up phrase around the circle, keeping the sound even as it mutates.",
    "seven-things": "Point at a player: they must name seven things in a category before the group counts them out.",
    "superheroes": "Warm-up or handle: endow each other with ridiculous superhero names and powers, then justify them.",
    "time-warp": "Replay or jump the same beat at a different speed or era on a call.",
    "shopkeeper": "Opening or scene: a shopkeeper and customers riff on the suggestion as inventory and requests.",
    "midnight-society": "Campfire / secret-society opening that frames the set as a story being told.",
    "flow-loko": "Musical or rhythmic opening that keeps a groove while ideas pile on.",
    "goon-river": "Word-at-a-time or poetic opening that builds a shared spoken texture from the suggestion.",
    "the-bat": "Harold (or similar) performed in the dark, like a radio play.",
    "armando": "Monologist takes a suggestion, tells a true-ish story; scenes inspired by that story follow.",
    "base-reality": "The ordinary who/what/where of a scene before the unusual thing arrives.",
    "justification": "Making a strange choice make sense in the world you already built.",
    "matching": "Doing the same energy, activity, or point of view as your partner instead of opposing it.",
    "offers": "Anything you say or do that the scene can treat as real.",
    "premise": "A tight comic idea — unusual thing plus who it happens to — that a scene can play.",
    "steamrolling": "Overriding your partner’s offers so the scene becomes a solo. Don’t.",
    "suggestion": "The audience gift that starts a scene or set. Use it; don’t illustrate it for its own sake.",
    "walk-on": "A brief extra character who enters, makes one strong offer, and leaves.",
    "button": "The small tag or blackout that ends a scene on the laugh or the game.",
    "group-game": "A group scene inside a Harold (or similar) that plays a game inspired by the opening, not a fourth plot.",
    "top-of-intelligence": "Play the reality as smartly as you actually understand it. Don’t dummy down.",
    "voice-of-reason": "The grounded player who treats the unusual thing as real and tries to live with it.",
    "string-of-pearls": "Narrative drill: fill in the missing beats of a story between a beginning and an end.",
    "who": "Who you are to each other. Name the relationship early.",
    "where": "Where you are. See it and use it.",
    "what": "What you are doing. Play the activity, not a topic.",
}


def jam_description(item: dict) -> str:
    slug = item.get("slug") or ""
    if slug in BLURBS:
        return BLURBS[slug]
    return (item.get("description") or item.get("extract") or "").strip()


def jam_definition(item: dict) -> str:
    slug = item.get("slug") or ""
    if slug in BLURBS:
        return BLURBS[slug]
    return (item.get("definition") or item.get("description") or item.get("extract") or "").strip()


def pipe_variations(text: str) -> str:
    raw = (text or "").strip()
    if not raw:
        return ""
    parts = [
        p.strip(" •-")
        for p in re.split(r"[\n;]|•", raw)
        if p.strip(" •-") and len(p.strip(" •-")) > 12 and "who is gay" not in p.lower()
    ]
    return "|".join(parts[:8])


def main() -> None:
    games = {row["slug"]: row for row in json.loads((OUT / "irc-games.json").read_text(encoding="utf-8"))}
    terms = {row["slug"]: row for row in json.loads((OUT / "irc-terms.json").read_text(encoding="utf-8"))}
    reviews = json.loads((OUT / "review-matches.json").read_text(encoding="utf-8"))
    patches = []
    seen_ids = set()

    for row in reviews:
        action = row.get("action") or ""
        slug = row.get("slug") or ""
        src = games.get(slug) or terms.get(slug) or {}
        opening = bool(row.get("opening") or src.get("opening"))
        kind = row.get("kind") or src.get("kind") or "game"
        tab = "Terms" if kind == "term" else "Games"
        item_id = row.get("id")
        if not item_id or item_id in seen_ids:
            continue
        seen_ids.add(item_id)

        patch = {"tab": tab, "id": item_id}
        if opening and tab == "Games":
            patch["category"] = "Opening"
            patch["tags"] = "Opening"
        if action == "opening-only":
            patches.append(patch)
            continue

        url = row.get("url") or src.get("url") or ""
        if url:
            patch["sourceIds"] = SOURCE["id"]
            patch["sourceUrl"] = url

        if row.get("status") == "new":
            patch["create"] = True
            patch["replacePlaceholder"] = True
            if tab == "Games":
                cats = [src.get("jamCategory") or "Long Form"]
                if opening and "Opening" not in cats:
                    cats.append("Opening")
                patch["name"] = src.get("title") or row.get("title")
                patch["category"] = "|".join(cats)
                tags = ["Opening"] if opening else []
                if src.get("jamCategory") == "Warm-Up":
                    tags.append("Warm-Up")
                patch["tags"] = "|".join(dict.fromkeys(tags)) if tags else ""
                patch["description"] = jam_description({**src, "kind": "game", "opening": opening})
                if src.get("setup"):
                    patch["setup"] = src["setup"]
                if src.get("howToPlay"):
                    patch["howToPlay"] = src["howToPlay"]
                if src.get("gimmicks"):
                    patch["gimmicks"] = src["gimmicks"]
                variations = pipe_variations(src.get("variations") or "")
                if variations:
                    patch["variations"] = variations
                patch["source"] = SOURCE["name"]
            else:
                patch["term"] = src.get("title") or row.get("title")
                patch["category"] = src.get("jamCategory") or "Encyclopedia"
                patch["definition"] = jam_definition({**src, "kind": "term"})

        patches.append(patch)

    payload = {"source": SOURCE, "patches": patches}
    (OUT / "accepted-merges.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    gs = "var IRC_WIKI_SOURCE = " + json.dumps(SOURCE, ensure_ascii=False) + ";\n"
    gs += "var IRC_WIKI_PATCHES = " + json.dumps(patches, ensure_ascii=False) + ";\n"
    GS.write_text(gs, encoding="utf-8")
    created = sum(1 for p in patches if p.get("create"))
    print(f"patches={len(patches)} created={created} wrote {OUT / 'accepted-merges.json'} and {GS}")


if __name__ == "__main__":
    main()
