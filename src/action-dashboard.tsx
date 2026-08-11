import { useMemo, useState } from "react";
import { Clock3, Search, Sparkles, Zap } from "lucide-react";
import { activeEffectFromSpell, generatedCharacterActions, hasUnproficientArmor, isIncapacitated, syncEffectConditions, type GeneratedAction } from "../lib/character-rules";
import type { CharacterData, EquipmentDefinition } from "../lib/types";

type PatchCharacter = (patch: Partial<CharacterData>) => void;

const timingLabels: Record<GeneratedAction["timing"], string> = { action: "Actions", bonus: "Bonus Actions", reaction: "Reactions", passive: "Passives" };

export function ActionDashboard({ character, patchCharacter, catalog }: { character: CharacterData; patchCharacter: PatchCharacter; catalog: EquipmentDefinition[] }) {
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState("");
  const actions = useMemo(() => generatedCharacterActions(character, catalog), [character, catalog]);
  const visible = actions.filter((action) => `${action.name} ${action.source} ${action.description}`.toLowerCase().includes(query.trim().toLowerCase()));

  function useAction(action: GeneratedAction) {
    if (action.timing !== "passive" && isIncapacitated(character)) {
      setFeedback(`${action.name}: the character is Incapacitated and cannot take actions, Bonus Actions, or Reactions.`);
      return;
    }
    if (action.resourceId) {
      const resource = character.resources.find((entry) => entry.id === action.resourceId);
      const cost = action.resourceCost ?? 1;
      if (!resource || resource.current < cost) { setFeedback(`${action.name}: not enough ${resource?.name ?? "resource"}.`); return; }
      patchCharacter({ resources: character.resources.map((entry) => entry.id === resource.id ? { ...entry, current: entry.current - cost } : entry) });
      setFeedback(`${action.name}: spent ${cost} ${resource.name}.`);
      return;
    }
    if (action.inventoryId) {
      const item = character.inventory.find((entry) => entry.id === action.inventoryId);
      if (!item) return;
      if (item.maximumCharges !== undefined) {
        if ((item.charges ?? 0) <= 0) { setFeedback(`${item.name} has no charges remaining.`); return; }
        patchCharacter({ inventory: character.inventory.map((entry) => entry.id === item.id ? { ...entry, charges: (entry.charges ?? 0) - 1 } : entry) });
        setFeedback(`${item.name}: used one charge.`);
      } else if (item.consumable) {
        if (item.quantity <= 0) return;
        patchCharacter({ inventory: item.quantity === 1 ? character.inventory.filter((entry) => entry.id !== item.id) : character.inventory.map((entry) => entry.id === item.id ? { ...entry, quantity: entry.quantity - 1 } : entry) });
        setFeedback(`${item.name}: used one item.`);
      }
      return;
    }
    if (action.spellId) {
      if (hasUnproficientArmor(character, catalog)) { setFeedback("Spellcasting is blocked by armor worn without proficiency."); return; }
      const spell = character.spells.find((entry) => entry.id === action.spellId);
      if (!spell) return;
      if (spell.level > 0 && !spell.prepared) { setFeedback(`${spell.name} is not prepared.`); return; }
      const slotLevel = spell.level === 0 ? 0 : Array.from({ length: 10 - spell.level }, (_, index) => spell.level + index).find((level) => {
        const slot = character.spellSlots[String(level)];
        return slot && slot.used < slot.maximum;
      });
      if (spell.level > 0 && slotLevel === undefined) { setFeedback(`${spell.name}: no spell slot is available.`); return; }
      const spellSlots = slotLevel
        ? { ...character.spellSlots, [String(slotLevel)]: { ...character.spellSlots[String(slotLevel)], used: character.spellSlots[String(slotLevel)].used + 1 } }
        : character.spellSlots;
      const effect = activeEffectFromSpell(spell);
      const activeEffects = effect
        ? [...character.activeEffects.filter((entry) => !(effect.concentration && entry.concentration)), effect]
        : character.activeEffects;
      patchCharacter({ spellSlots, activeEffects, conditions: syncEffectConditions(character.conditions, character.activeEffects, activeEffects), ...(effect?.concentration ? { concentratingSpellId: spell.id } : {}) });
      setFeedback(`${spell.name} cast${slotLevel ? ` with a level ${slotLevel} slot` : " as a cantrip"}${effect ? "; effect tracked" : ""}.`);
    }
  }

  function canUse(action: GeneratedAction) {
    if (action.timing !== "passive" && isIncapacitated(character)) return false;
    if (action.resourceId) return (character.resources.find((entry) => entry.id === action.resourceId)?.current ?? 0) >= (action.resourceCost ?? 1);
    if (action.inventoryId) {
      const item = character.inventory.find((entry) => entry.id === action.inventoryId);
      return item?.maximumCharges !== undefined ? (item.charges ?? 0) > 0 : (item?.quantity ?? 0) > 0;
    }
    if (action.spellId) {
      if (hasUnproficientArmor(character, catalog)) return false;
      const spell = character.spells.find((entry) => entry.id === action.spellId);
      if (!spell) return false;
      if (spell.level === 0) return true;
      if (!spell.prepared) return false;
      return Object.entries(character.spellSlots).some(([level, slot]) => Number(level) >= spell.level && slot.used < slot.maximum);
    }
    return false;
  }

  return <div className="action-dashboard">
    <section className="panel action-dashboard-header"><div className="section-heading"><div><span className="eyebrow">Rules-aware play</span><h2>Action dashboard</h2></div><Zap size={20} /></div><p>Actions are generated from your features, prepared spells, attacks, and equipped items.</p><label className="catalog-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search actions and features" /></label>{feedback && <div className="cast-feedback" role="status">{feedback}<button onClick={() => setFeedback("")}>×</button></div>}</section>
    <div className="action-timing-grid">{(["action", "bonus", "reaction", "passive"] as const).map((timing) => {
      const group = visible.filter((action) => action.timing === timing);
      return <section className="panel action-column" key={timing}><div className="action-column-heading"><Clock3 size={15} /><h3>{timingLabels[timing]}</h3><span>{group.length}</span></div><div className="action-card-list">{group.map((action) => <article key={action.id}><div><span>{action.source}</span><h4>{action.name}</h4></div><p>{action.description}</p>{(action.resourceId || action.inventoryId || action.spellId) && <button disabled={!canUse(action)} onClick={() => useAction(action)}><Sparkles size={13} />{action.spellId ? "Cast" : "Use"}</button>}</article>)}{!group.length && <p className="action-empty">No {timingLabels[timing].toLowerCase()} found.</p>}</div></section>;
    })}</div>
  </div>;
}
