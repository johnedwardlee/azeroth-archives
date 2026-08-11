import { BookOpenCheck, HardDrive, ShieldCheck, Upload, Users } from "lucide-react";
import { useState } from "react";
import type { AppRole } from "../lib/types";

type Props = {
  activeCampaignName?: string;
  onImportCampaign: () => void;
  onFinish: (role: AppRole, createCharacter: boolean) => void;
};

export function Onboarding({ activeCampaignName, onImportCampaign, onFinish }: Props) {
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<AppRole>("player");

  return <div className="onboarding-scrim">
    <section className="onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-progress"><span style={{ width: `${((step + 1) / 3) * 100}%` }} /></div>
      {step === 0 && <>
        <span className="eyebrow">Welcome to Azeroth Archives</span>
        <h1 id="onboarding-title">Who will use this installation?</h1>
        <p>The choice only changes guidance and review tools. Character data remains stored on this device.</p>
        <div className="onboarding-role-grid">
          <button className={role === "player" ? "selected" : ""} onClick={() => setRole("player")}><ShieldCheck size={25} /><strong>Player</strong><small>Create and play a personal character.</small></button>
          <button className={role === "dm" ? "selected" : ""} onClick={() => setRole("dm")}><Users size={25} /><strong>Dungeon Master</strong><small>Review imported player copies and manage campaign rules.</small></button>
        </div>
      </>}
      {step === 1 && <>
        <span className="eyebrow">Campaign setup</span>
        <h1 id="onboarding-title">Use the same rules as the table</h1>
        <p>Import the campaign profile supplied by the DM. It controls starting level, allowed content, ability methods, and house-rule guidance.</p>
        <button className="onboarding-import" onClick={onImportCampaign}><Upload size={21} /><span><strong>Import campaign profile</strong><small>{activeCampaignName ? `${activeCampaignName} is active` : "Choose an .azeroth-campaign.json file"}</small></span></button>
        <p className="onboarding-note">You can continue without a profile and add one later from Campaigns.</p>
      </>}
      {step === 2 && <>
        <span className="eyebrow">Local and recoverable</span>
        <h1 id="onboarding-title">Your work is protected</h1>
        <div className="onboarding-safety-list">
          <div><HardDrive size={20} /><span><strong>Automatic local saves</strong><small>Edits save after a short pause, with rotating recovery copies.</small></span></div>
          <div><BookOpenCheck size={20} /><span><strong>Readiness review</strong><small>Finalize only after required creation choices are complete.</small></span></div>
          <div><ShieldCheck size={20} /><span><strong>Portable backups</strong><small>Export a character or full-library backup before major changes.</small></span></div>
        </div>
      </>}
      <div className="onboarding-actions">
        {step > 0 && <button className="button button-outline" onClick={() => setStep((current) => current - 1)}>Back</button>}
        {step < 2 ? <button className="button button-primary" onClick={() => setStep((current) => current + 1)}>Continue</button> : <button className="button button-primary" onClick={() => onFinish(role, role === "player")}>{role === "player" ? "Create my first hero" : "Open the DM library"}</button>}
      </div>
    </section>
  </div>;
}
