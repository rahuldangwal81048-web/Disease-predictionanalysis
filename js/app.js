/* =========================================================================
   js/app.js
   -------------------------------------------------------------------------
   Shared logic used on EVERY page of the site:
     - Mobile navigation toggle
     - Highlighting the current page's nav link
     - Small localStorage helper functions reused by prediction.js/history.js
     - Home page: filling in live stats (symptom/disease counts) and the
       recent-prediction preview, if any history already exists.

   Loaded on every HTML page, after data/diseases.js.
   ========================================================================= */

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------
// A single, clearly-named key holds the whole history array as JSON.
const STORAGE_KEY = "diseasePredictionHistory";

/**
 * Safely reads the prediction history from localStorage.
 * Returns an empty array if the key is missing, empty, or the JSON is
 * corrupted (e.g. edited by hand, or from an older/incompatible version).
 */
function getHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Guard against corrupted data that isn't actually an array.
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    console.warn("Prediction history was corrupted and has been reset.", err);
    return [];
  }
}

/**
 * Overwrites the stored history with a new array.
 * Wrapped in try/catch in case storage is full or disabled (e.g. private
 * browsing mode in some browsers).
 */
function saveHistory(historyArray) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(historyArray));
    return true;
  } catch (err) {
    console.error("Could not save to localStorage.", err);
    return false;
  }
}

/** Adds one new prediction record to the front of the history list. */
function addHistoryRecord(record) {
  const history = getHistory();
  history.unshift(record); // newest first
  saveHistory(history);
}

/** Removes a single record by its unique id. */
function deleteHistoryRecord(id) {
  const history = getHistory().filter((r) => r.id !== id);
  saveHistory(history);
}

/** Wipes the entire history. */
function clearHistory() {
  saveHistory([]);
}

// ---------------------------------------------------------------------------
// Navigation: mobile toggle + active link highlight
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");

  if (toggleBtn && navLinks) {
    toggleBtn.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("is-open");
      toggleBtn.setAttribute("aria-expanded", String(isOpen));
    });
  }

  // Mark the current page's link as active, based on the file name.
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach((link) => {
    const linkPage = link.getAttribute("href");
    if (linkPage === currentPage) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  });

  // Run home-page-only setup if the relevant elements exist on this page.
  initHomePage();
});

// ---------------------------------------------------------------------------
// Home page extras: dataset stats + "last prediction" teaser
// ---------------------------------------------------------------------------
function initHomePage() {
  const symptomCountEl = document.getElementById("stat-symptom-count");
  const diseaseCountEl = document.getElementById("stat-disease-count");
  const historyCountEl = document.getElementById("stat-history-count");

  // If none of these exist, we are not on the home page — stop quietly.
  if (!symptomCountEl && !diseaseCountEl && !historyCountEl) return;

  if (symptomCountEl && window.SYMPTOM_LIST) {
    symptomCountEl.textContent = window.SYMPTOM_LIST.length;
  }
  if (diseaseCountEl && window.DISEASE_DB) {
    diseaseCountEl.textContent = window.DISEASE_DB.length;
  }
  if (historyCountEl) {
    historyCountEl.textContent = getHistory().length;
  }

  // Show a small "last checked" teaser card if history exists.
  const teaser = document.getElementById("last-prediction-teaser");
  if (teaser) {
    const history = getHistory();
    if (history.length > 0) {
      const last = history[0];
      teaser.hidden = false;
      teaser.querySelector(".teaser-disease").textContent = last.disease;
      teaser.querySelector(".teaser-date").textContent = formatDate(last.timestamp);
    }
  }
}

// ---------------------------------------------------------------------------
// Small shared utility used by prediction.js and history.js too
// ---------------------------------------------------------------------------
function formatDate(isoString) {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
