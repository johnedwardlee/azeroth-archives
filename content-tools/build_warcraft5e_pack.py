#!/usr/bin/env python3
"""Build the approved Warcraft 5E campaign pack from the Wikidot baseline."""

from __future__ import annotations

import argparse
import copy
import json
import re
from pathlib import Path
from typing import Any, Iterable

from build_dnd2024_pack import clean_description as clean_pdf_description


PROJECT = Path(__file__).resolve().parents[1]
DEFAULT_BASELINE = PROJECT / "content-packs" / "dnd2024-wikidot.w5e"
DEFAULT_PHB = PROJECT / "content-packs" / "dnd5e-2024-phb.w5e"
DEFAULT_SPELL_CACHE = PROJECT / "content-source" / "warcraft5e-wikidot-spells.json"
DEFAULT_OUTPUT = PROJECT / "content-packs" / "warcraft5e-campaign.w5e"

ANCESTRY_IDS = {"human", "dwarf", "gnome", "elf"}
CLASS_IDS = {
    "barbarian",
    "bard",
    "cleric",
    "fighter",
    "monk",
    "paladin",
    "ranger",
    "rogue",
    "sorcerer",
    "wizard",
}
BACKGROUND_IDS = {
    "soldier",
    "artisan",
    "farmer",
    "guard",
    "guide",
    "wayfarer",
    "criminal",
    "noble",
    "scribe",
    "sage",
    "acolyte",
    "entertainer",
    "merchant",
    "sailor",
    "hermit",
    "archaeologist",
}

CLASS_NAMES = {
    "cleric": "Priest",
    "fighter": "Warrior",
    "ranger": "Hunter",
    "wizard": "Mage",
}

SUBCLASS_NAMES: dict[str, set[str]] = {
    "barbarian": {"Path of the Berserker", "Path of the Wild Heart", "Path of the World Tree", "Path of the Zealot"},
    "bard": {"College of Dance", "College of Glamour", "College of Lore", "College of Valor"},
    "cleric": {"Life Domain", "Light Domain", "Trickery Domain", "War Domain"},
    "fighter": {"Battle Master", "Champion", "Eldritch Knight", "Psi Warrior"},
    "monk": {"Warrior of Mercy", "Warrior of Shadow", "Warrior of the Elements", "Warrior of the Open Hand"},
    "paladin": {"Oath of Devotion", "Oath of Glory", "Oath of the Ancients", "Oath of Vengeance"},
    "ranger": {"Beast Master", "Fey Wanderer", "Gloom Stalker", "Hunter"},
    "rogue": {"Arcane Trickster", "Assassin", "Soulknife", "Thief"},
    "sorcerer": {"Aberrant Sorcery", "Clockwork Sorcery", "Draconic Sorcery", "Wild Magic Sorcery"},
    "wizard": {"Abjurer", "Diviner", "Evoker", "Illusionist"},
}

SUBCLASS_DISPLAY_NAMES = {
    "ranger-fey-wanderer": "Dream Wanderer",
    "ranger-hunter": "Huntmaster",
}

FEATURE_DISPLAY_NAMES = {
    "Cleric Subclass": "Priest Calling",
    "Divine Order": "Spiritual Calling",
    "Channel Divinity": "Channel Faith",
    "Divine Intervention": "Miraculous Intervention",
    "Greater Divine Intervention": "Greater Miracle",
    "Fighter Subclass": "Warrior Specialization",
    "Ranger Subclass": "Hunter Specialization",
    "Nature's Veil": "Camouflage",
    "Wizard Subclass": "Mage School",
    "Scholar": "Arcane Scholar",
    "Memorize Spell": "Spellbook Study",
    "Fey Wanderer Spells": "Dream Wanderer Spells",
    "Fey Reinforcements": "Nature Spirit Reinforcements",
}

BACKGROUND_NAMES = {
    "soldier": "War Veteran",
    "artisan": "Reconstruction Worker",
    "guard": "Crown Guard",
    "guide": "Frontier Guide",
    "wayfarer": "Refugee or Returnee",
    "criminal": "Outlaw or Smuggler",
    "noble": "Court-Born",
    "scribe": "Royal Clerk",
    "sage": "Dalaran Student",
    "acolyte": "Faithful Initiate",
    "entertainer": "Performer or Herald",
    "sailor": "Seafarer",
    "hermit": "Ascetic",
}

FEAT_NAMES = {
    "fey-touched": "Dream-Touched",
    "shadow-touched": "Shadow-Touched",
    "two-weapon-fighting": "Two-Weapon Fighting",
}

WARLOCK_ONLY_SPELLS = {
    "Eldritch Blast",
    "Armor of Agathys",
    "Arms of Hadar",
    "Hellish Rebuke",
    "Hex",
    "Hunger of Hadar",
}

SUPPLEMENTAL_SPELLS = {
    "Buzzing Bee",
    "Insidious Rhythm",
    "Spellfire Flare",
    "Wardaway",
    "Death Armor",
    "Deryan's Helpful Homunculi",
    "Elminster's Elusion",
    "Homunculus Servant",
    "Searing Orb",
    "Tortoise Shell",
    "Astral Flood",
    "Cacophonic Shield",
    "Conjure Constructs",
    "Laeral's Silver Lance",
    "Sylune's Viper",
    "Backlash",
    "Doomtide",
    "Spellfire Storm",
    "Sticks to Snakes",
    "Alustriel's Mooncloak",
    "Songal's Elemental Suffusion",
    "Dirge",
    "Elminster's Effulgent Spheres",
    "Leomund's Lamentable Belaborment",
    "Simbul's Synostodweomer",
    "Void Star",
    "Holy Star of Mystra",
    "Blade Of Disaster",
}

SPELL_NAMES = {
    "Tasha's Hideous Laughter": "Darkmoon Laughter",
    "Tenser's Floating Disk": "Arcane Disk",
    "Melf's Acid Arrow": "Acid Arrow",
    "Nystul's Magic Aura": "False Aura",
    "Leomund's Tiny Hut": "Mage's Shelter",
    "Evard's Black Tentacles": "Void Tentacles",
    "Leomund's Secret Chest": "Secret Chest",
    "Mordenkainen's Faithful Hound": "Arcane Watchhound",
    "Mordenkainen's Private Sanctum": "Mage's Private Sanctum",
    "Otiluke's Resilient Sphere": "Arcane Sphere",
    "Bigby's Hand": "Arcane Hand",
    "Jallarzi's Storm of Radiance": "Naaru's Storm of Radiance",
    "Rary's Telepathic Bond": "Telepathic Bond",
    "Yolande's Regal Presence": "Regal Presence",
    "Drawmij's Instant Summons": "Instant Summons",
    "Otiluke's Freezing Sphere": "Freezing Sphere",
    "Otto's Irresistible Dance": "Irresistible Dance",
    "Tasha's Bubbling Cauldron": "Witch's Bubbling Cauldron",
    "Mordenkainen's Magnificent Mansion": "Mage's Magnificent Mansion",
    "Mordenkainen's Sword": "Arcane Sword",
    "Prestidigitation": "Minor Magic",
    "Shillelagh": "Wildwood Weapon",
    "Thaumaturgy": "Minor Miracle",
    "Magic Missile": "Arcane Missiles",
    "Find Steed": "Summon Charger",
    "Spiritual Weapon": "Summon Holy Weapon",
    "Summon Fey": "Summon Nature Spirit",
    "Ice Storm": "Blizzard",
    "Summon Aberration": "Summon Voidspawn",
    "Summon Celestial": "Summon Lightspawn",
    "Conjure Fey": "Conjure Nature Spirit",
    "Summon Fiend": "Summon Demon",
    "Conjure Celestial": "Call Naaru",
    "Astral Projection": "Spirit Projection",
}

EQUIPMENT_EXCLUSIONS = {
    "Bright Fungal Cloak",
    "Desert Clothing",
    "Devil Mask",
    "Garb of Light and Shadow",
    "Genie Robe",
    "Locking Spellbook",
    "Monster Camouflage",
    "Warm Fungal Clothing",
    "Winter Camouflage",
    "Lyrandar Air Cruiser",
    "Lyrandar Skyskiff",
    "Strider Airship",
}

EQUIPMENT_NAMES_BY_ID = {
    "airship": "Gnomish Airship",
    "axe-beak": "Tallstrider",
    "dragonchess": "Azerothian War Game",
    "druidic-focus": "Nature Focus",
    "elephant": "Elekk",
    "flying-snake": "Wind Serpent",
    "lolths-sting": "Shadra's Sting",
    "purple-worm-poison": "Deep-Worm Poison",
    "three-dragon-ante": "Three-Kingdom Ante",
}

SPELL_CLASS_NAMES = {
    "Cleric": "Priest",
    "Fighter": "Warrior",
    "Ranger": "Hunter",
    "Wizard": "Mage",
}

CLASS_OVERVIEWS = {
    "barbarian": "As a Barbarian, you channel primal physical and spiritual force through Rage. That power can reflect predatory instinct, a storm's fury, ancestral strength, or another force rooted in you and Azeroth.",
    "bard": "As a Bard, you shape ambient magic through practiced rhythm, voice, memory, performance, and shared emotion. You may be a storyteller, herald, musician, chronicler, diplomat, military signaler, funeral singer, skald, or keeper of oral history.",
    "cleric": "As a Priest, you work miracles through faith, sacred duty, and spiritual tradition. Your calling should be grounded in a Warcraft-appropriate belief or practice chosen with the GM.",
    "fighter": "As a Warrior, you master weapons, armor, battlefield tactics, and disciplined physical training. Your expertise can come from military service, a cultural fighting tradition, personal tutelage, or hard-earned experience.",
    "monk": "As a Monk, you develop extraordinary control over body, mind, and inner spirit through spiritual martial training rooted in your character's own culture rather than any required real-world aesthetic or tradition.",
    "paladin": "As a Paladin, you wield martial and sacred power through an oath supported by faith, duty, and conviction. Your oath and source of power must fit the campaign's Warcraft traditions.",
    "ranger": "As a Hunter, you combine wilderness training, tracking, weapon skill, and practical nature magic. You may serve as a scout, monster hunter, guide, warden, or protector of an isolated community.",
    "rogue": "As a Rogue, you survive through skill, precision, adaptability, and an eye for opportunity. Your talents may come from criminal experience, intelligence work, exploration, military scouting, or another demanding trade.",
    "sorcerer": "As a Sorcerer, you wield embodied and instinctive magic. Your power may come from ley-line exposure, magical warfare, an unstable artifact, inherited alteration, draconic influence, arcane experimentation, or an extreme magical event.",
    "wizard": "As a Mage, you master arcane magic through formal study and disciplined practice. Your training may come from Dalaran, high-elven instruction, military service, private tutelage, or recovered wartime knowledge.",
}

SUBCLASS_OVERVIEWS = {
    "barbarian-path-of-the-berserker": "You direct your Rage toward overwhelming physical fury and thrive in the chaos of close combat.",
    "barbarian-path-of-the-wild-heart": "You deepen your kinship with animals and let primal magic strengthen that connection while you rage.",
    "barbarian-path-of-the-world-tree": "You draw strength from Azeroth's Great Trees and the roots that connect them through the Emerald Dream.",
    "barbarian-path-of-the-zealot": "You channel a campaign-appropriate faith, sacred tradition, or spiritual calling into battle.",
    "bard-college-of-dance": "You express magic through disciplined movement, agility, speed, and grace, turning performance into a fluid combat art.",
    "bard-college-of-glamour": "You wield Dream magic that shapes emotion, beauty, wonder, and fear.",
    "bard-college-of-lore": "You collect spells, secrets, histories, and tales from every social class, then use that knowledge to expose lies and influence events.",
    "bard-college-of-valor": "You preserve heroic deeds through story and song, traveling close to danger so courage and sacrifice are not forgotten.",
    "cleric-life-domain": "You channel sacred power to preserve life, heal wounds, and restore those under your protection.",
    "cleric-light-domain": "You wield sacred radiance and cleansing flame to reveal truth, dispel darkness, and protect others.",
    "cleric-trickery-domain": "You use deception, illusion, and stealth to humble tyrants, free captives, and overcome enemies through cunning.",
    "cleric-war-domain": "You serve a faith or sacred tradition concerned with courage, discipline, protection, and the difficult realities of war.",
    "fighter-battle-master": "You combine disciplined martial technique with a close study of tactics, history, and the changing conditions of battle.",
    "fighter-champion": "You pursue physical and martial excellence through relentless training, resilience, and decisive attacks.",
    "fighter-eldritch-knight": "You combine martial mastery with formal arcane study, using spells to defend yourself and control the battlefield.",
    "fighter-psi-warrior": "You awaken disciplined psychic power and use it to reinforce attacks, move creatures and objects, and create barriers of mental force.",
    "monk-warrior-of-mercy": "You manipulate life energy to heal the suffering and bring a swift end to dangerous foes, often adopting a symbolic mask or identity.",
    "monk-warrior-of-shadow": "You train with shadow magic and techniques associated with places touched by the Shadowlands.",
    "monk-warrior-of-the-elements": "You channel powers associated with Warcraft's Elemental Plane.",
    "monk-warrior-of-the-open-hand": "You master unarmed combat techniques that push, trip, disable, and redirect opponents while protecting your own body.",
    "paladin-oath-of-devotion": "You bind yourself to justice, honorable conduct, and the protection of others, holding yourself to an exacting standard.",
    "paladin-oath-of-glory": "You pursue heroic deeds through disciplined training and inspire your companions to meet danger with confidence.",
    "paladin-oath-of-the-ancients": "Your ancient oath defends life, hope, and the Light without belonging to any single ancestry.",
    "paladin-oath-of-vengeance": "You swear to pursue those responsible for grievous cruelty and bring dangerous, unrepentant enemies to justice.",
    "ranger-beast-master": "You form a mystical bond with a primal beast and fight beside it as a trusted companion.",
    "ranger-fey-wanderer": "Your Dream Wanderer magic may come from a Wild God, a Nature Spirit, or a transformative encounter with the Emerald Dream.",
    "ranger-gloom-stalker": "You master darkness and shadow magic, often operating in places touched by the Shadowlands.",
    "ranger-hunter": "You study dangerous prey and adapt your techniques to protect people and the wilds from destructive creatures.",
    "rogue-arcane-trickster": "You reinforce stealth, agility, and misdirection with arcane magic suited to infiltration and clever problem-solving.",
    "rogue-assassin": "You train in stealth, poison, disguise, and precise attacks to defeat dangerous targets with ruthless efficiency.",
    "rogue-soulknife": "You manifest psychic blades and other mental talents, turning inner psionic power into a precise roguish tool.",
    "rogue-thief": "You specialize in burglary, exploration, quick hands, and the practical use of treasures recovered from dangerous places.",
    "sorcerer-aberrant-sorcery": "Your Aberrant Sorcery may arise from Void influence, a psychic relic, an aberrant creature, or another approved mental transformation.",
    "sorcerer-clockwork-sorcery": "Your Clockwork Sorcery may arise from Titanic machinery, ordered arcane forces, or exposure to a titan-forged site or artifact.",
    "sorcerer-draconic-sorcery": "Your innate magic carries draconic influence inherited, bestowed, absorbed from a place of power, or awakened through contact with a dragon's legacy.",
    "sorcerer-wild-magic-sorcery": "Your Wild Magic Sorcery may arise from ley-line instability, magical warfare, an unstable artifact, chaotic arcane exposure, or demonic corruption survived rather than embraced.",
    "wizard-abjurer": "You specialize in arcane wards that block hostile magic, banish dangerous influences, and protect companions and locations.",
    "wizard-diviner": "You study spells that reveal the past, examine distant places, uncover hidden knowledge, and anticipate possible futures.",
    "wizard-evoker": "You specialize in forceful elemental magic and learn to shape destructive spells around allies and battlefield objectives.",
    "wizard-illusionist": "You specialize in subtle magic that deceives the senses, manipulates perception, and makes impossible scenes appear real.",
}

ANCESTRY_TRAIT_DESCRIPTIONS = {
    "elf-elven-lineage": (
        "You know Minor Magic. Whenever you finish a Long Rest, you can replace that cantrip with another cantrip from the Mage spell list. "
        "At level 3, you always have Detect Magic prepared. At level 5, you always have Misty Step prepared. You can cast each lineage spell once without a spell slot, regaining that use when you finish a Long Rest, and you can also cast it with your available spell slots. Choose Intellect, Spirit, or Charisma as the spellcasting ability for these spells."
    ),
    "elf-fey-ancestry": "You have Advantage on saving throws you make to avoid or end the Charmed condition.",
    "gnome-gnomish-lineage": "Your lineage is Rock Gnome. Choose Intellect, Spirit, or Charisma as the spellcasting ability for the spells granted by your Rock Gnome Gifts.",
    "gnome-rock-gnome": (
        "You know Mending and Minor Magic. You can spend 10 minutes casting Minor Magic to create a Tiny clockwork device with AC 5 and 1 Hit Point, such as a toy, fire starter, or music box. Choose one Minor Magic effect when you create it; the device produces that effect when a creature uses a Bonus Action to activate it by touch. You can have up to three devices at once. Each device falls apart after 8 hours or when you dismantle it with a touch as a Utilize action."
    ),
}

FEATURE_TEXT_OVERRIDES = {
    "barbarian-1-rage": (
        "As a Bonus Action, you can enter a Rage if you aren't wearing Heavy armor. You have the number of uses shown for your Barbarian level, regain one expended use after a Short Rest, and regain all expended uses after a Long Rest. While raging, you have Resistance to Bludgeoning, Piercing, and Slashing damage; you add your Rage Damage bonus whenever a Strength-based weapon attack or Unarmed Strike deals damage; and you have Advantage on Strength checks and Strength saving throws. You can't maintain Concentration or cast spells. The Rage lasts until the end of your next turn and extends to the end of each following turn if you attack an enemy, force an enemy to make a saving throw, or use a Bonus Action to extend it. It lasts no longer than 10 minutes and ends early if you have the Incapacitated condition or don Heavy armor."
    ),
    "cleric-2-channel-divinity": (
        "You can channel sacred power to create a Channel Faith effect. You begin with Divine Spark and Turn Undead, and other Priest features can grant additional effects. You have two uses at level 2, three at level 6, and four at level 18. You regain one expended use after a Short Rest and all expended uses after a Long Rest."
    ),
    "monk-2-monks-focus": (
        "You have a number of Focus Points equal to your Monk level. You regain all expended points after a Short or Long Rest. Your Focus save DC equals 8 plus your Spirit modifier and Proficiency Bonus. Flurry of Blows costs 1 point and lets you make two Unarmed Strikes as a Bonus Action. Patient Defense lets you Disengage as a Bonus Action, or spend 1 point to Disengage and Dodge as the same Bonus Action. Step of the Wind lets you Dash as a Bonus Action, or spend 1 point to Disengage and Dash as the same Bonus Action while doubling your jump distance for the turn."
    ),
    "paladin-3-channel-divinity": (
        "You can channel sacred power to create a Channel Faith effect. You begin with Divine Sense, and other Paladin features can grant additional effects. You have two uses. You regain one expended use after a Short Rest and all expended uses after a Long Rest."
    ),
    "fey-wanderer-7-beguiling-twist": (
        "You have Advantage on saving throws you make to avoid or end the Charmed or Frightened condition. Whenever you or a creature you can see within 120 feet succeeds on such a save, you can take a Reaction to force a different creature you can see within 120 feet to make a Spirit saving throw against your spell save DC. On a failed save, choose whether the target is Charmed or Frightened for 1 minute. It repeats the save at the end of each of its turns, ending the effect on itself on a success."
    ),
    "sorcerer-2-font-of-magic": (
        "You have Sorcery Points equal to your Sorcerer level and regain all expended points after a Long Rest. You can expend a spell slot without an action to gain Sorcery Points equal to its level. As a Bonus Action, you can create a spell slot that vanishes at your next Long Rest: a level 1 slot costs 2 points and requires Sorcerer level 2; level 2 costs 3 points and requires level 3; level 3 costs 5 points and requires level 5; level 4 costs 6 points and requires level 7; and level 5 costs 7 points and requires level 9. You can't create a slot above level 5."
    ),
    "wild-magic-sorcery-18-tamed-surge": (
        "Immediately after you cast a Sorcerer spell with a spell slot, you can choose an effect from your Wild Magic Surge feature instead of rolling. You can choose any effect except the final row, and you make any roll required by the chosen effect. Once you use this feature, you can't use it again until you finish a Long Rest."
    ),
    "warrior-of-mercy-11-flurry-of-healing-and-harm": (
        "When you use Flurry of Blows, you can replace each Unarmed Strike with a use of Hand of Healing without spending Focus Points for that healing. In addition, when an Unarmed Strike from that Flurry deals damage, you can use Hand of Harm with it without spending a Focus Point, though Hand of Harm remains limited to once per turn. You can use these benefits a combined number of times equal to your Spirit modifier (minimum once), regaining all uses after a Long Rest."
    ),
    "monk-1-martial-arts": (
        "Your Monk weapons are Simple Melee weapons and Martial Melee weapons with the Light property. While you are unarmed or wielding only Monk weapons and aren't wearing armor or wielding a Shield, you gain three benefits. You can make an Unarmed Strike as a Bonus Action. You can use your Martial Arts die in place of the normal damage of an Unarmed Strike or Monk weapon; the die increases with your Monk level. You can use Agility instead of Strength for the attack and damage rolls of your Unarmed Strikes and Monk weapons and for the save DC of the Grapple or Shove option of your Unarmed Strike."
    ),
    "sorcerer-metamagic-options": (
        "Careful Spell (1 Sorcery Point): chosen creatures automatically succeed on the spell's save and take no damage if a successful save normally halves it. Distant Spell (1): double the spell's range, or give a Touch spell a range of 30 feet. Empowered Spell (1): reroll a number of damage dice up to your Charisma modifier and use the new rolls; this option can combine with another Metamagic. Extended Spell (1): double the duration to a maximum of 24 hours and gain Advantage on Constitution saves to maintain Concentration. Heightened Spell (2): one target has Disadvantage on its saving throws against the spell. Quickened Spell (2): change an Action casting time to a Bonus Action, subject to the normal one-spell-slot-per-turn restriction. Seeking Spell (1): reroll a missed spell attack and use the new roll; this option can combine with another Metamagic. Subtle Spell (1): remove Verbal, Somatic, and non-costly, non-consumed Material components. Transmuted Spell (1): change Acid, Cold, Fire, Lightning, Poison, or Thunder damage to another type in that list. Twinned Spell (1): when a spell can target an additional creature at a higher slot level, increase its effective level by 1."
    ),
}

TRUNCATED_FEATURE_IDS = {
    "barbarian-3-primal-knowledge",
    "cleric-2-channel-divinity",
    "light-domain-17-corona-of-light",
    "monk-1-martial-arts",
    "monk-2-monks-focus",
    "warrior-of-mercy-11-flurry-of-healing-and-harm",
    "paladin-1-lay-on-hands",
    "paladin-3-channel-divinity",
    "oath-of-devotion-3-sacred-weapon",
    "fey-wanderer-7-beguiling-twist",
    "soulknife-3-psychic-blades",
    "sorcerer-2-font-of-magic",
    "sorcerer-2-metamagic",
    "clockwork-sorcery-3-clockwork-spells",
    "wild-magic-sorcery-18-tamed-surge",
}

TRUNCATED_FEAT_IDS = {
    "boon-of-fate",
    "charger",
    "defensive-duelist",
    "dual-wielder",
    "healer",
    "polearm-master",
    "shield-master",
    "telepathic",
}

FEAT_TEXT_OVERRIDES = {
    "telepathic": (
        "Ability Score Increase: Increase your Intellect, Spirit, or Charisma score by 1, to a maximum of 20. "
        "Telepathic Utterance: You can speak telepathically to a creature you can see within 60 feet. Your message uses a language you know, and the creature understands only if it knows that language; this feature doesn't let it reply telepathically. "
        "Detect Thoughts: You always have Detect Thoughts prepared. You can cast it once without a spell slot or components, regaining that use after a Long Rest, and you can also cast it with your spell slots. The spellcasting ability is the ability increased by this feat."
    ),
}

BACKGROUND_TOOL_CHOICES = {
    "artisan": ["Choose one kind of Artisan's Tools"],
    "guard": ["Choose one Gaming Set"],
    "noble": ["Choose one Gaming Set"],
    "entertainer": ["Choose one Musical Instrument"],
    "soldier": ["Choose one Gaming Set"],
}

SPECIALIZED_EQUIPMENT_IDS = {
    "airship",
    "bullets-firearms",
    "musket",
    "pistol",
    "spell-scroll-cantrip",
    "spell-scroll-level-1",
}

TEXT_REPLACEMENTS = {
    "Greater Divine Intervention": "Greater Miracle",
    "Divine Intervention": "Miraculous Intervention",
    "Channel Divinity": "Channel Faith",
    "Nature's Veil": "Camouflage",
    "Druidic Warrior": "Nature Warrior",
    "Fey Reinforcements": "Nature Spirit Reinforcements",
    "Fey Wanderer": "Dream Wanderer",
    "Cleric Subclass": "Priest Calling",
    "Fighter Subclass": "Warrior Specialization",
    "Ranger Subclass": "Hunter Specialization",
    "Wizard Subclass": "Mage School",
    "Divine Order": "Spiritual Calling",
    "Memorize Spell": "Spellbook Study",
    "Feywild": "Emerald Dream",
    "Shadowfell": "Shadowlands",
    "Ethereal Plane": "Spirit Realm",
    "Astral Plane": "Twisting Nether",
    "Upper Planes": "Realms of the Light",
    "Outer Planes": "spiritual realms",
    "Nine Hells": "fel realms within the Twisting Nether",
    "Yggdrasil": "Azeroth's Great Trees",
    "Mechanus": "Titanic machinery",
    "Limbo": "chaotic ley-line instability",
    "Archfey": "powerful Nature Spirit",
    "your deity or pantheon": "your faith or sacred tradition",
    "Deities": "Cosmic powers",
    "deities": "cosmic powers",
    "deity": "cosmic power",
    "Fey Magic": "Dream Magic",
    "Fey": "Nature Spirit",
    "Dexterity": "Agility",
    "Constitution": "Stamina",
    "Intelligence": "Intellect",
    "Wisdom": "Spirit",
    "species": "ancestry",
    "DM": "GM",
    "Lolth's Sting": "Shadra's Sting",
    "Purple Worm Poison": "Deep-Worm Poison",
    "Cleric": "Priest",
    "Fighter": "Warrior",
    "Ranger": "Hunter",
    "Wizard": "Mage",
    **SPELL_NAMES,
}

SPELL_DESCRIPTION_OVERRIDES = {
    "reincarnate": (
        "You touch a dead Humanoid or part of one that has been dead no longer than 10 days. The spell forms a new adult body and calls the willing soul into it. Roll 1d4 for the new ancestry: 1 Human, 2 Dwarf, 3 Gnome, or 4 High Elf. The creature makes any choices offered by that ancestry, recalls its former life, retains its other capabilities, loses its former ancestry traits, and gains the retained traits of the new ancestry. Gnome uses Rock Gnome lineage, High Elf uses High Elf lineage, and no result grants passive ancestry Darkvision. Half-Elf is not a random result."
    ),
}


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def replace_term(text: str, source: str, replacement: str) -> str:
    return re.sub(
        rf"(?<![A-Za-z]){re.escape(source)}(?![A-Za-z])",
        replacement,
        text,
        flags=re.IGNORECASE,
    )


def normalize_rules_text(text: str, *, direct_voice: bool = False) -> str:
    text = clean_pdf_description(text or "")
    text = re.sub(
        r"\b(?:\d{1,3}\s*)?C\s*H\s*A\s*P\s*T\s*E\s*R\s*\d+\s*[|I]\s*(?:SPELLS|CHARACTER\s+CLASSES)\s*(?:\d+)?\b",
        " ",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(r"\bCr!APTER\s+\d+\s+I\s+SPELt\.?S\s*['0-9.]*", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\(?\s*see\s+chapter\s+5\s*\)?", " in the Feats collection", text, flags=re.IGNORECASE)
    text = re.sub(r"\(?\s*see\s+chapter\s+7\s*\)?", " in the Spells collection", text, flags=re.IGNORECASE)
    text = re.sub(r"\(?\s*see\s+chapter\s+2\s*\)?", " in the rules glossary", text, flags=re.IGNORECASE)
    text = re.sub(r"\bin\s+chapter\s+5\b", "in the Feats collection", text, flags=re.IGNORECASE)
    text = re.sub(r"\bin\s+chapter\s+7\b", "in the Spells collection", text, flags=re.IGNORECASE)
    text = re.sub(r"\bin\s+chapter\s+2\b", "in the rules glossary", text, flags=re.IGNORECASE)
    text = re.sub(r"\(?\s*see\s+appendix\s+B\s*\)?", " in the creature statistics", text, flags=re.IGNORECASE)
    text = re.sub(r"\bthe Druid class's section for a list of Druid spells\b", "the Nature spell list", text, flags=re.IGNORECASE)
    text = re.sub(r"\bDruid spell list\b", "Nature spell list", text, flags=re.IGNORECASE)
    text = re.sub(r"\bDruid spells\b", "Nature spells", text, flags=re.IGNORECASE)
    text = re.sub(r"\bDruid cantrips\b", "Nature cantrips", text, flags=re.IGNORECASE)
    text = replace_term(text, "Druid", "Nature")

    for source, replacement in sorted(TEXT_REPLACEMENTS.items(), key=lambda item: len(item[0]), reverse=True):
        text = replace_term(text, source, replacement)

    if direct_voice:
        pronouns = (
            (r"\b[Tt]hemselves\b", "yourself"),
            (r"\b[Tt]heirs\b", "yours"),
            (r"\b[Tt]heir\b", "your"),
            (r"\b[Tt]hey're\b", "you're"),
            (r"\b[Tt]hey've\b", "you've"),
            (r"\b[Tt]hey'll\b", "you'll"),
            (r"\b[Tt]hey'd\b", "you'd"),
            (r"\b[Tt]hey\b", "you"),
        )
        for pattern, replacement in pronouns:
            text = re.sub(pattern, replacement, text)
        text = re.sub(r"\b(of|to|for|from|against|around|near) them\b", r"\1 you", text, flags=re.IGNORECASE)
        text = re.sub(r"\bput them\b", "put you", text, flags=re.IGNORECASE)
        text = re.sub(r"\bwhat you are\b", "what they are", text, flags=re.IGNORECASE)
        text = re.sub(r"\byou and each ([^.]{0,100}?) gains\b", r"you and each \1 gain", text, flags=re.IGNORECASE)

    text = re.sub(r"\bwhen ever\b", "whenever", text, flags=re.IGNORECASE)
    text = re.sub(r"\bMeta magic\b", "Metamagic", text, flags=re.IGNORECASE)
    for broken, repaired in {
        "dam age": "damage",
        "thi s": "this",
        "w ith": "with",
        "dea l": "deal",
        "cre ature": "creature",
        "spe ll": "spell",
        "feat ure": "feature",
        "exp end": "expend",
        "reg ain": "regain",
        "oftimes": "of times",
    }.items():
        text = replace_term(text, broken, repaired)
    text = re.sub(r"\ba (Agility|Intellect|Stamina)\b", r"an \1", text, flags=re.IGNORECASE)
    text = re.sub(r"\(see a class's section for its spell list\)", "(see the corresponding spell list)", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    text = re.sub(r"\s{2,}", " ", text)
    text = re.sub(r"(?<=[.!?])\s+you\b", " You", text)
    text = re.sub(r"(?<=[.!?])\s+your\b", " Your", text)
    text = text.strip()
    return text[:1].upper() + text[1:] if text else ""


def feature_index(pack: dict[str, Any]) -> dict[str, dict[str, Any]]:
    records: dict[str, dict[str, Any]] = {}
    for class_record in pack.get("classes", []):
        for features in class_record.get("levelFeatures", {}).values():
            for feature in features:
                records[feature["id"]] = feature
        for subclass in class_record.get("subclasses", []):
            for features in subclass.get("levelFeatures", {}).values():
                for feature in features:
                    records[feature["id"]] = feature
    return records


def feat_index(pack: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {record["id"]: record for record in pack.get("feats", [])}


def spell_description_index(cache: dict[str, Any]) -> dict[str, str]:
    return {
        spell_id: record["description"]
        for spell_id, record in cache.get("spells", {}).items()
        if record.get("description")
    }


def strip_feat_heading(text: str) -> str:
    text = re.sub(
        r"^[A-Z][A-Z '\-]+\s+(?:Origin|General|Fighting Style|Epic Boon) Feat(?:\s*\([^)]*\))?\s*",
        "",
        text,
    )
    text = re.sub(r"^You gain the following benefits?\.\s*", "", text, flags=re.IGNORECASE)
    return text


def normalize_spell_description(spell_id: str, text: str) -> str:
    text = normalize_rules_text(text)
    profile_replacements = {
        "choose Demon, Devil, or Yugoloth": "choose Brute, Flame-Wing, or Stalker",
        "Demon only": "Brute only",
        "Devil only": "Flame-Wing only",
        "Yugoloth only": "Stalker only",
        "Fiend of the chosen type": "Demon of the chosen profile",
    }
    for source, replacement in profile_replacements.items():
        text = replace_term(text, source, replacement)

    creature_terms = {
        "Aberrations": "Voidspawn",
        "Aberration": "Voidspawn",
        "Celestials": "Light Spirits",
        "Celestial": "Light Spirit",
        "Fey": "Nature Spirit",
        "Fiends": "Demons",
        "Fiendish": "Demonic",
        "Fiend": "Demon",
    }
    for source, replacement in creature_terms.items():
        text = replace_term(text, source, replacement)

    text = replace_term(text, "Material Plane", "Azeroth")
    text = replace_term(text, "Far Realm", "Void")
    text = replace_term(text, "multiverse", "cosmos")
    text = re.sub(r"Languages: Light Spirit, understands", "Languages: understands", text, flags=re.IGNORECASE)

    if spell_id == "wish":
        text = re.sub(
            r"If your wish would affect a god,.*?your wish fails\.",
            "A Wish that would unmake Azeroth, overturn the campaign's cosmology, or directly rewrite a cosmic power's existence can fail or draw immediate intervention at the GM's discretion.",
            text,
            flags=re.IGNORECASE,
        )
    elif spell_id == "conjure-celestial":
        text += " This calls a temporary manifestation or servant of the Light and cannot compel or control a major named Naaru."

    return SPELL_DESCRIPTION_OVERRIDES.get(spell_id, text)


def normalize_pack_text(pack: dict[str, Any]) -> None:
    for ancestry in pack["ancestries"]:
        for trait in ancestry["traits"]:
            trait["description"] = ANCESTRY_TRAIT_DESCRIPTIONS.get(
                trait["id"], normalize_rules_text(trait.get("description", ""), direct_voice=True)
            )

    for class_record in pack["classes"]:
        class_record["description"] = CLASS_OVERVIEWS[class_record["id"]]
        for features in class_record["levelFeatures"].values():
            for feature in features:
                feature["description"] = normalize_rules_text(
                    FEATURE_TEXT_OVERRIDES.get(feature["id"], feature.get("description", "")),
                    direct_voice=True,
                )
        for subclass in class_record.get("subclasses", []):
            subclass["description"] = SUBCLASS_OVERVIEWS.get(
                subclass["id"], normalize_rules_text(subclass.get("description", ""), direct_voice=True)
            )
            for features in subclass["levelFeatures"].values():
                for feature in features:
                    feature["description"] = normalize_rules_text(
                        FEATURE_TEXT_OVERRIDES.get(feature["id"], feature.get("description", "")),
                        direct_voice=True,
                    )

    for background in pack["backgrounds"]:
        if background.get("feature"):
            background["feature"]["description"] = normalize_rules_text(
                background["feature"].get("description", ""), direct_voice=True
            )
        background["equipment"] = normalize_rules_text(background.get("equipment", ""))
        background["toolProficiencies"] = [
            normalize_rules_text(tool) for tool in background.get("toolProficiencies", [])
        ]

    for feat in pack["feats"]:
        feat["description"] = normalize_rules_text(
            FEAT_TEXT_OVERRIDES.get(feat["id"], strip_feat_heading(feat.get("description", ""))),
            direct_voice=True,
        )
        if feat.get("prerequisite"):
            feat["prerequisite"] = normalize_rules_text(feat["prerequisite"])

    for item in pack["equipment"]:
        item["description"] = normalize_rules_text(item.get("description", ""), direct_voice=True)
        item["properties"] = [normalize_rules_text(value) for value in item.get("properties", [])]

    for spell in pack["spells"]:
        spell["description"] = normalize_spell_description(spell["id"], spell.get("description", ""))


def assert_ids(label: str, expected: set[str], records: Iterable[dict[str, Any]]) -> None:
    actual = {record["id"] for record in records}
    if actual != expected:
        raise ValueError(f"{label} selection mismatch: missing={sorted(expected - actual)}, extra={sorted(actual - expected)}")


def rename_record(record: dict[str, Any], display_name: str) -> None:
    original_name = record["name"]
    if display_name == original_name:
        return
    aliases = record.setdefault("aliases", [])
    if original_name not in aliases:
        aliases.append(original_name)
    record["name"] = display_name


def rename_features(level_features: dict[str, list[dict[str, Any]]]) -> None:
    for features in level_features.values():
        for feature in features:
            rename_record(feature, FEATURE_DISPLAY_NAMES.get(feature["name"], feature["name"]))


def build_ancestries(baseline: dict[str, Any]) -> list[dict[str, Any]]:
    ancestries = [copy.deepcopy(item) for item in baseline["ancestries"] if item["id"] in ANCESTRY_IDS]
    assert_ids("ancestry", ANCESTRY_IDS, ancestries)
    for ancestry in ancestries:
        ancestry["traits"] = [trait for trait in ancestry["traits"] if trait["name"] != "Darkvision"]
        if ancestry["id"] == "elf":
            rename_record(ancestry, "High Elf")
            for trait in ancestry["traits"]:
                if trait["name"] == "Elven Lineage":
                    rename_record(trait, "High Elf Lineage")
                elif trait["name"] == "Fey Ancestry":
                    rename_record(trait, "Elven Resolve")
        elif ancestry["id"] == "gnome":
            ancestry["traits"] = [trait for trait in ancestry["traits"] if trait["name"] != "Forest Gnome"]
            for trait in ancestry["traits"]:
                if trait["name"] == "Gnomish Lineage":
                    rename_record(trait, "Rock Gnome Lineage")
                elif trait["name"] == "Rock Gnome":
                    rename_record(trait, "Rock Gnome Gifts")
    return ancestries


def build_classes(baseline: dict[str, Any], phb: dict[str, Any]) -> list[dict[str, Any]]:
    classes = [copy.deepcopy(item) for item in baseline["classes"] if item["id"] in CLASS_IDS]
    references = feature_index(phb)
    assert_ids("class", CLASS_IDS, classes)
    for class_record in classes:
        class_id = class_record["id"]
        rename_record(class_record, CLASS_NAMES.get(class_id, class_record["name"]))
        for features in class_record["levelFeatures"].values():
            for feature in features:
                reference = references.get(feature["id"])
                if feature["id"] in TRUNCATED_FEATURE_IDS and reference:
                    feature["description"] = reference["description"]
        rename_features(class_record["levelFeatures"])
        expected_names = SUBCLASS_NAMES[class_id]
        subclasses = [item for item in class_record.get("subclasses", []) if item["name"] in expected_names]
        actual_names = {item["name"] for item in subclasses}
        if actual_names != expected_names:
            raise ValueError(
                f"{class_id} subclass selection mismatch: missing={sorted(expected_names - actual_names)}, "
                f"extra={sorted(actual_names - expected_names)}"
            )
        for subclass in subclasses:
            rename_record(subclass, SUBCLASS_DISPLAY_NAMES.get(subclass["id"], subclass["name"]))
            for features in subclass["levelFeatures"].values():
                for feature in features:
                    reference = references.get(feature["id"])
                    if feature["id"] in TRUNCATED_FEATURE_IDS and reference:
                        feature["description"] = reference["description"]
            rename_features(subclass["levelFeatures"])
        class_record["subclasses"] = subclasses
        if class_id == "sorcerer":
            class_record["levelFeatures"].setdefault("2", []).append(
                {
                    "id": "sorcerer-metamagic-options",
                    "name": "Metamagic Options",
                    "description": FEATURE_TEXT_OVERRIDES["sorcerer-metamagic-options"],
                    "source": "http://dnd2024.wikidot.com/sorcerer:metamagic",
                }
            )
    return classes


def build_backgrounds(baseline: dict[str, Any]) -> list[dict[str, Any]]:
    backgrounds = [copy.deepcopy(item) for item in baseline["backgrounds"] if item["id"] in BACKGROUND_IDS]
    assert_ids("background", BACKGROUND_IDS, backgrounds)
    for background in backgrounds:
        rename_record(background, BACKGROUND_NAMES.get(background["id"], background["name"]))
        if background["id"] in BACKGROUND_TOOL_CHOICES:
            background["toolProficiencies"] = BACKGROUND_TOOL_CHOICES[background["id"]]
        if background["id"] == "archaeologist":
            background.update(
                {
                    "name": "Archaeologist",
                    "skills": ["History", "Investigation"],
                    "abilityOptions": ["stamina", "intellect", "spirit"],
                    "featId": "skilled",
                    "toolProficiencies": ["Cartographer's Tools"],
                    "equipment": "50 GP",
                }
            )
        elif background["id"] == "criminal":
            rename_record(background, "Outlaw or Smuggler (Criminal)")

    wayfarer = next(record for record in backgrounds if record["id"] == "wayfarer")
    outlaw_wayfarer = copy.deepcopy(wayfarer)
    outlaw_wayfarer["id"] = "outlaw-or-smuggler-wayfarer"
    rename_record(outlaw_wayfarer, "Outlaw or Smuggler (Wayfarer)")
    backgrounds.append(outlaw_wayfarer)
    return backgrounds


def build_feats(baseline: dict[str, Any], phb: dict[str, Any]) -> list[dict[str, Any]]:
    retained_ids = {item["id"] for item in phb["feats"]} | {"heavy-armor-master"}
    references = feat_index(phb)
    feats = [copy.deepcopy(item) for item in baseline["feats"] if item["id"] in retained_ids]
    assert_ids("feat", retained_ids, feats)
    for feat in feats:
        reference = references.get(feat["id"])
        if feat["id"] in TRUNCATED_FEAT_IDS and reference:
            feat["description"] = reference["description"]
        rename_record(feat, FEAT_NAMES.get(feat["id"], feat["name"]))
    return feats


def build_equipment(baseline: dict[str, Any]) -> list[dict[str, Any]]:
    equipment = [copy.deepcopy(item) for item in baseline["equipment"] if item["name"] not in EQUIPMENT_EXCLUSIONS]
    removed = {item["name"] for item in baseline["equipment"] if item["name"] in EQUIPMENT_EXCLUSIONS}
    if removed != EQUIPMENT_EXCLUSIONS:
        raise ValueError(f"equipment exclusions mismatch: missing={sorted(EQUIPMENT_EXCLUSIONS - removed)}")
    for item in equipment:
        rename_record(item, EQUIPMENT_NAMES_BY_ID.get(item["id"], item["name"]))
        if item["id"] == "arcane-focus":
            item["description"] = "An Arcane Focus is bejeweled or carved to channel arcane magic. Sorcerers and Mages can use one as a Spellcasting Focus."
        elif item["id"] == "druidic-focus":
            item["description"] = "A Nature Focus is carved, tied with ribbon, or painted to channel primal magic. Hunters and characters with an explicitly permitted feature can use one as a Spellcasting Focus."
        elif item["id"] == "holy-symbol":
            item["description"] = "A Holy Symbol is bejeweled or painted to channel sacred magic. Priests and Paladins can use one as a Spellcasting Focus."
        if (
            item["id"] in SPECIALIZED_EQUIPMENT_IDS
            or item["category"] in {"Sample Poisons", "Airborne and Waterborne Vehicles"}
            or "magic item" in item.get("description", "").casefold()
        ):
            item["description"] = item.get("description", "").rstrip() + " GM approval is required at character creation."
    renamed = {item["name"] for item in equipment if item["id"] in EQUIPMENT_NAMES_BY_ID}
    expected_renames = set(EQUIPMENT_NAMES_BY_ID.values())
    if renamed != expected_renames:
        raise ValueError(f"equipment rename mismatch: missing={sorted(expected_renames - renamed)}")
    return equipment


def spell_classes(classes: list[str]) -> list[str]:
    result: list[str] = []
    for class_name in classes:
        if class_name in {"Artificer", "Warlock"}:
            continue
        if class_name == "Druid":
            nature_label = "Nature (Druid rules list)"
            if nature_label not in result:
                result.append(nature_label)
            continue
        display_name = SPELL_CLASS_NAMES.get(class_name)
        if display_name and display_name not in result:
            result.append(display_name)
        if class_name not in result:
            result.append(class_name)
    return result


def build_spells(baseline: dict[str, Any], cached_descriptions: dict[str, str]) -> list[dict[str, Any]]:
    excluded = WARLOCK_ONLY_SPELLS | SUPPLEMENTAL_SPELLS
    found_exclusions = {item["name"] for item in baseline["spells"] if item["name"] in excluded}
    if found_exclusions != excluded:
        raise ValueError(f"spell exclusions mismatch: missing={sorted(excluded - found_exclusions)}")
    spells = [copy.deepcopy(item) for item in baseline["spells"] if item["name"] not in excluded]
    for spell in spells:
        if spell["id"] not in cached_descriptions:
            raise ValueError(f"missing cached Wikidot description for retained spell: {spell['id']}")
        spell["description"] = cached_descriptions[spell["id"]]
        rename_record(spell, SPELL_NAMES.get(spell["name"], spell["name"]))
        spell["classes"] = spell_classes(spell["classes"])
        if not spell["classes"]:
            raise ValueError(f"retained spell has no available class identity: {spell['id']}")
    return sorted(spells, key=lambda item: (item["level"], item["name"].casefold(), item["id"]))


def validate_pack_consistency(pack: dict[str, Any]) -> None:
    categories = ("ancestries", "classes", "backgrounds", "feats", "equipment", "spells")
    for category in categories:
        ids = [record["id"] for record in pack[category]]
        if len(ids) != len(set(ids)):
            raise ValueError(f"duplicate {category} IDs detected")

    feature_ids: list[str] = []
    for ancestry in pack["ancestries"]:
        feature_ids.extend(trait["id"] for trait in ancestry["traits"] if trait.get("id"))
    for class_record in pack["classes"]:
        feature_ids.extend(
            feature["id"]
            for features in class_record["levelFeatures"].values()
            for feature in features
            if feature.get("id")
        )
        for subclass in class_record.get("subclasses", []):
            feature_ids.extend(
                feature["id"]
                for features in subclass["levelFeatures"].values()
                for feature in features
                if feature.get("id")
            )
    if len(feature_ids) != len(set(feature_ids)):
        raise ValueError("duplicate retained feature IDs detected")

    if any(trait["name"] == "Darkvision" for ancestry in pack["ancestries"] for trait in ancestry["traits"]):
        raise ValueError("ancestry Darkvision survived the Phase 1 filter")

    feat_ids = {feat["id"] for feat in pack["feats"]}
    unresolved_feats = {
        background["featId"]
        for background in pack["backgrounds"]
        if background.get("featId") and background["featId"] not in feat_ids
    }
    if unresolved_feats:
        raise ValueError(f"unresolved background feat IDs: {sorted(unresolved_feats)}")

    rules_class_names = {
        "Barbarian",
        "Bard",
        "Cleric",
        "Fighter",
        "Monk",
        "Paladin",
        "Ranger",
        "Rogue",
        "Sorcerer",
        "Wizard",
        "Nature (Druid rules list)",
    }
    display_class_names = {class_record["name"] for class_record in pack["classes"]}
    allowed_spell_classes = rules_class_names | display_class_names
    invalid_spell_classes = {
        class_name
        for spell in pack["spells"]
        for class_name in spell["classes"]
        if class_name not in allowed_spell_classes
    }
    if invalid_spell_classes:
        raise ValueError(f"invalid spell class labels: {sorted(invalid_spell_classes)}")
    if any(class_name in {"Artificer", "Warlock"} for spell in pack["spells"] for class_name in spell["classes"]):
        raise ValueError("prohibited class survived in spell access metadata")

    expected_spell_order = sorted(
        pack["spells"],
        key=lambda item: (item["level"], item["name"].casefold(), item["id"]),
    )
    if [spell["id"] for spell in pack["spells"]] != [spell["id"] for spell in expected_spell_order]:
        raise ValueError("spells are not ordered by level and then alphabetically")

    spell_sort_keys = [(spell["level"], spell["name"].casefold(), spell["id"]) for spell in pack["spells"]]
    if spell_sort_keys != sorted(spell_sort_keys):
        raise ValueError("spells are not sorted by level and display name")


def build_pack(baseline: dict[str, Any], phb: dict[str, Any], spell_cache: dict[str, Any]) -> dict[str, Any]:
    pack = {
        "schemaVersion": "2.0",
        "pack": {
            "id": "warcraft5e-campaign",
            "name": "Warcraft 5E Campaign",
            "version": "2026.08.09.2",
            "description": "Approved Grand Coalition campaign options with Warcraft presentation, complete offline rules descriptions, and the campaign's ancestry, class, background, feat, spell, and equipment restrictions.",
            "source": "Warcraft5E Vault player guides and dnd2024-wikidot baseline 2026.08.09.2",
        },
        "ancestries": build_ancestries(baseline),
        "classes": build_classes(baseline, phb),
        "backgrounds": build_backgrounds(baseline),
        "feats": build_feats(baseline, phb),
        "equipment": build_equipment(baseline),
        "spells": build_spells(baseline, spell_description_index(spell_cache)),
    }
    normalize_pack_text(pack)
    subclass_count = sum(len(item.get("subclasses", [])) for item in pack["classes"])
    expected_counts = {
        "ancestries": 4,
        "classes": 10,
        "subclasses": 40,
        "backgrounds": 17,
        "feats": 75,
        "equipment": 218,
        "spells": 385,
    }
    actual_counts = {
        "ancestries": len(pack["ancestries"]),
        "classes": len(pack["classes"]),
        "subclasses": subclass_count,
        "backgrounds": len(pack["backgrounds"]),
        "feats": len(pack["feats"]),
        "equipment": len(pack["equipment"]),
        "spells": len(pack["spells"]),
    }
    if actual_counts != expected_counts:
        raise ValueError(f"pack count mismatch: expected={expected_counts}, actual={actual_counts}")
    validate_pack_consistency(pack)
    return pack


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", type=Path, default=DEFAULT_BASELINE)
    parser.add_argument("--phb", type=Path, default=DEFAULT_PHB)
    parser.add_argument("--spell-cache", type=Path, default=DEFAULT_SPELL_CACHE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    pack = build_pack(load_json(args.baseline), load_json(args.phb), load_json(args.spell_cache))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(pack, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    subclass_count = sum(len(item.get("subclasses", [])) for item in pack["classes"])
    print(
        f"Wrote {args.output}: {len(pack['ancestries'])} ancestries, {len(pack['classes'])} classes, "
        f"{subclass_count} subclasses, {len(pack['backgrounds'])} backgrounds, {len(pack['feats'])} feats, "
        f"{len(pack['equipment'])} equipment entries, {len(pack['spells'])} spells"
    )


if __name__ == "__main__":
    main()
