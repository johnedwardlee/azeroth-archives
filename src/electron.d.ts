import type { AppRole, CampaignProfile, CharacterData, CharacterMutation, CharacterSyncLink, ContentPack, LiveCampaign, LiveCampaignMember, LiveSyncStatus, SharedRollEvent, SyncOutboxEntry, SyncedCharacterSnapshot } from "../lib/types";

type DesktopStore = {
  version: 6;
  characters: CharacterData[];
  packs: ContentPack[];
  disabledPackIds: string[];
  campaignProfiles: CampaignProfile[];
  activeCampaignProfileId?: string;
  onboardingCompleted: boolean;
  appRole: AppRole;
  syncLinks: CharacterSyncLink[];
  syncOutbox: SyncOutboxEntry[];
  recovery?: { restoredFrom?: string; migrationBackup?: string };
};

type UpdateStatus = {
  state: "idle" | "checking" | "downloading" | "ready" | "current" | "error" | "development";
  version: string | null;
  percent: number;
  message: string;
};

type LiveSyncEvent =
  | { type: "status"; status: LiveSyncStatus }
  | { type: "auth-error"; message: string }
  | { type: "resync"; campaignId: string }
  | { type: "remote-change"; campaignId: string; event: "INSERT" | "UPDATE" | "DELETE"; payload: { payload?: { table?: string; record?: unknown; old_record?: unknown }; [key: string]: unknown } }
  | { type: "presence"; campaignId: string; state: Record<string, Array<Record<string, unknown>>> };

declare global {
  interface Window {
    azerothDesktop?: {
      load: () => Promise<DesktopStore>;
      saveCharacter: (character: CharacterData) => Promise<CharacterData>;
      deleteCharacter: (id: string) => Promise<void>;
      savePack: (pack: ContentPack) => Promise<ContentPack>;
      deletePack: (id: string) => Promise<void>;
      setPackEnabled: (id: string, enabled: boolean) => Promise<{ id: string; enabled: boolean }>;
      saveCampaignState: (campaignState: { campaignProfiles: CampaignProfile[]; activeCampaignProfileId?: string; onboardingCompleted: boolean; appRole: AppRole }) => Promise<{ campaignProfiles: CampaignProfile[]; activeCampaignProfileId?: string; onboardingCompleted: boolean; appRole: AppRole }>;
      saveSyncState: (syncState: { syncLinks: CharacterSyncLink[]; syncOutbox: SyncOutboxEntry[] }) => Promise<{ syncLinks: CharacterSyncLink[]; syncOutbox: SyncOutboxEntry[] }>;
      replaceStore: (store: DesktopStore) => Promise<DesktopStore>;
      savePdf: (filename: string, bytes: number[]) => Promise<string | null>;
      saveJson: (filename: string, contents: string) => Promise<string | null>;
      saveContentPack: (filename: string, contents: string) => Promise<string | null>;
      saveReviewJson: (filename: string, contents: string) => Promise<string | null>;
      getAppInfo: () => Promise<{ version: string; platform: string; packaged: boolean; dataPath: string; backupPath: string }>;
      openDataFolder: () => Promise<string>;
      openReleaseNotes: () => Promise<void>;
      getUpdateStatus: () => Promise<UpdateStatus>;
      checkForUpdates: () => Promise<UpdateStatus>;
      installUpdate: () => Promise<void>;
      onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
      getLiveSyncStatus: () => Promise<LiveSyncStatus>;
      requestDmMagicLink: (email: string) => Promise<LiveSyncStatus>;
      signOutLiveSync: () => Promise<LiveSyncStatus>;
      listLiveCampaigns: () => Promise<LiveCampaign[]>;
      createLiveCampaign: (name: string) => Promise<string>;
      createCampaignInvitation: (campaignId: string, characterId?: string, validHours?: number) => Promise<{ invitationId: string; invitationCode: string; expiresAt: string }>;
      redeemCampaignInvitation: (code: string, character: CharacterData, playerName: string) => Promise<{ campaignId: string; characterId: string; characterState: CharacterData; revision: number }>;
      listCampaignMembers: (campaignId: string) => Promise<LiveCampaignMember[]>;
      listSyncedCharacters: (campaignId: string) => Promise<SyncedCharacterSnapshot[]>;
      applyCharacterMutation: (mutation: CharacterMutation) => Promise<{ characterState: CharacterData; revision: number; updatedAt: string; wasConflict: boolean }>;
      publishRollEvent: (roll: SharedRollEvent) => Promise<string>;
      listCampaignRolls: (campaignId: string) => Promise<SharedRollEvent[]>;
      clearCampaignRolls: (campaignId: string) => Promise<number>;
      unlinkLiveCharacter: (campaignId: string, characterId: string, deleteRollHistory: boolean) => Promise<{ characterId: string; ownerUserId: string; deletedRollCount: number } | undefined>;
      subscribeLiveCampaign: (campaignId: string, presence: { role: AppRole; displayName: string }, characterId?: string) => Promise<LiveSyncStatus>;
      unsubscribeLiveCampaign: () => Promise<LiveSyncStatus>;
      onLiveSyncEvent: (callback: (event: LiveSyncEvent) => void) => () => void;
    };
  }
}

export {};
