const {
  findStripeCustomerBySupabaseUserId,
  getAuthedUser,
  normalizeOrigin,
  parseJsonBody,
  sendJson,
  stripeRequest
} = require("../_billing");

const PRICE_ENV_BY_CYCLE = {
  monthly: "STRIPE_PRICE_MONTHLY",
  yearly: "STRIPE_PRICE_YEARLY"
};

async function findLatestSubscription(customerId) {
  const subscriptions = await stripeRequest(
    `/subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=10`
  );
  return (
    subscriptions?.data
      ?.slice()
      ?.sort((a, b) => (b?.created || 0) - (a?.created || 0))
      ?.find((item) => item && item.status !== "canceled" && item.status !== "incomplete_expired") || null
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }
  try {
    const user = await getAuthedUser(req);
    if (!user?.id) {
      return sendJson(res, 401, { error: "Unauthorized." });
    }
    const body = await parseJsonBody(req);
    const cycle = body?.cycle === "yearly" ? "yearly" : "monthly";
    const priceId = process.env[PRICE_ENV_BY_CYCLE[cycle]];
    if (!priceId) {
      return sendJson(res, 500, { error: "Price ID not configured." });
    }

    let customer = await findStripeCustomerBySupabaseUserId(user.id, user.email);
    if (!customer) {
      customer = await stripeRequest("/customers", {
        method: "POST",
        form: {
          email: user.email || "",
          "metadata[supabase_user_id]": user.id
        }
      });
    }

    const existingSubscription = await findLatestSubscription(customer.id);
    if (existingSubscription && ["active", "trialing", "past_due", "unpaid"].includes(existingSubscription.status)) {
      return sendJson(res, 409, { error: "You already have an active subscription. Manage it in billing." });
    }

    const origin = process.env.PUBLIC_APP_URL || normalizeOrigin(req);
    const session = await stripeRequest("/checkout/sessions", {
      method: "POST",
      form: {
        mode: "subscription",
        customer: customer.id,
        client_reference_id: user.id,
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        "allow_promotion_codes": "true",
        "subscription_data[metadata][supabase_user_id]": user.id,
        success_url: `${origin}/?checkout=success`,
        cancel_url: `${origin}/?checkout=cancel`
      }
    });

    return sendJson(res, 200, { url: session?.url || null });
  } catch (error) {
    return sendJson(res, 500, { error: error?.message || "Checkout failed." });
  }
};
