import { useMemo, useState } from "react";
import { Activity, Backpack, BookOpen, Heart, Minus, Plus, Radio, Shield, Sparkles, Users } from "lucide-react";
import { calculateEncumbrance } from "../lib/character-rules";
import type { CharacterData, EquipmentDefinition, LiveCampaignMember, SharedRollEvent, SpellDefinition } from "../lib/types";

type DmIntent = "add-inventory-item" | "add-known-spell" | "adjust-current-resource";

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
};

export function DmPartyWorkspace({ characters, members, rolls, onlineUserIds, ownerByCharacterId, selectedCharacterId, fullEditCharacterId, equipment, spells, onSelectCharacter, onToggleFullEdit, onOpenSheet, onPatch }: Props) {
  const selected = characters.find((entry) => entry.id === selectedCharacterId) ?? characters[0];
  const [itemId, setItemId] = useState("");
  const [spellId, setSpellId] = useState("");
  const memberById = useMemo(() => new Map(members.map((member) => [member.userId, member])), [members]);

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

  function addItem() {
    if (!selected) return;
    const item = equipment.find((entry) => entry.id === itemId);
    if (!item) return;
    onPatch(selected.id, { inventory: [...selected.inventory, { id: crypto.randomUUID(), contentId: item.id, name: item.name, category: item.category, quantity: 1, equipped: false, notes: "", weight: item.weight, cost: item.cost, equipmentSlot: "none" }] }, "add-inventory-item");
    setItemId("");
  }

  function addSpell() {
    if (!selected) return;
    const spell = spells.find((entry) => entry.id === spellId);
    if (!spell || selected.spells.some((entry) => entry.id === spell.id)) return;
    const className = selected.classLevels.find((entry) => spell.classes.some((allowed) => allowed.toLowerCase() === entry.className.toLowerCase()))?.className ?? selected.className;
    onPatch(selected.id, { spells: [...selected.spells, { ...spell, prepared: spell.level === 0, className }] }, "add-known-spell");
    setSpellId("");
  }

  return <div className="dm-party-workspace">
    <section className="party-overview-panel panel"><div className="section-heading"><div><span className="eyebrow">Live campaign</span><h2>Party overview</h2></div><span className="count-chip">{characters.length} linked</span></div>
      <div className="party-card-grid">{characters.map((character) => {
        const encumbrance = calculateEncumbrance(character.inventory, character.abilities.strength);
        const online = isOnline(character);
        return <button key={character.id} className={`party-card ${selected?.id === character.id ? "selected" : ""}`} onClick={() => onSelectCharacter(character.id)}>
          <div className="party-card-heading"><span className="party-card-avatar">{character.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><div><strong>{character.name}</strong><small>{ownerName(character) || "Player not set"} · Level {character.level} {character.className}</small></div><span className={`presence-pill ${online ? "online" : "offline"}`}><Radio size={10} />{online ? "Live" : "Offline"}</span></div>
          <div className="party-quick-stats"><span><Heart size={13} /><b>{character.currentHp}{character.temporaryHp ? `+${character.temporaryHp}` : ""}/{character.maxHp}</b> HP</span><span><Shield size={13} /><b>{character.armorClass}</b> AC</span><span><Activity size={13} /><b>{character.speed}</b> ft.</span></div>
          <div className="party-card-detail"><span>{character.conditions.length ? character.conditions.join(", ") : "No conditions"}</span><span>{encumbrance.level === "over-capacity" ? "Over capacity" : `${encumbrance.totalWeight.toFixed(1)} / ${encumbrance.carryingCapacity} lb.`}</span></div>
        </button>;
      })}</div>
      {!characters.length && <div className="empty-state"><Users size={26} /><p>No player characters are linked to this live campaign yet.</p></div>}
    </section>

    <div className="dm-party-columns">
      <section className="panel dm-character-controls"><div className="section-heading"><div><span className="eyebrow">DM controls</span><h2>{selected?.name ?? "Select a character"}</h2></div>{selected && <label className="dm-edit-toggle"><input type="checkbox" checked={fullEditCharacterId === selected.id} onChange={(event) => onToggleFullEdit(selected.id, event.target.checked)} /><span>Enable full editing</span></label>}</div>
        {selected && <>
          <div className="dm-resource-row"><span><Heart size={14} />Hit points</span><button onClick={() => adjustHp(-1)}><Minus size={13} /></button><strong>{selected.currentHp} / {selected.maxHp}</strong><button onClick={() => adjustHp(1)}><Plus size={13} /></button><button onClick={() => onPatch(selected.id, { currentHp: selected.maxHp }, "adjust-current-resource")}>Restore</button></div>
          {Object.entries(selected.spellSlots).filter(([, slot]) => slot.maximum > 0).map(([level, slot]) => <div className="dm-resource-row" key={level}><span><Sparkles size={14} />Level {level} slots</span><button onClick={() => adjustSlot(level, 1)} disabled={slot.used >= slot.maximum}><Minus size={13} /></button><strong>{slot.maximum - slot.used} / {slot.maximum}</strong><button onClick={() => adjustSlot(level, -1)} disabled={slot.used <= 0}><Plus size={13} /></button><button onClick={() => onPatch(selected.id, { spellSlots: { ...selected.spellSlots, [level]: { ...slot, used: 0 } } }, "adjust-current-resource")}>Restore</button></div>)}
          {selected.resources.map((resource) => <div className="dm-resource-row" key={resource.id}><span><Activity size={14} />{resource.name}</span><button onClick={() => adjustResource(resource.id, -1)} disabled={resource.current <= 0}><Minus size={13} /></button><strong>{resource.current} / {resource.maximum}</strong><button onClick={() => adjustResource(resource.id, 1)} disabled={resource.current >= resource.maximum}><Plus size={13} /></button><button onClick={() => onPatch(selected.id, { resources: selected.resources.map((entry) => entry.id === resource.id ? { ...entry, current: entry.maximum } : entry) }, "adjust-current-resource")}>Restore</button></div>)}
          {(selected.hitDiceByClass.length ? selected.hitDiceByClass : [{ className: undefined, total: selected.hitDiceTotal, used: selected.hitDiceUsed }]).map((pool) => <div className="dm-resource-row" key={pool.className ?? "hit-dice"}><span><Activity size={14} />{pool.className ? `${pool.className} Hit Dice` : "Hit Dice"}</span><button onClick={() => adjustHitDice(pool.className, 1)} disabled={pool.used >= pool.total}><Minus size={13} /></button><strong>{pool.total - pool.used} / {pool.total}</strong><button onClick={() => adjustHitDice(pool.className, -1)} disabled={pool.used <= 0}><Plus size={13} /></button><button onClick={() => adjustHitDice(pool.className, -pool.used)} disabled={pool.used <= 0}>Restore</button></div>)}
          {selected.inventory.flatMap((item) => [
            ...(item.maximumCharges !== undefined ? [{ itemId: item.id, field: "charges" as const, label: `${item.name} charges`, current: item.charges ?? 0, maximum: item.maximumCharges }] : []),
            ...(item.ammunition !== undefined ? [{ itemId: item.id, field: "ammunition" as const, label: `${item.name} ammunition`, current: item.ammunition, maximum: undefined }] : []),
          ]).map((resource) => <div className="dm-resource-row" key={`${resource.itemId}-${resource.field}`}><span><Backpack size={14} />{resource.label}</span><button onClick={() => adjustInventoryResource(resource.itemId, resource.field, -1)} disabled={resource.current <= 0}><Minus size={13} /></button><strong>{resource.maximum === undefined ? resource.current : `${resource.current} / ${resource.maximum}`}</strong><button onClick={() => adjustInventoryResource(resource.itemId, resource.field, 1)} disabled={resource.maximum !== undefined && resource.current >= resource.maximum}><Plus size={13} /></button>{resource.maximum === undefined ? <span className="dm-resource-no-maximum">No maximum set</span> : <button onClick={() => adjustInventoryResource(resource.itemId, resource.field, resource.maximum - resource.current)} disabled={resource.current >= resource.maximum}>Restore</button>}</div>)}
          <div className="dm-add-row"><Backpack size={15} /><select value={itemId} onChange={(event) => setItemId(event.target.value)}><option value="">Add equipment…</option>{equipment.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="button button-outline" disabled={!itemId} onClick={addItem}>Add</button></div>
          <div className="dm-add-row"><BookOpen size={15} /><select value={spellId} onChange={(event) => setSpellId(event.target.value)}><option value="">Add known spell…</option>{spells.filter((spell) => !selected.spells.some((known) => known.id === spell.id)).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)).map((spell) => <option key={spell.id} value={spell.id}>{spell.level ? `Level ${spell.level}` : "Cantrip"} · {spell.name}</option>)}</select><button className="button button-outline" disabled={!spellId} onClick={addSpell}>Add</button></div>
          <button className="button button-primary dm-open-sheet" onClick={() => onOpenSheet(selected.id)}>Open live character sheet</button>
        </>}
      </section>

      <section className="panel roll-feed"><div className="section-heading"><div><span className="eyebrow">Last 30 days</span><h2>Party rolls</h2></div><span className="count-chip">{rolls.length}</span></div>
        <div className="roll-feed-list">{rolls.map((roll) => <article key={roll.id}><div><strong>{roll.actorName}</strong><span>{roll.label}</span><time>{new Date(roll.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></div><div className="roll-feed-result"><b>{roll.total}</b><small>{roll.dice.join(" / ")}{roll.modifier ? ` ${roll.modifier >= 0 ? "+" : "−"}${Math.abs(roll.modifier)}` : ""}{roll.mode !== "normal" ? ` · ${roll.mode}` : ""}</small></div></article>)}</div>
        {!rolls.length && <div className="empty-state"><Activity size={24} /><p>Player rolls will appear here as they happen.</p></div>}
      </section>
    </div>
  </div>;
}
