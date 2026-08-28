import { BookOpen, Check, MapPin, Plus, Star, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import type { CharacterData, JournalEntry, JournalEntryStatus, JournalEntryType } from "../lib/types";
import { CollapsiblePanel } from "./collapsible-panel";

const labels: Record<JournalEntryType, string> = { session: "Session", quest: "Quest", npc: "NPC", location: "Location", lore: "Lore" };
const journalTypes = Object.keys(labels) as JournalEntryType[];

export function JournalManager({ character, patchCharacter }: { character: CharacterData; patchCharacter: (patch: Partial<CharacterData>, options?: { flushLiveSync?: boolean }) => void }) {
  const [filter, setFilter] = useState<"all" | JournalEntryType>("all");
  const [newType, setNewType] = useState<JournalEntryType>("session");
  const visible = useMemo(() => character.journal.filter((entry) => filter === "all" || entry.type === filter).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)), [character.journal, filter]);
  const update = (id: string, patch: Partial<JournalEntry>, flushLiveSync = false) => patchCharacter({ journal: character.journal.map((entry) => entry.id === id ? { ...entry, ...patch, updatedAt: new Date().toISOString() } : entry) }, { flushLiveSync });
  const add = () => {
    const now = new Date().toISOString();
    patchCharacter({ journal: [{ id: crypto.randomUUID(), type: newType, title: `New ${labels[newType]}`, details: "", status: "active", pinned: false, createdAt: now, updatedAt: now }, ...character.journal] }, { flushLiveSync: true });
  };
  return <div className="journal-layout">
    <CollapsiblePanel className="journal-toolbar" storageKey={`azeroth-panel-${character.id}-journal-tools`} eyebrow="Campaign memory" title="Journal" summary={<span>{character.journal.length} entries · {filter === "all" ? "all shown" : `${labels[filter]} filter`}</span>}>
      <div className="journal-add"><select value={newType} onChange={(event) => setNewType(event.target.value as JournalEntryType)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="button button-primary" onClick={add}><Plus size={14} />Add entry</button></div>
      <div className="journal-filters">{(["all", ...journalTypes] as Array<"all" | JournalEntryType>).map((type) => <button className={filter === type ? "active" : ""} onClick={() => setFilter(type)} key={type}>{type === "all" ? "All" : labels[type]}</button>)}</div>
      <label className="legacy-notes"><span>Scratchpad</span><textarea value={character.notes} onChange={(event) => patchCharacter({ notes: event.target.value })} onBlur={(event) => patchCharacter({ notes: event.currentTarget.value }, { flushLiveSync: true })} placeholder="Quick notes that do not need a structured entry" rows={7} /></label>
    </CollapsiblePanel>
    <section className="journal-entry-list">
      {visible.map((entry) => <article className={`panel journal-entry status-${entry.status}`} key={entry.id}>
        <div className="journal-entry-heading"><span>{entry.type === "npc" ? <Users size={13} /> : entry.type === "location" ? <MapPin size={13} /> : entry.status === "completed" ? <Check size={13} /> : <BookOpen size={13} />}{labels[entry.type]}</span><div><button className={entry.pinned ? "pinned" : ""} aria-label={`${entry.pinned ? "Unpin" : "Pin"} ${entry.title}`} onClick={() => update(entry.id, { pinned: !entry.pinned }, true)}><Star size={14} /></button><button className="danger" aria-label={`Remove ${entry.title}`} onClick={() => patchCharacter({ journal: character.journal.filter((item) => item.id !== entry.id) }, { flushLiveSync: true })}><Trash2 size={14} /></button></div></div>
        <input className="journal-title" value={entry.title} onChange={(event) => update(entry.id, { title: event.target.value })} onBlur={(event) => update(entry.id, { title: event.currentTarget.value }, true)} />
        <textarea value={entry.details} onChange={(event) => update(entry.id, { details: event.target.value })} onBlur={(event) => update(entry.id, { details: event.currentTarget.value }, true)} placeholder="Names, discoveries, goals, and outcomes" rows={6} />
        <select value={entry.status} onChange={(event) => update(entry.id, { status: event.target.value as JournalEntryStatus }, true)}><option value="active">Active</option><option value="completed">Completed</option><option value="archived">Archived</option></select>
      </article>)}
      {!visible.length && <section className="panel empty-state">No {filter === "all" ? "journal entries" : `${labels[filter].toLowerCase()} entries`} yet.</section>}
    </section>
  </div>;
}
