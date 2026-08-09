#!/usr/bin/env python3
"""Audit retained Warcraft pack prose for Changelog 2 rewrite candidates."""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable


PROJECT = Path(__file__).resolve().parents[1]
DEFAULT_PACK = PROJECT / "content-packs" / "warcraft5e-campaign.w5e"

RENAMED_RULES_TERMS = [
    "Cleric",
    "Fighter",
    "Ranger",
    "Wizard",
    "Cleric Subclass",
    "Divine Order",
    "Channel Divinity",
    "Divine Intervention",
    "Greater Divine Intervention",
    "Fighter Subclass",
    "Ranger Subclass",
    "Nature's Veil",
    "Wizard Subclass",
    "Memorize Spell",
    "Fey Wanderer",
    "Fey Reinforcements",
    "Fey-Touched",
    "Summon Fey",
    "Conjure Fey",
    "Tasha's Hideous Laughter",
    "Tenser's Floating Disk",
    "Melf's Acid Arrow",
    "Nystul's Magic Aura",
    "Leomund's Tiny Hut",
    "Evard's Black Tentacles",
    "Leomund's Secret Chest",
    "Mordenkainen's Faithful Hound",
    "Mordenkainen's Private Sanctum",
    "Otiluke's Resilient Sphere",
    "Bigby's Hand",
    "Jallarzi's Storm of Radiance",
    "Rary's Telepathic Bond",
    "Yolande's Regal Presence",
    "Drawmij's Instant Summons",
    "Otiluke's Freezing Sphere",
    "Otto's Irresistible Dance",
    "Tasha's Bubbling Cauldron",
    "Mordenkainen's Magnificent Mansion",
    "Mordenkainen's Sword",
    "Prestidigitation",
    "Shillelagh",
    "Thaumaturgy",
    "Magic Missile",
    "Find Steed",
    "Spiritual Weapon",
    "Ice Storm",
    "Summon Aberration",
    "Summon Celestial",
    "Summon Fiend",
    "Conjure Celestial",
    "Astral Projection",
]

PROHIBITED_CLASSES = ["Artificer", "Druid", "Warlock"]

REMOVED_OR_APPROVAL_ONLY_OPTIONS = [
    "College of Spirits",
    "College of the Moon",
    "Grave Domain",
    "Knowledge Domain",
    "Banneret",
    "Oath of the Noble Genies",
    "Hollow Warden",
    "Winter Walker",
    "Scion of the Three",
    "Shadow Sorcery",
    "Spellfire Sorcery",
    "Bladesinger",
    "Aasimar",
    "Boggart",
    "Changeling",
    "Dhampir",
    "Dragonborn",
    "Faerie",
    "Flamekin",
    "Goliath",
    "Halfling",
    "Hexblood",
    "Kalashtar",
    "Khoravar",
    "Lorwyn Changeling",
    "Lupin",
    "Orc",
    "Reborn",
    "Rimekin",
    "Shifter",
    "Tiefling",
    "Warforged",
]

DND_SETTING_TERMS = [
    "Feywild",
    "Shadowfell",
    "Forgotten Realms",
    "Faerûn",
    "Eberron",
    "Greyhawk",
    "Ravenloft",
    "Moonshae",
    "Waterdeep",
    "Neverwinter",
    "Baldur's Gate",
    "Nine Hells",
    "Mount Celestia",
    "Far Realm",
    "Astral Plane",
    "Ethereal Plane",
    "Upper Planes",
    "Limbo",
    "Mechanus",
    "Lolth",
    "Mystra",
    "Tiamat",
    "Bahamut",
    "Corellon",
    "Moradin",
    "Gruumsh",
    "Vecna",
    "Asmodeus",
    "Raven Queen",
    "Zhentarim",
    "Harpers",
    "Purple Dragon",
]


def pattern(terms: Iterable[str]) -> re.Pattern[str]:
    return re.compile("|".join(rf"(?<![A-Za-z]){re.escape(term)}(?![A-Za-z])" for term in terms), re.IGNORECASE)


ISSUE_PATTERNS = {
    "truncated": re.compile(r"(?:…|\.\.\.)\s*$"),
    "placeholder": re.compile(
        r"Reference entry|consult the linked source|defining feature progression|pending Changelog 2",
        re.IGNORECASE,
    ),
    "ocr-contamination": re.compile(
        r"CHAPTER\s+[0-9]|C\s*HAPTER|APPENDIX|A\s+PPE|casting Time:|componen\s+ts:|"
        r"4NIM|C\.H/|Cr!APTER|SPELt|\\VITH|rea\s+ch|Char\s+med|crea\s+ture|"
        r"path\s+ways|t:1e|sp~|r1 ction|\bthi\s+s\b|\bthe\s+m\b|\byou\s+r\b|"
        r"\bw\s+ith\b|\bdea\s+l\b|\bdam\s+age\b|\bcre\s+ature\b|\bspe\s+ll\b|"
        r"\blev\s+els?\b|\bfeat\s+ure\b|\bexp\s+end\b|\breg\s+ain\b|\boftimes\b",
        re.IGNORECASE,
    ),
    "direct-voice-grammar": re.compile(
        r"(?i:\b(?:of|to|for|from|against|around|near) them\b|\bput them\b|"
        r"\ba (?:Agility|Intellect|Stamina)\b)|[.!?]\s+(?:you|your)\b",
    ),
    "third-person-template": re.compile(r"(?:^|[.!?]\s+)(?:they|their|themselves)\b", re.IGNORECASE),
    "approved-name-reference": pattern(RENAMED_RULES_TERMS),
    "prohibited-class-reference": pattern(PROHIBITED_CLASSES),
    "excluded-option-reference": pattern(REMOVED_OR_APPROVAL_ONLY_OPTIONS),
    "dnd-setting-reference": pattern(DND_SETTING_TERMS),
    "fey-terminology": re.compile(r"\bfey\b|\bfeywild\b|\barchfey\b", re.IGNORECASE),
    "mojibake": re.compile(r"â|Ã|Â|�"),
}


def text_entries(pack: dict[str, Any]) -> Iterable[tuple[str, str]]:
    for ancestry in pack.get("ancestries", []):
        for trait in ancestry.get("traits", []):
            yield f"ancestry/{ancestry['name']}/trait/{trait['name']}", trait.get("description", "")

    for class_record in pack.get("classes", []):
        class_path = f"class/{class_record['name']}"
        yield class_path, class_record.get("description", "")
        for level, features in class_record.get("levelFeatures", {}).items():
            for feature in features:
                yield f"{class_path}/level-{level}/{feature['name']}", feature.get("description", "")
        for subclass in class_record.get("subclasses", []):
            subclass_path = f"{class_path}/subclass/{subclass['name']}"
            yield subclass_path, subclass.get("description", "")
            for level, features in subclass.get("levelFeatures", {}).items():
                for feature in features:
                    yield f"{subclass_path}/level-{level}/{feature['name']}", feature.get("description", "")

    for background in pack.get("backgrounds", []):
        path = f"background/{background['name']}"
        if background.get("feature"):
            yield f"{path}/feature/{background['feature']['name']}", background["feature"].get("description", "")
        yield f"{path}/equipment", background.get("equipment", "")
        yield f"{path}/tools", "; ".join(background.get("toolProficiencies", []))

    for feat in pack.get("feats", []):
        path = f"feat/{feat['name']}"
        yield path, feat.get("description", "")
        yield f"{path}/prerequisite", feat.get("prerequisite", "")

    for item in pack.get("equipment", []):
        path = f"equipment/{item['name']}"
        yield path, item.get("description", "")
        yield f"{path}/properties", "; ".join(item.get("properties", []))

    for spell in pack.get("spells", []):
        yield f"spell/{spell['name']}", spell.get("description", "")


def audit(pack: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    findings: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for path, text in text_entries(pack):
        if not text:
            continue
        for issue, regex in ISSUE_PATTERNS.items():
            if issue in {"third-person-template", "direct-voice-grammar"} and path.startswith("spell/"):
                continue
            matches = sorted({match.group(0) for match in regex.finditer(text)}, key=str.casefold)
            if matches:
                findings[issue].append({"path": path, "matches": matches})
    return dict(findings)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pack", nargs="?", type=Path, default=DEFAULT_PACK)
    parser.add_argument("--json", action="store_true", dest="as_json")
    args = parser.parse_args()
    pack = json.loads(args.pack.read_text(encoding="utf-8"))
    findings = audit(pack)
    if args.as_json:
        print(json.dumps(findings, ensure_ascii=False, indent=2))
        return
    for issue in ISSUE_PATTERNS:
        records = findings.get(issue, [])
        print(f"[{issue}] {len(records)} records")
        for record in records:
            print(f"  {record['path']}: {', '.join(record['matches'])}")


if __name__ == "__main__":
    main()
