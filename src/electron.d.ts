import type { AppRole, CampaignProfile, CharacterData, ContentPack } from "../lib/types";

type DesktopStore = {
  version: 5;
  characters: CharacterData[];
  packs: ContentPack[];
  disabledPackIds: string[];
  campaignProfiles: CampaignProfile[];
  activeCampaignProfileId?: string;
  onboardingCompleted: boolean;
  appRole: AppRole;
  recovery?: { restoredFrom?: string; migrationBackup?: string };
};

type UpdateStatus = {
  state: "idle" | "checking" | "downloading" | "ready" | "current" | "error" | "development";
  version: string | null;
  percent: number;
  message: string;
};

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
    };
  }
}

export {};
