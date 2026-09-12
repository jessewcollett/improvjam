#!/usr/bin/env python3
"""Build structured catalog JSON from Improv Encyclopedia extract + jam terms."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from generator_banks import build_generator_rows
EXTRACT = ROOT / "book-extract.txt"
OUT = ROOT / "src" / "data" / "mockData.json"

KNOWN_CATS = {
    "Accepting",
    "Association",
    "Audience",
    "Participation",
    "Characters",
    "Concentration",
    "Continuation",
    "Die",
    "Energy",
    "Exercise",
    "Format",
    "Group",
    "Guessing",
    "Introduction",
    "Limitations",
    "Long Form",
    "Look and Listen",
    "Narration",
    "Performance",
    "SingSong",
    "Spontaneity",
    "Storytelling",
    "Trust",
    "Verbal wit",
    "Warm-up",
    "Warm-Up",
}

# Multi-word categories that get split across lines in the PDF
JOIN_CATS = {
    ("Look and", "Listen"): "Look and Listen",
    ("Long", "Form"): "Long Form",
    ("Verbal", "wit"): "Verbal wit",
    ("Audience", "Participation"): "Audience Participation",
}

JAM_MAP = {
    "Warm-up": "Warm-Up",
    "Warm-Up": "Warm-Up",
    "Exercise": "Warm-Up",
    "Introduction": "Warm-Up",
    "Concentration": "Warm-Up",
    "Energy": "Warm-Up",
    "Association": "Idea Generators",
    "Spontaneity": "Warm-Up",
    "Group": "Warm-Up",
    "Trust": "Warm-Up",
    "Verbal wit": "Line Games",
    "Die": "Line Games",
    "Guessing": "Endowment",
    "Long Form": "Long Form",
    "Format": "Long Form",
    "Continuation": "Long Form",
    "Storytelling": "Long Form",
    "Performance": "Short Form",
    "Limitations": "Short Form",
    "Characters": "Endowment",
    "Narration": "Line Games",
    "SingSong": "Short Form",
    "Audience Participation": "Short Form",
    "Accepting": "Warm-Up",
    "Look and Listen": "Warm-Up",
}


def slug(name: str) -> str:
    s = name.lower().strip()
    s = s.replace("&", "and")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "item"


def norm_name(name: str) -> str:
    s = name.lower()
    s = s.replace("’", "'").replace("`", "'")
    s = re.sub(r"\(.*?\)", "", s)
    s = re.sub(r"[^a-z0-9]+", "", s)
    return s


def clean_text(text: str) -> str:
    text = re.sub(r"Improv Encyclopedia --.*?(?:page \d+)?", " ", text)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"([A-Za-z])G\b", r"\1", text)
    text = re.sub(r"([A-Za-z])K\b", r"\1", text)
    text = re.sub(r"([A-Za-z])C\b", r"\1", text)
    text = re.sub(r"([A-Za-z])R\b", r"\1", text)
    return text.strip()


def first_sentences(text: str, max_chars: int = 900) -> str:
    text = clean_text(text)
    if not text:
        return ""
    parts = re.split(r"(?<=[.!?])\s+", text)
    out = []
    for p in parts:
        if not p:
            continue
        out.append(p)
        joined = " ".join(out)
        if len(joined) >= 180:
            break
    joined = " ".join(out)
    if len(joined) > max_chars:
        cut = joined[: max_chars - 1]
        if " " in cut:
            cut = cut.rsplit(" ", 1)[0]
        joined = cut.rstrip(" ,;") + "…"
    return joined


def jam_category(tags: list[str]) -> str:
    priority = [
        "Warm-up",
        "Warm-Up",
        "Long Form",
        "Guessing",
        "Verbal wit",
        "Die",
        "Format",
        "Performance",
        "Exercise",
    ]
    for p in priority:
        if p in tags:
            return JAM_MAP.get(p, "Short Form")
    for t in tags:
        if t in JAM_MAP:
            return JAM_MAP[t]
    return "Short Form"


def parse_games(raw: str) -> list[dict]:
    start = raw.find("\nGames ")
    if start < 0:
        start = raw.find("\nGames\n")
    end = raw.find("\nKeywords ", start)
    if end < 0:
        end = raw.find("\nKeywords\n", start)
    chunk = raw[start:end]

    # Split on a title line followed by "Game"
    pattern = re.compile(
        r"^[ \t]*([A-Z0-9].+?)\s*\n\s*\n?Game\s*$",
        re.MULTILINE,
    )
    matches = list(pattern.finditer(chunk))
    games = []
    seen = set()

    for i, m in enumerate(matches):
        name = m.group(1).strip()
        name = re.sub(r"\s+", " ", name)
        if name in {"Game", "Notes", "Variations", "Origin", "Keywords"}:
            continue
        body = chunk[m.end() : matches[i + 1].start() if i + 1 < len(matches) else None]
        lines = [ln.strip() for ln in body.splitlines()]

        tags = []
        desc_lines = []
        note_lines = []
        in_desc = False
        in_notes = False
        for ln in lines:
            if not ln:
                if tags and not in_desc:
                    in_desc = True
                continue
            if ln.startswith("Improv Encyclopedia"):
                continue
            if ln in {"Variations", "Origin", "Tips"}:
                break
            if ln == "Notes":
                in_notes = True
                continue
            if not in_desc and not in_notes:
                if ln in KNOWN_CATS or ln in {
                    "Look and",
                    "Listen",
                    "Long",
                    "Form",
                    "Verbal",
                    "wit",
                    "Audience",
                    "Participation",
                }:
                    tags.append(ln)
                    continue
                in_desc = True
            if in_notes:
                note_lines.append(ln)
            else:
                desc_lines.append(ln)

        # join split category names
        joined = []
        skip = False
        for idx, t in enumerate(tags):
            if skip:
                skip = False
                continue
            nxt = tags[idx + 1] if idx + 1 < len(tags) else None
            if nxt and (t, nxt) in JOIN_CATS:
                joined.append(JOIN_CATS[(t, nxt)])
                skip = True
            elif t not in {"Look and", "Long", "Verbal", "Audience"}:
                joined.append(t)
        tags = [t for t in joined if t not in {"Game"}]

        desc = first_sentences(" ".join(desc_lines), 900)
        if note_lines:
            notes = first_sentences(" ".join(note_lines), 320)
            if notes:
                desc = f"{desc} Notes: {notes}".strip()
        if not desc or desc.lower().startswith("see "):
            continue
        key = norm_name(name)
        if key in seen:
            continue
        seen.add(key)
        games.append(
            {
                "id": f"ie-{slug(name)}",
                "name": name,
                "category": jam_category(tags),
                "tags": tags,
                "lifeSkills": [],
                "description": desc,
                "sourceIds": ["src-encyclopedia"],
                "source": "Improv Encyclopedia",
            }
        )
    return games


def parse_keywords(raw: str) -> list[dict]:
    start = raw.find("\nKeywords ")
    if start < 0:
        start = raw.find("\nKeywords\n")
    end = raw.find("\nReferences", start)
    chunk = raw[start:end] if end > 0 else raw[start:]

    pattern = re.compile(
        r"^[ \t]*([A-Z][A-Za-z0-9' /\-]+?)\s*\n\s*\n?Keyword\s*$",
        re.MULTILINE,
    )
    matches = list(pattern.finditer(chunk))
    terms = []
    skip_names = {
        "Ask-for Continued",
        "Commedia dell'Arte",
        "Commedia dell’Arte",
    }
    for i, m in enumerate(matches):
        name = re.sub(r"\s+", " ", m.group(1).strip())
        if name in skip_names:
            continue
        body = chunk[m.end() : matches[i + 1].start() if i + 1 < len(matches) else None]
        lines = []
        for ln in body.splitlines():
            ln = ln.strip()
            if not ln or ln.startswith("Improv Encyclopedia"):
                continue
            if ln == "Keyword":
                continue
            lines.append(ln)
        definition = first_sentences(" ".join(lines), 700)
        if not definition:
            continue
        terms.append(
            {
                "term": name,
                "category": "Encyclopedia",
                "definition": definition,
                "sourceIds": ["src-encyclopedia"],
            }
        )
    return terms


JAM_GAMES = [
    {
        "name": "3 Line Game",
        "category": "Warm-Up",
        "tags": ["Scene Work", "C.O.R.E."],
        "lifeSkills": ["Active Listening", "Decisiveness", "Establishing Context"],
        "description": "Rapid-fire scene setup. Player A: initiation. Player B: response. Player A: final line. Focus on establishing C.O.R.E. quickly.",
    },
    {
        "name": "7 Layers",
        "category": "Warm-Up",
        "tags": ["Character", "Object Work"],
        "lifeSkills": ["Observation", "Creativity"],
        "description": "Build a character or object through seven distinct traits, adding one layer at a time.",
    },
    {
        "name": "7 Things",
        "category": "Warm-Up",
        "tags": ["Word Association", "Focus"],
        "lifeSkills": ["Thinking on your feet", "Verbal Fluency"],
        "description": "Rapid naming and word-association: list seven things in a category as fast as you can.",
    },
    {
        "name": "A-C Connection",
        "category": "Idea Generators",
        "tags": ["Pattern", "Association"],
        "lifeSkills": ["Pattern Recognition", "Listening"],
        "description": "Pattern recognition: A implies B implies C. Practice connecting ideas in a chain.",
    },
    {
        "name": "Alien Tiger Cow",
        "category": "Warm-Up",
        "tags": ["Energy", "Focus", "Group Mind"],
        "lifeSkills": ["Non-verbal Communication", "Adaptability", "Team Alignment"],
        "description": "Everyone in a circle. Players can be Alien (antennas, \"bleeb bleeb\"), Cow (hands on tummy, \"moo\"), or Tiger (claws, \"roar\"). On 3, everyone picks one. Goal is for the whole group to sync.",
    },
    {
        "name": "Art Gallery",
        "category": "Warm-Up",
        "tags": ["Physical", "Tableau"],
        "lifeSkills": ["Physical Awareness", "Collaboration"],
        "description": "Physical statue and tableau game. Players become art pieces; others walk the gallery.",
    },
    {
        "name": "Because I Said So",
        "category": "Warm-Up",
        "tags": ["Justification", "Why"],
        "lifeSkills": ["Justification", "Commitment"],
        "description": "Improvisers ask a question, then keep answering \"why\" until someone ends it with \"because I said so.\"",
    },
    {
        "name": "Bunny Bunny",
        "category": "Warm-Up",
        "tags": ["Energy", "Rhythm"],
        "lifeSkills": ["Focus", "Presence", "Reflexes"],
        "description": "High-energy passing game. Middle player is the bunny (hands as paws); neighbors are ears. Pass focus with \"bunny bunny bunny.\"",
    },
    {
        "name": "Character of the Space",
        "category": "Warm-Up",
        "tags": ["Environment", "Character"],
        "lifeSkills": ["Environment Awareness", "Physicality"],
        "description": "Move through a space and let the environment dictate the character you become.",
    },
    {
        "name": "Counting",
        "category": "Warm-Up",
        "tags": ["Group Mind", "Focus"],
        "lifeSkills": ["Patience", "Group Awareness"],
        "description": "The group tries to count to 20 without two people talking at the same time.",
    },
    {
        "name": "Crazy 8s",
        "category": "Warm-Up",
        "tags": ["Energy", "Physical"],
        "lifeSkills": ["Physical Warm-up", "Energy"],
        "description": "Shake-out game on 8, 4, 2, then 1 counts per limb.",
    },
    {
        "name": "Electric Company",
        "category": "Warm-Up",
        "tags": ["Word at a Time", "Physical"],
        "lifeSkills": ["Group Mind", "Physical Commitment"],
        "description": "Word-at-a-time storytelling while acting out the \"current\" of the idea.",
    },
    {
        "name": "Environment",
        "category": "Warm-Up",
        "tags": ["Object Work", "Group"],
        "lifeSkills": ["Spatial Awareness", "Collaboration"],
        "description": "The group silently builds a shared environment through object work.",
    },
    {
        "name": "George",
        "category": "Warm-Up",
        "tags": ["Rhythm", "Names"],
        "lifeSkills": ["Rhythm", "Name Memory"],
        "description": "Rhythmic storytelling and character-name passing game.",
    },
    {
        "name": "Goo Morph",
        "category": "Warm-Up",
        "tags": ["Physical", "Transformation"],
        "lifeSkills": ["Physical Creativity", "Yes And"],
        "description": "Abstract physical transformation: melt, morph, and become the next offer.",
    },
    {
        "name": "I'm Also ___",
        "category": "Warm-Up",
        "tags": ["Object Work", "Heightening"],
        "lifeSkills": ["Heightening", "Listening"],
        "description": "One improviser takes on an action. The ensemble heightens with more descriptors, one-upping the idea.",
    },
    {
        "name": "Last Letter",
        "category": "Warm-Up",
        "tags": ["Association", "Circle"],
        "lifeSkills": ["Listening", "Verbal Fluency"],
        "description": "Go around the circle. Each person says a word that starts with the last letter of the previous word.",
    },
    {
        "name": "Mindmeld",
        "category": "Warm-Up",
        "tags": ["Group Mind", "Association"],
        "lifeSkills": ["Collaboration", "Association"],
        "description": "Two players say a word at the same time and keep going until they find a connection.",
    },
    {
        "name": "Pass the Snap",
        "category": "Warm-Up",
        "tags": ["Rhythm", "Focus"],
        "lifeSkills": ["Focus", "Rhythm"],
        "description": "Send rhythm and focus around the circle with a snap.",
    },
    {
        "name": "Red Ball",
        "category": "Warm-Up",
        "tags": ["Object Work", "Mime"],
        "lifeSkills": ["Consistency", "Object Work"],
        "description": "Pass imaginary objects. Keep weight, size, and mime consistent.",
    },
    {
        "name": "Yes / Yes And",
        "category": "Warm-Up",
        "tags": ["Agreement", "Group Mind"],
        "lifeSkills": ["Positivity", "Acceptance", "Initiative"],
        "description": "Affirmation drills. Agree with the offer, then add information.",
    },
    {
        "name": "Zip Zap Zop",
        "category": "Warm-Up",
        "tags": ["Energy", "Focus"],
        "lifeSkills": ["Focus", "Presence", "Reflexes"],
        "description": "Classic energy-passing game around the circle.",
    },
    {
        "name": "Alphabet",
        "category": "Line Games",
        "tags": ["Restriction", "Verbal"],
        "lifeSkills": ["Constraint Handling", "Listening"],
        "description": "Each line or sentence starts with the next letter of the alphabet, A through Z.",
    },
    {
        "name": "Change / New Choice",
        "category": "Line Games",
        "tags": ["Justification", "Flexibility"],
        "lifeSkills": ["Adaptability", "Letting Go"],
        "description": "A caller forces the actor to replace the last line or action with a new choice.",
    },
    {
        "name": "Questions Only",
        "category": "Line Games",
        "tags": ["Restriction", "Verbal"],
        "lifeSkills": ["Constraint Handling", "Listening"],
        "description": "The entire scene is played in questions only.",
    },
    {
        "name": "No Letter",
        "category": "Line Games",
        "tags": ["Restriction", "Verbal"],
        "lifeSkills": ["Constraint Handling", "Focus"],
        "description": "Play a scene that never uses a specific letter (for example, no S).",
    },
    {
        "name": "Object Bin",
        "category": "Line Games",
        "tags": ["Object Work", "Justification"],
        "lifeSkills": ["Justification", "Creativity"],
        "description": "Pull imaginary objects from a bin and justify each one in the scene.",
    },
    {
        "name": "One Up One Down",
        "category": "Line Games",
        "tags": ["Status", "Scene Work"],
        "lifeSkills": ["Status Play", "Listening"],
        "description": "Practice status transactions: one player raises status while the other lowers it.",
    },
    {
        "name": "One Word Story",
        "category": "Line Games",
        "tags": ["Group Mind", "Narration"],
        "lifeSkills": ["Group Mind", "Grammar & Syntax"],
        "description": "Players build a story speaking one word at a time.",
    },
    {
        "name": "Rap Battle / PAARTAY",
        "category": "Line Games",
        "tags": ["Rhyme", "Musical"],
        "lifeSkills": ["Rhyme", "Confidence"],
        "description": "Start with a beat and an easy rhyme word. Teams go back and forth rhyming.",
    },
    {
        "name": "World's Worst",
        "category": "Line Games",
        "tags": ["Witty", "Performance"],
        "lifeSkills": ["Public Speaking", "Confidence", "Thinking on your feet"],
        "description": "Players step forward as the world's worst version of a profession or person suggested by the audience.",
    },
    {
        "name": "What You Got",
        "category": "Idea Generators",
        "tags": ["Process", "Group"],
        "lifeSkills": ["Collaboration", "Listing"],
        "description": "Get a multi-step process. Small groups list the steps, each followed by \"what you got.\"",
    },
    {
        "name": "4s a Crowd",
        "category": "Short Form",
        "tags": ["Mono Scene", "Entrances"],
        "lifeSkills": ["Justification", "Sharing Space"],
        "description": "One-location mono scene. There can never be more than three people on stage. Justify every entrance and exit.",
    },
    {
        "name": "4 Chairs",
        "category": "Short Form",
        "tags": ["Styles", "Musical"],
        "lifeSkills": ["Style Flexibility", "Performance"],
        "description": "Rotate through four styles: monologue, dance, poem, and song.",
    },
    {
        "name": "5 and Fly",
        "category": "Short Form",
        "tags": ["Connections", "Characters"],
        "lifeSkills": ["Callback", "Character Continuity"],
        "description": "Like six degrees of separation, then the characters mix across scenes.",
    },
    {
        "name": "Alter Ego",
        "category": "Short Form",
        "tags": ["Inner Voice", "Support"],
        "lifeSkills": ["Empathy", "Subtext"],
        "description": "A shadow actor speaks the inner thoughts of a character in the scene.",
    },
    {
        "name": "Anti-Freeze",
        "category": "Short Form",
        "tags": ["Time Jump", "Same Reality"],
        "lifeSkills": ["Continuity", "Time Jumps"],
        "description": "Like Freeze, but stay in the same reality and jump time or place.",
    },
    {
        "name": "Beads on a String",
        "category": "Short Form",
        "tags": ["Story", "Structure"],
        "lifeSkills": ["Narrative Building", "Collaboration"],
        "description": "Also called String of Pearls. Get the beginning, middle, and end of a story, then fill in the blanks.",
    },
    {
        "name": "Box of Death",
        "category": "Short Form",
        "tags": ["Justification", "High Stakes"],
        "lifeSkills": ["Justification", "Stakes"],
        "description": "High-stakes justification game. Players must justify why they are in the box.",
    },
    {
        "name": "Clicker",
        "category": "Short Form",
        "tags": ["Remote", "Replay"],
        "lifeSkills": ["Physical Control", "Listening"],
        "description": "A remote-control handle: fast forward, rewind, pause the scene.",
    },
    {
        "name": "Choose Your Own Adventure",
        "category": "Short Form",
        "tags": ["Audience", "Choices"],
        "lifeSkills": ["Pitching Ideas", "Flexibility"],
        "description": "Freeze the scene. Improvisers propose possible next moments; the audience picks which one to play.",
    },
    {
        "name": "Cocktail Party / Banter",
        "category": "Short Form",
        "tags": ["Split Focus", "Callback"],
        "lifeSkills": ["Listening", "Callback"],
        "description": "Three two-person scenes. Each new scene picks up by repeating a line just spoken in the last one.",
    },
    {
        "name": "Conducted Story",
        "category": "Short Form",
        "tags": ["Narration", "Conductor"],
        "lifeSkills": ["Focus", "Seamless Handoffs"],
        "description": "Actors stand in a half circle. They only speak when the conductor points to them.",
    },
    {
        "name": "Dr. Know it All",
        "category": "Short Form",
        "tags": ["Group Mind", "Word at a Time"],
        "lifeSkills": ["Group Mind", "Syntax"],
        "description": "3–4 players answer audience questions as one brain, one word at a time. Justify the syntax and finish logically.",
    },
    {
        "name": "Expert Panel",
        "category": "Short Form",
        "tags": ["Characters", "Expertise"],
        "lifeSkills": ["Public Speaking", "Character"],
        "description": "Players fake expertise on a topic. Variations include good/bad/ugly advice or a two-headed expert.",
    },
    {
        "name": "Freeze (Clap Freeze)",
        "category": "Short Form",
        "tags": ["Scene Work", "Spontaneity"],
        "lifeSkills": ["Physical Awareness", "Quick Transitions", "Creativity"],
        "description": "Tag out actors and take their exact physical position, then start a new scene that justifies the pose.",
    },
    {
        "name": "Genre Replay",
        "category": "Short Form",
        "tags": ["Replay", "Style"],
        "lifeSkills": ["Style Flexibility", "Pattern Recognition"],
        "description": "Replay a scene in different film or theater genres.",
    },
    {
        "name": "Half-Life",
        "category": "Short Form",
        "tags": ["Timed", "Replay"],
        "lifeSkills": ["Efficiency", "Prioritization", "Pattern Recognition"],
        "description": "Play a scene for 60 seconds, then replay it in 30, 15, and 7. Keep the essence and heighten the physical choices.",
    },
    {
        "name": "Hockey",
        "category": "Short Form",
        "tags": ["Tag", "Understudy"],
        "lifeSkills": ["Character Continuity", "Support"],
        "description": "Three people in a scene; three others tag into those characters as a modified understudy.",
    },
    {
        "name": "Instant Monologue",
        "category": "Short Form",
        "tags": ["Monologue", "Focus"],
        "lifeSkills": ["Public Speaking", "Commitment"],
        "description": "Point at a player with a word or gift. They monologue until the pointer moves to someone new.",
    },
    {
        "name": "Love Letter",
        "category": "Short Form",
        "tags": ["Letter", "Word Bank"],
        "lifeSkills": ["Narrative", "Audience Use"],
        "description": "A scene justified by reading a letter. Two characters can write back and forth, using the audience as a word bank.",
    },
    {
        "name": "Onion",
        "category": "Short Form",
        "tags": ["Layers", "Structure"],
        "lifeSkills": ["Structure", "Callbacks"],
        "description": "Layer scenes on top of each other, then peel them back in reverse.",
    },
    {
        "name": "Silent Replay",
        "category": "Short Form",
        "tags": ["Replay", "Listening"],
        "lifeSkills": ["Observation", "Memory"],
        "description": "Watch a short scene with ears plugged, then replay it with new dialogue.",
    },
    {
        "name": "Slideshow",
        "category": "Short Form",
        "tags": ["Narration", "Tableau"],
        "lifeSkills": ["Physicality", "Narration"],
        "description": "Narrators describe vacation photos while actors form the pictures.",
    },
    {
        "name": "Sound Effects",
        "category": "Short Form",
        "tags": ["Support", "Sound"],
        "lifeSkills": ["Support", "Listening"],
        "description": "Offstage actors or the audience provide sound effects for the scene.",
    },
    {
        "name": "Spelling Bee",
        "category": "Short Form",
        "tags": ["Two Heads", "Character"],
        "lifeSkills": ["Group Mind", "Character"],
        "description": "Two heads speak as one in a spelling bee. Start and end with a made-up two- or three-syllable word, then spell, define, and use it in a sentence.",
    },
    {
        "name": "Stunt Double",
        "category": "Short Form",
        "tags": ["Physical", "Support"],
        "lifeSkills": ["Physical Commitment", "Support"],
        "description": "Call in a double for dangerous or skilled tasks.",
    },
    {
        "name": "Survivor",
        "category": "Short Form",
        "tags": ["Elimination", "Performance"],
        "lifeSkills": ["Performance", "Adaptability"],
        "description": "Elimination improv inspired by the TV show.",
    },
    {
        "name": "Translator",
        "category": "Short Form",
        "tags": ["Gibberish", "Support"],
        "lifeSkills": ["Listening", "Justification"],
        "description": "One actor speaks gibberish; another translates.",
    },
    {
        "name": "Understudy",
        "category": "Short Form",
        "tags": ["Replacement", "Character"],
        "lifeSkills": ["Character Continuity", "Support"],
        "description": "Someone fills in for a character, matching choices already established.",
    },
    {
        "name": "Dolphin Trainer",
        "category": "Endowment",
        "tags": ["Guessing", "Ding"],
        "lifeSkills": ["Observation", "Positive Reinforcement"],
        "description": "Condition an actor toward a hidden behavior using ding and buzz feedback.",
    },
    {
        "name": "Double Endowment / Secret Objective",
        "category": "Endowment",
        "tags": ["Listening", "Objectives"],
        "lifeSkills": ["Active Listening", "Problem Solving"],
        "description": "Pick a place and two players. Each player must get the other to do something without saying it outright.",
    },
    {
        "name": "Entrances / Exits",
        "category": "Endowment",
        "tags": ["Emotion", "Technique"],
        "lifeSkills": ["Emotional Availability", "Commitment"],
        "description": "Enter with a strong emotion: mad, sad, glad, or afraid.",
    },
    {
        "name": "Interrogation",
        "category": "Endowment",
        "tags": ["Guessing", "Endowment"],
        "lifeSkills": ["Observation", "Deduction"],
        "description": "Detectives make a suspect guess their crime. Competition variation: 30-second rounds for who, who they attacked, with what, and where.",
    },
    {
        "name": "Late for Work",
        "category": "Endowment",
        "tags": ["Guessing", "Mime"],
        "lifeSkills": ["Physical Storytelling", "Observation"],
        "description": "Guessing game: why are you late? Played through mime.",
    },
    {
        "name": "Party Quirks",
        "category": "Endowment",
        "tags": ["Guessing", "Characters"],
        "lifeSkills": ["Observation", "Empathy", "Problem Solving"],
        "description": "A host must guess the odd personas of the guests while keeping a party scene alive.",
    },
    {
        "name": "6 Degrees of Separation",
        "category": "Long Form",
        "tags": ["La Ronde", "Connections"],
        "lifeSkills": ["Character Continuity", "Relationships"],
        "description": "A smaller La Ronde. Six people connect one new person at a time. All two-person scenes.",
    },
    {
        "name": "Armando",
        "category": "Long Form",
        "tags": ["Monologue", "Inspiration"],
        "lifeSkills": ["Inspiration", "Scene Work"],
        "description": "A monologist tells true stories. Scenes are inspired by those stories.",
    },
    {
        "name": "Day in the Life",
        "category": "Long Form",
        "tags": ["Character", "Follow"],
        "lifeSkills": ["Character Continuity", "Narrative"],
        "description": "Follow one character through their day. Sometimes played as a nightmare version.",
    },
    {
        "name": "Deconstruction",
        "category": "Long Form",
        "tags": ["Themes", "Grounded"],
        "lifeSkills": ["Theme Work", "Listening"],
        "description": "A grounded, realistic scene, then later scenes pull apart its themes and characters.",
    },
    {
        "name": "Follow the Leaver",
        "category": "Long Form",
        "tags": ["Editing", "Transition"],
        "lifeSkills": ["Editing", "Initiative"],
        "description": "Edit by following the exiting character into a new scene.",
    },
    {
        "name": "Free Form",
        "category": "Long Form",
        "tags": ["Organic", "Yes And"],
        "lifeSkills": ["Yes And", "Editing"],
        "description": "No set structure. Pure Yes-And editing.",
    },
    {
        "name": "Goon River",
        "category": "Long Form",
        "tags": ["Monologues", "Dead Characters"],
        "lifeSkills": ["Monologue", "Character"],
        "description": "Parody of Spoon River Anthology. Three monologues from three people speaking as the dead.",
    },
    {
        "name": "Harold",
        "category": "Long Form",
        "tags": ["Structure", "Themes"],
        "lifeSkills": ["Long-term Memory", "Narrative Building", "Collaboration"],
        "description": "Opening, then scenes A/B/C, group game, scenes A/B/C, group game, scenes A/B/C.",
    },
    {
        "name": "La Ronde",
        "category": "Long Form",
        "tags": ["Character Chain"],
        "lifeSkills": ["Character Continuity", "Relationships"],
        "description": "Character chain: A+B, B+C, C+D, D+A. One player stays; a new player enters.",
    },
    {
        "name": "Line in Pocket",
        "category": "Long Form",
        "tags": ["Handle", "Dialogue"],
        "lifeSkills": ["Justification", "Commitment"],
        "description": "Actors pull random lines of dialogue from their pockets and justify them in the scene.",
    },
    {
        "name": "The Monoscene",
        "category": "Long Form",
        "tags": ["One Location", "Real Time"],
        "lifeSkills": ["Sharing Space", "Patience"],
        "description": "One location, real time, no edits. Actors enter and exit naturally. Rely on sharing the space.",
    },
    {
        "name": "One in, One Out, One Stays",
        "category": "Long Form",
        "tags": ["La Ronde", "Monoscene"],
        "lifeSkills": ["Justification", "Sharing Space"],
        "description": "Series of 2–3 person scenes. If someone enters, one player leaves and one stays.",
    },
    {
        "name": "Small Town Murder / Romance",
        "category": "Long Form",
        "tags": ["Monologues", "Community"],
        "lifeSkills": ["Character", "Audience Vote"],
        "description": "Explore a community through monologues: first beat who they are, second how they connect, last beat who did it or their love story. Audience votes 1–4.",
    },
    {
        "name": "The Slacker",
        "category": "Long Form",
        "tags": ["Tag Out", "Non-linear"],
        "lifeSkills": ["Fast Edits", "Callbacks"],
        "description": "Like a La Ronde, but transitions are faster and non-linear. Tag-out heavy.",
    },
    {
        "name": "Urban Fantasy",
        "category": "Long Form",
        "tags": ["Genre", "Asides"],
        "lifeSkills": ["Genre Play", "Asides"],
        "description": "Genre long form. Mix scenes with asides to the audience such as \"I long for a day when…\" and \"I remember a time when…\"",
    },
]

JAM_TERMS = [
    {"term": "Yes, And", "category": "Essentials", "definition": "The core rule of improv. Agree with the reality your partner created (Yes) and add new information (And)."},
    {"term": "Make Each Other Look Good", "category": "Essentials", "definition": "Treat your partner's ideas as brilliant gifts. If you support them, the whole scene succeeds."},
    {"term": "FAT BAT", "category": "Essentials", "definition": "First Appropriate Thought, Best Appropriate Thought — appropriate to the established reality. Play at the top of your intelligence and respond authentically."},
    {"term": "Play at the Top of Your Intelligence", "category": "Essentials", "definition": "Respond authentically and intelligently to the reality on stage. Do not dummy down the scene."},
    {"term": "Boundaries", "category": "Boundaries", "definition": "Safety agreements. Specific topics or physical actions the ensemble agrees are off-limits. Unlike comfort zones, which we push, boundaries protect player safety and trust."},
    {"term": "Ask For / Suggestion", "category": "Structure", "definition": "\"Can I get a…\" — a word or phrase of inspiration, not content for the scene."},
    {"term": "Initiation", "category": "Structure", "definition": "The first line or move of an improv scene."},
    {"term": "C.O.R.E.", "category": "Structure", "definition": "Character, Objective, Relationship, Environment. The foundation of a strong scene and its base reality / platform."},
    {"term": "Base Reality / Platform", "category": "Structure", "definition": "What is real in the world of this scene: who, what, and where. Establishing a solid platform early is crucial."},
    {"term": "F.U.T.", "category": "Structure", "definition": "First Unusual Thing. The first element that breaks from or contrasts with the established base reality."},
    {"term": "Pattern", "category": "Structure", "definition": "The repetition, escalation, and exploration of the logic introduced by the F.U.T. If this is true, what else could be true?"},
    {"term": "Game", "category": "Structure", "definition": "The unexpected pattern of behavior that makes the scene funny — the exploration of the pattern."},
    {"term": "Audience Warm-up", "category": "Terms", "definition": "A game that gets audience participation up and ready for the performance."},
    {"term": "Backline", "category": "Terms", "definition": "Where performers who are not actively playing stand during games."},
    {"term": "Framing", "category": "Terms", "definition": "Highlighting an unusual action or statement to signal the Game to your partner."},
    {"term": "Gift / Offer", "category": "Essentials", "definition": "Any verbal, physical, or environmental suggestion made by a player that is intended to advance the scene."},
    {"term": "Group Mind", "category": "Terms", "definition": "The ability of the ensemble to think, react, and move simultaneously as a single unit."},
    {"term": "Heightening", "category": "Terms", "definition": "Raising the stakes, emotional intensity, or absurdity of the Game; doing more of what is working."},
    {"term": "Justify", "category": "Terms", "definition": "Explaining or rationalizing why an unusual or strange element (the First Unusual Thing) is happening in the scene."},
    {"term": "Listening", "category": "Essentials", "definition": "Active attention to every spoken and unspoken detail so you can retain information and build on choices."},
    {"term": "Object Work", "category": "Terms", "definition": "Miming physical objects and environments consistently to establish a tangible reality. Sometimes called pantomime or where-work."},
    {"term": "Organic Scenes", "category": "Terms", "definition": "Scenes that start without a plan, discovering the base reality and game through Yes, And."},
    {"term": "Pirate, Robot, Ninja", "category": "Terms", "definition": "A balance of play styles: Pirate (fearless initiator), Robot (logical justifier), and Ninja (seamless support). A balanced team needs all three."},
    {"term": "Premise Scenes", "category": "Terms", "definition": "Initiating a scene with a specific, pre-determined comedic game or concept found in the opening."},
    {"term": "Troupe", "category": "Terms", "definition": "A group of performers in one ensemble playing and performing together."},
    {"term": "Warm-up", "category": "Terms", "definition": "Ways to engage before a performance: physical, vocal, energy, and focus."},
    {"term": "Tag Out", "category": "Editing Moves", "definition": "Tapping a player out to take their place, shifting the scene's context while keeping one character."},
    {"term": "Sweep Edit", "category": "Editing Moves", "definition": "Walking briskly across the front of the stage to end the current scene completely."},
    {"term": "Cut-to", "category": "Editing Moves", "definition": "A verbal cue to instantly jump characters to a different time or location (for example, \"Cut to Tuesday\")."},
    {"term": "Swinging Doors", "category": "Editing Moves", "definition": "Briefly following an exiting character into a side-scene while the main action freezes. Can be as simple as pivoting from stage right to stage left."},
    {"term": "Callback", "category": "Support Moves", "definition": "Referencing an earlier joke, object, or event to create continuity and reward the audience."},
    {"term": "Canadian Cross", "category": "Support Moves", "definition": "Crossing the stage without stopping to add atmosphere or deliver a quick one-liner."},
    {"term": "Split Scene", "category": "Support Moves", "definition": "Two distinct scenes sharing the stage at the same time, trading focus to mirror themes or time."},
    {"term": "Scene Painting", "category": "Support Moves", "definition": "Verbally describing the physical setting or environment directly to the audience."},
    {"term": "Sound Effects", "category": "Support Moves", "definition": "Vocalizing realistic sounds to enhance the environment without being distracting."},
    {"term": "Offstage Characters", "category": "Support Moves", "definition": "Characters who interact by voice only, usually from offstage or through a device such as a phone."},
    {"term": "Blocking", "category": "Pitfalls", "definition": "Stopping a scene from moving forward."},
    {"term": "Bulldozing", "category": "Pitfalls", "definition": "Driving the scene and ignoring scene partners. Plowing other ideas down."},
    {"term": "Dueling Initiations", "category": "Pitfalls", "definition": "Multiple competing ideas for which direction the scene should go."},
    {"term": "Pulling the Rug Out", "category": "Pitfalls", "definition": "The opposite of making each other look good. Taking an idea and disagreeing with it."},
    {"term": "Waffling / Wimping", "category": "Pitfalls", "definition": "Not committing to ideas. Asking only questions. Different from a committed character choice."},
    {"term": "Yes, But", "category": "Pitfalls", "definition": "Agreeing on the surface while changing the direction over and over."},
    {"term": "Give each other names", "category": "Tips", "definition": "Name your partner early. Names make characters specific and easier to remember."},
    {"term": "Show don't tell", "category": "Tips", "definition": "Play the action instead of narrating it. Do it; don't announce it."},
    {"term": "Share the space", "category": "Tips", "definition": "Leave room for your partner. Do not fill every moment."},
    {"term": "Talk about something else", "category": "Tips", "definition": "Once the platform is clear, talk about something other than the obvious transaction."},
    {"term": "Give big gifts", "category": "Tips", "definition": "Make bold, specific offers your partner can use."},
    {"term": "Don't try to be funny", "category": "Tips", "definition": "Commit to the reality. Funny follows honesty and heightening."},
    {"term": "If you believe it, the audience will believe it", "category": "Tips", "definition": "Commit fully. The audience believes what you believe."},
    {"term": "If you are interested you will be interesting", "category": "Tips", "definition": "Care about the scene and your partner. Interest reads as presence."},
    {"term": "Fail Forward", "category": "Tips", "definition": "Treat mistakes as offers. Embrace vulnerability, and breathe."},
]


def merge_games(ie_games: list[dict], jam_games: list[dict]) -> list[dict]:
    by_norm = {norm_name(g["name"]): g for g in ie_games}
    aliases = {
        "bunnybunny": "bunny",
        "yesyesand": "yeslets",
        "zipzapzop": "whoosh",
        "questionsonly": "onlyquestions",
        "changenewchoice": "ding",
        "freezeclapfreeze": "freezetag",
        "partyquirks": "theparty",
        "silentreplay": "deafreplay",
        "soundeffects": "soundeffects",
        "lineinpocket": "pockets",
        "drknowitall": "wordatatimeexpert",
        "onewordstory": "wordatatimescene",
        "alientigercow": "alientigercow",
    }
    out = list(ie_games)
    for j in jam_games:
        key = norm_name(j["name"])
        match = by_norm.get(key)
        if not match and key in aliases:
            match = by_norm.get(aliases[key])
        if not match:
            # loose contains
            for k, g in by_norm.items():
                if key.startswith(k) or k.startswith(key):
                    if min(len(key), len(k)) >= 6:
                        match = g
                        break
        record = {
            "id": f"jam-{slug(j['name'])}",
            "name": j["name"],
            "category": j["category"],
            "tags": j["tags"],
            "lifeSkills": j["lifeSkills"],
            "description": j["description"],
            "sourceIds": ["src-jam-terms"],
            "source": "Improv Jam Terms",
        }
        if match:
            tags = list(dict.fromkeys(j["tags"] + match.get("tags", [])))
            record["tags"] = tags
            record["sourceIds"] = ["src-jam-terms", "src-encyclopedia"]
            record["source"] = "Improv Jam Terms; Improv Encyclopedia"
            record["encyclopediaId"] = match["id"]
            # drop the encyclopedia-only duplicate
            out = [g for g in out if g["id"] != match["id"]]
            by_norm = {norm_name(g["name"]): g for g in out}
        out.append(record)
    out.sort(key=lambda g: g["name"].lower())
    return out


def merge_terms(ie_terms: list[dict], jam_terms: list[dict]) -> list[dict]:
    by_norm = {norm_name(t["term"]): t for t in ie_terms}
    out = []
    used = set()
    for j in jam_terms:
        rec = {**j, "id": f"term-{slug(j['term'])}", "sourceIds": ["src-jam-terms"]}
        key = norm_name(j["term"])
        if key in by_norm:
            rec["sourceIds"] = ["src-jam-terms", "src-encyclopedia"]
            used.add(key)
        out.append(rec)
    for t in ie_terms:
        if norm_name(t["term"]) in used:
            continue
        out.append({**t, "id": f"term-{slug(t['term'])}"})
    out.sort(key=lambda t: t["term"].lower())
    return out


PROMPTS = {
    "core": {
        "characters": [
            "Rival bakers",
            "Astronaut and ground control",
            "A sentient AI and its creator",
            "Two ghosts haunting a modern apartment",
            "A detective and a terrible liar",
            "A frustrated driving instructor and a nervous teen",
            "Two aliens trying to blend in at a supermarket",
            "A pirate, a robot, and someone who thinks they are a ninja",
            "Overbearing parent and rebellious child",
            "A landlord and a tenant behind on rent",
        ],
        "objectives": [
            "To steal the other's secret recipe",
            "To convince the other to push the red button",
            "To break up without hurting feelings",
            "To assemble IKEA furniture without instructions",
            "To prove they are the coolest person in the room",
            "To hide a dead body before the guests arrive",
            "To successfully parallel park",
            "To get the other person to say a specific word",
            "To leave without looking rude",
            "To make the other person look good",
        ],
        "relationships": [
            "Ex-spouses",
            "Identical twins separated at birth",
            "Boss and desperate intern",
            "Childhood best friends with a dark secret",
            "Landlord and tenant",
            "Arch-nemeses forced to work together",
            "Mentor and student who has surpassed them",
            "Wedding planner and runaway bride",
            "Two strangers who keep meeting",
            "Captain and first mate",
        ],
        "environments": [
            "Inside a submarine",
            "A chaotic kitchen during dinner rush",
            "The waiting room of a weird doctor",
            "A tiny elevator stuck between floors",
            "The edge of a volcano",
            "A very quiet library",
            "The middle of a high-speed car chase",
            "Backstage at a talent show",
            "A basement theater before doors",
            "The last lifeboat",
        ],
    },
    "fut": [
        {"reality": "Two people eating at a fancy restaurant.", "weirdThing": "One of them keeps eating the silverware instead of the food."},
        {"reality": "A job interview for an accounting firm.", "weirdThing": "The interviewer insists on communicating only through interpretive dance."},
        {"reality": "Buying a used car from a dealership.", "weirdThing": "The car salesman is fiercely protective of the cars and does not actually want to sell them."},
        {"reality": "Two friends hiking in the woods.", "weirdThing": "One friend is convinced every tree is a disguised celebrity."},
        {"reality": "A couple at a marriage counseling session.", "weirdThing": "The counselor is a puppet operated by a third person who refuses to speak."},
        {"reality": "A parent-teacher conference.", "weirdThing": "The teacher is grading the parents in real time."},
        {"reality": "Two coworkers microwaving lunch.", "weirdThing": "The microwave only works if they confess a secret."},
    ],
    "lines": [
        "I told you not to bring the ferret.",
        "That's exactly what my mother said before she exploded.",
        "Look, I only have three minutes before the potion wears off.",
        "Are you going to eat that stapler?",
        "I've been waiting fourteen years for you to ask me that.",
        "Just put the cheese down and step away slowly.",
        "I didn't think it would be this sticky.",
        "We can still make the 8:05 if nobody asks questions.",
        "This is not the treasure I buried.",
        "Please tell me you brought a second penguin.",
    ],
    "twoPerson": [
        "Two rival bakers trying to passive-aggressively sabotage each other's cakes.",
        "A pirate and a robot arguing about who gets to be the ninja.",
        "Two strangers stuck in an elevator who realize they are on a blind date with each other.",
        "A tour guide who has never been to this city and a tourist who grew up here.",
        "Two ghosts trying to scare a couple that will not stop rearranging the furniture.",
    ],
    "playStyles": [
        {"name": "Pirate", "description": "Fearless initiator. Make the bold offer. Start the scene."},
        {"name": "Robot", "description": "Logical justifier. Make the unusual thing make sense."},
        {"name": "Ninja", "description": "Seamless support. Make your partner look good."},
    ],
    "suggestions": {
        "locations": [
            "Submarine", "Library", "Kitchen", "Moon base", "Thrift store", "Courtroom",
            "Carnival", "Basement theater", "Laundromat", "Rooftop garden", "Bus stop",
            "Museum after hours", "Camping trip", "Airport security",
        ],
        "occupations": [
            "Dentist", "Lighthouse keeper", "Wedding DJ", "Astronaut", "Substitute teacher",
            "Dog trainer", "Food critic", "Stage manager", "Park ranger", "Balloon artist",
        ],
        "relationships": ["Exes", "Siblings", "Rivals", "Mentor and student", "Strangers", "Best friends"],
        "objects": [
            "Rubber chicken", "Broken compass", "Wedding cake", "Walkie-talkie", "Red ball",
            "Unlabeled jar", "Whoopee cushion", "Family heirloom lamp", "Sticky note", "Prop sword",
        ],
    },
}


def flatten_generator(prompts: dict) -> list[dict]:
    rows: list[dict] = []

    def add(category: str, text: str, extra: str = "") -> None:
        rows.append(
            {
                "id": f"gen-{slug(category)}-{len(rows) + 1}",
                "category": category,
                "text": text,
                "extra": extra,
            }
        )

    core = prompts.get("core") or {}
    for text in core.get("characters") or []:
        add("Character", text)
    for text in core.get("objectives") or []:
        add("Objective", text)
    for text in core.get("relationships") or []:
        add("Relationship", text)
    for text in core.get("environments") or []:
        add("Location", text)
    sug = prompts.get("suggestions") or {}
    seen_loc = {t.lower() for t in (core.get("environments") or [])}
    for text in sug.get("locations") or []:
        if text.lower() not in seen_loc:
            add("Location", text)
    for text in sug.get("objects") or []:
        add("Object", text)
    for text in sug.get("occupations") or []:
        add("Occupation", text)
    for text in prompts.get("lines") or []:
        add("Line", text)
    for text in prompts.get("twoPerson") or []:
        add("Prompt", text)
    for style in prompts.get("playStyles") or []:
        add("PlayStyle", style.get("name") or "", style.get("description") or "")
    for fut in prompts.get("fut") or []:
        add("FUT", fut.get("reality") or "", fut.get("weirdThing") or "")
    return rows


def main() -> None:
    raw = EXTRACT.read_text(encoding="utf-8", errors="replace")
    ie_games = parse_games(raw)
    ie_terms = parse_keywords(raw)
    games = merge_games(ie_games, JAM_GAMES)
    terms = merge_terms(ie_terms, [{**t} for t in JAM_TERMS])

    sources = [
        {
            "id": "src-jam-terms",
            "name": "Improv Jam Terms",
            "url": "",
            "note": "Teaching notes from Improv-Terms.pdf — essentials, games, and pitfalls used in rehearsal. Add a public URL here if you post the PDF.",
        },
        {
            "id": "src-encyclopedia",
            "name": "Improv Encyclopedia",
            "url": "https://improvencyclopedia.org/Download.html",
            "note": "Version 2.0.6 catalog entries. Free to use with attribution to improvencyclopedia.org.",
        },
    ]

    generator = build_generator_rows(PROMPTS)
    data = {
        "games": games,
        "terms": terms,
        "prompts": PROMPTS,
        "generator": generator,
        "sources": sources,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, ensure_ascii=False)
    OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    gs = ROOT / "apps-script" / "CatalogData.gs"
    gs.write_text("var CATALOG_DATA = JSON.parse(" + json.dumps(payload) + ");\n", encoding="utf-8")
    print(f"games={len(games)} terms={len(terms)} generator={len(generator)} ie_games={len(ie_games)} ie_terms={len(ie_terms)}")
    print(f"wrote {OUT}")
    print(f"wrote {gs}")


if __name__ == "__main__":
    main()
