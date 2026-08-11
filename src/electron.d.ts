import type { CharacterData, ContentPack } from "../lib/types";

type DesktopStore = {
  version: 3;
  characters: CharacterData[];
  packs: ContentPack[];
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
      replaceStore: (store: DesktopStore) => Promise<DesktopStore>;
      savePdf: (filename: string, bytes: number[]) => Promise<string | null>;
      saveJson: (filename: string, contents: string) => Promise<string | null>;
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
