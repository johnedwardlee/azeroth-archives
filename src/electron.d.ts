import type { CharacterData, ContentPack } from "../lib/types";

type DesktopStore = {
  version: 1;
  characters: CharacterData[];
  packs: ContentPack[];
};

declare global {
  interface Window {
    azerothDesktop?: {
      load: () => Promise<DesktopStore>;
      saveCharacter: (character: CharacterData) => Promise<CharacterData>;
      deleteCharacter: (id: string) => Promise<void>;
      savePack: (pack: ContentPack) => Promise<ContentPack>;
      deletePack: (id: string) => Promise<void>;
      savePdf: (filename: string, bytes: number[]) => Promise<string | null>;
      saveJson: (filename: string, contents: string) => Promise<string | null>;
    };
  }
}

export {};
