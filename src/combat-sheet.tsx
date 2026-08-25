import { useMemo, useState } from "react";
import { Dices, Plus, Swords, Trash2 } from "lucide-react";
import { DescriptionPicker } from "./description-picker";
import { CollapsiblePanel } from "./collapsible-panel";
import {
  ABILITY_LABELS,
  abilityModifier,
  type AbilityKey,
  type CharacterAttack,
  type CharacterData,
  type EquipmentDefinition,
} from "../lib/types";
import {
  attackFromEquipment,
  conditionRollEffects,
  DAMAGE_TYPES,
  isEquipmentProficient,
  rollDiceFormula,
  rollD20,
  resolvedRollMode,
  type RollKind,
  type RollMode,
} from "../lib/character-rules";
import type { LocalRollEvent } from "../lib/live-sync";

type PatchCharacter = (patch: Partial<CharacterData>) => void;

export const SKILLS: Array<{ name: string; ability: AbilityKey }> = [
  { name: "Acrobatics", ability: "agility" },
  { name: "Animal Handling", ability: "spirit" },
  { name: "Arcana", ability: "intellect" },
  { name: "Athletics", ability: "strength" },
  { name: "Deception", ability: "charisma" },
  { name: "History", ability: "intellect" },
  { name: "Insight", ability: "spirit" },
  { name: "Intimidation", ability: "charisma" },
  { name: "Investigation", ability: "intellect" },
  { name: "Medicine", ability: "spirit" },
  { name: "Nature", ability: "intellect" },
  { name: "Perception", ability: "spirit" },
  { name: "Performance", ability: "charisma" },
  { name: "Persuasion", ability: "charisma" },
  { name: "Religion", ability: "intellect" },
  { name: "Sleight of Hand", ability: "agility" },
  { name: "Stealth", ability: "agility" },
  { name: "Survival", ability: "spirit" },
];

const abilityKeys = Object.keys(ABILITY_LABELS) as AbilityKey[];
const DEFENSE_CONDITIONS = ["Blinded", "Charmed", "Deafened", "Exhaustion", "Frightened", "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious"];

function signed(value: number) {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function DefenseList({ label, values, suggestions, onChange }: { label: string; values: string[]; suggestions: string[]; onChange: (values: string[]) => void }) {
  const [value, setValue] = useState("");
  const listId = `defense-${label.toLowerCase().replace(/\W+/g, "-")}`;
  function add() {
    const next = value.trim();
    if (!next || values.some((item) => item.toLowerCase() === next.toLowerCase())) return;
    onChange([...values, next]);
    setValue("");
  }
  return <div className="defense-list"><strong>{label}</strong><div><input list={listId} value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} placeholder="Add type" /><datalist id={listId}>{suggestions.map((item) => <option key={item} value={item} />)}</datalist><button onClick={add}><Plus size={13} /></button></div><span>{values.map((item) => <button key={item} onClick={() => onChange(values.filter((value) => value !== item))}>{item} ×</button>)}</span></div>;
}

export function CombatManager({
  catalog,
  character,
  patchCharacter,
  onRoll,
}: {
  catalog: EquipmentDefinition[];
  character: CharacterData;
  patchCharacter: PatchCharacter;
  onRoll?: (event: LocalRollEvent) => void;
}) {
  const [mode, setMode] = useState<RollMode>("normal");
  const [weaponId, setWeaponId] = useState("");
  const [rollResult, setRollResult] = useState<{ label: string; dice: number[]; kept: number; modifier: number; mode: RollMode; reasons: string[] } | null>(null);
  const [damageResult, setDamageResult] = useState("");
  const equipmentById = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);
  const carriedWeapons = character.inventory.flatMap((inventoryItem) => {
    const definition = inventoryItem.contentId ? equipmentById.get(inventoryItem.contentId) : undefined;
    if (!definition?.damage || character.attacks.some((attack) => attack.inventoryItemId === inventoryItem.id)) return [];
    return [{ inventoryItem, definition }];
  });

  function roll(label: string, modifier: number, kind: RollKind = "ability", ability?: AbilityKey, skillName = "") {
    const effects = conditionRollEffects(character, kind, ability, skillName, catalog);
    const actualMode = resolvedRollMode(mode, effects.forcedDisadvantage);
    const { dice, kept } = rollD20(actualMode);
    const adjustedModifier = modifier + effects.modifier;
    setRollResult({ label, dice, kept, modifier: adjustedModifier, mode: actualMode, reasons: effects.reasons });
    const category = label === "Initiative" ? "initiative" : kind === "attack" ? "attack" : kind === "save" ? "save" : "check";
    onRoll?.({ category, label, formula: "d20", dice, modifier: adjustedModifier, total: kept + adjustedModifier, mode: actualMode, detail: effects.reasons.join("; ") });
  }

  function rollAttack(attack: CharacterAttack, modifier: number) {
    const definition = attack.contentId ? equipmentById.get(attack.contentId) : undefined;
    const usesAmmunition = definition?.properties?.some((property) => /ammunition/i.test(property));
    const inventoryItem = usesAmmunition ? character.inventory.find((item) => item.id === attack.inventoryItemId) ?? character.inventory.find((item) => item.contentId === attack.contentId) : undefined;
    if (inventoryItem?.ammunition !== undefined) {
      if (inventoryItem.ammunition <= 0) {
        setDamageResult(`${attack.name}: no ammunition remaining.`);
        return;
      }
      patchCharacter({ inventory: character.inventory.map((item) => item.id === inventoryItem.id ? { ...item, ammunition: Math.max(0, (item.ammunition ?? 0) - 1) } : item) });
    }
    roll(`${attack.name} attack`, modifier, "attack", attack.ability);
  }

  function rollAttackDamage(attack: CharacterAttack, critical = false) {
    const result = rollDiceFormula(attack.damage, critical, abilityModifier(character.abilities[attack.ability]) + attack.damageBonus);
    if (!result) {
      setDamageResult(`${attack.name}: enter damage as dice, such as 1d8.`);
      return;
    }
    setDamageResult(`${attack.name}${critical ? " critical" : ""}: ${result.rolls.join(" + ")}${result.modifier ? ` ${result.modifier >= 0 ? "+" : "−"} ${Math.abs(result.modifier)}` : ""} = ${result.total} ${attack.damageType}`);
    onRoll?.({ category: "damage", label: `${attack.name}${critical ? " critical" : ""} damage`, formula: `${critical ? "Critical " : ""}${attack.damage}`, dice: result.rolls, modifier: result.modifier, total: result.total, mode: "normal", detail: attack.damageType });
  }

  function toggleSave(ability: AbilityKey) {
    const current = character.savingThrowProficiencies;
    patchCharacter({
      savingThrowProficiencies: current.includes(ability)
        ? current.filter((item) => item !== ability)
        : [...current, ability],
    });
  }

  function cycleSkill(name: string) {
    const proficient = character.skillProficiencies.includes(name);
    const expertise = character.skillExpertise.includes(name);
    if (expertise) {
      patchCharacter({
        skillProficiencies: character.skillProficiencies.filter((item) => item !== name),
        skillExpertise: character.skillExpertise.filter((item) => item !== name),
      });
    } else if (proficient) {
      patchCharacter({ skillExpertise: [...character.skillExpertise, name] });
    } else {
      patchCharacter({ skillProficiencies: [...character.skillProficiencies, name] });
    }
  }

  function skillModifier(name: string, ability: AbilityKey) {
    const multiplier = character.skillExpertise.includes(name) ? 2 : character.skillProficiencies.includes(name) ? 1 : 0;
    return abilityModifier(character.abilities[ability]) + character.proficiencyBonus * multiplier;
  }

  function addWeapon() {
    const inventoryItem = character.inventory.find((item) => item.id === weaponId);
    const weapon = inventoryItem?.contentId ? equipmentById.get(inventoryItem.contentId) : undefined;
    if (!inventoryItem || !weapon) return;
    const attack = attackFromEquipment(weapon, isEquipmentProficient(character, weapon), character.weaponMasteries.includes(weapon.name), inventoryItem.id);
    patchCharacter({ attacks: [...character.attacks, attack] });
    setWeaponId("");
  }

  function addCustomAttack() {
    patchCharacter({
      attacks: [...character.attacks, {
        id: crypto.randomUUID(),
        name: "New attack",
        ability: "strength",
        proficient: true,
        bonus: 0,
        damage: "1d6",
        damageType: "",
        damageBonus: 0,
        notes: "",
      }],
    });
  }

  function updateAttack(id: string, patch: Partial<CharacterAttack>) {
    patchCharacter({ attacks: character.attacks.map((attack) => attack.id === id ? { ...attack, ...patch } : attack) });
  }

  const perception = SKILLS.find((skill) => skill.name === "Perception")!;
  const passivePerception = 10 + skillModifier(perception.name, perception.ability);

  return (
    <div className="combat-layout">
      <CollapsiblePanel className="checks-panel" storageKey={`azeroth-panel-${character.id}-combat-checks`} eyebrow="D20 tests" title="Checks & saving throws" summary={<span>Passive Perception {passivePerception}</span>}>
        <div className="collapsible-panel-actions"><div className="roll-mode" aria-label="Roll mode">
          {(["normal", "advantage", "disadvantage"] as RollMode[]).map((item) => <button key={item} className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{item === "normal" ? "Normal" : item === "advantage" ? "Adv" : "Dis"}</button>)}
        </div></div>

        {rollResult && <div className="roll-result"><Dices size={18} /><div><span>{rollResult.label}</span><strong>{rollResult.kept + rollResult.modifier}</strong><small>{rollResult.dice.join(" / ")} {signed(rollResult.modifier)}{rollResult.mode !== "normal" ? ` · ${rollResult.mode}` : ""}</small>{rollResult.reasons.length > 0 && <small className="roll-effect-note">Disadvantage: {rollResult.reasons.join(", ")}</small>}{character.exhaustionLevel > 0 && <small className="roll-effect-note">Exhaustion: −{character.exhaustionLevel * 2}</small>}</div><button onClick={() => setRollResult(null)}>×</button></div>}
        {damageResult && <div className="damage-roll-result" role="status"><Swords size={16} /><span>{damageResult}</span><button onClick={() => setDamageResult("")}>×</button></div>}

        <div className="quick-checks">
          <button onClick={() => roll("Initiative", abilityModifier(character.abilities.agility), "ability", "agility")}><span>Initiative</span><strong>{signed(abilityModifier(character.abilities.agility))}</strong></button>
          <div><span>Passive Perception</span><strong>{passivePerception}</strong></div>
        </div>

        <h3 className="combat-subheading">Saving throws</h3>
        <div className="save-grid">
          {abilityKeys.map((ability) => {
            const proficient = character.savingThrowProficiencies.includes(ability);
            const modifier = abilityModifier(character.abilities[ability]) + (proficient ? character.proficiencyBonus : 0) + (character.savingThrowBonuses[ability] ?? 0);
            return <div key={ability} className={proficient ? "proficient" : ""}><button className="proficiency-dot" title="Toggle proficiency" onClick={() => toggleSave(ability)}>{proficient ? "●" : "○"}</button><span>{ABILITY_LABELS[ability]}</span><strong>{signed(modifier)}</strong><button className="roll-button" onClick={() => roll(`${ABILITY_LABELS[ability]} save`, modifier, "save", ability)}><Dices size={13} /></button></div>;
          })}
        </div>

        <h3 className="combat-subheading">Skills <small>Click the circle for proficiency, then expertise</small></h3>
        <div className="skill-grid">
          {SKILLS.map((skill) => {
            const expertise = character.skillExpertise.includes(skill.name);
            const proficient = character.skillProficiencies.includes(skill.name);
            const modifier = skillModifier(skill.name, skill.ability);
            return <div key={skill.name} className={expertise ? "expertise" : proficient ? "proficient" : ""}><button className="proficiency-dot" onClick={() => cycleSkill(skill.name)} title="Cycle proficiency">{expertise ? "◆" : proficient ? "●" : "○"}</button><span>{skill.name}<small>{ABILITY_LABELS[skill.ability].slice(0, 3)}</small></span><strong>{signed(modifier)}</strong><button className="roll-button" onClick={() => roll(skill.name, modifier, "ability", skill.ability, skill.name)}><Dices size={13} /></button></div>;
          })}
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel className="attacks-panel" storageKey={`azeroth-panel-${character.id}-combat-attacks`} eyebrow="Combat actions" title="Attacks" summary={<span>{character.attacks.length} tracked</span>}>
        <div className="collapsible-panel-actions"><button className="button button-outline" onClick={addCustomAttack}><Plus size={14} />Custom</button></div>
        <div className="weapon-import-row">
          <DescriptionPicker ariaLabel="Carried weapons" value={weaponId} placeholder="Add a carried weapon" onChange={setWeaponId} options={carriedWeapons.map(({ inventoryItem, definition }) => ({ value: inventoryItem.id, label: definition.name, meta: `${definition.damage} ${definition.damageType}${inventoryItem.equipmentSlot && inventoryItem.equipmentSlot !== "none" ? ` · ${inventoryItem.equipmentSlot}` : ""}${definition.mastery ? ` · ${definition.mastery}` : ""}`, description: [definition.description, definition.properties?.length ? `Properties: ${definition.properties.join(", ")}` : "", inventoryItem.notes].filter(Boolean).join("\n\n") }))} />
          <button className="button button-primary" disabled={!weaponId} onClick={addWeapon}><Swords size={14} />Add attack</button>
        </div>
        <div className="attack-list">
          {character.attacks.map((attack) => {
            const definition = attack.contentId ? equipmentById.get(attack.contentId) : undefined;
            const ruleProficient = definition ? isEquipmentProficient(character, definition) : attack.proficient;
            const masteryActive = definition ? character.weaponMasteries.includes(definition.name) : false;
            const attackModifier = abilityModifier(character.abilities[attack.ability]) + (ruleProficient ? character.proficiencyBonus : 0) + attack.bonus;
            return <article key={attack.id}>
              <div className="attack-card-heading"><input aria-label="Attack name" value={attack.name} onChange={(event) => updateAttack(attack.id, { name: event.target.value })} /><button className="attack-roll" onClick={() => rollAttack(attack, attackModifier)}><Dices size={14} />{signed(attackModifier)}</button><button className="icon-button danger" aria-label={`Remove ${attack.name}`} onClick={() => patchCharacter({ attacks: character.attacks.filter((item) => item.id !== attack.id) })}><Trash2 size={14} /></button></div>
              <div className="attack-fields">
                <label>Ability<select value={attack.ability} onChange={(event) => updateAttack(attack.id, { ability: event.target.value as AbilityKey })}>{abilityKeys.map((ability) => <option key={ability} value={ability}>{ABILITY_LABELS[ability]}</option>)}</select></label>
                <label className="attack-check"><input type="checkbox" checked={ruleProficient} disabled={Boolean(definition)} onChange={(event) => updateAttack(attack.id, { proficient: event.target.checked })} />Proficient</label>
                <label>Other bonus<input type="number" value={attack.bonus} onChange={(event) => updateAttack(attack.id, { bonus: Number(event.target.value) || 0 })} /></label>
                <label>Damage<input value={attack.damage} onChange={(event) => updateAttack(attack.id, { damage: event.target.value })} /></label>
                <label>Type<input value={attack.damageType} onChange={(event) => updateAttack(attack.id, { damageType: event.target.value })} /></label>
                <label>Damage bonus<input type="number" value={attack.damageBonus} onChange={(event) => updateAttack(attack.id, { damageBonus: Number(event.target.value) || 0 })} /></label>
              </div>
              <div className="damage-roll-actions"><button onClick={() => rollAttackDamage(attack)}>Roll damage</button><button onClick={() => rollAttackDamage(attack, true)}>Critical</button></div>
              {definition && <div className={`weapon-rule-status ${ruleProficient ? "" : "warning"}`}><span>{ruleProficient ? `Trained: ${definition.category}` : `No proficiency: ${definition.category}`}</span>{definition.mastery && <span>{masteryActive ? `Mastery active: ${definition.mastery}` : `Mastery not selected: ${definition.mastery}`}</span>}</div>}
              <input className="attack-notes" value={attack.notes} onChange={(event) => updateAttack(attack.id, { notes: event.target.value })} placeholder="Range, mastery, ammunition, or special rules" />
            </article>;
          })}
        </div>
        {!character.attacks.length && <div className="empty-state compact">Add a carried weapon or create a custom attack.</div>}
      </CollapsiblePanel>

      <CollapsiblePanel className="defenses-panel" storageKey={`azeroth-panel-${character.id}-combat-defenses`} eyebrow="Damage resolution" title="Defenses & immunities" summary={<span>{character.damageResistances.length + character.damageVulnerabilities.length + character.damageImmunities.length + character.conditionImmunities.length} entries</span>}>
        <div className="defense-columns">
          <DefenseList label="Resistances" values={character.damageResistances} suggestions={DAMAGE_TYPES} onChange={(values) => patchCharacter({ damageResistances: values })} />
          <DefenseList label="Vulnerabilities" values={character.damageVulnerabilities} suggestions={DAMAGE_TYPES} onChange={(values) => patchCharacter({ damageVulnerabilities: values })} />
          <DefenseList label="Damage immunities" values={character.damageImmunities} suggestions={DAMAGE_TYPES} onChange={(values) => patchCharacter({ damageImmunities: values })} />
          <DefenseList label="Condition immunities" values={character.conditionImmunities} suggestions={DEFENSE_CONDITIONS} onChange={(values) => patchCharacter({ conditionImmunities: values })} />
        </div>
        <h3 className="combat-subheading">Additional saving throw bonuses</h3>
        <div className="saving-bonus-grid">{abilityKeys.map((ability) => <label key={ability}><span>{ABILITY_LABELS[ability]}</span><input aria-label={`${ABILITY_LABELS[ability]} additional saving throw bonus`} type="number" value={character.savingThrowBonuses[ability] ?? 0} onChange={(event) => patchCharacter({ savingThrowBonuses: { ...character.savingThrowBonuses, [ability]: Number(event.target.value) || 0 } })} /></label>)}</div>
      </CollapsiblePanel>
    </div>
  );
}
