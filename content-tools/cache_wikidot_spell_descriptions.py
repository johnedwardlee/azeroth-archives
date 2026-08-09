#!/usr/bin/env python3
"""Cache clean spell descriptions from the approved Wikidot baseline sources.

The Warcraft pack generator consumes this cache so normal pack builds remain
deterministic and offline. Re-run this script only when intentionally refreshing
the source text from the linked Wikidot spell pages.
"""

from __future__ import annotations

import argparse
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from crawl_dnd2024_wikidot import WikiCrawler, clean_text, text_lines


PROJECT = Path(__file__).resolve().parents[1]
DEFAULT_PACK = PROJECT / "content-packs" / "warcraft5e-campaign.w5e"
DEFAULT_OUTPUT = PROJECT / "content-source" / "warcraft5e-wikidot-spells.json"


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def extract_description(crawler: WikiCrawler, url: str) -> str:
    lines = text_lines(crawler.content(url))
    duration_index = next(
        (index for index, line in enumerate(lines) if line.casefold().rstrip(":") == "duration"),
        None,
    )
    if duration_index is None or duration_index + 2 > len(lines):
        raise ValueError(f"Could not locate the Duration field at {url}")

    description = clean_text(" ".join(lines[duration_index + 2 :]))
    if len(description) < 20:
        raise ValueError(f"Spell description is unexpectedly short at {url}")
    if "consult the linked source" in description.casefold():
        raise ValueError(f"Placeholder description survived at {url}")
    return description


def fetch_spell(crawler: WikiCrawler, spell: dict[str, Any]) -> tuple[str, dict[str, str]]:
    source = spell.get("source", "")
    if "dnd2024.wikidot.com/spell:" not in source:
        raise ValueError(f"Spell {spell['name']} lacks a Wikidot spell source URL")
    return spell["id"], {
        "name": spell["name"],
        "source": source,
        "description": extract_description(crawler, source),
    }


def build_cache(pack: dict[str, Any], workers: int) -> dict[str, Any]:
    crawler = WikiCrawler(delay=0.12)
    spells = pack.get("spells", [])
    cached: dict[str, dict[str, str]] = {}
    failed: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(fetch_spell, crawler, spell): spell for spell in spells}
        for index, future in enumerate(as_completed(futures), start=1):
            try:
                spell_id, record = future.result()
                cached[spell_id] = record
            except Exception as error:
                spell = futures[future]
                failed.append(spell)
                print(f"Will retry {spell['name']}: {error}")
            if index % 25 == 0 or index == len(spells):
                print(f"Fetched {index}/{len(spells)} spell descriptions")

    if failed:
        retry_crawler = WikiCrawler(delay=0.35)
        for spell in failed:
            last_error: Exception | None = None
            for attempt in range(3):
                try:
                    spell_id, record = fetch_spell(retry_crawler, spell)
                    cached[spell_id] = record
                    last_error = None
                    break
                except Exception as error:
                    last_error = error
                    time.sleep(1.5 * (attempt + 1))
            if last_error is not None:
                raise RuntimeError(f"Unable to cache {spell['name']} after retries: {last_error}")

    if len(cached) != len(spells):
        raise ValueError(f"Expected {len(spells)} descriptions, found {len(cached)}")
    return {
        "source": "http://dnd2024.wikidot.com/",
        "packId": pack.get("pack", {}).get("id", "warcraft5e-campaign"),
        "spells": {spell_id: cached[spell_id] for spell_id in sorted(cached)},
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pack", type=Path, default=DEFAULT_PACK)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--workers", type=int, default=6)
    args = parser.parse_args()

    cache = build_cache(load_json(args.pack), max(1, min(args.workers, 8)))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(cache, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {args.output} with {len(cache['spells'])} spell descriptions")


if __name__ == "__main__":
    main()
