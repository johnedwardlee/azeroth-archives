# Warcraft 5E Content Pack - Baseline Changelog

Status: **Phase 1 and Changelog 2 implemented**
Revision: **5 - approved baseline generated as a separate campaign pack**
Baseline reviewed: `dnd2024-wikidot.w5e` version `2026.08.09.2`
Implementation: `warcraft5e-campaign.w5e` version `2026.08.09.2`
Baseline changes made: **None**

## Authority and scope

This revision uses the campaign's canon player-facing documents as the authority for what players may select:

- [Character Creation Guide](../../Warcraft5E_vault/Player%20Guide/Character%20Creation%20Guide.md)
- [Campaign Primer](../../Warcraft5E_vault/Player%20Guide/Campaign%20Primer.md)
- [Character Concept Questionnaire](../../Warcraft5E_vault/Player%20Guide/Character%20Concept%20Questionnaire.md)

The Character Creation Guide establishes revised 2024 D&D 5e, Grand Coalition opening ancestries, no multiclassing, three prohibited classes, approved campaign backgrounds, and approval requirements for legacy, third-party, and other-book material.

This review covered all 24 ancestries and 107 traits, 13 classes and 70 subclass records, 61 backgrounds, 175 feats, 230 equipment entries, and 419 spells in the Wikidot pack.

Phase 1 availability, renames, removals, aliases, and structural moves are implemented in the separate Warcraft campaign pack. The approved Changelog 2 description repairs, mechanical references, Warcraft terminology, and second Outlaw or Smuggler package are implemented in pack version `2026.08.09.2`. The Wikidot baseline remains unchanged.

## Availability meanings

| Status | Meaning in the proposed pack |
|---|---|
| Available | Included in the default Warcraft campaign pack. |
| Approval required | Excluded from the default pack. It may later be supplied in a separate GM-approved optional module. |
| Unavailable | Excluded because the canon player guide expressly prohibits it or its parent option. |
| Rename | Warcraft-facing display name changes; the underlying 2024 rules identity does not. |

The default pack should show players only options that are legal without a special ruling. Pack inclusion does not override campaign restrictions such as ancestry approval, firearm training, or the prohibition on starting magic items.

## Decisions that need approval

- Keep Bard and Sorcerer. The player guide explicitly makes both available.
- Remove Artificer, Druid, and Warlock. Their prohibition is firm and cannot be unlocked later.
- Use Warcraft display names for Cleric, Fighter, Ranger, and Wizard while retaining their 2024 rules identities.
- Limit default ancestries to Human, Dwarf, Gnome using Rock Gnome, and Elf using High Elf.
- Treat Half-Elf as an approval-only story identity using Human or Elf mechanics, not as a reskinned Khoravar ancestry.
- Remove passive Darkvision granted by ancestry/species traits. Darkvision gained from spells, class or subclass features, summoned creatures, and other non-ancestry sources remains available.
- Include only the guide-approved campaign backgrounds and the canon custom Archaeologist package.
- Exclude legacy, supplemental, and third-party options from the default pack until individually approved.
- Keep the Druid spell list because `Magic Initiate: Druid` is explicitly permitted, even though the Druid class is unavailable.

## Approved Warcraft terminology standard

The D&D `Fey` rules concept uses Warcraft-facing terminology rather than a literal one-word replacement. Original rules terms remain searchable aliases and internal rules identifiers so interactions continue to work.

| D&D term | Warcraft display term |
|---|---|
| Fey | Nature Spirit |
| Feywild | Emerald Dream |
| Archfey | Wild God |
| Fey magic | Dream magic |
| Fey-Touched | Dream-Touched |
| Fey Wanderer | Dream Wanderer |
| Fey Wanderer Spells | Dream Wanderer Spells |
| Fey Reinforcements | Nature Spirit Reinforcements |
| Summon Fey | Summon Nature Spirit |
| Conjure Fey | Conjure Nature Spirit |

`Faerie Fire` remains unchanged because it is established Warcraft terminology and does not use `Fey` as the D&D creature-type name.

---

## 1. Classes

Approval status: **Approved**

### Available classes and display names

| Baseline rules class | Warcraft display proposal | Action |
|---|---|---|
| Barbarian | Barbarian | Keep |
| Bard | Bard | Keep |
| Cleric | Priest | Rename |
| Fighter | Warrior | Rename |
| Monk | Monk | Keep |
| Paladin | Paladin | Keep |
| Ranger | Hunter | Rename |
| Rogue | Rogue | Keep |
| Sorcerer | Sorcerer | Keep |
| Wizard | Mage | Rename |

The app should preserve the original rules class as an alias or source label, for example `Priest (Cleric)`, so guide references and 2024 rules searches remain understandable.

### Unavailable classes

| Remove | Guide ruling | Consequence |
|---|---|---|
| Artificer | Firmly prohibited | Do not convert it to Tinker. Engineering remains equipment, tools, crafting, background, and character history. |
| Druid | Firmly prohibited | Nature-oriented concepts use Ranger, Cleric, Monk, or Sorcerer. Druidic is also unavailable. |
| Warlock | Firmly prohibited | Fel magic remains dangerous and socially condemned. Do not include Warlock patrons or invocations. |

### Class feature display renames

| Baseline feature label | Warcraft proposal |
|---|---|
| Cleric Subclass | Priest Calling |
| Divine Order | Spiritual Calling |
| Channel Divinity | Channel Faith |
| Divine Intervention | Miraculous Intervention |
| Greater Divine Intervention | Greater Miracle |
| Fighter Subclass | Warrior Specialization |
| Ranger Subclass | Hunter Specialization |
| Nature's Veil | Camouflage |
| Wizard Subclass | Mage School |
| Scholar | Arcane Scholar |
| Memorize Spell | Spellbook Study |

All other feature names of retained classes already fit the setting or are important 2024 rules terms. All features belonging to Artificer, Druid, and Warlock leave with their parent classes.

---

## 2. Subclasses

Approval status: **Approved with the Warcraft terminology standard above**

### Available by default

These are the forty 2024 subclasses belonging to available classes. Names remain unchanged unless specifically listed afterward.

| Class | Default subclasses |
|---|---|
| Barbarian | Path of the Berserker; Path of the Wild Heart; Path of the World Tree; Path of the Zealot |
| Bard | College of Dance; College of Glamour; College of Lore; College of Valor |
| Priest (Cleric) | Life Domain; Light Domain; Trickery Domain; War Domain |
| Warrior (Fighter) | Battle Master; Champion; Eldritch Knight; Psi Warrior |
| Monk | Warrior of Mercy; Warrior of Shadow; Warrior of the Elements; Warrior of the Open Hand |
| Paladin | Oath of Devotion; Oath of Glory; Oath of the Ancients; Oath of Vengeance |
| Hunter (Ranger) | Beast Master; Dream Wanderer; Gloom Stalker; Huntmaster |
| Rogue | Arcane Trickster; Assassin; Soulknife; Thief |
| Sorcerer | Aberrant Sorcery; Clockwork Sorcery; Draconic Sorcery; Wild Magic Sorcery |
| Mage (Wizard) | Abjurer; Diviner; Evoker; Illusionist |

### Default subclass renames

| Parent class | Baseline subclass | Warcraft proposal | Reason |
|---|---|---|---|
| Hunter (Ranger) | Fey Wanderer | Dream Wanderer | Reframes the D&D Fey concept through the Emerald Dream and nature spirits. |
| Hunter (Ranger) | Hunter | Huntmaster | Avoids the confusing `Hunter - Hunter` class/subclass combination. |

The other default subclass names fit Warcraft without forced reskins. In particular, the Monk subclasses remain culturally neutral as required by the guide; they are not renamed to Pandaren institutions.

### Approval-required subclasses excluded from the default pack

These are legacy or other-book subclasses. The guide permits consideration but requires an individual compatibility and setting review.

- College of Spirits
- College of the Moon
- Grave Domain
- Knowledge Domain
- Banneret
- Oath of the Noble Genies
- Hollow Warden
- Winter Walker
- Phantom
- Scion of the Three
- Shadow Sorcery
- Spellfire Sorcery
- Bladesinger

No Warcraft rename is proposed until one of these options is actually approved.

### Structural correction

`Metamagic Options` is not a Sorcerer subclass. Keep its rules content with Sorcerer, but move it from the subclass collection into a Sorcerer option collection.

### Subclass records removed with unavailable classes

| Parent class | Records excluded |
|---|---|
| Artificer | Alchemist; Armorer; Artillerist; Battle Smith; Cartographer; Reanimator |
| Druid | Circle of the Land; Circle of the Moon; Circle of the Sea; Circle of the Stars |
| Warlock | Archfey Patron; Celestial Patron; Eldritch Invocation Options; Fiend Patron; Great Old One Patron; Undead Patron |

---

## 3. Ancestries and traits

Approval status: **Approved**

### Available by default

| Baseline | Campaign presentation | Required adjustment |
|---|---|---|
| Human | Human | Keep the 2024 Human mechanics. Homeland is chosen narratively from the guide's permitted kingdoms. |
| Dwarf | Dwarf | Keep one mechanical ancestry. Ironforge and Wildhammer are cultural choices, not separate mechanics. |
| Gnome | Gnome | Restrict the lineage to Rock Gnome. |
| Elf | High Elf | Rename the display ancestry and restrict Elven Lineage to High Elf. |

### Retained trait changes

| Ancestry | Action | Baseline trait | Warcraft proposal |
|---|---|---|---|
| Dwarf | Remove | Darkvision | No replacement. |
| High Elf | Remove | Darkvision | No replacement. |
| Gnome | Remove | Darkvision | No replacement. |
| High Elf | Rename | Elven Lineage | High Elf Lineage |
| High Elf | Rename | Fey Ancestry | Elven Resolve (`Fey Ancestry` rules alias) |
| Gnome | Rename | Gnomish Lineage | Rock Gnome Lineage |
| Gnome | Remove | Forest Gnome | Not permitted by the campaign guide. |
| Gnome | Rename | Rock Gnome | Rock Gnome Gifts |

All other Human, Dwarf, High Elf, and Rock Gnome trait names remain unchanged. Their descriptions still need a later terminology pass.

### Passive ancestry Darkvision removal

Remove every ancestry/species trait named `Darkvision`. For the default pack, this removes the trait from Dwarf, High Elf, and Gnome. Human does not have the trait. An approval-only Half-Elf using High Elf mechanics also loses the ancestry's Darkvision trait.

This rule applies to any ancestry added in a future optional module: ancestry alone never grants passive Darkvision. No automatic replacement trait is proposed.

This restriction does **not** remove or alter:

- The Darkvision spell
- Path of the Wild Heart's Owl benefit
- Gloom Stalker's Umbral Sight
- Diviner's Third Eye option
- Shadow Sorcery's Power of Shadow if that subclass is later approved
- Arcane Eye or summoned-creature senses
- Darkvision possessed by monsters or NPCs
- Text in Darkness, Private Sanctum, or other rules that interacts with Darkvision

### Half-Elf - approval required, no standalone ancestry

Half-Elves are rare and require GM approval. An approved Half-Elf chooses either Human or High Elf mechanics. Remove `Khoravar` rather than renaming it to Half-Elf; its distinct mechanics contradict the canon guide.

### Entire ancestry removals

| Baseline ancestry removed | Traits removed with it | Reason |
|---|---|---|
| Aasimar | Celestial Resistance; Darkvision; Healing Hands; Light Bearer; Celestial Revelation; Heavenly Wings; Inner Radiance; Necrotic Shroud | Not a permitted Grand Coalition opening ancestry. |
| Boggart | Darkvision; Fey Ancestry; Fury of the Small; Nimble Escape | Goblins are expressly unavailable. |
| Changeling | Changeling Instincts; Shape-Shifter | Not listed as an available ancestry. |
| Dhampir | Darkvision; Spider Climb; Trace of Undeath; Vampiric Bite; Drain; Strengthen | Not listed as an available ancestry. |
| Dragonborn | Draconic Ancestry; Breath Weapon; Damage Resistance; Darkvision; Draconic Flight | Dragonborn are expressly unavailable. Do not reskin as Dracthyr. |
| Faerie | Fairy Magic; Flight | Not listed as an available ancestry. |
| Flamekin | Darkvision; Fire Resistance; Reach to the Blaze | Not listed as an available ancestry. |
| Goliath | Giant Ancestry; Cloud's Jaunt; Fire's Burn; Frost's Chill; Hill's Tumble; Stone's Endurance; Storm's Thunder; Large Form; Powerful Build | Goliaths are expressly unavailable. Do not reskin as Vrykul. |
| Halfling | Brave; Halfling Nimbleness; Luck; Naturally Stealthy | Halflings are expressly unavailable. |
| Hexblood | Darkvision; Eerie Token; Distant Message; Remote Viewing; Hex Magic | Not listed as an available ancestry. |
| Kalashtar | Dual Mind; Mental Discipline; Mind Link; Severed from Dreams | Not listed as an available ancestry. |
| Khoravar | Darkvision; Fey Ancestry; Fey Gift; Lethargy Resilience; Skill Versatility | Half-Elves use approved Human or Elf mechanics instead. |
| Lorwyn Changeling | Shape Self; Darkvision; Delightful Imitator; Unpredictable Movement | Lorwyn-specific and not listed as available. |
| Lupin | Darkvision; Feral Pounce; Howl; Werewolf Instincts | Worgen are expressly unavailable. |
| Orc | Adrenaline Rush; Darkvision; Relentless Endurance | Orcs are expressly unavailable as opening player characters. |
| Reborn | Escaped Death; Everlasting; Knowledge from a Past Life; Strange Endurance | Not listed as an available ancestry. Do not reskin as Forsaken. |
| Rimekin | Cold Fire Magic; Cold Resistance; Darkvision | Not listed as an available ancestry. |
| Shifter | Bestial Instincts; Darkvision; Shifting; Beasthide; Longtooth; Swiftstride; Wildhunt | Not listed as available and cannot bypass the Worgen restriction. |
| Tiefling | Darkvision; Fiendish Legacy; Otherworldly Presence | Tieflings are expressly unavailable. |
| Warforged | Construct Resilience; Integrated Protection; Sentry's Rest; Specialized Design; Tireless | Not listed as an available ancestry. Do not reskin as Mechagnome. |

Night Elf, Tauren, Troll, Draenei, and Worgen must not be added as original opening options because the guide expressly makes them unavailable. Other future ancestries require a campaign-guide revision before pack inclusion.

---

## 4. Backgrounds

Approval status: **Approved**

### Available campaign backgrounds

| Baseline package | Campaign display name | Action |
|---|---|---|
| Soldier | War Veteran | Rename |
| Artisan | Reconstruction Worker | Rename |
| Farmer | Farmer | Keep |
| Guard | Crown Guard | Rename |
| Guide | Frontier Guide | Rename |
| Wayfarer | Refugee or Returnee | Rename |
| Criminal | Outlaw or Smuggler | Rename |
| Noble | Court-Born | Rename |
| Scribe | Royal Clerk | Rename |
| Sage | Dalaran Student | Rename |
| Acolyte | Faithful Initiate | Rename |
| Entertainer | Performer or Herald | Rename |
| Merchant | Merchant | Keep |
| Sailor | Seafarer | Rename |
| Hermit | Ascetic | Rename |

The display name changes only the character's place in the Warcraft world. Each entry retains the linked 2024 mechanical package.

### Archaeologist replacement

Do not keep the Wikidot Archaeologist mechanics unchanged. Replace that record with the canon custom background from the vault:

| Component | Canon campaign value |
|---|---|
| Name | Archaeologist |
| Abilities | Constitution, Intelligence, Wisdom |
| Origin Feat | Skilled |
| Skills | History, Investigation |
| Tool | Cartographer's Tools |
| Equipment | 50 gp |

This is a mechanical replacement requiring its own approval; it is not merely a rename.

### Backgrounds excluded from the default pack

The following 45 Wikidot backgrounds are not among the guide-approved packages:

- Aberrant Heir
- Carouser
- Charlatan
- Chondathan Freebooter
- Dead Magic Dweller
- Dragon Cultist
- Emerald Enclave Caretaker
- Flaming Fist Mercenary
- Genie Touched
- Harper
- Haunted One
- House Agent
- House Cannith Heir
- House Deneith Heir
- House Ghallanda Heir
- House Jorasco Heir
- House Kundarak Heir
- House Lyrandar Heir
- House Medani Heir
- House Orien Heir
- House Phiarlan Heir
- House Sivis Heir
- House Tharashk Heir
- House Thuranni Heir
- House Vadalis Heir
- Ice Fisher
- Inquisitive
- Investigator
- Knight Of The Gauntlet
- Lords' Alliance Vassal
- Lorwyn Expert
- Mist Wanderer
- Moonwell Pilgrim
- Mulhorandi Tomb Raider
- Mythalkeeper
- Pact Seeker
- Purple Dragon Squire
- Rashemi Wanderer
- Shadowmasters Exile
- Shadowmoor Expert
- Spellfire Initiate
- Spirit Medium
- Vampire Devotee
- Vampire Survivor
- Zhentarim Mercenary

A player may still propose a custom background under the canon custom-background procedure. That does not make the removed Wikidot package automatically available.

---

## 5. Feats

Approval status: **Approved after correcting the retained core set to 75 feats**

### Available by default

Retain the 2024 Player's Handbook feat set represented in the baseline: 10 Origin feats, 43 General feats, 10 Fighting Style feats, and 12 Epic Boons (75 total). These names are generic rules terminology and already fit the setting.

Normalize three baseline spellings to their 2024 forms:

| Baseline | Correct rules name |
|---|---|
| Fey Touched | Dream-Touched (`Fey-Touched` rules alias) |
| Shadow Touched | Shadow-Touched |
| Two Weapon Fighting | Two-Weapon Fighting |

The guide specifically confirms that custom backgrounds may choose Alert, Crafter, Healer, Lucky, Magic Initiate, Musician, Savage Attacker, Skilled, Tavern Brawler, or Tough. `Magic Initiate: Druid` remains legal even though Druid itself is not.

### Dragonmark feats - unavailable

Remove all 27 Dragonmark feats. They are setting-locked and have no approved campaign equivalent:

- Aberrant Dragonmark
- Greater Aberrant Mark
- Potent Dragonmark
- Mark of Detection
- Mark of Finding
- Mark of Handling
- Mark of Healing
- Mark of Hospitality
- Mark of Making
- Mark of Passage
- Mark of Scribing
- Mark of Sentinel
- Mark of Shadow
- Mark of Storm
- Mark of Warding
- Greater Mark of Detection
- Greater Mark of Finding
- Greater Mark of Handling
- Greater Mark of Healing
- Greater Mark of Hospitality
- Greater Mark of Making
- Greater Mark of Passage
- Greater Mark of Scribing
- Greater Mark of Sentinel
- Greater Mark of Shadow
- Greater Mark of Storm
- Greater Mark of Warding

### Other approval-required feats excluded from the default pack

These 73 supplemental feats may be reconsidered individually, but the player guide does not make them automatically available.

#### Dark Gifts

- Aberrant Anatomy
- Echoing Soul
- Gathered Whispers
- Living Shadow
- Mist Walker
- Second Skin
- Symbiotic Being
- Touch of Death
- Watchers

#### Epic Boons

- Boon of Blazing Dawn
- Boon of Bloodshed
- Boon of Bountiful Health
- Boon of Communication
- Boon of Desperate Resilience
- Boon of Exquisite Radiance
- Boon of Fluid Forms
- Boon of Fortune's Favor
- Boon of Looming Shadows
- Boon of Misty Escape
- Boon of Poison Mastery
- Boon of Revelry
- Boon of Siberys
- Boon of Terror
- Boon of the Bright Sun
- Boon of the Furious Storm
- Boon of the Soul Drinker

#### Fighting Styles

- Pack Fighting
- Prone Fighting

#### General feats

- Bloodlust
- Bomber
- Cloying Mists
- Cold Caster
- Delicious Pain
- Dragonscarred
- Enclave Magic
- Fairy Trickster
- Genie Magic
- Harper Teamwork
- Light Bringer
- Lordly Resolve
- Love Bites
- Mythal Touched
- Order's Resilience
- Purple Dragon Commandant
- Putrefy
- Rebuke
- Shifting Combatant
- Spellfire Adept
- Street Justice
- Tactical Combatant
- Treacherous Allure
- Vampire Touched
- Zhentarim Tactics

#### Origin feats

- Child of the Sun
- Cult of the Dragon Initiate
- Emerald Enclave Fledgling
- Harper Agent
- Lords' Alliance Agent
- Purple Dragon Rook
- Shadowmoor Hexer
- Sharp Eye
- Spellfire Spark
- Survivor
- Tireless Reveler
- Tyro of the Gauntlet
- Vampire Hunter
- Vampire's Plaything
- Zhentarim Ruffian

#### Planar Pacts

- Fey Pact
- Fey Sentinel
- Infernal Bulwark
- Infernal Dragoon
- Infernal Pact

No Warcraft renames are proposed for excluded feats. Renaming them would imply that they had already passed the required mechanical and setting review.

---

## 6. Spells

Approval status: **Approved**

### Availability rule

- Keep the revised 2024 core spell catalog for available classes.
- Keep Druid-list spells because Bard features and the explicitly permitted `Magic Initiate: Druid` can grant access to that list. Keeping the list does not make the Druid class available.
- Remove core spells that are accessible only through the prohibited Warlock class.
- Exclude supplemental spells until they receive the other-book or third-party approval required by the guide.

### Warlock-only spells removed

- Eldritch Blast
- Armor of Agathys
- Arms of Hadar
- Hellish Rebuke
- Hex
- Hunger of Hadar

These six spells have no available class in the baseline after Warlock is removed. A future approved feature may reintroduce an individual spell without restoring the Warlock class.

### Supplemental spells excluded pending approval

`Bane` remains available because it is a core Cleric/Bard spell. The other 28 Wikidot additions are excluded from the default campaign pack:

- Buzzing Bee
- Insidious Rhythm
- Spellfire Flare
- Wardaway
- Death Armor
- Deryan's Helpful Homunculi
- Elminster's Elusion
- Homunculus Servant
- Searing Orb
- Tortoise Shell
- Astral Flood
- Cacophonic Shield
- Conjure Constructs
- Laeral's Silver Lance
- Sylune's Viper
- Backlash
- Doomtide
- Spellfire Storm
- Sticks to Snakes
- Alustriel's Mooncloak
- Songal's Elemental Suffusion
- Dirge
- Elminster's Effulgent Spheres
- Leomund's Lamentable Belaborment
- Simbul's Synostodweomer
- Void Star
- Holy Star of Mystra
- Blade Of Disaster

### Available spell renames - D&D proper nouns

| Level | Baseline | Warcraft proposal |
|---:|---|---|
| 1 | Tasha's Hideous Laughter | Darkmoon Laughter |
| 1 | Tenser's Floating Disk | Arcane Disk |
| 2 | Melf's Acid Arrow | Acid Arrow |
| 2 | Nystul's Magic Aura | False Aura |
| 3 | Leomund's Tiny Hut | Mage's Shelter |
| 4 | Evard's Black Tentacles | Void Tentacles |
| 4 | Leomund's Secret Chest | Secret Chest |
| 4 | Mordenkainen's Faithful Hound | Arcane Watchhound |
| 4 | Mordenkainen's Private Sanctum | Mage's Private Sanctum |
| 4 | Otiluke's Resilient Sphere | Arcane Sphere |
| 5 | Bigby's Hand | Arcane Hand |
| 5 | Jallarzi's Storm of Radiance | Naaru's Storm of Radiance |
| 5 | Rary's Telepathic Bond | Telepathic Bond |
| 5 | Yolande's Regal Presence | Regal Presence |
| 6 | Drawmij's Instant Summons | Instant Summons |
| 6 | Otiluke's Freezing Sphere | Freezing Sphere |
| 6 | Otto's Irresistible Dance | Irresistible Dance |
| 6 | Tasha's Bubbling Cauldron | Witch's Bubbling Cauldron |
| 7 | Mordenkainen's Magnificent Mansion | Mage's Magnificent Mansion |
| 7 | Mordenkainen's Sword | Arcane Sword |

### Available spell renames - Warcraft vocabulary

| Level | Baseline | Warcraft proposal |
|---:|---|---|
| 0 | Prestidigitation | Minor Magic |
| 0 | Shillelagh | Wildwood Weapon |
| 0 | Thaumaturgy | Minor Miracle |
| 1 | Magic Missile | Arcane Missiles |
| 2 | Find Steed | Summon Charger |
| 2 | Spiritual Weapon | Summon Holy Weapon |
| 3 | Summon Fey | Summon Nature Spirit |
| 4 | Ice Storm | Blizzard |
| 4 | Summon Aberration | Summon Voidspawn |
| 5 | Summon Celestial | Summon Lightspawn |
| 6 | Conjure Fey | Conjure Nature Spirit |
| 6 | Summon Fiend | Summon Demon |
| 7 | Conjure Celestial | Call Naaru |
| 9 | Astral Projection | Spirit Projection |

All other available spell names remain unchanged because they are generic fantasy terminology or already fit Warcraft. Spell class lists will use both the Warcraft display label and original rules class identity to avoid breaking references.

---

## 7. Equipment

Approval status: **Approved**

### Campaign availability rules

- Keep ordinary 2024 weapons, armor, tools, adventuring gear, mounts, vehicles, ammunition, and class/background equipment.
- Keep Pistol, Musket, and firearm bullets. The guide expressly permits firearms, but a character still needs proficiency, a supported history, access, and sufficient funds.
- Keep magic-item and specialized-equipment records for later character tracking, but do not present them as unrestricted starting choices.
- No character starts with a magic item without explicit approval.
- Automatic weapons and abundant explosives are unavailable at character creation.

### Supplemental equipment excluded pending approval

These twelve other-setting or supplemental entries are not part of the default player pack:

- Bright Fungal Cloak
- Desert Clothing
- Devil Mask
- Garb of Light and Shadow
- Genie Robe
- Locking Spellbook
- Monster Camouflage
- Warm Fungal Clothing
- Winter Camouflage
- Lyrandar Air Cruiser
- Lyrandar Skyskiff
- Strider Airship

### Equipment renames

| Baseline | Warcraft proposal |
|---|---|
| Airship | Gnomish Airship |
| Axe Beak | Tallstrider |
| Dragonchess | Azerothian War Game |
| Druidic Focus | Nature Focus |
| Elephant | Elekk |
| Flying Snake | Wind Serpent |
| Lolth's Sting | Shadra's Sting |
| Purple Worm Poison | Deep-Worm Poison |
| Three-dragon Ante | Three-Kingdom Ante |

All other retained equipment names remain unchanged.

---

## 8. Required follow-up after approval

Approval status: **Approved**

1. Copy the Wikidot baseline to a new pack ID; never overwrite `dnd2024-wikidot`.
2. Build the default pack from only the `Available` material in this changelog.
3. Keep approval-required material out of the default player menus. If desired later, create a separate optional campaign module for individually approved choices.
4. Apply removals before renames, then audit every ancestry trait, background feat, spell class, and equipment reference for orphaned IDs.
5. Preserve original 2024 class and spell names as searchable aliases wherever a Warcraft display name is used.
6. Rewrite descriptions that reference unavailable ancestries, prohibited classes, D&D settings, deities, planes, or organizations.
7. Replace Archaeologist with the canon vault mechanics and validate its abilities, skills, feat, tool, and 50 gp equipment choice.
8. Ensure Rock Gnome and High Elf are the only selectable Gnome and Elf lineages in the default pack.
9. Remove only ancestry/species Darkvision traits. Do not alter Darkvision gained from spells, features, summons, monsters, or other sources.
10. Amend the Character Creation Guide during implementation so it clearly records the no-passive-ancestry-Darkvision house rule.
11. Verify Bard and Sorcerer spell access; do not repeat the first draft's incorrect removal of their class-exclusive spells.
12. Produce a second approval changelog for all description and mechanical edits before applying those edits.

## Approval checklist

- [x] Warcraft terminology standard for Fey concepts approved
- [x] Vault availability rules accepted as authoritative
- [x] Available class list and four class display renames approved
- [x] Artificer, Druid, and Warlock removal approved
- [x] Default, approval-required, and removed subclass lists approved
- [x] Opening ancestry restrictions and Half-Elf handling approved
- [x] Passive ancestry/species Darkvision removal approved
- [x] Background list and campaign display names approved
- [x] Archaeologist mechanical replacement approved
- [x] Default feat list and supplemental exclusions approved
- [x] Spell availability and six Warlock-only removals approved
- [x] Spell renames approved
- [x] Equipment availability rules, exclusions, and renames approved
- [x] Separate optional-module policy for future GM approvals approved
