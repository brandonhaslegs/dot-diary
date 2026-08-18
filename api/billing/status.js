const {
  getUnlimitedEntitlement,
  getAuthedUser,
  sendJson
} = require("../_billing");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }
  try {
    const user = await getAuthedUser(req);
    if (!user?.id) {
      return sendJson(res, 401, { error: "Unauthorized." });
    }
    const entitlement = await getUnlimitedEntitlement(user);
    return sendJson(res, 200, {
      ...entitlement,
      // Compatibility for the existing client while it adopts feature flags.
      isPro: entitlement.isUnlimited
    });
  } catch (error) {
    return sendJson(res, 500, { error: error?.message || "Billing status failed." });
  }
};
