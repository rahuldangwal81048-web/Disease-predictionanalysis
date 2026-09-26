/* =========================================================================
   js/prediction.js
   -------------------------------------------------------------------------
   Runs only on prediction.html. Responsible for:
     1. Rendering the searchable symptom checklist from data/diseases.js
     2. Tracking which symptoms the user has selected
     3. Validating that at least one symptom is chosen
     4. Running the prediction algorithm (see the `Predictor` object below)
     5. Rendering the result card (top match, two runner-ups, description,
        common symptoms, general guidance) and any red-flag warning
     6. Saving the prediction into localStorage history

   ==========================  THE PREDICTION MODEL  ========================
   `Predictor` is written as a small, self-contained object so it can be
   swapped out later for something more advanced (e.g. a model trained
   with a real ML library, or a call to an external API) without touching
   any of the UI code below it. Any replacement just needs to expose the
   same method signature:

       Predictor.predict(selectedSymptomIds: string[]) -> [
         { disease: <entry from DISEASE_DB>, confidence: number (0-100) },
         ...sorted by confidence, highest first
       ]

   (The field is still called `confidence` internally so previously saved
   history records keep working; the UI labels it "match score" because it
   measures how well the symptoms fit a profile, not a probability.)

   HOW THE CURRENT ("weighted symptom-matching") ALGORITHM WORKS
   ---------------------------------------------------------------
   Every disease in DISEASE_DB stores a set of symptoms with a WEIGHT from
   0.1 (weak/common signal) to 1.0 (strong/defining signal). For each
   disease we calculate:

     1. matchedWeight  = sum of weights for symptoms the user selected
                          AND that belong to this disease.
     2. maxWeight       = sum of ALL weights for this disease.
     3. effectiveMax    = a blend of maxWeight and the AVERAGE maxWeight
                          across all diseases (see PROFILE_BLEND).
                          Without this, a disease with only 3 listed
                          symptoms (e.g. UTI) reaches a high score far more
                          easily than one with 9 (e.g. Common Cold), simply
                          because its profile is shorter. Blending pulls
                          every disease toward a common scale.
     4. coverage        = min(1, matchedWeight / effectiveMax)
     5. noisePenalty    = a small penalty for each selected symptom NOT
                          associated with this disease (capped).
     6. finalScore      = coverage - noisePenalty, clamped to [0, 1]

   Diseases are ranked by finalScore. Ties are broken by (a) higher
   matchedWeight, (b) more matched symptoms, (c) alphabetical name, so the
   result never depends on the order of entries in DISEASE_DB.

   This is a deliberately simple, transparent heuristic (NOT a trained
   machine learning model) chosen so it is easy to read, explain in a
   project report/viva, and replace later.
   ========================================================================= */

// Below this score we say "No clear match" instead of naming a condition.
// Used by BOTH the result card and the history record so they always agree.
const NO_MATCH_THRESHOLD = 15;

// How many results to show (1 main card + the rest as "other possibilities").
const MAX_RESULTS_SHOWN = 3;

const NOISE_PER_SYMPTOM = 0.03;
const MAX_NOISE_PENALTY = 0.3;
const PROFILE_BLEND = 0.5; // 0 = ignore profile size, 1 = raw (old) behaviour

const Predictor = {
  modelName: "Weighted Symptom-Matching (v2)",

  predict(selectedSymptomIds) {
    const db = window.DISEASE_DB;

    const maxWeights = db.map((d) =>
      Object.values(d.symptoms).reduce((sum, w) => sum + w, 0)
    );
    const avgMaxWeight = maxWeights.reduce((a, b) => a + b, 0) / db.length;

    const results = db.map((disease, i) => {
      const symptomWeights = disease.symptoms;
      const diseaseSymptomIds = Object.keys(symptomWeights);

      let matchedWeight = 0;
      let matchedCount = 0;
      diseaseSymptomIds.forEach((sid) => {
        if (selectedSymptomIds.includes(sid)) {
          matchedWeight += symptomWeights[sid];
          matchedCount += 1;
        }
      });

      const effectiveMax =
        PROFILE_BLEND * maxWeights[i] + (1 - PROFILE_BLEND) * avgMaxWeight;
      const coverage = Math.min(1, matchedWeight / effectiveMax);

      // Count selected symptoms that don't belong to this disease at all.
      const noiseCount = selectedSymptomIds.length - matchedCount;
      const noisePenalty = Math.min(noiseCount * NOISE_PER_SYMPTOM, MAX_NOISE_PENALTY);

      const finalScore = Math.max(0, Math.min(1, coverage - noisePenalty));

      return {
        disease,
        confidence: Math.round(finalScore * 100),
        score: finalScore, // unrounded, used for sorting
        matchedWeight,
        matchedCount,
      };
    });

    // Highest score first, with deterministic tie-breaks.
    results.sort(
      (a, b) =>
        b.score - a.score ||
        b.matchedWeight - a.matchedWeight ||
        b.matchedCount - a.matchedCount ||
        a.disease.name.localeCompare(b.disease.name)
    );
    return results;
  },

  /** Returns the labels of any selected symptoms flagged as warning signs. */
  getRedFlags(selectedSymptomIds) {
    return (window.RED_FLAG_SYMPTOMS || [])
      .filter((id) => selectedSymptomIds.includes(id))
      .map((id) => window.SYMPTOM_LIST.find((s) => s.id === id)?.label || id);
  },
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let selectedSymptoms = new Set();

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const listEl = document.getElementById("symptom-list");
  if (!listEl) return; // Not on the prediction page.

  renderSymptomList(window.SYMPTOM_LIST);

  const searchInput = document.getElementById("symptom-search");
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = window.SYMPTOM_LIST.filter((s) =>
      s.label.toLowerCase().includes(query)
    );
    renderSymptomList(filtered);
  });

  document
    .getElementById("predict-btn")
    .addEventListener("click", handlePredictClick);

  document
    .getElementById("reset-selection-btn")
    .addEventListener("click", () => {
      selectedSymptoms.clear();
      searchInput.value = "";
      renderSymptomList(window.SYMPTOM_LIST);
      updateSelectedCount();
      hideValidationError();
      hideResult();
    });
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function renderSymptomList(symptoms) {
  const listEl = document.getElementById("symptom-list");
  listEl.innerHTML = "";

  if (symptoms.length === 0) {
    listEl.innerHTML = `<p class="empty-note">No symptoms match your search.</p>`;
    return;
  }

  symptoms.forEach((symptom) => {
    const isChecked = selectedSymptoms.has(symptom.id);
    const item = document.createElement("label");
    item.className = "symptom-chip" + (isChecked ? " is-selected" : "");
    item.setAttribute("for", `symptom-${symptom.id}`);
    item.innerHTML = `
      <input type="checkbox" id="symptom-${symptom.id}" value="${symptom.id}" ${isChecked ? "checked" : ""} />
      <span>${symptom.label}</span>
    `;
    const checkbox = item.querySelector("input");
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedSymptoms.add(symptom.id);
        item.classList.add("is-selected");
      } else {
        selectedSymptoms.delete(symptom.id);
        item.classList.remove("is-selected");
      }
      updateSelectedCount();
      hideValidationError();
    });
    listEl.appendChild(item);
  });
}

function updateSelectedCount() {
  const countEl = document.getElementById("selected-count");
  countEl.textContent = selectedSymptoms.size;
}

// ---------------------------------------------------------------------------
// Predict button handler
// ---------------------------------------------------------------------------
function handlePredictClick() {
  if (selectedSymptoms.size === 0) {
    showValidationError("Please select at least one symptom before predicting.");
    return;
  }
  hideValidationError();

  const selectedIds = Array.from(selectedSymptoms);
  const results = Predictor.predict(selectedIds);
  const redFlags = Predictor.getRedFlags(selectedIds);

  renderResult(results, redFlags);

  // Save every prediction. Uses the same NO_MATCH_THRESHOLD as the result
  // card, so what's saved always matches what the user saw on screen.
  const top = results[0];
  const isNoMatch = top.confidence < NO_MATCH_THRESHOLD;
  addHistoryRecord({
    id: `pred_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    symptoms: selectedIds.map(
      (id) => window.SYMPTOM_LIST.find((s) => s.id === id)?.label || id
    ),
    disease: isNoMatch ? "No clear match found" : top.disease.name,
    confidence: top.confidence,
    timestamp: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Result rendering
// ---------------------------------------------------------------------------
function confidenceClass(value) {
  return "confidence-fill " +
    (value >= 70 ? "confidence-high" : value >= 40 ? "confidence-medium" : "confidence-low");
}

function renderResult(results, redFlags) {
  const resultSection = document.getElementById("result-section");
  resultSection.hidden = false;
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });

  const { disease, confidence } = results[0];

  const nameEl = document.getElementById("result-disease-name");
  const confidenceBar = document.getElementById("confidence-bar");
  const confidenceLabel = document.getElementById("confidence-label");
  const descEl = document.getElementById("result-description");
  const symptomsEl = document.getElementById("result-common-symptoms");
  const guidanceEl = document.getElementById("result-guidance");
  const noMatchNote = document.getElementById("no-match-note");

  // Red-flag notice is independent of the prediction: always shown when any
  // warning-sign symptom is selected, even for a "no clear match" result.
  renderRedFlags(redFlags);

  // Always reset the bar colour so it never keeps the previous result's colour.
  confidenceBar.className = confidenceClass(confidence);
  confidenceBar.style.width = `${confidence}%`;

  if (confidence < NO_MATCH_THRESHOLD) {
    nameEl.textContent = "No clear match found";
    confidenceLabel.textContent = `${confidence}% match score`;
    descEl.textContent =
      "Your selected symptoms don't closely match any condition in this educational demo dataset.";
    symptomsEl.innerHTML = "";
    guidanceEl.textContent =
      "This tool has a very limited sample dataset. If you have ongoing health concerns, please consult a qualified doctor.";
    noMatchNote.hidden = false;
    renderAlternatives([]);
    return;
  }

  noMatchNote.hidden = true;
  nameEl.textContent = disease.name;
  confidenceLabel.textContent = `${confidence}% match score (prediction, not a diagnosis)`;
  descEl.textContent = disease.description;

  symptomsEl.innerHTML = "";
  disease.commonSymptoms.forEach((s) => {
    const li = document.createElement("li");
    li.textContent = s;
    symptomsEl.appendChild(li);
  });

  guidanceEl.textContent = disease.guidance;

  // Runner-ups: next results that still clear the "no match" threshold.
  renderAlternatives(
    results.slice(1, MAX_RESULTS_SHOWN).filter((r) => r.confidence >= NO_MATCH_THRESHOLD)
  );
}

function renderAlternatives(alternatives) {
  const wrap = document.getElementById("alt-results");
  const list = document.getElementById("alt-list");
  list.innerHTML = "";

  if (alternatives.length === 0) {
    wrap.hidden = true;
    return;
  }

  alternatives.forEach(({ disease, confidence }) => {
    const li = document.createElement("li");
    li.className = "alt-item";

    const name = document.createElement("span");
    name.className = "alt-name";
    name.textContent = disease.name;

    const pill = document.createElement("span");
    pill.className = "confidence-pill " + confidenceClass(confidence).split(" ")[1];
    pill.textContent = `${confidence}%`;

    li.append(name, pill);
    list.appendChild(li);
  });
  wrap.hidden = false;
}

function renderRedFlags(redFlags) {
  const alertEl = document.getElementById("redflag-alert");
  if (redFlags.length === 0) {
    alertEl.hidden = true;
    return;
  }
  document.getElementById("redflag-text").textContent =
    `You selected symptoms that can sometimes point to a serious problem (${redFlags.join(", ")}). ` +
    `Whatever the prediction below says, please seek urgent medical care if these are severe, sudden, or getting worse.`;
  alertEl.hidden = false;
}

function hideResult() {
  const resultSection = document.getElementById("result-section");
  if (resultSection) resultSection.hidden = true;
}

// ---------------------------------------------------------------------------
// Validation message
// ---------------------------------------------------------------------------
function showValidationError(message) {
  const el = document.getElementById("validation-error");
  el.textContent = message;
  el.hidden = false;
}
function hideValidationError() {
  const el = document.getElementById("validation-error");
  if (el) el.hidden = true;
}
