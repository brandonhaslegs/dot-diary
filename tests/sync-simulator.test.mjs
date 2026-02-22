import test from "node:test";
import assert from "node:assert/strict";

import { areStatesEqual, mergeDiaryStates, pickLatestCloudRow } from "../src/sync-core.mjs";

function baseState(lastModified) {
  return {
    monthCursor: "2026-02-01T00:00:00.000Z",
    yearCursor: 2026,
    weekStartsMonday: false,
    hideSuggestions: false,
    showKeyboardHints: true,
    darkMode: null,
    lastModified,
    dotTypes: [{ id: "reading", name: "Reading", color: "#ff7a59" }],
    dayDots: {},
    dotPositions: {},
    dayNotes: {}
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createCloud(rows = []) {
  return { rows: rows.map((row) => clone(row)) };
}

function selectLatest(cloud, userId) {
  return pickLatestCloudRow(cloud.rows.filter((row) => row.user_id === userId));
}

function writeState(cloud, userId, nextState) {
  const existing = cloud.rows.filter((row) => row.user_id === userId);
  const updatedAt = new Date().toISOString();
  if (existing.length === 0) {
    cloud.rows.push({ user_id: userId, data: clone(nextState), updated_at: updatedAt });
    return;
  }
  cloud.rows = cloud.rows.map((row) =>
    row.user_id === userId ? { ...row, data: clone(nextState), updated_at: updatedAt } : row
  );
}

function syncDevice(cloud, device) {
  const latestRow = selectLatest(cloud, device.userId);
  if (!latestRow?.data) {
    writeState(cloud, device.userId, device.state);
    return;
  }
  const remote = clone(latestRow.data);
  const localTimestamp = new Date(device.state.lastModified || 0).getTime() || 0;
  const remoteTimestamp = new Date(remote.lastModified || 0).getTime() || 0;
  const preferLocalConflicts = localTimestamp >= remoteTimestamp;
  const merged = mergeDiaryStates(device.state, remote, {
    preferLocalSettings: preferLocalConflicts,
    preferLocalConflicts
  });
  const remoteNeedsUpdate = !areStatesEqual(remote, merged);
  device.state = merged;
  if (remoteNeedsUpdate) {
    writeState(cloud, device.userId, merged);
  }
}

test("picks newest row when duplicate cloud rows exist", () => {
  const stale = baseState("2026-02-01T09:00:00.000Z");
  stale.dayNotes["2026-02-01"] = "stale";

  const fresh = baseState("2026-02-01T10:00:00.000Z");
  fresh.dayNotes["2026-02-01"] = "fresh";

  const cloud = createCloud([
    { user_id: "u1", data: stale, updated_at: "2026-02-01T09:00:01.000Z" },
    { user_id: "u1", data: fresh, updated_at: "2026-02-01T10:00:01.000Z" }
  ]);
  const latest = selectLatest(cloud, "u1");

  assert.equal(latest?.data?.dayNotes?.["2026-02-01"], "fresh");
});

test("prefers newest diary snapshot over newer row timestamp", () => {
  const oldData = baseState("2026-02-01T09:00:00.000Z");
  oldData.dayNotes["2026-02-01"] = "old";
  const newData = baseState("2026-02-01T11:00:00.000Z");
  newData.dayNotes["2026-02-01"] = "new";

  const cloud = createCloud([
    // Row timestamp is newer, but diary snapshot is older.
    { user_id: "u1", data: oldData, updated_at: "2026-02-01T12:00:00.000Z" },
    // Row timestamp is older, but diary snapshot is newer.
    { user_id: "u1", data: newData, updated_at: "2026-02-01T10:00:00.000Z" }
  ]);

  const latest = selectLatest(cloud, "u1");
  assert.equal(latest?.data?.dayNotes?.["2026-02-01"], "new");
});

test("two devices converge with cross edits and duplicate cloud history", () => {
  const cloud = createCloud([
    {
      user_id: "u1",
      data: { ...baseState("2026-02-01T09:00:00.000Z"), dayNotes: { "2026-02-01": "old" } },
      updated_at: "2026-02-01T09:00:01.000Z"
    },
    {
      user_id: "u1",
      data: { ...baseState("2026-02-01T10:00:00.000Z"), dayNotes: { "2026-02-01": "newest remote" } },
      updated_at: "2026-02-01T10:00:01.000Z"
    }
  ]);

  const deviceA = { userId: "u1", state: baseState("2026-02-01T10:30:00.000Z") };
  const deviceB = { userId: "u1", state: baseState("2026-02-01T10:35:00.000Z") };

  deviceA.state.dayNotes["2026-02-02"] = "A note";
  deviceB.state.dayNotes["2026-02-03"] = "B note";

  syncDevice(cloud, deviceA);
  syncDevice(cloud, deviceB);
  syncDevice(cloud, deviceA);
  syncDevice(cloud, deviceB);

  assert.equal(deviceA.state.dayNotes["2026-02-02"], "A note");
  assert.equal(deviceA.state.dayNotes["2026-02-03"], "B note");
  assert.ok(areStatesEqual(deviceA.state, deviceB.state));
});
