import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Cloud, Copy, Link2, LogOut, Mail, Plus, Radio, Unlink, X } from "lucide-react";
import type { AppRole, CharacterData, CharacterSyncLink, LiveCampaign, LiveSyncStatus } from "../lib/types";
import { canManageCampaignAsDm } from "../lib/live-sync";

type Props = {
  status: LiveSyncStatus;
  appRole: AppRole;
  characters: CharacterData[];
  links: CharacterSyncLink[];
  campaigns: LiveCampaign[];
  activeCampaignId?: string;
  onClose: () => void;
  onRequestDmLink: (email: string) => Promise<void>;
  onCreateCampaign: (name: string) => Promise<void>;
  onSelectCampaign: (campaignId: string) => Promise<void>;
  onCreateInvitation: (characterId?: string) => Promise<{ invitationCode: string; expiresAt: string } | undefined>;
  onRedeemInvitation: (code: string, characterId: string, playerName: string, recover?: boolean) => Promise<void>;
  onUnlinkCharacter: (characterId: string, deleteRollHistory: boolean) => Promise<void>;
  onSignOut: () => Promise<void>;
};

export function formatInvitationCodeInput(value: string) {
  return value
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "")
    .slice(0, 24)
    .match(/.{1,6}/g)
    ?.join("-") ?? "";
}

export function campaignOptionLabel(campaign: LiveCampaign, campaigns: LiveCampaign[]) {
  return campaigns.filter((entry) => entry.name === campaign.name).length > 1
    ? `${campaign.name} · ${campaign.id.slice(0, 8)}`
    : campaign.name;
}

export function LiveSyncPanel({ status, appRole, characters, links, campaigns, activeCampaignId, onClose, onRequestDmLink, onCreateCampaign, onSelectCampaign, onCreateInvitation, onRedeemInvitation, onUnlinkCharacter, onSignOut }: Props) {
  const [email, setEmail] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [playerName, setPlayerName] = useState(characters.find((entry) => links.some((link) => link.characterId === entry.id && link.role === "player"))?.playerName ?? "");
  const [characterId, setCharacterId] = useState(characters.find((entry) => !links.some((link) => link.characterId === entry.id))?.id ?? "");
  const playerLinks = links.filter((link) => link.role === "player");
  const [recoverConnection, setRecoverConnection] = useState(appRole === "player" && playerLinks.length > 0 && !status.authenticated);
  const [recoveryCharacterId, setRecoveryCharacterId] = useState(playerLinks[0]?.characterId ?? "");
  const [generatedInvite, setGeneratedInvite] = useState<{ invitationCode: string; expiresAt: string }>();
  const [generatedForCharacterId, setGeneratedForCharacterId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [unlinkTarget, setUnlinkTarget] = useState<CharacterSyncLink>();
  const [deleteRollHistory, setDeleteRollHistory] = useState(false);
  const unlinkedCharacters = useMemo(() => characters.filter((entry) => entry.id !== "draft" && !links.some((link) => link.characterId === entry.id)), [characters, links]);
  const recoveryCharacters = characters.filter((entry) => playerLinks.some((link) => link.characterId === entry.id));
  const selectedCharacterId = recoverConnection ? recoveryCharacterId : characterId;
  const playerFormRef = useRef<HTMLElement>(null);
  const generatedCodeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (generatedInvite) generatedCodeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [generatedInvite]);

  function openPlayerRecovery(forCharacterId = recoveryCharacterId) {
    if (!recoverConnection || forCharacterId !== recoveryCharacterId) setInviteCode("");
    setRecoverConnection(true);
    setRecoveryCharacterId(forCharacterId);
    playerFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function generateInvitation(forCharacterId?: string) {
    setGeneratedInvite(undefined);
    setGeneratedForCharacterId(forCharacterId);
    setGeneratedInvite(await onCreateInvitation(forCharacterId));
  }

  async function run(operation: () => Promise<void>, success: string) {
    setBusy(true);
    setFeedback("");
    try {
      await operation();
      setFeedback(success);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Live-sync operation failed.");
    } finally {
      setBusy(false);
    }
  }

  function closeFromScrim(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return <div className="sync-panel-scrim" onMouseDown={closeFromScrim}>
    <section className="sync-panel" role="dialog" aria-modal="true" aria-labelledby="sync-panel-title">
      <div className="sync-panel-heading"><div><span className="eyebrow">Private campaign connection</span><h2 id="sync-panel-title">Live sync</h2><p>Characters remain available locally while linked updates are shared with the campaign DM.</p></div><button className="icon-button" aria-label="Close live sync" onClick={onClose}><X size={18} /></button></div>
      <div className={`sync-connection sync-${status.connection}`}><span><Radio size={16} /></span><div><strong>{status.connection.replace("-", " ")}</strong><small>{status.message}</small></div></div>

      {!status.configured && <div className="sync-setup-note"><Cloud size={20} /><div><strong>This build is not connected to a campaign service.</strong><p>Add the Supabase project URL and publishable key to the release configuration before distributing the v2.0 beta.</p></div></div>}

      {status.configured && appRole === "dm" && !status.authenticated && <form className="sync-form" onSubmit={(event) => { event.preventDefault(); run(() => onRequestDmLink(email), "Check your email and open the Azeroth Archives sign-in link on this computer."); }}>
        <div><span className="eyebrow">DM identity</span><h3>Sign in by email</h3><p>A magic link returns directly to this installation. No password is stored.</p></div>
        <label><span>Email address</span><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="dm@example.com" /></label>
        <button className="button button-primary" disabled={busy}><Mail size={15} />Send magic link</button>
      </form>}

      {status.configured && appRole === "dm" && status.authenticated && status.anonymous && <div className="sync-setup-note"><Cloud size={20} /><div><strong>This device is signed in as a player.</strong><p>Sign out below, then sign in with your original DM email to generate recovery codes. Do not redeem player codes on the DM device.</p></div></div>}

      {status.configured && appRole === "dm" && status.authenticated && !status.anonymous && <>
        <section className="sync-form"><div><span className="eyebrow">DM campaigns</span><h3>Campaign connection</h3></div>
          {campaigns.length > 0 && <label><span>Active live campaign</span><select value={activeCampaignId ?? ""} onChange={(event) => run(() => onSelectCampaign(event.target.value), "Live campaign selected.")}><option value="">Choose a campaign</option>{campaigns.filter((campaign) => campaign.role === "dm").map((campaign) => <option key={campaign.id} value={campaign.id}>{campaignOptionLabel(campaign, campaigns)}</option>)}</select></label>}
          <div className="sync-inline-form"><input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="New campaign name" /><button className="button button-outline" disabled={busy || !campaignName.trim()} onClick={() => run(async () => { await onCreateCampaign(campaignName); setCampaignName(""); }, "Campaign created.")}><Plus size={14} />Create</button></div>
        </section>
        {activeCampaignId && <section className="sync-form"><div><span className="eyebrow">Player invitation</span><h3>Generate a single-use code</h3><p>The code expires after 72 hours and links one player character.</p></div>
          <button className="button button-primary" disabled={busy} onClick={() => run(() => generateInvitation(), "Invitation generated.")}><Link2 size={15} />Generate invitation</button>
        </section>}
      </>}

      {status.configured && appRole === "player" && <section className="sync-form" ref={playerFormRef}><div><span className="eyebrow">Player link</span><h3>{recoverConnection ? "Recover connection" : "Join the DM’s campaign"}</h3><p>{recoverConnection ? "Ask the DM for a recovery code for this character. This reconnects the existing shared sheet without uploading a replacement. Your portrait and queued offline changes are kept." : "Choose one saved character and enter the single-use invitation from your DM."}</p></div>
        {playerLinks.length > 0 && <div className="sync-inline-form"><button type="button" className={`button ${recoverConnection ? "button-primary" : "button-outline"}`} disabled={busy} onClick={() => openPlayerRecovery()}>Recover existing character</button><button type="button" className={`button ${recoverConnection ? "button-outline" : "button-primary"}`} disabled={busy} onClick={() => { setRecoverConnection(false); setInviteCode(""); }}>Link another character</button></div>}
        <label><span>{recoverConnection ? "Recovery code" : "Invitation code"}</span><input className="sync-invite-input" type="text" name="invitation-code" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={27} value={inviteCode} onChange={(event) => setInviteCode(formatInvitationCodeInput(event.currentTarget.value))} placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX" /></label>
        <label><span>Player name</span><input value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder={characters.find((entry) => entry.id === selectedCharacterId)?.playerName || "Your name"} /></label>
        <label><span>{recoverConnection ? "Previously linked character" : "Local character"}</span><select value={selectedCharacterId} onChange={(event) => recoverConnection ? setRecoveryCharacterId(event.target.value) : setCharacterId(event.target.value)}><option value="">Choose a saved character</option>{(recoverConnection ? recoveryCharacters : unlinkedCharacters).map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · Level {entry.level} {entry.className}</option>)}</select></label>
        <button className="button button-primary" disabled={busy || !inviteCode.trim() || !playerName.trim() || !selectedCharacterId} onClick={() => run(async () => { await onRedeemInvitation(inviteCode, selectedCharacterId, playerName, recoverConnection); setInviteCode(""); }, recoverConnection ? "Connection recovered. Your existing character is live again." : "Character linked. Live changes will now synchronize.")}><Link2 size={15} />{recoverConnection ? "Recover connection" : "Link character"}</button>
      </section>}

      {links.length > 0 && <section className="sync-linked-list"><span className="eyebrow">Linked on this device</span>{appRole === "dm" && <p className="sync-recovery-help">Generate a recovery code here and send it to the character’s player. The player enters it on their own installation.</p>}{links.map((link) => {
        const campaignRole = campaigns.find((campaign) => campaign.id === link.campaignId)?.role ?? link.role;
        const canGenerateRecovery = link.campaignId === activeCampaignId && canManageCampaignAsDm(link.campaignId, appRole, status, campaigns);
        return <div className="sync-linked-row" key={`${link.campaignId}-${link.characterId}`}>
          <div><strong>{characters.find((entry) => entry.id === link.characterId)?.name ?? link.characterId}</strong><span>{link.campaignName} · {campaignRole === "dm" ? "DM view" : "Player connection"} · revision {link.revision}</span></div>
          {canGenerateRecovery && <button className="button button-outline" disabled={busy} onClick={() => run(() => generateInvitation(link.characterId), "Recovery code generated. Share it only with this character’s player.")}><Link2 size={14} />Generate recovery code</button>}
          {appRole === "player" && link.role === "player" && <><button className="button button-outline" disabled={busy} onClick={() => openPlayerRecovery(link.characterId)}>Open recovery form</button><button className="button button-quiet" disabled={busy || !status.authenticated} onClick={() => { setDeleteRollHistory(false); setUnlinkTarget(link); }}><Unlink size={14} />Unlink</button></>}
        </div>;
      })}</section>}
      {generatedInvite && appRole === "dm" && <section className="sync-form" ref={generatedCodeRef}><h3>{generatedForCharacterId ? `Recovery code for ${characters.find((entry) => entry.id === generatedForCharacterId)?.name ?? "character"}` : "Player invitation"}</h3>{generatedForCharacterId && <p>This single-use code transfers this existing character’s connection to the player’s device. Keep it private. It does not replace the sheet or erase shared rolls.</p>}<div className="invite-code"><strong>{generatedInvite.invitationCode}</strong><button aria-label="Copy invitation code" onClick={() => navigator.clipboard.writeText(generatedInvite.invitationCode)}><Copy size={14} /></button><small>Expires {new Date(generatedInvite.expiresAt).toLocaleString()}</small></div></section>}
      {unlinkTarget && <section className="sync-unlink-confirm" aria-label="Confirm character unlink"><div><span className="eyebrow">Unlink character</span><h3>{characters.find((entry) => entry.id === unlinkTarget.characterId)?.name ?? "This character"}</h3><p>The character will leave <strong>{unlinkTarget.campaignName}</strong>, but its complete local sheet will stay on this device. The DM will no longer receive changes.</p></div><label className="sync-history-choice"><input type="checkbox" checked={deleteRollHistory} onChange={(event) => setDeleteRollHistory(event.target.checked)} /><span><strong>Delete shared roll history</strong><small>Otherwise this character’s previous shared rolls remain in the campaign history.</small></span></label><div className="sync-confirm-actions"><button className="button button-quiet" disabled={busy} onClick={() => setUnlinkTarget(undefined)}>Cancel</button><button className="button button-danger" disabled={busy} onClick={() => run(async () => { await onUnlinkCharacter(unlinkTarget.characterId, deleteRollHistory); setUnlinkTarget(undefined); }, "Character unlinked. The local sheet was kept.")}><Unlink size={14} />Confirm unlink</button></div></section>}
      {feedback && <p className="sync-feedback" role="status">{feedback}</p>}
      {status.authenticated && appRole === "dm" && <button className="button button-quiet sync-signout" disabled={busy} onClick={() => run(onSignOut, "Signed out.")}><LogOut size={14} />Sign out of live sync</button>}
    </section>
  </div>;
}
