const STRIPE_API_BASE = "https://api.stripe.com/v1";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw);
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function parseJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const raw = await readBody(req);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function getAuthedUser(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseAnonKey = requireEnv("SUPABASE_ANON_KEY");
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) return null;
  return response.json();
}

async function stripeRequest(path, { method = "GET", form = null } = {}) {
  const stripeSecretKey = requireEnv("STRIPE_SECRET_KEY");
  const headers = {
    Authorization: `Bearer ${stripeSecretKey}`
  };
  let body;
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(form).toString();
  }
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method,
    headers,
    body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || "Stripe request failed.";
    throw new Error(message);
  }
  return payload;
}

function normalizeOrigin(req) {
  const forwardedProto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${forwardedProto}://${host}`;
}

async function findStripeCustomerBySupabaseUserId(userId, email) {
  const query = encodeURIComponent(`metadata['supabase_user_id']:'${userId}'`);
  try {
    const searchResult = await stripeRequest(`/customers/search?query=${query}&limit=1`);
    const direct = searchResult?.data?.[0];
    if (direct) return direct;
  } catch {
    // Search endpoint may be unavailable depending on Stripe account/API permissions.
  }
  if (!email) return null;
  const listResult = await stripeRequest(`/customers?email=${encodeURIComponent(email)}&limit=10`);
  return listResult?.data?.find((customer) => customer?.metadata?.supabase_user_id === userId) || null;
}

function isProFromSubscriptionStatus(status) {
  return ["active", "trialing", "past_due"].includes(status);
}

module.exports = {
  findStripeCustomerBySupabaseUserId,
  getAuthedUser,
  isProFromSubscriptionStatus,
  normalizeOrigin,
  parseJsonBody,
  sendJson,
  stripeRequest
};
