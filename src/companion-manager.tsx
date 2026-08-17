import { Heart, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { CharacterData, CompanionKind, CreatureDefinition, TrackedCompanion } from "../lib/types";
import { DescriptionPicker } from "./description-picker";
import { CollapsiblePanel } from "./collapsible-panel";

export function CompanionManager({ catalog, character, patchCharacter }: { catalog: CreatureDefinition[]; character: CharacterData; patchCharacter: (patch: Partial<CharacterData>) => void }) {
  const [selectedId, setSelectedId] = useState("");
  const [customName, setCustomName] = useState("");
  const available = useMemo(() => catalog.filter((creature) => !character.companions.some((tracked) => tracked.contentId === creature.id)), [catalog, character.companions]);
  const update = (id: string, patch: Partial<TrackedCompanion>) => patchCharacter({ companions: character.companions.map((item) => item.id === id ? { ...item, ...patch } : item) });
  const add = (creature?: CreatureDefinition) => {
    const name = creature?.name ?? customName.trim();
    if (!name) return;
    patchCharacter({ companions: [...character.companions, {
      id: crypto.randomUUID(), contentId: creature?.id, name, kind: "companion", active: true,
      currentHp: 1, maxHp: 1, armorClass: 10, speed: "30 ft.", challengeRating: creature?.challengeRating,
      description: creature?.description ?? "", notes: "", source: creature?.source,
    }] });
    setSelectedId(""); setCustomName("");
  };
  return <div className="companion-layout">
    <CollapsiblePanel className="companion-add-panel" storageKey={`azeroth-panel-${character.id}-companions-add`} eyebrow="Allies and alternate forms" title="Companions & summons" summary={<span>{character.companions.length} tracked · {character.companions.filter((item) => item.active).length} active</span>}>
      <DescriptionPicker ariaLabel="Creature catalog" value={selectedId} placeholder="Choose an imported creature" onChange={setSelectedId} options={available.map((item) => ({ value: item.id, label: item.name, meta: item.challengeRating ? `CR ${item.challengeRating}` : "Creature", description: item.description }))} />
      <button className="button button-primary" disabled={!selectedId} onClick={() => add(catalog.find((item) => item.id === selectedId))}><Plus size={14} />Add creature</button>
      <div className="custom-companion-row"><input value={customName} onChange={(event) => setCustomName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") add(); }} placeholder="Custom companion or form" /><button onClick={() => add()}><Plus size={14} /></button></div>
      <p>Track permanent companions, temporary summons, and transformation forms. Creature entries provide reference text; combat values remain editable for campaign rulings.</p>
    </CollapsiblePanel>
    <section className="companion-list">
      {character.companions.map((item) => <article className={`panel companion-card ${item.active ? "active" : ""}`} key={item.id}>
        <div className="companion-heading"><div><span>{item.kind}{item.challengeRating ? ` · CR ${item.challengeRating}` : ""}</span><input aria-label={`${item.name} name`} value={item.name} onChange={(event) => update(item.id, { name: event.target.value })} /></div><button className="icon-button danger" aria-label={`Remove ${item.name}`} onClick={() => patchCharacter({ companions: character.companions.filter((entry) => entry.id !== item.id) })}><Trash2 size={14} /></button></div>
        <div className="companion-vitals">
          <label><Heart size={13} />HP <input type="number" min="0" value={item.currentHp} onChange={(event) => update(item.id, { currentHp: Math.max(0, Number(event.target.value)) })} /> / <input type="number" min="1" value={item.maxHp} onChange={(event) => update(item.id, { maxHp: Math.max(1, Number(event.target.value)) })} /></label>
          <label>AC <input type="number" min="0" value={item.armorClass} onChange={(event) => update(item.id, { armorClass: Math.max(0, Number(event.target.value)) })} /></label>
          <label>Speed <input value={item.speed} onChange={(event) => update(item.id, { speed: event.target.value })} /></label>
        </div>
        <div className="companion-controls"><select value={item.kind} onChange={(event) => update(item.id, { kind: event.target.value as CompanionKind })}><option value="companion">Companion</option><option value="summon">Summon</option><option value="form">Form</option></select><label><input type="checkbox" checked={item.active} onChange={(event) => update(item.id, { active: event.target.checked })} />Active</label></div>
        {item.description && <details><summary>Creature reference</summary><p>{item.description}</p></details>}
        <textarea value={item.notes} onChange={(event) => update(item.id, { notes: event.target.value })} placeholder="Commands, attacks, saves, duration, or other notes" rows={4} />
      </article>)}
      {!character.companions.length && <section className="panel empty-state">No companions, summons, or alternate forms are being tracked.</section>}
    </section>
  </div>;
}
