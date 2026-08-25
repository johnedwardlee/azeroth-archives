function syncHosts(supabaseUrl) {
  const hosts = new Set();
  try {
    if (supabaseUrl) hosts.add(new URL(supabaseUrl).hostname);
  } catch {
    // Invalid URLs keep live-sync networking disabled.
  }
  return hosts;
}

function isAllowedNetworkRequest(requestUrl, { devUrl, packaged, supabaseUrl, updateHosts = new Set(["api.github.com", "github.com"]) }) {
  if (devUrl && requestUrl.startsWith(devUrl)) return true;
  try {
    const url = new URL(requestUrl);
    if ((url.protocol === "https:" || url.protocol === "wss:") && syncHosts(supabaseUrl).has(url.hostname)) return true;
    return Boolean(packaged && url.protocol === "https:" && (updateHosts.has(url.hostname) || url.hostname.endsWith(".githubusercontent.com")));
  } catch {
    return false;
  }
}

module.exports = { isAllowedNetworkRequest, syncHosts };
