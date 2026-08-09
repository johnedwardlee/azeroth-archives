#!/usr/bin/env python3
"""Build an Azeroth Archives reference pack from dnd2024.wikidot.com.

The crawler extracts structured rules metadata and source URLs. It deliberately
does not reproduce long-form rules prose; generated descriptions are concise
original reference summaries that point readers back to the source page.
"""

from __future__ import annotations

import argparse
import json
import re
import time
import unicodedata
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse
from urllib.request import Request, urlopen

from lxml import html
from lxml.html import HtmlElement


BASE_URL = "http://dnd2024.wikidot.com/"
USER_AGENT = "AzerothArchivesContentIndexer/1.0 (+local offline reference pack)"
ABILITY_MAP = {
    "strength": "strength",
    "dexterity": "agility",
    "constitution": "stamina",
    "intelligence": "intellect",
    "wisdom": "spirit",
    "charisma": "charisma",
}
CLASS_FALLBACKS = {
    "artificer": (8, "intellect"),
    "barbarian": (12, "strength"),
    "bard": (8, "charisma"),
    "cleric": (8, "spirit"),
    "druid": (8, "spirit"),
    "fighter": (10, "strength"),
    "monk": (8, "agility"),
    "paladin": (10, "strength"),
    "ranger": (10, "agility"),
    "rogue": (8, "agility"),
    "sorcerer": (6, "charisma"),
    "warlock": (8, "charisma"),
    "wizard": (6, "intellect"),
}
SITE_ONLY_SPELL_SUMMARIES = {
    "bane": "Up to three visible creatures make Charisma saves. A target that fails subtracts 1d4 from its attack rolls and saving throws while you maintain Concentration; higher-level slots add one target per slot level.",
    "buzzing-bee": "A spectral bee distracts one visible creature. While you maintain Concentration, the target has Disadvantage on Perception and Stealth checks and on saves to maintain Concentration, and it cannot benefit from being Invisible.",
    "insidious-rhythm": "One creature makes a Wisdom save against a persistent mental tune. On a failure, it has Disadvantage on Intelligence checks and saves to maintain Concentration, repeating the save at the end of each turn; higher-level slots add targets.",
    "spellfire-flare": "Make a ranged spell attack that ignores the target's benefits from Half and Three-Quarters Cover. A hit deals 2d10 Radiant damage, and each higher slot level creates another independently targeted blast.",
    "wardaway": "One creature makes a Constitution save, with Constructs and Undead succeeding automatically. Failure deals 2d4 Force damage, halves Speed briefly, and limits the target to either an action or Bonus Action on its next turn; higher slots add 2d4 damage per level.",
    "death-armor": "A touched creature gains Advantage on Death Saving Throws for 1 hour. Once each turn, a nearby creature that hits the target with a melee attack takes 2d4 Necrotic damage.",
    "deryan-s-helpful-homunculi": "Summons intangible, invulnerable helper spirits for 8 hours. They are proficient in Arcana and the Artisan's Tools used to cast the spell, and they can assist with crafting to halve the required time.",
    "elminster-s-elusion": "Protective wards grant you Advantage on saves against spells and magical effects while you maintain Concentration. When a successful save would deal half damage, it deals no damage instead.",
    "homunculus-servant": "Summons a loyal Tiny Construct that acts immediately after your turn and follows your commands. Its durability and other stat-block values scale with the spell slot used, and casting the spell again replaces the prior servant.",
    "searing-orb": "A ranged spell attack deals 3d4 Radiant damage on a hit, then flashes whether it hits or misses. The target and nearby creatures make Constitution saves or become Blinded until the end of their next turns; higher slots add 1d4 damage per level.",
    "tortoise-shell": "A willing creature gains a hardened shell and +3 AC while you maintain Concentration. After the target moves, the bonus is reduced to +1 until the start of its next turn.",
    "astral-flood": "Creatures in a 30-foot Cone make Dexterity saves against 4d10 Cold or Radiant damage. Cold hinders the target's next D20 Test, while Radiant severely limits its vision until the end of your next turn; higher slots add 1d10 damage.",
    "cacophonic-shield": "A 10-foot aura damages creatures with Thunder energy and can briefly Deafen them. It also grants you Thunder Resistance and imposes Disadvantage on ranged attacks against you; higher slots increase the aura's damage.",
    "conjure-constructs": "Conjures movable Construct spirits that can be commanded to either deal Force damage to a nearby target or grant Temporary Hit Points. Both values increase when cast with higher-level slots.",
    "laeral-s-silver-lance": "A 120-foot by 5-foot line forces chosen creatures to make Strength saves. Failure deals 3d10 Force damage and knocks the creature Prone; success halves the damage, and higher slots add 1d10 damage.",
    "sylune-s-viper": "A spectral snake grants 15 Temporary Hit Points and a Climb Speed. While those temporary points remain, you can use the snake to make a ranged spell attack that deals Force damage and briefly Poisons and Incapacitates its target; higher slots improve both benefits.",
    "backlash": "When damage triggers your Reaction, reduce it by 4d6 plus your spellcasting ability modifier. If the source is a creature within 60 feet, it also makes a Constitution save against 4d6 Force damage; both rolls scale with higher slots.",
    "doomtide": "Creates a moving 20-foot sphere of magical darkness. Creatures caught by it make Wisdom saves against Psychic damage and a temporary saving-throw penalty; the spell also supports a larger, persistent Circle casting.",
    "spellfire-storm": "Creates a bright 20-foot-radius cylinder that repeatedly deals Radiant damage and can disrupt spells cast inside it without consuming their slots. You may exempt creatures, higher slots increase damage, and Circle casting greatly expands its area and duration.",
    "sticks-to-snakes": "Transforms up to four nonmagical sticks or similar wooden objects into friendly Venomous Snakes that act after your turn and obey shared Bonus Action commands. Higher-level slots transform two additional objects per level.",
    "alustriel-s-mooncloak": "A 20-foot moonlit aura gives you and allies Half Cover and Resistance to Cold, Lightning, and Radiant damage. You can end the spell to turn a failed save against certain movement or fear effects into a success, or to restore Hit Points to a creature in the aura.",
    "songal-s-elemental-suffusion": "Grants Resistance to a chosen elemental damage type, a 30-foot hovering Fly Speed, and a recurring 15-foot pulse that deals chosen elemental damage and can knock creatures Prone. Circle casting can share the benefits with additional creatures.",
    "dirge": "A 60-foot aura prevents affected creatures from regaining Hit Points and repeatedly subjects them to Necrotic damage and movement penalties. Circle casting extends the duration and can also inflict Exhaustion on failed saves.",
    "elminster-s-effulgent-spheres": "Six orbiting spheres last for 1 hour. Expend one as a Reaction for temporary Resistance to incoming elemental damage or as a Bonus Action for a ranged attack dealing 3d6 chosen elemental damage; higher slots add spheres.",
    "leomund-s-lamentable-belaborment": "Creatures in a small area make Intelligence saves or become absorbed in an argument. Affected targets are Charmed, unable to move, and effectively unable to perceive anyone except you and other affected targets until they succeed on a repeat save.",
    "simbul-s-synostodweomer": "For 1 hour, a touched creature can convert spellcasting into healing. After it spends a spell slot, it may expend and roll Hit Dice equal to the slot's level, then regain that total plus your spellcasting ability modifier.",
    "void-star": "A ranged spell attack deals 6d12 Necrotic damage, followed by 3d12 more at the end of the target's next turn. You regain Hit Points equal to the later damage, and higher slots increase both damage rolls.",
    "holy-star-of-mystra": "Creates a hovering mote that can fire a 4d10-plus-modifier Force or Radiant bolt when cast and on later Bonus Actions. It grants Three-Quarters Cover and can reflect certain single-target spells after a successful saving throw.",
    "blade-of-disaster": "Creates a movable planar rift that makes two melee spell attacks for 10d6 Force damage each and scores a Critical Hit on an 18-20. On later turns, a Bonus Action moves the blade and repeats both attacks, and the rift can pass through barriers.",
}


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-") or "entry"


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\xa0", " ")).strip()


def absolute_url(href: str) -> str:
    if not href.startswith(("http://", "https://", "/")):
        href = "/" + href
    return urljoin(BASE_URL, href).replace("https://dnd2024.wikidot.com/", BASE_URL)


def page_key(url: str) -> str:
    return unquote(urlparse(url).path.lstrip("/")).lower()


class WikiCrawler:
    def __init__(self, delay: float = 0.08) -> None:
        self.delay = delay
        self.cache: dict[str, HtmlElement] = {}

    def get(self, url: str) -> HtmlElement:
        url = absolute_url(url)
        if url in self.cache:
            return self.cache[url]
        last_error: Exception | None = None
        for attempt in range(4):
            try:
                request = Request(url, headers={"User-Agent": USER_AGENT})
                with urlopen(request, timeout=40) as response:
                    body = response.read()
                document = html.fromstring(body.decode("utf-8", errors="replace"), base_url=url)
                self.cache[url] = document
                if self.delay:
                    time.sleep(self.delay)
                return document
            except Exception as error:
                last_error = error
                time.sleep(0.5 * (attempt + 1))
        raise RuntimeError(f"Unable to fetch {url}: {last_error}")

    def content(self, url: str) -> HtmlElement:
        document = self.get(url)
        matches = document.xpath('//*[@id="page-content"]')
        return matches[0] if matches else document

    def links(self, url: str) -> list[tuple[str, str]]:
        found: list[tuple[str, str]] = []
        for anchor in self.content(url).xpath('.//a[@href]'):
            href = anchor.get("href", "")
            if not href or href.startswith(("javascript:", "#")):
                continue
            target = absolute_url(href)
            if urlparse(target).netloc != "dnd2024.wikidot.com":
                continue
            label = clean_text(anchor.text_content())
            if label and page_key(target):
                found.append((label, target))
        return found


def print_inventory(crawler: WikiCrawler) -> None:
    links = crawler.links(BASE_URL)
    groups: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for label, url in links:
        key = page_key(url)
        prefix = key.split(":", 1)[0] if ":" in key else "page"
        groups[prefix].append((label, key))
    for prefix in sorted(groups):
        unique = list(dict.fromkeys(groups[prefix]))
        print(f"[{prefix}] {len(unique)}")
        for label, key in unique[:80]:
            print(f"  {label}\t{key}")


def inspect_page(crawler: WikiCrawler, url: str) -> None:
    content = crawler.content(url)
    print(f"URL: {absolute_url(url)}")
    print("TEXT")
    for line in [clean_text(part) for part in content.itertext() if clean_text(part)][:120]:
        print(f"  {line}")
    for heading in content.xpath('.//h1 | .//h2 | .//h3 | .//h4 | .//h5'):
        label = clean_text(heading.text_content())
        if label:
            print(f"HEADING {heading.tag}: {label}")
    for bold in content.xpath('.//strong | .//b'):
        label = clean_text(bold.text_content())
        if label:
            print(f"BOLD: {label}")
    for index, table in enumerate(content.xpath('.//table'), start=1):
        print(f"TABLE {index}")
        for row in table.xpath('.//tr')[:6]:
            cells = [clean_text(cell.text_content()) for cell in row.xpath('./th | ./td')]
            print("  " + " | ".join(cells))
    print("LINKS")
    for label, target in crawler.links(url)[:80]:
        print(f"  {label}\t{page_key(target)}")


def unique_links(crawler: WikiCrawler, url: str, prefix: str) -> list[tuple[str, str]]:
    found: dict[str, tuple[str, str]] = {}
    for label, target in crawler.links(url):
        key = page_key(target)
        if key.startswith(prefix + ":") and key != prefix + ":all":
            found.setdefault(key, (label, target))
    return list(found.values())


def text_lines(content: HtmlElement) -> list[str]:
    return [clean_text(part) for part in content.itertext() if clean_text(part)]


def concise_summary(value: str, max_chars: int = 520) -> str:
    """Turn a source section into a short third-person mechanical digest."""
    value = clean_text(value)
    value = re.sub(
        r"^(?:[A-Z]{1,3}\s+){2,}[A-Z]{1,3}\s+(?:Origin|General|Fighting Style|Epic Boon) Feat\s+",
        "",
        value,
    )
    value = re.sub(r"^(?:You gain|This feature grants you) the following benefits?\.\s*", "", value, flags=re.IGNORECASE)
    value = re.sub(r"\b[Yy]ou['’]re\b", "they are", value)
    value = re.sub(r"\b[Yy]ou['’]ve\b", "they have", value)
    value = re.sub(r"\b[Yy]ou['’]ll\b", "they will", value)
    value = re.sub(r"\b[Yy]ou['’]d\b", "they would", value)
    value = re.sub(r"\b[Yy]ourself\b", "themselves", value)
    value = re.sub(r"\b[Yy]ours\b", "theirs", value)
    value = re.sub(r"\b[Yy]our\b", "their", value)
    value = re.sub(r"\b[Yy]ou\b", "they", value)
    value = re.sub(r"\b(?:of|to|for|from|against|within|around|near|put) they\b", lambda match: match.group(0)[:-4] + "them", value, flags=re.IGNORECASE)
    value = re.sub(r"\bwhen ever\b", "whenever", value, flags=re.IGNORECASE)
    sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])", value)
    summary = " ".join(sentences[:3]).strip()
    summary = re.sub(r"(?<=[.!?])\s+they\b", " They", summary)
    if len(summary) > max_chars:
        summary = summary[: max_chars - 1].rsplit(" ", 1)[0].rstrip(" ,;:") + "…"
    summary = summary.rstrip(" [")
    return summary[:1].upper() + summary[1:] if summary else ""


def heading_section_text(heading: HtmlElement) -> str:
    parent = heading.getparent()
    if parent is None:
        return ""
    siblings = list(parent)
    try:
        start = siblings.index(heading)
    except ValueError:
        return ""
    heading_rank = int(heading.tag[1]) if re.fullmatch(r"h[1-6]", heading.tag) else 6
    parts: list[str] = []
    for sibling in siblings[start + 1 :]:
        if re.fullmatch(r"h[1-6]", sibling.tag):
            sibling_rank = int(sibling.tag[1])
            if sibling_rank <= heading_rank:
                break
        text = clean_text(sibling.text_content())
        if text:
            parts.append(text)
    return clean_text(" ".join(parts))


def first_narrative_summary(content: HtmlElement, fallback: str) -> str:
    for paragraph in content.xpath('.//p'):
        value = clean_text(paragraph.text_content())
        if len(value) < 45 or value.casefold().startswith(("source:", "casting time:", "range:")):
            continue
        summary = concise_summary(value)
        if summary:
            return summary
    return fallback


def bold_benefit_summary(content: HtmlElement, fallback: str) -> str:
    excluded = {"casting time", "range", "components", "duration", "source", "prerequisite", "prerequisites"}
    benefits: list[str] = []
    for bold in content.xpath('.//strong | .//b'):
        label = clean_text(bold.text_content()).rstrip(".:").strip()
        if not label or label.casefold() in excluded or len(label) > 80:
            continue
        parent = bold.getparent()
        body = clean_text(parent.text_content()) if parent is not None else ""
        if body.casefold().startswith(label.casefold()):
            body = clean_text(body[len(label) :].lstrip(". :"))
        if not body and parent is not None:
            sibling = parent.getnext()
            if sibling is not None and not re.fullmatch(r"h[1-6]", sibling.tag) and not sibling.xpath('.//strong | .//b'):
                body = clean_text(sibling.text_content())
        digest = concise_summary(body, 260) if body else ""
        benefits.append(f"{label}: {digest}" if digest else label)
    benefits = list(dict.fromkeys(benefits))
    return concise_summary(" ".join(benefits[:5]), 820) if benefits else fallback


def value_after_label(lines: list[str], labels: tuple[str, ...]) -> str:
    wanted = {label.rstrip(":").casefold() for label in labels}
    for index, line in enumerate(lines):
        folded = line.rstrip(":").casefold()
        if folded in wanted and index + 1 < len(lines):
            value_index = index + 1
            if lines[value_index] == ":" and value_index + 1 < len(lines):
                value_index += 1
            return lines[value_index]
        for label in wanted:
            if folded.startswith(label + " "):
                return clean_text(line[len(label) :].lstrip(": "))
    return ""


def nearest_heading(table: HtmlElement) -> str:
    headings = table.xpath('preceding::*[self::h1 or self::h2 or self::h3 or self::h4 or self::h5][1]')
    return clean_text(headings[0].text_content()) if headings else ""


def rows_and_headers(table: HtmlElement) -> tuple[list[str], list[HtmlElement], str]:
    rows = table.xpath('.//tr')
    title = ""
    header_index = -1
    headers: list[str] = []
    for index, row in enumerate(rows):
        cells = row.xpath('./th | ./td')
        values = [clean_text(cell.text_content()) for cell in cells]
        if len(values) == 1 and index == 0:
            title = values[0]
        if len(values) >= 2:
            header_index = index
            headers = values
            break
    return headers, rows[header_index + 1 :] if header_index >= 0 else [], title


def cell_map(headers: list[str], row: HtmlElement) -> tuple[dict[str, str], list[HtmlElement]]:
    cells = row.xpath('./th | ./td')
    values = [clean_text(cell.text_content()) for cell in cells]
    if len(values) != len(headers):
        return {}, cells
    return {headers[index].casefold(): value for index, value in enumerate(values)}, cells


def parse_background(crawler: WikiCrawler, name: str, url: str) -> dict:
    content = crawler.content(url)
    lines = text_lines(content)
    abilities_text = value_after_label(lines, ("Ability Scores:", "Ability Score:"))
    ability_options = [
        mapped
        for source, mapped in ABILITY_MAP.items()
        if re.search(rf"\b{re.escape(source)}\b", abilities_text, re.IGNORECASE)
    ]
    skills_text = value_after_label(lines, ("Skill Proficiencies:", "Skill Proficiency:"))
    skills = [part.strip() for part in re.split(r",|\band\b", skills_text, flags=re.IGNORECASE) if part.strip()]
    tools_text = value_after_label(lines, ("Tool Proficiencies:", "Tool Proficiency:"))
    tools = [part.strip() for part in re.split(r",|\band\b", tools_text, flags=re.IGNORECASE) if part.strip()]
    equipment = value_after_label(lines, ("Equipment:",))
    feat_links = unique_links(crawler, url, "feat")
    result = {"id": slugify(name), "name": name, "skills": skills}
    if ability_options:
        result["abilityOptions"] = ability_options
    if feat_links:
        result["featId"] = page_key(feat_links[0][1]).split(":", 1)[1]
    if tools:
        result["toolProficiencies"] = tools
    if equipment:
        result["equipment"] = equipment
    return result


def build_backgrounds(crawler: WikiCrawler) -> list[dict]:
    entries = unique_links(crawler, "background:all", "background")
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(parse_background, crawler, name, url) for name, url in entries]
        return sorted((future.result() for future in as_completed(futures)), key=lambda item: item["name"].casefold())


def parse_species(crawler: WikiCrawler, name: str, url: str) -> dict:
    content = crawler.content(url)
    lines = text_lines(content)
    speed_text = value_after_label(lines, ("Speed:",))
    speed_match = re.search(r"(\d+)\s*feet", speed_text, re.IGNORECASE)
    speed = int(speed_match.group(1)) if speed_match else 30
    trait_summaries: dict[str, str] = {}
    ignored = {"creature type", "size", "speed", "source"}
    for bold in content.xpath('.//strong | .//b'):
        label = clean_text(bold.text_content()).rstrip(":").strip()
        candidate = label.rstrip(".").strip()
        if label.endswith(".") and candidate.casefold() not in ignored and len(candidate) <= 80:
            parent = bold.getparent()
            body = clean_text(parent.text_content()) if parent is not None else ""
            if body.casefold().startswith(label.casefold()):
                body = clean_text(body[len(label) :])
            trait_summaries.setdefault(candidate, concise_summary(body) if body else "")
    trait_names = list(trait_summaries)
    if not trait_names:
        trait_names = ["Species Traits"]
    traits = [
        {
            "id": slugify(f"{name}-{trait}"),
            "name": trait,
            "description": trait_summaries.get(trait) or f"Provides the {trait} species benefit for {name} characters.",
            "source": url,
        }
        for trait in trait_names
    ]
    return {"id": slugify(name), "name": name, "speed": speed, "traits": traits}


def build_ancestries(crawler: WikiCrawler) -> list[dict]:
    entries = unique_links(crawler, "species:all", "species")
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(parse_species, crawler, name, url) for name, url in entries]
        return sorted((future.result() for future in as_completed(futures)), key=lambda item: item["name"].casefold())


def parse_level_features(content: HtmlElement, owner: str, url: str) -> dict[str, list[dict]]:
    level_features: dict[str, list[dict]] = defaultdict(list)
    for heading in content.xpath('.//h1 | .//h2 | .//h3 | .//h4'):
        match = re.match(r"Level\s+(\d+)\s*:\s*(.+)", clean_text(heading.text_content()), re.IGNORECASE)
        if not match:
            continue
        level, name = match.groups()
        section_summary = concise_summary(heading_section_text(heading))
        feature = {
            "id": slugify(f"{owner}-{level}-{name}"),
            "name": name.strip(),
            "description": section_summary or f"Level {level} {owner} feature: {name.strip()}.",
            "source": url,
        }
        if feature["name"] not in {item["name"] for item in level_features[level]}:
            level_features[level].append(feature)
    return dict(sorted(level_features.items(), key=lambda item: int(item[0])))


def parse_subclass(crawler: WikiCrawler, class_id: str, name: str, url: str) -> dict:
    features = parse_level_features(crawler.content(url), name, url)
    if not features:
        features = {
            "3": [{
                "id": slugify(f"{class_id}-{name}-features"),
                "name": f"{name} Features",
                "description": f"The defining feature progression for the {name} subclass.",
                "source": url,
            }]
        }
    return {
        "id": slugify(f"{class_id}-{name}"),
        "name": name,
        "description": first_narrative_summary(
            crawler.content(url),
            f"A {class_id.title()} specialization centered on {name} features.",
        ),
        "levelFeatures": features,
    }


def parse_class(crawler: WikiCrawler, name: str, url: str, home_links: list[tuple[str, str]]) -> dict:
    class_id = page_key(url).split(":", 1)[0]
    content = crawler.content(url)
    detailed_features = {
        (level, feature["name"].casefold()): feature["description"]
        for level, features in parse_level_features(content, name, url).items()
        for feature in features
    }
    fallback_die, fallback_ability = CLASS_FALLBACKS[class_id]
    hit_die = fallback_die
    primary_ability = fallback_ability
    saving_throw_proficiencies: list[str] = []
    for table in content.xpath('.//table'):
        for row in table.xpath('.//tr'):
            values = [clean_text(cell.text_content()) for cell in row.xpath('./th | ./td')]
            if len(values) != 2:
                continue
            if values[0].casefold() == "hit point die":
                match = re.search(r"d(\d+)", values[1], re.IGNORECASE)
                if match:
                    hit_die = int(match.group(1))
            if values[0].casefold() == "primary ability":
                for source, mapped in ABILITY_MAP.items():
                    if re.search(rf"\b{source}\b", values[1], re.IGNORECASE):
                        primary_ability = mapped
                        break
            if values[0].casefold() == "saving throw proficiencies":
                saving_throw_proficiencies = [
                    mapped
                    for source, mapped in ABILITY_MAP.items()
                    if re.search(rf"\b{source}\b", values[1], re.IGNORECASE)
                ]

    level_features: dict[str, list[dict]] = defaultdict(list)
    for table in content.xpath('.//table'):
        headers, rows, _ = rows_and_headers(table)
        folded = [header.casefold() for header in headers]
        if "level" not in folded or "features" not in folded:
            continue
        for row in rows:
            values, _ = cell_map(headers, row)
            level = values.get("level", "")
            if not re.fullmatch(r"(?:[1-9]|1\d|20)", level):
                continue
            for feature_name in [part.strip() for part in values.get("features", "").split(",") if part.strip() and part.strip() != "-"]:
                level_features[level].append({
                    "id": slugify(f"{class_id}-{level}-{feature_name}"),
                    "name": feature_name,
                    "description": detailed_features.get(
                        (level, feature_name.casefold()),
                        f"At level {level}, {name} characters gain {feature_name}.",
                    ),
                    "source": url,
                })
    if not level_features:
        level_features.update(parse_level_features(content, name, url))

    subclass_entries: dict[str, tuple[str, str]] = {}
    for label, target in home_links + crawler.links(url):
        key = page_key(target)
        if key.startswith(class_id + ":") and key not in {class_id + ":main", class_id + ":spell-list"}:
            subclass_entries.setdefault(key, (label, target))
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(parse_subclass, crawler, class_id, label, target) for label, target in subclass_entries.values()]
        subclasses = sorted((future.result() for future in as_completed(futures)), key=lambda item: item["name"].casefold())
    result = {
        "id": class_id,
        "name": name,
        "hitDie": hit_die,
        "primaryAbility": primary_ability,
        "description": first_narrative_summary(content, f"The {name} class progression and character options."),
        "levelFeatures": dict(sorted(level_features.items(), key=lambda item: int(item[0]))),
        "subclasses": subclasses,
    }
    if saving_throw_proficiencies:
        result["savingThrowProficiencies"] = saving_throw_proficiencies
    return result


def build_classes(crawler: WikiCrawler) -> list[dict]:
    home_links = crawler.links(BASE_URL)
    main_entries: dict[str, tuple[str, str]] = {}
    for label, url in home_links:
        key = page_key(url)
        if key.endswith(":main") and key.split(":", 1)[0] in CLASS_FALLBACKS:
            main_entries.setdefault(key, (label, url))
    return sorted(
        [parse_class(crawler, name, url, home_links) for name, url in main_entries.values()],
        key=lambda item: item["name"].casefold(),
    )


def parse_feat_detail(crawler: WikiCrawler, name: str, url: str, category: str) -> dict:
    prerequisite = ""
    content: HtmlElement | None = None
    try:
        content = crawler.content(url)
        lines = text_lines(content)
        prerequisite = value_after_label(lines, ("Prerequisite:", "Prerequisites:"))
    except RuntimeError:
        pass
    fallback = (
        first_narrative_summary(content, f"The {name} feat provides benefits associated with its {category} category.")
        if content is not None
        else f"The {name} feat provides benefits associated with its {category} category."
    )
    result = {
        "id": page_key(url).split(":", 1)[1] or slugify(name),
        "name": name,
        "category": category,
        "description": bold_benefit_summary(
            content,
            fallback,
        ) if content is not None else fallback,
        "source": url,
    }
    if prerequisite:
        result["prerequisite"] = prerequisite
    return result


def build_feats(crawler: WikiCrawler) -> list[dict]:
    content = crawler.content("feat:all")
    entries: dict[str, tuple[str, str, str]] = {}
    for table in content.xpath('.//table'):
        category = re.sub(r"\s+Feats?$", "", nearest_heading(table), flags=re.IGNORECASE) or "Feat"
        for row in table.xpath('.//tr'):
            cells = row.xpath('./th | ./td')
            if len(cells) != 1:
                continue
            anchors = cells[0].xpath('.//a[@href]')
            if not anchors:
                continue
            name = clean_text(cells[0].text_content())
            url = absolute_url(anchors[0].get("href", ""))
            key = page_key(url)
            if key.startswith("feat:") and key != "feat:all":
                entries.setdefault(key, (name, url, category))
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(parse_feat_detail, crawler, *entry) for entry in entries.values()]
        return sorted((future.result() for future in as_completed(futures)), key=lambda item: item["name"].casefold())


def load_reference_pack(path: Path | None) -> dict:
    if path is None:
        return {}
    if not path.exists():
        raise FileNotFoundError(f"Spell description pack not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def spell_descriptions(pack: dict) -> dict[str, str]:
    return {
        clean_text(spell.get("name", "")).casefold(): clean_text(spell.get("description", ""))
        for spell in pack.get("spells", [])
        if clean_text(spell.get("name", "")) and clean_text(spell.get("description", ""))
    }


def apply_reference_descriptions(pack: dict, reference: dict) -> None:
    ancestry_map = {item["name"].casefold(): item for item in reference.get("ancestries", [])}
    for ancestry in pack["ancestries"]:
        local = ancestry_map.get(ancestry["name"].casefold())
        if not local:
            continue
        local_traits = {trait["name"].casefold(): trait for trait in local.get("traits", [])}
        for trait in ancestry["traits"]:
            match = local_traits.get(trait["name"].casefold())
            if trait["description"].startswith("Provides the ") and match and clean_text(match.get("description", "")):
                trait["description"] = concise_summary(match["description"], 900)

    class_map = {item["name"].casefold(): item for item in reference.get("classes", [])}
    for class_item in pack["classes"]:
        local_class = class_map.get(class_item["name"].casefold())
        if not local_class:
            continue
        local_features = {
            (level, feature["name"].casefold()): feature
            for level, features in local_class.get("levelFeatures", {}).items()
            for feature in features
        }
        for level, features in class_item["levelFeatures"].items():
            for feature in features:
                match = local_features.get((level, feature["name"].casefold()))
                if feature["description"].startswith("At level ") and match and clean_text(match.get("description", "")):
                    feature["description"] = concise_summary(match["description"], 900)

        local_subclasses = {item["name"].casefold(): item for item in local_class.get("subclasses", [])}
        for subclass in class_item.get("subclasses", []):
            local_subclass = local_subclasses.get(subclass["name"].casefold())
            if not local_subclass:
                continue
            local_subclass_features = {
                (level, feature["name"].casefold()): feature
                for level, features in local_subclass.get("levelFeatures", {}).items()
                for feature in features
            }
            for level, features in subclass["levelFeatures"].items():
                for feature in features:
                    match = local_subclass_features.get((level, feature["name"].casefold()))
                    if feature["description"].startswith("The defining feature progression") and match and clean_text(match.get("description", "")):
                        feature["description"] = concise_summary(match["description"], 900)

    feat_map = {item["name"].casefold(): item for item in reference.get("feats", [])}
    for feat in pack["feats"]:
        match = feat_map.get(feat["name"].casefold())
        if feat["description"].startswith(f"The {feat['name']} feat provides") and match and clean_text(match.get("description", "")):
            feat["description"] = concise_summary(match["description"], 900)


def build_spells(crawler: WikiCrawler, local_descriptions: dict[str, str]) -> list[dict]:
    content = crawler.content("spell:all")
    spells: dict[str, dict] = {}
    for level, table in enumerate(content.xpath('.//table')):
        if level > 9:
            break
        headers, rows, _ = rows_and_headers(table)
        folded = [header.casefold() for header in headers]
        required = {"name", "school", "spell lists", "casting time", "range", "components", "duration"}
        if not required.issubset(set(folded)):
            continue
        for row in rows:
            values, cells = cell_map(headers, row)
            name = values.get("name", "")
            if not name:
                continue
            anchors = cells[folded.index("name")].xpath('.//a[@href]')
            source = absolute_url(anchors[0].get("href", "")) if anchors else absolute_url("spell:all")
            spell_id = page_key(source).split(":", 1)[1] if page_key(source).startswith("spell:") else slugify(name)
            casting_time = values["casting time"]
            description = local_descriptions.get(name.casefold()) or SITE_ONLY_SPELL_SUMMARIES.get(spell_id)
            if not description:
                description = f"Reference entry for {name}; consult the linked source for the complete spell effect."
            spells.setdefault(spell_id, {
                "id": spell_id,
                "name": name,
                "level": level,
                "school": values["school"],
                "classes": [part.strip() for part in values["spell lists"].split(",") if part.strip()],
                "ritual": bool(re.search(r"(?:\bor\s+R\b|\bR\b)", casting_time)),
                "castingTime": casting_time,
                "range": values["range"],
                "components": values["components"],
                "duration": values["duration"],
                "description": description,
                "source": source,
            })
    return sorted(spells.values(), key=lambda item: (item["level"], item["name"].casefold()))


def split_properties(value: str) -> list[str]:
    return [part.strip() for part in re.split(r",\s+(?![^()]*\))", value) if part.strip() and part.strip() not in {"-", "—"}]


def build_equipment(crawler: WikiCrawler) -> list[dict]:
    pages = [
        ("equipment:weapon", "Weapon"),
        ("equipment:armor", "Armor"),
        ("equipment:adventuring-gear", "Adventuring Gear"),
        ("equipment:tool", "Tool"),
        ("equipment:mounts-and-vehicles", "Mount or Vehicle"),
        ("equipment:poison", "Poison"),
    ]
    name_headers = ("name", "item", "armor", "poison", "saddle", "ship", "type", "tool", "focus", "vehicle")
    equipment: dict[str, dict] = {}
    for page, base_category in pages:
        content = crawler.content(page)
        for table_index, table in enumerate(content.xpath('.//table')):
            headers, rows, title = rows_and_headers(table)
            folded = [header.casefold() for header in headers]
            name_header = next((candidate for candidate in name_headers if candidate in folded), "")
            if not name_header and "cost" in folded and folded:
                name_header = folded[0]
            if not name_header:
                continue
            if page == "equipment:armor":
                category = ("Light Armor", "Medium Armor", "Heavy Armor", "Shield")[min(table_index, 3)]
            elif page == "equipment:tool":
                category = headers[0]
            else:
                category = title or nearest_heading(table) or base_category
                if category.casefold() in {"weapon properties", "mastery properties"}:
                    continue
            for row in rows:
                values, _ = cell_map(headers, row)
                name = values.get(name_header, "")
                if not name or name.casefold() == name_header:
                    continue
                item_id = slugify(name)
                if item_id in equipment:
                    continue
                item = {
                    "id": item_id,
                    "name": name,
                    "category": category,
                    "description": f"{name} is listed as {category.lower()} equipment.",
                    "source": absolute_url(page),
                }
                cost = values.get("cost", "")
                weight = values.get("weight", "")
                damage_value = values.get("damage", "")
                properties = values.get("properties", "")
                mastery = values.get("mastery", "")
                if cost and cost not in {"-", "—"}:
                    item["cost"] = cost
                if weight and weight not in {"-", "—"}:
                    item["weight"] = weight
                if damage_value:
                    match = re.match(r"(.+?)\s+(Bludgeoning|Piercing|Slashing|Acid|Cold|Fire|Force|Lightning|Necrotic|Poison|Psychic|Radiant|Thunder)$", damage_value, re.IGNORECASE)
                    if match:
                        item["damage"] = match.group(1)
                        item["damageType"] = match.group(2).title()
                    else:
                        item["damage"] = damage_value
                if properties:
                    parsed_properties = split_properties(properties)
                    if parsed_properties:
                        item["properties"] = parsed_properties
                if mastery and mastery not in {"-", "—"}:
                    item["mastery"] = mastery
                factual = []
                ignored = {name_header, "cost", "weight", "damage", "properties", "mastery", "function", "effect", "description"}
                for header, value in values.items():
                    if header not in ignored and value and value not in {"-", "—"}:
                        factual.append(f"{header.title()}: {value.rstrip('.')}")
                if factual:
                    item["description"] = "; ".join(factual) + "."
                narrative = values.get("function", "") or values.get("effect", "") or values.get("description", "")
                if narrative:
                    item["description"] = concise_summary(narrative)
                elif values.get("ability"):
                    article = "an" if category[:1].casefold() in "aeiou" else "a"
                    item["description"] = (
                        f"{article.capitalize()} {category.lower()} associated with {values['ability']} for relevant ability checks"
                        + (" and specialized crafting." if category.casefold() == "artisan tool" else ".")
                    )
                elif damage_value:
                    details = [f"Deals {damage_value} damage."]
                    if item.get("properties"):
                        details.append("Properties: " + ", ".join(item["properties"]) + ".")
                    if item.get("mastery"):
                        details.append(f"Mastery: {item['mastery']}.")
                    item["description"] = " ".join(details)
                elif item["description"].endswith(" equipment."):
                    details = [f"A {category.lower()} item"]
                    if weight and weight not in {"-", "—"}:
                        details.append(f"weighing {weight}")
                    if cost and cost not in {"-", "—"}:
                        details.append(f"with a listed cost of {cost}")
                    item["description"] = " ".join(details) + "."
                equipment[item_id] = item
    return sorted(equipment.values(), key=lambda item: (item["category"].casefold(), item["name"].casefold()))


def validate_pack(pack: dict) -> None:
    if pack.get("schemaVersion") != "2.0":
        raise ValueError("Pack must use schema version 2.0")
    required = {
        "ancestries": ("id", "name", "speed", "traits"),
        "classes": ("id", "name", "hitDie", "primaryAbility", "levelFeatures"),
        "backgrounds": ("id", "name", "skills"),
        "feats": ("id", "name", "category", "description"),
        "equipment": ("id", "name", "category"),
        "spells": ("id", "name", "level", "school", "classes", "castingTime", "range", "components", "duration", "description"),
    }
    for collection, fields in required.items():
        entries = pack.get(collection, [])
        if not entries:
            raise ValueError(f"{collection} is empty")
        ids = [entry.get("id") for entry in entries]
        if len(ids) != len(set(ids)):
            raise ValueError(f"{collection} contains duplicate ids")
        for entry in entries:
            missing = [field for field in fields if field not in entry]
            if missing:
                raise ValueError(f"{collection}.{entry.get('name', '?')} is missing {missing}")
            if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", entry["id"]):
                raise ValueError(f"Invalid id: {entry['id']}")
    descriptions: list[tuple[str, str]] = []
    descriptions.extend((f"ancestry trait {trait['name']}", trait.get("description", "")) for ancestry in pack["ancestries"] for trait in ancestry["traits"])
    descriptions.extend((f"class {item['name']}", item.get("description", "")) for item in pack["classes"])
    descriptions.extend((f"class feature {feature['name']}", feature.get("description", "")) for item in pack["classes"] for features in item["levelFeatures"].values() for feature in features)
    descriptions.extend((f"subclass {subclass['name']}", subclass.get("description", "")) for item in pack["classes"] for subclass in item.get("subclasses", []))
    descriptions.extend((f"subclass feature {feature['name']}", feature.get("description", "")) for item in pack["classes"] for subclass in item.get("subclasses", []) for features in subclass["levelFeatures"].values() for feature in features)
    descriptions.extend((f"feat {item['name']}", item.get("description", "")) for item in pack["feats"])
    descriptions.extend((f"equipment {item['name']}", item.get("description", "")) for item in pack["equipment"])
    descriptions.extend((f"spell {item['name']}", item.get("description", "")) for item in pack["spells"])
    unfinished = [
        label
        for label, description in descriptions
        if not clean_text(description)
        or re.search(r"consult the linked source|indexed from the linked source|Reference entry", description, re.IGNORECASE)
    ]
    if unfinished:
        raise ValueError(f"Entries still have unfinished descriptions: {unfinished}")


def build_pack(crawler: WikiCrawler, description_pack: Path | None = None) -> dict:
    reference_pack = load_reference_pack(description_pack)
    local_descriptions = spell_descriptions(reference_pack)
    pack = {
        "schemaVersion": "2.0",
        "pack": {
            "id": "dnd2024-wikidot-reference",
            "name": "D&D 2024 Wikidot Reference",
            "version": "2026.08.09.2",
            "description": "Offline character-option index with structured metadata and concise reference summaries. Full rules remain at the linked source pages.",
            "source": "https://dnd2024.wikidot.com/",
        },
        "ancestries": build_ancestries(crawler),
        "classes": build_classes(crawler),
        "backgrounds": build_backgrounds(crawler),
        "feats": build_feats(crawler),
        "equipment": build_equipment(crawler),
        "spells": build_spells(crawler, local_descriptions),
    }
    apply_reference_descriptions(pack, reference_pack)
    validate_pack(pack)
    return pack


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inventory", action="store_true", help="Print the site's home-page content links.")
    parser.add_argument("--inspect-page", help="Print headings, sample table rows, and internal links for a page.")
    parser.add_argument("--output", type=Path, default=Path("content-packs/dnd2024-wikidot.w5e"))
    parser.add_argument(
        "--description-pack",
        type=Path,
        default=Path("content-packs/dnd5e-2024-phb.w5e"),
        help="Use matching spell descriptions from an existing local content pack.",
    )
    args = parser.parse_args()
    crawler = WikiCrawler()
    if args.inventory:
        print_inventory(crawler)
        return
    if args.inspect_page:
        inspect_page(crawler, args.inspect_page)
        return
    pack = build_pack(crawler, args.description_pack)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(pack, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "output": str(args.output.resolve()),
        "counts": {key: len(pack[key]) for key in ("ancestries", "classes", "backgrounds", "feats", "equipment", "spells")},
        "subclasses": sum(len(item.get("subclasses", [])) for item in pack["classes"]),
    }, indent=2))


if __name__ == "__main__":
    main()
