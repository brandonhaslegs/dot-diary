const {
  findStripeCustomerBySupabaseUserId,
  getAuthedUser,
  isProFromSubscriptionStatus,
  parseJsonBody,
  sendJson,
  stripeRequest
} = require("../_billing");
const { randomBytes } = require("crypto");

const DIARY_SHARING_BETA_EMAILS = new Set(["brandon.oxendine@gmail.com"]);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function createShareId() {
  return randomBytes(9).toString("base64url");
}

async function canCreateShare(user) {
  if (DIARY_SHARING_BETA_EMAILS.has(String(user.email || "").toLowerCase())) return true;
  const customer = await findStripeCustomerBySupabaseUserId(user.id, user.email);
  if (!customer?.id) return false;
  const subscriptions = await stripeRequest(`/subscriptions?customer=${encodeURIComponent(customer.id)}&status=all&limit=10`);
  return subscriptions?.data?.some((subscription) => isProFromSubscriptionStatus(subscription?.status));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });
  try {
    const user = await getAuthedUser(req);
    if (!user?.id) return sendJson(res, 401, { error: "Sign in to create a share link." });
    if (!await canCreateShare(user)) return sendJson(res, 403, { error: "Diary sharing is available with Pro." });
    const body = await parseJsonBody(req);
    const data = body?.data;
    if (!data || typeof data !== "object") return sendJson(res, 400, { error: "Share data is required." });
    if (Buffer.byteLength(JSON.stringify(data), "utf8") > 1_000_000) {
      return sendJson(res, 413, { error: "That selection is too large to share." });
    }

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const anonKey = requireEnv("SUPABASE_ANON_KEY");
    const authorization = req.headers.authorization;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const id = createShareId();
      const response = await fetch(`${supabaseUrl}/rest/v1/public_shares`, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: authorization,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify({ id, user_id: user.id, data })
      });
      if (response.ok) return sendJson(res, 201, { id });
      if (response.status !== 409) throw new Error(await response.text());
    }
    throw new Error("Could not reserve a share link ID.");
  } catch (error) {
    const rawMessage = error?.message || "";
    const missingTable = rawMessage.includes("PGRST205") || rawMessage.includes("public_shares");
    return sendJson(res, 500, {
      error: missingTable
        ? "Share storage has not been set up yet. Run the public_shares Supabase migration, then try again."
        : rawMessage || "Could not create share link."
    });
  }
};
