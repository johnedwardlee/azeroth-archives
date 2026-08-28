import { useMemo, useState } from "react";
import { Dices, RotateCcw, Search, Sparkles, Star, Swords } from "lucide-react";
import { favoriteActionsFirst, recordRecentAction, toggleFavoriteAction } from "../lib/action-history";
import { activeEffectFromSpell, conditionRollEffects, extractDiceFormula, generatedCharacterActions, hasUnproficientArmor, isEquipmentProficient, isIncapacitated, resolvedRollMode, rollD20, rollDiceFormula, spellcastingAbilityForClass, spellDamageProfile, spellHealingProfile, spellSaveAbility, syncEffectConditions, type GeneratedAction, type RollMode, type SpellDamageProfile } from "../lib/character-rules";
import { ABILITY_LABELS, abilityModifier, type AbilityKey, type ActionTiming, type CharacterData, type EncumbranceRule, type EquipmentDefinition, type HitDicePool, type SharedRollEvent } from "../lib/types";
import { CombatStatusStrip } from "./combat-status-strip";
import { CollapsiblePanel } from "./collapsible-panel";
import { SessionTracker } from "./living-sheet";
import { PartyRollWorkspace } from "./party-roll-workspace";
import type { LocalRollEvent } from "../lib/live-sync";

type PatchCharacter = (patch: Partial<CharacterData>) => void;
type UndoState = { message: string; patch: Partial<CharacterData> };
type TimingFilter = "all" | Exclude<ActionTiming, "passive">;
type PurposeFilter = "all" | GeneratedAction["purpose"];
type EncounterRollResult = {
  actionId: string;
  label: string;
  dice: number[];
  kept: number;
  modifier: number;
  total: number;
  mode: RollMode;
  reasons: string[];
};
type EncounterDamage = SpellDamageProfile & { label: string; modifier: number; allowCritical: boolean; category?: "damage" | "healing" };

const timingLabels: Record<TimingFilter, string> = { all: "All", action: "Action", bonus: "Bonus action", reaction: "Reaction", movement: "Movement", other: "Free / Other" };
const purposeLabels: Record<PurposeFilter, string> = { all: "All purposes", attack: "Attacks", spell: "Spells", healing: "Healing", defense: "Defense", control: "Control", item: "Items", utility: "Utility", companion: "Companions" };
const timingFilters = Object.keys(timingLabels) as TimingFilter[];
const purposeFilters = Object.keys(purposeLabels) as PurposeFilter[];

function signed(value: number) {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value)}`;
}

export function ActionDashboard({ character, patchCharacter, catalog, hitDicePools, encumbranceRule = "standard", onRoll, partyRolls, partyRollsConnected = false }: { character: CharacterData; patchCharacter: PatchCharacter; catalog: EquipmentDefinition[]; hitDicePools: HitDicePool[]; encumbranceRule?: EncumbranceRule; onRoll?: (event: LocalRollEvent) => void; partyRolls?: SharedRollEvent[]; partyRollsConnected?: boolean }) {
  const [query, setQuery] = useState("");
  const [timingFilter, setTimingFilter] = useState<TimingFilter>("all");
  const [purposeFilter, setPurposeFilter] = useState<PurposeFilter>("all");
  const [feedback, setFeedback] = useState("");
  const [undoState, setUndoState] = useState<UndoState>();
  const [rollMode, setRollMode] = useState<RollMode>("normal");
  const [rollResult, setRollResult] = useState<EncounterRollResult>();
  const [pendingDamage, setPendingDamage] = useState<EncounterDamage>();
  const [damageResult, setDamageResult] = useState("");
  const actions = useMemo(() => generatedCharacterActions(character, catalog), [character, catalog]);
  const initiativeEffects = conditionRollEffects(character, "ability", "agility", "", catalog);
  const byId = useMemo(() => new Map(actions.map((action) => [action.id, action])), [actions]);
  const visible = favoriteActionsFirst(actions.filter((action) => {
    const matchesQuery = `${action.name} ${action.source} ${action.description}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesPurpose = purposeFilter === "all"
      || (purposeFilter === "spell" ? Boolean(action.spellId) : purposeFilter === "item" ? Boolean(action.inventoryId) : purposeFilter === "companion" ? action.source.startsWith("Companion") : action.purpose === purposeFilter);
    return matchesQuery && action.timing !== "passive" && (timingFilter === "all" || action.timing === timingFilter) && matchesPurpose;
  }), character.favoriteActionIds);
  const references = actions.filter((action) => action.timing === "passive" && `${action.name} ${action.source} ${action.description}`.toLowerCase().includes(query.trim().toLowerCase()) && (purposeFilter === "all" || action.purpose === purposeFilter));

  function snapshotForUndo(message: string): UndoState {
    return { message, patch: { resources: character.resources, inventory: character.inventory, spellSlots: character.spellSlots, featSpellcastingChoices: character.featSpellcastingChoices, activeEffects: character.activeEffects, conditions: character.conditions, concentratingSpellId: character.concentratingSpellId, recentActions: character.recentActions } };
  }

  function finishAction(action: GeneratedAction, result: string, changes: Partial<CharacterData> = {}, undoMessage?: string) {
    setUndoState(undoMessage ? snapshotForUndo(undoMessage) : undefined);
    patchCharacter({ ...changes, recentActions: recordRecentAction(character, action, result) });
    setFeedback(result);
  }

  function resolveD20(action: GeneratedAction, label: string, modifier: number, ability?: AbilityKey, damage?: EncounterDamage) {
    const effects = conditionRollEffects(character, "attack", ability, "", catalog);
    const mode = resolvedRollMode(rollMode, effects.forcedDisadvantage);
    const { dice, kept } = rollD20(mode);
    const adjustedModifier = modifier + effects.modifier;
    const result: EncounterRollResult = { actionId: action.id, label, dice, kept, modifier: adjustedModifier, total: kept + adjustedModifier, mode, reasons: effects.reasons };
    setRollResult(result);
    onRoll?.({ category: action.spellId ? "spell-attack" : "attack", label, formula: "d20", dice, modifier: adjustedModifier, total: result.total, mode, detail: effects.reasons.join("; ") });
    setPendingDamage(damage);
    setDamageResult("");
    return result;
  }

  function spellcastingAbility(spell: CharacterData["spells"][number]) {
    if (spell.castingAbility) return spell.castingAbility;
    const classEntry = character.classLevels.find((entry) => entry.className === spell.className) ?? character.classLevels[0];
    return spellcastingAbilityForClass(spell.className ?? classEntry?.className ?? character.className, classEntry?.subclassName ?? "", "charisma") ?? "charisma";
  }

  function rollResolvedDamage(critical = false, damage = pendingDamage) {
    if (!damage) return;
    const results = Array.from({ length: damage.instances }, () => rollDiceFormula(damage.formula, critical, damage.modifier));
    if (results.some((result) => !result)) { setDamageResult(`Enter damage as dice, such as 1d8.`); return; }
    const resolved = results.flatMap((result) => result ?? []);
    const type = damage.damageType ? ` ${damage.damageType}` : "";
    const total = resolved.reduce((sum, result) => sum + result.total, 0);
    const category = damage.category ?? "damage";
    const effectLabel = category === "healing" ? `${damage.label} healing` : `${damage.label}${critical ? " critical" : ""} damage`;
    onRoll?.({ category, label: effectLabel, formula: `${critical ? "Critical " : ""}${damage.instances > 1 ? `${damage.instances}×` : ""}${damage.formula}`, dice: resolved.flatMap((result) => result.rolls), modifier: resolved.reduce((sum, result) => sum + result.modifier, 0), total, mode: "normal", detail: category === "healing" ? "Hit Points restored" : damage.damageType ?? "" });
    if (resolved.length === 1) {
      const result = resolved[0];
      setDamageResult(`${damage.label}${critical ? " critical" : ""}: ${result.rolls.join(" + ")}${result.modifier ? ` ${signed(result.modifier)}` : ""} = ${result.total}${category === "healing" ? " Hit Points restored" : `${type} damage`}`);
      return;
    }
    const instance = damage.instanceLabel ?? "roll";
    const details = resolved.map((result, index) => `${instance} ${index + 1}: ${result.rolls.join(" + ")}${result.modifier ? ` ${signed(result.modifier)}` : ""} = ${result.total}`);
    setDamageResult(`${damage.label}: ${details.join(" · ")} · Total ${total}${category === "healing" ? " Hit Points restored" : `${type} damage`}`);
  }

  function nextSlotLevel(spell: CharacterData["spells"][number]) {
    if (spell.level === 0) return 0;
    return Array.from({ length: 10 - spell.level }, (_, index) => spell.level + index).find((level) => { const slot = character.spellSlots[String(level)]; return slot && slot.used < slot.maximum; });
  }

  function freeSourceCastAvailable(spell: CharacterData["spells"][number]) {
    if (spell.level === 0 || !spell.sourceFeatId) return false;
    const choice = character.featSpellcastingChoices.find((entry) => entry.featId === spell.sourceFeatId);
    if (!choice) return false;
    return spell.id === choice.levelOneSpellId ? !choice.freeCastUsed : !choice.freeCastUsedSpellIds?.includes(spell.id);
  }

  function spendFreeSourceCast(spell: CharacterData["spells"][number]) {
    return character.featSpellcastingChoices.map((choice) => choice.featId !== spell.sourceFeatId
      ? choice
      : spell.id === choice.levelOneSpellId
        ? { ...choice, freeCastUsed: true }
        : { ...choice, freeCastUsedSpellIds: [...new Set([...(choice.freeCastUsedSpellIds ?? []), spell.id])] });
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
      if (spell.level > 0 && !freeSourceCastAvailable(spell) && !Object.entries(character.spellSlots).some(([level, slot]) => Number(level) >= spell.level && slot.used < slot.maximum)) return `No level-${spell.level}+ slot`;
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
      const attack = character.attacks.find((entry) => entry.id === action.attackId);
      if (!attack) { setFeedback(`${action.name}: tracked attack not found.`); return; }
      const definition = attack.contentId ? catalog.find((entry) => entry.id === attack.contentId) : undefined;
      const proficient = definition ? isEquipmentProficient(character, definition) : attack.proficient;
      const modifier = abilityModifier(character.abilities[attack.ability]) + (proficient ? character.proficiencyBonus : 0) + attack.bonus;
      const roll = resolveD20(action, `${attack.name} attack`, modifier, attack.ability, { label: attack.name, formula: attack.damage, modifier: abilityModifier(character.abilities[attack.ability]) + attack.damageBonus, damageType: attack.damageType, instances: 1, automatic: false, allowCritical: true });
      const ammunition = action.ammunitionItemId ? character.inventory.find((entry) => entry.id === action.ammunitionItemId) : undefined;
      const result = `${attack.name}: ${roll.dice.join(" / ")} ${signed(roll.modifier)} = ${roll.total}${roll.mode !== "normal" ? ` (${roll.mode})` : ""}.`;
      if (ammunition?.ammunition !== undefined) finishAction(action, `${result} Spent one ammunition.`, { inventory: character.inventory.map((entry) => entry.id === ammunition.id ? { ...entry, ammunition: Math.max(0, (entry.ammunition ?? 0) - 1) } : entry) }, "Restore one ammunition");
      else finishAction(action, result);
      return;
    }
    if (action.inventoryId) {
      const item = character.inventory.find((entry) => entry.id === action.inventoryId)!;
      const formula = extractDiceFormula(action.description);
      if (formula) rollResolvedDamage(false, { label: item.name, formula, modifier: 0, damageType: "", instances: 1, automatic: true, allowCritical: false, category: /heal|regain|restore|hit points?/i.test(action.description) ? "healing" : "damage" });
      if (item.maximumCharges !== undefined) finishAction(action, `${item.name}: used one charge.`, { inventory: character.inventory.map((entry) => entry.id === item.id ? { ...entry, charges: (entry.charges ?? 0) - 1 } : entry) }, "Restore one charge");
      else finishAction(action, `${item.name}: used one item.`, { inventory: item.quantity === 1 ? character.inventory.filter((entry) => entry.id !== item.id) : character.inventory.map((entry) => entry.id === item.id ? { ...entry, quantity: entry.quantity - 1 } : entry) }, `Restore one ${item.name}`);
      return;
    }
    if (action.spellId) {
      const spell = character.spells.find((entry) => entry.id === action.spellId)!;
      const usesFreeCast = freeSourceCastAvailable(spell);
      const slotLevel = usesFreeCast ? 0 : nextSlotLevel(spell);
      const spellSlots = slotLevel ? { ...character.spellSlots, [String(slotLevel)]: { ...character.spellSlots[String(slotLevel)], used: character.spellSlots[String(slotLevel)].used + 1 } } : character.spellSlots;
      const effect = activeEffectFromSpell(spell);
      const activeEffects = effect ? [...character.activeEffects.filter((entry) => !(effect.concentration && entry.concentration)), effect] : character.activeEffects;
      const castingAbility = spellcastingAbility(spell);
      const damageProfile = spellDamageProfile(spell, slotLevel ?? spell.level, character.level);
      const healingProfile = spellHealingProfile(spell, slotLevel ?? spell.level);
      const damage = healingProfile && action.purpose === "healing"
          ? { formula: healingProfile.formula, damageType: "", instances: 1, automatic: true, label: spell.name, modifier: healingProfile.addsSpellcastingModifier ? abilityModifier(character.abilities[castingAbility]) : 0, allowCritical: false, category: "healing" as const }
          : damageProfile
            ? { ...damageProfile, label: spell.name, modifier: 0, allowCritical: /spell attack/i.test(spell.description), category: "damage" as const }
            : healingProfile
              ? { formula: healingProfile.formula, damageType: "", instances: 1, automatic: true, label: spell.name, modifier: healingProfile.addsSpellcastingModifier ? abilityModifier(character.abilities[castingAbility]) : 0, allowCritical: false, category: "healing" as const }
              : undefined;
      const spellAttack = /spell attack/i.test(spell.description);
      const attackRoll = spellAttack ? resolveD20(action, `${spell.name} spell attack`, abilityModifier(character.abilities[castingAbility]) + character.proficiencyBonus, castingAbility, damage) : undefined;
      const saveAbility = spellSaveAbility(spell.description);
      const saveDc = 8 + character.proficiencyBonus + abilityModifier(character.abilities[castingAbility]);
      if (!spellAttack) {
        setRollResult(undefined);
        setPendingDamage(damage);
        setDamageResult("");
        if (damage?.automatic) rollResolvedDamage(false, damage);
      }
      const resolution = attackRoll ? ` Attack: ${attackRoll.dice.join(" / ")} ${signed(attackRoll.modifier)} = ${attackRoll.total}${attackRoll.mode !== "normal" ? ` (${attackRoll.mode})` : ""}.` : damage?.category === "healing" && damage.automatic ? ` Healing rolled automatically.` : saveAbility ? ` Target save: ${ABILITY_LABELS[saveAbility]} DC ${saveDc}.` : damage?.automatic ? ` Damage rolled automatically.` : "";
      const result = `${spell.name} cast${usesFreeCast ? " with its once-per-Long-Rest casting" : slotLevel ? ` with a level ${slotLevel} slot` : " as a cantrip"}${effect ? "; effect tracked" : ""}.${resolution}`;
      finishAction(action, result, { spellSlots, ...(usesFreeCast ? { featSpellcastingChoices: spendFreeSourceCast(spell) } : {}), activeEffects, conditions: syncEffectConditions(character.conditions, character.activeEffects, activeEffects), ...(effect?.concentration ? { concentratingSpellId: spell.id } : {}) }, usesFreeCast ? `Restore ${spell.name}'s free casting` : slotLevel ? `Restore the level ${slotLevel} spell slot` : effect ? `Remove ${spell.name}'s tracked effect` : undefined);
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

  function d20Formula(modifier: number, ability: AbilityKey, kind: "attack" | "ability" = "attack") {
    const effects = conditionRollEffects(character, kind, ability, "", catalog);
    const mode = resolvedRollMode(rollMode, effects.forcedDisadvantage);
    const dice = mode === "advantage" ? "2d20 high" : mode === "disadvantage" ? "2d20 low" : "d20";
    return `${dice} ${signed(modifier + effects.modifier)}`;
  }

  function actionButtonLabel(action: GeneratedAction) {
    if (action.attackId) {
      const attack = character.attacks.find((entry) => entry.id === action.attackId);
      if (!attack) return "Attack unavailable";
      const definition = attack.contentId ? catalog.find((entry) => entry.id === attack.contentId) : undefined;
      const proficient = definition ? isEquipmentProficient(character, definition) : attack.proficient;
      const modifier = abilityModifier(character.abilities[attack.ability]) + (proficient ? character.proficiencyBonus : 0) + attack.bonus;
      return d20Formula(modifier, attack.ability);
    }
    if (action.spellId) {
      const spell = character.spells.find((entry) => entry.id === action.spellId);
      if (!spell) return "Spell unavailable";
      const castingAbility = spellcastingAbility(spell);
      const healing = spellHealingProfile(spell, nextSlotLevel(spell) ?? spell.level);
      if (healing && action.purpose === "healing") return `${healing.formula}${healing.addsSpellcastingModifier ? ` ${signed(abilityModifier(character.abilities[castingAbility]))}` : ""}`;
      if (/spell attack/i.test(spell.description)) return d20Formula(abilityModifier(character.abilities[castingAbility]) + character.proficiencyBonus, castingAbility);
      const saveAbility = spellSaveAbility(spell.description);
      if (saveAbility) return `${ABILITY_LABELS[saveAbility]} DC ${8 + character.proficiencyBonus + abilityModifier(character.abilities[castingAbility])}`;
      const damage = spellDamageProfile(spell, nextSlotLevel(spell) ?? spell.level, character.level);
      if (damage?.automatic) return damage.instances > 1 ? `${damage.instances}×(${damage.formula})` : damage.formula;
      if (healing) return `${healing.formula}${healing.addsSpellcastingModifier ? ` ${signed(abilityModifier(character.abilities[castingAbility]))}` : ""}`;
      return "Use · no roll";
    }
    if (action.inventoryId) return extractDiceFormula(action.description) ?? "Use";
    return "Use";
  }

  function actionCard(action: GeneratedAction) {
    const favorite = character.favoriteActionIds.includes(action.id);
    const unavailable = unavailableReason(action);
    const buttonLabel = actionButtonLabel(action);
    return <article className={unavailable ? "unavailable" : undefined} key={action.id}>
      <div className="action-card-heading"><div><span>{action.source}</span><h4>{action.name}</h4><div className="action-badges"><b>{action.timing === "other" ? "Free / Other" : action.timing}</b><b>{purposeLabels[action.purpose]}</b></div></div><button type="button" className={`favorite-action ${favorite ? "active" : ""}`} aria-label={`${favorite ? "Remove" : "Add"} ${action.name} ${favorite ? "from" : "to"} favorites`} onClick={() => patchCharacter({ favoriteActionIds: toggleFavoriteAction(character.favoriteActionIds, action.id) })}><Star size={15} fill={favorite ? "currentColor" : "none"} /></button></div>
      <p>{action.description}</p>
      <div className="action-card-controls">{unavailable ? <span className="unavailable-reason">{unavailable}</span> : remainingUseLabel(action) ? <span>{remainingUseLabel(action)}</span> : <span>Ready</span>}{action.timing !== "passive" && <button disabled={Boolean(unavailable)} title={unavailable ?? `${action.name}: ${buttonLabel}`} aria-label={`${action.name}: ${buttonLabel}`} onClick={() => useAction(action)}>{action.attackId || (action.spellId && /spell attack/i.test(character.spells.find((entry) => entry.id === action.spellId)?.description ?? "")) ? <Dices size={13} /> : <Sparkles size={13} />}{buttonLabel}</button>}</div>
    </article>;
  }

  return <div className="action-dashboard encounter-workspace">
    {partyRolls && onRoll && <PartyRollWorkspace rolls={partyRolls} roller="player" storageKey={`azeroth-panel-${character.id}-encounter-party-rolls-v2`} sharingAvailable={partyRollsConnected} onRoll={onRoll} initiative={{ modifier: abilityModifier(character.abilities.agility) + initiativeEffects.modifier, forcedDisadvantage: initiativeEffects.forcedDisadvantage, detail: initiativeEffects.reasons.join("; ") }} />}
    <CombatStatusStrip character={character} catalog={catalog} patchCharacter={patchCharacter} encumbranceRule={encumbranceRule} />
    <CollapsiblePanel className="action-dashboard-header" storageKey={`azeroth-panel-${character.id}-encounter-library-v2`} eyebrow="Active play" title="Encounter workspace" summary={<span>{visible.length} choices</span>}>
      <p>Find attacks, spells, features, items, companion commands, and standard actions without leaving this screen.</p>
      <label className="catalog-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search every action" /></label>
      <div className="encounter-roll-toolbar"><span>D20 roll mode</span><div className="roll-mode" aria-label="Encounter D20 roll mode">{(["normal", "advantage", "disadvantage"] as RollMode[]).map((mode) => <button type="button" key={mode} className={rollMode === mode ? "active" : ""} aria-pressed={rollMode === mode} onClick={() => setRollMode(mode)}>{mode === "normal" ? "Normal" : mode === "advantage" ? "Adv" : "Dis"}</button>)}</div></div>
      <div className="encounter-filter-row" aria-label="Action economy filters">{timingFilters.map((filter) => <button type="button" className={timingFilter === filter ? "active" : ""} aria-pressed={timingFilter === filter} onClick={() => setTimingFilter(filter)} key={filter}>{timingLabels[filter]}</button>)}</div>
      <div className="encounter-filter-row purpose-filters" aria-label="Action purpose filters">{purposeFilters.map((filter) => <button type="button" className={purposeFilter === filter ? "active" : ""} aria-pressed={purposeFilter === filter} onClick={() => setPurposeFilter(filter)} key={filter}>{purposeLabels[filter]}</button>)}</div>
      {feedback && <div className="cast-feedback" role="status"><span>{feedback}</span>{undoState && <button className="feedback-undo" onClick={undoLastUse}><RotateCcw size={13} />Undo</button>}<button aria-label="Dismiss action message" onClick={() => setFeedback("")}>×</button></div>}
      {(rollResult || pendingDamage || damageResult) && <div className="encounter-resolution" role="status">
        {rollResult && <div className="roll-result"><Dices size={18} /><div><span>{rollResult.label}</span><strong>{rollResult.total}</strong><small>{rollResult.dice.join(" / ")} {signed(rollResult.modifier)}{rollResult.mode !== "normal" ? ` · ${rollResult.mode}` : ""}</small>{rollResult.reasons.length > 0 && <small className="roll-effect-note">Disadvantage: {rollResult.reasons.join(", ")}</small>}{character.exhaustionLevel > 0 && <small className="roll-effect-note">Exhaustion: −{character.exhaustionLevel * 2} applied</small>}</div><button aria-label="Clear roll result" onClick={() => { setRollResult(undefined); setPendingDamage(undefined); setDamageResult(""); }}>×</button></div>}
        {pendingDamage && <div className="encounter-damage-actions"><span>{pendingDamage.instances > 1 ? `${pendingDamage.instances} × ` : ""}{pendingDamage.formula}{pendingDamage.modifier ? ` ${signed(pendingDamage.modifier)}` : ""}{pendingDamage.damageType ? ` ${pendingDamage.damageType}` : ""}</span><button type="button" onClick={() => rollResolvedDamage()}><Swords size={13} />Roll {pendingDamage.category === "healing" ? "healing" : "damage"}</button>{pendingDamage.allowCritical && <button type="button" onClick={() => rollResolvedDamage(true)}>Critical</button>}</div>}
        {damageResult && <div className="damage-roll-result"><Swords size={16} /><span>{damageResult}</span><button aria-label="Clear damage result" onClick={() => setDamageResult("")}>×</button></div>}
      </div>}
      <div className="encounter-library-inline" role="region" aria-labelledby="encounter-choices-title">
        <div className="encounter-library-heading"><h3 id="encounter-choices-title">Available choices</h3><span>{visible.length} shown · unavailable choices remain visible</span></div>
        <div className="encounter-action-grid">{visible.map((action) => actionCard(action))}{!visible.length && <p className="action-empty">No actions match these filters.</p>}</div>
      </div>
    </CollapsiblePanel>
    <SessionTracker character={character} patchCharacter={patchCharacter} hitDicePools={hitDicePools} onRoll={onRoll} />
    {character.recentActions.length > 0 && <CollapsiblePanel className="recent-action-panel" storageKey={`azeroth-panel-${character.id}-encounter-recent`} eyebrow="History" title="Recently used" summary={<span>{character.recentActions.length} entries</span>}><div className="recent-action-list">{character.recentActions.map((entry) => { const action = byId.get(entry.actionId); return <button key={`${entry.actionId}-${entry.usedAt}`} disabled={!action || Boolean(action && unavailableReason(action))} onClick={() => { if (action) useAction(action); }}><span>{entry.name}</span><small>{entry.result}</small></button>; })}</div></CollapsiblePanel>}
    {timingFilter === "all" && references.length > 0 && <CollapsiblePanel className="action-reference-panel" storageKey={`azeroth-panel-${character.id}-encounter-references`} eyebrow="Always available" title="Passive features" summary={<span>{references.length} references</span>} defaultExpanded={false}><div className="encounter-action-grid">{references.map((action) => actionCard(action))}</div></CollapsiblePanel>}
  </div>;
}
