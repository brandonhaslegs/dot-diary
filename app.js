const STORAGE_KEY = "dot-diary-v1";
const FIRST_LOAD_SETTINGS_KEY = "dot-diary-settings-shown-v1";
const DEMO_MODE = new URLSearchParams(window.location.search).get("demo") === "1";
const SUGGESTED_DOT_TYPES = [
  { name: "Smoking", color: "#875436" },
  { name: "Drugs", color: "#FF0000" },
  { name: "Alcohol", color: "#FFC700" },
  { name: "Exercise", color: "#15C771" },
  { name: "Went Outside", color: "#B632CC" },
  { name: "Sex", color: "#2F8CFA" },
  { name: "Reading", color: "#FF7A59" },
  { name: "Meditation", color: "#6A4C93" },
  { name: "Cooking", color: "#00A676" },
  { name: "Slept Well", color: "#3A86FF" },
  { name: "Journaling", color: "#FB5607" },
  { name: "Sugar", color: "#8338EC" },
  { name: "Watered Plants", color: "#2A9D8F" },
  { name: "No Spending", color: "#E63946" },
  { name: "Studied", color: "#264653" },
  { name: "Therapy", color: "#8D99AE" },
  { name: "Family Time", color: "#F4A261" },
  { name: "Cleaned", color: "#118AB2" },
  { name: "Screen-Free Hour", color: "#EF476F" },
  { name: "Creative Work", color: "#4CC9F0" },
  { name: "Caffeine", color: "#5C3A21" },
  { name: "Social Media", color: "#0A66C2" },
  { name: "Drawing", color: "#D97706" },
  { name: "Art", color: "#7C3AED" },
  { name: "Music", color: "#0F766E" },
  { name: "Movie", color: "#1D3557" }
];

const defaultState = {
  monthCursor: startOfMonth(new Date()).toISOString(),
  yearCursor: new Date().getFullYear(),
  weekStartsMonday: false,
  darkMode: false,
  dotTypes: [],
  dayDots: {},
  dotPositions: {},
  dayNotes: {}
};

let state = DEMO_MODE ? createDemoState() : loadState();
let activePopover = null;
let pendingFocusDotId = null;
let pendingDeleteDotTypeId = null;
let pendingDeleteMode = "safe";
let pendingDeleteDotTypeName = "";
let loadedYearBatchCount = 1;
let loadedMobileMonthCount = 12;
let periodLoadInProgress = false;
let toastTimer = null;
let toastHideTimer = null;
let suppressDayOpenUntil = 0;
let settingsModalHideTimer = null;
let popoverHideTimer = null;
const shuffledSuggestions = shuffleArray(SUGGESTED_DOT_TYPES);
const YEAR_BATCH_SIZE = 10;
const MOBILE_MONTH_BATCH_SIZE = 12;
const MODAL_ANIMATION_MS = 280;
const POPOVER_ANIMATION_MS = 180;

const yearGrid = document.querySelector("#year-grid");
const monthGrid = document.querySelector("#month-grid");
const dotTypeList = document.querySelector("#dot-type-list");
const popover = document.querySelector("#day-popover");
const popoverItemTemplate = document.querySelector("#popover-item-template");
const openSettings = document.querySelector("#open-settings");
const settingsModal = document.querySelector("#settings-modal");
const periodPickerToggle = document.querySelector("#period-picker-toggle");
const periodPickerLabel = document.querySelector("#period-picker-label");
const periodPickerMenu = document.querySelector("#period-picker-menu");
const weekStartMondayInput = document.querySelector("#week-start-monday");
const colorModeLightButton = document.querySelector("#color-mode-light");
const colorModeDarkButton = document.querySelector("#color-mode-dark");
const downloadDataButton = document.querySelector("#download-data");
const uploadDataButton = document.querySelector("#upload-data");
const uploadDataInput = document.querySelector("#upload-data-input");
const suggestedDotList = document.querySelector("#suggested-dot-list");
const deleteModal = document.querySelector("#delete-modal");
const deleteText = document.querySelector("#delete-text");
const deleteCancel = document.querySelector("#delete-cancel");
const deleteConfirm = document.querySelector("#delete-confirm");
const toast = document.querySelector("#toast");

window.addEventListener("resize", render);
openSettings.addEventListener("click", () => {
  closePopover();
  openSettingsModal();
});
periodPickerToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  if (periodPickerMenu.classList.contains("hidden")) {
    openPeriodMenu();
  } else {
    closePeriodMenu();
  }
});
periodPickerMenu.addEventListener("scroll", () => {
  if (periodPickerMenu.classList.contains("hidden")) return;
  const threshold = 24;
  const nearBottom =
    periodPickerMenu.scrollTop + periodPickerMenu.clientHeight >= periodPickerMenu.scrollHeight - threshold;
  if (!nearBottom || periodLoadInProgress) return;

  periodLoadInProgress = true;
  const previousScrollTop = periodPickerMenu.scrollTop;
  if (isMobileView()) loadedMobileMonthCount += MOBILE_MONTH_BATCH_SIZE;
  else loadedYearBatchCount += 1;
  renderPeriodPicker(true, previousScrollTop);
  requestAnimationFrame(() => {
    periodLoadInProgress = false;
  });
});
deleteCancel.addEventListener("click", closeDeleteModal);
deleteConfirm.addEventListener("click", () => {
  if (!pendingDeleteDotTypeId) return;
  if (pendingDeleteMode === "force") {
    forceDeleteDotType(pendingDeleteDotTypeId);
    showToast(`Permanently deleted "${pendingDeleteDotTypeName}".`);
  } else {
    deleteDotType(pendingDeleteDotTypeId);
    showToast(`Deleted "${pendingDeleteDotTypeName}".`);
  }
  closeDeleteModal();
});
weekStartMondayInput.addEventListener("change", () => {
  state.weekStartsMonday = weekStartMondayInput.checked;
  saveAndRender();
  showToast(state.weekStartsMonday ? "Weeks now start on Monday." : "Weeks now start on Sunday.");
});
colorModeLightButton.addEventListener("click", () => {
  state.darkMode = false;
  saveAndRender();
  showToast("Light mode on.");
});
colorModeDarkButton.addEventListener("click", () => {
  state.darkMode = true;
  saveAndRender();
  showToast("Dark mode on.");
});
downloadDataButton.addEventListener("click", downloadDataExport);
uploadDataButton.addEventListener("click", () => {
  uploadDataInput.click();
});
uploadDataInput.addEventListener("change", handleDataImport);

document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest(".period-picker")) {
    closePeriodMenu();
  }
  if (!event.target.closest(".dot-actions")) {
    closeDotMenus();
  }
  if (!settingsModal.classList.contains("hidden") && event.target === settingsModal) {
    closeSettingsModal();
    return;
  }
  if (!deleteModal.classList.contains("hidden") && event.target === deleteModal) {
    closeDeleteModal();
    return;
  }
  if (!activePopover) return;
  const insidePopover = popover.contains(event.target);
  const clickedDay = event.target.closest(".year-day, .month-day");
  if (!insidePopover && !clickedDay) {
    closePopover();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closePopover();
  closePeriodMenu();
  closeSettingsModal();
  closeDeleteModal();
});

render();
showSettingsOnFirstLoad();

function render() {
  applyTheme();
  renderPeriodPicker();
  renderDiaryGrid();
  renderDotTypeList();
  weekStartMondayInput.checked = Boolean(state.weekStartsMonday);
  colorModeLightButton.classList.toggle("active", !state.darkMode);
  colorModeDarkButton.classList.toggle("active", Boolean(state.darkMode));
  renderSuggestedDotTypes();
}

function renderPeriodPicker(preserveScroll = false, previousScrollTop = 0) {
  const currentYear = new Date().getFullYear();
  if (state.yearCursor > currentYear) {
    state.yearCursor = currentYear;
  }
  periodPickerMenu.innerHTML = "";
  if (isMobileView()) {
    const selectedMonthDate = new Date(state.monthCursor);
    const currentMonthDate = startOfMonth(new Date());
    if (selectedMonthDate > currentMonthDate) {
      state.monthCursor = currentMonthDate.toISOString();
      state.yearCursor = currentMonthDate.getFullYear();
    }
    const normalizedSelectedMonthDate = new Date(state.monthCursor);
    periodPickerLabel.textContent = normalizedSelectedMonthDate.toLocaleDateString(undefined, {
      month: "short",
      year: "numeric"
    });
    const selectedMonthDiff = monthDiff(currentMonthDate, normalizedSelectedMonthDate);
    if (selectedMonthDiff >= loadedMobileMonthCount) {
      loadedMobileMonthCount = selectedMonthDiff + 1;
    }

    for (let i = 0; i < loadedMobileMonthCount; i += 1) {
      const optionDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - i, 1);
      const optionYear = optionDate.getFullYear();
      const optionMonth = optionDate.getMonth();

      const item = document.createElement("button");
      item.type = "button";
      item.className = "period-picker-item";
      if (
        optionYear === normalizedSelectedMonthDate.getFullYear() &&
        optionMonth === normalizedSelectedMonthDate.getMonth()
      ) {
        item.classList.add("active");
      }
      item.textContent = optionDate.toLocaleDateString(undefined, { month: "short", year: "numeric" });
      item.addEventListener("click", () => {
        state.monthCursor = startOfMonth(optionDate).toISOString();
        state.yearCursor = optionYear;
        closePeriodMenu();
        saveAndRender();
      });
      periodPickerMenu.appendChild(item);
    }

    if (preserveScroll) {
      periodPickerMenu.scrollTop = previousScrollTop;
    }
    return;
  }

  periodPickerLabel.textContent = String(state.yearCursor);
  const minLoadedYear = currentYear - loadedYearBatchCount * YEAR_BATCH_SIZE + 1;
  if (state.yearCursor < minLoadedYear) {
    loadedYearBatchCount = Math.ceil((currentYear - state.yearCursor + 1) / YEAR_BATCH_SIZE);
  }

  const oldestLoadedYear = currentYear - loadedYearBatchCount * YEAR_BATCH_SIZE + 1;
  for (let year = currentYear; year >= oldestLoadedYear; year -= 1) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "period-picker-item";
    if (year === state.yearCursor) item.classList.add("active");
    item.textContent = String(year);
    item.addEventListener("click", () => {
      state.yearCursor = year;
      const monthDate = new Date(state.monthCursor);
      monthDate.setFullYear(year);
      state.monthCursor = startOfMonth(monthDate).toISOString();
      closePeriodMenu();
      saveAndRender();
    });
    periodPickerMenu.appendChild(item);
  }

  if (preserveScroll) {
    periodPickerMenu.scrollTop = previousScrollTop;
  }
}

function renderDiaryGrid() {
  if (isMobileView()) {
    yearGrid.classList.add("hidden");
    monthGrid.classList.remove("hidden");
    renderMonthGrid();
  } else {
    monthGrid.classList.add("hidden");
    yearGrid.classList.remove("hidden");
    renderYearGrid();
  }
}

function renderYearGrid() {
  const year = state.yearCursor;
  yearGrid.innerHTML = "";

  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    const column = document.createElement("section");
    column.className = "month-column";
    if (new Date(year, monthIndex + 1, 0).getDate() === 31) {
      column.classList.add("month-31");
    }

    const monthTitle = document.createElement("h3");
    monthTitle.className = "month-title";
    monthTitle.textContent = new Date(year, monthIndex, 1).toLocaleDateString(undefined, { month: "long" });
    column.appendChild(monthTitle);

    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    for (let dayNum = 1; dayNum <= 31; dayNum += 1) {
      if (dayNum > daysInMonth) {
        const filler = document.createElement("div");
        filler.className = "year-day filler";
        column.appendChild(filler);
        continue;
      }

      const date = new Date(year, monthIndex, dayNum);
      const iso = formatISODate(date);
      const row = document.createElement("button");
      row.type = "button";
      row.className = "year-day";
      row.dataset.date = iso;

      const label = document.createElement("span");
      label.className = "day-label";
      label.textContent = `${String(dayNum).padStart(2, "0")} ${weekdayShort(date)}`;
      row.appendChild(label);

      const dotLayer = document.createElement("div");
      dotLayer.className = "dot-layer";
      getDayDotIds(iso).forEach((dotId) => {
        const dotType = state.dotTypes.find((t) => t.id === dotId);
        if (!dotType) return;
        const sticker = document.createElement("span");
        sticker.className = "dot-sticker";
        sticker.style.background = dotType.color;
        const pos = getDotPosition(iso, dotId, "year");
        sticker.style.left = `${pos.left}%`;
        sticker.style.top = `${pos.top}%`;
        sticker.style.transform = `translate(-50%, -50%) rotate(${pos.rotate}deg)`;
        sticker.title = `${dotType.name} (drag to move)`;
        sticker.addEventListener("pointerdown", (event) => {
          startDotDrag(event, { isoDate: iso, dotId, sticker, mode: "year" });
        });
        dotLayer.appendChild(sticker);
      });
      row.appendChild(dotLayer);

      const note = getDayNote(iso);
      if (note) {
        const noteNode = document.createElement("span");
        noteNode.className = "day-note";
        noteNode.textContent = note;
        row.appendChild(noteNode);
      }

      row.addEventListener("click", (event) => {
        if (Date.now() < suppressDayOpenUntil) return;
        openPopover(iso, event.clientX, event.clientY);
      });
      column.appendChild(row);
    }

    yearGrid.appendChild(column);
  }
}

function renderMonthGrid() {
  const monthDate = new Date(state.monthCursor);
  monthGrid.innerHTML = "";
  const days = buildMonthCells(monthDate, state.weekStartsMonday);

  for (const day of days) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "month-day";
    if (!day.inCurrentMonth) cell.classList.add("muted-day");
    cell.dataset.date = day.iso;

    const dayLabel = document.createElement("div");
    dayLabel.className = "month-day-label";
    dayLabel.textContent = `${String(day.date.getDate()).padStart(2, "0")} ${weekdayShort(day.date)}`;
    cell.appendChild(dayLabel);

    const dotLayer = document.createElement("div");
    dotLayer.className = "dot-layer";
    getDayDotIds(day.iso).forEach((dotId) => {
      const dotType = state.dotTypes.find((t) => t.id === dotId);
      if (!dotType) return;
      const sticker = document.createElement("span");
      sticker.className = "dot-sticker";
      sticker.style.background = dotType.color;
      const pos = getDotPosition(day.iso, dotId, "month");
      sticker.style.left = `${pos.left}%`;
      sticker.style.top = `${pos.top}%`;
      sticker.style.transform = `translate(-50%, -50%) rotate(${pos.rotate}deg)`;
      sticker.title = `${dotType.name} (drag to move)`;
      sticker.addEventListener("pointerdown", (event) => {
        startDotDrag(event, { isoDate: day.iso, dotId, sticker, mode: "month" });
      });
      dotLayer.appendChild(sticker);
    });
    cell.appendChild(dotLayer);

    const note = getDayNote(day.iso);
    if (note) {
      const noteNode = document.createElement("span");
      noteNode.className = "month-note";
      noteNode.textContent = note;
      cell.appendChild(noteNode);
    }

    cell.addEventListener("click", (event) => {
      if (Date.now() < suppressDayOpenUntil) return;
      openPopover(day.iso, event.clientX, event.clientY);
    });
    monthGrid.appendChild(cell);
  }
}

function renderDotTypeList() {
  dotTypeList.innerHTML = "";

  if (state.dotTypes.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.innerHTML =
      '<span class="empty-state-emoji" aria-hidden="true">🖊️</span>No dot types yet, choose your dots below.';
    dotTypeList.appendChild(empty);
  }

  state.dotTypes.forEach((dotType) => {
    const item = document.createElement("li");
    item.className = "dot-type-row";

    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = dotType.color;

    const inputWrap = document.createElement("div");
    inputWrap.className = "dot-input-wrap";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = dotType.name;
    nameInput.setAttribute("aria-label", "Dot meaning");
    syncDotTypeInputSize(nameInput);
    nameInput.addEventListener("input", () => {
      syncDotTypeInputSize(nameInput);
    });
    nameInput.addEventListener("change", () => {
      const nextName = nameInput.value.trim() || dotType.name;
      const changed = nextName !== dotType.name;
      dotType.name = nextName;
      syncDotTypeInputSize(nameInput);
      saveAndRender();
      if (changed) {
        showToast(`Renamed dot to "${nextName}".`);
      }
    });
    if (pendingFocusDotId === dotType.id) {
      requestAnimationFrame(() => {
        nameInput.focus();
        nameInput.select();
      });
      pendingFocusDotId = null;
    }

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = dotType.color;
    colorInput.setAttribute("aria-label", "Dot color");
    colorInput.style.display = "none";
    colorInput.addEventListener("change", () => {
      const changed = colorInput.value !== dotType.color;
      dotType.color = colorInput.value;
      saveAndRender();
      if (changed) {
        showToast(`Changed color for "${dotType.name}".`);
      }
    });
    swatch.addEventListener("click", () => {
      colorInput.click();
    });

    const inUse = isDotTypeInUse(dotType.id);

    const actions = document.createElement("div");
    actions.className = "dot-actions";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "dot-actions-toggle";
    toggle.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M5 8.5C5.82843 8.5 6.5 9.17157 6.5 10C6.5 10.8284 5.82843 11.5 5 11.5C4.17157 11.5 3.5 10.8284 3.5 10C3.5 9.17157 4.17157 8.5 5 8.5Z" fill="currentColor"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M10 8.5C10.8284 8.5 11.5 9.17157 11.5 10C11.5 10.8284 10.8284 11.5 10 11.5C9.17157 11.5 8.5 10.8284 8.5 10C8.5 9.17157 9.17157 8.5 10 8.5Z" fill="currentColor"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M15 8.5C15.8284 8.5 16.5 9.17157 16.5 10C16.5 10.8284 15.8284 11.5 15 11.5C14.1716 11.5 13.5 10.8284 13.5 10C13.5 9.17157 14.1716 8.5 15 8.5Z" fill="currentColor"/>
      </svg>
    `;
    toggle.setAttribute("aria-label", "More actions");

    const menu = document.createElement("div");
    menu.className = "dot-actions-menu hidden";

    const renameItem = document.createElement("button");
    renameItem.type = "button";
    renameItem.className = "dot-actions-item";
    renameItem.textContent = "Rename";
    renameItem.addEventListener("click", () => {
      closeDotMenus();
      nameInput.focus();
      nameInput.select();
    });

    const deleteItem = document.createElement("button");
    deleteItem.type = "button";
    deleteItem.className = "dot-actions-item";
    deleteItem.textContent = "Delete";
    deleteItem.addEventListener("click", () => {
      promptDeleteDotType(dotType.id, dotType.name);
      closeDotMenus();
    });

    const permanentDeleteItem = document.createElement("button");
    permanentDeleteItem.type = "button";
    permanentDeleteItem.className = "dot-actions-item danger-solid";
    permanentDeleteItem.textContent = "Permanently Delete";
    permanentDeleteItem.addEventListener("click", () => {
      promptPermanentDeleteDotType(dotType.id, dotType.name);
      closeDotMenus();
    });

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const opening = menu.classList.contains("hidden");
      closeDotMenus();
      item.classList.toggle("menu-open", opening);
      if (opening) {
        showAnimated(menu);
        requestAnimationFrame(() => {
          positionDotActionsMenu(menu);
        });
      } else {
        menu.classList.add("hidden");
      }
    });

    if (inUse) {
      menu.append(renameItem, permanentDeleteItem);
    } else {
      menu.append(renameItem, deleteItem);
    }
    actions.append(toggle, menu);
    inputWrap.append(nameInput, actions);
    item.append(swatch, inputWrap, colorInput);
    dotTypeList.appendChild(item);
  });
}

function renderSuggestedDotTypes() {
  suggestedDotList.innerHTML = "";

  shuffledSuggestions.forEach((suggestion) => {
    if (hasDotTypeName(suggestion.name)) return;

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "suggestion-chip";
    chip.innerHTML = `<span class="swatch" style="background:${suggestion.color}"></span><span>${suggestion.name}</span>`;
    chip.addEventListener("click", () => addSuggestedDotType(suggestion));
    suggestedDotList.appendChild(chip);
  });

  const addNewChip = document.createElement("button");
  addNewChip.type = "button";
  addNewChip.className = "suggestion-chip add-new";
  addNewChip.textContent = "Add New";
  addNewChip.addEventListener("click", addNewDotType);
  suggestedDotList.appendChild(addNewChip);
}

function openPopover(isoDate, x, y) {
  if (popoverHideTimer) {
    clearTimeout(popoverHideTimer);
    popoverHideTimer = null;
  }
  const shouldAnimateIn = popover.classList.contains("hidden");
  activePopover = { isoDate };
  popover.innerHTML = "";

  const selectedIds = new Set(getDayDotIds(isoDate));

  if (state.dotTypes.length === 0) {
    const empty = document.createElement("div");
    empty.textContent = "Add a dot type first.";
    empty.className = "muted";
    empty.style.padding = "8px";
    popover.appendChild(empty);
  }

  state.dotTypes.forEach((dotType) => {
    const node = popoverItemTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".swatch").style.background = dotType.color;
    node.querySelector(".label").textContent = dotType.name;

    node.addEventListener("click", () => {
      const wasSelected = selectedIds.has(dotType.id);
      toggleDot(isoDate, dotType.id);
      if (wasSelected) {
        openPopover(isoDate, x, y);
      } else {
        closePopover();
      }
    });

    popover.appendChild(node);
  });

  const noteWrap = document.createElement("div");
  noteWrap.className = "popover-note";

  const noteInput = document.createElement("input");
  noteInput.type = "text";
  noteInput.placeholder = "Add short note";
  noteInput.value = getDayNote(isoDate);
  noteInput.maxLength = 64;

  const noteRow = document.createElement("div");
  noteRow.className = "popover-note-row";
  noteInput.addEventListener("input", () => {
    setDayNote(isoDate, noteInput.value);
  });

  noteInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      setDayNote(isoDate, noteInput.value);
      closePopover();
    }
  });

  noteRow.append(noteInput);
  noteWrap.append(noteRow);
  popover.appendChild(noteWrap);

  popover.classList.remove("hidden");
  const maxX = window.innerWidth - popover.offsetWidth - 8;
  const maxY = window.innerHeight - popover.offsetHeight - 8;
  popover.style.left = `${clamp(x, 8, maxX)}px`;
  popover.style.top = `${clamp(y, 8, maxY)}px`;
  if (shouldAnimateIn) {
    showAnimated(popover);
  } else {
    popover.classList.add("visible");
  }
}

function closePopover() {
  activePopover = null;
  if (popoverHideTimer) {
    clearTimeout(popoverHideTimer);
    popoverHideTimer = null;
  }
  popover.classList.remove("visible");
  popoverHideTimer = window.setTimeout(() => {
    popover.classList.add("hidden");
    popoverHideTimer = null;
  }, POPOVER_ANIMATION_MS);
}

function toggleDot(isoDate, dotId) {
  const ids = new Set(getDayDotIds(isoDate));
  if (ids.has(dotId)) {
    ids.delete(dotId);
    clearDotPosition(isoDate, dotId);
  } else ids.add(dotId);

  if (ids.size === 0) {
    delete state.dayDots[isoDate];
  } else {
    state.dayDots[isoDate] = [...ids];
  }

  saveAndRender();
}

function deleteDotType(dotId) {
  if (isDotTypeInUse(dotId)) return;

  state.dotTypes = state.dotTypes.filter((d) => d.id !== dotId);

  for (const [iso, ids] of Object.entries(state.dayDots)) {
    const next = ids.filter((id) => id !== dotId);
    clearDotPosition(iso, dotId);
    if (next.length === 0) delete state.dayDots[iso];
    else state.dayDots[iso] = next;
  }

  saveAndRender();
}

function promptDeleteDotType(dotId, dotName) {
  if (isDotTypeInUse(dotId)) return;
  pendingDeleteDotTypeId = dotId;
  pendingDeleteDotTypeName = dotName;
  pendingDeleteMode = "safe";
  deleteText.textContent = "You haven't used this dot yet in your Diary. Are you sure you want to delete it?";
  deleteModal.classList.remove("hidden");
}

function promptPermanentDeleteDotType(dotId, dotName) {
  pendingDeleteDotTypeId = dotId;
  pendingDeleteDotTypeName = dotName;
  pendingDeleteMode = "force";
  deleteText.textContent = `This will remove “${dotName}” from all days it is already applied to and delete it from your dot types.`;
  deleteModal.classList.remove("hidden");
}

function closeDeleteModal() {
  pendingDeleteDotTypeId = null;
  pendingDeleteDotTypeName = "";
  pendingDeleteMode = "safe";
  deleteModal.classList.add("hidden");
}

function forceDeleteDotType(dotId) {
  state.dotTypes = state.dotTypes.filter((d) => d.id !== dotId);

  for (const [iso, ids] of Object.entries(state.dayDots)) {
    const next = ids.filter((id) => id !== dotId);
    clearDotPosition(iso, dotId);
    if (next.length === 0) delete state.dayDots[iso];
    else state.dayDots[iso] = next;
  }

  saveAndRender();
}

function closeSettingsModal() {
  if (settingsModalHideTimer) {
    clearTimeout(settingsModalHideTimer);
    settingsModalHideTimer = null;
  }
  settingsModal.classList.remove("visible");
  settingsModalHideTimer = window.setTimeout(() => {
    settingsModal.classList.add("hidden");
    settingsModalHideTimer = null;
  }, MODAL_ANIMATION_MS);
  closeDotMenus();
}

function openSettingsModal() {
  if (settingsModalHideTimer) {
    clearTimeout(settingsModalHideTimer);
    settingsModalHideTimer = null;
  }
  showAnimated(settingsModal);
}

function closePeriodMenu() {
  periodPickerMenu.classList.remove("visible");
  periodPickerMenu.classList.add("hidden");
}

function openPeriodMenu() {
  showAnimated(periodPickerMenu);
}

function addSuggestedDotType(suggestion) {
  if (hasDotTypeName(suggestion.name)) return;
  state.dotTypes.push({
    id: crypto.randomUUID(),
    name: suggestion.name,
    color: suggestion.color
  });
  saveAndRender();
  showToast(`Added "${suggestion.name}".`);
}

function addNewDotType() {
  const dotId = crypto.randomUUID();
  const dotName = "New Dot";
  state.dotTypes.push({
    id: dotId,
    name: dotName,
    color: getNextSuggestedColor()
  });
  pendingFocusDotId = dotId;
  saveAndRender();
  showToast(`Added "${dotName}".`);
}

function hasDotTypeName(name) {
  const target = name.trim().toLowerCase();
  return state.dotTypes.some((dot) => dot.name.trim().toLowerCase() === target);
}

function getNextSuggestedColor() {
  for (const suggestion of SUGGESTED_DOT_TYPES) {
    if (!state.dotTypes.some((dot) => dot.color.toLowerCase() === suggestion.color.toLowerCase())) {
      return suggestion.color;
    }
  }
  return "#000000";
}

function isDotTypeInUse(dotId) {
  return Object.values(state.dayDots).some((ids) => ids.includes(dotId));
}

function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getDayDotIds(isoDate) {
  return state.dayDots[isoDate] || [];
}

function getDayNote(isoDate) {
  return state.dayNotes[isoDate] || "";
}

function setDayNote(isoDate, rawValue) {
  const note = normalizeNote(rawValue);
  if (!note) {
    delete state.dayNotes[isoDate];
  } else {
    state.dayNotes[isoDate] = note;
  }
  saveAndRender();
}

function saveAndRender() {
  if (DEMO_MODE) {
    render();
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    const yearFromMonthCursor = parsed.monthCursor ? new Date(parsed.monthCursor).getFullYear() : null;
    return {
      monthCursor: parsed.monthCursor || defaultState.monthCursor,
      yearCursor: Number.isInteger(parsed.yearCursor) ? parsed.yearCursor : yearFromMonthCursor || defaultState.yearCursor,
      weekStartsMonday: Boolean(parsed.weekStartsMonday),
      darkMode: Boolean(parsed.darkMode),
      dotTypes: Array.isArray(parsed.dotTypes) ? parsed.dotTypes : structuredClone(defaultState.dotTypes),
      dayDots: parsed.dayDots && typeof parsed.dayDots === "object" ? parsed.dayDots : {},
      dotPositions: parsed.dotPositions && typeof parsed.dotPositions === "object" ? parsed.dotPositions : {},
      dayNotes: parsed.dayNotes && typeof parsed.dayNotes === "object" ? parsed.dayNotes : {}
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function showSettingsOnFirstLoad() {
  if (DEMO_MODE) return;
  try {
    if (localStorage.getItem(FIRST_LOAD_SETTINGS_KEY) === "1") return;
    openSettingsModal();
    localStorage.setItem(FIRST_LOAD_SETTINGS_KEY, "1");
  } catch {
    // Ignore storage access issues.
  }
}

function createDemoState() {
  const now = new Date();
  const year = now.getFullYear();
  const dotTypes = [
    { id: "demo-sex", name: "Sex", color: "#2F8CFA" },
    { id: "demo-alcohol", name: "Alcohol", color: "#875436" },
    { id: "demo-smoking", name: "Smoking", color: "#FF0000" },
    { id: "demo-drugs", name: "Drugs", color: "#FFC700" },
    { id: "demo-exercise", name: "Exercise", color: "#15C771" },
    { id: "demo-exploring", name: "Exploring", color: "#2F8CFA" },
    { id: "demo-music", name: "Music", color: "#0F766E" },
    { id: "demo-movie", name: "Movie", color: "#1D3557" }
  ];
  const noteBank = [
    "Great walk downtown",
    "Late night movie",
    "Date night",
    "Sunset bike ride",
    "Met old friend",
    "Long studio session",
    "Felt grounded today",
    "Amazing ramen spot",
    "Park run",
    "Stayed in tonight"
  ];
  const dayDots = {};
  const dayNotes = {};
  const dotPositions = {};
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);

  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const iso = formatISODate(date);
    const densitySeed = hash32(`${iso}|demo|density`) % 100;
    const count = densitySeed < 45 ? 0 : densitySeed < 73 ? 1 : densitySeed < 90 ? 2 : 3;
    if (count > 0) {
      const ids = [];
      let attempts = 0;
      while (ids.length < count && attempts < 24) {
        const pick = hash32(`${iso}|demo|pick|${attempts}`) % dotTypes.length;
        const id = dotTypes[pick].id;
        if (!ids.includes(id)) ids.push(id);
        attempts += 1;
      }
      dayDots[iso] = ids;

      for (const id of ids) {
        const moved = hash32(`${iso}|${id}|demo|moved`) % 4 === 0;
        if (!moved) continue;
        if (!dotPositions[iso]) dotPositions[iso] = {};
        dotPositions[iso][id] = {
          left: 10 + (hash32(`${iso}|${id}|demo|x`) % 81),
          top: 14 + (hash32(`${iso}|${id}|demo|y`) % 73)
        };
      }
    }

    if (hash32(`${iso}|demo|note`) % 7 === 0) {
      const note = noteBank[hash32(`${iso}|demo|note-text`) % noteBank.length];
      dayNotes[iso] = normalizeNote(note);
    }
  }

  return {
    monthCursor: startOfMonth(now).toISOString(),
    yearCursor: year,
    weekStartsMonday: false,
    darkMode: false,
    dotTypes,
    dayDots,
    dotPositions,
    dayNotes
  };
}

function formatISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildMonthCells(monthDate, weekStartsMonday = false) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const first = new Date(year, month, 1);
  const startOffset = weekStartsMonday ? (first.getDay() + 6) % 7 : first.getDay();
  const start = new Date(year, month, 1 - startOffset);

  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    cells.push({
      date,
      iso: formatISODate(date),
      inCurrentMonth: date.getMonth() === month
    });
  }

  return cells;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function hash32(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stickerPosition(isoDate, dotId) {
  const h1 = hash32(`${isoDate}|${dotId}|x`);
  const h2 = hash32(`${isoDate}|${dotId}|y`);
  const h3 = hash32(`${isoDate}|${dotId}|r`);

  return {
    left: 48 + (h1 % 46),
    top: 22 + (h2 % 58),
    rotate: -18 + (h3 % 37)
  };
}

function stickerPositionMonth(isoDate, dotId) {
  const h1 = hash32(`${isoDate}|${dotId}|x|m`);
  const h2 = hash32(`${isoDate}|${dotId}|y|m`);
  const h3 = hash32(`${isoDate}|${dotId}|r|m`);
  return {
    left: 12 + (h1 % 76),
    top: 24 + (h2 % 64),
    rotate: -18 + (h3 % 37)
  };
}

function getDotPosition(isoDate, dotId, mode) {
  const stored = state.dotPositions?.[isoDate]?.[dotId];
  const base = mode === "month" ? stickerPositionMonth(isoDate, dotId) : stickerPosition(isoDate, dotId);
  if (!stored) return base;
  return {
    left: stored.left,
    top: stored.top,
    rotate: base.rotate
  };
}

function saveDotPosition(isoDate, dotId, left, top) {
  if (!state.dotPositions[isoDate]) state.dotPositions[isoDate] = {};
  state.dotPositions[isoDate][dotId] = { left, top };
}

function clearDotPosition(isoDate, dotId) {
  const dayPositions = state.dotPositions[isoDate];
  if (!dayPositions) return;
  delete dayPositions[dotId];
  if (Object.keys(dayPositions).length === 0) {
    delete state.dotPositions[isoDate];
  }
}

function startDotDrag(event, { isoDate, dotId, sticker, mode }) {
  event.preventDefault();
  event.stopPropagation();

  const parent = sticker.parentElement;
  if (!parent) return;
  const pointerId = event.pointerId;
  let moved = false;

  const updatePosition = (pointerEvent) => {
    const rect = parent.getBoundingClientRect();
    const nextLeft = clamp(((pointerEvent.clientX - rect.left) / rect.width) * 100, 6, 94);
    const nextTop = clamp(((pointerEvent.clientY - rect.top) / rect.height) * 100, 12, 88);
    const current = getDotPosition(isoDate, dotId, mode);
    sticker.style.left = `${nextLeft}%`;
    sticker.style.top = `${nextTop}%`;
    sticker.style.transform = `translate(-50%, -50%) rotate(${current.rotate}deg)`;
    moved = true;
    return { nextLeft, nextTop };
  };

  let last = null;
  const onMove = (moveEvent) => {
    if (moveEvent.pointerId !== pointerId) return;
    last = updatePosition(moveEvent);
  };

  const onUp = (upEvent) => {
    if (upEvent.pointerId !== pointerId) return;
    sticker.removeEventListener("pointermove", onMove);
    sticker.removeEventListener("pointerup", onUp);
    sticker.removeEventListener("pointercancel", onUp);
    if (moved && last) {
      saveDotPosition(isoDate, dotId, last.nextLeft, last.nextTop);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      suppressDayOpenUntil = Date.now() + 250;
    }
  };

  sticker.setPointerCapture(pointerId);
  sticker.addEventListener("pointermove", onMove);
  sticker.addEventListener("pointerup", onUp);
  sticker.addEventListener("pointercancel", onUp);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeNote(value) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join(" ");
}

function weekdayShort(date) {
  return ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][date.getDay()];
}

function isMobileView() {
  return window.matchMedia("(max-width: 920px)").matches;
}

function monthDiff(laterDate, earlierDate) {
  return (
    (laterDate.getFullYear() - earlierDate.getFullYear()) * 12 +
    (laterDate.getMonth() - earlierDate.getMonth())
  );
}

function closeDotMenus() {
  document.querySelectorAll(".dot-type-row.menu-open").forEach((row) => {
    row.classList.remove("menu-open");
  });
  document.querySelectorAll(".dot-actions-menu").forEach((menu) => {
    menu.classList.remove("visible");
    menu.classList.add("hidden");
    menu.style.removeProperty("--menu-offset-x");
    menu.style.removeProperty("--menu-offset-y");
  });
}

function positionDotActionsMenu(menu) {
  const boundaryRect = menu.closest(".settings-card")?.getBoundingClientRect() || {
    left: 8,
    top: 8,
    right: window.innerWidth - 8,
    bottom: window.innerHeight - 8
  };
  const padding = 8;
  const rect = menu.getBoundingClientRect();
  let offsetX = 0;
  let offsetY = 0;

  if (rect.left < boundaryRect.left + padding) {
    offsetX = boundaryRect.left + padding - rect.left;
  } else if (rect.right > boundaryRect.right - padding) {
    offsetX = boundaryRect.right - padding - rect.right;
  }

  if (rect.bottom > boundaryRect.bottom - padding) {
    offsetY = boundaryRect.bottom - padding - rect.bottom;
  }

  menu.style.setProperty("--menu-offset-x", `${offsetX}px`);
  menu.style.setProperty("--menu-offset-y", `${offsetY}px`);
}

function showAnimated(element) {
  element.classList.remove("hidden");
  element.classList.remove("visible");
  void element.offsetWidth;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      element.classList.add("visible");
    });
  });
}

function syncDotTypeInputSize(input) {
  const value = input.value || " ";
  const style = window.getComputedStyle(input);
  const sizer = syncDotTypeInputSize._sizer || document.createElement("span");
  if (!syncDotTypeInputSize._sizer) {
    sizer.style.position = "absolute";
    sizer.style.visibility = "hidden";
    sizer.style.whiteSpace = "pre";
    sizer.style.pointerEvents = "none";
    sizer.style.left = "-9999px";
    sizer.style.top = "0";
    document.body.appendChild(sizer);
    syncDotTypeInputSize._sizer = sizer;
  }
  sizer.style.font = style.font;
  sizer.style.letterSpacing = style.letterSpacing;
  sizer.textContent = value;

  const measured = Math.ceil(sizer.getBoundingClientRect().width) + 3;
  input.style.width = `${measured}px`;
}

function applyTheme() {
  document.documentElement.dataset.theme = state.darkMode ? "dark" : "light";
}

function downloadDataExport() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `dot-diary-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast("Downloaded your data.");
}

async function handleDataImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const raw = await file.text();
    const parsed = JSON.parse(raw);
    const next = normalizeImportedState(parsed?.data ?? parsed);
    state = next;
    loadedYearBatchCount = 1;
    loadedMobileMonthCount = 12;
    closePeriodMenu();
    closeDotMenus();
    saveAndRender();
    showToast("Imported your data.");
  } catch {
    showToast("Could not import that file.");
  } finally {
    uploadDataInput.value = "";
  }
}

function normalizeImportedState(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return structuredClone(defaultState);
  }
  const yearFromMonthCursor = parsed.monthCursor ? new Date(parsed.monthCursor).getFullYear() : null;
  return {
    monthCursor: typeof parsed.monthCursor === "string" ? parsed.monthCursor : defaultState.monthCursor,
    yearCursor: Number.isInteger(parsed.yearCursor) ? parsed.yearCursor : yearFromMonthCursor || defaultState.yearCursor,
    weekStartsMonday: Boolean(parsed.weekStartsMonday),
    dotTypes: Array.isArray(parsed.dotTypes) ? parsed.dotTypes : [],
    dayDots: parsed.dayDots && typeof parsed.dayDots === "object" ? parsed.dayDots : {},
    dotPositions: parsed.dotPositions && typeof parsed.dotPositions === "object" ? parsed.dotPositions : {},
    dayNotes: parsed.dayNotes && typeof parsed.dayNotes === "object" ? parsed.dayNotes : {}
  };
}

function showToast(message) {
  if (!toast) return;
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  if (toastHideTimer) {
    clearTimeout(toastHideTimer);
    toastHideTimer = null;
  }
  toast.textContent = message;
  toast.classList.remove("visible");
  toast.classList.remove("hidden");
  // Force a style flush so the transition runs reliably from hidden -> visible.
  void toast.offsetHeight;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add("visible");
    });
  });
  toastTimer = setTimeout(() => {
    toast.classList.remove("visible");
    toastHideTimer = setTimeout(() => {
      toast.classList.add("hidden");
      toastHideTimer = null;
    }, 280);
    toastTimer = null;
  }, 1800);
}
