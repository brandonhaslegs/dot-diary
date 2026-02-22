export function pickLatestCloudRow(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  let latest = null;
  let latestTimestamp = -1;
  rows.forEach((row) => {
    if (!row || typeof row !== "object") return;
    const timestamp = getCloudRowTimestamp(row);
    if (!latest || timestamp > latestTimestamp) {
      latest = row;
      latestTimestamp = timestamp;
    }
  });
  return latest;
}

function getCloudRowTimestamp(row) {
  const updatedAt = new Date(row?.updated_at || 0).getTime() || 0;
  const dataLastModified = new Date(row?.data?.lastModified || 0).getTime() || 0;
  return dataLastModified || updatedAt;
}

function mergeSettingsFromLocal(baseState, localState) {
  return {
    ...baseState,
    weekStartsMonday: Boolean(localState.weekStartsMonday),
    hideSuggestions: Boolean(localState.hideSuggestions),
    showKeyboardHints:
      typeof localState.showKeyboardHints === "boolean"
        ? localState.showKeyboardHints
        : baseState.showKeyboardHints,
    darkMode: typeof localState.darkMode === "boolean" ? localState.darkMode : baseState.darkMode
  };
}

export function mergeDiaryStates(localState, remoteState, { preferLocalSettings, preferLocalConflicts }) {
  const preferredState = preferLocalConflicts ? localState : remoteState;
  const fallbackState = preferLocalConflicts ? remoteState : localState;
  const settingsMerged = preferLocalSettings
    ? mergeSettingsFromLocal(remoteState, localState)
    : mergeSettingsFromLocal(localState, remoteState);
  const localTimestamp = new Date(localState.lastModified || 0).getTime() || 0;
  const remoteTimestamp = new Date(remoteState.lastModified || 0).getTime() || 0;
  const latestTimestamp = Math.max(localTimestamp, remoteTimestamp);

  const mergedDotTypes = mergeDotTypes(localState.dotTypes, remoteState.dotTypes, preferLocalConflicts);

  return {
    ...settingsMerged,
    monthCursor: preferredState.monthCursor || fallbackState.monthCursor,
    yearCursor: Number.isInteger(preferredState.yearCursor)
      ? preferredState.yearCursor
      : fallbackState.yearCursor,
    lastModified: latestTimestamp > 0 ? new Date(latestTimestamp).toISOString() : null,
    dotTypes: mergedDotTypes.dotTypes,
    dayDots: mergeDayDots(localState.dayDots, remoteState.dayDots, preferLocalConflicts, mergedDotTypes.idAliases),
    dotPositions: mergeDotPositions(
      localState.dotPositions,
      remoteState.dotPositions,
      preferLocalConflicts,
      mergedDotTypes.idAliases
    ),
    dayNotes: mergeDayNotes(localState.dayNotes, remoteState.dayNotes, preferLocalConflicts)
  };
}

function mergeDotTypes(localDotTypes, remoteDotTypes, preferLocalConflicts) {
  const merged = [];
  const indexById = new Map();
  const indexByName = new Map();
  const idAliases = new Map();
  const primary = preferLocalConflicts ? localDotTypes || [] : remoteDotTypes || [];
  const secondary = preferLocalConflicts ? remoteDotTypes || [] : localDotTypes || [];
  const normalizeName = (name) => String(name || "").trim().toLowerCase();

  const upsert = (dot, isPreferredSource) => {
    if (!dot || typeof dot !== "object") return;
    const dotId = typeof dot.id === "string" && dot.id.length > 0 ? dot.id : null;
    const dotNameKey = normalizeName(dot.name);
    const existingIndexById = dotId ? indexById.get(dotId) : undefined;
    const existingIndexByName = dotNameKey ? indexByName.get(dotNameKey) : undefined;
    const existingIndex = existingIndexById ?? existingIndexByName;

    if (existingIndex == null) {
      const nextDot = { ...dot };
      merged.push(nextDot);
      const nextIndex = merged.length - 1;
      if (dotId) indexById.set(dotId, nextIndex);
      if (dotNameKey) indexByName.set(dotNameKey, nextIndex);
      return;
    }

    const existingDot = merged[existingIndex];
    const existingId =
      existingDot && typeof existingDot.id === "string" && existingDot.id.length > 0 ? existingDot.id : null;
    if (dotId && existingId && dotId !== existingId) {
      idAliases.set(dotId, existingId);
    }

    if (isPreferredSource) {
      merged[existingIndex] = {
        ...existingDot,
        ...dot,
        // Keep the canonical ID stable so all remapped day entries stay consistent.
        id: existingId || dotId || existingDot?.id || dot?.id
      };
      const finalNameKey = normalizeName(merged[existingIndex]?.name);
      const finalId = merged[existingIndex]?.id;
      if (typeof finalId === "string" && finalId.length > 0) indexById.set(finalId, existingIndex);
      if (finalNameKey) indexByName.set(finalNameKey, existingIndex);
    }
  };

  primary.forEach((dot) => upsert(dot, true));
  secondary.forEach((dot) => upsert(dot, false));
  return {
    dotTypes: merged,
    idAliases
  };
}

function getDotTypeKey(dot) {
  if (typeof dot.id === "string" && dot.id.length > 0) return `id:${dot.id}`;
  const name = typeof dot.name === "string" ? dot.name : "";
  const color = typeof dot.color === "string" ? dot.color : "";
  return `anon:${name}|${color}`;
}

function mapDotId(dotId, idAliases) {
  if (!idAliases || !(idAliases instanceof Map)) return dotId;
  if (typeof dotId !== "string") return dotId;
  const mapped = idAliases.get(dotId);
  return typeof mapped === "string" && mapped.length > 0 ? mapped : dotId;
}

function mergeDayDots(localDayDots, remoteDayDots, preferLocalConflicts, idAliases) {
  const merged = {};
  const allDates = new Set([...Object.keys(remoteDayDots || {}), ...Object.keys(localDayDots || {})]);
  for (const isoDate of allDates) {
    const primarySource = preferLocalConflicts ? localDayDots?.[isoDate] : remoteDayDots?.[isoDate];
    const secondarySource = preferLocalConflicts ? remoteDayDots?.[isoDate] : localDayDots?.[isoDate];
    const primary = Array.isArray(primarySource) ? primarySource.map((dotId) => mapDotId(dotId, idAliases)) : [];
    const secondary = Array.isArray(secondarySource) ? secondarySource.map((dotId) => mapDotId(dotId, idAliases)) : [];
    const dotIds = dedupeDotIds([...(primary || []), ...(secondary || [])]);
    if (dotIds.length > 0) {
      merged[isoDate] = dotIds;
    }
  }
  return merged;
}

function dedupeDotIds(dotIds) {
  const seen = new Set();
  const deduped = [];
  dotIds.forEach((dotId) => {
    if (typeof dotId !== "string" || seen.has(dotId)) return;
    seen.add(dotId);
    deduped.push(dotId);
  });
  return deduped;
}

function normalizeDayPositions(dayPositions, idAliases) {
  const normalized = {};
  const source = dayPositions && typeof dayPositions === "object" ? dayPositions : {};
  Object.entries(source).forEach(([dotId, position]) => {
    const mappedId = mapDotId(dotId, idAliases);
    if (typeof mappedId !== "string" || !mappedId) return;
    normalized[mappedId] = position;
  });
  return normalized;
}

function mergeDotPositions(localPositions, remotePositions, preferLocalConflicts, idAliases) {
  const merged = {};
  const allDates = new Set([...Object.keys(remotePositions || {}), ...Object.keys(localPositions || {})]);
  for (const isoDate of allDates) {
    const localDay = normalizeDayPositions(localPositions?.[isoDate], idAliases);
    const remoteDay = normalizeDayPositions(remotePositions?.[isoDate], idAliases);
    const nextDay = preferLocalConflicts ? { ...remoteDay, ...localDay } : { ...localDay, ...remoteDay };
    if (Object.keys(nextDay).length > 0) {
      merged[isoDate] = nextDay;
    }
  }
  return merged;
}

function mergeDayNotes(localNotes, remoteNotes, preferLocalConflicts) {
  const merged = {};
  const allDates = new Set([...Object.keys(remoteNotes || {}), ...Object.keys(localNotes || {})]);
  for (const isoDate of allDates) {
    const localNote = typeof localNotes?.[isoDate] === "string" ? localNotes[isoDate] : "";
    const remoteNote = typeof remoteNotes?.[isoDate] === "string" ? remoteNotes[isoDate] : "";
    const primary = preferLocalConflicts ? localNote : remoteNote;
    const secondary = preferLocalConflicts ? remoteNote : localNote;
    const nextNote = primary || secondary;
    if (nextNote) {
      merged[isoDate] = nextNote;
    }
  }
  return merged;
}

export function areStatesEqual(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
