import { useState } from "react";
import { Check, Circle, Plus, ShieldCheck } from "lucide-react";
import { classTrainingFor, isEquipmentProficient } from "../lib/character-rules";
import type { AdvancementChoice, CharacterData, EquipmentDefinition, FeatDefinition } from "../lib/types";

type PatchCharacter = (patch: Partial<CharacterData>) => void;

const SKILLS = ["Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History", "Insight", "Intimidation", "Investigation", "Medicine", "Nature", "Perception", "Performance", "Persuasion", "Religion", "Sleight of Hand", "Stealth", "Survival"];

function unique(values: string[]) {
  return [...new Set(values)];
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

export function CreationGuide({ character, patchCharacter, backgroundSkills, startingEquipment, feats, equipment }: { character: CharacterData; patchCharacter: PatchCharacter; backgroundSkills: string[]; startingEquipment?: string; feats: FeatDefinition[]; equipment: EquipmentDefinition[] }) {
  const training = classTrainingFor(character.className);
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

  return <section className="panel creation-guide-panel">
    <div className="section-heading"><div><span className="eyebrow">Guided setup</span><h2>Character creation checklist</h2></div><span className="guide-progress">{completed} / {checklist.length}</span></div>
    <div className="creation-checklist">{checklist.map((item) => <span className={item.done ? "complete" : ""} key={item.label}>{item.done ? <Check size={13} /> : <Circle size={13} />}{item.label}</span>)}</div>
    <div className="guide-sections">
      <div className="guide-section">
        <strong>Ability scores</strong><p>Confirm after assigning or reviewing all six scores.</p>
        <label className="guide-confirm"><input type="checkbox" checked={character.abilityScoresConfirmed} onChange={(event) => patchCharacter({ abilityScoresConfirmed: event.target.checked })} />Scores reviewed</label>
      </div>
      <div className="guide-section">
        <strong>Class skills <small>{character.classSkillChoices.length} / {training.skillChoices}</small></strong>
        <div className="guide-option-grid">{SKILLS.map((skill) => <button className={character.classSkillChoices.includes(skill) ? "selected" : ""} disabled={(character.skillProficiencies.includes(skill) && !character.classSkillChoices.includes(skill)) || (!character.classSkillChoices.includes(skill) && character.classSkillChoices.length >= training.skillChoices)} onClick={() => toggleClassSkill(skill)} key={skill}>{skill}</button>)}</div>
      </div>
      <div className="guide-section guide-two-column">
        <ChipEditor label="Languages" values={character.languages} placeholder="Add a language" onChange={(languages) => patchCharacter({ languages })} />
        <ChipEditor label="Tool proficiencies" values={character.toolProficiencies} placeholder="Add a tool" onChange={(toolProficiencies) => patchCharacter({ toolProficiencies })} />
      </div>
      {startingEquipment && <div className="guide-section"><strong>Starting equipment</strong><p>{startingEquipment}</p><label className="guide-confirm"><input type="checkbox" checked={character.startingEquipmentConfirmed} onChange={(event) => patchCharacter({ startingEquipmentConfirmed: event.target.checked })} />Equipment added or alternate gold recorded</label></div>}
      {hasFightingStyle && <div className="guide-section"><strong>Fighting Style</strong><select aria-label="Starting Fighting Style" value={fightingChoice?.selections[0] ?? ""} onChange={(event) => chooseFightingStyle(event.target.value)}><option value="">Choose a Fighting Style</option>{fightingStyles.map((feat) => <option value={feat.id} key={feat.id}>{feat.name}</option>)}</select></div>}
      {hasStartingExpertise && <div className="guide-section"><strong>Starting Expertise <small>{character.skillExpertise.length} / 2</small></strong><div className="guide-option-grid">{character.skillProficiencies.map((skill) => <button className={character.skillExpertise.includes(skill) ? "selected" : ""} disabled={!character.skillExpertise.includes(skill) && character.skillExpertise.length >= 2} onClick={() => toggleExpertise(skill)} key={skill}>{skill}</button>)}</div></div>}
      {training.masteryChoices > 0 && <div className="guide-section"><strong><ShieldCheck size={14} />Weapon Masteries <small>{character.weaponMasteries.length} / {training.masteryChoices}</small></strong><div className="guide-option-grid mastery-options">{weaponOptions.map((weapon) => <button className={character.weaponMasteries.includes(weapon.name) ? "selected" : ""} disabled={!character.weaponMasteries.includes(weapon.name) && character.weaponMasteries.length >= training.masteryChoices} onClick={() => toggleMastery(weapon.name)} key={weapon.id}>{weapon.name}<small>{weapon.mastery ?? "—"}</small></button>)}</div></div>}
    </div>
  </section>;
}
