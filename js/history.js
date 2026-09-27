/* =========================================================================
   js/history.js
   -------------------------------------------------------------------------
   Runs only on history.html. Reads records from localStorage (via the
   getHistory/deleteHistoryRecord/clearHistory helpers defined in app.js)
   and renders them as cards, newest first. Handles:
     - deleting a single record
     - clearing all history (with a confirmation step)
     - an empty-state message when there is no history yet
   ========================================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const listEl = document.getElementById("history-list");
  if (!listEl) return; // Not on the history page.

  renderHistory();

  document.getElementById("clear-history-btn").addEventListener("click", () => {
    const history = getHistory();
    if (history.length === 0) return;

    const confirmed = window.confirm(
      "This will permanently delete all saved predictions from this browser. Continue?"
    );
    if (confirmed) {
      clearHistory();
      renderHistory();
    }
  });
});

function renderHistory() {
  const listEl = document.getElementById("history-list");
  const emptyState = document.getElementById("history-empty");
  const clearBtn = document.getElementById("clear-history-btn");
  const history = getHistory();

  listEl.innerHTML = "";

  if (history.length === 0) {
    emptyState.hidden = false;
    clearBtn.hidden = true;
    return;
  }

  emptyState.hidden = true;
  clearBtn.hidden = false;

  history.forEach((record) => {
    const card = document.createElement("article");
    card.className = "history-card";

    const confidenceClass =
      record.confidence >= 70
        ? "confidence-high"
        : record.confidence >= 40
        ? "confidence-medium"
        : "confidence-low";

    card.innerHTML = `
      <div class="history-card-header">
        <div>
          <h3>${escapeHtml(record.disease)}</h3>
          <p class="history-date">${formatDate(record.timestamp)}</p>
        </div>
        <span class="confidence-pill ${confidenceClass}">${record.confidence}%</span>
      </div>
      <p class="history-symptoms">
        <strong>Symptoms:</strong> ${record.symptoms.map(escapeHtml).join(", ")}
      </p>
      <button class="btn btn-ghost btn-small delete-record-btn" data-id="${record.id}">
        Delete record
      </button>
    `;

    card
      .querySelector(".delete-record-btn")
      .addEventListener("click", () => {
        deleteHistoryRecord(record.id);
        renderHistory();
      });

    listEl.appendChild(card);
  });
}

/** Minimal HTML-escaping so symptom text can't break the markup. */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
