from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path


PROJECT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = PROJECT / "content-source" / "dnd5e-2024-phb"
DEFAULT_OUTPUT = PROJECT / "content-packs" / "dnd5e-2024-phb.w5e"
SOURCE_TITLE = "D&D 2024 Player's Handbook"


SPECIES_TRAIT_NAMES = {
    "Aasimar": [
        "Celestial Resistance",
        "Darkvision",
        "Healing Hands",
        "Light Bearer",
        "Celestial Revelation",
    ],
    "Dragonborn": [
        "Draconic Ancestry",
        "Breath Weapon",
        "Damage Resistance",
        "Darkvision",
        "Draconic Flight",
    ],
    "Dwarf": ["Darkvision", "Dwarven Resilience", "Dwarven Toughness", "Stonecunning"],
    "Elf": ["Darkvision", "Elven Lineage", "Fey Ancestry", "Keen Senses", "Trance"],
    "Gnome": ["Darkvision", "Gnomish Cunning", "Gnomish Lineage"],
    "Goliath": ["Giant Ancestry", "Large Form", "Powerful Build"],
    "Halfling": ["Brave", "Halfling Nimbleness", "Luck", "Naturally Stealthy"],
    "Human": ["Resourceful", "Skillful", "Versatile"],
    "Orc": ["Adrenaline Rush", "Darkvision", "Relentless Endurance"],
    "Tiefling": ["Fiendish Legacy", "Darkvision", "Otherworldly Presence"],
}


FEATURE_NAME_CORRECTIONS = {
    "ADi .UTY SCORE IMPROVEMENT": "Ability Score Improvement",
    "F ERAL INST I NCT": "Feral Instinct",
    "BRUTAL STR I KE": "Brutal Strike",
    "AB I LIT Y SCOR E I M PROVEMENT": "Ability Score Improvement",
    "L E A DING E VASION": "Leading Evasion",
    "MARTIAL 'TRAINING": "Martial Training",
    "C i.,_., ;;_;,: ~) UB CLASS": "Cleric Subclass",
    "ABI L ITY SCORE IMPROVEMENT": "Ability Score Improvement",
    "TRICKERY DOMAIN SP E LL S": "Trickery Domain Spells",
    "GUIDED STR I KE": "Guided Strike",
    "WAR Goo's BLESSING": "War God's Blessing",
    "LAND 'S AID": "Land's Aid",
    "NATURE'S SANC T UA RY": "Nature's Sanctuary",
    "C I RCL E FORMS": "Circle Forms",
    "CIRCL E O F THE MOON SP E LLS": "Circle of the Moon Spells",
    "OCEANIC GIF T": "Oceanic Gift",
    "STA RRY F O RM": "Starry Form",
    "F ULL OF STARS": "Full of Stars",
    "TACT I CAL MASTER": "Tactical Master",
    "THR EE E XT RA ATT AC K S": "Three Extra Attacks",
    "S T UDE N T O F W AR": "Student of War",
    "KNOW YO U R ENEMY": "Know Your Enemy",
    "MoNK 's Focus": "Monk's Focus",
    "DEFL E CT ATT ACKS": "Deflect Attacks",
    "A CROBAT I C MOVE M ENT": "Acrobatic Movement",
    "I MPL EME NTS OF MERCY": "Implements of Mercy",
    "P H YSIC I AN'S TOUCH": "Physician's Touch",
    "FLU RRY O F HEALING AND HA RM": "Flurry of Healing and Harm",
    "S H ADOW STEP": "Shadow Step",
    "IMPR OVED S HADOW STEP": "Improved Shadow Step",
    "STRIDE OF THE ELEM E NTS": "Stride of the Elements",
    "ELEMENTAL EPITO M E": "Elemental Epitome",
    "LAY O N H A NDS": "Lay on Hands",
    "I NSPI RI NG SM ITE": "Inspiring Smite",
    "L IVING LEGEND": "Living Legend",
    "O ATH OF V ENGEANCE SPEL LS": "Oath of Vengeance Spells",
    "F IGHTIN G S TYLE": "Fighting Style",
    "EXPERTISE Cure Wounds Abjuration Choose two of your skill proficiencies with which": "Expertise",
    "NATURE'S VEIL Animal Messenger Enchantment R": "Nature's Veil",
    "PRECISE HUNTER Gust of Wind Evocation C": "Precise Hunter",
    "FERAL SENSES Locate Object Divination C": "Feral Senses",
    "E PIC BOON Protection from Poison Abjuration": "Epic Boon",
    "FO E SLAYER": "Foe Slayer",
    "O THERW ORLDLY CLA MO UR": "Otherworldly Glamour",
    "FE Y REIN F ORCEMENTS": "Fey Reinforcements",
    "M I STY W A NDER E R": "Misty Wanderer",
    "DR E AD AMBUSHER": "Dread Ambusher",
    "GLOOM STALKER SPEL L S": "Gloom Stalker Spells",
    "UMBR A L SIG H T": "Umbral Sight",
    "IRON M I ND": "Iron Mind",
    "S TA LKE R'S F LU RRY": "Stalker's Flurry",
    "HUNTER 'S LORE": "Hunter's Lore",
    "HUNTER 'S PREY": "Hunter's Prey",
    "D EF ENS IVE T ACTICS": "Defensive Tactics",
    "SUPE RI OR H UNTER'S PR EY": "Superior Hunter's Prey",
    "Su PERIOR H UNT ER'S D EFENSE": "Superior Hunter's Defense",
    "THIEVES ' CANT": "Thieves' Cant",
    "STEADY A l M": "Steady Aim",
    "A BILITY SC ORE I MPROVEMENT": "Ability Score Improvement",
    "MAGICAL.AMBUSH": "Magical Ambush",
    "SPELL T H IEF": "Spell Thief",
    "ASSASSI N'S TOO L S": "Assassin's Tools",
    "PSIO N IC POWER": "Psionic Power",
    "ENVE N O M WEAPONS": "Envenom Weapons",
    "DEAT H S T RI K E": "Death Strike",
    "F ON T O F MAGIC your list with another Sorcerer spell for which you": "Font of Magic",
    "PS I ONIC SPELLS": "Psionic Spells",
    "TE LE PAT H IC SPEECH": "Telepathic Speech",
    "R ESTOR E B A LANCE": "Restore Balance",
    "DRAGO N C OMPANION": "Dragon Companion",
    "W IL D M AGI C SURGE": "Wild Magic Surge",
    "TID E S OF C H AOS": "Tides of Chaos",
    "B EN D LUCK": "Bend Luck",
    "C ONT RO LL ED C HAOS": "Controlled Chaos",
    "TAMED SURGE ldlOO Effect": "Tamed Surge",
    "ST EPS OF TH E FEY": "Steps of the Fey",
    "B EGUILING DEFENSES": "Beguiling Defenses",
    "BEWITCHING M AG I C": "Bewitching Magic",
    "C ELES TI A L RESILIENCE": "Celestial Resilience",
    "SEARI NG VENGEANC E": "Searing Vengeance",
    "DARK ONE 'S BLESSING": "Dark One's Blessing",
    "DARK ON E'S O wN L u cK": "Dark One's Own Luck",
    "HURL THROUGH HEL L": "Hurl Through Hell",
    "A WAKENE D MIND": "Awakened Mind",
    "CREATE ThRALL": "Create Thrall",
    "WIZARD S UB CL ASS": "Wizard Subclass",
    "ABILIT Y S C OR E IMP ROVE MENT": "Ability Score Improvement",
    "MEMOR IZ E S PE LL": "Memorize Spell",
    "S PE LL MASTERY": "Spell Mastery",
    "PROJECTED W ARD": "Projected Ward",
    "EX P ERT D IVINATION": "Expert Divination",
    "EMPOWERED E VOCATION": "Empowered Evocation",
    "ILLUSI O N SAVANT": "Illusion Savant",
    "J LLU SORY R EA LITY": "Illusory Reality",
    "FONT OF INSPIR ATION": "Font of Inspiration",
    "CouNTERCHARM": "Countercharm",
    "DIVINE ORD ER": "Divine Order",
    "SEAR UNDEAD": "Sear Undead",
    "LIFE DOM A IN SPELLS": "Life Domain Spells",
    "TwINKLING CONSTELLATIONS": "Twinkling Constellations",
    "TACTICAL SHI FT": "Tactical Shift",
    "INDOMIT A BLE": "Indomitable",
    "FIG-HT IKG STY LE": "Fighting Style",
    "DEFT EXPLOR ER": "Deft Explorer",
    "ABILITY SCORE IMPROVEM ENT": "Ability Score Improvement",
    "SHA DOWY DO DGE": "Shadowy Dodge",
    "ASS ASSINATE": "Assassinate",
    "IN FILT RATI ON EX PERTI SE": "Infiltration Expertise",
    "METAMAG IC": "Metamagic",
    "EP IC BOON": "Epic Boon",
    "ELD RITCH MASTER": "Eldritch Master",
    "A RCH FEY SPELLS": "Archfey Spells",
    "FIE ND SPEL LS": "Fiend Spells",
    "ELDR ITCH HEX": "Eldritch Hex",
    "TH OUGHT SHIELD": "Thought Shield",
    "SIG NATU RE SPE LLS": "Signature Spells",
}


OCR_PHRASE_CORRECTIONS = {
    "Concentrat ion": "Concentration",
    "Concent ration": "Concentration",
    "Concentra tion": "Concentration",
    "Conc entration": "Concentration",
    "Conce ntration": "Concentration",
    "Conce nt ration": "Concentration",
    "Conc en trati on": "Concentration",
    "Conce ntrati on": "Concentration",
    "Act ion": "Action",
    "Bonus Act ion": "Bonus Action",
    "minut e": "minute",
    "m inute": "minute",
    "m inutes": "minutes",
    "min utes": "minutes",
    "Rit ual": "Ritual",
    "subcla ss": "subclass",
    "Initi ative": "Initiative",
    "Advan tage": "Advantage",
    "Pro ficiency": "Proficiency",
    "simultane ously": "simultaneously",
    "Ne crotic": "Necrotic",
    "Trem orsense": "Tremorsense",
    "Presti digitation": "Prestidigitation",
    "Thauma turgy": "Thaumaturgy",
    "Me lee": "Melee",
    "quali fy": "qualify",
    "ef fect": "effect",
    "followi ng": "following",
    "minu tes": "minutes",
    "spellc asting": "spellcasting",
    "spellc astin g": "spellcasting",
    "yo u": "you",
    "yo ur": "your",
    "th e": "the",
    "th at": "that",
    "th is": "this",
    "ca n": "can",
    "ca n't": "can't",
    "re ach": "reach",
    "tr ip": "trip",
    "ou gh": "ough",
    "ma ke": "make",
    "wea pon": "weapon",
    "sav ing": "saving",
    "Instanta neous": "Instantaneous",
    "Instan taneous": "Instantaneous",
    "Chari sma": "Charisma",
    "prep ared": "prepared",
    "gra nts": "grants",
    "Sup eriority": "Superiority",
    "Abj uration": "Abjuration",
    "Sorce rer": "Sorcerer",
    "Nec romancy": "Necromancy",
    "Transm utat ion": "Transmutation",
    "num ber": "number",
    "dimen sion": "dimension",
    "subcl ass": "subclass",
    "aga inst": "against",
    "Mon ster": "Monster",
    "van ishes": "vanishes",
    "Disad vantage": "Disadvantage",
    "Disadvan tage": "Disadvantage",
    "Disadvan tag e": "Disadvantage",
    "Immediat ely": "Immediately",
    "pat ron": "patron",
    "speci fied": "specified",
    "Counte rspell": "Counterspell",
    "Multi verse": "Multiverse",
    "Necro tic": "Necrotic",
    "suc ceed": "succeed",
    "Compo nents": "Components",
    "sum mon": "summon",
    "Concen tration": "Concentration",
    "Com mon": "Common",
    "Abi lity": "Ability",
    "deter mine": "determine",
    "Cross bow": "Crossbow",
    "th ings": "things",
    "chara cter": "character",
    "you r": "your",
    "V i s do m": "Wisdom",
    "modifie r": "modifier",
    "min imum": "minimum",
    "t he": "the",
    "a ttack": "attack",
    "deal t b y the attack": "dealt by the attack",
    "ta ke s d a m age": "takes damage",
    "re quired": "required",
    "ga in": "gain",
    "Intelli gence": "Intelligence",
    "Resis tance": "Resistance",
    "Psy chic": "Psychic",
    "ani mals": "animals",
    "ben efit": "benefit",
    "Evocati on": "Evocation",
    "Conjurati on": "Conjuration",
    "Re strained": "Restrained",
    "in formation": "information",
    "re duce": "reduce",
    "certa in": "certain",
    "har ness": "harness",
    "Supe riority": "Superiority",
    "durati on": "duration",
    "re peats": "repeats",
    "knowl edge": "knowledge",
    "Bon us": "Bonus",
    "Whis pers": "Whispers",
    "So matic": "Somatic",
    "No ne": "None",
    "Wiz ard": "Wizard",
    "in stead": "instead",
    "at tacks": "attacks",
    "comb at": "combat",
    "in cluded": "included",
    "re duced": "reduced",
    "In spiration": "Inspiration",
    "be guiling": "beguiling",
    "aga in": "again",
    "doma in": "domain",
    "so ul": "soul",
    "re gions": "regions",
    "In capacitated": "Incapacitated",
    "wh at": "what",
    "at tempt": "attempt",
    "at tempts": "attempts",
    "be tween": "between",
    "tele port": "teleport",
    "Foc us": "Focus",
    "occu pied": "occupied",
    "Palad in": "Paladin",
    "An cients": "Ancients",
    "Protecti on": "Protection",
    "re ady": "ready",
    "Natu re": "Nature",
    "Apotheos is": "Apotheosis",
    "pos sible": "possible",
    "re ly": "rely",
    "measu re": "measure",
    "Conju ration": "Conjuration",
    "Terra in": "Terrain",
    "an tipathy": "antipathy",
    "As tral": "Astral",
    "Obscu re": "Obscure",
    "fissu re": "fissure",
    "Compon ents": "Components",
    "rega in": "regain",
    "in cludes": "includes",
    "fi re": "fire",
    "in crease": "increase",
    "whis pers": "whispers",
    "he ar": "hear",
    "in ches": "inches",
    "Sphe re": "Sphere",
    "modifi ers": "modifiers",
    "be fore": "before",
    "re quire": "require",
    "re leases": "releases",
    "in volved": "involved",
    "van ish": "vanish",
    "Sail or": "Sailor",
    "Herm it": "Hermit",
    "ma in": "main",
    "At hletics": "Athletics",
    "ani mal": "animal",
    "an imals": "animals",
    "be ings": "beings",
    "un til": "until",
    "fini sh": "finish",
    "d0": "do",
    "turn s": "turns",
    "Evoc at io n": "Evocation",
    "L ong Res t": "Long Rest",
    "res tor e": "restore",
    "feat ure": "feature",
    "re veal": "reveal",
    "crea tu re": "creature",
    "creat ure": "creature",
    "tha t": "that",
    "th r ow": "throw",
    "dro p": "drop",
    "con ta in": "contain",
    "an othe rwo rldl.": "an otherworldly",
    "know n": "known",
    "unocc up ied": "unoccupied",
    "ta rgets": "targets",
    "in creas es": "increases",
    "condi ti on": "condition",
    "con diti on": "condition",
    "at tac k": "attack",
    "il is": "it is",
    "to re lease": "to release",
    "othe rwo rldl.": "otherworldly",
    "known toy,~1:": "known to you:",
    "an othe rwo rldl.'": "an otherworldly",
    "some othe r bein g of cos mir f0~,cr": "some other being of cosmic power",
    "Celesti a l": "Celestial",
    "a n Elemental": "an Elemental",
    "otherworldly' entity": "otherworldly entity",
    "do es": "does",
    "L I FE DOM A I N S PELL S": "LIFE DOMAIN SPELLS",
    "BE COMING A FIGHTER": "BECOMING A FIGHTER",
    "A s A L EV EL 1 CHARACTER": "As a Level 1 Character",
    "a t a n": "at an",
    "familia r t a ke s d a m age": "familiar takes damage",
    "Res ista n ce again st": "Resistance against",
    "MASTER O F M Y RIAD FORMS": "Master of Myriad Forms",
    "BOO N O F R EC O VE RY": "BOON OF RECOVERY",
    "B OO N O F S KILL": "BOON OF SKILL",
    "BOO N O F S P EED": "BOON OF SPEED",
    "actio n o n i ts tu rn": "action on its turn",
    "centere d o n a": "centered on a",
    "CH APT ER 3 I CHA RACTE R C L A SSES 153": "",
    "C H APTE R l I P L AY I NG T H E GA M E 23": "",
    "CHAPTER 3 I CHARACTER CLASSES 69": "",
    "i I I ' i": "",
    "Core Wizard ' I Trait s table": "Core Wizard Traits table",
}


SPELL_FIELD_OVERRIDES = {
    "Clairvoyance": {
        "components": "V, S, M (a focus worth 100+ GP, either a jeweled horn for hearing or a glass eye for seeing)",
        "duration": "Concentration, up to 10 minutes",
    },
    "Sunbeam": {"duration": "Concentration, up to 1 minute"},
    "Fire Bolt": {"duration": "Instantaneous"},
}


CORPUS_WORDS: Counter[str] = Counter()
JOIN_STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "for", "from",
    "had", "has", "have", "he", "her", "him", "his", "if", "in", "is", "it", "its",
    "may", "no", "not", "of", "on", "or", "our", "out", "re", "she", "so", "than",
    "that", "the", "their", "them", "then", "there", "they", "this", "to", "up", "us",
    "was", "we", "were", "when", "which", "who", "will", "with", "you", "your",
}


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def slug(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value or "entry"


def source_label(source: dict) -> str:
    start = source.get("pdfPageStart")
    end = source.get("pdfPageEnd", start)
    if start and end and end != start:
        return f"{SOURCE_TITLE}, PDF pp. {start}-{end}"
    return f"{SOURCE_TITLE}, PDF p. {start}" if start else SOURCE_TITLE


def iter_strings(value: object):
    if isinstance(value, dict):
        for child in value.values():
            yield from iter_strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from iter_strings(child)
    elif isinstance(value, str):
        yield value


def initialize_corpus_words(*sources: object) -> None:
    CORPUS_WORDS.clear()
    for source in sources:
        for text in iter_strings(source):
            CORPUS_WORDS.update(re.findall(r"[A-Za-z]{3,}", text.lower()))


def normalize_ocr_numbers(text: str) -> str:
    def dice(match: re.Match[str]) -> str:
        quantity = match.group(1).translate(str.maketrans({"l": "1", "I": "1", "S": "5"}))
        sides = match.group(2).translate(
            str.maketrans({"l": "1", "I": "1", "o": "0", "O": "0"})
        )
        return f"{quantity}d{sides}"

    text = re.sub(r"(?<![A-Za-z0-9])([0-9lIS]+)\s*d\s*([0-9lIoO]+)\b", dice, text)
    text = re.sub(r"\b(\d+)\s+d\s*(\d+)\b", r"\1d\2", text, flags=re.I)
    text = re.sub(r"\bD[lI]\s*(\d+)\b", r"D1\1", text)
    text = re.sub(r"\bd[lI]\s*(\d+)\b", r"d1\1", text)

    def single_die(match: re.Match[str]) -> str:
        sides = match.group(2).translate(
            str.maketrans({"l": "1", "I": "1", "o": "0", "O": "0"})
        )
        return f"{match.group(1)}{sides}"

    text = re.sub(r"\b([dD])([0-9lIoO]+)\b", single_die, text)
    text = re.sub(
        r"\b[lI]\s+(?=(?:foot|feet|mile|miles|hour|hours|minute|minutes|round|rounds|CP|SP|GP)\b)",
        "1 ",
        text,
        flags=re.I,
    )
    text = re.sub(r"\bO Hit Points\b", "0 Hit Points", text, flags=re.I)
    text = re.sub(r"\+S\b", "+5", text)
    text = re.sub(r"\+[lI]\b", "+1", text)
    text = re.sub(r"\bSO\s*GP\b", "50 GP", text, flags=re.I)
    text = re.sub(
        r"\bSO(?=\s+(?:foot|feet|mile|miles|Hit Points|CP|SP|GP)\b)",
        "50",
        text,
        flags=re.I,
    )
    text = re.sub(r"\bSO\s+ft\.", "50 ft.", text, flags=re.I)
    text = re.sub(r"\b(level|above|below)\s+[lI]\b", r"\1 1", text, flags=re.I)
    text = re.sub(r"\b(\d+)(CP|SP|GP)\b", r"\1 \2", text)
    return text.replace("316.", "3 lb.").replace("216.", "2 lb.")


def join_wrapped_word(match: re.Match[str]) -> str:
    left, right = match.group(1), match.group(2)
    joined = left + right
    if (
        CORPUS_WORDS[joined.lower()] >= 2
        and min(CORPUS_WORDS[left.lower()], CORPUS_WORDS[right.lower()]) <= 5
        and left.lower() not in JOIN_STOP_WORDS
        and right.lower() not in JOIN_STOP_WORDS
    ):
        return joined
    return f"{left} {right}"


def join_split_word(match: re.Match[str]) -> str:
    left, right = match.group(1), match.group(2)
    joined = left + right
    if (
        CORPUS_WORDS[joined.lower()] >= 2
        and min(CORPUS_WORDS[left.lower()], CORPUS_WORDS[right.lower()]) <= 5
        and left.lower() not in JOIN_STOP_WORDS
        and right.lower() not in JOIN_STOP_WORDS
    ):
        return joined
    return match.group(0)


def collapse_spaced_letters(match: re.Match[str]) -> str:
    joined = re.sub(r"\s+", "", match.group(0))
    if CORPUS_WORDS[joined.lower()] >= 1:
        return joined
    return ""


def clean_description(text: str) -> str:
    text = (text or "").replace("\u00ad", "").replace("\ufffd", "")
    text = text.translate(
        str.maketrans({"\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"', "\u2011": "-"})
    )
    text = re.sub(r"([A-Za-z])-[ \t]*\n[ \t]*([a-z])", r"\1\2", text)
    paragraphs = []
    for paragraph in re.split(r"\n\s*\n", text):
        paragraph = re.sub(
            r"([A-Za-z]{2,})[ \t]*\n[ \t]*([a-z]{2,})",
            join_wrapped_word,
            paragraph,
        )
        paragraph = re.sub(r"[ \t]*\n[ \t]*", " ", paragraph)
        paragraphs.append(paragraph)
    text = "\n\n".join(paragraphs)
    for bad, good in OCR_PHRASE_CORRECTIONS.items():
        text = re.sub(
            rf"(?<![A-Za-z]){re.escape(bad)}(?![A-Za-z])",
            good,
            text,
            flags=re.I,
        )
    for _ in range(3):
        text = re.sub(r"(?<!')\b([A-Za-z]{2,})\s+([a-z]{2,})\b", join_split_word, text)
    for bad, good in OCR_PHRASE_CORRECTIONS.items():
        text = re.sub(
            rf"(?<![A-Za-z]){re.escape(bad)}(?![A-Za-z])",
            good,
            text,
            flags=re.I,
        )
    text = re.sub(r"(?:\b[A-Za-z]\s+){3,}[A-Za-z]\b", collapse_spaced_letters, text)
    text = normalize_ocr_numbers(text)
    text = re.sub(r"\s+([,.!?;:])", r"\1", text)
    text = re.sub(r"\(\s+", "(", text)
    text = re.sub(r"\s+\)", ")", text)
    text = re.sub(r"\b([A-Za-z]+)\s+'\s*(s|t|re|ve|ll|d|m)\b", r"\1'\2", text, flags=re.I)
    text = re.sub(r"\b([A-Za-z]+)\s+'(?=[A-Za-z])", r"\1 ", text)
    text = re.sub(r"\b([A-Za-z]+)\s+'\s+(?=[A-Za-z]{2,}\b)", r"\1 ", text)
    text = re.sub(r"\s+'[A-Z](?=[- ,])", "", text)
    text = re.sub(r"[✓◊□■▲▼£°]", "", text)
    text = re.sub(r"(?<!\w)[~^_=.-]{2,}(?!\w)", " ", text)
    text = re.sub(
        r"(?is)\s+C\s*H\s*A\s*P\s*T\s*E\s*R\b[^\n]{0,100}\b\d{1,3}\s*$",
        "",
        text,
    )
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\s+([,.!?;:])", r"\1", text)
    for bad, good in OCR_PHRASE_CORRECTIONS.items():
        text = re.sub(
            rf"(?<![A-Za-z]){re.escape(bad)}(?![A-Za-z])",
            good,
            text,
            flags=re.I,
        )
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_list(value: str) -> list[str]:
    return [
        item.strip()
        for item in re.split(r"\s*(?:,|\band\b)\s*", value, flags=re.I)
        if item.strip()
    ]


def clean_feature_name(raw_name: str) -> str:
    if raw_name in FEATURE_NAME_CORRECTIONS:
        return FEATURE_NAME_CORRECTIONS[raw_name]

    def title_word(match: re.Match[str]) -> str:
        word = match.group(0)
        return word[:1].upper() + word[1:].lower()

    name = re.sub(r"[A-Za-z]+(?:'[A-Za-z]+)?", title_word, raw_name.strip())
    words = name.split()
    for index in range(1, len(words)):
        if words[index].lower() in {"a", "an", "and", "of", "on", "the", "to", "with"}:
            words[index] = words[index].lower()
    return " ".join(words)


def feature_rows(features: list[dict], source: str, prefix: str) -> dict[str, list[dict]]:
    rows: dict[str, list[dict]] = {}
    seen: set[tuple[int, str]] = set()
    for feature in features:
        level = int(feature.get("level", 0))
        raw_name = str(feature.get("name", "")).strip()
        name = clean_feature_name(raw_name)
        if name == "Dragon Companion" and level == 1:
            level = 18
        description = clean_description(feature.get("text", ""))
        if not 1 <= level <= 20 or not name or not description:
            continue
        key = (level, name.casefold())
        if key in seen:
            continue
        seen.add(key)
        rows.setdefault(str(level), []).append(
            {
                "id": slug(f"{prefix}-{level}-{name}"),
                "name": name,
                "description": description,
                "source": source,
            }
        )
    return rows


def species_traits_legacy(species: dict) -> list[dict]:
    text = clean_description(species["text"])
    source = source_label(species["source"])
    matches = list(
        re.finditer(r"(?m)^([A-Z][A-Za-z'’ -]{2,55})\.\s+", text)
    )
    traits: list[dict] = []
    ignored = {"Creature Type", "Size", "Speed"}
    for index, match in enumerate(matches):
        name = match.group(1).strip()
        if name in ignored:
            continue
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        description = text[match.end() : end].strip()
        if description:
            traits.append(
                {
                    "id": slug(f"{species['name']}-{name}"),
                    "name": name,
                    "description": description,
                    "source": source,
                }
            )
    if traits:
        return traits
    return [
        {
            "id": slug(f"{species['name']}-traits"),
            "name": f"{species['name']} Traits",
            "description": text,
            "source": source,
        }
    ]


def species_traits(species: dict) -> list[dict]:
    raw_text = species["text"]
    source = source_label(species["source"])
    matches: list[tuple[str, re.Match[str]]] = []
    for name in SPECIES_TRAIT_NAMES[species["name"]]:
        letters = [re.escape(char) for char in name if char.isalnum() or char == "'"]
        pattern = r"(?i)(?<![A-Za-z])" + r"[.\s]*".join(letters) + r"\s*\.\s+"
        match = re.search(pattern, raw_text)
        if not match:
            raise ValueError(f"Could not locate {species['name']} trait heading: {name}")
        matches.append((name, match))
    matches.sort(key=lambda item: item[1].start())

    traits: list[dict] = []
    for index, (name, match) in enumerate(matches):
        end = matches[index + 1][1].start() if index + 1 < len(matches) else len(raw_text)
        description = clean_description(raw_text[match.end() : end])
        if description:
            traits.append(
                {
                    "id": slug(f"{species['name']}-{name}"),
                    "name": name,
                    "description": description,
                    "source": source,
                }
            )
    return traits


def spell_description(text: str) -> str:
    lines = text.splitlines()
    duration_index = next(
        (index for index, line in enumerate(lines[:18]) if "duration" in line.lower()),
        4,
    )
    description = "\n".join(lines[duration_index + 1 :]).strip()
    return clean_description(description or text)


def spell_metadata(item: dict) -> dict[str, str]:
    text = item.get("text", "")
    labels = list(
        re.finditer(
            r"(?im)^\s*(Casting\s+Time|Range|Components?|Duration)\s*:\s*(.*)$",
            text,
        )
    )
    parsed: dict[str, str] = {}
    for index, match in enumerate(labels):
        key = re.sub(r"\s+", "", match.group(1)).lower()
        canonical = {
            "castingtime": "castingTime",
            "range": "range",
            "component": "components",
            "components": "components",
            "duration": "duration",
        }[key]
        if canonical == "duration":
            value = match.group(2)
        else:
            end = labels[index + 1].start() if index + 1 < len(labels) else match.end()
            value = text[match.start(2) : end]
        parsed[canonical] = clean_description(value)

    result = {
        field: clean_description(parsed.get(field) or item.get(field, ""))
        for field in ("castingTime", "range", "components", "duration")
    }
    result.update(SPELL_FIELD_OVERRIDES.get(item["name"], {}))
    return result


def subclass_intro(text: str) -> str:
    match = re.search(r"(?im)^\s*L\s*E\s*V\s*E\s*L\s+[0-9Il]+[^:\n]{0,8}:", text)
    return clean_description(text[: match.start()] if match else text[:1200])


def build_pack(source_dir: Path) -> dict:
    classes_source = load(source_dir / "classes.json")["classes"]
    origins = load(source_dir / "origins.json")
    feats_source = load(source_dir / "feats.json")["feats"]
    equipment_source = load(source_dir / "equipment.json")
    spells_source = load(source_dir / "spells.json")["spells"]
    creatures_source = load(source_dir / "creatures.json")["creatures"]
    gameplay = load(source_dir / "gameplay-rules.json")["sections"]
    creation = load(source_dir / "character-creation.json")["sections"]
    glossary = load(source_dir / "rules-glossary.json")["entries"]
    multiverse = load(source_dir / "appendix-multiverse.json")
    initialize_corpus_words(
        classes_source,
        origins,
        feats_source,
        equipment_source,
        spells_source,
        creatures_source,
        gameplay,
        creation,
        glossary,
        multiverse,
    )

    ability_map = {
        "strength": "strength",
        "dexterity": "agility",
        "constitution": "stamina",
        "intelligence": "intellect",
        "wisdom": "spirit",
        "charisma": "charisma",
    }
    class_stats = {
        "Barbarian": (12, "strength"),
        "Bard": (8, "charisma"),
        "Cleric": (8, "spirit"),
        "Druid": (8, "spirit"),
        "Fighter": (10, "strength"),
        "Monk": (8, "agility"),
        "Paladin": (10, "strength"),
        "Ranger": (10, "agility"),
        "Rogue": (8, "agility"),
        "Sorcerer": (6, "charisma"),
        "Warlock": (8, "charisma"),
        "Wizard": (6, "intellect"),
    }

    classes = []
    for item in classes_source:
        hit_die, primary = class_stats[item["name"]]
        class_source = source_label(item["source"])
        subclasses = []
        rogue_psionic_power = None
        if item["name"] == "Rogue":
            rogue_psionic_power = next(
                (
                    feature
                    for subclass in item["subclasses"]
                    for feature in subclass["features"]
                    if FEATURE_NAME_CORRECTIONS.get(feature["name"], feature["name"])
                    == "Psionic Power"
                ),
                None,
            )
        for subclass in item["subclasses"]:
            subclass_source = source_label(subclass["source"])
            features = list(subclass["features"])
            if item["name"] == "Rogue" and subclass["name"] == "Assassin":
                features = [
                    feature
                    for feature in features
                    if FEATURE_NAME_CORRECTIONS.get(feature["name"], feature["name"])
                    != "Psionic Power"
                ]
            elif item["name"] == "Rogue" and subclass["name"] == "Soulknife":
                thief_features = {
                    "FASTHANDS",
                    "SECONDSTORYWORK",
                    "SUPREMESNEAK",
                    "USEMAGICDEVICE",
                }
                features = [
                    feature
                    for feature in features
                    if re.sub(r"[^A-Z0-9]", "", feature["name"].upper())
                    not in thief_features
                ]
                if rogue_psionic_power:
                    features.insert(0, rogue_psionic_power)
            subclasses.append(
                {
                    "id": slug(subclass["name"]),
                    "name": subclass["name"],
                    "description": subclass_intro(subclass["text"]),
                    "levelFeatures": feature_rows(
                        features, subclass_source, slug(subclass["name"])
                    ),
                }
            )
        classes.append(
            {
                "id": slug(item["name"]),
                "name": item["name"],
                "hitDie": hit_die,
                "primaryAbility": primary,
                "description": clean_description(item["text"][:1600]),
                "levelFeatures": feature_rows(
                    item["progressionFeatures"], class_source, slug(item["name"])
                ),
                "subclasses": subclasses,
            }
        )

    ancestries = []
    for species in origins["species"]:
        speed_match = re.search(r"(\d+)", species.get("speed", ""))
        ancestries.append(
            {
                "id": slug(species["name"]),
                "name": species["name"],
                "speed": int(speed_match.group(1)) if speed_match else 30,
                "traits": species_traits(species),
            }
        )

    backgrounds = []
    for item in origins["backgrounds"]:
        ability_options = [
            ability_map[name.lower()]
            for name in split_list(item["abilityScores"])
            if name.lower() in ability_map
        ]
        feat_name = re.sub(r"\s*\([^)]*\)", "", item["feat"]).strip()
        description = "\n".join(
            [
                f"Ability choices: {item['abilityScores']}",
                f"Origin feat: {item['feat']}",
                f"Tool proficiency: {item['toolProficiency']}",
                f"Starting equipment: {item['equipment']}",
            ]
        )
        backgrounds.append(
            {
                "id": slug(item["name"]),
                "name": item["name"],
                "skills": split_list(item["skillProficiencies"]),
                "abilityOptions": ability_options,
                "featId": slug(feat_name),
                "toolProficiencies": [clean_description(item["toolProficiency"])],
                "equipment": clean_description(item["equipment"]),
                "feature": {
                    "id": slug(f"{item['name']}-background-benefits"),
                    "name": f"{item['name']} Background Benefits",
                    "description": clean_description(description),
                    "source": source_label(item["source"]),
                },
            }
        )

    feats = [
        {
            "id": slug(item["name"]),
            "name": item["name"],
            "category": item["category"],
            **({"prerequisite": item["prerequisite"]} if item.get("prerequisite") else {}),
            "description": clean_description(item["text"]),
            "source": source_label(item["source"]),
        }
        for item in feats_source
    ]

    equipment = []
    for item in equipment_source["weapons"]:
        equipment.append(
            {
                "id": slug(item["name"]),
                "name": item["name"],
                "category": item["category"],
                "description": clean_description(item.get("sourceRow", "")),
                "cost": clean_description(item["cost"]),
                "weight": clean_description(item["weight"]),
                "damage": normalize_ocr_numbers(item["damage"]),
                "damageType": item["damageType"],
                "properties": [
                    clean_description(value)
                    for value in item.get("properties", "").split(",")
                    if value.strip()
                ],
                "mastery": item["mastery"],
                "source": source_label(item["source"]),
            }
        )

    spells = [
        {
            "id": slug(item["name"]),
            "name": item["name"],
            "level": item["level"],
            "school": item["school"],
            "classes": item["classes"],
            "ritual": item["ritual"],
            **spell_metadata(item),
            "description": spell_description(item["text"]),
            "source": source_label(item["source"]),
        }
        for item in spells_source
    ]

    creatures = [
        {
            "id": slug(item["name"]),
            "name": item["name"],
            "challengeRating": item["challengeRating"],
            "description": clean_description(item["text"]),
            "source": source_label(item["source"]),
        }
        for item in creatures_source
    ]

    rules = []
    rule_ids: set[str] = set()

    def add_rule(item: dict, category: str, prefix: str) -> None:
        name = item.get("title") or item.get("term") or item.get("name")
        description = clean_description(item["text"])
        if name == "Character Sheet":
            description = (
                "A character sheet records a character's abilities, defenses, Hit Points, "
                "features, equipment, spells, and personal details. Update it whenever the "
                "character gains a level or their tracked resources change."
            )
        base_id = slug(f"{prefix}-{name}")
        rule_id = base_id
        suffix = 2
        while rule_id in rule_ids:
            rule_id = f"{base_id}-{suffix}"
            suffix += 1
        rule_ids.add(rule_id)
        rules.append(
            {
                "id": rule_id,
                "name": name,
                "category": category,
                "description": description,
                "source": source_label(item["source"]),
            }
        )

    for item in gameplay:
        add_rule(item, "Gameplay", "gameplay")
    for item in creation:
        add_rule(item, "Character Creation", "character-creation")
    for item in equipment_source["sections"]:
        add_rule(item, "Equipment", "equipment")
    for item in glossary:
        add_rule(item, "Rules Glossary", "glossary")
    rules.append(
        {
            "id": "multiverse",
            "name": "The Multiverse",
            "category": "Setting Reference",
            "description": clean_description(multiverse["text"]),
            "source": source_label(multiverse["source"]),
        }
    )

    return {
        "schemaVersion": "2.0",
        "pack": {
            "id": "dnd5e-2024-phb",
            "name": "D&D 2024 Player's Handbook",
            "version": "1.0.1",
            "description": "Structured offline character options and rules reference extracted from the 2024 Player's Handbook.",
            "source": SOURCE_TITLE,
        },
        "ancestries": ancestries,
        "classes": classes,
        "backgrounds": backgrounds,
        "feats": feats,
        "equipment": equipment,
        "spells": spells,
        "creatures": creatures,
        "rules": rules,
    }


def validate(pack: dict) -> None:
    expected = {
        "ancestries": 10,
        "classes": 12,
        "backgrounds": 16,
        "feats": 74,
        "equipment": 38,
        "spells": 390,
        "creatures": 51,
        "rules": 224,
    }
    if pack.get("schemaVersion") != "2.0":
        raise ValueError("Converter produced the wrong schema version")
    for collection, count in expected.items():
        values = pack.get(collection)
        if not isinstance(values, list) or len(values) != count:
            raise ValueError(f"{collection}: expected {count}, found {len(values or [])}")
        ids = [item["id"] for item in values]
        if len(ids) != len(set(ids)):
            duplicates = sorted({value for value in ids if ids.count(value) > 1})
            raise ValueError(f"{collection}: duplicate ids: {duplicates}")
    if sum(len(item.get("subclasses", [])) for item in pack["classes"]) != 48:
        raise ValueError("Expected 48 subclasses")
    if any(not spell["description"] for spell in pack["spells"]):
        raise ValueError("Every spell must have a description")

    for ancestry in pack["ancestries"]:
        actual = [trait["name"] for trait in ancestry["traits"]]
        expected_traits = SPECIES_TRAIT_NAMES[ancestry["name"]]
        if actual != expected_traits:
            raise ValueError(
                f"{ancestry['name']}: expected traits {expected_traits}, found {actual}"
            )

    malformed_metadata = []
    for spell in pack["spells"]:
        for field in ("castingTime", "range", "components", "duration"):
            value = spell[field]
            if re.search(
                r"(?i)(?:\b[lI]\s+(?:minute|hour|round|mile)s?\b|concentrat\s+ion|"
                r"m\s+inute|min\s+utes|rit\s+ual|immedi$|\.ninutes|[·•])",
                value,
            ):
                malformed_metadata.append(f"{spell['name']}.{field}={value!r}")
    if malformed_metadata:
        raise ValueError("Malformed spell metadata: " + "; ".join(malformed_metadata))

    rogue = next(item for item in pack["classes"] if item["name"] == "Rogue")
    rogue_features = {
        subclass["name"]: {
            feature["name"]
            for features in subclass["levelFeatures"].values()
            for feature in features
        }
        for subclass in rogue["subclasses"]
    }
    if "Psionic Power" not in rogue_features["Soulknife"]:
        raise ValueError("Soulknife is missing Psionic Power")
    if "Psionic Power" in rogue_features["Assassin"]:
        raise ValueError("Psionic Power was incorrectly assigned to Assassin")
    if rogue_features["Soulknife"] & {"Fast Hands", "Second-Story Work", "Supreme Sneak", "Use Magic Device"}:
        raise ValueError("Soulknife contains leaked Thief features")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build an importable schema-2 content pack")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    pack = build_pack(args.source.resolve())
    validate(pack)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(pack, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "output": str(args.output.resolve()),
                "schemaVersion": pack["schemaVersion"],
                "counts": {
                    key: len(pack[key])
                    for key in (
                        "ancestries",
                        "classes",
                        "backgrounds",
                        "feats",
                        "equipment",
                        "spells",
                        "creatures",
                        "rules",
                    )
                },
                "subclasses": sum(len(item["subclasses"]) for item in pack["classes"]),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
