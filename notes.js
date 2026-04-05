const NOTES_KEY = "notes_data";
const TRASH_KEY = "trash_data";
const ACTIVE_NOTE_KEY = "active_note_id";
const ACTIVE_TRASH_KEY = "active_trash_note_id";
const THEME_KEY = "note_theme";
const SETTINGS_KEY = "note_settings";

const notesList = document.getElementById("notesList");
const noteTitle = document.getElementById("noteTitle");
const noteEditor = document.getElementById("noteEditor");
const wordCount = document.getElementById("wordCount");
const characterCount = document.getElementById("characterCount");
const saveStatus = document.getElementById("saveStatus");
const addNoteBtn = document.getElementById("addNoteBtn");
const deleteNoteBtn = document.getElementById("deleteNoteBtn");
const permanentDeleteBtn = document.getElementById("permanentDeleteBtn");
const restoreNoteBtn = document.getElementById("restoreNoteBtn");
const pinNoteBtn = document.getElementById("pinNoteBtn");
const searchInput = document.getElementById("searchInput");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFileInput = document.getElementById("importFileInput");
const notesViewBtn = document.getElementById("notesViewBtn");
const trashViewBtn = document.getElementById("trashViewBtn");
const tagFilterList = document.getElementById("tagFilterList");
const clearTagFilterBtn = document.getElementById("clearTagFilterBtn");
const notesEmptyState = document.getElementById("notesEmptyState");
const emptyStateCreateBtn = document.getElementById("emptyStateCreateBtn");
const sortSelect = document.getElementById("sortSelect");
const onlyTaggedBtn = document.getElementById("onlyTaggedBtn");
const filterAllBtn = document.getElementById("filterAllBtn");
const filterPinnedBtn = document.getElementById("filterPinnedBtn");
const filterRecentBtn = document.getElementById("filterRecentBtn");
const settingsBtn = document.getElementById("settingsBtn");
const helpBtn = document.getElementById("helpBtn");
const settingsModal = document.getElementById("settingsModal");
const helpModal = document.getElementById("helpModal");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const closeHelpBtn = document.getElementById("closeHelpBtn");
const themeSelect = document.getElementById("themeSelect");
const dateFormatSelect = document.getElementById("dateFormatSelect");
const confirmDeleteToggle = document.getElementById("confirmDeleteToggle");
const focusSearchOnOpenToggle = document.getElementById("focusSearchOnOpenToggle");
const toastRegion = document.getElementById("toastRegion");
const trashDockBtn = document.getElementById("trashDockBtn");
const trashDockPanel = document.getElementById("trashDockPanel");
const trashDockList = document.getElementById("trashDockList");
const trashSelectBtn = document.getElementById("trashSelectBtn");
const trashRestoreBtn = document.getElementById("trashRestoreBtn");
const trashDeleteBtn = document.getElementById("trashDeleteBtn");
const trashSelectAllBtn = document.getElementById("trashSelectAllBtn");

let notes = [];
let trashNotes = [];
let activeNoteId = null;
let activeTrashNoteId = null;
let saveTimeout = null;
let searchQuery = "";
let currentTheme = "light";
let currentView = "notes";
let activeTagFilter = "";
let currentSort = "updated-desc";
let onlyTagged = false;
let activeQuickFilter = "all";
let activeToastTimeout = null;
let lastDeletedNote = null;
let undoDeleteTimeout = null;
let isTrashDockOpen = false;
let isTrashSelectionMode = false;
let selectedTrashIds = new Set();
// let activeTagSuggestionIndex = -1;
let appSettings = {
  theme: "light",
  dateFormat: "long",
  confirmBeforeDelete: true,
  focusSearchOnOpen: false
};

function setStatus(text) {
  saveStatus.textContent = text;
}

function showToast(message, duration = 2200) {
  if (!toastRegion) return;

  toastRegion.innerHTML = "";

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  toastRegion.appendChild(toast);

  if (activeToastTimeout) {
    clearTimeout(activeToastTimeout);
  }

  activeToastTimeout = setTimeout(() => {
    toast.remove();
    activeToastTimeout = null;
  }, duration);
}

function clearUndoDeleteState() {
  lastDeletedNote = null;

  if (undoDeleteTimeout) {
    clearTimeout(undoDeleteTimeout);
    undoDeleteTimeout = null;
  }
}

function showUndoDeleteToast() {
  if (!toastRegion || !lastDeletedNote) return;

  toastRegion.innerHTML = "";

  const toast = document.createElement("div");
  toast.className = "toast";

  const text = document.createElement("span");
  text.textContent = "Note moved to trash";

  const actionBtn = document.createElement("button");
  actionBtn.type = "button";
  actionBtn.textContent = "Undo";
  actionBtn.style.marginLeft = "10px";
  actionBtn.style.border = "0";
  actionBtn.style.borderRadius = "10px";
  actionBtn.style.padding = "6px 10px";
  actionBtn.style.cursor = "pointer";
  actionBtn.style.fontWeight = "600";

  actionBtn.addEventListener("click", async () => {
    await undoLastDelete();
  });

  toast.appendChild(text);
  toast.appendChild(actionBtn);
  toastRegion.appendChild(toast);

  if (activeToastTimeout) {
    clearTimeout(activeToastTimeout);
    activeToastTimeout = null;
  }

  if (undoDeleteTimeout) {
    clearTimeout(undoDeleteTimeout);
  }

  undoDeleteTimeout = setTimeout(() => {
    if (toastRegion.contains(toast)) {
      toast.remove();
    }
    clearUndoDeleteState();
  }, 5000);
}

async function undoLastDelete() {
  if (!lastDeletedNote) return;

  const noteToRestore = {
    ...lastDeletedNote,
    deletedAt: null,
    updatedAt: new Date().toISOString()
  };

  trashNotes = trashNotes.filter((note) => note.id !== noteToRestore.id);
  notes.unshift(noteToRestore);
  activeNoteId = noteToRestore.id;
  currentView = "notes";

  if (toastRegion) {
    toastRegion.innerHTML = "";
  }

  clearUndoDeleteState();
  renderAll();
  renderEditorStats(noteToRestore.content || "");
  await saveState("Note restored");
}

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function normalizeSettings(rawSettings = {}) {
  const theme = ["light", "dark", "system"].includes(rawSettings.theme)
    ? rawSettings.theme
    : "light";
  const dateFormat = ["long", "short"].includes(rawSettings.dateFormat)
    ? rawSettings.dateFormat
    : "long";

  return {
    theme,
    dateFormat,
    confirmBeforeDelete: rawSettings.confirmBeforeDelete !== false,
    focusSearchOnOpen: Boolean(rawSettings.focusSearchOnOpen)
  };
}

function syncSettingsUI() {
  if (themeSelect) themeSelect.value = appSettings.theme;
  if (dateFormatSelect) dateFormatSelect.value = appSettings.dateFormat;
  if (confirmDeleteToggle) confirmDeleteToggle.checked = appSettings.confirmBeforeDelete;
  if (focusSearchOnOpenToggle) focusSearchOnOpenToggle.checked = appSettings.focusSearchOnOpen;
}

function renderSortControls() {
  if (sortSelect) sortSelect.value = currentSort;
  if (onlyTaggedBtn) {
    onlyTaggedBtn.setAttribute("aria-pressed", String(onlyTagged));
  }
}

function isRecentNote(note) {
  if (!note?.updatedAt) return false;

  const updatedAt = new Date(note.updatedAt).getTime();
  if (Number.isNaN(updatedAt)) return false;

  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  return updatedAt >= sevenDaysAgo;
}

function renderQuickFilters() {
  if (!filterAllBtn || !filterPinnedBtn || !filterRecentBtn) return;

  const inNotesView = currentView === "notes";

  const buttons = [
    { element: filterAllBtn, value: "all" },
    { element: filterPinnedBtn, value: "pinned" },
    { element: filterRecentBtn, value: "recent" }
  ];

  buttons.forEach(({ element, value }) => {
    element.classList.toggle("active", inNotesView && activeQuickFilter === value);
    element.disabled = !inNotesView;
    element.setAttribute("aria-pressed", String(inNotesView && activeQuickFilter === value));
  });
}


function openTrashDock() {
  if (!trashDockPanel) return;
  isTrashDockOpen = true;
  trashDockPanel.hidden = false;
  trashDockPanel.style.display = "flex";
  renderTrashDock();
}

function closeTrashDock() {
  if (!trashDockPanel) return;
  isTrashDockOpen = false;
  isTrashSelectionMode = false;
  selectedTrashIds.clear();
  trashDockPanel.hidden = true;
  trashDockPanel.style.display = "none";
}

function toggleTrashDock() {
  if (!trashDockPanel) return;
  if (isTrashDockOpen) {
    closeTrashDock();
  } else {
    isTrashDockOpen = true;
    renderTrashDock();
  }
}

function renderTrashDock() {
  if (!trashDockPanel || !trashDockList || !trashSelectBtn || !trashRestoreBtn || !trashDeleteBtn) return;

  if (!isTrashDockOpen) {
    trashDockPanel.hidden = true;
    trashDockPanel.style.display = "none";
    return;
  }
  trashDockPanel.hidden = false;
  trashDockPanel.style.display = "flex";

  trashSelectBtn.textContent = isTrashSelectionMode ? "Cancel" : "Select";
  trashRestoreBtn.hidden = !isTrashSelectionMode;
  trashRestoreBtn.disabled = selectedTrashIds.size === 0;
  trashDeleteBtn.disabled = trashNotes.length === 0 || (isTrashSelectionMode && selectedTrashIds.size === 0);

  const sortedTrashNotes = sortTrash(trashNotes);

  if (trashSelectAllBtn) {
    trashSelectAllBtn.hidden = !isTrashSelectionMode;
    trashSelectAllBtn.textContent = selectedTrashIds.size === sortedTrashNotes.length && sortedTrashNotes.length > 0 ? "Clear" : "All";
  }

  trashDockList.innerHTML = "";

  if (sortedTrashNotes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-list-state";
    empty.textContent = "Trash is empty";
    trashDockList.appendChild(empty);
    return;
  }

  sortedTrashNotes.forEach((note) => {
    const item = document.createElement("button");
    const isSelected = selectedTrashIds.has(note.id);
    item.type = "button";
    item.className = `trash-dock-item${isSelected ? " is-selected" : ""}`;

    item.innerHTML = `
      <div class="trash-dock-item-title">${escapeHtml(note.title || "New Note")}</div>
      <div class="trash-dock-item-meta">Deleted: ${escapeHtml(formatDate(note.deletedAt))}</div>
    `;

    item.addEventListener("click", () => {
      if (isTrashSelectionMode) {
        if (selectedTrashIds.has(note.id)) {
          selectedTrashIds.delete(note.id);
        } else {
          selectedTrashIds.add(note.id);
        }
        renderTrashDock();
        return;
      }

      currentView = "trash";
      activeTrashNoteId = note.id;
      renderAll();
      updateStatusFromActiveItem("trash");
      closeTrashDock();
    });

    trashDockList.appendChild(item);
  });
}

async function restoreSelectedTrashNotes() {
  if (selectedTrashIds.size === 0) return;

  const idsToRestore = new Set(selectedTrashIds);
  const notesToRestore = sortTrash(trashNotes).filter((note) => idsToRestore.has(note.id));

  trashNotes = trashNotes.filter((note) => !idsToRestore.has(note.id));

  notesToRestore.forEach((note) => {
    notes.unshift({
      id: note.id,
      title: note.title,
      content: note.content,
      tags: [],
      updatedAt: new Date().toISOString(),
      pinned: Boolean(note.pinned)
    });
  });

  activeNoteId = sortNotes(notes)[0]?.id || null;
  activeTrashNoteId = sortTrash(trashNotes)[0]?.id || null;
  currentView = "notes";
  selectedTrashIds.clear();
  isTrashSelectionMode = false;

  renderAll();
  renderTrashDock();
  await saveState("Notes restored");
}

async function permanentlyDeleteSelectedTrashNotes() {
  // only allow delete in selection mode
  if (!isTrashSelectionMode) return;
  const idsToDelete = new Set(selectedTrashIds);

  if (idsToDelete.size === 0) return;

  const approved = appSettings.confirmBeforeDelete
    ? confirm("Permanently delete selected notes?")
    : true;

  if (!approved) return;

  trashNotes = trashNotes.filter((note) => !idsToDelete.has(note.id));
  activeTrashNoteId = sortTrash(trashNotes)[0]?.id || null;
  selectedTrashIds.clear();
  isTrashSelectionMode = false;

  renderAll();
  renderTrashDock();
  await saveState("Trash cleared");
}

function openModal(modal) {
  if (!modal) return;
  modal.hidden = false;
}

function closeModal(modal) {
  if (!modal) return;
  modal.hidden = true;
}

function applySettingsToUI() {
  syncSettingsUI();
  renderSortControls();
  renderQuickFilters();
}

function renderEmptyState() {
  if (!notesEmptyState || !notesList) return;

  const shouldShowOnboarding =
    currentView === "notes" &&
    notes.length === 0 &&
    !searchQuery.trim() &&
    !activeTagFilter &&
    !onlyTagged;

  notesEmptyState.hidden = !shouldShowOnboarding;
  notesList.hidden = shouldShowOnboarding;
}

function getSortedNotesList(list) {
  const items = [...list];

  switch (currentSort) {
    case "updated-asc":
      return items.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
    case "title-asc":
      return items.sort((a, b) => (a.title || "").localeCompare(b.title || "", "en", { sensitivity: "base" }));
    case "title-desc":
      return items.sort((a, b) => (b.title || "").localeCompare(a.title || "", "en", { sensitivity: "base" }));
    case "pinned":
      return items.sort((a, b) => {
        if (Boolean(b.pinned) !== Boolean(a.pinned)) {
          return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
        }
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    case "updated-desc":
    default:
      return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
}

function getSortedTrashList(list) {
  const items = [...list];

  switch (currentSort) {
    case "updated-asc":
      return items.sort((a, b) => new Date(a.deletedAt).getTime() - new Date(b.deletedAt).getTime());
    case "title-asc":
      return items.sort((a, b) => (a.title || "").localeCompare(b.title || "", "en", { sensitivity: "base" }));
    case "title-desc":
      return items.sort((a, b) => (b.title || "").localeCompare(a.title || "", "en", { sensitivity: "base" }));
    case "pinned":
    case "updated-desc":
    default:
      return items.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
  }
}

function setFabButtonIcon(button, label, tooltip) {
  if (!button) return;

  button.textContent = label;
  button.setAttribute("aria-label", tooltip);
}

function initializeFabIcons() {
  setFabButtonIcon(themeToggleBtn, "Theme", "Toggle theme");
  setFabButtonIcon(exportBtn, "Export", "Export notes");
  setFabButtonIcon(importBtn, "Import", "Import notes");
  setFabButtonIcon(pinNoteBtn, "Pin", "Pin active note");
  setFabButtonIcon(restoreNoteBtn, "Restore", "Restore selected note");
  setFabButtonIcon(deleteNoteBtn, "Delete", "Delete active note");
  setFabButtonIcon(permanentDeleteBtn, "Delete forever", "Permanently delete selected note");
}



function formatDate(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";

  const options = appSettings.dateFormat === "short"
    ? {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }
    : {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      };

  return date.toLocaleString("en-US", options);
}

function formatStatusDate(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";

  const options = appSettings.dateFormat === "short"
    ? {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }
    : {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      };

  return date.toLocaleString("en-US", options);
}

function getStartOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getRelativeTimeGroupLabel(dateString) {
  if (!dateString) return "Earlier";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Earlier";

  const now = new Date();
  const todayStart = getStartOfDay(now);
  const targetStart = getStartOfDay(date);
  const diffDays = Math.round((todayStart.getTime() - targetStart.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 7) return "Last 7 Days";
  return "Earlier";
}

function getGroupedVisibleItems(items) {
  const groups = [];
  let currentGroup = null;

  items.forEach((note) => {
    const referenceDate = currentView === "trash" ? note.deletedAt : note.updatedAt;
    const label = getRelativeTimeGroupLabel(referenceDate);

    if (!currentGroup || currentGroup.label !== label) {
      currentGroup = {
        label,
        items: []
      };
      groups.push(currentGroup);
    }

    currentGroup.items.push(note);
  });

  return groups;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeTags(raw) {
  const items = Array.isArray(raw) ? raw : String(raw || "").split(",");
  const seen = new Set();

  return items
    .map((tag) => String(tag).trim())
    .filter((tag) => tag.length > 0)
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}


function getTitleFromContent(content) {
  const firstMeaningfulLine = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return firstMeaningfulLine ? firstMeaningfulLine.slice(0, 40) : "New Note";
}

function getPreview(content) {
  const normalizedContent = String(content || "");
  const preview = normalizedContent.replace(/\s+/g, " ").trim();
  return preview ? preview.slice(0, 80) : "No content yet";
}

function getEditorTextStats(content) {
  const text = String(content || "");
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const characters = text.length;

  return {
    words,
    characters
  };
}

function renderEditorStats(content = "") {
  if (!wordCount || !characterCount) return;

  const stats = getEditorTextStats(content);
  wordCount.textContent = `${stats.words} ${stats.words === 1 ? "word" : "words"}`;
  characterCount.textContent = `${stats.characters} ${stats.characters === 1 ? "char" : "chars"}`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function getActiveNote() {
  if (!activeNoteId) return null;
  return notes.find((note) => note.id === activeNoteId) || null;
}

function getActiveTrashNote() {
  if (!activeTrashNoteId) return null;
  return trashNotes.find((note) => note.id === activeTrashNoteId) || null;
}

function clearPendingSave() {
  if (!saveTimeout) return;
  clearTimeout(saveTimeout);
  saveTimeout = null;
}

function getStatusDateForItem(item, view = currentView) {
  if (!item) return "";
  return view === "trash" ? item.deletedAt : item.updatedAt;
}

function updateStatusFromActiveItem(view = currentView) {
  const activeItem = view === "trash" ? getActiveTrashNote() : getActiveNote();
  const statusDate = getStatusDateForItem(activeItem, view);
  setStatus(statusDate ? formatStatusDate(statusDate) : "Ready");
}

function clearActiveTagFilterIfMissing() {
  if (!activeTagFilter) return;

  const activeTagLower = activeTagFilter.toLowerCase();
  const hasMatchingTag = getAllTagsForCurrentView().some(
    (tag) => tag.toLowerCase() === activeTagLower
  );

  if (!hasMatchingTag) {
    activeTagFilter = "";
  }
}

function updateDocumentTitle() {
  const activeItem = currentView === "trash" ? getActiveTrashNote() : getActiveNote();
  document.title = activeItem ? activeItem.title || "New Note" : "Note";
}

function sortNotes(list) {
  return getSortedNotesList(list);
}

function sortTrash(list) {
  return getSortedTrashList(list);
}

function getVisibleItems() {
  const q = searchQuery.trim().toLowerCase();
  const activeTagLower = activeTagFilter.toLowerCase();
  const source = currentView === "trash" ? sortTrash(trashNotes) : sortNotes(notes);

  return source.filter((note) => {
    const normalizedTags = normalizeTags(note.tags || []);
    const haystack = `${note.title || ""} ${note.content || ""} ${normalizedTags.join(" ")}`.toLowerCase();
    const matchesSearch = !q || haystack.includes(q);
    const matchesTag = !activeTagLower || normalizedTags.some((tag) => tag.toLowerCase() === activeTagLower);
    const matchesTaggedOnly = !onlyTagged || normalizedTags.length > 0;

    let matchesQuickFilter = true;
    if (currentView === "notes") {
      if (activeQuickFilter === "pinned") {
        matchesQuickFilter = Boolean(note.pinned);
      } else if (activeQuickFilter === "recent") {
        matchesQuickFilter = isRecentNote(note);
      }
    }

    return matchesSearch && matchesTag && matchesTaggedOnly && matchesQuickFilter;
  });
}

function getCurrentCollection() {
  return currentView === "trash" ? trashNotes : notes;
}

function getAllTagsForCurrentView() {
  const allTags = getCurrentCollection().flatMap((note) => normalizeTags(note.tags || []));
  const unique = [...new Set(allTags.map((tag) => tag.toLowerCase()))];

  return unique
    .map((lowerTag) => allTags.find((tag) => tag.toLowerCase() === lowerTag))
    .sort((a, b) => a.localeCompare(b, "en"));
}

function renderViewButtons() {
  notesViewBtn.classList.toggle("active", currentView === "notes");
  trashViewBtn.classList.toggle("active", currentView === "trash");
  renderSortControls();
  renderQuickFilters();
}


function renderNotesList() {
  notesList.innerHTML = "";
  renderEmptyState();

  if (notesList.hidden) {
    return;
  }

  const visibleItems = getVisibleItems();

  if (visibleItems.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-list-state";

    if (searchQuery.trim() || activeTagFilter || onlyTagged || activeQuickFilter !== "all") {
      emptyState.textContent = "No notes match the current filter";
    } else if (currentView === "trash") {
      emptyState.textContent = "Trash is empty";
    } else {
      emptyState.textContent = "No notes yet";
    }

    notesList.appendChild(emptyState);
    return;
  }

  const groupedItems = getGroupedVisibleItems(visibleItems);

  groupedItems.forEach((group) => {
    const groupLabel = document.createElement("div");
    groupLabel.className = "notes-group-label";
    groupLabel.textContent = group.label;
    notesList.appendChild(groupLabel);

    group.items.forEach((note) => {
      const isActive = currentView === "trash"
        ? note.id === activeTrashNoteId
        : note.id === activeNoteId;

      const item = document.createElement("button");
      item.className = `note-list-item${isActive ? " active" : ""}`;
      item.type = "button";

      const rightBadge = currentView === "trash"
        ? ""
        : (note.pinned ? "Pinned" : "");

      const dateText = currentView === "trash"
        ? `Deleted: ${formatDate(note.deletedAt)}`
        : formatDate(note.updatedAt);

      item.innerHTML = `
        <div class="note-item-head">
          <div class="note-item-title">${escapeHtml(note.title || "New Note")}</div>
          <div class="note-item-pin">${escapeHtml(rightBadge)}</div>
        </div>
        <div class="note-item-preview">${escapeHtml(getPreview(note.content || ""))}</div>
        <div class="note-item-tags">
          ${normalizeTags(note.tags || []).map((tag) => `<span class="tag-chip static">${escapeHtml(tag)}</span>`).join("")}
        </div>
        <div class="note-item-date">${escapeHtml(dateText)}</div>
      `;

      item.addEventListener("click", () => {
        if (currentView === "trash") {
          switchTrashNote(note.id);
        } else {
          switchNote(note.id);
        }
      });

      notesList.appendChild(item);
    });
  });
}

function renderEditorForNotesView() {
  const activeNote = getActiveNote();

  if (!activeNote) {
    noteTitle.value = "";
    noteEditor.value = "";
    renderEditorStats("");
    noteTitle.disabled = true;
    noteEditor.disabled = true;
    if (deleteNoteBtn) deleteNoteBtn.disabled = true;
    if (pinNoteBtn) {
      pinNoteBtn.disabled = true;
      pinNoteBtn.classList.remove("pinned");
      setFabButtonIcon(pinNoteBtn, "Pin", "Pin active note");
    }
    return;
  }

  noteTitle.disabled = false;
  noteEditor.disabled = false;
  if (deleteNoteBtn) deleteNoteBtn.disabled = false;
  if (pinNoteBtn) pinNoteBtn.disabled = false;

  noteTitle.value = activeNote.title || "";
  noteEditor.value = activeNote.content || "";
  renderEditorStats(activeNote.content || "");

  if (pinNoteBtn) {
    if (activeNote.pinned) {
      pinNoteBtn.classList.add("pinned");
      setFabButtonIcon(pinNoteBtn, "Pinned", "Pinned");
    } else {
      pinNoteBtn.classList.remove("pinned");
      setFabButtonIcon(pinNoteBtn, "Pin", "Pin active note");
    }
  }
}

function renderEditorForTrashView() {
  const activeTrashNote = getActiveTrashNote();

  if (!activeTrashNote) {
    noteTitle.value = "";
    noteEditor.value = "";
    renderEditorStats("");
    noteTitle.disabled = true;
    noteEditor.disabled = true;
    return;
  }

  noteTitle.value = activeTrashNote.title || "";
  noteEditor.value = activeTrashNote.content || "";
  renderEditorStats(activeTrashNote.content || "");
  noteTitle.disabled = true;
  noteEditor.disabled = true;
}

function renderActionButtons() {
  const inTrash = currentView === "trash";

  addNoteBtn.disabled = inTrash;

  if (deleteNoteBtn) deleteNoteBtn.style.display = inTrash ? "none" : "inline-flex";
  if (pinNoteBtn) pinNoteBtn.style.display = inTrash ? "none" : "inline-flex";
  if (restoreNoteBtn) restoreNoteBtn.style.display = inTrash ? "inline-flex" : "none";
  if (permanentDeleteBtn) permanentDeleteBtn.style.display = inTrash ? "inline-flex" : "none";

  if (inTrash) {
    const activeTrashNote = getActiveTrashNote();
    if (restoreNoteBtn) restoreNoteBtn.disabled = !activeTrashNote;
    if (permanentDeleteBtn) permanentDeleteBtn.disabled = !activeTrashNote;
  } else {
    const activeNote = getActiveNote();
    if (deleteNoteBtn) deleteNoteBtn.disabled = !activeNote;
    if (pinNoteBtn) pinNoteBtn.disabled = !activeNote;
  }
}

function renderActiveArea() {
  if (currentView === "trash") {
    renderEditorForTrashView();
  } else {
    renderEditorForNotesView();
  }
}

function renderThemeButton() {
  if (!themeToggleBtn) return;

  if (currentTheme === "dark") {
    setFabButtonIcon(themeToggleBtn, "Light", "Light theme");
  } else {
    setFabButtonIcon(themeToggleBtn, "Dark", "Dark theme");
  }
}

function renderAll() {
  renderViewButtons();
  renderNotesList();
  renderActiveArea();
  renderActionButtons();
  renderThemeButton();
  renderEmptyState();
  applySettingsToUI();
  renderTrashDock();
  updateDocumentTitle();
}

async function saveState(statusText = null) {
  try {
    await chrome.storage.local.set({
      [NOTES_KEY]: notes,
      [TRASH_KEY]: trashNotes,
      [ACTIVE_NOTE_KEY]: activeNoteId,
      [ACTIVE_TRASH_KEY]: activeTrashNoteId
    });

    if (statusText) {
      setStatus(statusText);

      const isRoutineSaveStatus = typeof statusText === "string" && statusText.startsWith("Saved");
      if (!isRoutineSaveStatus) {
        showToast(statusText);
      }
    }
  } catch (error) {
    console.error("Error while saving:", error);
    setStatus("Save error");
    showToast("Save error");
  }
}

async function saveTheme() {
  try {
    await chrome.storage.local.set({
      [THEME_KEY]: currentTheme
    });
  } catch (error) {
    console.error("Theme could not be saved:", error);
  }
}

function applyTheme(theme) {
  currentTheme = theme === "dark" ? "dark" : "light";
  document.body.classList.toggle("dark-theme", currentTheme === "dark");
  renderThemeButton();
}

async function loadTheme() {
  try {
    const result = await chrome.storage.local.get([THEME_KEY]);
    const storedTheme = result[THEME_KEY];
    const effectiveTheme = appSettings.theme === "system"
      ? getSystemTheme()
      : (storedTheme || appSettings.theme || "light");

    currentTheme = effectiveTheme;
    applyTheme(effectiveTheme);
  } catch (error) {
    console.error("Theme could not be loaded:", error);
    applyTheme(appSettings.theme === "system" ? getSystemTheme() : appSettings.theme);
  }
}

async function toggleTheme() {
  appSettings.theme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(appSettings.theme);
  syncSettingsUI();
  await saveAppSettings();
}

async function saveAppSettings() {
  try {
    await chrome.storage.local.set({
      [SETTINGS_KEY]: appSettings,
      [THEME_KEY]: currentTheme
    });
  } catch (error) {
    console.error("Settings could not be saved:", error);
  }
}

async function loadAppSettings() {
  try {
    const result = await chrome.storage.local.get([SETTINGS_KEY, THEME_KEY]);
    appSettings = normalizeSettings(result[SETTINGS_KEY]);

    const storedTheme = result[THEME_KEY];
    const effectiveTheme = appSettings.theme === "system"
      ? getSystemTheme()
      : (storedTheme || appSettings.theme || "light");

    applyTheme(effectiveTheme);
    syncSettingsUI();
  } catch (error) {
    console.error("Settings could not be loaded:", error);
    appSettings = normalizeSettings();
    applyTheme(appSettings.theme === "system" ? getSystemTheme() : appSettings.theme);
    syncSettingsUI();
  }
}

function normalizeNotes(rawNotes) {
  if (!Array.isArray(rawNotes)) return [];

  return rawNotes
    .filter((note) => note && typeof note === "object")
    .map((note) => {
      const content = typeof note.content === "string" ? note.content : "";
      const title =
        typeof note.title === "string" && note.title.trim()
          ? note.title.trim()
          : getTitleFromContent(content);

      return {
        id: typeof note.id === "string" && note.id ? note.id : generateId(),
        title: title || "New Note",
        content,
        tags: normalizeTags(note.tags || []),
        updatedAt:
          typeof note.updatedAt === "string" && !Number.isNaN(new Date(note.updatedAt).getTime())
            ? note.updatedAt
            : new Date().toISOString(),
        pinned: Boolean(note.pinned),
        deletedAt:
          typeof note.deletedAt === "string" && !Number.isNaN(new Date(note.deletedAt).getTime())
            ? note.deletedAt
            : null
      };
    });
}

async function loadState() {
  try {
    const result = await chrome.storage.local.get([
      NOTES_KEY,
      TRASH_KEY,
      ACTIVE_NOTE_KEY,
      ACTIVE_TRASH_KEY
    ]);

    notes = normalizeNotes(result[NOTES_KEY]).filter((n) => !n.deletedAt);
    trashNotes = normalizeNotes(result[TRASH_KEY]).map((n) => ({
      ...n,
      deletedAt: n.deletedAt || new Date().toISOString()
    }));

    activeNoteId = result[ACTIVE_NOTE_KEY] || null;
    activeTrashNoteId = result[ACTIVE_TRASH_KEY] || null;

    if (notes.length === 0) {
      activeNoteId = null;
    }

    if (!notes.some((note) => note.id === activeNoteId)) {
      activeNoteId = sortNotes(notes)[0]?.id || null;
    }

    if (!trashNotes.some((note) => note.id === activeTrashNoteId)) {
      activeTrashNoteId = sortTrash(trashNotes)[0]?.id || null;
    }

    updateStatusFromActiveItem();
    renderAll();
  } catch (error) {
    console.error("Error while loading:", error);
    setStatus("Load error");
  }
}

function createNote(shouldSave = true) {
  const now = new Date().toISOString();
  clearUndoDeleteState();

  const newNote = {
    id: generateId(),
    title: "",
    content: "",
    tags: [],
    updatedAt: now,
    pinned: false
  };

  notes.unshift(newNote);
  currentView = "notes";
  activeNoteId = newNote.id;
  renderAll();
  renderEditorStats("");
  noteTitle.focus();
  noteTitle.select();

  if (shouldSave) {
    saveState(`${formatStatusDate(now)}`);
  } else {
    setStatus(`${formatStatusDate(now)}`);
  }
}

function switchNote(noteId) {
  clearPendingSave();
  activeNoteId = noteId;
  renderAll();
  updateStatusFromActiveItem("notes");
  saveState();
}

function switchTrashNote(noteId) {
  activeTrashNoteId = noteId;
  renderAll();
  updateStatusFromActiveItem("trash");
  saveState();
}

function persistActiveNoteChanges() {
  if (currentView !== "notes") return;

  const activeNote = getActiveNote();
  if (!activeNote) return;

  const titleInput = noteTitle.value.trim();
  const contentInput = noteEditor.value;
  const computedTitle = titleInput || getTitleFromContent(contentInput);
  const now = new Date().toISOString();

  activeNote.title = computedTitle;
  activeNote.tags = [];
  activeNote.content = contentInput;
  activeNote.updatedAt = now;

  setStatus(`Saving...`);
  renderNotesList();
  renderEditorStats(contentInput);
  updateDocumentTitle();

  clearPendingSave();

  saveTimeout = setTimeout(async () => {
    saveTimeout = null;
    await saveState(`Saved • ${formatStatusDate(now)}`);
  }, 300);
}

async function moveActiveNoteToTrash() {
  if (currentView !== "notes") return;

  const activeNote = getActiveNote();
  if (!activeNote) return;

  if (appSettings.confirmBeforeDelete) {
    const approved = confirm(`Move “${activeNote.title || "New Note"}” to trash?`);
    if (!approved) return;
  }

  clearPendingSave();
  clearUndoDeleteState();

  lastDeletedNote = {
    ...activeNote,
    tags: normalizeTags(activeNote.tags || [])
  };

  notes = notes.filter((note) => note.id !== activeNoteId);
  trashNotes.unshift({
    ...activeNote,
    deletedAt: new Date().toISOString()
  });

  activeTrashNoteId = trashNotes[0]?.id || null;
  activeNoteId = sortNotes(notes)[0]?.id || null;

  clearActiveTagFilterIfMissing();

  renderAll();
  setStatus("Note moved to trash");
  await saveState();
  showUndoDeleteToast();
  renderTrashDock();
}

async function restoreActiveTrashNote() {
  if (currentView !== "trash") return;

  const activeTrashNote = getActiveTrashNote();
  if (!activeTrashNote) return;

  clearUndoDeleteState();

  trashNotes = trashNotes.filter((note) => note.id !== activeTrashNoteId);
  notes.unshift({
    id: activeTrashNote.id,
    title: activeTrashNote.title,
    content: activeTrashNote.content,
    tags: normalizeTags(activeTrashNote.tags || []),
    updatedAt: new Date().toISOString(),
    pinned: Boolean(activeTrashNote.pinned)
  });

  activeNoteId = notes[0].id;
  activeTrashNoteId = sortTrash(trashNotes)[0]?.id || null;
  currentView = "notes";

  renderAll();
  renderEditorStats(activeTrashNote.content || "");
  await saveState("Note restored");
}

async function permanentlyDeleteActiveTrashNote() {
  if (currentView !== "trash") return;

  const activeTrashNote = getActiveTrashNote();
  if (!activeTrashNote) return;

  if (appSettings.confirmBeforeDelete) {
    const approved = confirm(`Permanently delete “${activeTrashNote.title || "New Note"}”?`);
    if (!approved) return;
  }

  if (lastDeletedNote && lastDeletedNote.id === activeTrashNote.id) {
    clearUndoDeleteState();
  }

  trashNotes = trashNotes.filter((note) => note.id !== activeTrashNoteId);
  activeTrashNoteId = sortTrash(trashNotes)[0]?.id || null;

  clearActiveTagFilterIfMissing();

  renderAll();
  await saveState("Note permanently deleted");
}

async function togglePinActiveNote() {
  if (currentView !== "notes") return;

  const activeNote = getActiveNote();
  if (!activeNote) return;

  activeNote.pinned = !activeNote.pinned;
  activeNote.updatedAt = new Date().toISOString();

  renderAll();
  await saveState(activeNote.pinned ? "Note pinned" : "Note unpinned");
}

function exportNotes() {
  try {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: "Note",
      version: 3,
      notes,
      trashNotes
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const datePart = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `note-backup-${datePart}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
    setStatus("Notes exported");
    showToast("Notes exported");
  } catch (error) {
    console.error("Export error:", error);
    setStatus("Export error");
    showToast("Export error");
  }
}

function mergeNotes(targetList, importedNotes) {
  const existingIds = new Set(targetList.map((note) => note.id));

  importedNotes.forEach((note) => {
    const copy = { ...note, tags: normalizeTags(note.tags || []) };
    if (existingIds.has(copy.id)) {
      copy.id = generateId();
    }
    targetList.push(copy);
    existingIds.add(copy.id);
  });
}

async function importNotesFromFile(file) {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    const importedNotes = normalizeNotes(parsed.notes).filter((n) => !n.deletedAt);
    const importedTrash = normalizeNotes(parsed.trashNotes).map((n) => ({
      ...n,
      deletedAt: n.deletedAt || new Date().toISOString()
    }));

    if (importedNotes.length === 0 && importedTrash.length === 0) {
      setStatus("No valid data found to import");
      showToast("No valid data found to import");
      return;
    }

    const overwrite = confirm(
      "Should the imported data replace the current data?\n\nOK = Overwrite\nCancel = Merge"
    );

    if (overwrite) {
      notes = importedNotes.length > 0 ? importedNotes : [];
      trashNotes = importedTrash;
    } else {
      mergeNotes(notes, importedNotes);
      mergeNotes(trashNotes, importedTrash);
    }

    activeNoteId = sortNotes(notes)[0]?.id || null;
    activeTrashNoteId = sortTrash(trashNotes)[0]?.id || null;
    activeTagFilter = "";

    clearUndoDeleteState();
    renderAll();
    renderEditorStats(getActiveNote()?.content || "");
    await saveState("Data imported");
    showToast("Data imported");
  } catch (error) {
    console.error("Import error:", error);
    setStatus("Import error");
    showToast("Import error");
  } finally {
    importFileInput.value = "";
  }
}

function switchView(viewName) {
  currentView = viewName;
  activeTagFilter = "";
  renderAll();
  updateStatusFromActiveItem(viewName);
}

const IS_MAC = navigator.platform.toUpperCase().includes("MAC");
const systemThemeMedia = window.matchMedia("(prefers-color-scheme: dark)");


function handleThemePreferenceChange() {
  if (appSettings.theme !== "system") return;
  applyTheme(getSystemTheme());
  saveAppSettings();
}

function handleModalBackdropClick(e) {
  const closeTarget = e.target.closest("[data-close-modal]");
  if (!closeTarget) return;

  if (closeTarget.getAttribute("data-close-modal") === "settings") {
    closeModal(settingsModal);
  }

  if (closeTarget.getAttribute("data-close-modal") === "help") {
    closeModal(helpModal);
  }
}

addNoteBtn.addEventListener("click", () => {
  createNote(true);
});


emptyStateCreateBtn.addEventListener("click", () => {
  createNote(true);
});

if (settingsBtn) {
  settingsBtn.addEventListener("click", () => {
    openModal(settingsModal);
  });
}

if (helpBtn) {
  helpBtn.addEventListener("click", () => {
    openModal(helpModal);
  });
}

if (closeSettingsBtn) {
  closeSettingsBtn.addEventListener("click", () => {
    closeModal(settingsModal);
  });
}

if (closeHelpBtn) {
  closeHelpBtn.addEventListener("click", () => {
    closeModal(helpModal);
  });
}

if (settingsModal) {
  settingsModal.addEventListener("click", handleModalBackdropClick);
}

if (helpModal) {
  helpModal.addEventListener("click", handleModalBackdropClick);
}

if (trashDockBtn) {
  trashDockBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleTrashDock();
  });
}

if (trashDockPanel) {
  trashDockPanel.addEventListener("click", (e) => {
    e.stopPropagation();
  });
}

if (trashSelectBtn) {
  trashSelectBtn.addEventListener("click", () => {
    isTrashSelectionMode = !isTrashSelectionMode;
    if (!isTrashSelectionMode) {
      selectedTrashIds.clear();
    }
    renderTrashDock();
  });
}

if (trashSelectAllBtn) {
  trashSelectAllBtn.addEventListener("click", () => {
    const sortedTrashNotes = sortTrash(trashNotes);

    if (selectedTrashIds.size === sortedTrashNotes.length) {
      selectedTrashIds.clear();
    } else {
      selectedTrashIds = new Set(sortedTrashNotes.map((note) => note.id));
    }
    renderTrashDock();
  });
}

if (trashRestoreBtn) {
  trashRestoreBtn.addEventListener("click", async () => {
    await restoreSelectedTrashNotes();
  });
}

if (trashDeleteBtn) {
  trashDeleteBtn.addEventListener("click", async () => {
    await permanentlyDeleteSelectedTrashNotes();
  });
}


sortSelect.addEventListener("change", () => {
  currentSort = sortSelect.value;
  renderNotesList();
  renderViewButtons();
});

onlyTaggedBtn.addEventListener("click", () => {
  onlyTagged = !onlyTagged;
  renderAll();
});

filterAllBtn.addEventListener("click", () => {
  activeQuickFilter = "all";
  renderAll();
});

filterPinnedBtn.addEventListener("click", () => {
  activeQuickFilter = "pinned";
  renderAll();
});

filterRecentBtn.addEventListener("click", () => {
  activeQuickFilter = "recent";
  renderAll();
});

themeSelect.addEventListener("change", async () => {
  appSettings.theme = themeSelect.value;
  const effectiveTheme = appSettings.theme === "system" ? getSystemTheme() : appSettings.theme;
  applyTheme(effectiveTheme);
  await saveAppSettings();
});

dateFormatSelect.addEventListener("change", async () => {
  appSettings.dateFormat = dateFormatSelect.value;
  renderAll();
  updateStatusFromActiveItem();
  await saveAppSettings();
});

confirmDeleteToggle.addEventListener("change", async () => {
  appSettings.confirmBeforeDelete = confirmDeleteToggle.checked;
  await saveAppSettings();
});

focusSearchOnOpenToggle.addEventListener("change", async () => {
  appSettings.focusSearchOnOpen = focusSearchOnOpenToggle.checked;
  await saveAppSettings();
});

if (deleteNoteBtn) deleteNoteBtn.addEventListener("click", moveActiveNoteToTrash);
if (restoreNoteBtn) restoreNoteBtn.addEventListener("click", restoreActiveTrashNote);
if (permanentDeleteBtn) permanentDeleteBtn.addEventListener("click", permanentlyDeleteActiveTrashNote);
if (pinNoteBtn) pinNoteBtn.addEventListener("click", togglePinActiveNote);
if (themeToggleBtn) themeToggleBtn.addEventListener("click", toggleTheme);
if (exportBtn) exportBtn.addEventListener("click", exportNotes);
if (importBtn) {
  importBtn.addEventListener("click", () => {
    importFileInput.click();
  });
}

notesViewBtn.addEventListener("click", () => {
  switchView("notes");
});

trashViewBtn.addEventListener("click", () => {
  switchView("trash");
});

importFileInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await importNotesFromFile(file);
});

noteTitle.addEventListener("input", persistActiveNoteChanges);
noteTitle.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;

  e.preventDefault();
  persistActiveNoteChanges();
  noteEditor.focus();

  if (typeof noteEditor.setSelectionRange === "function") {
    const end = noteEditor.value.length;
    noteEditor.setSelectionRange(end, end);
  }
});
noteEditor.addEventListener("input", persistActiveNoteChanges);

searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value;
  renderNotesList();
  renderEmptyState();
});

document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (key === "escape") {
    closeModal(settingsModal);
    closeModal(helpModal);
    closeTrashDock();
  }

  if ((IS_MAC && e.metaKey && key === "s") || (!IS_MAC && e.ctrlKey && key === "s")) {
    e.preventDefault();
    persistActiveNoteChanges();
  }

  if ((IS_MAC && e.metaKey && key === "4") || (!IS_MAC && e.ctrlKey && key === "4")) {
    e.preventDefault();
    if (currentView === "notes") {
      createNote(true);
    }
  }

  if ((IS_MAC && e.metaKey && key === "f") || (!IS_MAC && e.ctrlKey && key === "f")) {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
});

document.addEventListener("click", () => {
  if (isTrashDockOpen) {
    closeTrashDock();
  }
});
if (trashDockPanel) {
  trashDockPanel.hidden = true;
  trashDockPanel.style.display = "none";
}

document.addEventListener("DOMContentLoaded", async () => {
  if (themeToggleBtn || exportBtn || importBtn || pinNoteBtn || restoreNoteBtn || deleteNoteBtn || permanentDeleteBtn) {
    initializeFabIcons();
  }
  await loadAppSettings();
  await loadState();
  applySettingsToUI();

  if (appSettings.focusSearchOnOpen) {
    searchInput.focus();
  }

  if (typeof systemThemeMedia.addEventListener === "function") {
    systemThemeMedia.addEventListener("change", handleThemePreferenceChange);
  } else if (typeof systemThemeMedia.addListener === "function") {
    systemThemeMedia.addListener(handleThemePreferenceChange);
  }
});