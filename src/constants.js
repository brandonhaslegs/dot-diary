export const STORAGE_KEY = "dot-diary-v1";
export const ONBOARDING_KEY = "dot-diary-onboarding-v1";
export const DEMO_MODE = new URLSearchParams(window.location.search).get("demo") === "1";
export const SUPABASE_URL = "https://onmrtxwqwyqyiicweffy.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_E9ZgVOUfB3EWjP1Njm5PJQ_c-maFufE";
export const SUGGESTED_DOT_TYPES = [
  { name: "Smoking", color: "#875436" },
  { name: "Drugs", color: "#FF0000" },
  { name: "Alcohol", color: "#FFC700" },
  { name: "Exercise", color: "#15C771" },
  { name: "Went Outside", color: "#B632CC" },
  { name: "Sex", color: "#2F8CFA" },
  { name: "Reading", color: "#FF7A59" },
  { name: "Meditation", color: "#6A4C93" },
  { name: "Cooking", color: "#00A676" },
  { name: "Restful Sleep", color: "#3A86FF" },
  { name: "Journaling", color: "#FB5607" },
  { name: "Sugar", color: "#8338EC" },
  { name: "Watered Plants", color: "#2A9D8F" },
  { name: "Shopping", color: "#E63946" },
  { name: "Studied", color: "#264653" },
  { name: "Therapy", color: "#8D99AE" },
  { name: "Family Time", color: "#F4A261" },
  { name: "Cleaned", color: "#118AB2" },
  { name: "Screentime", color: "#EF476F" },
  { name: "Creative Work", color: "#4CC9F0" },
  { name: "Caffeine", color: "#5C3A21" },
  { name: "Social Media", color: "#0A66C2" },
  { name: "Drawing", color: "#D97706" },
  { name: "Art", color: "#7C3AED" },
  { name: "Music", color: "#0F766E" },
  { name: "Movie", color: "#1D3557" },
  { name: "Exploring", color: "#2F8CFA" },
  { name: "Doomscrolling", color: "#8E9AAF" },
  { name: "Partying", color: "#FF6B6B" },
  { name: "Ate Meat", color: "#8D5524" },
  { name: "Travel", color: "#3D5A80" },
  { name: "Swimming", color: "#48CAE4" }
];
export const YEAR_BATCH_SIZE = 10;
export const MOBILE_MONTH_BATCH_SIZE = 12;
export const MODAL_ANIMATION_MS = 280;
export const POPOVER_ANIMATION_MS = 180;
export const AUTH_STATE_KEY = "dot-diary-authenticated";
export const AUTH_INTENT_KEY = "dot-diary-auth-intent";
export const DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);
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
