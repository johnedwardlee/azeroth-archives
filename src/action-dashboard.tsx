import { useMemo, useState } from "react";
import { RotateCcw, Search, Sparkles, Star } from "lucide-react";
import { recordRecentAction, toggleFavoriteAction } from "../lib/action-history";
import { activeEffectFromSpell, generatedCharacterActions, hasUnproficientArmor, isIncapacitated, syncEffectConditions, type GeneratedAction } from "../lib/character-rules";
import type { ActionTiming, CharacterData, EncumbranceRule, EquipmentDefinition } from "../lib/types";
import { CombatStatusStrip } from "./combat-status-strip";
import { CollapsiblePanel } from "./collapsible-panel";

type PatchCharacter = (patch: Partial<CharacterData>) => void;
type UndoState = { message: string; patch: Partial<CharacterData> };
type TimingFilter = "all" | Exclude<ActionTiming, "passive">;
type PurposeFilter = "all" | GeneratedAction["purpose"];

const timingLabels: Record<TimingFilter, string> = { all: "All", action: "Action", bonus: "Bonus action", reaction: "Reaction", movement: "Movement", other: "Free / Other" };
const purposeLabels: Record<PurposeFilter, string> = { all: "All purposes", attack: "Attacks", spell: "Spells", healing: "Healing", defense: "Defense", control: "Control", item: "Items", utility: "Utility", companion: "Companions" };
const timingFilters = Object.keys(timingLabels) as TimingFilter[];
const purposeFilters = Object.keys(purposeLabels) as PurposeFilter[];

export function ActionDashboard({ character, patchCharacter, catalog, encumbranceRule = "variant" }: { character: CharacterData; patchCharacter: PatchCharacter; catalog: EquipmentDefinition[]; encumbranceRule?: EncumbranceRule }) {
  const [query, setQuery] = useState("");
  const [timingFilter, setTimingFilter] = useState<TimingFilter>("all");
  const [purposeFilter, setPurposeFilter] = useState<PurposeFilter>("all");
  const [feedback, setFeedback] = useState("");
  const [undoState, setUndoState] = useState<UndoState>();
  const actions = useMemo(() => generatedCharacterActions(character, catalog), [character, catalog]);
  const byId = useMemo(() => new Map(actions.map((action) => [action.id, action])), [actions]);
  const visible = actions.filter((action) => {
    const matchesQuery = `${action.name} ${action.source} ${action.description}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesPurpose = purposeFilter === "all"
      || (purposeFilter === "spell" ? Boolean(action.spellId) : purposeFilter === "item" ? Boolean(action.inventoryId) : purposeFilter === "companion" ? action.source.startsWith("Companion") : action.purpose === purposeFilter);
    return matchesQuery && action.timing !== "passive" && (timingFilter === "all" || action.timing === timingFilter) && matchesPurpose;
  });
  const references = actions.filter((action) => action.timing === "passive" && `${action.name} ${action.source} ${action.description}`.toLowerCase().includes(query.trim().toLowerCase()) && (purposeFilter === "all" || action.purpose === purposeFilter));
  const favorites = character.favoriteActionIds.flatMap((id) => byId.get(id) ?? []);

  function snapshotForUndo(message: string): UndoState {
    return { message, patch: { resources: character.resources, inventory: character.inventory, spellSlots: character.spellSlots, activeEffects: character.activeEffects, conditions: character.conditions, concentratingSpellId: character.concentratingSpellId, recentActions: character.recentActions } };
  }

  function finishAction(action: GeneratedAction, result: string, changes: Partial<CharacterData> = {}, undoMessage?: string) {
    setUndoState(undoMessage ? snapshotForUndo(undoMessage) : undefined);
    patchCharacter({ ...changes, recentActions: recordRecentAction(character, action, result) });
    setFeedback(result);
  }

  function unavailableReason(action: GeneratedAction): string | null {
    if (action.timing === "passive") return "Reference only";
    if (isIncapacitated(character)) return "Unavailable while Incapacitated";
    if (action.resourceId) {
      const resource = character.resources.find((entry) => entry.id === action.resourceId);
      if (!resource || resource.current < (action.resourceCost ?? 1)) return `Not enough ${resource?.name ?? "resource"}`;
    }
    if (action.attackId && action.ammunitionItemId && (character.inventory.find((entry) => entry.id === action.ammunitionItemId)?.ammunition ?? 0) <= 0) return "No ammunition remaining";
    if (action.inventoryId) {
      const item = character.inventory.find((entry) => entry.id === action.inventoryId);
      if (!item) return "Item is no longer carried";
      if (item.maximumCharges !== undefined && (item.charges ?? 0) <= 0) return "No charges remaining";
      if (item.maximumCharges === undefined && (item.quantity ?? 0) <= 0) return "None remaining";
    }
    if (action.spellId) {
      if (hasUnproficientArmor(character, catalog)) return "Armor blocks spellcasting";
      const spell = character.spells.find((entry) => entry.id === action.spellId);
      if (!spell) return "Spell is no longer known";
      if (spell.level > 0 && !spell.prepared) return "Spell is not prepared";
      if (spell.level > 0 && !Object.entries(character.spellSlots).some(([level, slot]) => Number(level) >= spell.level && slot.used < slot.maximum)) return `No level-${spell.level}+ slot`;
    }
    return null;
  }

  function useAction(action: GeneratedAction) {
    const unavailable = unavailableReason(action);
    if (unavailable) { setFeedback(`${action.name}: ${unavailable}.`); return; }
    if (action.resourceId) {
      const resource = character.resources.find((entry) => entry.id === action.resourceId)!;
      const cost = action.resourceCost ?? 1;
      finishAction(action, `${action.name}: spent ${cost} ${resource.name}.`, { resources: character.resources.map((entry) => entry.id === resource.id ? { ...entry, current: entry.current - cost } : entry) }, `Restore ${cost} ${resource.name}`);
      return;
    }
    if (action.attackId) {
      const ammunition = action.ammunitionItemId ? character.inventory.find((entry) => entry.id === action.ammunitionItemId) : undefined;
      if (ammunition?.ammunition !== undefined) finishAction(action, `${action.name}: attack used; spent one ammunition.`, { inventory: character.inventory.map((entry) => entry.id === ammunition.id ? { ...entry, ammunition: Math.max(0, (entry.ammunition ?? 0) - 1) } : entry) }, "Restore one ammunition");
      else finishAction(action, `${action.name}: attack marked as used.`);
      return;
    }
    if (action.inventoryId) {
      const item = character.inventory.find((entry) => entry.id === action.inventoryId)!;
      if (item.maximumCharges !== undefined) finishAction(action, `${item.name}: used one charge.`, { inventory: character.inventory.map((entry) => entry.id === item.id ? { ...entry, charges: (entry.charges ?? 0) - 1 } : entry) }, "Restore one charge");
      else finishAction(action, `${item.name}: used one item.`, { inventory: item.quantity === 1 ? character.inventory.filter((entry) => entry.id !== item.id) : character.inventory.map((entry) => entry.id === item.id ? { ...entry, quantity: entry.quantity - 1 } : entry) }, `Restore one ${item.name}`);
      return;
    }
    if (action.spellId) {
      const spell = character.spells.find((entry) => entry.id === action.spellId)!;
      const slotLevel = spell.level === 0 ? 0 : Array.from({ length: 10 - spell.level }, (_, index) => spell.level + index).find((level) => { const slot = character.spellSlots[String(level)]; return slot && slot.used < slot.maximum; });
      const spellSlots = slotLevel ? { ...character.spellSlots, [String(slotLevel)]: { ...character.spellSlots[String(slotLevel)], used: character.spellSlots[String(slotLevel)].used + 1 } } : character.spellSlots;
      const effect = activeEffectFromSpell(spell);
      const activeEffects = effect ? [...character.activeEffects.filter((entry) => !(effect.concentration && entry.concentration)), effect] : character.activeEffects;
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

  function remainingUseLabel(action: GeneratedAction) {
    if (action.resourceId) { const resource = character.resources.find((entry) => entry.id === action.resourceId); return resource ? `${resource.current}/${resource.maximum}` : ""; }
    if (action.ammunitionItemId) { const item = character.inventory.find((entry) => entry.id === action.ammunitionItemId); return item?.ammunition !== undefined ? `${item.ammunition} ammo` : ""; }
    if (action.inventoryId) { const item = character.inventory.find((entry) => entry.id === action.inventoryId); return item?.maximumCharges !== undefined ? `${item.charges ?? 0}/${item.maximumCharges}` : item?.consumable ? `${item.quantity} left` : ""; }
    return "";
  }

  function actionCard(action: GeneratedAction, compact = false) {
    const favorite = character.favoriteActionIds.includes(action.id);
    const unavailable = unavailableReason(action);
    return <article className={`${compact ? "compact-action-card" : ""} ${unavailable ? "unavailable" : ""}`.trim()} key={action.id}>
      <div className="action-card-heading"><div><span>{action.source}</span><h4>{action.name}</h4><div className="action-badges"><b>{action.timing === "other" ? "Free / Other" : action.timing}</b><b>{purposeLabels[action.purpose]}</b></div></div><button type="button" className={`favorite-action ${favorite ? "active" : ""}`} aria-label={`${favorite ? "Remove" : "Add"} ${action.name} ${favorite ? "from" : "to"} favorites`} onClick={() => patchCharacter({ favoriteActionIds: toggleFavoriteAction(character.favoriteActionIds, action.id) })}><Star size={15} fill={favorite ? "currentColor" : "none"} /></button></div>
      {!compact && <p>{action.description}</p>}
      <div className="action-card-controls">{unavailable ? <span className="unavailable-reason">{unavailable}</span> : remainingUseLabel(action) ? <span>{remainingUseLabel(action)}</span> : <span>Ready</span>}{action.timing !== "passive" && <button disabled={Boolean(unavailable)} title={unavailable ?? undefined} onClick={() => useAction(action)}><Sparkles size={13} />{action.spellId ? "Cast" : "Use"}</button>}</div>
    </article>;
  }

  return <div className="action-dashboard encounter-workspace">
    <CombatStatusStrip character={character} catalog={catalog} patchCharacter={patchCharacter} encumbranceRule={encumbranceRule} />
    <CollapsiblePanel className="action-dashboard-header" storageKey={`azeroth-panel-${character.id}-encounter-library`} eyebrow="Active play" title="Encounter workspace" summary={<span>{visible.length} choices shown</span>}>
      <p>Find attacks, spells, features, items, companion commands, and standard actions without leaving this screen.</p>
      <label className="catalog-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search every action" /></label>
      <div className="encounter-filter-row" aria-label="Action economy filters">{timingFilters.map((filter) => <button type="button" className={timingFilter === filter ? "active" : ""} aria-pressed={timingFilter === filter} onClick={() => setTimingFilter(filter)} key={filter}>{timingLabels[filter]}</button>)}</div>
      <div className="encounter-filter-row purpose-filters" aria-label="Action purpose filters">{purposeFilters.map((filter) => <button type="button" className={purposeFilter === filter ? "active" : ""} aria-pressed={purposeFilter === filter} onClick={() => setPurposeFilter(filter)} key={filter}>{purposeLabels[filter]}</button>)}</div>
      {feedback && <div className="cast-feedback" role="status"><span>{feedback}</span>{undoState && <button className="feedback-undo" onClick={undoLastUse}><RotateCcw size={13} />Undo</button>}<button aria-label="Dismiss action message" onClick={() => setFeedback("")}>×</button></div>}
    </CollapsiblePanel>
    <CollapsiblePanel className="quick-action-panel" storageKey={`azeroth-panel-${character.id}-encounter-quick-bar`} eyebrow="Quick access" title="Quick bar" summary={<span>{favorites.length} pinned</span>}>{favorites.length ? <div className="quick-action-grid">{favorites.map((action) => actionCard(action, true))}</div> : <p className="action-empty">Pin frequently used actions with the star on any action card.</p>}</CollapsiblePanel>
    {character.recentActions.length > 0 && <CollapsiblePanel className="recent-action-panel" storageKey={`azeroth-panel-${character.id}-encounter-recent`} eyebrow="History" title="Recently used" summary={<span>{character.recentActions.length} entries</span>}><div className="recent-action-list">{character.recentActions.map((entry) => { const action = byId.get(entry.actionId); return <button key={`${entry.actionId}-${entry.usedAt}`} disabled={!action || Boolean(action && unavailableReason(action))} onClick={() => { if (action) useAction(action); }}><span>{entry.name}</span><small>{entry.result}</small></button>; })}</div></CollapsiblePanel>}
    <section className="panel encounter-library" aria-labelledby="encounter-library-title"><div className="section-heading"><div><span className="eyebrow">Unified library</span><h2 id="encounter-library-title">Available choices</h2></div><span className="section-note">{visible.length} shown · unavailable choices remain visible</span></div><div className="encounter-action-grid">{visible.map((action) => actionCard(action))}{!visible.length && <p className="action-empty">No actions match these filters.</p>}</div></section>
    {timingFilter === "all" && references.length > 0 && <CollapsiblePanel className="action-reference-panel" storageKey={`azeroth-panel-${character.id}-encounter-references`} eyebrow="Always available" title="Passive features" summary={<span>{references.length} references</span>} defaultExpanded={false}><div className="encounter-action-grid">{references.map((action) => actionCard(action))}</div></CollapsiblePanel>}
  </div>;
}
