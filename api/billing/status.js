const {
  findStripeCustomerBySupabaseUserId,
  getAuthedUser,
  isProFromSubscriptionStatus,
  sendJson,
  stripeRequest
} = require("../_billing");

// Temporary early-access accounts receive the Unlimited plan while the billing
// rollout is in progress.
const UNLIMITED_BETA_EMAILS = new Set([
  "brandon.oxendine@gmail.com"
]);

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }
  try {
    const user = await getAuthedUser(req);
    if (!user?.id) {
      return sendJson(res, 401, { error: "Unauthorized." });
    }
    const isUnlimitedBeta = UNLIMITED_BETA_EMAILS.has(String(user.email || "").toLowerCase());
    const customer = await findStripeCustomerBySupabaseUserId(user.id, user.email);
    if (!customer?.id) {
      return sendJson(res, 200, {
        isPro: isUnlimitedBeta,
        tier: isUnlimitedBeta ? "unlimited" : "free",
        subscriptionStatus: isUnlimitedBeta ? "early_access" : "inactive",
        features: {
          diarySharing: isUnlimitedBeta
        }
      });
    }

    const subscriptions = await stripeRequest(
      `/subscriptions?customer=${encodeURIComponent(customer.id)}&status=all&limit=10`
    );
    const latestSubscription =
      subscriptions?.data
        ?.slice()
        ?.sort((a, b) => (b?.created || 0) - (a?.created || 0))
        ?.find((item) => item && item.status !== "canceled") || null;
    const subscriptionStatus = latestSubscription?.status || "inactive";
    const isPro = isProFromSubscriptionStatus(subscriptionStatus) || isUnlimitedBeta;
    const interval = latestSubscription?.items?.data?.[0]?.price?.recurring?.interval || null;

    return sendJson(res, 200, {
      isPro,
      tier: isPro ? "unlimited" : "free",
      subscriptionStatus,
      interval,
      features: {
        diarySharing: isPro
      }
    });
  } catch (error) {
    return sendJson(res, 500, { error: error?.message || "Billing status failed." });
  }
};
