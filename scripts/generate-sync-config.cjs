const fs = require("node:fs");
const path = require("node:path");

const target = path.join(__dirname, "..", "electron", "sync-config.generated.cjs");
const supabaseUrl = String(process.env.AZEROTH_SUPABASE_URL ?? "").trim();
const publishableKey = String(process.env.AZEROTH_SUPABASE_PUBLISHABLE_KEY ?? "").trim();

if (Boolean(supabaseUrl) !== Boolean(publishableKey)) {
  throw new Error("Set both AZEROTH_SUPABASE_URL and AZEROTH_SUPABASE_PUBLISHABLE_KEY, or leave both unset.");
}

if (supabaseUrl) {
  const parsed = new URL(supabaseUrl);
  if (parsed.protocol !== "https:") throw new Error("AZEROTH_SUPABASE_URL must use HTTPS.");
}

const generated = `// Generated during packaging. The Supabase publishable key is intentionally safe to distribute.\nmodule.exports = ${JSON.stringify({ supabaseUrl, publishableKey }, null, 2)};\n`;
fs.writeFileSync(target, generated, "utf8");
console.log(supabaseUrl ? "Generated configured live-sync release settings." : "Generated an unconfigured live-sync development build.");
