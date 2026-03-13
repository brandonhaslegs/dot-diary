// Local persistence keys used for local-dev diary testing only.
export const STORAGE_KEY = "dot-diary-v1";
export const STORAGE_SESSION_FALLBACK_KEY = "dot-diary-v1-session";
// Development hostnames that enable local-only behaviors (auto reload checks).
export const DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);

// Optional demo dataset toggle via URL query string (`?demo=1`).
export const DEMO_MODE = new URLSearchParams(window.location.search).get("demo") === "1";
// Local development mode (no login required, cloud sync disabled) for localhost testing.
// Override with `?local=0` to test real auth locally.
export const LOCAL_DEV_MODE =
  DEV_HOSTS.has(window.location.hostname) && new URLSearchParams(window.location.search).get("local") !== "0";
export const CLOUD_ONLY_DIARY = !DEMO_MODE && !LOCAL_DEV_MODE;

// Supabase project configuration for passwordless auth + cloud sync.
export const SUPABASE_URL = "https://onmrtxwqwyqyiicweffy.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_E9ZgVOUfB3EWjP1Njm5PJQ_c-maFufE";
export const CANONICAL_APP_URL = "https://dot-diary.vercel.app";

// Starter suggestions shown when users create their first dot types.
export const SUGGESTED_DOT_TYPES = [
	{ name: "Reading", color: "#FF7A59" },
	{ name: "Cooking", color: "#00A676" },
	{ name: "Smoking", color: "#875436" },
	{ name: "Sugar", color: "#8338EC" },
	{ name: "Alcohol", color: "#FFC700" },
	{ name: "Exercise", color: "#15C771" },
	{ name: "Enough Sleep", color: "#FF9F1C" },
	{ name: "Journal", color: "#FB5607" },
	{ name: "Sex", color: "#2F8CFA" },
  { name: "Study", color: "#264653" },
  { name: "Crafting", color: "#4CC9F0" },
  { name: "Cleaning", color: "#118AB2" },
  { name: "Outside", color: "#B632CC" },
  { name: "Meditation", color: "#6A4C93" },
  { name: "Music", color: "#0F766E" },
  { name: "Family time", color: "#F4A261" },
  { name: "Screentime", color: "#EF476F" },
  { name: "Doomscrolling", color: "#8E9AAF" },
  { name: "Caffeine", color: "#5C3A21" },
  { name: "Therapy", color: "#7B2CBF" },
  { name: "Travel", color: "#3D5A80" },
  { name: "Social Media", color: "#0A66C2" },
  { name: "Shopping", color: "#E63946" },
  { name: "Drawing", color: "#D97706" },
  { name: "Movie", color: "#1D3557" },
  { name: "Drugs", color: "#FF0000" },
  { name: "Swim", color: "#48CAE4" },
  { name: "Meat", color: "#8D5524" },
  { name: "Exploring", color: "#6C5CE7" }
];

// Incremental loading/timing constants used by period picker and modal animations.
export const YEAR_BATCH_SIZE = 10;
export const MOBILE_MONTH_BATCH_SIZE = 12;
export const DOT_NAME_MAX_LENGTH = 24;
export const MODAL_ANIMATION_MS = 280;
export const POPOVER_ANIMATION_MS = 180;

// Auth and sync local flags.
export const AUTH_INTENT_KEY = "dot-diary-auth-intent";
export const SYNC_DIRTY_KEY = "dot-diary-sync-dirty";

// Shared color list used when auto-picking colors for new dot types.
export const COLOR_PALETTE = [
  "#FF0000",
  "#FFC700",
  "#15C771",
  "#2F8CFA",
  "#B632CC",
  "#875436",
  "#FF7A59",
  "#00A676",
  "#0A66C2",
  "#8338EC",
  "#1D3557",
  "#0F766E"
];
