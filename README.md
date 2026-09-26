# Disease Prediction System

A **front-end-only** educational symptom checker built with plain HTML, CSS
and JavaScript. No backend, server, database, or internet connection is
required after the files are downloaded.

> ⚠️ **Educational project only.** Predictions come from a small
> demonstration dataset and a simplified heuristic algorithm. This is
> **not** a medical device and must never be used for real diagnosis or
> treatment decisions. Always consult a qualified doctor for real health
> concerns.

---

## 1. How to run it locally

No installation, build step, or server is required.

1. Download / copy the `disease-prediction-system` folder to your computer.
2. Double-click **`index.html`** — it will open in your default browser.
   *(Or right-click → Open with → your browser of choice.)*
3. Use the navigation bar to move between **Home**, **Prediction**,
   **History**, **Analytics**, and **About**.

**Optional (recommended for smoothest experience):** serve the folder with
any static file server instead of opening the file directly, since some
browsers apply extra restrictions to `file://` pages. For example, with
Python installed:

```bash
cd disease-prediction-system
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser. This step is optional —
plain double-click also works in virtually all modern browsers.

---

## 2. Project structure

```text
disease-prediction-system/
│
├── index.html          Home page — intro, live dataset stats, disclaimer
├── prediction.html     Symptom selection + prediction result UI
├── history.html        Saved prediction history (from localStorage)
├── analytics.html      Dataset EDA + synthetic model validation (charts, confusion matrix)
├── about.html           Project explanation, workflow, disclaimer
│
├── css/
│   └── style.css       All styling (responsive, single stylesheet)
│
├── js/
│   ├── app.js           Shared nav behaviour + localStorage helper functions
│   ├── prediction.js    Symptom checklist UI + the Predictor (scoring) model
│   ├── history.js       Renders/deletes/clears history records
│   └── analytics.js     Dataset stats + synthetic validation (accuracy, precision/recall/F1, confusion matrix)
│
├── data/
│   └── diseases.js      SYMPTOM_LIST + DISEASE_DB (the "dataset")
│
└── README.md            This file
```

---

## 3. Workflow / how the pieces fit together

1. **`data/diseases.js`** loads first on every page and defines two global
   arrays: `SYMPTOM_LIST` (all selectable symptoms) and `DISEASE_DB` (every
   condition, each with a map of `{ symptomId: weight }`).
2. **`js/app.js`** loads next on every page. It provides:
   - navigation behaviour (mobile menu, active link highlighting),
   - `getHistory()` / `saveHistory()` / `addHistoryRecord()` /
     `deleteHistoryRecord()` / `clearHistory()` — small wrappers around
     `localStorage`, all guarded with `try/catch` so corrupted or missing
     data never crashes the app,
   - home-page-only logic (dataset stats, "last prediction" teaser).
3. On **`prediction.html`**, `js/prediction.js` renders the searchable
   symptom checklist, tracks selections in memory, validates that at least
   one symptom is picked, and — when **Predict Disease** is clicked — runs
   the `Predictor.predict()` scoring function (see below), displays the
   top result, and saves a record to history.
4. On **`history.html`**, `js/history.js` reads all saved records and
   renders them as cards, newest first, with per-record delete and a
   clear-all action.

### The prediction algorithm ("weighted symptom-matching")

This is **not** a trained machine-learning model — it's a transparent,
explainable heuristic designed to *behave* like a simple classifier, and
to be a clear teaching example:

1. Every disease has a set of symptoms, each with a weight from `0.1`
   (weak/common signal) to `1.0` (strong/defining signal).
2. For the symptoms the user selected, the app sums the weights that match
   each disease (`matchedWeight`).
3. It divides that by an **effective maximum** — a 50/50 blend of the
   disease's own total weight and the average total weight across all
   diseases — to get a **coverage** score (0–1). The blend stops diseases
   with short symptom lists (e.g. UTI) from scoring far higher than those
   with long lists (e.g. Common Cold) just because their profile is smaller.
4. It applies a small **noise penalty** for every selected symptom that
   isn't associated with that disease at all (selecting lots of unrelated
   symptoms should lower the score).
5. `finalScore = coverage − noisePenalty`, clamped between 0 and 1, becomes
   the displayed **match score** percentage. It measures how well the
   symptoms fit a condition's profile; it is *not* a probability.
6. All diseases are ranked by `finalScore` (ties broken by matched weight,
   then matched symptom count, then name). The top result is shown in the
   main card and up to two runner-ups are listed as "Other possibilities".
   If the top score is below 15%, the app shows "No clear match found"
   rather than guessing, and saves the history record the same way.
7. **Red-flag warnings** are separate from scoring: if the user selects
   chest tightness, shortness of breath, or rapid heartbeat
   (`RED_FLAG_SYMPTOMS` in `data/diseases.js`), an urgent-care notice is
   shown above the result regardless of the prediction.

The algorithm lives entirely inside the `Predictor` object in
`js/prediction.js`, with a single `predict(selectedSymptomIds)` method.
**To upgrade this to a real ML model later**, you only need to replace the
internals of that one method (e.g. to call a trained model exported to
JSON, or an external prediction API) — the rest of the app (UI, storage,
validation) does not need to change.

---

## 4. Data persistence (localStorage)

All prediction history is stored under a single key:

```
diseasePredictionHistory
```

Each record stored looks like:

```json
{
  "id": "pred_1732000000000_ab12cd",
  "symptoms": ["Fever", "Headache", "Body ache"],
  "disease": "Influenza (Flu)",
  "confidence": 78,   // the match score
  "timestamp": "2026-09-23T10:15:00.000Z"
}
```

`getHistory()` in `js/app.js` safely handles a missing key, an empty
string, or corrupted/invalid JSON by returning an empty array instead of
throwing an error.

---

## 5. Analytics & synthetic model validation

`analytics.html` / `js/analytics.js` add the data-science layer on top of
the app: exploratory statistics over the dataset, and a validation pass
over the `Predictor` algorithm.

**Dataset EDA** (no algorithm involved): symptom frequency across
conditions, number of symptoms tracked per disease, and the weight
distribution (0.1–1.0) across all symptom–disease pairs.

**Synthetic model validation**: `DISEASE_DB` is a hand-authored knowledge
base, not a labelled clinical dataset, so there's nothing to hold out and
test against directly. Instead, `analytics.js` generates **synthetic
patients**: for every disease it repeatedly samples a random subset of
that disease's own known symptoms (imitating a patient who doesn't report
every symptom) and checks whether `Predictor.predict()` still recovers
the correct condition. From those trials it reports:

- **Top-1 accuracy** at five reporting-completeness levels (100% down to
  20% of a disease's symptoms), plotted as a robustness curve.
- A full **confusion matrix** (actual vs. predicted disease) at 70%
  completeness.
- **Macro precision, recall and F1** derived from that matrix.

Sampling uses a seeded PRNG (`seed = 42`, mulberry32), so the numbers are
identical on every run — useful for screenshots or a written report.

This is explicitly a test of the **scoring algorithm's internal
consistency and noise-robustness**, not a claim about real-world
diagnostic accuracy — there is no real patient data anywhere in this
project. The page states that distinction directly.

---

## 6. Limitations (by design)

- The symptom/disease dataset is small and illustrative, not clinically
  validated — it exists purely to demonstrate the application's workflow.
- The scoring algorithm is a simple heuristic, not a trained ML model.
- No login system, personal health records, or data sharing of any kind.
- History is stored per-browser; clearing browser data clears history.

---

## 7. Deploying it

This is still a pure static site (HTML/CSS/JS, no build step, no backend),
so any static host works. **GitHub Pages** is the easiest free option and
gives you a shareable link:

1. Push this folder to a GitHub repository (root of the repo, or a `/docs`
   folder — either works as long as you point Pages at the right one).
2. In the repo, go to **Settings → Pages**.
3. Under "Build and deployment", set **Source** to "Deploy from a branch",
   pick your branch (e.g. `main`) and the folder (`/` or `/docs`), then
   save.
4. GitHub gives you a URL like
   `https://<your-username>.github.io/<repo-name>/` within a minute or two.

Netlify or Vercel work the same way (drag-and-drop the folder, or connect
the repo) if you'd rather use those instead — no configuration is needed
either way since there's no build step.

`analytics.html` loads Chart.js from a CDN
(`cdn.jsdelivr.net`), so an internet connection is required for that one
page specifically; every other page still works fully offline.

---

## 8. Suggested extensions (for future coursework)

- Swap `Predictor.predict()` for a real trained classifier (e.g. exported
  from scikit-learn's `DecisionTreeClassifier` or `NaiveBayes` to JSON).
- Expand `data/diseases.js` with a larger, sourced symptom-disease dataset.
- Add a symptom severity slider (mild/moderate/severe) as an extra feature
  dimension for the scoring algorithm.
- Add data export (download history as CSV/JSON) from the History page.
- Replace the synthetic validation in `analytics.html` with a proper
  held-out evaluation once real (or realistically simulated) patient
  records are available, ideally re-run in Python with scikit-learn's
  `classification_report` / `confusion_matrix` for a side-by-side
  comparison against the in-browser numbers.
