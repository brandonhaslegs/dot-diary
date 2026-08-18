import {
  copyShareLinkButton,
  shareLinkInput,
  shareLinkResult,
  shareModal,
  shareSelectAllButton,
  shareSelection
} from "./dom.js";
import { canShareDiary } from "./billing.js";
import { DEMO_MODE } from "./constants.js";
import { getAccessToken } from "./auth.js";
import { defaultState, normalizeImportedState, setState } from "./state.js";
import { showSharedDiary } from "./ui.js";
import { state } from "./state.js";
import { showToast } from "./toast.js";

const SHARE_PREFIX = "share=";
const COMPRESSED_SHARE_PREFIX = "share-gz=";
let shareGenerateTimer = null;
let shareGenerationVersion = 0;

function encodeBytes(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBytes(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function encodePayload(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  if (typeof CompressionStream !== "function") return { value: encodeBytes(bytes), compressed: false };
  const compressed = await new Response(
    new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"))
  ).arrayBuffer();
  return { value: encodeBytes(new Uint8Array(compressed)), compressed: true };
}

async function decodePayload(value, compressed) {
  let bytes = decodeBytes(value);
  if (compressed) {
    if (typeof DecompressionStream !== "function") throw new Error("This browser cannot open compressed share links.");
    bytes = new Uint8Array(await new Response(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))
    ).arrayBuffer());
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function shareYears() {
  const years = new Set();
  Object.keys(state.dayDots || {}).forEach((iso) => years.add(iso.slice(0, 4)));
  Object.keys(state.dayNotes || {}).forEach((iso) => years.add(iso.slice(0, 4)));
  return [...years].sort((a, b) => b.localeCompare(a));
}

function checkbox(id, label, { color = "", detail = "" } = {}) {
  const item = document.createElement("label");
  item.className = "share-option";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.value = id;
  input.dataset.shareOption = id;
  const text = document.createElement("span");
  text.className = "share-option-label";
  if (color) {
    const dot = document.createElement("i");
    dot.className = "share-option-dot";
    dot.style.background = color;
    text.append(dot);
  }
  text.append(document.createTextNode(label));
  item.append(input, text);
  if (detail) {
    const small = document.createElement("small");
    small.textContent = detail;
    item.append(small);
  }
  return item;
}

function section(title, options) {
  const group = document.createElement("section");
  group.className = "share-option-group";
  const heading = document.createElement("h4");
  heading.textContent = title;
  group.append(heading, ...options);
  return group;
}

function selectedOptions() {
  const values = Array.from(shareSelection?.querySelectorAll("input:checked") || []).map((input) => input.value);
  return {
    years: new Set(values.filter((value) => value.startsWith("year:")).map((value) => value.slice(5))),
    dotIds: new Set(values.filter((value) => value.startsWith("dot:")).map((value) => value.slice(4))),
    notes: values.includes("notes")
  };
}

export function updateShareSelection({ shouldGenerate = true } = {}) {
  const selection = selectedOptions();
  const isValid = selection.years.size > 0 && (selection.dotIds.size > 0 || selection.notes);
  if (shareSelectAllButton) {
    const inputs = Array.from(shareSelection?.querySelectorAll("input") || []);
    const everyOptionIsSelected = inputs.length > 0 && inputs.every((input) => input.checked);
    shareSelectAllButton.textContent = everyOptionIsSelected ? "Clear all" : "Select all";
  }
  if (shouldGenerate) queueShareLinkGeneration(isValid);
}

function queueShareLinkGeneration(isValid) {
  if (shareGenerateTimer) clearTimeout(shareGenerateTimer);
  const version = ++shareGenerationVersion;
  if (!isValid) {
    shareLinkResult?.classList.add("hidden");
    return;
  }
  if (shareLinkInput) shareLinkInput.value = "Updating link…";
  if (copyShareLinkButton) copyShareLinkButton.disabled = true;
  shareLinkResult?.classList.remove("hidden");
  shareGenerateTimer = window.setTimeout(() => generateShareLink(version), 350);
}

export function toggleShareSelectAll() {
  const inputs = Array.from(shareSelection?.querySelectorAll("input") || []);
  const shouldSelect = !inputs.every((input) => input.checked);
  inputs.forEach((input) => { input.checked = shouldSelect; });
  updateShareSelection();
}

export function openShareModal() {
  if (!canShareDiary() && !DEMO_MODE) {
    showToast("Sharing is available with Unlimited. Upgrade in Settings to unlock it.");
    return;
  }
  if (!shareModal || !shareSelection) return;
  shareSelection.replaceChildren();
  const years = shareYears();
  shareSelection.append(
    section("Years", years.length ? years.map((year) => checkbox(`year:${year}`, year)) : [checkbox("year:none", "No diary entries yet")]),
    section("Dot types", state.dotTypes.length
      ? state.dotTypes.map((dot) => checkbox(`dot:${dot.id}`, dot.name, { color: dot.color }))
      : [checkbox("dot:none", "No dot types yet")]),
    section("Notes", [checkbox("notes", "Include notes")])
  );
  const yearsHeading = shareSelection.querySelector(".share-option-group h4");
  if (yearsHeading && shareSelectAllButton) yearsHeading.append(shareSelectAllButton);
  shareSelection.querySelectorAll("input").forEach((input) => { input.checked = true; });
  shareLinkResult?.classList.add("hidden");
  updateShareSelection();
  shareModal.classList.remove("hidden");
  requestAnimationFrame(() => shareModal.classList.add("visible"));
  shareSelection.querySelector("input")?.focus();
}

export function closeShareModal() {
  if (!shareModal || shareModal.classList.contains("hidden")) return;
  shareModal.classList.remove("visible");
  if (shareGenerateTimer) clearTimeout(shareGenerateTimer);
  shareGenerateTimer = null;
  shareGenerationVersion += 1;
  window.setTimeout(() => shareModal.classList.add("hidden"), 280);
}

async function generateShareLink(version) {
  const selected = selectedOptions();
  if (selected.years.size === 0 || (selected.dotIds.size === 0 && !selected.notes)) return;
  const inScope = (iso) => selected.years.has(iso.slice(0, 4));
  const dayDots = {};
  Object.entries(state.dayDots || {}).forEach(([iso, ids]) => {
    if (!inScope(iso)) return;
    const included = ids.filter((id) => selected.dotIds.has(id));
    if (included.length) dayDots[iso] = included;
  });
  const dayNotes = {};
  if (selected.notes) {
    Object.entries(state.dayNotes || {}).forEach(([iso, note]) => {
      if (inScope(iso)) dayNotes[iso] = note;
    });
  }
  const payload = {
    version: 1,
    years: [...selected.years].sort(),
    dotTypes: state.dotTypes.filter((dot) => selected.dotIds.has(dot.id)).map(({ id, name, color }) => ({ id, name, color })),
    dayDots,
    dayNotes
  };
  const token = await getAccessToken();
  if (!token) {
    if (version === shareGenerationVersion) showToast("Sign in to create a share link.");
    return;
  }
  let link;
  try {
    const response = await fetch("/api/shares/create", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ data: payload })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.id) {
      const localStaticServer = ["localhost", "127.0.0.1"].includes(window.location.hostname);
      throw new Error(
        result?.error || (localStaticServer
          ? "Short links need the app API. Test this from a Vercel preview or production deployment."
          : "Could not create share link.")
      );
    }
    link = `${window.location.origin}${window.location.pathname}?share=${encodeURIComponent(result.id)}`;
  } catch (error) {
    if (version === shareGenerationVersion) showToast(error?.message || "Could not create share link.");
    return;
  }
  if (version !== shareGenerationVersion) return;
  if (shareLinkInput) shareLinkInput.value = link;
  if (copyShareLinkButton) copyShareLinkButton.disabled = false;
  shareLinkResult?.classList.remove("hidden");
}

export async function copyShareLink() {
  const link = shareLinkInput?.value;
  if (!link) return;
  try {
    await navigator.clipboard.writeText(link);
  } catch {
    shareLinkInput?.select();
    document.execCommand("copy");
  }
  if (copyShareLinkButton) copyShareLinkButton.textContent = "Copied";
  showToast("Share link copied.");
  window.setTimeout(() => { if (copyShareLinkButton) copyShareLinkButton.textContent = "Copy"; }, 1800);
}

function renderSharedDiary(payload) {
  const years = (payload.years || []).map(Number).filter(Number.isInteger).sort((a, b) => b - a);
  const year = years[0] || new Date().getFullYear();
  const sharedState = normalizeImportedState({
    ...structuredClone(defaultState),
    dotTypes: payload.dotTypes || [],
    dayDots: payload.dayDots || {},
    dayNotes: payload.dayNotes || {},
    dotPositions: {},
    filterDotTypeIds: [],
    showCalendarNotes: true,
    yearCursor: year,
    monthCursor: new Date(year, 0, 1).toISOString()
  });
  sharedState.yearCursor = year;
  sharedState.monthCursor = new Date(year, 0, 1).toISOString();
  setState(sharedState);
  showSharedDiary();
  document.title = "Shared Dot Diary";
}

async function renderSharedLinkIfPresent() {
  const fragment = window.location.hash.slice(1);
  const shareId = new URLSearchParams(window.location.search).get("share");
  if (shareId) {
    try {
      const response = await fetch(`/api/shares/${encodeURIComponent(shareId)}`);
      const result = await response.json();
      if (!response.ok || !result?.data) throw new Error(result?.error || "This share link is invalid.");
      renderSharedDiary(result.data);
    } catch (error) {
      document.body.innerHTML = `<main class="shared-diary"><h1>We couldn’t open this share link.</h1><p>${error?.message || "Ask the person who shared it to make a new link."}</p></main>`;
    }
    return;
  }
  const compressed = fragment.startsWith(COMPRESSED_SHARE_PREFIX);
  if (!compressed && !fragment.startsWith(SHARE_PREFIX)) return;
  try {
    const prefix = compressed ? COMPRESSED_SHARE_PREFIX : SHARE_PREFIX;
    const payload = await decodePayload(fragment.slice(prefix.length), compressed);
    if (payload?.version !== 1) throw new Error("Unsupported share link");
    renderSharedDiary(payload);
  } catch {
    document.body.innerHTML = '<main class="shared-diary"><h1>This share link is invalid.</h1><p>Ask the person who shared it to make a new link.</p></main>';
  }
}

renderSharedLinkIfPresent();
