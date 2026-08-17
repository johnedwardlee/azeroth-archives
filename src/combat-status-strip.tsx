import { AlertTriangle, Footprints, Heart, Shield, Sparkles } from "lucide-react";
import { calculateArmorClass, calculateEffectiveSpeed, calculateEncumbrance } from "../lib/character-rules";
import type { CharacterData, EncumbranceRule, EquipmentDefinition } from "../lib/types";

type PatchCharacter = (patch: Partial<CharacterData>) => void;

export function CombatStatusStrip({ character, catalog, patchCharacter, encumbranceRule = "variant" }: { character: CharacterData; catalog: EquipmentDefinition[]; patchCharacter: PatchCharacter; encumbranceRule?: EncumbranceRule }) {
  const encumbrance = calculateEncumbrance(character.inventory, character.abilities.strength, encumbranceRule);
  const armorClass = calculateArmorClass(character, catalog);
  const speed = calculateEffectiveSpeed(character, encumbrance, catalog);
  const concentratingSpell = character.spells.find((spell) => spell.id === character.concentratingSpellId)?.name
    ?? character.activeEffects.find((effect) => effect.concentration)?.name;
  const slots = Object.entries(character.spellSlots).filter(([, slot]) => slot.maximum > 0);
  const urgent = character.currentHp === 0 || encumbrance.level === "over-capacity" || character.conditions.some((condition) => /unconscious|incapacitated|stunned|paralyzed/i.test(condition));

  return <section className={`combat-status-strip ${urgent ? "urgent" : ""}`} aria-label="Current combat status">
    <div className="combat-vital combat-hp"><Heart size={16} /><label><span>HP</span><input aria-label="Current hit points" type="number" min="0" max={character.maxHp} value={character.currentHp} onChange={(event) => patchCharacter({ currentHp: Math.max(0, Math.min(character.maxHp, Number(event.target.value) || 0)) })} /></label><b>/ {character.maxHp}</b><label className="temporary-hp"><span>Temp</span><input aria-label="Temporary hit points" type="number" min="0" value={character.temporaryHp} onChange={(event) => patchCharacter({ temporaryHp: Math.max(0, Number(event.target.value) || 0) })} /></label></div>
    <div className="combat-vital"><Shield size={16} /><span>AC</span><strong>{armorClass.value}</strong></div>
    <div className="combat-vital"><Footprints size={16} /><span>Speed</span><strong>{speed.value} ft.</strong></div>
    <button type="button" className={`combat-inspiration ${character.inspiration ? "active" : ""}`} onClick={() => patchCharacter({ inspiration: !character.inspiration })}><Sparkles size={15} /><span>{character.inspiration ? "Inspired" : "Inspiration"}</span></button>
    <div className="combat-status-detail"><span>Conditions</span><div>{character.conditions.length ? character.conditions.map((condition) => <b key={condition}>{condition === "Exhaustion" ? `${condition} ${character.exhaustionLevel}` : condition}</b>) : <small>None</small>}</div></div>
    <div className={`combat-status-detail ${concentratingSpell ? "concentrating" : ""}`}><span>Concentration</span><strong>{concentratingSpell ?? "None"}</strong></div>
    <div className="combat-status-detail"><span>Spell slots</span><div>{slots.length ? slots.map(([level, slot]) => <b key={level}>L{level} {slot.maximum - slot.used}/{slot.maximum}</b>) : <small>None</small>}</div></div>
    <div className="combat-status-detail"><span>Resources</span><div>{character.resources.length ? character.resources.slice(0, 4).map((resource) => <b key={resource.id}>{resource.name} {resource.current}/{resource.maximum}</b>) : <small>None</small>}</div></div>
    {(urgent || encumbrance.level !== "unencumbered") && <div className="combat-status-alert"><AlertTriangle size={14} /><span>{character.currentHp === 0 ? "At 0 HP" : encumbrance.penalty}</span></div>}
  </section>;
}
