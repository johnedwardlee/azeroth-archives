let generated = {};
try {
  generated = require("./sync-config.generated.cjs");
} catch {
  // Development and ordinary CI builds intentionally remain unconfigured.
}

module.exports = {
  supabaseUrl: process.env.AZEROTH_SUPABASE_URL || generated.supabaseUrl || "",
  publishableKey: process.env.AZEROTH_SUPABASE_PUBLISHABLE_KEY || generated.publishableKey || "",
  authRedirectUrl: "azeroth-archives://auth-callback",
};
