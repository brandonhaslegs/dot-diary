const { sendJson } = require("../_billing");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed." });
  try {
    const id = String(req.query?.id || "");
    if (!/^[A-Za-z0-9_-]{8,32}$/.test(id)) return sendJson(res, 400, { error: "Invalid share link." });
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const anonKey = requireEnv("SUPABASE_ANON_KEY");
    const response = await fetch(
      `${supabaseUrl}/rest/v1/public_shares?id=eq.${encodeURIComponent(id)}&select=data`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } }
    );
    if (!response.ok) throw new Error(await response.text());
    const rows = await response.json();
    if (!rows?.[0]?.data) return sendJson(res, 404, { error: "This share link no longer exists." });
    return sendJson(res, 200, { data: rows[0].data });
  } catch (error) {
    return sendJson(res, 500, { error: error?.message || "Could not open share link." });
  }
};
