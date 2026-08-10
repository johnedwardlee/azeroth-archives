import { useMemo, useState } from "react";
import { ChevronDown, Heart, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { DescriptionPicker } from "./description-picker";
import type {
  CharacterData,
  EquipmentDefinition,
  FeatDefinition,
  InventoryItem,
  SpellDefinition,
  SpellSlotState,
} from "../lib/types";

type PatchCharacter = (patch: Partial<CharacterData>) => void;

const CONDITIONS = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Exhaustion",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum));
}

function equipmentDescription(item: EquipmentDefinition) {
  return [
    item.description,
    item.damage ? `Damage: ${item.damage}${item.damageType ? ` ${item.damageType}` : ""}` : "",
    item.properties?.length ? `Properties: ${item.properties.join(", ")}` : "",
    item.mastery ? `Mastery: ${item.mastery}` : "",
  ].filter(Boolean).join("\n\n");
}

export function SessionTracker({ character, patchCharacter }: { character: CharacterData; patchCharacter: PatchCharacter }) {
  const [hpAmount, setHpAmount] = useState(1);
  const [condition, setCondition] = useState("");

  function takeDamage() {
    const amount = Math.max(0, hpAmount || 0);
    const absorbed = Math.min(character.temporaryHp, amount);
    patchCharacter({
      temporaryHp: character.temporaryHp - absorbed,
      currentHp: Math.max(0, character.currentHp - (amount - absorbed)),
    });
  }

  function heal() {
    patchCharacter({ currentHp: Math.min(character.maxHp, character.currentHp + Math.max(0, hpAmount || 0)) });
  }

  function longRest() {
    const recoveredHitDice = Math.max(1, Math.ceil(character.hitDiceTotal / 2));
    patchCharacter({
      currentHp: character.maxHp,
      temporaryHp: 0,
      hitDiceUsed: Math.max(0, character.hitDiceUsed - recoveredHitDice),
      deathSaveSuccesses: 0,
      deathSaveFailures: 0,
      spellSlots: Object.fromEntries(
        Object.entries(character.spellSlots).map(([level, slot]) => [level, { ...slot, used: 0 }]),
      ),
    });
  }

  function toggleDeathSave(kind: "success" | "failure", index: number) {
    const key = kind === "success" ? "deathSaveSuccesses" : "deathSaveFailures";
    const current = character[key];
    patchCharacter({ [key]: current === index + 1 ? index : index + 1 });
  }

  function addCondition() {
    if (!condition || character.conditions.includes(condition)) return;
    patchCharacter({ conditions: [...character.conditions, condition] });
    setCondition("");
  }

  return (
    <section className="panel session-panel">
      <div className="section-heading">
        <div><span className="eyebrow">During play</span><h2>Session tracker</h2></div>
        <button className="button button-outline" onClick={longRest}>Long rest</button>
      </div>
      <div className="session-grid">
        <div className="session-block hp-controls">
          <span className="field-label"><Heart size={14} />Damage & healing</span>
          <div className="stepper-row">
            <input aria-label="Hit point change" type="number" min="0" value={hpAmount} onChange={(event) => setHpAmount(Number(event.target.value))} />
            <button className="button damage-button" onClick={takeDamage}>Damage</button>
            <button className="button heal-button" onClick={heal}>Heal</button>
          </div>
          <label className="compact-field"><span>Temporary HP</span><input type="number" min="0" value={character.temporaryHp} onChange={(event) => patchCharacter({ temporaryHp: Math.max(0, Number(event.target.value)) })} /></label>
        </div>

        <div className="session-block">
          <span className="field-label">Death saves</span>
          <div className="death-save-row"><small>Successes</small>{[0, 1, 2].map((index) => <button key={index} aria-label={`Death save success ${index + 1}`} className={index < character.deathSaveSuccesses ? "marked success" : ""} onClick={() => toggleDeathSave("success", index)} />)}</div>
          <div className="death-save-row"><small>Failures</small>{[0, 1, 2].map((index) => <button key={index} aria-label={`Death save failure ${index + 1}`} className={index < character.deathSaveFailures ? "marked failure" : ""} onClick={() => toggleDeathSave("failure", index)} />)}</div>
        </div>

        <div className="session-block">
          <span className="field-label">Hit dice</span>
          <div className="resource-number"><strong>{character.hitDiceTotal - character.hitDiceUsed}</strong><span>/ {character.hitDiceTotal} remaining</span></div>
          <div className="mini-actions">
            <button onClick={() => patchCharacter({ hitDiceUsed: Math.min(character.hitDiceTotal, character.hitDiceUsed + 1) })}>Use</button>
            <button onClick={() => patchCharacter({ hitDiceUsed: Math.max(0, character.hitDiceUsed - 1) })}>Recover</button>
            <label>Total <input aria-label="Total hit dice" type="number" min="1" max="20" value={character.hitDiceTotal} onChange={(event) => patchCharacter({ hitDiceTotal: clamp(Number(event.target.value), 1, 20), hitDiceUsed: Math.min(character.hitDiceUsed, Number(event.target.value)) })} /></label>
          </div>
        </div>

        <div className="session-block">
          <span className="field-label">Inspiration & conditions</span>
          <button className={`inspiration-toggle ${character.inspiration ? "active" : ""}`} onClick={() => patchCharacter({ inspiration: !character.inspiration })}><Sparkles size={15} />{character.inspiration ? "Inspired" : "Mark inspiration"}</button>
          <div className="condition-add"><select value={condition} onChange={(event) => setCondition(event.target.value)}><option value="">Add condition</option>{CONDITIONS.filter((item) => !character.conditions.includes(item)).map((item) => <option key={item}>{item}</option>)}</select><button onClick={addCondition}><Plus size={14} /></button></div>
          <div className="condition-list">{character.conditions.map((item) => <button key={item} onClick={() => patchCharacter({ conditions: character.conditions.filter((value) => value !== item) })}>{item} ×</button>)}</div>
        </div>
      </div>
    </section>
  );
}

export function FeatManager({ catalog, character, patchCharacter }: { catalog: FeatDefinition[]; character: CharacterData; patchCharacter: PatchCharacter }) {
  const [selectedId, setSelectedId] = useState("");
  const catalogById = useMemo(() => new Map(catalog.map((feat) => [feat.id, feat])), [catalog]);
  const available = catalog.filter((feat) => !character.feats.some((item) => item.id === feat.id));
  const visibleFeats = character.feats.map((feat) => catalogById.get(feat.id) ?? feat);

  function addFeat() {
    const feat = catalog.find((item) => item.id === selectedId);
    if (!feat) return;
    patchCharacter({ feats: [...character.feats, feat] });
    setSelectedId("");
  }

  return (
    <section className="panel wide-panel tracker-panel">
      <div className="section-heading"><div><span className="eyebrow">Character choices</span><h2>Feats</h2></div><span className="count-chip">{character.feats.length}</span></div>
      <div className="catalog-add-row"><DescriptionPicker ariaLabel="Available feats" value={selectedId} placeholder="Choose an available feat" onChange={setSelectedId} options={available.map((feat) => ({ value: feat.id, label: feat.name, meta: [feat.category, feat.prerequisite].filter(Boolean).join(" · "), description: feat.description }))} /><button className="button button-primary" disabled={!selectedId} onClick={addFeat}><Plus size={15} />Add feat</button></div>
      <div className="tracker-card-list">
        {visibleFeats.map((feat) => <article key={feat.id}><div><span>{feat.category}</span><h3>{feat.name}</h3>{feat.prerequisite && <small>{feat.prerequisite}</small>}<p>{feat.description}</p></div><button className="icon-button danger" aria-label={`Remove ${feat.name}`} onClick={() => patchCharacter({ feats: character.feats.filter((item) => item.id !== feat.id) })}><Trash2 size={14} /></button></article>)}
        {!character.feats.length && <div className="empty-state compact">No feats selected yet.</div>}
      </div>
    </section>
  );
}

export function SpellbookManager({ catalog, character, patchCharacter }: { catalog: SpellDefinition[]; character: CharacterData; patchCharacter: PatchCharacter }) {
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const catalogById = useMemo(() => new Map(catalog.map((spell) => [spell.id, spell])), [catalog]);
  const classCatalog = useMemo(() => catalog.filter((spell) => showAll || spell.classes.some((name) => name.toLowerCase() === character.className.toLowerCase())), [catalog, showAll, character.className]);
  const available = classCatalog
    .filter((spell) => !character.spells.some((known) => known.id === spell.id))
    .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
  const visibleSpells = character.spells
    .map((spell) => {
      const currentDefinition = catalogById.get(spell.id);
      return currentDefinition ? { ...spell, ...currentDefinition, prepared: spell.prepared } : spell;
    })
    .filter((spell) => spell.name.toLowerCase().includes(query.toLowerCase()));

  function addSpell() {
    const spell = catalog.find((item) => item.id === selectedId);
    if (!spell) return;
    patchCharacter({ spells: [...character.spells, { ...spell, prepared: spell.level === 0 }] });
    setSelectedId("");
  }

  function updateSlot(level: number, patch: Partial<SpellSlotState>) {
    const current = character.spellSlots[String(level)] ?? { maximum: 0, used: 0 };
    const maximum = clamp(patch.maximum ?? current.maximum, 0, 20);
    const used = clamp(patch.used ?? current.used, 0, maximum);
    patchCharacter({ spellSlots: { ...character.spellSlots, [String(level)]: { maximum, used } } });
  }

  return (
    <div className="living-tab-grid spellbook-layout">
      <section className="panel slot-panel">
        <div className="section-heading"><div><span className="eyebrow">Daily resources</span><h2>Spell slots</h2></div><button className="text-button" onClick={() => patchCharacter({ spellSlots: Object.fromEntries(Object.entries(character.spellSlots).map(([level, slot]) => [level, { ...slot, used: 0 }])) })}>Restore all</button></div>
        <div className="slot-grid">{Array.from({ length: 9 }, (_, index) => index + 1).map((level) => { const slot = character.spellSlots[String(level)] ?? { maximum: 0, used: 0 }; return <div className="slot-row" key={level}><strong>{level}</strong><label>Max <input aria-label={`Level ${level} maximum spell slots`} type="number" min="0" max="20" value={slot.maximum} onChange={(event) => updateSlot(level, { maximum: Number(event.target.value) })} /></label><span>{slot.maximum - slot.used} left</span><button disabled={slot.used <= 0} onClick={() => updateSlot(level, { used: slot.used - 1 })}>−</button><button disabled={slot.used >= slot.maximum} onClick={() => updateSlot(level, { used: slot.used + 1 })}>Use</button></div>; })}</div>
      </section>

      <section className="panel spell-list-panel">
        <div className="section-heading"><div><span className="eyebrow">Known magic</span><h2>Spellbook</h2></div><span className="count-chip">{character.spells.length}</span></div>
        <div className="catalog-add-row spell-add"><DescriptionPicker ariaLabel="Available spells" value={selectedId} placeholder="Choose a spell" onChange={setSelectedId} options={available.map((spell) => ({ value: spell.id, label: spell.name, meta: `${spell.level ? `Level ${spell.level}` : "Cantrip"} · ${spell.school} · ${spell.classes.join(", ")}`, description: `${spell.castingTime} · ${spell.range} · ${spell.duration}\n\n${spell.description}` }))} /><button className="button button-primary" disabled={!selectedId} onClick={addSpell}><Plus size={15} />Learn</button><label className="inline-check"><input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} />All classes</label></div>
        <label className="catalog-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search known spells" /></label>
        <div className="spell-card-list">{visibleSpells.map((spell) => <article key={spell.id} className={spell.prepared ? "prepared" : ""}><div className="spell-card-top"><div><span>{spell.level ? `Level ${spell.level} ${spell.school}` : `${spell.school} cantrip`}</span><h3>{spell.name}</h3></div><label><input type="checkbox" checked={spell.prepared} onChange={(event) => patchCharacter({ spells: character.spells.map((item) => item.id === spell.id ? { ...item, prepared: event.target.checked } : item) })} />Prepared</label><button className="icon-button danger" aria-label={`Forget ${spell.name}`} onClick={() => patchCharacter({ spells: character.spells.filter((item) => item.id !== spell.id) })}><Trash2 size={14} /></button></div><div className="spell-meta"><span>{spell.castingTime}</span><span>{spell.range}</span><span>{spell.duration}</span></div><p>{spell.description}</p></article>)}</div>
        {!visibleSpells.length && <div className="empty-state compact">No spells here yet. Learn one from the imported content library.</div>}
      </section>
    </div>
  );
}

export function InventoryManager({ catalog, character, patchCharacter }: { catalog: EquipmentDefinition[]; character: CharacterData; patchCharacter: PatchCharacter }) {
  const [selectedId, setSelectedId] = useState("");
  const [customName, setCustomName] = useState("");
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const catalogById = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);
  const visibleInventory = character.inventory.map((item) => {
    const definition = item.contentId ? catalogById.get(item.contentId) : undefined;
    const hasGeneratedNotes = /consult the linked source|Reference entry/i.test(item.notes);
    const rulesDescription = definition ? equipmentDescription(definition) : "";
    const notesContainImportedDescription = Boolean(definition) && (item.notes === definition?.description || item.notes === rulesDescription);
    return definition
      ? {
          ...item,
          name: definition.name,
          category: definition.category,
          cost: definition.cost,
          weight: definition.weight,
          notes: hasGeneratedNotes || notesContainImportedDescription ? "" : item.notes,
          rulesDescription,
        }
      : { ...item, rulesDescription: "" };
  });
  const totalWeight = visibleInventory.reduce((total, item) => total + (Number.parseFloat(item.weight ?? "0") || 0) * item.quantity, 0);

  function addCatalogItem() {
    const definition = catalog.find((item) => item.id === selectedId);
    if (!definition) return;
    const existing = character.inventory.find((item) => item.contentId === definition.id);
    if (existing) {
      patchCharacter({ inventory: character.inventory.map((item) => item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item) });
    } else {
      const itemId = crypto.randomUUID();
      patchCharacter({ inventory: [...character.inventory, { id: itemId, contentId: definition.id, name: definition.name, category: definition.category, quantity: 1, equipped: false, notes: "", weight: definition.weight, cost: definition.cost }] });
      setExpandedIds((current) => [...current, itemId]);
    }
    setSelectedId("");
  }

  function addCustomItem() {
    const name = customName.trim();
    if (!name) return;
    const item: InventoryItem = { id: crypto.randomUUID(), name, category: "Custom", quantity: 1, equipped: false, notes: "" };
    patchCharacter({ inventory: [...character.inventory, item] });
    setCustomName("");
  }

  function updateItem(id: string, patch: Partial<InventoryItem>) {
    patchCharacter({ inventory: character.inventory.map((item) => item.id === id ? { ...item, ...patch } : item) });
  }

  function toggleItem(id: string) {
    setExpandedIds((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]);
  }

  return (
    <div className="living-tab-grid inventory-layout">
      <section className="panel currency-panel">
        <div className="section-heading"><div><span className="eyebrow">Carried wealth</span><h2>Currency</h2></div></div>
        <div className="currency-grid">{(["gold", "silver", "copper"] as const).map((coin) => <label key={coin}><span>{coin}</span><input type="number" min="0" value={character.currency[coin]} onChange={(event) => patchCharacter({ currency: { ...character.currency, [coin]: Math.max(0, Number(event.target.value)) } })} /></label>)}</div>
        <div className="carry-summary"><strong>{character.inventory.reduce((total, item) => total + item.quantity, 0)}</strong><span>items carried</span><strong>{totalWeight.toFixed(1)}</strong><span>lb. listed weight</span></div>
      </section>

      <section className="panel inventory-panel">
        <div className="section-heading"><div><span className="eyebrow">Possessions</span><h2>Equipment & inventory</h2></div><span className="count-chip">{character.inventory.length}</span></div>
        <div className="catalog-add-row"><DescriptionPicker ariaLabel="Available equipment" value={selectedId} placeholder="Choose imported equipment" onChange={setSelectedId} options={catalog.map((item) => ({ value: item.id, label: item.name, meta: [item.category, item.cost, item.weight].filter(Boolean).join(" · "), description: equipmentDescription(item) }))} /><button className="button button-primary" disabled={!selectedId} onClick={addCatalogItem}><Plus size={15} />Add</button></div>
        <div className="custom-item-row"><input value={customName} onChange={(event) => setCustomName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addCustomItem(); }} placeholder="Add a custom item" /><button onClick={addCustomItem}><Plus size={15} /></button></div>
        <div className="inventory-list">
          {visibleInventory.map((item) => {
            const expanded = expandedIds.includes(item.id);
            const preview = item.rulesDescription || item.notes || "No description or notes yet.";
            return (
              <article key={item.id} className={`${item.equipped ? "equipped " : ""}${expanded ? "expanded" : ""}`}>
                <label className="equip-check"><input type="checkbox" checked={item.equipped} onChange={(event) => updateItem(item.id, { equipped: event.target.checked })} /><span>Equipped</span></label>
                <div className="inventory-name"><h3>{item.name}</h3><span>{item.category}{item.cost ? ` · ${item.cost}` : ""}{item.weight ? ` · ${item.weight}` : ""}</span><p className="inventory-description-preview">{preview}</p></div>
                <label className="quantity-field">Qty <input aria-label={`${item.name} quantity`} type="number" min="0" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: Math.max(0, Number(event.target.value)) })} /></label>
                <button className="inventory-expand" aria-label={`${expanded ? "Hide" : "Show"} details for ${item.name}`} aria-expanded={expanded} onClick={() => toggleItem(item.id)}><span>{expanded ? "Hide" : "Details"}</span><ChevronDown size={15} /></button>
                <button className="icon-button danger" aria-label={`Remove ${item.name}`} onClick={() => patchCharacter({ inventory: character.inventory.filter((value) => value.id !== item.id) })}><Trash2 size={14} /></button>
                {expanded && <div className="inventory-details">
                  {item.rulesDescription && <div className="inventory-rules"><span>Rules description</span><p>{item.rulesDescription}</p></div>}
                  <label><span>Notes</span><textarea aria-label={`${item.name} notes`} value={item.notes} onChange={(event) => updateItem(item.id, { notes: event.target.value })} placeholder="Add personal notes, charges, or other details" rows={4} /></label>
                </div>}
              </article>
            );
          })}
        </div>
        {!character.inventory.length && <div className="empty-state compact">Your inventory is empty.</div>}
      </section>
    </div>
  );
}
