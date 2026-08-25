import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { isAllowedNetworkRequest } = require("./network-policy.cjs") as {
  isAllowedNetworkRequest: (url: string, options: { devUrl?: string; packaged: boolean; supabaseUrl?: string }) => boolean;
};

describe("desktop network policy", () => {
  const release = { packaged: true, supabaseUrl: "https://project-ref.supabase.co" };

  it("allows only HTTPS/WSS for the configured sync host", () => {
    expect(isAllowedNetworkRequest("https://project-ref.supabase.co/rest/v1/characters", release)).toBe(true);
    expect(isAllowedNetworkRequest("wss://project-ref.supabase.co/realtime/v1/websocket", release)).toBe(true);
    expect(isAllowedNetworkRequest("http://project-ref.supabase.co/rest/v1/characters", release)).toBe(false);
    expect(isAllowedNetworkRequest("https://project-ref.supabase.co.attacker.example/", release)).toBe(false);
  });

  it("retains packaged update hosts and rejects arbitrary traffic", () => {
    expect(isAllowedNetworkRequest("https://api.github.com/repos/example/releases", release)).toBe(true);
    expect(isAllowedNetworkRequest("https://objects.githubusercontent.com/release", release)).toBe(true);
    expect(isAllowedNetworkRequest("https://example.com/", release)).toBe(false);
    expect(isAllowedNetworkRequest("not a URL", release)).toBe(false);
  });
});
