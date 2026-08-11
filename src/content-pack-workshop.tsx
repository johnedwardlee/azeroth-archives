import { Copy, Download, FileJson, LibraryBig, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { contentPackValidationError } from "../lib/content-validation";
import type { ContentPack } from "../lib/types";

const categories = ["ancestries", "classes", "backgrounds", "feats", "equipment", "spells", "creatures", "rules"] as const;

function templatePack(): ContentPack {
  return { schemaVersion: "2.0", pack: { id: `custom-pack-${Date.now()}`, name: "New Custom Pack", version: "1.0.0", description: "Custom Warcraft 5E content." }, ancestries: [], classes: [], backgrounds: [], feats: [], equipment: [], spells: [], creatures: [], rules: [] };
}

export function ContentPackWorkshop({ packs, disabledPackIds, bundledPackId, onClose, onImport, onSave, onRemove, onToggle, onExport }: {
  packs: ContentPack[]; disabledPackIds: string[]; bundledPackId: string; onClose: () => void;
  onImport: () => void;
  onSave: (pack: ContentPack) => Promise<void>; onRemove: (id: string) => Promise<void>; onToggle: (id: string, enabled: boolean) => Promise<void>; onExport: (pack: ContentPack) => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState(packs[0]?.pack.id ?? "");
  const selected = packs.find((pack) => pack.pack.id === selectedId);
  const [text, setText] = useState(() => JSON.stringify(selected ?? templatePack(), null, 2));
  const [message, setMessage] = useState("");
  useEffect(() => { if (selected) { setText(JSON.stringify(selected, null, 2)); setMessage(""); } }, [selected?.pack.id, selected?.pack.version]);
  const parsed = useMemo(() => { try { return JSON.parse(text) as unknown; } catch { return null; } }, [text]);
  const validationError = parsed ? contentPackValidationError(parsed) : "Content pack is not valid JSON.";
  const validPack = validationError ? null : parsed as ContentPack;
  const readOnly = selectedId === bundledPackId;
  const choose = (pack: ContentPack) => { setSelectedId(pack.pack.id); setText(JSON.stringify(pack, null, 2)); setMessage(""); };
  const create = () => { const pack = templatePack(); setSelectedId(""); setText(JSON.stringify(pack, null, 2)); setMessage("New unsaved pack"); };
  const clone = () => { if (!selected) return; const clone = { ...selected, pack: { ...selected.pack, id: `${selected.pack.id}-custom-${Date.now()}`, name: `${selected.pack.name} Custom`, version: "1.0.0" } }; setSelectedId(""); setText(JSON.stringify(clone, null, 2)); setMessage("Cloned as a new editable pack"); };
  const save = async () => { if (!validPack) return; await onSave(validPack); setSelectedId(validPack.pack.id); setMessage("Pack saved and enabled"); };
  return <aside className="library-drawer workshop-drawer is-open" aria-hidden={false}>
    <div className="drawer-heading"><div><span className="eyebrow">Rules collection</span><h2>Content Pack Workshop</h2></div><button className="icon-button" onClick={onClose} aria-label="Close content workshop"><X size={19} /></button></div>
    <div className="workshop-layout">
      <section className="workshop-pack-list">
        <button className="button button-primary" onClick={create}><Plus size={14} />New pack</button>
        <button className="button button-outline" onClick={onImport}><FileJson size={14} />Import .w5e</button>
        {packs.map((pack, index) => { const bundled = pack.pack.id === bundledPackId; const enabled = bundled || !disabledPackIds.includes(pack.pack.id); return <article className={selected?.pack.id === pack.pack.id ? "selected" : ""} key={pack.pack.id}>
          <button className="workshop-pack-select" onClick={() => choose(pack)}><span className={`pack-glyph pack-tone-${index % 3}`}><LibraryBig size={18} /></span><span><strong>{pack.pack.name}</strong><small>v{pack.pack.version}</small></span></button>
          {bundled ? <b>Included</b> : <label><input type="checkbox" checked={enabled} onChange={(event) => onToggle(pack.pack.id, event.target.checked)} />Enabled</label>}
        </article>; })}
      </section>
      <section className="workshop-editor">
        <div className="workshop-actions">
          {readOnly && <button className="button button-outline" onClick={clone}><Copy size={14} />Clone to edit</button>}
          <button className="button button-outline" disabled={!validPack} onClick={() => validPack && onExport(validPack)}><Download size={14} />Export .w5e</button>
          {!readOnly && <button className="button button-primary" disabled={!validPack} onClick={save}><Save size={14} />Save pack</button>}
          {!readOnly && selected && <button className="icon-button danger" aria-label={`Remove ${selected.pack.name}`} onClick={() => onRemove(selected.pack.id)}><Trash2 size={15} /></button>}
        </div>
        <textarea spellCheck={false} readOnly={readOnly} value={text} onChange={(event) => setText(event.target.value)} aria-label="Content pack JSON editor" />
        <div className={`workshop-validation ${validationError ? "invalid" : "valid"}`}><FileJson size={16} /><span>{validationError ?? (message || "Valid schema 2.0 content pack")}</span></div>
      </section>
      <section className="workshop-preview">
        <span className="eyebrow">Live preview</span>
        <h3>{validPack?.pack.name ?? "Invalid pack"}</h3>
        <p>{validPack?.pack.description ?? "Fix the validation errors to preview this pack."}</p>
        <div className="workshop-counts">{categories.map((category) => <div key={category}><strong>{validPack?.[category]?.length ?? 0}</strong><span>{category}</span></div>)}</div>
        {validPack && categories.map((category) => validPack[category]?.length ? <details key={category}><summary>{category}</summary><p>{validPack[category]!.slice(0, 12).map((item) => item.name).join(" · ")}{validPack[category]!.length > 12 ? " …" : ""}</p></details> : null)}
      </section>
    </div>
  </aside>;
}
