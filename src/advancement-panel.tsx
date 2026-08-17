import { RotateCcw } from "lucide-react";
import type { CharacterData } from "../lib/types";
import { CollapsiblePanel } from "./collapsible-panel";

export function AdvancementPanel({ character, onRollback }: { character: CharacterData; onRollback: () => void }) {
  const latest = character.advancementHistory.at(-1);
  return <CollapsiblePanel className="advancement-panel" storageKey={`azeroth-panel-${character.id}-overview-advancement`} eyebrow="Character progression" title="Classes & advancement" summary={<span>Level {character.level} · {character.classLevels.length} {character.classLevels.length === 1 ? "class" : "classes"}</span>} defaultExpanded={false}>
    <div className="class-level-list">
      {character.classLevels.map((entry) => <article key={entry.className}>
        <div><strong>{entry.className}</strong>{entry.subclassName && <span>{entry.subclassName}</span>}</div><b>Level {entry.level}</b>
      </article>)}
    </div>
    <div className="advancement-history-list">
      {character.advancementHistory.slice().reverse().map((entry, index) => <article key={entry.id}>
        <span>{entry.className} {entry.classLevel}</span>
        <strong>{entry.summary}</strong>
        <small>{new Date(entry.createdAt).toLocaleDateString()} · Total level {entry.totalLevel}</small>
        {index === 0 && <button className="button button-outline" onClick={onRollback}><RotateCcw size={13} />Undo level</button>}
      </article>)}
      {!character.advancementHistory.length && <p className="empty-state compact">Future level-ups will be recorded here and can be safely undone.</p>}
    </div>
    {latest && <small className="advancement-rollback-note">Undo restores advancement choices and statistics from immediately before {latest.className} level {latest.classLevel}.</small>}
  </CollapsiblePanel>;
}
