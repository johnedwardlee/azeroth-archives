"use client";

import {
  BookOpen,
  ChevronDown,
  Copy,
  Download,
  FileDown,
  FileJson,
  Heart,
  HardDrive,
  LibraryBig,
  Menu,
  MoreHorizontal,
  Plus,
  Save,
  Search,
  Shield,
  Sparkles,
  Swords,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { FeatManager, InventoryManager, SessionTracker, SpellbookManager } from "./living-sheet";
import { CombatManager, SKILLS } from "./combat-sheet";
import {
  ABILITY_LABELS,
  abilityModifier,
  proficiencyForLevel,
  type AbilityKey,
  type CharacterData,
  type ContentPack,
} from "../lib/types";

type Tab = "overview" | "features" | "combat" | "spells" | "equipment" | "notes";
type OfflineStore = { version: 1; characters: CharacterData[]; packs: ContentPack[] };

const abilityKeys = Object.keys(ABILITY_LABELS) as AbilityKey[];
const browserStorageKey = "azeroth-archives-offline-data";

function readBrowserStore(): OfflineStore {
  try {
    const parsed = JSON.parse(localStorage.getItem(browserStorageKey) ?? "null") as Partial<OfflineStore> | null;
    return {
      version: 1,
      characters: Array.isArray(parsed?.characters) ? parsed.characters : [],
      packs: Array.isArray(parsed?.packs) ? parsed.packs : [],
    };
  } catch {
    return { version: 1, characters: [], packs: [] };
  }
}

function writeBrowserStore(store: OfflineStore) {
  localStorage.setItem(browserStorageKey, JSON.stringify(store));
}

function newCharacter(): CharacterData {
  const now = new Date().toISOString();
  return {
    id: "draft",
    name: "New Hero",
    playerName: "",
    ancestry: "",
    className: "",
    subclassName: "",
    background: "",
    level: 1,
    experience: 0,
    currentHp: 12,
    maxHp: 12,
    temporaryHp: 0,
    armorClass: 14,
    speed: 30,
    proficiencyBonus: 2,
    abilities: { strength: 15, agility: 12, stamina: 14, intellect: 10, spirit: 11, charisma: 13 },
    savingThrowProficiencies: [],
    skillProficiencies: [],
    skillExpertise: [],
    attacks: [],
    features: [],
    feats: [],
    spells: [],
    spellSlots: {},
    inventory: [],
    currency: { copper: 0, silver: 0, gold: 15 },
    inspiration: false,
    hitDiceTotal: 1,
    hitDiceUsed: 0,
    deathSaveSuccesses: 0,
    deathSaveFailures: 0,
    conditions: [],
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeCharacter(value: Partial<CharacterData>): CharacterData {
  const defaults = newCharacter();
  const maximumHitDice = Math.max(1, Number(value.hitDiceTotal ?? value.level ?? 1));
  return {
    ...defaults,
    ...value,
    subclassName: value.subclassName ?? "",
    temporaryHp: Math.max(0, Number(value.temporaryHp ?? 0)),
    savingThrowProficiencies: Array.isArray(value.savingThrowProficiencies) ? value.savingThrowProficiencies : [],
    skillProficiencies: Array.isArray(value.skillProficiencies) ? value.skillProficiencies : [],
    skillExpertise: Array.isArray(value.skillExpertise) ? value.skillExpertise : [],
    attacks: Array.isArray(value.attacks) ? value.attacks : [],
    feats: Array.isArray(value.feats) ? value.feats : [],
    spells: Array.isArray(value.spells) ? value.spells : [],
    spellSlots: value.spellSlots && typeof value.spellSlots === "object" ? value.spellSlots : {},
    inventory: Array.isArray(value.inventory) ? value.inventory : [],
    currency: { ...defaults.currency, ...(value.currency ?? {}) },
    inspiration: Boolean(value.inspiration),
    hitDiceTotal: maximumHitDice,
    hitDiceUsed: Math.max(0, Math.min(maximumHitDice, Number(value.hitDiceUsed ?? 0))),
    deathSaveSuccesses: Math.max(0, Math.min(3, Number(value.deathSaveSuccesses ?? 0))),
    deathSaveFailures: Math.max(0, Math.min(3, Number(value.deathSaveFailures ?? 0))),
    conditions: Array.isArray(value.conditions) ? value.conditions : [],
  };
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function modifierLabel(score: number) {
  const modifier = abilityModifier(score);
  return `${modifier >= 0 ? "+" : ""}${modifier}`;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

export function CharacterManager() {
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [character, setCharacter] = useState<CharacterData>(newCharacter);
  const [customPacks, setCustomPacks] = useState<ContentPack[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Loading your roster…");
  const [saving, setSaving] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const [menuCharacterId, setMenuCharacterId] = useState<string | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpHpGain, setLevelUpHpGain] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<CharacterData | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const characterFileInput = useRef<HTMLInputElement>(null);
  const characterRef = useRef(character);
  const deletedCharacterIds = useRef(new Set<string>());
  characterRef.current = character;

  const content = customPacks;
  const ancestries = useMemo(() => uniqueById(content.flatMap((pack) => pack.ancestries ?? [])), [content]);
  const classes = useMemo(() => uniqueById(content.flatMap((pack) => pack.classes ?? [])), [content]);
  const backgrounds = useMemo(() => uniqueById(content.flatMap((pack) => pack.backgrounds ?? [])), [content]);
  const feats = useMemo(() => uniqueById(content.flatMap((pack) => pack.feats ?? [])), [content]);
  const equipment = useMemo(() => uniqueById(content.flatMap((pack) => pack.equipment ?? [])), [content]);
  const spells = useMemo(() => uniqueById(content.flatMap((pack) => pack.spells ?? [])), [content]);
  const featureCatalogById = useMemo(() => new Map(
    [
      ...ancestries.flatMap((item) => item.traits),
      ...classes.flatMap((item) => [
        ...Object.values(item.levelFeatures).flat(),
        ...(item.subclasses ?? []).flatMap((subclass) => Object.values(subclass.levelFeatures).flat()),
      ]),
      ...backgrounds.flatMap((item) => item.feature ? [item.feature] : []),
    ].filter((feature) => feature.id).map((feature) => [feature.id!, feature]),
  ), [ancestries, classes, backgrounds]);
  const resolvedFeatures = useMemo(
    () => character.features.map((feature) => feature.id ? featureCatalogById.get(feature.id) ?? feature : feature),
    [character.features, featureCatalogById],
  );
  const selectedClass = useMemo(
    () => classes.find((item) => item.name === character.className),
    [classes, character.className],
  );
  const subclasses = selectedClass?.subclasses ?? [];
  const visibleCharacters = characters.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));
  const nextLevelXp = character.level * 1000;
  const xpProgress = Math.min(100, Math.round((character.experience / nextLevelXp) * 100));
  const plannedLevel = Math.min(20, character.level + 1);
  const selectedSubclass = selectedClass?.subclasses?.find((item) => item.name === character.subclassName);
  const plannedClassFeatures = selectedClass?.levelFeatures[String(plannedLevel)] ?? [];
  const plannedSubclassFeatures = selectedSubclass?.levelFeatures[String(plannedLevel)] ?? [];
  const plannedFeatures = [...plannedClassFeatures, ...plannedSubclassFeatures];
  const needsSubclass = !selectedSubclass && Boolean(selectedClass?.subclasses?.some((item) => (item.levelFeatures[String(plannedLevel)] ?? []).length));

  useEffect(() => {
    const load = window.azerothDesktop?.load() ?? Promise.resolve(readBrowserStore());
    load.then((store) => {
      const loadedCharacters = store.characters.map((item) => normalizeCharacter(item));
      setCharacters(loadedCharacters);
      if (loadedCharacters[0]) setCharacter(loadedCharacters[0]);
      setCustomPacks(store.packs);
      setStatus(store.characters.length ? "Saved on this device" : "Create your first hero");
    }).catch(() => setStatus("Could not read local character data"));
  }, []);

  useEffect(() => {
    if (character.id === "draft") return;
    setCharacters((current) => current.map((item) => item.id === character.id ? character : item));
  }, [character]);

  useEffect(() => {
    if (character.id === "draft" || status !== "Unsaved changes") return;
    const payload = character;
    const timer = window.setTimeout(() => {
      persistCharacter(payload).then(async (saved) => {
        if (deletedCharacterIds.current.has(saved.id)) {
          if (window.azerothDesktop) await window.azerothDesktop.deleteCharacter(saved.id);
          return;
        }
        setCharacters((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
        if (characterRef.current.id === payload.id && characterRef.current.updatedAt === payload.updatedAt) {
          setCharacter(saved);
          setStatus("Autosaved on this device");
        }
      }).catch(() => setStatus("Autosave failed — use Save character"));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [character, status]);

  function patchCharacter(patch: Partial<CharacterData>) {
    setCharacter((current) => ({ ...current, ...patch, updatedAt: new Date().toISOString() }));
    setStatus("Unsaved changes");
  }

  function updateAbility(key: AbilityKey, value: number) {
    patchCharacter({ abilities: { ...character.abilities, [key]: Math.max(1, Math.min(30, value || 1)) } });
  }

  function applyAncestry(name: string) {
    const ancestry = ancestries.find((item) => item.name === name);
    patchCharacter({
      ancestry: name,
      speed: ancestry?.speed ?? character.speed,
      features: [
        ...(ancestry?.traits ?? []),
        ...character.features.filter((feature) => !ancestries.some((item) => item.traits.some((trait) => trait.name === feature.name))),
      ],
    });
  }

  function applyClass(name: string) {
    const selectedClass = classes.find((item) => item.name === name);
    const classFeatureNames = new Set(classes.flatMap((item) => Object.values(item.levelFeatures).flat().map((feature) => feature.name)));
    const subclassFeatureNames = new Set(classes.flatMap((item) => (item.subclasses ?? []).flatMap((subclass) => Object.values(subclass.levelFeatures).flat().map((feature) => feature.name))));
    patchCharacter({
      className: name,
      subclassName: "",
      savingThrowProficiencies: selectedClass?.savingThrowProficiencies ?? character.savingThrowProficiencies,
      features: [
        ...character.features.filter((feature) => !classFeatureNames.has(feature.name) && !subclassFeatureNames.has(feature.name)),
        ...Object.entries(selectedClass?.levelFeatures ?? {})
          .filter(([level]) => Number(level) <= character.level)
          .flatMap(([, features]) => features),
      ],
    });
  }

  function applySubclass(name: string) {
    const selectedSubclass = subclasses.find((item) => item.name === name);
    const subclassFeatureNames = new Set(classes.flatMap((item) => (item.subclasses ?? []).flatMap((subclass) => Object.values(subclass.levelFeatures).flat().map((feature) => feature.name))));
    patchCharacter({
      subclassName: name,
      features: [
        ...character.features.filter((feature) => !subclassFeatureNames.has(feature.name)),
        ...Object.entries(selectedSubclass?.levelFeatures ?? {})
          .filter(([level]) => Number(level) <= character.level)
          .flatMap(([, features]) => features),
      ],
    });
  }

  function applyBackground(name: string) {
    const selectedBackground = backgrounds.find((item) => item.name === name);
    const previousBackground = backgrounds.find((item) => item.name === character.background);
    const backgroundFeatureNames = new Set(backgrounds.flatMap((item) => item.feature ? [item.feature.name] : []));
    const previousBackgroundSkills = new Set(previousBackground?.skills ?? []);
    const skillProficiencies = [
      ...character.skillProficiencies.filter((skill) => !previousBackgroundSkills.has(skill)),
      ...(selectedBackground?.skills ?? []),
    ];
    patchCharacter({
      background: name,
      skillProficiencies: [...new Set(skillProficiencies)],
      skillExpertise: character.skillExpertise.filter((skill) => skillProficiencies.includes(skill)),
      features: [
        ...character.features.filter((feature) => !backgroundFeatureNames.has(feature.name)),
        ...(selectedBackground?.feature ? [selectedBackground.feature] : []),
      ],
    });
  }

  async function persistCharacter(payload: CharacterData) {
    if (window.azerothDesktop) return window.azerothDesktop.saveCharacter(payload);
    const saved = { ...payload, updatedAt: new Date().toISOString() };
    const store = readBrowserStore();
    store.characters = [saved, ...store.characters.filter((item) => item.id !== saved.id)];
    writeBrowserStore(store);
    return saved;
  }

  async function saveCharacter() {
    setSaving(true);
    setStatus("Saving…");
    const payload = { ...character, id: character.id === "draft" ? crypto.randomUUID() : character.id };
    try {
      const saved = await persistCharacter(payload);
      setCharacter(saved);
      setCharacters((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setStatus("Saved on this device");
    } catch {
      setStatus("Could not save — try again");
    } finally {
      setSaving(false);
    }
  }

  function deleteCharacter(target: CharacterData) {
    setMenuCharacterId(null);
    setDeleteTarget(target);
  }

  async function confirmDeleteCharacter() {
    const target = deleteTarget;
    if (!target) return;
    setDeleteTarget(null);
    if (target.id === "draft") {
      setCharacter(newCharacter());
      return;
    }
    deletedCharacterIds.current.add(target.id);
    if (window.azerothDesktop) {
      await window.azerothDesktop.deleteCharacter(target.id);
    } else {
      const store = readBrowserStore();
      store.characters = store.characters.filter((item) => item.id !== target.id);
      writeBrowserStore(store);
    }
    const remaining = characters.filter((item) => item.id !== target.id);
    setCharacters(remaining);
    if (character.id === target.id) setCharacter(remaining[0] ?? newCharacter());
    setStatus("Character removed");
  }

  async function duplicateCharacter(source: CharacterData) {
    const now = new Date().toISOString();
    const duplicate = normalizeCharacter({
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} Copy`,
      createdAt: now,
      updatedAt: now,
    });
    const saved = await persistCharacter(duplicate);
    setCharacters((current) => [saved, ...current]);
    setCharacter(saved);
    setMenuCharacterId(null);
    setShowRoster(false);
    setStatus("Character duplicated");
  }

  async function exportCharacter(source: CharacterData) {
    const backup = JSON.stringify({ format: "azeroth-archives-character", version: 1, character: source }, null, 2);
    const safeName = source.name.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "character";
    const filename = `${safeName}.azeroth-character.json`;
    if (window.azerothDesktop) {
      const destination = await window.azerothDesktop.saveJson(filename, backup);
      setStatus(destination ? "Character backup saved" : "Backup export canceled");
    } else {
      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(new Blob([backup], { type: "application/json" }));
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(anchor.href);
      setStatus("Character backup downloaded");
    }
    setMenuCharacterId(null);
  }

  async function importCharacter(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { format?: string; character?: Partial<CharacterData> } & Partial<CharacterData>;
      const source = parsed.character ?? parsed;
      if (typeof source.name !== "string" || !source.name.trim() || !source.abilities || typeof source.abilities !== "object") throw new Error("Invalid character");
      const now = new Date().toISOString();
      const imported = normalizeCharacter({ ...source, id: crypto.randomUUID(), createdAt: now, updatedAt: now });
      const saved = await persistCharacter(imported);
      setCharacters((current) => [saved, ...current]);
      setCharacter(saved);
      setShowRoster(false);
      setStatus("Character imported as a new copy");
    } catch {
      setStatus("That file is not a valid character backup");
    }
  }

  function levelUp() {
    if (character.level >= 20 || !selectedClass) {
      if (!selectedClass) setStatus("Choose a class before leveling up");
      return;
    }
    const staminaBonus = abilityModifier(character.abilities.stamina);
    setLevelUpHpGain(Math.max(1, Math.floor(selectedClass.hitDie / 2) + 1 + staminaBonus));
    setShowLevelUp(true);
  }

  function confirmLevelUp() {
    if (character.level >= 20 || !selectedClass || needsSubclass) return;
    const nextLevel = character.level + 1;
    const newFeatures = selectedClass?.levelFeatures[String(nextLevel)] ?? [];
    const newSubclassFeatures = selectedSubclass?.levelFeatures[String(nextLevel)] ?? [];
    patchCharacter({
      level: nextLevel,
      experience: 0,
      maxHp: character.maxHp + levelUpHpGain,
      currentHp: character.currentHp + levelUpHpGain,
      proficiencyBonus: proficiencyForLevel(nextLevel),
      hitDiceTotal: nextLevel,
      features: [...character.features, ...[...newFeatures, ...newSubclassFeatures].filter((feature) => !character.features.some((existing) => existing.name === feature.name))],
    });
    setShowLevelUp(false);
  }

  async function importPack(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const pack = JSON.parse(await file.text()) as ContentPack;
      if (!(["1.0", "2.0"] as const).includes(pack.schemaVersion) || !pack.pack?.id || !pack.pack?.name || !pack.pack?.version) {
        throw new Error("Missing required pack details");
      }
      if (window.azerothDesktop) {
        await window.azerothDesktop.savePack(pack);
      } else {
        const store = readBrowserStore();
        store.packs = [pack, ...store.packs.filter((item) => item.pack.id !== pack.pack.id)];
        writeBrowserStore(store);
      }
      setCustomPacks((current) => [pack, ...current.filter((item) => item.pack.id !== pack.pack.id)]);
      setStatus(`${pack.pack.name} imported`);
      setShowLibrary(true);
    } catch {
      setStatus("That file is not a valid Warcraft 5E content pack");
    }
  }

  async function removePack(id: string) {
    if (window.azerothDesktop) {
      await window.azerothDesktop.deletePack(id);
    } else {
      const store = readBrowserStore();
      store.packs = store.packs.filter((item) => item.pack.id !== id);
      writeBrowserStore(store);
    }
    setCustomPacks((current) => current.filter((item) => item.pack.id !== id));
    setStatus("Content pack removed");
  }

  async function exportPdf() {
    setStatus("Building character sheet…");
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const ink: [number, number, number] = [31, 37, 34];
    const green: [number, number, number] = [45, 99, 78];
    const gold: [number, number, number] = [192, 137, 55];
    doc.setFillColor(...green); doc.rect(0, 0, 612, 96, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(24); doc.text(character.name || "Unnamed Hero", 42, 45);
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(`${character.ancestry}  •  Level ${character.level} ${character.className}  •  ${character.background}`, 42, 68);
    doc.setTextColor(...ink); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("WARCRAFT 5E CHARACTER RECORD", 570, 43, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setTextColor(225, 238, 231); doc.text(`Player: ${character.playerName || "—"}`, 570, 67, { align: "right" });

    const statY = 126;
    [["ARMOR", character.armorClass], ["HIT POINTS", `${character.currentHp} / ${character.maxHp}${character.temporaryHp ? ` +${character.temporaryHp}` : ""}`], ["SPEED", `${character.speed} ft`], ["PROFICIENCY", `+${character.proficiencyBonus}`]].forEach(([label, value], index) => {
      const x = 42 + index * 132;
      doc.setDrawColor(219, 216, 205); doc.roundedRect(x, statY, 114, 54, 6, 6, "S");
      doc.setFontSize(8); doc.setTextColor(112, 112, 103); doc.text(String(label), x + 12, statY + 17);
      doc.setFontSize(17); doc.setFont("helvetica", "bold"); doc.setTextColor(...ink); doc.text(String(value), x + 12, statY + 40);
    });

    doc.setFontSize(11); doc.setTextColor(...green); doc.text("ABILITIES", 42, 216);
    abilityKeys.forEach((key, index) => {
      const x = 42 + index * 88;
      doc.setDrawColor(...gold); doc.roundedRect(x, 230, 74, 70, 4, 4, "S");
      doc.setFontSize(7); doc.setTextColor(112, 112, 103); doc.text(ABILITY_LABELS[key].toUpperCase(), x + 37, 245, { align: "center" });
      doc.setFontSize(19); doc.setFont("helvetica", "bold"); doc.setTextColor(...ink); doc.text(String(character.abilities[key]), x + 37, 269, { align: "center" });
      doc.setFontSize(10); doc.setTextColor(...green); doc.text(modifierLabel(character.abilities[key]), x + 37, 288, { align: "center" });
    });

    doc.setFontSize(11); doc.setTextColor(...green); doc.text("FEATURES & TRAITS", 42, 338);
    let y = 358;
    resolvedFeatures.slice(0, 8).forEach((feature) => {
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...ink); doc.text(feature.name, 42, y);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(80, 83, 78);
      const lines = doc.splitTextToSize(feature.description, 500) as string[];
      doc.text(lines, 42, y + 13); y += 24 + lines.length * 9;
    });

    if (character.notes) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...green); doc.text("NOTES", 42, Math.min(y + 12, 690));
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(80, 83, 78);
      doc.text(doc.splitTextToSize(character.notes, 500), 42, Math.min(y + 30, 708));
    }
    doc.setFontSize(7); doc.setTextColor(140, 140, 132); doc.text("Generated with Azeroth Archives", 42, 758);

    doc.addPage();
    doc.setFillColor(...green); doc.rect(0, 0, 612, 68, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text(`${character.name || "Hero"} · Living Sheet`, 42, 41);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(`Hit Dice ${character.hitDiceTotal - character.hitDiceUsed}/${character.hitDiceTotal}  ·  Inspiration ${character.inspiration ? "Yes" : "No"}  ·  GP ${character.currency.gold}  SP ${character.currency.silver}  CP ${character.currency.copper}`, 570, 41, { align: "right" });
    let livingY = 96;
    const ensureLivingSpace = (height: number) => {
      if (livingY + height < 742) return;
      doc.setFontSize(7); doc.setTextColor(140, 140, 132); doc.text("Generated with Azeroth Archives", 42, 758);
      doc.addPage(); livingY = 54;
    };
    const addLivingSection = (title: string, rows: Array<{ name: string; detail: string }>) => {
      ensureLivingSpace(42);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...green); doc.text(title, 42, livingY); livingY += 17;
      if (!rows.length) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120, 122, 116); doc.text("None recorded", 42, livingY); livingY += 20; return;
      }
      rows.forEach((row) => {
        const detailLines = doc.splitTextToSize(row.detail.slice(0, 500), 480) as string[];
        const height = 22 + Math.min(detailLines.length, 5) * 8;
        ensureLivingSpace(height);
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...ink); doc.text(row.name, 42, livingY);
        doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(80, 83, 78); doc.text(detailLines.slice(0, 5), 42, livingY + 11);
        livingY += height;
      });
      livingY += 6;
    };
    addLivingSection("SAVING THROWS", abilityKeys.map((ability) => {
      const proficient = character.savingThrowProficiencies.includes(ability);
      const modifier = abilityModifier(character.abilities[ability]) + (proficient ? character.proficiencyBonus : 0);
      return { name: `${proficient ? "Proficient · " : ""}${ABILITY_LABELS[ability]}`, detail: `${modifier >= 0 ? "+" : ""}${modifier}` };
    }));
    addLivingSection("SKILLS", SKILLS.map((skill) => {
      const expertise = character.skillExpertise.includes(skill.name);
      const proficient = character.skillProficiencies.includes(skill.name);
      const modifier = abilityModifier(character.abilities[skill.ability]) + character.proficiencyBonus * (expertise ? 2 : proficient ? 1 : 0);
      return { name: `${expertise ? "Expertise · " : proficient ? "Proficient · " : ""}${skill.name}`, detail: `${ABILITY_LABELS[skill.ability]} ${modifier >= 0 ? "+" : ""}${modifier}` };
    }));
    addLivingSection("ATTACKS", character.attacks.map((attack) => {
      const modifier = abilityModifier(character.abilities[attack.ability]) + (attack.proficient ? character.proficiencyBonus : 0) + attack.bonus;
      return { name: attack.name, detail: `Attack ${modifier >= 0 ? "+" : ""}${modifier} · ${attack.damage || "—"} ${attack.damageType}${attack.notes ? ` · ${attack.notes}` : ""}` };
    }));
    addLivingSection("FEATS", character.feats.map((feat) => ({ name: feat.name, detail: `${feat.category}${feat.prerequisite ? ` · ${feat.prerequisite}` : ""}\n${feat.description}` })));
    addLivingSection("SPELLBOOK", character.spells.map((spell) => ({ name: `${spell.prepared ? "Prepared · " : ""}${spell.name}`, detail: `${spell.level ? `Level ${spell.level}` : "Cantrip"} ${spell.school} · ${spell.castingTime} · ${spell.range} · ${spell.duration}` })));
    addLivingSection("EQUIPMENT", character.inventory.map((item) => ({ name: `${item.equipped ? "Equipped · " : ""}${item.quantity}× ${item.name}`, detail: [item.category, item.weight, item.cost, item.notes].filter(Boolean).join(" · ") })));
    if (character.conditions.length) addLivingSection("ACTIVE CONDITIONS", character.conditions.map((condition) => ({ name: condition, detail: "Active condition" })));
    doc.setFontSize(7); doc.setTextColor(140, 140, 132); doc.text("Generated with Azeroth Archives", 42, 758);
    const filename = `${character.name.trim().replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "character"}.pdf`;
    if (window.azerothDesktop) {
      const bytes = Array.from(new Uint8Array(doc.output("arraybuffer")));
      const destination = await window.azerothDesktop.savePdf(filename, bytes);
      setStatus(destination ? "Character sheet saved" : "PDF export canceled");
    } else {
      doc.save(filename);
      setStatus("Character sheet downloaded");
    }
  }

  return (
    <main className="app-shell">
      <input ref={fileInput} className="sr-only" type="file" accept=".json,.w5e,application/json" onChange={importPack} />
      <input ref={characterFileInput} className="sr-only" type="file" accept=".json,application/json" onChange={importCharacter} />
      <header className="topbar">
        <button className="icon-button mobile-only" aria-label="Open roster" onClick={() => setShowRoster(true)}><Menu size={20} /></button>
        <div className="brand-mark" aria-hidden="true">A</div>
        <div className="brand-copy"><strong>Azeroth Archives</strong><span>Offline Warcraft 5E character manager</span></div>
        <div className="topbar-actions">
          <button className="button button-quiet" onClick={() => setShowLibrary(true)}><LibraryBig size={16} /><span>Content library</span><b>{content.length}</b></button>
          <button className="button button-outline" onClick={exportPdf}><Download size={16} /><span>Export PDF</span></button>
          <button className="button button-primary" onClick={saveCharacter} disabled={saving}><Save size={16} />{saving ? "Saving" : "Save character"}</button>
          <span className="avatar-button" role="img" title="All data is stored on this device" aria-label="Stored locally"><HardDrive size={19} /></span>
        </div>
      </header>

      <aside className={`roster-panel ${showRoster ? "is-open" : ""}`}>
        <div className="roster-heading"><div><span className="eyebrow">Your party</span><h2>Characters</h2></div><button className="icon-button mobile-only" onClick={() => setShowRoster(false)} aria-label="Close roster"><X size={18} /></button></div>
        <button className="button button-create" onClick={() => { setCharacter(newCharacter()); setShowRoster(false); setStatus("New character draft"); }}><Plus size={17} />Create character</button>
        <label className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a character" /></label>
        <div className="character-list">
          {visibleCharacters.map((item, index) => (
            <div key={item.id} className={`character-row ${item.id === character.id ? "active" : ""}`}>
              <button className="character-row-select" onClick={() => { setCharacter(item); setMenuCharacterId(null); setShowRoster(false); }}>
                <span className={`mini-portrait tone-${index % 4}`}>{initials(item.name)}</span>
                <span><strong>{item.name}</strong><small>Level {item.level} {item.className}</small></span>
              </button>
              <button className="character-row-more" aria-label={`Actions for ${item.name}`} aria-expanded={menuCharacterId === item.id} onClick={() => setMenuCharacterId((current) => current === item.id ? null : item.id)}><MoreHorizontal size={16} /></button>
              {menuCharacterId === item.id && <div className="character-actions" role="menu">
                <button onClick={() => duplicateCharacter(item)}><Copy size={13} />Duplicate</button>
                <button onClick={() => exportCharacter(item)}><FileDown size={13} />Export backup</button>
                <button className="danger" onClick={() => deleteCharacter(item)}><Trash2 size={13} />Delete</button>
              </div>}
            </div>
          ))}
          {!visibleCharacters.length && <div className="empty-roster"><Swords size={24} /><p>No saved heroes yet.</p><span>Your first character will appear here after saving.</span></div>}
        </div>
        <div className="roster-imports">
          <button className="import-card" onClick={() => characterFileInput.current?.click()}>
            <span className="import-icon"><FileDown size={20} /></span>
            <span><strong>Import character</strong><small>Restore a character backup</small></span>
            <Upload size={16} />
          </button>
          <button className="import-card" onClick={() => fileInput.current?.click()}>
            <span className="import-icon"><FileJson size={20} /></span>
            <span><strong>Import custom content</strong><small>Add local .json or .w5e files</small></span>
            <Upload size={16} />
          </button>
        </div>
        <div className="sync-status"><span className={status.includes("not") || status.includes("Could") ? "status-dot warning" : "status-dot"} />{status}</div>
      </aside>

      <section className="workspace">
        <div className="character-hero">
          <div className="portrait-large"><span>{initials(character.name)}</span><button aria-label="Change portrait"><Plus size={14} /></button></div>
          <div className="hero-identity">
            <label className="eyebrow" htmlFor="character-name">Character name</label>
            <input id="character-name" className="name-input" value={character.name} onChange={(event) => patchCharacter({ name: event.target.value })} />
            <div className="identity-selects">
              <label><span>Ancestry</span><select value={character.ancestry} onChange={(event) => applyAncestry(event.target.value)}><option value="">Choose ancestry</option>{ancestries.map((item) => <option key={item.id}>{item.name}</option>)}</select><ChevronDown size={14} /></label>
              <i />
              <label><span>Class</span><select value={character.className} onChange={(event) => applyClass(event.target.value)}><option value="">Choose class</option>{classes.map((item) => <option key={item.id}>{item.name}</option>)}</select><ChevronDown size={14} /></label>
              <i />
              {!!subclasses.length && <><label><span>Subclass</span><select value={character.subclassName ?? ""} onChange={(event) => applySubclass(event.target.value)}><option value="">Choose subclass</option>{subclasses.map((item) => <option key={item.id}>{item.name}</option>)}</select><ChevronDown size={14} /></label><i /></>}
              <label><span>Background</span><select value={character.background} onChange={(event) => applyBackground(event.target.value)}><option value="">Choose background</option>{backgrounds.map((item) => <option key={item.id}>{item.name}</option>)}</select><ChevronDown size={14} /></label>
            </div>
          </div>
          <div className="level-card">
            <div><span>Level</span><strong>{character.level}</strong></div>
            <button className="button level-button" onClick={levelUp} disabled={character.level >= 20}><Sparkles size={15} />Level up</button>
            <div className="xp-row"><span>{character.experience.toLocaleString()} XP</span><span>{nextLevelXp.toLocaleString()} XP</span></div>
            <div className="progress-track"><span style={{ width: `${xpProgress}%` }} /></div>
          </div>
        </div>

        <nav className="tabs" aria-label="Character sections">
          {(["overview", "features", "combat", "spells", "equipment", "notes"] as Tab[]).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}{item === "combat" && character.attacks.length ? ` ${character.attacks.length}` : ""}{item === "spells" && character.spells.length ? ` ${character.spells.length}` : ""}{item === "equipment" && character.inventory.length ? ` ${character.inventory.length}` : ""}</button>)}
        </nav>

        {tab === "overview" && (
          <div className="overview-grid">
            <section className="panel vitals-panel">
              <div className="section-heading"><div><span className="eyebrow">At a glance</span><h2>Combat & vitals</h2></div><Shield size={20} /></div>
              <div className="vital-grid">
                <label><span><Heart size={15} />Hit points</span><div className="paired-input"><input type="number" value={character.currentHp} onChange={(event) => patchCharacter({ currentHp: Number(event.target.value) })} /><b>/</b><input type="number" value={character.maxHp} onChange={(event) => patchCharacter({ maxHp: Number(event.target.value) })} /></div><small>Current / Maximum</small></label>
                <label><span><Shield size={15} />Armor class</span><input className="stat-input" type="number" value={character.armorClass} onChange={(event) => patchCharacter({ armorClass: Number(event.target.value) })} /><small>Defense</small></label>
                <label><span><Zap size={15} />Speed</span><div className="unit-input"><input type="number" value={character.speed} onChange={(event) => patchCharacter({ speed: Number(event.target.value) })} /><b>ft</b></div><small>Walking</small></label>
                <label><span><Swords size={15} />Proficiency</span><div className="static-stat">+{character.proficiencyBonus}</div><small>Level based</small></label>
              </div>
            </section>

            <section className="panel abilities-panel">
              <div className="section-heading"><div><span className="eyebrow">Core scores</span><h2>Abilities</h2></div><span className="section-note">Modifier</span></div>
              <div className="ability-grid">
                {abilityKeys.map((key) => (
                  <label key={key} className="ability-card"><span>{ABILITY_LABELS[key]}</span><input type="number" value={character.abilities[key]} onChange={(event) => updateAbility(key, Number(event.target.value))} /><strong>{modifierLabel(character.abilities[key])}</strong></label>
                ))}
              </div>
            </section>

            <section className="panel details-panel">
              <div className="section-heading"><div><span className="eyebrow">Identity</span><h2>Character details</h2></div><BookOpen size={20} /></div>
              <div className="form-grid">
                <label><span>Player name</span><input value={character.playerName} onChange={(event) => patchCharacter({ playerName: event.target.value })} placeholder="Your name" /></label>
                <label><span>Experience points</span><input type="number" min="0" value={character.experience} onChange={(event) => patchCharacter({ experience: Math.max(0, Number(event.target.value)) })} /></label>
              </div>
              <div className="feature-preview">
                <div><span className="eyebrow">Recently gained</span><h3>{resolvedFeatures.at(-1)?.name ?? "Ready for adventure"}</h3><p>{resolvedFeatures.at(-1)?.description ?? "Add features through your ancestry, class, or an imported content pack."}</p></div>
                <button className="text-button" onClick={() => setTab("features")}>View all features <span>→</span></button>
              </div>
            </section>
            <SessionTracker character={character} patchCharacter={patchCharacter} />
          </div>
        )}

        {tab === "features" && (
          <div className="stacked-tab-panels">
          <FeatManager catalog={feats} character={character} patchCharacter={patchCharacter} />
          <section className="panel wide-panel">
            <div className="section-heading"><div><span className="eyebrow">Rules reference</span><h2>Features & traits</h2></div><span className="count-chip">{character.features.length}</span></div>
            <div className="feature-list">
              {resolvedFeatures.map((feature, index) => <article key={`${feature.name}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{feature.name}</h3><p>{feature.description}</p></div></article>)}
              {!character.features.length && <div className="empty-state">No features yet. Choose an ancestry and class or import a content pack.</div>}
            </div>
          </section>
          </div>
        )}

        {tab === "combat" && <CombatManager catalog={equipment} character={character} patchCharacter={patchCharacter} />}

        {tab === "spells" && <SpellbookManager catalog={spells} character={character} patchCharacter={patchCharacter} />}

        {tab === "equipment" && <InventoryManager catalog={equipment} character={character} patchCharacter={patchCharacter} />}

        {tab === "notes" && (
          <section className="panel wide-panel notes-panel">
            <div className="section-heading"><div><span className="eyebrow">Campaign journal</span><h2>Notes</h2></div><BookOpen size={20} /></div>
            <textarea value={character.notes} onChange={(event) => patchCharacter({ notes: event.target.value })} placeholder="Allies, quests, equipment, promises, grudges…" />
          </section>
        )}
      </section>

      {deleteTarget && <div className="modal-scrim" onMouseDown={() => setDeleteTarget(null)}>
        <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-character-title" onMouseDown={(event) => event.stopPropagation()}>
          <span className="eyebrow">Remove character</span>
          <h2 id="delete-character-title">Delete {deleteTarget.name}?</h2>
          <p>This removes the character from this device. Export a backup first if you may need to restore it later.</p>
          <div className="level-up-actions">
            <button className="button button-outline" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button className="button button-danger" onClick={confirmDeleteCharacter}><Trash2 size={15} />Delete character</button>
          </div>
        </section>
      </div>}

      {showLevelUp && <div className="modal-scrim" onMouseDown={() => setShowLevelUp(false)}>
        <section className="level-up-dialog" role="dialog" aria-modal="true" aria-labelledby="level-up-title" onMouseDown={(event) => event.stopPropagation()}>
          <div className="drawer-heading">
            <div><span className="eyebrow">Character advancement</span><h2 id="level-up-title">Review level {plannedLevel}</h2></div>
            <button className="icon-button" onClick={() => setShowLevelUp(false)} aria-label="Cancel level up"><X size={18} /></button>
          </div>
          <div className="level-up-summary">
            <div><span>Class</span><strong>{character.className}</strong></div>
            <div><span>Proficiency</span><strong>+{proficiencyForLevel(plannedLevel)}</strong></div>
            <label><span>Hit points gained</span><input type="number" min="1" max="99" value={levelUpHpGain} onChange={(event) => setLevelUpHpGain(Math.max(1, Math.min(99, Number(event.target.value) || 1)))} /></label>
          </div>
          <div className="level-up-features">
            <span className="eyebrow">Features gained</span>
            {plannedFeatures.map((feature) => <article key={feature.id ?? feature.name}><strong>{feature.name}</strong><p>{feature.description}</p></article>)}
            {!plannedFeatures.length && !needsSubclass && <p className="level-up-empty">No automatic class features are listed for this level. You can still adjust abilities, feats, and spells after advancing.</p>}
            {needsSubclass && <p className="level-up-warning">Choose a subclass in the character header before advancing; this level grants a subclass feature.</p>}
          </div>
          <div className="level-up-actions">
            <button className="button button-outline" onClick={() => setShowLevelUp(false)}>Cancel</button>
            <button className="button button-primary" disabled={needsSubclass} onClick={confirmLevelUp}><Sparkles size={15} />Apply level {plannedLevel}</button>
          </div>
        </section>
      </div>}

      <div className={`drawer-scrim ${showLibrary || showRoster ? "visible" : ""}`} onClick={() => { setShowLibrary(false); setShowRoster(false); }} />
      <aside className={`library-drawer ${showLibrary ? "is-open" : ""}`} aria-hidden={!showLibrary}>
        <div className="drawer-heading"><div><span className="eyebrow">Rules collection</span><h2>Content library</h2></div><button className="icon-button" onClick={() => setShowLibrary(false)} aria-label="Close library"><X size={19} /></button></div>
        <p className="drawer-intro">Import structured rules extracted from your Warcraft 5E PDFs. Everything stays on this computer, and new options appear immediately.</p>
        <button className="button button-primary drawer-import" onClick={() => fileInput.current?.click()}><Upload size={16} />Import content file</button>
        <div className="pack-list">
          {content.map((pack, index) => (
            <article className="pack-card" key={pack.pack.id}>
              <div className={`pack-glyph pack-tone-${index % 3}`}><LibraryBig size={20} /></div>
              <div><strong>{pack.pack.name}</strong><span>Version {pack.pack.version} · Schema {pack.schemaVersion}</span><small>{(pack.ancestries?.length ?? 0)} ancestries · {(pack.classes?.length ?? 0)} classes · {(pack.backgrounds?.length ?? 0)} backgrounds · {(pack.feats?.length ?? 0)} feats · {(pack.spells?.length ?? 0)} spells</small></div>
              <button className="icon-button danger" aria-label={`Remove ${pack.pack.name}`} onClick={() => removePack(pack.pack.id)}><Trash2 size={15} /></button>
            </article>
          ))}
          {!content.length && <div className="empty-state compact">No content packs imported. Import a .w5e file to add character options.</div>}
        </div>
        <div className="codex-tip"><FileJson size={22} /><div><strong>Built for Codex</strong><p>Give Codex a source PDF and the included content schema. It can turn the rules into an import-ready file.</p></div></div>
      </aside>
    </main>
  );
}
