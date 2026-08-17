import { useMemo, useState } from "react";
import { RotateCcw, Search, Sparkles, Star } from "lucide-react";
import { recordRecentAction, toggleFavoriteAction } from "../lib/action-history";
import { activeEffectFromSpell, generatedCharacterActions, hasUnproficientArmor, isIncapacitated, syncEffectConditions, type GeneratedAction } from "../lib/character-rules";
import type { CharacterData, EncumbranceRule, EquipmentDefinition } from "../lib/types";
import { CombatStatusStrip } from "./combat-status-strip";
import { CollapsiblePanel } from "./collapsible-panel";

type PatchCharacter = (patch: Partial<CharacterData>) => void;
type UndoState = { message: string; patch: Partial<CharacterData> };

const timingLabels: Record<GeneratedAction["timing"], string> = { action: "Actions", bonus: "Bonus Actions", reaction: "Reactions", passive: "Passives" };

export function ActionDashboard({ character, patchCharacter, catalog, encumbranceRule = "variant" }: { character: CharacterData; patchCharacter: PatchCharacter; catalog: EquipmentDefinition[]; encumbranceRule?: EncumbranceRule }) {
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState("");
  const [undoState, setUndoState] = useState<UndoState>();
  const actions = useMemo(() => generatedCharacterActions(character, catalog), [character, catalog]);
  const byId = useMemo(() => new Map(actions.map((action) => [action.id, action])), [actions]);
  const visible = actions.filter((action) => `${action.name} ${action.source} ${action.description}`.toLowerCase().includes(query.trim().toLowerCase()));
  const favorites = character.favoriteActionIds.flatMap((id) => byId.get(id) ?? []);

  function snapshotForUndo(message: string): UndoState {
    return { message, patch: { resources: character.resources, inventory: character.inventory, spellSlots: character.spellSlots, activeEffects: character.activeEffects, conditions: character.conditions, concentratingSpellId: character.concentratingSpellId, recentActions: character.recentActions } };
  }

  function finishAction(action: GeneratedAction, result: string, changes: Partial<CharacterData> = {}, undoMessage?: string) {
    setUndoState(undoMessage ? snapshotForUndo(undoMessage) : undefined);
    patchCharacter({ ...changes, recentActions: recordRecentAction(character, action, result) });
    setFeedback(result);
  }

  function useAction(action: GeneratedAction) {
    if (action.timing !== "passive" && isIncapacitated(character)) {
      setFeedback(`${action.name}: the character is Incapacitated and cannot take actions, Bonus Actions, or Reactions.`);
      return;
    }
    if (action.resourceId) {
      const resource = character.resources.find((entry) => entry.id === action.resourceId);
      const cost = action.resourceCost ?? 1;
      if (!resource || resource.current < cost) { setFeedback(`${action.name}: not enough ${resource?.name ?? "resource"}.`); return; }
      const result = `${action.name}: spent ${cost} ${resource.name}.`;
      finishAction(action, result, { resources: character.resources.map((entry) => entry.id === resource.id ? { ...entry, current: entry.current - cost } : entry) }, `Restore ${cost} ${resource.name}`);
      return;
    }
    if (action.attackId) {
      const ammunition = action.ammunitionItemId ? character.inventory.find((entry) => entry.id === action.ammunitionItemId) : undefined;
      if (ammunition?.ammunition !== undefined) {
        if (ammunition.ammunition <= 0) { setFeedback(`${action.name}: no ammunition remaining.`); return; }
        const result = `${action.name}: attack used; spent one ammunition.`;
        finishAction(action, result, { inventory: character.inventory.map((entry) => entry.id === ammunition.id ? { ...entry, ammunition: Math.max(0, (entry.ammunition ?? 0) - 1) } : entry) }, "Restore one ammunition");
      } else {
        finishAction(action, `${action.name}: attack marked as used.`);
      }
      return;
    }
    if (action.inventoryId) {
      const item = character.inventory.find((entry) => entry.id === action.inventoryId);
      if (!item) return;
      if (item.maximumCharges !== undefined) {
        if ((item.charges ?? 0) <= 0) { setFeedback(`${item.name} has no charges remaining.`); return; }
        finishAction(action, `${item.name}: used one charge.`, { inventory: character.inventory.map((entry) => entry.id === item.id ? { ...entry, charges: (entry.charges ?? 0) - 1 } : entry) }, "Restore one charge");
      } else if (item.consumable) {
        if (item.quantity <= 0) return;
        finishAction(action, `${item.name}: used one item.`, { inventory: item.quantity === 1 ? character.inventory.filter((entry) => entry.id !== item.id) : character.inventory.map((entry) => entry.id === item.id ? { ...entry, quantity: entry.quantity - 1 } : entry) }, `Restore one ${item.name}`);
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
      const result = `${spell.name} cast${slotLevel ? ` with a level ${slotLevel} slot` : " as a cantrip"}${effect ? "; effect tracked" : ""}.`;
      finishAction(action, result, { spellSlots, activeEffects, conditions: syncEffectConditions(character.conditions, character.activeEffects, activeEffects), ...(effect?.concentration ? { concentratingSpellId: spell.id } : {}) }, slotLevel ? `Restore the level ${slotLevel} spell slot` : effect ? `Remove ${spell.name}'s tracked effect` : undefined);
      return;
    }
    finishAction(action, `${action.name}: marked as used.`);
  }

  function undoLastUse() {
    if (!undoState) return;
    patchCharacter(undoState.patch);
    setFeedback(`${undoState.message}.`);
    setUndoState(undefined);
  }

  function canUse(action: GeneratedAction) {
    if (action.timing === "passive" || isIncapacitated(character)) return false;
    if (action.resourceId) return (character.resources.find((entry) => entry.id === action.resourceId)?.current ?? 0) >= (action.resourceCost ?? 1);
    if (action.attackId && action.ammunitionItemId) return (character.inventory.find((entry) => entry.id === action.ammunitionItemId)?.ammunition ?? 0) > 0;
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
    return true;
  }

  function remainingUseLabel(action: GeneratedAction) {
    if (action.resourceId) { const resource = character.resources.find((entry) => entry.id === action.resourceId); return resource ? `${resource.current}/${resource.maximum}` : ""; }
    if (action.ammunitionItemId) { const item = character.inventory.find((entry) => entry.id === action.ammunitionItemId); return item?.ammunition !== undefined ? `${item.ammunition} ammo` : ""; }
    if (action.inventoryId) { const item = character.inventory.find((entry) => entry.id === action.inventoryId); return item?.maximumCharges !== undefined ? `${item.charges ?? 0}/${item.maximumCharges}` : item?.consumable ? `${item.quantity} left` : ""; }
    return "";
  }

  function actionCard(action: GeneratedAction, compact = false) {
    const favorite = character.favoriteActionIds.includes(action.id);
    return <article className={compact ? "compact-action-card" : ""} key={action.id}>
      <div className="action-card-heading"><div><span>{action.source}</span><h4>{action.name}</h4></div><button type="button" className={`favorite-action ${favorite ? "active" : ""}`} aria-label={`${favorite ? "Remove" : "Add"} ${action.name} ${favorite ? "from" : "to"} favorites`} onClick={() => patchCharacter({ favoriteActionIds: toggleFavoriteAction(character.favoriteActionIds, action.id) })}><Star size={15} fill={favorite ? "currentColor" : "none"} /></button></div>
      {!compact && <p>{action.description}</p>}
      <div className="action-card-controls">{remainingUseLabel(action) && <span>{remainingUseLabel(action)}</span>}{action.timing !== "passive" && <button disabled={!canUse(action)} onClick={() => useAction(action)}><Sparkles size={13} />{action.spellId ? "Cast" : "Use"}</button>}</div>
    </article>;
  }

  return <div className="action-dashboard">
    <CombatStatusStrip character={character} catalog={catalog} patchCharacter={patchCharacter} encumbranceRule={encumbranceRule} />
    <CollapsiblePanel className="action-dashboard-header" storageKey={`azeroth-panel-${character.id}-actions-dashboard`} eyebrow="Rules-aware play" title="Action dashboard" summary={<span>{actions.length} available</span>}><p>Actions are generated from your features, prepared spells, attacks, and equipped items.</p><label className="catalog-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search actions and features" /></label>{feedback && <div className="cast-feedback" role="status"><span>{feedback}</span>{undoState && <button className="feedback-undo" onClick={undoLastUse}><RotateCcw size={13} />Undo</button>}<button aria-label="Dismiss action message" onClick={() => setFeedback("")}>×</button></div>}</CollapsiblePanel>
    <CollapsiblePanel className="quick-action-panel" storageKey={`azeroth-panel-${character.id}-actions-quick-bar`} eyebrow="Quick access" title="Quick bar" summary={<span>{favorites.length} pinned</span>}>{favorites.length ? <div className="quick-action-grid">{favorites.map((action) => actionCard(action, true))}</div> : <p className="action-empty">Pin frequently used actions with the star on any action card.</p>}</CollapsiblePanel>
    {character.recentActions.length > 0 && <CollapsiblePanel className="recent-action-panel" storageKey={`azeroth-panel-${character.id}-actions-recent`} eyebrow="History" title="Recently used" summary={<span>{character.recentActions.length} entries</span>}><div className="recent-action-list">{character.recentActions.map((entry) => <button key={`${entry.actionId}-${entry.usedAt}`} disabled={!byId.has(entry.actionId) || !canUse(byId.get(entry.actionId)!)} onClick={() => { const action = byId.get(entry.actionId); if (action) useAction(action); }}><span>{entry.name}</span><small>{entry.result}</small></button>)}</div></CollapsiblePanel>}
    <div className="action-timing-grid">{(["action", "bonus", "reaction", "passive"] as const).map((timing) => {
      const group = visible.filter((action) => action.timing === timing);
      return <CollapsiblePanel className="action-column" storageKey={`azeroth-panel-${character.id}-actions-${timing}`} eyebrow="Action economy" title={timingLabels[timing]} summary={<span>{group.length} available</span>} key={timing}><div className="action-card-list">{group.map((action) => actionCard(action))}{!group.length && <p className="action-empty">No {timingLabels[timing].toLowerCase()} found.</p>}</div></CollapsiblePanel>;
    })}</div>
  </div>;
}
