import { useEffect, useMemo, useState } from "react";
import { Activity, Backpack, BookOpen, Heart, Minus, Plus, Radio, Shield, Sparkles, UserMinus, Users } from "lucide-react";
import { calculateArmorClass, calculateEncumbrance, STANDARD_CONDITIONS, syncEffectConditions } from "../lib/character-rules";
import type { LocalRollEvent } from "../lib/live-sync";
import type { CharacterData, EquipmentDefinition, InventoryItem, LiveCampaignMember, SharedRollEvent, SpellDefinition } from "../lib/types";
import { DescriptionPicker } from "./description-picker";
import { PartyRollWorkspace } from "./party-roll-workspace";
import { CollapsiblePanel } from "./collapsible-panel";

type DmIntent = "add-inventory-item" | "add-known-spell" | "adjust-current-resource" | "adjust-condition";

type Props = {
  characters: CharacterData[];
  members: LiveCampaignMember[];
  rolls: SharedRollEvent[];
  onlineUserIds: Set<string>;
  ownerByCharacterId: Map<string, string>;
  selectedCharacterId?: string;
  fullEditCharacterId?: string;
  equipment: EquipmentDefinition[];
  spells: SpellDefinition[];
  onSelectCharacter: (characterId: string) => void;
  onToggleFullEdit: (characterId: string, enabled: boolean) => void;
  onOpenSheet: (characterId: string) => void;
  onPatch: (characterId: string, patch: Partial<CharacterData>, intent: DmIntent) => void;
  onRoll: (characterId: string, roll: LocalRollEvent) => void;
  onClearRolls: () => Promise<void>;
  onRemoveCharacter: (characterId: string, deleteRollHistory: boolean) => Promise<void>;
};

function equipmentDescription(item: EquipmentDefinition) {
  return [
    item.description,
    item.damage ? `Damage: ${item.damage}${item.damageType ? ` ${item.damageType}` : ""}` : "",
    item.properties?.length ? `Properties: ${item.properties.join(", ")}` : "",
    item.mastery ? `Mastery: ${item.mastery}` : "",
  ].filter(Boolean).join("\n\n");
}

export function createDmCatalogItem(item: EquipmentDefinition, id: string): InventoryItem {
  return { id, contentId: item.id, name: item.name, category: item.category, quantity: 1, equipped: false, notes: "", weight: item.weight, cost: item.cost, equipmentSlot: "none" };
}

export function createDmCustomItem(name: string, id: string): InventoryItem {
  return { id, name: name.trim(), category: "Custom", quantity: 1, equipped: false, notes: "", equipmentSlot: "none" };
}

export function patchDmInventoryItem(inventory: InventoryItem[], itemId: string, patch: Partial<InventoryItem>) {
  return inventory.map((item) => {
    if (item.id !== itemId) return item;
    const next = { ...item, ...patch };
    next.quantity = Math.max(0, Number(next.quantity) || 0);
    if (next.ammunition !== undefined) next.ammunition = Math.max(0, Number(next.ammunition) || 0);
    if (next.maximumCharges !== undefined) next.maximumCharges = Math.max(0, Number(next.maximumCharges) || 0);
    if (next.charges !== undefined) next.charges = Math.max(0, Math.min(next.maximumCharges ?? next.charges, Number(next.charges) || 0));
    return next;
  });
}

export function sortDmKnownSpells(spells: CharacterData["spells"]) {
  return [...spells].sort((left, right) => left.level - right.level || left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
}

export function concentratingOn(character: CharacterData) {
  return character.spells.find((spell) => spell.id === character.concentratingSpellId)?.name
    ?? character.activeEffects.find((effect) => effect.concentration)?.name;
}

export function addDmConditionPatch(character: CharacterData, condition: string): Partial<CharacterData> {
  if (!STANDARD_CONDITIONS.includes(condition) || character.conditions.includes(condition) || character.conditionImmunities.some((immune) => immune.toLowerCase() === condition.toLowerCase())) return {};
  const endsConcentration = ["Incapacitated", "Paralyzed", "Petrified", "Stunned", "Unconscious"].includes(condition);
  const activeEffects = endsConcentration ? character.activeEffects.filter((effect) => !effect.concentration) : character.activeEffects;
  return {
    conditions: syncEffectConditions([...character.conditions, condition], character.activeEffects, activeEffects),
    exhaustionLevel: condition === "Exhaustion" ? Math.max(1, character.exhaustionLevel) : character.exhaustionLevel,
    ...(endsConcentration ? { concentratingSpellId: undefined, activeEffects } : {}),
  };
}

export function removeDmConditionPatch(character: CharacterData, condition: string): Partial<CharacterData> {
  return {
    conditions: syncEffectConditions(character.conditions.filter((entry) => entry !== condition), character.activeEffects, character.activeEffects),
    ...(condition === "Exhaustion" ? { exhaustionLevel: 0 } : {}),
  };
}

export function DmPartyWorkspace({ characters, members, rolls, onlineUserIds, ownerByCharacterId, selectedCharacterId, fullEditCharacterId, equipment, spells, onSelectCharacter, onToggleFullEdit, onOpenSheet, onPatch, onRoll, onClearRolls, onRemoveCharacter }: Props) {
  const selected = characters.find((entry) => entry.id === selectedCharacterId) ?? characters[0];
  const [itemId, setItemId] = useState("");
  const [spellId, setSpellId] = useState("");
  const [customItemName, setCustomItemName] = useState("");
  const [condition, setCondition] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [deleteRollHistory, setDeleteRollHistory] = useState(false);
  const [removing, setRemoving] = useState(false);
  const memberById = useMemo(() => new Map(members.map((member) => [member.userId, member])), [members]);
  const availableSpells = useMemo(() => selected ? spells
    .filter((spell) => !selected.spells.some((known) => known.id === spell.id))
    .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name, undefined, { sensitivity: "base" })) : [], [selected, spells]);
  const knownSpells = useMemo(() => selected ? sortDmKnownSpells(selected.spells) : [], [selected]);
  const availableConditions = useMemo(() => selected ? STANDARD_CONDITIONS.filter((entry) => !selected.conditions.includes(entry) && !selected.conditionImmunities.some((immune) => immune.toLowerCase() === entry.toLowerCase())) : [], [selected]);

  useEffect(() => {
    setItemId("");
    setSpellId("");
    setCustomItemName("");
    setCondition("");
    setConfirmRemove(false);
    setDeleteRollHistory(false);
  }, [selected?.id]);

  function ownerName(character: CharacterData) {
    const owner = ownerByCharacterId.get(character.id);
    return owner ? memberById.get(owner)?.displayName ?? character.playerName : character.playerName;
  }

  function isOnline(character: CharacterData) {
    const owner = ownerByCharacterId.get(character.id);
    return Boolean(owner && onlineUserIds.has(owner));
  }

  function adjustHp(amount: number) {
    if (!selected) return;
    onPatch(selected.id, { currentHp: Math.max(0, Math.min(selected.maxHp, selected.currentHp + amount)) }, "adjust-current-resource");
  }

  function adjustResource(resourceId: string, amount: number) {
    if (!selected) return;
    onPatch(selected.id, { resources: selected.resources.map((resource) => resource.id === resourceId ? { ...resource, current: Math.max(0, Math.min(resource.maximum, resource.current + amount)) } : resource) }, "adjust-current-resource");
  }

  function adjustSlot(level: string, amount: number) {
    if (!selected) return;
    const slot = selected.spellSlots[level];
    if (!slot) return;
    onPatch(selected.id, { spellSlots: { ...selected.spellSlots, [level]: { ...slot, used: Math.max(0, Math.min(slot.maximum, slot.used + amount)) } } }, "adjust-current-resource");
  }

  function adjustHitDice(className: string | undefined, amount: number) {
    if (!selected) return;
    if (!selected.hitDiceByClass.length || !className) {
      onPatch(selected.id, { hitDiceUsed: Math.max(0, Math.min(selected.hitDiceTotal, selected.hitDiceUsed + amount)) }, "adjust-current-resource");
      return;
    }
    const hitDiceByClass = selected.hitDiceByClass.map((pool) => pool.className === className ? { ...pool, used: Math.max(0, Math.min(pool.total, pool.used + amount)) } : pool);
    onPatch(selected.id, { hitDiceByClass, hitDiceUsed: hitDiceByClass.reduce((total, pool) => total + pool.used, 0) }, "adjust-current-resource");
  }

  function adjustInventoryResource(itemId: string, field: "charges" | "ammunition", amount: number) {
    if (!selected) return;
    onPatch(selected.id, { inventory: selected.inventory.map((item) => {
      if (item.id !== itemId) return item;
      const maximum = field === "charges" ? item.maximumCharges ?? 0 : 9999;
      return { ...item, [field]: Math.max(0, Math.min(maximum, (item[field] ?? 0) + amount)) };
    }) }, "adjust-current-resource");
  }

  function updateInventoryItem(itemId: string, patch: Partial<InventoryItem>) {
    if (!selected) return;
    onPatch(selected.id, { inventory: patchDmInventoryItem(selected.inventory, itemId, patch) }, "adjust-current-resource");
  }

  function addItem() {
    if (!selected) return;
    const item = equipment.find((entry) => entry.id === itemId);
    if (!item) return;
    onPatch(selected.id, { inventory: [...selected.inventory, createDmCatalogItem(item, crypto.randomUUID())] }, "add-inventory-item");
    setItemId("");
  }

  function addCustomItem() {
    if (!selected || !customItemName.trim()) return;
    onPatch(selected.id, { inventory: [...selected.inventory, createDmCustomItem(customItemName, crypto.randomUUID())] }, "add-inventory-item");
    setCustomItemName("");
  }

  function addSpell() {
    if (!selected) return;
    const spell = spells.find((entry) => entry.id === spellId);
    if (!spell || selected.spells.some((entry) => entry.id === spell.id)) return;
    const className = selected.classLevels.find((entry) => spell.classes.some((allowed) => allowed.toLowerCase() === entry.className.toLowerCase()))?.className ?? selected.className;
    onPatch(selected.id, { spells: [...selected.spells, { ...spell, prepared: spell.level === 0, className }] }, "add-known-spell");
    setSpellId("");
  }

  function addCondition() {
    if (!selected || !condition) return;
    const patch = addDmConditionPatch(selected, condition);
    if (Object.keys(patch).length) onPatch(selected.id, patch, "adjust-condition");
    setCondition("");
  }

  function removeCondition(conditionName: string) {
    if (!selected) return;
    onPatch(selected.id, removeDmConditionPatch(selected, conditionName), "adjust-condition");
  }

  return <div className="dm-party-workspace">
    <section className="party-overview-panel panel"><div className="section-heading"><div><span className="eyebrow">Live campaign</span><h2>Party overview</h2></div><span className="count-chip">{characters.length} linked</span></div>
      <div className="party-card-grid">{characters.map((character) => {
        const encumbrance = calculateEncumbrance(character.inventory, character.abilities.strength);
        const armor = calculateArmorClass(character, equipment);
        const online = isOnline(character);
        const concentration = concentratingOn(character);
        return <button key={character.id} className={`party-card ${selected?.id === character.id ? "selected" : ""}`} onClick={() => onSelectCharacter(character.id)}>
          <div className="party-card-heading"><span className="party-card-avatar">{character.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><div><strong>{character.name}</strong><small>{ownerName(character) || "Player not set"} · Level {character.level} {character.className}</small></div><span className={`presence-pill ${online ? "online" : "offline"}`}><Radio size={10} />{online ? "Live" : "Offline"}</span></div>
          <div className="party-quick-stats"><span><Heart size={13} /><b>{character.currentHp}{character.temporaryHp ? `+${character.temporaryHp}` : ""}/{character.maxHp}</b> HP</span><span title={armor.source}><Shield size={13} /><b>{armor.value}</b> AC</span><span><Activity size={13} /><b>{character.speed}</b> ft.</span></div>
          <div className="party-card-detail"><div className="party-condition-view"><span>{character.conditions.length ? character.conditions.join(", ") : "No conditions"}</span>{concentration && <span className="party-concentration"><Sparkles size={10} />Concentrating: {concentration}</span>}</div><span>{encumbrance.level === "over-capacity" ? "Over capacity" : `${encumbrance.totalWeight.toFixed(1)} / ${encumbrance.carryingCapacity} lb.`}</span></div>
        </button>;
      })}</div>
      {!characters.length && <div className="empty-state"><Users size={26} /><p>No player characters are linked to this live campaign yet.</p></div>}
    </section>

    <div className="dm-party-columns">
      <section className="panel dm-character-controls"><div className="section-heading"><div><span className="eyebrow">DM controls</span><h2>{selected?.name ?? "Select a character"}</h2></div>{selected && <label className="dm-edit-toggle"><input type="checkbox" checked={fullEditCharacterId === selected.id} onChange={(event) => onToggleFullEdit(selected.id, event.target.checked)} /><span>Enable full editing</span></label>}</div>
        {selected && <>
          <div className="dm-resource-row"><span><Heart size={14} />Hit points</span><button onClick={() => adjustHp(-1)}><Minus size={13} /></button><strong>{selected.currentHp} / {selected.maxHp}</strong><button onClick={() => adjustHp(1)}><Plus size={13} /></button><button onClick={() => onPatch(selected.id, { currentHp: selected.maxHp }, "adjust-current-resource")}>Restore</button></div>
          <div className="dm-condition-controls"><div className="dm-control-section-heading"><Activity size={15} /><div><strong>Conditions</strong><small>Add or remove standard conditions without enabling full editing</small></div></div><div className="condition-add"><select aria-label="Condition to add" value={condition} onChange={(event) => setCondition(event.target.value)}><option value="">Add condition</option>{availableConditions.map((entry) => <option key={entry}>{entry}</option>)}</select><button aria-label="Add selected condition" disabled={!condition} onClick={addCondition}><Plus size={14} /></button></div><div className="condition-list">{selected.conditions.map((entry) => <button type="button" key={entry} onClick={() => removeCondition(entry)}>{entry === "Exhaustion" ? `${entry} ${selected.exhaustionLevel}` : entry} ×</button>)}{!selected.conditions.length && <small>No active conditions</small>}</div>{concentratingOn(selected) && <div className="dm-concentration-status"><Sparkles size={13} /><span>Concentrating on <strong>{concentratingOn(selected)}</strong></span></div>}</div>
          {Object.entries(selected.spellSlots).filter(([, slot]) => slot.maximum > 0).map(([level, slot]) => <div className="dm-resource-row" key={level}><span><Sparkles size={14} />Level {level} slots</span><button onClick={() => adjustSlot(level, 1)} disabled={slot.used >= slot.maximum}><Minus size={13} /></button><strong>{slot.maximum - slot.used} / {slot.maximum}</strong><button onClick={() => adjustSlot(level, -1)} disabled={slot.used <= 0}><Plus size={13} /></button><button onClick={() => onPatch(selected.id, { spellSlots: { ...selected.spellSlots, [level]: { ...slot, used: 0 } } }, "adjust-current-resource")}>Restore</button></div>)}
          {selected.resources.map((resource) => <div className="dm-resource-row" key={resource.id}><span><Activity size={14} />{resource.name}</span><button onClick={() => adjustResource(resource.id, -1)} disabled={resource.current <= 0}><Minus size={13} /></button><strong>{resource.current} / {resource.maximum}</strong><button onClick={() => adjustResource(resource.id, 1)} disabled={resource.current >= resource.maximum}><Plus size={13} /></button><button onClick={() => onPatch(selected.id, { resources: selected.resources.map((entry) => entry.id === resource.id ? { ...entry, current: entry.maximum } : entry) }, "adjust-current-resource")}>Restore</button></div>)}
          {(selected.hitDiceByClass.length ? selected.hitDiceByClass : [{ className: undefined, total: selected.hitDiceTotal, used: selected.hitDiceUsed }]).map((pool) => <div className="dm-resource-row" key={pool.className ?? "hit-dice"}><span><Activity size={14} />{pool.className ? `${pool.className} Hit Dice` : "Hit Dice"}</span><button onClick={() => adjustHitDice(pool.className, 1)} disabled={pool.used >= pool.total}><Minus size={13} /></button><strong>{pool.total - pool.used} / {pool.total}</strong><button onClick={() => adjustHitDice(pool.className, -1)} disabled={pool.used <= 0}><Plus size={13} /></button><button onClick={() => adjustHitDice(pool.className, -pool.used)} disabled={pool.used <= 0}>Restore</button></div>)}
          {selected.inventory.filter((item) => item.maximumCharges !== undefined).map((item) => <div className="dm-resource-row" key={`${item.id}-charges`}><span><Backpack size={14} />{item.name} charges</span><button onClick={() => adjustInventoryResource(item.id, "charges", -1)} disabled={(item.charges ?? 0) <= 0}><Minus size={13} /></button><strong>{item.charges ?? 0} / {item.maximumCharges}</strong><button onClick={() => adjustInventoryResource(item.id, "charges", 1)} disabled={(item.charges ?? 0) >= (item.maximumCharges ?? 0)}><Plus size={13} /></button><button onClick={() => updateInventoryItem(item.id, { charges: item.maximumCharges })} disabled={(item.charges ?? 0) >= (item.maximumCharges ?? 0)}>Restore</button></div>)}
          <CollapsiblePanel contained className="dm-control-section" storageKey={`azeroth-panel-dm-${selected.id}-equipment`} eyebrow="Inventory controls" title={<span className="dm-collapsible-title"><Backpack size={15} />Equipment</span>} summary={<span>{selected.inventory.length} carried</span>}>
            <div className="dm-add-row"><DescriptionPicker ariaLabel="Available equipment" value={itemId} placeholder="Choose imported equipment" onChange={setItemId} options={equipment.map((item) => ({ value: item.id, label: item.name, meta: [item.category, item.cost, item.weight].filter(Boolean).join(" · "), description: equipmentDescription(item) }))} /><button className="button button-outline" disabled={!itemId} onClick={addItem}>Add</button></div>
            <div className="dm-custom-item-row"><input aria-label="Custom item name" value={customItemName} onChange={(event) => setCustomItemName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addCustomItem(); }} placeholder="Add a custom item" /><button className="button button-outline" disabled={!customItemName.trim()} onClick={addCustomItem}><Plus size={14} />Add</button></div>
            <div className="dm-inventory-list">{selected.inventory.map((item) => <div className="dm-inventory-row" key={item.id}><div><strong>{item.name}</strong><small>{[item.category, item.weight, item.cost].filter(Boolean).join(" · ") || "Custom equipment"}</small></div><label><span>Qty</span><input aria-label={`${item.name} quantity`} type="number" min="0" value={item.quantity} onChange={(event) => updateInventoryItem(item.id, { quantity: Number(event.target.value) })} /></label><label><span>Ammo</span><input aria-label={`${item.name} ammunition`} type="number" min="0" value={item.ammunition ?? ""} onChange={(event) => updateInventoryItem(item.id, { ammunition: event.target.value === "" ? undefined : Number(event.target.value) })} placeholder="—" /></label></div>)}</div>
            {!selected.inventory.length && <div className="empty-state compact">No equipment carried.</div>}
          </CollapsiblePanel>
          <CollapsiblePanel contained className="dm-control-section" storageKey={`azeroth-panel-dm-${selected.id}-spells`} eyebrow="Spell controls" title={<span className="dm-collapsible-title"><BookOpen size={15} />Spells</span>} summary={<span>{selected.spells.length} known · {selected.spells.filter((spell) => spell.prepared).length} prepared</span>}>
            <div className="dm-add-row"><DescriptionPicker ariaLabel="Available spells" value={spellId} placeholder="Choose a known spell" onChange={setSpellId} options={availableSpells.map((spell) => ({ value: spell.id, label: spell.name, meta: `${spell.level ? `Level ${spell.level}` : "Cantrip"} · ${spell.school} · ${spell.classes.join(", ")}`, description: [`Casting time: ${spell.castingTime}`, `Range: ${spell.range}`, `Components: ${spell.components}`, `Duration: ${spell.duration}`, spell.description].join("\n") }))} /><button className="button button-outline" disabled={!spellId} onClick={addSpell}>Add</button></div>
            <div className="dm-known-spell-list">{knownSpells.map((spell) => <details key={spell.id} className={spell.prepared ? "prepared" : ""}><summary><div><strong>{spell.name}</strong><small>{spell.level ? `Level ${spell.level} ${spell.school}` : `${spell.school} cantrip`}{spell.className ? ` · ${spell.className}` : spell.sourceFeatId ? " · Feat-granted" : ""}</small></div><span>{spell.level === 0 ? "Cantrip" : spell.prepared ? "Prepared" : "Not prepared"}</span></summary><div className="dm-known-spell-details"><div className="spell-meta"><span>{spell.castingTime}</span><span>{spell.range}</span><span>{spell.duration}</span>{spell.components && <span>{spell.components}</span>}{spell.ritual && <span>Ritual</span>}</div><p>{spell.description}</p></div></details>)}</div>
            {!knownSpells.length && <div className="empty-state compact">No known spells.</div>}
          </CollapsiblePanel>
          <button className="button button-primary dm-open-sheet" onClick={() => onOpenSheet(selected.id)}>Open live character sheet</button>
          {!confirmRemove && <button className="button button-quiet dm-remove-character" onClick={() => setConfirmRemove(true)}><UserMinus size={14} />Remove from campaign</button>}
          {confirmRemove && <div className="dm-remove-confirm"><div><strong>Remove {selected.name} from this campaign?</strong><p>The player keeps their local sheet. This device also keeps its cached copy until you delete it normally.</p></div><label className="sync-history-choice"><input type="checkbox" checked={deleteRollHistory} onChange={(event) => setDeleteRollHistory(event.target.checked)} /><span><strong>Delete shared roll history</strong><small>Leave unchecked to keep this character’s previous rolls in party history.</small></span></label><div className="sync-confirm-actions"><button className="button button-quiet" disabled={removing} onClick={() => setConfirmRemove(false)}>Cancel</button><button className="button button-danger" disabled={removing} onClick={async () => { setRemoving(true); try { await onRemoveCharacter(selected.id, deleteRollHistory); setConfirmRemove(false); } finally { setRemoving(false); } }}><UserMinus size={14} />{removing ? "Removing…" : "Confirm removal"}</button></div></div>}
        </>}
      </section>

      <PartyRollWorkspace rolls={rolls} roller="dm" storageKey="azeroth-panel-dm-party-rolls" disabled={!selected} allowHidden onRoll={(roll) => { if (selected) onRoll(selected.id, { ...roll, detail: `${roll.detail} for ${selected.name}` }); }} onClearRolls={onClearRolls} />
    </div>
  </div>;
}
