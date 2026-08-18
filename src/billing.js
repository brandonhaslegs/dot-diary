import { FREE_DOT_TYPE_LIMIT } from "./constants.js";
import { billingCancel, billingManage, billingStatus, billingUpgrade, billingUpgradeYearly, brandUnlimited } from "./dom.js";
import { requestRender } from "./state.js";
import { showToast } from "./toast.js";

let cachedFeatures = {
  unlimitedDotTypes: false,
  unlimitedCalendars: false,
  diarySharing: false,
  billingPortal: false
};
let fetchInFlight = null;
let fetchRequestId = 0;
let checkoutInFlight = false;
let portalInFlight = false;

/**
 * Returns true when the current user has an active Pro subscription.
 * Safe to call frequently — returns cached value synchronously.
 */
export function isPro() {
  return hasFeature("unlimitedDotTypes");
}

/** Returns whether the current account has a named server-authorized feature. */
export function hasFeature(feature) {
  return Boolean(cachedFeatures[feature]);
}

/** Returns whether the account can create a diary-sharing link. */
export function canShareDiary() {
  return hasFeature("diarySharing");
}

/**
 * Fetches the billing status from /api/billing/status and caches the result.
 * Requires a valid Supabase access token. Silently falls back to free tier
 * on any error so the app never breaks.
 */
export async function fetchBillingStatus(accessToken) {
  if (!accessToken) {
    updateBillingState();
    return;
  }
  const requestId = ++fetchRequestId;
  fetchInFlight = (async () => {
    try {
      const response = await fetch("/api/billing/status", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (requestId !== fetchRequestId) return;
      if (!response.ok) {
        updateBillingState();
        return;
      }
      const data = await response.json();
      if (requestId !== fetchRequestId) return;
      updateBillingState(data?.features);
    } catch {
      if (requestId !== fetchRequestId) return;
      updateBillingState();
    } finally {
      if (requestId === fetchRequestId) {
        fetchInFlight = null;
      }
    }
  })();
  return fetchInFlight;
}

/**
 * Resets the cached billing state (used on sign-out).
 */
export function resetBilling() {
  fetchRequestId += 1;
  fetchInFlight = null;
  updateBillingState();
}

/**
 * Returns the maximum number of dot types the user can create.
 * Pro users get Infinity (unlimited), free users get the configured limit.
 */
export function dotTypeLimit() {
  return hasFeature("unlimitedDotTypes") ? Infinity : FREE_DOT_TYPE_LIMIT;
}

/**
 * Returns true if the user can add another dot type, given their current count.
 */
export function canAddDotType(currentCount) {
  return currentCount < dotTypeLimit();
}

/**
 * Updates the billing section in Settings to reflect current tier.
 */
function renderBillingUI() {
  const unlimited = hasFeature("unlimitedDotTypes");
  if (brandUnlimited) brandUnlimited.classList.toggle("hidden", !unlimited);
  if (!billingStatus) return;
  if (unlimited) {
    billingStatus.textContent = "You've got Unlimited.";
    if (billingUpgrade) billingUpgrade.classList.add("hidden");
    if (billingUpgradeYearly) billingUpgradeYearly.classList.add("hidden");
    if (billingManage) billingManage.classList.toggle("hidden", !hasFeature("billingPortal"));
    if (billingCancel) billingCancel.classList.toggle("hidden", !hasFeature("billingPortal"));
  } else {
    billingStatus.textContent = `Free plan: up to ${FREE_DOT_TYPE_LIMIT} dot types.`;
    if (billingUpgrade) billingUpgrade.classList.remove("hidden");
    if (billingUpgradeYearly) billingUpgradeYearly.classList.remove("hidden");
    if (billingManage) billingManage.classList.add("hidden");
    if (billingCancel) billingCancel.classList.add("hidden");
  }
  if (billingUpgrade) billingUpgrade.disabled = checkoutInFlight;
  if (billingUpgradeYearly) billingUpgradeYearly.disabled = checkoutInFlight;
  if (billingManage) billingManage.disabled = portalInFlight;
  if (billingCancel) billingCancel.disabled = portalInFlight;
}

function updateBillingState(nextFeatures = {}) {
  const resolvedFeatures = {
    unlimitedDotTypes: Boolean(nextFeatures?.unlimitedDotTypes),
    unlimitedCalendars: Boolean(nextFeatures?.unlimitedCalendars),
    diarySharing: Boolean(nextFeatures?.diarySharing),
    billingPortal: Boolean(nextFeatures?.billingPortal)
  };
  const changed = Object.keys(resolvedFeatures).some(
    (feature) => cachedFeatures[feature] !== resolvedFeatures[feature]
  );
  cachedFeatures = resolvedFeatures;
  renderBillingUI();
  if (changed) requestRender();
}

/**
 * Opens a Stripe Checkout session for the given billing cycle.
 */
export async function startCheckout(accessToken, cycle = "monthly") {
  if (!accessToken) {
    showToast("Sign in first to upgrade.");
    return;
  }
  if (checkoutInFlight) return;
  checkoutInFlight = true;
  renderBillingUI();
  try {
    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ cycle })
    });
    const data = await response.json();
    if (data?.url) {
      window.location.href = data.url;
    } else {
      showToast(data?.error || "Could not start checkout.");
    }
  } catch {
    showToast("Could not start checkout.");
  } finally {
    checkoutInFlight = false;
    renderBillingUI();
  }
}

/**
 * Opens the Stripe Customer Portal so the user can manage their subscription.
 */
export async function openBillingPortal(accessToken) {
  if (!accessToken) {
    showToast("Sign in first to manage billing.");
    return;
  }
  if (portalInFlight) return;
  portalInFlight = true;
  renderBillingUI();
  try {
    const response = await fetch("/api/billing/portal", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });
    const data = await response.json();
    if (data?.url) {
      window.location.href = data.url;
    } else {
      showToast(data?.error || "Could not open billing portal.");
    }
  } catch {
    showToast("Could not open billing portal.");
  } finally {
    portalInFlight = false;
    renderBillingUI();
  }
}
