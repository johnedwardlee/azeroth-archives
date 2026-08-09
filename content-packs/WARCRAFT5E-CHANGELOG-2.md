# Warcraft 5E Content Pack - Changelog 2

Status: **Approved, implemented, and content-validated**
Revision: **2 - all twelve approval batches implemented**
Pack reviewed: `warcraft5e-campaign.w5e` version `2026.08.09.2`
Phase 2 changes made: **All approved changes below**

## Authority and scope

This changelog covers description repairs, setting terminology, incomplete mechanics, and reference cleanup in the Phase 1 Warcraft campaign pack. The canon player-facing authority remains:

- [Character Creation Guide](../../Warcraft5E_vault/Player%20Guide/Character%20Creation%20Guide.md)
- [Campaign Primer](../../Warcraft5E_vault/Player%20Guide/Campaign%20Primer.md)

Phase 1 availability decisions remain locked. Changelog 2 does not restore excluded classes, subclasses, ancestries, backgrounds, feats, spells, or equipment.

The implemented Phase 2 pack contains:

- 4 ancestries and 13 retained ancestry traits
- 10 classes and 40 subclasses
- 17 backgrounds
- 75 feats
- 218 equipment entries
- 385 spells

## Audit summary

| Finding | Affected records | Proposed treatment |
|---|---:|---|
| Third-person crawler templates | 543 | Rewrite as direct second-person rules text. |
| OCR, page-header, caption, spacing, or table contamination | 98 | Replace contaminated prose with clean, self-contained summaries. |
| Truncated descriptions ending in an ellipsis | 24 | Restore the complete mechanical effect. |
| Stale references to approved renamed content | 83 | Use Warcraft display names and retain original rules aliases where needed. |
| Remaining Fey terminology | 27 | Apply the approved Nature Spirit and Emerald Dream vocabulary. |
| D&D setting or cosmology references | 27 | Use the proposed Warcraft cosmology mapping below. |
| References to prohibited classes | 8 | Remove unavailable class access while preserving approved spell-list access. |
| References to excluded options or ancestries | 3 | Two are ordinary uses of “phantom”; `Reincarnate` requires a new ancestry table. |
| Metamagic placeholder | 1 | Replace with the complete 2024 Metamagic option reference. |

No mojibake remains in the UTF-8 pack itself. Some Windows terminal previews display curly punctuation incorrectly, but the stored JSON characters are valid.

---

## 1. Global editorial and rules-text normalization

Approval status: **Approved**

### Direct player-facing voice

Rewrite descriptions from crawler-generated third person into direct second person:

- `They can...` becomes `You can...`
- `their spellcasting ability` becomes `your spellcasting ability`
- `themselves` becomes `yourself` when referring to the character
- Broken constructions such as `grants they`, `allows they`, and `hit they` are repaired during the same pass

This is an editorial change only. Dice, ranges, actions, uses, recharge timing, prerequisites, conditions, damage types, spell levels, and scaling remain unchanged.

### OCR and source contamination

Remove PDF page headers, chapter labels, illustration captions, neighboring spell text, malformed tables, split words, and OCR noise. Examples currently include:

- A Druid illustration caption appended to `Spare the Dying`
- The complete `Bane` entry appended to `Awaken`
- A Prismatic Wall table appended to `Produce Flame`
- Page headings embedded in `Protection from Evil and Good`, `Find Familiar`, `Wish`, and other spell descriptions
- Split words such as `rea ch`, `Char med`, `crea ture`, and `componen ts`

Clean descriptions must be self-contained inside the app. References such as “see chapter 7” or “see the table later in this class” will be replaced with the needed rule or a clear linked-record reference.

### Truncated entries requiring complete mechanics

#### Class and subclass features

- Barbarian: Rage; Primal Knowledge
- Priest: Channel Faith
- Light Domain: Corona of Light
- Monk: Martial Arts; Monk's Focus
- Warrior of Mercy: Flurry of Healing and Harm
- Paladin: Lay on Hands; Channel Faith
- Oath of Devotion: Sacred Weapon
- Dream Wanderer: Beguiling Twist
- Soulknife: Psychic Blades
- Sorcerer: Font of Magic; Metamagic
- Clockwork Sorcery: Clockwork Spells
- Wild Magic Sorcery: Tamed Surge

#### Feats

- Boon of Fate
- Charger
- Defensive Duelist
- Dual Wielder
- Healer
- Polearm Master
- Shield Master
- Telepathic

### Metamagic structural repair

Replace the temporary `Metamagic Options` marker with the complete 2024 option reference for Careful, Distant, Empowered, Extended, Heightened, Quickened, Seeking, Subtle, Transmuted, and Twinned Spell. These remain Sorcerer options and never appear as a subclass.

### Original rules identities

All renamed records keep their original names in the new `aliases` field. Descriptions use the Warcraft display name. A parenthetical rules alias is included only where it prevents mechanical ambiguity, such as `Nature Spirit (Fey creature type)`.

---

## 2. Ancestry descriptions and lineage mechanics

Approval status: **Approved**

### High Elf Lineage

Replace the incomplete choose-a-lineage description with the single permitted High Elf progression:

- Level 1: learn `Minor Magic` (`Prestidigitation` rules alias)
- After a Long Rest, that cantrip may be exchanged for another Mage/Wizard cantrip
- Level 3: always have `Detect Magic` prepared
- Level 5: always have `Misty Step` prepared
- Each lineage spell may be cast once without a spell slot per Long Rest and may also use available spell slots
- Choose Intellect, Spirit, or Charisma as the lineage spellcasting ability

No High Elf lineage benefit grants Darkvision.

### Rock Gnome Lineage

Merge the incomplete generic lineage text with the complete Rock Gnome option while retaining the two approved display traits:

- `Rock Gnome Lineage` establishes the required lineage and spellcasting ability
- `Rock Gnome Gifts` grants `Mending` and `Minor Magic` (`Prestidigitation` rules alias)
- Restore the complete clockwork-device limits, activation, selectable effect, three-device maximum, eight-hour duration, and dismantling rule

Forest Gnome mechanics remain absent. Rock Gnomes do not regain ancestry Darkvision.

### Elven Resolve

Keep the current mechanic—Advantage on saves to avoid or end Charmed—but rewrite the description without Fey ancestry language.

### Other retained ancestries

Human and Dwarf mechanics remain unchanged apart from direct voice, grammar, and OCR cleanup. Dwarf still receives no replacement for removed ancestry Darkvision.

---

## 3. Class and subclass descriptions

Approval status: **Approved**

### Class overview rewrites

| Class | Proposed setting treatment |
|---|---|
| Barbarian | Describe Rage as primal physical and spiritual force rather than a force of the D&D multiverse. |
| Bard | Use the guide's practiced rhythm, voice, memory, performance, and ambient-magic explanation; remove Words-of-Creation cosmology from the overview. |
| Priest | Connect miracles to a Warcraft-appropriate faith, sacred duty, or spiritual tradition; remove gods dwelling in the Outer Planes. |
| Warrior | Replace all Fighter labels while retaining the martial mechanics. |
| Monk | Use the guide's body, mind, inner-spirit, and culturally neutral training explanation; remove alignment with the multiverse. |
| Paladin | Present power through sacred oath, faith, duty, and conviction appropriate to the campaign. |
| Hunter | Replace Ranger labels and emphasize wilderness training, tracking, and practical nature magic. |
| Rogue | Retain the existing concept with direct-voice cleanup. |
| Sorcerer | Use the guide's approved origins: ley lines, magical warfare, unstable artifacts, inherited alteration, draconic influence, experimentation, or an extreme event. |
| Mage | Replace Wizard labels and connect formal arcane study to Dalaran, high-elven instruction, military service, private tutelage, or recovered wartime knowledge. |

### Specific subclass lore replacements

| Current D&D reference | Proposed Warcraft presentation |
|---|---|
| Yggdrasil and the Outer Planes in Path of the World Tree | The roots of Azeroth's Great Trees and their connection through the Emerald Dream. |
| Feywild origins of College of Glamour | Dream magic that shapes emotion, wonder, beauty, and fear. |
| Generic god/pantheon assumptions in Path of the Zealot and Priest domains | A campaign-appropriate faith, sacred tradition, or spiritual calling chosen with the GM. |
| Shadowfell in Warrior of Shadow and Gloom Stalker | Shadow magic and places touched by the Shadowlands. |
| Elemental Chaos in Warrior of the Elements | Warcraft's Elemental Plane and its elemental powers. |
| “As old as the first elves” in Oath of the Ancients | An ancient oath to defend life, hope, and the Light without assigning it to one ancestry. |
| Archfey/Feywild origin of Dream Wanderer | A Wild God, Nature Spirit, or transformative encounter with the Emerald Dream. |
| Mechanus, modrons, and the Great Modron March in Clockwork Sorcery | Titanic machinery, ordered arcane forces, or exposure to a titan-forged site or artifact. |
| Limbo and a Fey blessing in Wild Magic Sorcery | Ley-line instability, magical warfare, an unstable artifact, chaotic arcane exposure, or demonic corruption survived rather than embraced. |
| Alien influence in Aberrant Sorcery | Void influence, a psychic relic, an aberrant creature, or another approved mental transformation. |

All subclass mechanics remain unchanged unless separately listed in this changelog.

### Feature-reference replacements

- Replace old class names inside mechanics with Priest, Warrior, Hunter, and Mage.
- Replace stale feature names such as `Channel Divinity`, `Divine Intervention`, and `Nature's Veil` with their approved display names.
- Replace old spell names inside class and subclass features with their approved Warcraft display names.
- Rename Hunter's `Druidic Warrior` option to `Nature Warrior`. It still grants two cantrips from the Nature (`Druid` rules) spell list and does not grant the Druid class or Druidic language.
- Paladin's `Blessed Warrior` uses the Priest (`Cleric` rules) cantrip list.
- Bard's Magical Secrets and College of Lore's Magical Discoveries use the Priest, Nature (`Druid` rules), and Mage spell lists.

---

## 4. Background mechanics and text

Approval status: **Approved**

### Incomplete tool proficiencies

Replace five truncated `Choose one kind of` values:

| Background | Complete tool choice |
|---|---|
| Reconstruction Worker | Choose one kind of Artisan's Tools |
| Crown Guard | Choose one Gaming Set |
| Court-Born | Choose one Gaming Set |
| Performer or Herald | Choose one Musical Instrument |
| War Veteran | Choose one Gaming Set |

### Outlaw or Smuggler variants

The Character Creation Guide permits either the Criminal or Wayfarer package, while Phase 1 currently includes only Criminal mechanics. Add two clearly labeled records:

- `Outlaw or Smuggler (Criminal)`
- `Outlaw or Smuggler (Wayfarer)`

This replaces the single ambiguous record and increases the default pack from 16 to 17 backgrounds.

### Archaeologist

Keep the approved canon package unchanged: Constitution/Stamina, Intelligence/Intellect, or Wisdom/Spirit; Skilled; History and Investigation; Cartographer's Tools; 50 GP.

### Equipment text

Normalize apostrophes, capitalization, punctuation, and the wording of A/B equipment choices without changing their contents or gold totals.

---

## 5. Feat descriptions

Approval status: **Approved**

- Rewrite all 75 retained feat descriptions into clean second-person rules text.
- Restore the complete mechanics of the eight truncated feats listed in section 1.
- `Dream-Touched` uses `Dream Magic` terminology and retains `Fey-Touched` as its rules alias.
- `Magic Initiate` offers the Priest (`Cleric`), Nature (`Druid`), or Mage (`Wizard`) spell list. Choosing Nature magic does not make the character a Druid or grant Druidic.
- Replace renamed spell references inside feats with their Warcraft display names.
- Do not change feat availability, prerequisites, dice, action economy, uses, or scaling.

---

## 6. Spell descriptions and mechanical references

Approval status: **Approved**

### Full spell-prose repair

Rewrite all 385 retained spell descriptions as clean, self-contained mechanical summaries. Each summary must preserve every relevant target, save, attack, damage roll, condition, duration, action, reaction, component interaction, repeat save, creature statistic, and higher-slot effect.

This replaces OCR-damaged text rather than shortening it into vague placeholder language. Source URLs and original spell aliases remain attached.

### Known cross-record contamination

- `Awaken`: remove the appended `Bane` entry and restore only Awaken's mechanics.
- `Bane`: keep its own clean standalone record.
- `Spare the Dying`: remove the illustration caption and restore its level-based range scaling.
- `Produce Flame`: remove the appended Prismatic Wall table.
- `Wish`: remove page headers and replace its Sigil/Lady of Pain restriction as described below.

### Warcraft creature-type vocabulary

Creature types remain mechanically identical and keep their original rules alias:

| Rules creature type | Warcraft display term |
|---|---|
| Aberration | Voidspawn (`Aberration` rules type) |
| Celestial | Light Spirit (`Celestial` rules type) |
| Fey | Nature Spirit (`Fey` rules type) |
| Fiend | Demon (`Fiend` rules type) |

Spells that list affected creature types use the display term followed by the rules alias on first mention.

### Summoning terminology

- `Summon Nature Spirit` retains the Fuming, Mirthful, and Tricksy profiles.
- `Summon Lightspawn` retains Defender and Avenger mechanics.
- `Summon Demon` relabels its three unchanged profiles as Brute (`Demon` profile), Flame-Wing (`Devil` profile), and Stalker (`Yugoloth` profile).
- `Find Familiar` offers Beast-form spirits with Light Spirit, Nature Spirit, or Demon rules types.
- `Call Naaru` represents calling a temporary manifestation or servant of the Light; it does not imply control over a major named Naaru.

### Cosmology mapping

| D&D reference | Warcraft-facing replacement |
|---|---|
| Material Plane | Azeroth |
| Feywild | Emerald Dream |
| Shadowfell | Shadowlands |
| Ethereal Plane | Spirit Realm (`Ethereal Plane` rules) |
| Astral Plane | Twisting Nether (`Astral Plane` rules) |
| Upper Planes | Realms of the Light |
| Nine Hells or a generic fiendish plane | A fel realm within the Twisting Nether |
| Mechanus | Titanic machinery or ordered arcane power |
| Limbo | Chaotic arcane or ley-line instability |
| Yggdrasil | Azeroth's Great Trees |
| Elemental Plane | Keep; this already fits Warcraft cosmology |

Ordinary uses of the word `sigil` remain unchanged. Only the City of Sigil and Lady of Pain references are removed.

### Wish cosmology clause

Replace the City of Sigil/Lady of Pain exception with a Warcraft-neutral ruling: a Wish that would unmake Azeroth, overturn the campaign's cosmology, or directly rewrite a cosmic power's existence can fail or draw immediate intervention at the GM's discretion. All standard Wish options and stress mechanics remain unchanged.

### Reincarnate ancestry table

Replace the unavailable 2024 ancestry table with:

| 1d4 | New ancestry |
|---:|---|
| 1 | Human |
| 2 | Dwarf |
| 3 | Gnome |
| 4 | High Elf |

The new form receives the selected ancestry's retained traits and never gains ancestry Darkvision. Half-Elf identity still requires GM approval and is not a random result.

### Spell-list labels

- Spell class metadata keeps both Warcraft display labels and original rules labels.
- Druid-list access is displayed as `Nature (Druid rules list)`.
- Artificer and Warlock are removed from retained spell access metadata.
- `Faerie Fire` remains unchanged as established Warcraft terminology.

No additional spell is added or removed in Changelog 2.

---

## 7. Equipment descriptions and campaign restrictions

Approval status: **Approved**

- `Arcane Focus` lists Sorcerer and Mage users; remove Warlock.
- `Nature Focus` lists Hunter and any feature that explicitly permits it; remove Druid as a selectable class.
- `Holy Symbol` uses Priest and Paladin terminology.
- Update descriptions for Gnomish Airship, Tallstrider, Azerothian War Game, Nature Focus, Elekk, Wind Serpent, Shadra's Sting, Deep-Worm Poison, and Three-Kingdom Ante so they no longer use their old names or D&D-setting lore.
- Clean OCR and third-person grammar in the remaining equipment descriptions without changing cost, weight, damage, properties, mastery, or category.
- Add a clear `GM approval required at character creation` sentence to retained magic-item and specialized-equipment descriptions. This does not prevent tracking an item acquired during play.

Equipment availability remains 218 records.

---

## 8. Player-guide synchronization

Approval status: **Approved**

After the content text is approved, amend the Character Creation Guide to:

1. State that ancestry never grants passive Darkvision; other sources remain valid.
2. Show Priest (`Cleric`), Warrior (`Fighter`), Hunter (`Ranger`), and Mage (`Wizard`) as the campaign display names.
3. Record Nature Spirit, Emerald Dream, and related terminology.
4. Explain Nature (`Druid` rules list) spell access without making the Druid class or Druidic language available.
5. Preserve both Outlaw or Smuggler mechanical variants.

The Campaign Primer requires no rules change.

---

## 9. Validation required after approval

1. Rebuild the pack only through `content-tools/build_warcraft5e_pack.py`.
2. Pass JSON Schema validation.
3. Confirm IDs remain unique and original rules aliases remain attached.
4. Confirm all background `featId` references resolve.
5. Confirm every spell class label resolves to an available display class, an approved rules alias, or the retained Nature list.
6. Confirm ancestry Darkvision traits remain absent.
7. Confirm no excluded record was restored except the proposed second Outlaw or Smuggler mechanical variant.
8. Confirm no placeholder phrases, ellipsis truncations, OCR page headers, caption bleed, or malformed split words remain.
9. Confirm spell order remains level first and alphabetical within each level.
10. Import the finished pack into Azeroth Archives and smoke-test ancestry, class, subclass, background, feat, spell, and equipment selection.

### Implementation results

- Regenerated exclusively through `content-tools/build_warcraft5e_pack.py`.
- JSON Schema validation passed for pack version `2026.08.09.2`.
- The dedicated content audit reports zero truncated descriptions, placeholders, OCR contamination, direct-voice grammar errors, third-person crawler templates, stale approved names, prohibited class references, excluded-option references, D&D-setting references, Fey terminology, or mojibake.
- Retained counts are 4 ancestries, 10 classes, 40 subclasses, 17 backgrounds, 75 feats, 218 equipment entries, and 385 spells.
- The app bundles this campaign pack as its protected default rules library, so a normal app update also updates the baseline content.
- The Character Creation Guide now records the approved Darkvision rule, class display names, Nature spell-list explanation, and Warcraft vocabulary mapping.

## Approval checklist

- [x] Global direct-voice, OCR, truncation, and Metamagic repairs approved
- [x] High Elf and Rock Gnome lineage descriptions approved
- [x] Class and subclass lore rewrites approved
- [x] Class feature and spell-list terminology approved
- [x] Background tool repairs and two Outlaw or Smuggler variants approved
- [x] Feat description repairs approved
- [x] Full spell-prose repair approved
- [x] Warcraft creature-type and summoning vocabulary approved
- [x] Cosmology mapping and Wish clause approved
- [x] Reincarnate 1d4 ancestry table approved
- [x] Equipment description and starting-approval labels approved
- [x] Character Creation Guide synchronization approved
