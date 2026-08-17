const {
  findStripeCustomerBySupabaseUserId,
  getAuthedUser,
  normalizeOrigin,
  sendJson,
  stripeRequest
} = require("../_billing");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }
  try {
    const user = await getAuthedUser(req);
    if (!user?.id) {
      return sendJson(res, 401, { error: "Unauthorized." });
    }
    const customer = await findStripeCustomerBySupabaseUserId(user.id, user.email);
    if (!customer?.id) {
      return sendJson(res, 404, { error: "No Stripe customer found." });
    }
    const origin = process.env.PUBLIC_APP_URL || normalizeOrigin(req);
    const session = await stripeRequest("/billing_portal/sessions", {
      method: "POST",
      form: {
        customer: customer.id,
        return_url: `${origin}/`
      }
    });
    return sendJson(res, 200, { url: session?.url || null });
  } catch (error) {
    return sendJson(res, 500, { error: error?.message || "Billing portal failed." });
  }
};
