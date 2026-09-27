/* =========================================================================
   js/analytics.js
   -------------------------------------------------------------------------
   Runs only on analytics.html. This is the "data science" layer of the
   project: it doesn't change how predictions are made (that stays in
   js/prediction.js), it INSPECTS the dataset and VALIDATES the existing
   Predictor algorithm, the way you would in an EDA + model-evaluation
   notebook — just done client-side in JS instead of pandas/sklearn.

   Two things happen here:

     1. EXPLORATORY DATA ANALYSIS (EDA)
        Basic descriptive statistics over data/diseases.js: symptom
        frequency across conditions, weight distribution, and profile
        (symptom-count) size per disease.

     2. SYNTHETIC MODEL VALIDATION
        DISEASE_DB has no labelled patient records to test against (it's a
        hand-authored knowledge base, not a clinical dataset), so instead
        we generate SYNTHETIC test cases: for every disease, we repeatedly
        sample a random subset of that disease's own known symptoms (to
        imitate a real patient who doesn't report every symptom) and check
        whether Predictor.predict() still recovers the correct disease.

        This is a standard technique for sanity-checking a rule-based
        system when no external labelled dataset exists — it measures the
        INTERNAL CONSISTENCY and NOISE ROBUSTNESS of the scoring algorithm,
        not real-world diagnostic accuracy. That distinction is stated
        explicitly in the UI so it's never misread as a clinical claim.

        A seeded pseudo-random generator (seed = 42) is used so every
        reload / screenshot / report produces the exact same numbers —
        the JS equivalent of `random_state=42` in scikit-learn.
   ========================================================================= */

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) — deterministic "randomness" for reproducibility.
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(42);

function seededShuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Validation configuration
// ---------------------------------------------------------------------------
const COMPLETENESS_LEVELS = [1.0, 0.8, 0.6, 0.4, 0.2]; // % of a disease's symptoms "reported"
const TRIALS_PER_LEVEL = 40; // synthetic patients simulated per disease, per level
const CONFUSION_LEVEL = 0.7; // "realistic" reporting level used for the confusion matrix
const CONFUSION_TRIALS = 60; // synthetic patients per disease at CONFUSION_LEVEL

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("analytics-root");
  if (!root) return; // Not on the analytics page.

  renderDatasetOverview();
  renderSymptomFrequencyChart();
  renderProfileSizeChart();
  renderWeightHistogram();
  runAndRenderValidation();
});

// ---------------------------------------------------------------------------
// Helpers to read theme colors from CSS variables, so charts always match
// the site's palette even if style.css is retouched later.
// ---------------------------------------------------------------------------
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Converts a "#RRGGBB" string to an [r, g, b] array. Returns null on failure. */
function hexToRgb(hex) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return null;
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}

// ===========================================================================
// 1. DATASET OVERVIEW (stat cards)
// ===========================================================================
function renderDatasetOverview() {
  const db = window.DISEASE_DB;
  const symptoms = window.SYMPTOM_LIST;

  const totalAssociations = db.reduce((sum, d) => sum + Object.keys(d.symptoms).length, 0);
  const allWeights = db.flatMap((d) => Object.values(d.symptoms));
  const avgWeight = allWeights.reduce((a, b) => a + b, 0) / allWeights.length;
  const avgProfileSize = totalAssociations / db.length;

  const stats = [
    { number: symptoms.length, label: "Symptoms tracked" },
    { number: db.length, label: "Conditions modeled" },
    { number: totalAssociations, label: "Symptom–disease associations" },
    { number: avgProfileSize.toFixed(1), label: "Avg. symptoms per condition" },
    { number: avgWeight.toFixed(2), label: "Avg. symptom weight" },
  ];

  const wrap = document.getElementById("overview-stats");
  wrap.innerHTML = stats
    .map(
      (s) => `
      <div class="stat-card">
        <span class="stat-number">${s.number}</span>
        <span class="stat-label">${s.label}</span>
      </div>`
    )
    .join("");
}

// ===========================================================================
// 2. EDA CHARTS
// ===========================================================================
function renderSymptomFrequencyChart() {
  const db = window.DISEASE_DB;
  const symptoms = window.SYMPTOM_LIST;

  const counts = {};
  symptoms.forEach((s) => (counts[s.id] = 0));
  db.forEach((d) => {
    Object.keys(d.symptoms).forEach((sid) => {
      counts[sid] = (counts[sid] || 0) + 1;
    });
  });

  const ranked = symptoms
    .map((s) => ({ label: s.label, count: counts[s.id] }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  new Chart(document.getElementById("chart-symptom-frequency"), {
    type: "bar",
    data: {
      labels: ranked.map((r) => r.label),
      datasets: [
        {
          label: "Conditions it appears in",
          data: ranked.map((r) => r.count),
          backgroundColor: cssVar("--primary"),
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1 } },
      },
    },
  });
}

function renderProfileSizeChart() {
  const db = window.DISEASE_DB;
  const ranked = db
    .map((d) => ({ label: d.name, count: Object.keys(d.symptoms).length }))
    .sort((a, b) => b.count - a.count);

  new Chart(document.getElementById("chart-profile-size"), {
    type: "bar",
    data: {
      labels: ranked.map((r) => r.label),
      datasets: [
        {
          label: "Symptoms tracked for this condition",
          data: ranked.map((r) => r.count),
          backgroundColor: cssVar("--accent"),
          borderRadius: 4,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
        x: { ticks: { autoSkip: false, maxRotation: 60, minRotation: 40 } },
      },
    },
  });
}

function renderWeightHistogram() {
  const db = window.DISEASE_DB;
  const weights = db.flatMap((d) => Object.values(d.symptoms));

  const buckets = [
    { label: "0.1–0.29\n(weak)", min: 0.1, max: 0.29 },
    { label: "0.3–0.49", min: 0.3, max: 0.49 },
    { label: "0.5–0.69", min: 0.5, max: 0.69 },
    { label: "0.7–0.89", min: 0.7, max: 0.89 },
    { label: "0.9–1.0\n(defining)", min: 0.9, max: 1.0 },
  ];
  const counts = buckets.map(
    (b) => weights.filter((w) => w >= b.min && w <= b.max).length
  );

  new Chart(document.getElementById("chart-weight-histogram"), {
    type: "bar",
    data: {
      labels: buckets.map((b) => b.label),
      datasets: [
        {
          label: "Number of symptom–disease links",
          data: counts,
          backgroundColor: cssVar("--primary-dark"),
          borderRadius: 4,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 2 } } },
    },
  });
}

// ===========================================================================
// 3. SYNTHETIC MODEL VALIDATION
// ===========================================================================

/**
 * Simulates one synthetic patient with `disease` at a given symptom
 * "completeness" level (e.g. 0.6 = the patient reports 60% of the
 * condition's known symptoms, sampled at random) and returns the
 * Predictor's top prediction for that case.
 */
function simulateCase(disease, level) {
  const allSymptoms = Object.keys(disease.symptoms);
  const sampleSize = Math.max(1, Math.round(allSymptoms.length * level));
  const reported = seededShuffle(allSymptoms).slice(0, sampleSize);
  const results = Predictor.predict(reported);
  const top = results[0];
  const predictedId = top.confidence < NO_MATCH_THRESHOLD ? null : top.disease.id;
  return predictedId;
}

/** Accuracy of top-1 recovery at each completeness level -> robustness curve. */
function computeRobustnessCurve() {
  const db = window.DISEASE_DB;
  return COMPLETENESS_LEVELS.map((level) => {
    let correct = 0;
    let total = 0;
    db.forEach((disease) => {
      for (let t = 0; t < TRIALS_PER_LEVEL; t++) {
        total++;
        if (simulateCase(disease, level) === disease.id) correct++;
      }
    });
    return { level, accuracy: correct / total };
  });
}

/** Builds an actual-vs-predicted confusion matrix at CONFUSION_LEVEL. */
function computeConfusionMatrix() {
  const db = window.DISEASE_DB;
  const idIndex = {};
  db.forEach((d, i) => (idIndex[d.id] = i));

  // Extra column at the end catches "no clear match" outcomes.
  const matrix = db.map(() => new Array(db.length + 1).fill(0));

  db.forEach((disease) => {
    const rowIdx = idIndex[disease.id];
    for (let t = 0; t < CONFUSION_TRIALS; t++) {
      const predictedId = simulateCase(disease, CONFUSION_LEVEL);
      const colIdx = predictedId === null ? db.length : idIndex[predictedId];
      matrix[rowIdx][colIdx]++;
    }
  });
  return matrix;
}

/** Macro-averaged precision / recall / F1 + overall accuracy from the matrix. */
function computeMetrics(matrix) {
  const n = matrix.length; // number of disease classes (excludes "no match" col)
  let correctTotal = 0;
  let grandTotal = 0;
  let precisions = [];
  let recalls = [];

  for (let i = 0; i < n; i++) {
    const rowSum = matrix[i].reduce((a, b) => a + b, 0); // actual = i
    let colSum = 0;
    for (let r = 0; r < n; r++) colSum += matrix[r][i]; // predicted = i

    const tp = matrix[i][i];
    correctTotal += tp;
    grandTotal += rowSum;

    recalls.push(rowSum > 0 ? tp / rowSum : null);
    precisions.push(colSum > 0 ? tp / colSum : null);
  }

  const avg = (arr) => {
    const valid = arr.filter((v) => v !== null);
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
  };

  const macroPrecision = avg(precisions);
  const macroRecall = avg(recalls);
  const macroF1 =
    macroPrecision + macroRecall > 0
      ? (2 * macroPrecision * macroRecall) / (macroPrecision + macroRecall)
      : 0;

  return {
    accuracy: correctTotal / grandTotal,
    macroPrecision,
    macroRecall,
    macroF1,
  };
}

function abbreviateDisease(disease) {
  const parts = disease.id.split("_");
  if (parts.length > 1) return parts.map((p) => p[0].toUpperCase()).join("");
  return disease.id.slice(0, 3).toUpperCase();
}

function runAndRenderValidation() {
  const db = window.DISEASE_DB;
  const curve = computeRobustnessCurve();
  const matrix = computeConfusionMatrix();
  const metrics = computeMetrics(matrix);

  // --- metric stat cards ---------------------------------------------
  const metricStats = [
    { number: `${Math.round(metrics.accuracy * 100)}%`, label: "Top-1 accuracy (synthetic test)" },
    { number: `${Math.round(metrics.macroPrecision * 100)}%`, label: "Macro precision" },
    { number: `${Math.round(metrics.macroRecall * 100)}%`, label: "Macro recall" },
    { number: `${Math.round(metrics.macroF1 * 100)}%`, label: "Macro F1 score" },
  ];
  document.getElementById("validation-stats").innerHTML = metricStats
    .map(
      (s) => `
      <div class="stat-card">
        <span class="stat-number">${s.number}</span>
        <span class="stat-label">${s.label}</span>
      </div>`
    )
    .join("");

  // --- robustness curve -------------------------------------------------
  new Chart(document.getElementById("chart-robustness"), {
    type: "line",
    data: {
      labels: curve.map((c) => `${Math.round(c.level * 100)}%`),
      datasets: [
        {
          label: "Top-1 accuracy",
          data: curve.map((c) => +(c.accuracy * 100).toFixed(1)),
          borderColor: cssVar("--primary"),
          backgroundColor: cssVar("--primary-light"),
          fill: true,
          tension: 0.3,
          pointRadius: 4,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, max: 100, title: { display: true, text: "Accuracy (%)" } },
        x: { title: { display: true, text: "Symptoms reported (completeness)" } },
      },
    },
  });

  // --- confusion matrix heatmap table ------------------------------------
  const labels = db.map(abbreviateDisease).concat(["N/M"]);
  const maxVal = Math.max(...matrix.flat());
  const [pr, pg, pb] = hexToRgb(cssVar("--primary")) || [42, 111, 111];

  let html = "<table class='confusion-matrix'><thead><tr><th>Actual \\ Predicted</th>";
  labels.forEach((l) => (html += `<th>${l}</th>`));
  html += "</tr></thead><tbody>";

  matrix.forEach((row, i) => {
    html += `<tr><th>${abbreviateDisease(db[i])}</th>`;
    row.forEach((val, j) => {
      const alpha = maxVal > 0 ? val / maxVal : 0;
      const isDiagonal = i === j;
      const bg = val === 0 ? "transparent" : `rgba(${pr}, ${pg}, ${pb}, ${(alpha * 0.85 + 0.1).toFixed(2)})`;
      html += `<td style="background:${bg};" class="${isDiagonal ? "cm-diagonal" : ""}">${val}</td>`;
    });
    html += "</tr>";
  });
  html += "</tbody></table>";
  document.getElementById("confusion-matrix-wrap").innerHTML = html;

  // --- legend --------------------------------------------------------
  const legend = db
    .map((d) => `<li><strong>${abbreviateDisease(d)}</strong> — ${d.name}</li>`)
    .concat(["<li><strong>N/M</strong> — No clear match (below threshold)</li>"])
    .join("");
  document.getElementById("confusion-legend").innerHTML = legend;
}
