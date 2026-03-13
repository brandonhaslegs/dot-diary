import { CANONICAL_APP_URL } from "./constants.js";

function buildRedirectUrl(baseUrl, pathname) {
  if (!baseUrl) return null;
  try {
    const url = new URL(baseUrl);
    url.pathname = pathname || "/";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function isVercelPreviewHost(hostname) {
  return hostname.endsWith(".vercel.app") && hostname !== "dot-diary.vercel.app";
}

export function getMagicLinkRedirectTargets(locationLike) {
  const hostname = String(locationLike?.hostname || "");
  const pathname = String(locationLike?.pathname || "/");
  const origin = String(locationLike?.origin || "");
  const currentUrl = buildRedirectUrl(origin, pathname);
  const canonicalUrl = buildRedirectUrl(CANONICAL_APP_URL, pathname);
  const targets = [];

  if (hostname === "localhost" || hostname === "127.0.0.1" || isVercelPreviewHost(hostname)) {
    targets.push(canonicalUrl, null, currentUrl);
  } else {
    targets.push(currentUrl, null, canonicalUrl);
  }

  return targets.filter((target, index) => targets.indexOf(target) === index && target !== "");
}
