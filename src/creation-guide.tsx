import { useState } from "react";
import { Check, Circle, Plus, ShieldCheck, TriangleAlert } from "lucide-react";
import { classTrainingFor, isEquipmentProficient, syncAutomaticResources } from "../lib/character-rules";
import { ABILITY_LABELS, type AbilityKey, type AdvancementChoice, type BackgroundDefinition, type CampaignProfile, type CharacterData, type EquipmentDefinition, type FeatDefinition, type InventoryItem } from "../lib/types";
import { CollapsiblePanel } from "./collapsible-panel";

type PatchCharacter = (patch: Partial<CharacterData>) => void;

const SKILLS = ["Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History", "Insight", "Intimidation", "Investigation", "Medicine", "Nature", "Perception", "Performance", "Persuasion", "Religion", "Sleight of Hand", "Stealth", "Survival"];
const ABILITIES = Object.keys(ABILITY_LABELS) as AbilityKey[];
const STANDARD_ARRAY: Record<AbilityKey, number> = { strength: 15, agility: 14, stamina: 13, intellect: 12, spirit: 10, charisma: 8 };
const POINT_BUY_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

function unique(values: string[]) {
  return [...new Set(values)];
}

export function pointBuySpent(scores: Record<AbilityKey, number>) {
  return ABILITIES.reduce((total, ability) => total + (POINT_BUY_COST[scores[ability]] ?? 99), 0);
}

function finalAbilities(baseAbilities: CharacterData["baseAbilities"], bonuses: CharacterData["backgroundAbilityBonuses"]) {
  return Object.fromEntries(ABILITIES.map((ability) => [ability, baseAbilities[ability] + (bonuses[ability] ?? 0)])) as CharacterData["abilities"];
}

export function startingEquipmentSelection(description: string, catalog: EquipmentDefinition[], choice: "A" | "B") {
  const choiceText = choice === "A"
    ? description.match(/\(A\)\s*(.*?)(?:;\s*or\s*\(B\)|$)/i)?.[1] ?? ""
    : description.match(/\(B\)\s*(.*)$/i)?.[1] ?? description;
  const gold = Number(choiceText.match(/(\d+)\s*GP/i)?.[1] ?? 0);
  const items: Array<{ definition: EquipmentDefinition; quantity: number }> = [];
  const unresolved: string[] = [];
  for (const rawPart of choiceText.split(",")) {
    const part = rawPart.trim();
    if (!part || /\d+\s*GP/i.test(part)) continue;
    const quantity = Number(part.match(/^(\d+)\s+/)?.[1] ?? 1);
    const cleaned = part.replace(/^\d+\s+/, "").replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    const definition = [...catalog].sort((a, b) => b.name.length - a.name.length).find((item) => cleaned === item.name.toLowerCase() || cleaned.startsWith(`${item.name.toLowerCase()} `));
    if (definition) items.push({ definition, quantity });
    else unresolved.push(part);
  }
  return { items, gold, unresolved };
}

function ChipEditor({ label, values, placeholder, onChange }: { label: string; values: string[]; placeholder: string; onChange: (values: string[]) => void }) {
  const [value, setValue] = useState("");
  function add() {
    const next = value.trim();
    if (!next || values.some((item) => item.toLowerCase() === next.toLowerCase())) return;
    onChange([...values, next]);
    setValue("");
  }
  return <div className="guide-chip-editor"><strong>{label}</strong><div><input value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} placeholder={placeholder} /><button onClick={add} aria-label={`Add ${label}`}><Plus size={13} /></button></div><span>{values.map((item) => <button key={item} onClick={() => onChange(values.filter((value) => value !== item))}>{item} ×</button>)}</span></div>;
}

export function CreationGuide({ character, patchCharacter, background, feats, equipment, campaignProfile, locked = false }: { character: CharacterData; patchCharacter: PatchCharacter; background?: BackgroundDefinition; feats: FeatDefinition[]; equipment: EquipmentDefinition[]; campaignProfile?: CampaignProfile; locked?: boolean }) {
  const training = classTrainingFor(character.className);
  const availableSkills = training.skillOptions.length ? training.skillOptions : SKILLS;
  const backgroundSkills = background?.skills ?? [];
  const startingEquipment = background?.equipment;
  const backgroundAbilities = background?.abilityOptions ?? [];
  const spentPoints = pointBuySpent(character.baseAbilities);
  const backgroundBonusTotal = Object.values(character.backgroundAbilityBonuses).reduce((total, bonus) => total + (bonus ?? 0), 0);
  const abilityMethodValid = character.abilityScoreMethod !== "point-buy" || (spentPoints === 27 && ABILITIES.every((ability) => character.baseAbilities[ability] >= 8 && character.baseAbilities[ability] <= 15));
  const backgroundBonusesValid = !backgroundAbilities.length || (backgroundBonusTotal === 3 && Object.entries(character.backgroundAbilityBonuses).every(([ability, bonus]) => backgroundAbilities.includes(ability as AbilityKey) && (bonus ?? 0) <= 2));
  const fightingStyles = feats.filter((feat) => feat.category.toLowerCase() === "fighting style");
  const hasFightingStyle = character.features.some((feature) => /fighting style/i.test(feature.name));
  const hasStartingExpertise = character.level === 1 && character.features.some((feature) => feature.name.toLowerCase() === "expertise");
  const fightingChoice = character.advancementChoices.find((choice) => choice.kind === "fighting-style" && choice.level === 1);
  const weaponOptions = equipment.filter((item) => Boolean(item.damage) && isEquipmentProficient(character, item));
  const checklist = [
    { label: "Ancestry", done: Boolean(character.ancestry) },
    { label: "Class", done: Boolean(character.className) },
    { label: "Background", done: Boolean(character.background) },
    { label: "Ability scores reviewed", done: character.abilityScoresConfirmed },
    { label: "Class skills", done: Boolean(character.className) && character.classSkillChoices.length >= training.skillChoices },
    { label: "Starting equipment", done: Boolean(character.background) && (!startingEquipment || character.startingEquipmentConfirmed) },
    { label: "Feature choices", done: Boolean(character.className) && (!hasFightingStyle || Boolean(fightingChoice?.selections[0])) && (!training.masteryChoices || character.weaponMasteries.length >= training.masteryChoices) && (!hasStartingExpertise || character.skillExpertise.length >= 2) },
  ];
  const completed = checklist.filter((item) => item.done).length;

  function toggleClassSkill(skill: string) {
    const selected = character.classSkillChoices.includes(skill);
    if (!selected && character.classSkillChoices.length >= training.skillChoices) return;
    const classSkillChoices = selected ? character.classSkillChoices.filter((item) => item !== skill) : [...character.classSkillChoices, skill];
    const nonClassSkills = character.skillProficiencies.filter((item) => !character.classSkillChoices.includes(item));
    patchCharacter({ classSkillChoices, skillProficiencies: unique([...nonClassSkills, ...backgroundSkills, ...classSkillChoices]) });
  }

  function updateBaseAbility(ability: AbilityKey, score: number) {
    const limits = character.abilityScoreMethod === "point-buy" ? [8, 15] : [1, 20];
    const baseAbilities = { ...character.baseAbilities, [ability]: Math.max(limits[0], Math.min(limits[1], score)) };
    const abilities = finalAbilities(baseAbilities, character.backgroundAbilityBonuses);
    patchCharacter({ baseAbilities, abilities, resources: syncAutomaticResources(character.resources, character.className, character.level, abilities) });
  }

  function chooseAbilityMethod(method: CharacterData["abilityScoreMethod"]) {
    const baseAbilities = method === "standard-array" ? { ...STANDARD_ARRAY } : method === "point-buy" ? Object.fromEntries(ABILITIES.map((ability) => [ability, 8])) as CharacterData["baseAbilities"] : { ...character.baseAbilities };
    const abilities = finalAbilities(baseAbilities, character.backgroundAbilityBonuses);
    patchCharacter({ abilityScoreMethod: method, baseAbilities, abilities, abilityScoresConfirmed: false, resources: syncAutomaticResources(character.resources, character.className, character.level, abilities) });
  }

  function cycleBackgroundBonus(ability: AbilityKey) {
    const current = character.backgroundAbilityBonuses[ability] ?? 0;
    const next = current >= 2 ? 0 : current + 1;
    const prospectiveTotal = backgroundBonusTotal - current + next;
    if (prospectiveTotal > 3) return;
    const backgroundAbilityBonuses = { ...character.backgroundAbilityBonuses, [ability]: next };
    if (!next) delete backgroundAbilityBonuses[ability];
    const abilities = finalAbilities(character.baseAbilities, backgroundAbilityBonuses);
    patchCharacter({ backgroundAbilityBonuses, abilities, abilityScoresConfirmed: false, resources: syncAutomaticResources(character.resources, character.className, character.level, abilities) });
  }

  function applyStartingEquipment(choice: "A" | "B") {
    if (!startingEquipment) return;
    const selected = startingEquipmentSelection(startingEquipment, equipment, choice);
    const retained = character.inventory.filter((item) => item.source !== "Starting equipment");
    const byContentId = new Map<string, InventoryItem>();
    for (const item of selected.items) {
      const existing = byContentId.get(item.definition.id);
      if (existing) existing.quantity += item.quantity;
      else byContentId.set(item.definition.id, {
        id: crypto.randomUUID(),
        contentId: item.definition.id,
        name: item.definition.name,
        category: item.definition.category,
        quantity: item.quantity,
        equipped: false,
        notes: "",
        weight: item.definition.weight,
        source: "Starting equipment",
      });
    }
    patchCharacter({
      inventory: [...retained, ...byContentId.values()],
      currency: { ...character.currency, gold: Math.max(0, character.currency.gold - character.startingGold) + selected.gold },
      startingGold: selected.gold,
      startingEquipmentChoice: choice,
      startingEquipmentConfirmed: selected.unresolved.length === 0,
    });
  }

  function chooseFightingStyle(featId: string) {
    const previousId = fightingChoice?.selections[0];
    const nextFeat = fightingStyles.find((feat) => feat.id === featId);
    const choice: AdvancementChoice = { id: fightingChoice?.id ?? crypto.randomUUID(), featureName: "Fighting Style", level: 1, kind: "fighting-style", selections: featId ? [featId] : [] };
    patchCharacter({
      advancementChoices: [...character.advancementChoices.filter((entry) => entry.id !== fightingChoice?.id), choice],
      feats: [...character.feats.filter((feat) => feat.id !== previousId), ...(nextFeat && !character.feats.some((feat) => feat.id === nextFeat.id) ? [nextFeat] : [])],
    });
  }

  function toggleMastery(name: string) {
    const selected = character.weaponMasteries.includes(name);
    if (!selected && character.weaponMasteries.length >= training.masteryChoices) return;
    patchCharacter({ weaponMasteries: selected ? character.weaponMasteries.filter((item) => item !== name) : [...character.weaponMasteries, name] });
  }

  function toggleExpertise(skill: string) {
    const selected = character.skillExpertise.includes(skill);
    if (!selected && character.skillExpertise.length >= 2) return;
    patchCharacter({ skillExpertise: selected ? character.skillExpertise.filter((item) => item !== skill) : [...character.skillExpertise, skill] });
  }

  return <CollapsiblePanel className="creation-guide-panel" storageKey={`azeroth-archives:panel:${character.id}:creation-guide`} eyebrow="Guided setup" title="Character creation checklist" summary={<span className="guide-progress">{completed} / {checklist.length} complete</span>}>
    <fieldset className="creation-lock-fieldset" disabled={locked}>
    <div className="creation-checklist">{checklist.map((item) => <span className={item.done ? "complete" : ""} key={item.label}>{item.done ? <Check size={13} /> : <Circle size={13} />}{item.label}</span>)}</div>
    <div className="guide-sections">
      <div className="guide-section">
        <strong>Ability scores</strong>
        <select aria-label="Ability score method" value={character.abilityScoreMethod} onChange={(event) => chooseAbilityMethod(event.target.value as CharacterData["abilityScoreMethod"])}><option value="standard-array" disabled={Boolean(campaignProfile && !campaignProfile.allowedAbilityMethods.includes("standard-array"))}>Standard array</option><option value="point-buy" disabled={Boolean(campaignProfile && !campaignProfile.allowedAbilityMethods.includes("point-buy"))}>Point buy</option><option value="rolled" disabled={Boolean(campaignProfile && !campaignProfile.allowedAbilityMethods.includes("rolled"))}>Rolled scores</option><option value="manual" disabled={Boolean(campaignProfile && !campaignProfile.allowedAbilityMethods.includes("manual"))}>Manual / GM assigned</option></select>
        <div className="ability-assignment-grid">{ABILITIES.map((ability) => <label key={ability}><span>{ABILITY_LABELS[ability]}</span><input aria-label={`${ABILITY_LABELS[ability]} base score`} type="number" min={character.abilityScoreMethod === "point-buy" ? 8 : 1} max={character.abilityScoreMethod === "point-buy" ? 15 : 20} value={character.baseAbilities[ability]} onChange={(event) => updateBaseAbility(ability, Number(event.target.value))} /><b>{character.abilities[ability]}</b></label>)}</div>
        {character.abilityScoreMethod === "point-buy" && <p className={spentPoints === 27 ? "guide-valid" : "guide-warning"}>{spentPoints} / 27 points spent</p>}
        {!!backgroundAbilities.length && <><p>Background boosts: assign +2 and +1, or +1 to all three listed abilities.</p><div className="background-ability-grid">{backgroundAbilities.map((ability) => <button className={character.backgroundAbilityBonuses[ability] ? "selected" : ""} onClick={() => cycleBackgroundBonus(ability)} key={ability}>{ABILITY_LABELS[ability]} <b>+{character.backgroundAbilityBonuses[ability] ?? 0}</b></button>)}</div><p className={backgroundBonusesValid ? "guide-valid" : "guide-warning"}>{backgroundBonusTotal} / 3 background points assigned</p></>}
        {!abilityMethodValid && <p className="guide-warning"><TriangleAlert size={12} />Point buy must spend exactly 27 points with scores from 8 to 15.</p>}
        <label className="guide-confirm"><input type="checkbox" checked={character.abilityScoresConfirmed} onChange={(event) => patchCharacter({ abilityScoresConfirmed: event.target.checked })} />Scores reviewed</label>
      </div>
      <div className="guide-section">
        <strong>Class skills <small>{character.classSkillChoices.length} / {training.skillChoices}</small></strong>
        <div className="guide-option-grid">{availableSkills.map((skill) => <button className={character.classSkillChoices.includes(skill) ? "selected" : ""} disabled={(character.skillProficiencies.includes(skill) && !character.classSkillChoices.includes(skill)) || (!character.classSkillChoices.includes(skill) && character.classSkillChoices.length >= training.skillChoices)} onClick={() => toggleClassSkill(skill)} key={skill}>{skill}</button>)}</div>
      </div>
      <div className="guide-section guide-two-column">
        <ChipEditor label="Languages" values={character.languages} placeholder="Add a language" onChange={(languages) => patchCharacter({ languages })} />
        <ChipEditor label="Tool proficiencies" values={character.toolProficiencies} placeholder="Add a tool" onChange={(toolProficiencies) => patchCharacter({ toolProficiencies })} />
      </div>
      {startingEquipment && <div className="guide-section"><strong>Starting equipment</strong><p>{startingEquipment}</p><div className="starting-equipment-actions"><button disabled={campaignProfile?.startingEquipmentRule === "gold-only"} className={character.startingEquipmentChoice === "A" ? "selected" : ""} onClick={() => applyStartingEquipment("A")}>Add package A</button><button disabled={campaignProfile?.startingEquipmentRule === "packages-only"} className={character.startingEquipmentChoice === "B" ? "selected" : ""} onClick={() => applyStartingEquipment("B")}>Take option B gold</button></div><label className="guide-confirm"><input type="checkbox" checked={character.startingEquipmentConfirmed} onChange={(event) => patchCharacter({ startingEquipmentConfirmed: event.target.checked })} />Equipment reviewed; allow GM-approved substitutions</label></div>}
      {hasFightingStyle && <div className="guide-section"><strong>Fighting Style</strong><select aria-label="Starting Fighting Style" value={fightingChoice?.selections[0] ?? ""} onChange={(event) => chooseFightingStyle(event.target.value)}><option value="">Choose a Fighting Style</option>{fightingStyles.map((feat) => <option value={feat.id} key={feat.id}>{feat.name}</option>)}</select></div>}
      {hasStartingExpertise && <div className="guide-section"><strong>Starting Expertise <small>{character.skillExpertise.length} / 2</small></strong><div className="guide-option-grid">{character.skillProficiencies.map((skill) => <button className={character.skillExpertise.includes(skill) ? "selected" : ""} disabled={!character.skillExpertise.includes(skill) && character.skillExpertise.length >= 2} onClick={() => toggleExpertise(skill)} key={skill}>{skill}</button>)}</div></div>}
      {training.masteryChoices > 0 && <div className="guide-section"><strong><ShieldCheck size={14} />Weapon Masteries <small>{character.weaponMasteries.length} / {training.masteryChoices}</small></strong><div className="guide-option-grid mastery-options">{weaponOptions.map((weapon) => <button className={character.weaponMasteries.includes(weapon.name) ? "selected" : ""} disabled={!character.weaponMasteries.includes(weapon.name) && character.weaponMasteries.length >= training.masteryChoices} onClick={() => toggleMastery(weapon.name)} key={weapon.id}>{weapon.name}<small>{weapon.mastery ?? "—"}</small></button>)}</div></div>}
    </div>
    </fieldset>
  </CollapsiblePanel>;
}
