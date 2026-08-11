import { useEffect, useState } from "react";
import { Download, ExternalLink, FolderOpen, HardDrive, RefreshCw, ShieldCheck, X } from "lucide-react";
import packageMetadata from "../package.json";

type UpdateState = {
  state: "idle" | "checking" | "downloading" | "ready" | "current" | "error" | "development";
  version: string | null;
  percent: number;
  message: string;
};

const initialUpdate: UpdateState = { state: "idle", version: null, percent: 0, message: "Updates are checked automatically." };

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [update, setUpdate] = useState<UpdateState>(initialUpdate);
  const [appInfo, setAppInfo] = useState<{ version: string; platform: string; packaged: boolean; dataPath: string; backupPath: string } | null>(null);
  const [diagnosticStatus, setDiagnosticStatus] = useState("");

  useEffect(() => {
    if (!window.azerothDesktop) {
      setUpdate({ ...initialUpdate, state: "development", message: "Update checks are available in the installed desktop app." });
      return;
    }
    window.azerothDesktop.getAppInfo().then(setAppInfo);
    window.azerothDesktop.getUpdateStatus().then(setUpdate);
    return window.azerothDesktop.onUpdateStatus(setUpdate);
  }, []);

  async function exportDiagnostics() {
    try {
      const store = window.azerothDesktop ? await window.azerothDesktop.load() : { version: 3, characters: [], packs: [] };
      const diagnostics = JSON.stringify({
        format: "azeroth-archives-diagnostics",
        generatedAt: new Date().toISOString(),
        app: appInfo ?? { version: packageMetadata.version, platform: "browser preview", packaged: false },
        update,
        data: { storeVersion: store.version, characters: store.characters.length, importedPacks: store.packs.length },
      }, null, 2);
      if (window.azerothDesktop) {
        const destination = await window.azerothDesktop.saveJson(`azeroth-archives-diagnostics-${new Date().toISOString().slice(0, 10)}.json`, diagnostics);
        setDiagnosticStatus(destination ? "Diagnostics saved" : "Diagnostics export canceled");
      } else {
        const anchor = document.createElement("a");
        anchor.href = URL.createObjectURL(new Blob([diagnostics], { type: "application/json" }));
        anchor.download = "azeroth-archives-diagnostics.json";
        anchor.click();
        URL.revokeObjectURL(anchor.href);
        setDiagnosticStatus("Diagnostics downloaded");
      }
    } catch {
      setDiagnosticStatus("Diagnostics could not be exported");
    }
  }

  return <div className="modal-scrim settings-scrim" onMouseDown={onClose}>
    <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="drawer-heading"><div><span className="eyebrow">Desktop application</span><h2 id="settings-title">Settings & updates</h2></div><button className="icon-button" aria-label="Close settings" onClick={onClose}><X size={18} /></button></div>
      <div className="settings-version-card"><div className="brand-mark" aria-hidden="true">A</div><div><strong>Azeroth Archives {appInfo?.version ?? packageMetadata.version}</strong><span>{appInfo?.platform ?? "Desktop preview"}</span></div><ShieldCheck size={20} /></div>
      <section className={`update-card update-${update.state}`}><div><span className="eyebrow">Application updates</span><h3>{update.state === "ready" ? "Restart required" : update.state === "current" ? "Up to date" : update.state === "error" ? "Update problem" : "Update status"}</h3><p>{update.message}</p></div>{update.state === "downloading" && <div className="update-progress" role="progressbar" aria-label="Update download progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={update.percent}><span style={{ width: `${update.percent}%` }} /></div>}<div className="settings-actions"><button className="button button-outline" disabled={!window.azerothDesktop || update.state === "checking" || update.state === "downloading"} onClick={() => window.azerothDesktop?.checkForUpdates()}><RefreshCw size={15} />Check now</button>{update.state === "ready" && <button className="button button-primary" onClick={() => window.azerothDesktop?.installUpdate()}>Restart and install</button>}</div></section>
      <section className="settings-section"><div><HardDrive size={18} /><span><strong>Local data</strong><small>{appInfo?.dataPath ?? "Stored in the installed app's local data folder"}</small></span></div><button className="button button-outline" disabled={!window.azerothDesktop} onClick={() => window.azerothDesktop?.openDataFolder()}><FolderOpen size={15} />Open data folder</button></section>
      <section className="settings-section"><div><Download size={18} /><span><strong>Support diagnostics</strong><small>Exports versions and record counts, never character contents.</small>{diagnosticStatus && <b>{diagnosticStatus}</b>}</span></div><button className="button button-outline" onClick={exportDiagnostics}>Export diagnostics</button></section>
      <section className="settings-section"><div><ExternalLink size={18} /><span><strong>Release notes</strong><small>Review changes and download previous stable versions.</small></span></div><button className="button button-outline" disabled={!window.azerothDesktop} onClick={() => window.azerothDesktop?.openReleaseNotes()}>Open releases</button></section>
      <p className="settings-footnote">All character and content data stays on this device. Network access is limited to GitHub update checks that keep the desktop app current.</p>
    </section>
  </div>;
}
