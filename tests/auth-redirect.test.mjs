import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = {
  location: {
    search: "",
    hostname: "localhost"
  }
};

const { getMagicLinkRedirectTargets } = await import("../src/auth-redirect.mjs");

test("prefers canonical redirect for localhost auth testing", () => {
  const targets = getMagicLinkRedirectTargets({
    origin: "http://127.0.0.1:5173",
    hostname: "127.0.0.1",
    pathname: "/"
  });

  assert.deepEqual(targets, ["https://dot-diary.vercel.app/", null, "http://127.0.0.1:5173/"]);
});

test("prefers canonical redirect for vercel preview deployments", () => {
  const targets = getMagicLinkRedirectTargets({
    origin: "https://dot-diary-git-feat-react-rebuild-pwa-brandonhaslegs.vercel.app",
    hostname: "dot-diary-git-feat-react-rebuild-pwa-brandonhaslegs.vercel.app",
    pathname: "/"
  });

  assert.deepEqual(targets, [
    "https://dot-diary.vercel.app/",
    null,
    "https://dot-diary-git-feat-react-rebuild-pwa-brandonhaslegs.vercel.app/"
  ]);
});

test("prefers current origin on production host", () => {
  const targets = getMagicLinkRedirectTargets({
    origin: "https://dot-diary.vercel.app",
    hostname: "dot-diary.vercel.app",
    pathname: "/settings"
  });

  assert.deepEqual(targets, ["https://dot-diary.vercel.app/settings", null]);
});
