import { AlertTriangle, CheckCircle2, FileJson, LockKeyhole, ShieldAlert, UnlockKeyhole } from "lucide-react";
import type { CharacterReadinessReport } from "../lib/character-readiness";
import { CollapsiblePanel } from "./collapsible-panel";

type Props = {
  report: CharacterReadinessReport;
  characterId: string;
  finalizedAt?: string;
  readOnlyReview?: boolean;
  campaignName?: string;
  onFinalize: () => void;
  onReopen: () => void;
  onExportReview: () => void;
};

export function ReadinessPanel({ report, characterId, finalizedAt, readOnlyReview, campaignName, onFinalize, onReopen, onExportReview }: Props) {
  const title = readOnlyReview ? "DM review copy" : finalizedAt ? "Character finalized" : report.ready ? "Ready to play" : "Creation review";
  const summary = <><span className={report.errors.length ? "has-issues" : ""}>{report.errors.length} errors</span><span className={report.warnings.length ? "has-warnings" : ""}>{report.warnings.length} warnings</span>{report.ready ? <CheckCircle2 size={20} /> : <ShieldAlert size={20} />}</>;
  return <CollapsiblePanel className={`readiness-panel ${report.ready ? "ready" : "blocked"}`} storageKey={`azeroth-archives:panel:${characterId}:readiness`} eyebrow="Session-zero preflight" title={title} summary={summary}>
    {campaignName && <p className="readiness-campaign">Campaign profile: <strong>{campaignName}</strong></p>}
    {readOnlyReview && <div className="review-only-banner"><LockKeyhole size={16} /><span>This imported DM review copy is read-only. The player’s original remains authoritative.</span></div>}
    {!readOnlyReview && finalizedAt && <div className="review-only-banner finalized"><LockKeyhole size={16} /><span>Creation choices are protected. Living-sheet trackers and level advancement remain available.</span></div>}
    <div className="readiness-counts"><span className={report.errors.length ? "has-issues" : ""}>{report.errors.length} errors</span><span className={report.warnings.length ? "has-warnings" : ""}>{report.warnings.length} warnings</span></div>
    {(report.errors.length > 0 || report.warnings.length > 0) && <div className="readiness-issues">
      {report.errors.map((issue) => <article className="error" key={issue.id}><ShieldAlert size={14} /><div><strong>{issue.title}</strong><p>{issue.detail}</p></div></article>)}
      {report.warnings.map((issue) => <article className="warning" key={issue.id}><AlertTriangle size={14} /><div><strong>{issue.title}</strong><p>{issue.detail}</p></div></article>)}
    </div>}
    {!report.errors.length && !report.warnings.length && <p className="readiness-clear">All required creation choices and campaign checks pass.</p>}
    <div className="readiness-actions">
      {!readOnlyReview && !finalizedAt && <button className="button button-primary" disabled={!report.ready} onClick={onFinalize}><LockKeyhole size={15} />Finalize character</button>}
      {!readOnlyReview && finalizedAt && <button className="button button-outline" onClick={onReopen}><UnlockKeyhole size={15} />Reopen creation</button>}
      <button className="button button-outline" onClick={onExportReview}><FileJson size={15} />Export for DM</button>
    </div>
  </CollapsiblePanel>;
}
