import { Copy, Download, FileCog, Plus, Trash2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { newCampaignProfile } from "../lib/campaign-profile";
import type { AppRole, CampaignProfile, ContentPack } from "../lib/types";

type Props = {
  profiles: CampaignProfile[];
  activeProfileId?: string;
  packs: ContentPack[];
  appRole: AppRole;
  onClose: () => void;
  onSave: (profile: CampaignProfile, activate?: boolean) => void;
  onActivate: (id?: string) => void;
  onDelete: (id: string) => void;
  onImport: () => void;
  onExport: (profile: CampaignProfile) => void;
  onRoleChange: (role: AppRole) => void;
  onShowWelcome: () => void;
};

export function CampaignPanel({ profiles, activeProfileId, packs, appRole, onClose, onSave, onActivate, onDelete, onImport, onExport, onRoleChange, onShowWelcome }: Props) {
  const [selectedId, setSelectedId] = useState(activeProfileId ?? profiles[0]?.id ?? "");
  const selected = profiles.find((profile) => profile.id === selectedId);
  const [draft, setDraft] = useState<CampaignProfile>(() => selected ?? newCampaignProfile(packs.map((pack) => pack.pack.id)));

  useEffect(() => {
    const profile = profiles.find((entry) => entry.id === selectedId);
    if (profile) setDraft(profile);
    else if (profiles[0]) setSelectedId(profiles[0].id);
  }, [profiles, selectedId]);

  function patch(update: Partial<CampaignProfile>) {
    setDraft((current) => ({ ...current, ...update, updatedAt: new Date().toISOString() }));
  }

  function create() {
    const profile = newCampaignProfile(packs.map((pack) => pack.pack.id));
    setDraft(profile);
    setSelectedId(profile.id);
  }

  function duplicate() {
    const now = new Date().toISOString();
    const profile = { ...draft, id: crypto.randomUUID(), name: `${draft.name} Copy`, createdAt: now, updatedAt: now };
    setDraft(profile);
    setSelectedId(profile.id);
  }

  function save(activate = false) {
    onSave({ ...draft, name: draft.name.trim() || "Unnamed Campaign", updatedAt: new Date().toISOString() }, activate);
  }

  function togglePack(id: string) {
    patch({ allowedPackIds: draft.allowedPackIds.includes(id) ? draft.allowedPackIds.filter((entry) => entry !== id) : [...draft.allowedPackIds, id] });
  }

  return <aside className="campaign-panel" role="dialog" aria-modal="true" aria-labelledby="campaign-panel-title">
    <div className="drawer-heading">
      <div><span className="eyebrow">Session-zero controls</span><h2 id="campaign-panel-title">Campaign profiles</h2></div>
      <button className="icon-button" onClick={onClose} aria-label="Close campaign profiles"><X size={18} /></button>
    </div>

    <section className="campaign-role-card">
      <div><strong>App role</strong><small>This changes onboarding language and highlights DM review tools.</small></div>
      <div><button className={appRole === "player" ? "active" : ""} onClick={() => onRoleChange("player")}>Player</button><button className={appRole === "dm" ? "active" : ""} onClick={() => onRoleChange("dm")}>Dungeon Master</button></div>
    </section>

    <div className="campaign-profile-toolbar">
      <select aria-label="Campaign profile" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
        <option value="">New unsaved profile</option>
        {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}{profile.id === activeProfileId ? " (active)" : ""}</option>)}
      </select>
      <button className="icon-button" onClick={create} title="New profile" aria-label="New campaign profile"><Plus size={16} /></button>
      <button className="icon-button" onClick={duplicate} title="Duplicate profile" aria-label="Duplicate campaign profile"><Copy size={16} /></button>
    </div>

    <div className="campaign-form">
      <label><span>Campaign name</span><input value={draft.name} onChange={(event) => patch({ name: event.target.value })} /></label>
      <div className="campaign-form-row">
        <label><span>Starting level</span><input type="number" min="1" max="20" value={draft.startingLevel} onChange={(event) => patch({ startingLevel: Math.max(1, Math.min(20, Number(event.target.value) || 1)) })} /></label>
        <label><span>Starting XP</span><input type="number" min="0" value={draft.startingExperience} onChange={(event) => patch({ startingExperience: Math.max(0, Number(event.target.value) || 0) })} /></label>
        <label><span>Attunement limit</span><input type="number" min="0" max="10" value={draft.attunementLimit} onChange={(event) => patch({ attunementLimit: Math.max(0, Math.min(10, Number(event.target.value) || 0)) })} /></label>
      </div>
      <label><span>Encumbrance</span><select value={draft.encumbranceRule} onChange={(event) => patch({ encumbranceRule: event.target.value as CampaignProfile["encumbranceRule"] })}><option value="variant">Variant thresholds and penalties</option><option value="standard">Capacity only</option><option value="none">Do not enforce</option></select></label>
      <label><span>Starting equipment</span><select value={draft.startingEquipmentRule} onChange={(event) => patch({ startingEquipmentRule: event.target.value as CampaignProfile["startingEquipmentRule"] })}><option value="packages-or-gold">Packages or gold</option><option value="packages-only">Packages only</option><option value="gold-only">Gold only</option></select></label>
      <fieldset><legend>Allowed ability methods</legend><div className="campaign-check-grid">{(["standard-array", "point-buy", "rolled", "manual"] as const).map((method) => <label key={method}><input type="checkbox" checked={draft.allowedAbilityMethods.includes(method)} onChange={() => patch({ allowedAbilityMethods: draft.allowedAbilityMethods.includes(method) ? draft.allowedAbilityMethods.filter((entry) => entry !== method) : [...draft.allowedAbilityMethods, method] })} />{method.replaceAll("-", " ")}</label>)}</div></fieldset>
      <fieldset><legend>Advancement rules</legend><div className="campaign-check-grid"><label><input type="checkbox" checked={draft.allowMulticlass} onChange={(event) => patch({ allowMulticlass: event.target.checked })} />Allow multiclassing</label><label><input type="checkbox" checked={draft.allowOptionalFeats} onChange={(event) => patch({ allowOptionalFeats: event.target.checked })} />Allow feats instead of ASIs</label></div></fieldset>
      <fieldset><legend>Allowed content packs</legend><div className="campaign-pack-list">{packs.map((pack) => <label key={pack.pack.id}><input type="checkbox" checked={draft.allowedPackIds.includes(pack.pack.id)} onChange={() => togglePack(pack.pack.id)} /><span><strong>{pack.pack.name}</strong><small>{pack.pack.version}</small></span></label>)}</div></fieldset>
      <label><span>House rules and player instructions</span><textarea rows={6} value={draft.houseRules} onChange={(event) => patch({ houseRules: event.target.value })} placeholder="Record rulings players should see before finalizing." /></label>
    </div>

    <div className="campaign-panel-actions">
      <button className="button button-primary" onClick={() => save()}><FileCog size={15} />Save profile</button>
      <button className="button button-outline" onClick={() => save(true)}>Save & activate</button>
      <button className="button button-outline" onClick={() => onExport(draft)}><Download size={15} />Export</button>
      <button className="button button-outline" onClick={onImport}><Upload size={15} />Import</button>
      {selected && <button className="button button-danger" onClick={() => onDelete(selected.id)}><Trash2 size={15} />Delete</button>}
    </div>
    <div className="campaign-secondary-actions"><button className="text-button" onClick={onShowWelcome}>Show welcome guide again</button>{activeProfileId && <button className="text-button" onClick={() => onActivate(undefined)}>Clear active profile</button>}</div>
  </aside>;
}
