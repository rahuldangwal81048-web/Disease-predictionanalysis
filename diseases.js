/* =========================================================================
   data/diseases.js
   -------------------------------------------------------------------------
   This file holds ALL the "knowledge" the app uses to make predictions.
   It has two parts:

     1. SYMPTOM_LIST   -> every symptom the user is allowed to pick from.
     2. DISEASE_DB      -> every condition the app knows about, along with
                            the symptoms that are typically associated with
                            it and a "weight" (0-1) that says how important
                            that symptom is for recognising the condition.

   Why weights instead of a plain list?
   -------------------------------------------------------------------------
   A real diagnostic symptom-checker (and real ML models trained on
   symptom-disease datasets) do not treat every symptom as equally
   important. "Fever" is common to almost everything, so it should not by
   itself point strongly at any one disease. "Sneezing fits" is a much
   stronger, more specific signal for something like Allergic Rhinitis.
   Weights let a simple algorithm behave a little more intelligently
   without needing a real trained model.

   How this connects to js/prediction.js
   -------------------------------------------------------------------------
   js/prediction.js contains a `Predictor` object with a single
   `predict(selectedSymptomIds)` method. Right now that method implements a
   lightweight **weighted symptom-matching algorithm** (explained in detail
   in that file). Because the dataset and the algorithm are kept in
   separate files, you can:

     - swap DISEASE_DB for a bigger/real dataset without touching the UI,
     - or swap the algorithm in Predictor for a real ML model (e.g. one
       loaded from a JSON export of a trained classifier, or called via an
       API) without touching this dataset file.

   This is a college minor project, so the dataset below is intentionally
   small and focused on common, everyday conditions (colds, fatigue,
   digestive upset, etc.) rather than serious or rare diseases. It exists
   purely to DEMONSTRATE how a symptom checker works.
   ========================================================================= */

// ---------------------------------------------------------------------------
// 1. SYMPTOM_LIST
// Each symptom has a unique id (used internally) and a human-readable label
// (shown to the user). Keeping id/label separate makes it easy to support
// multiple languages later, or to rename labels without breaking the data.
// ---------------------------------------------------------------------------
const SYMPTOM_LIST = [
  { id: "fever", label: "Fever" },
  { id: "high_fever", label: "High fever (>102°F)" },
  { id: "chills", label: "Chills / shivering" },
  { id: "cough_dry", label: "Dry cough" },
  { id: "cough_wet", label: "Cough with mucus" },
  { id: "sore_throat", label: "Sore throat" },
  { id: "runny_nose", label: "Runny nose" },
  { id: "stuffy_nose", label: "Stuffy / blocked nose" },
  { id: "sneezing", label: "Frequent sneezing" },
  { id: "headache", label: "Headache" },
  { id: "severe_headache", label: "Severe / throbbing headache" },
  { id: "body_ache", label: "Body ache" },
  { id: "fatigue", label: "Fatigue / low energy" },
  { id: "dizziness", label: "Dizziness" },
  { id: "nausea", label: "Nausea" },
  { id: "vomiting", label: "Vomiting" },
  { id: "diarrhea", label: "Diarrhea" },
  { id: "stomach_pain", label: "Stomach pain / cramps" },
  { id: "bloating", label: "Bloating / gas" },
  { id: "loss_of_appetite", label: "Loss of appetite" },
  { id: "heartburn", label: "Heartburn / acidity" },
  { id: "itchy_eyes", label: "Itchy / watery eyes" },
  { id: "red_eyes", label: "Redness in eyes" },
  { id: "eye_discharge", label: "Sticky discharge from eyes" },
  { id: "skin_rash", label: "Skin rash" },
  { id: "itching", label: "Itching" },
  { id: "sensitivity_to_light", label: "Sensitivity to light" },
  { id: "nausea_with_light", label: "Nausea triggered by light/sound" },
  { id: "burning_urination", label: "Burning sensation during urination" },
  { id: "frequent_urination", label: "Frequent urge to urinate" },
  { id: "lower_abdomen_pain", label: "Lower abdomen pain" },
  { id: "excessive_thirst", label: "Excessive thirst" },
  { id: "dry_mouth", label: "Dry mouth" },
  { id: "muscle_cramps", label: "Muscle cramps" },
  { id: "pale_skin", label: "Pale skin" },
  { id: "shortness_of_breath", label: "Shortness of breath" },
  { id: "rapid_heartbeat", label: "Rapid heartbeat" },
  { id: "facial_pain", label: "Facial pain / pressure" },
  { id: "loss_of_smell", label: "Loss of smell or taste" },
  { id: "chest_tightness", label: "Chest tightness" },
];

// ---------------------------------------------------------------------------
// 2. DISEASE_DB
// Each entry:
//   id          - unique key
//   name        - display name
//   symptoms    - { symptomId: weight } map. Weight range: 0.1 (weak/common
//                  signal) to 1.0 (strong/defining signal for this disease).
//   description - one/two lines, plain-language, educational tone
//   commonSymptoms - short list shown on the info card (may repeat symptoms
//                    above, written in a more natural sentence style)
//   guidance    - GENERAL self-care / when-to-see-a-doctor guidance only.
//                 Deliberately contains NO drug names or dosages.
// ---------------------------------------------------------------------------
const DISEASE_DB = [
  {
    id: "common_cold",
    name: "Common Cold",
    symptoms: {
      runny_nose: 0.9, stuffy_nose: 0.8, sneezing: 0.8, sore_throat: 0.6,
      cough_wet: 0.5, fever: 0.3, headache: 0.3, fatigue: 0.4, body_ache: 0.3,
    },
    description: "A mild viral infection of the nose and throat, extremely common and usually resolves on its own within a week.",
    commonSymptoms: ["Runny or blocked nose", "Sneezing", "Mild sore throat", "Occasional cough"],
    guidance: "Usually resolves with rest and fluids within 7-10 days. See a doctor if symptoms last longer than 10 days or worsen suddenly.",
  },
  {
    id: "influenza",
    name: "Influenza (Flu)",
    symptoms: {
      high_fever: 0.9, chills: 0.8, body_ache: 0.8, fatigue: 0.8,
      cough_dry: 0.6, headache: 0.5, sore_throat: 0.4, fever: 0.6,
    },
    description: "A more severe viral respiratory illness than the common cold, with sudden onset of fever and body pain.",
    commonSymptoms: ["Sudden high fever", "Body ache and chills", "Extreme fatigue", "Dry cough"],
    guidance: "Rest, stay hydrated, and monitor temperature. Seek medical care if fever is very high, persistent, or breathing becomes difficult.",
  },
  {
    id: "migraine",
    name: "Migraine",
    symptoms: {
      severe_headache: 0.9, sensitivity_to_light: 0.8, nausea_with_light: 0.7,
      dizziness: 0.4, nausea: 0.5,
    },
    description: "A neurological condition causing intense, often one-sided headaches, frequently with sensitivity to light and sound.",
    commonSymptoms: ["Throbbing headache (often one-sided)", "Light/sound sensitivity", "Nausea"],
    guidance: "Resting in a quiet, dark room often helps. If migraines are frequent, severe, or new for you, consult a doctor for proper management.",
  },
  {
    id: "food_poisoning",
    name: "Food Poisoning",
    symptoms: {
      vomiting: 0.8, diarrhea: 0.8, stomach_pain: 0.7, nausea: 0.6,
      fever: 0.3, fatigue: 0.3, loss_of_appetite: 0.4,
    },
    description: "An illness caused by consuming contaminated food or water, leading to sudden digestive symptoms.",
    commonSymptoms: ["Sudden vomiting", "Diarrhea", "Stomach cramps"],
    guidance: "Stay hydrated with small frequent sips of fluids and rest the stomach. Seek medical care if there is blood in vomit/stool, high fever, or signs of dehydration.",
  },
  {
    id: "allergic_rhinitis",
    name: "Allergic Rhinitis (Allergy)",
    symptoms: {
      sneezing: 0.9, itchy_eyes: 0.7, runny_nose: 0.6, stuffy_nose: 0.5,
      itching: 0.5, red_eyes: 0.4,
    },
    description: "An allergic reaction (often to dust, pollen, or pet dander) causing nose and eye irritation without infection.",
    commonSymptoms: ["Repeated sneezing", "Itchy watery eyes", "Runny nose without fever"],
    guidance: "Try to identify and avoid the trigger (dust, pollen, etc.). If symptoms are frequent or disruptive, consult a doctor about allergy management.",
  },
  {
    id: "conjunctivitis",
    name: "Conjunctivitis (Eye Infection)",
    symptoms: {
      red_eyes: 0.9, eye_discharge: 0.8, itchy_eyes: 0.6, itching: 0.3,
    },
    description: "An inflammation or infection of the thin membrane covering the eye, commonly called 'pink eye'.",
    commonSymptoms: ["Redness in one or both eyes", "Sticky discharge, especially after sleep", "Itchiness"],
    guidance: "Avoid touching or rubbing eyes and wash hands frequently to prevent spreading it. See a doctor if vision is affected or discharge is heavy.",
  },
  {
    id: "gastritis",
    name: "Gastritis / Acidity",
    symptoms: {
      heartburn: 0.8, stomach_pain: 0.6, bloating: 0.6, nausea: 0.4,
      loss_of_appetite: 0.3,
    },
    description: "Irritation or inflammation of the stomach lining, often linked to diet, stress, or irregular eating habits.",
    commonSymptoms: ["Burning sensation in upper stomach/chest", "Bloating", "Discomfort after meals"],
    guidance: "Eating smaller, regular meals and avoiding spicy/oily food may help. See a doctor if pain is severe or persistent.",
  },
  {
    id: "dehydration",
    name: "Dehydration",
    symptoms: {
      excessive_thirst: 0.8, dry_mouth: 0.7, dizziness: 0.6, fatigue: 0.5,
      muscle_cramps: 0.4, headache: 0.3,
    },
    description: "Occurs when the body loses more fluids than it takes in, affecting normal bodily functions.",
    commonSymptoms: ["Unusual thirst", "Dry mouth", "Dizziness or lightheadedness"],
    guidance: "Increase fluid intake gradually. Seek medical attention if dizziness is severe, urination becomes very infrequent, or confusion occurs.",
  },
  {
    id: "sinusitis",
    name: "Sinusitis",
    symptoms: {
      facial_pain: 0.8, stuffy_nose: 0.6, headache: 0.5, loss_of_smell: 0.5,
      cough_wet: 0.3, fever: 0.3,
    },
    description: "Inflammation of the sinuses, often following a cold, causing facial pressure and nasal congestion.",
    commonSymptoms: ["Pain/pressure around eyes, cheeks or forehead", "Blocked nose", "Reduced sense of smell"],
    guidance: "Steam inhalation and staying hydrated may ease symptoms. See a doctor if facial pain is severe or symptoms last beyond 10 days.",
  },
  {
    id: "uti",
    name: "Urinary Tract Infection (UTI)",
    symptoms: {
      burning_urination: 0.9, frequent_urination: 0.7, lower_abdomen_pain: 0.6,
      fever: 0.2,
    },
    description: "An infection in any part of the urinary system, most commonly the bladder, more frequent in women.",
    commonSymptoms: ["Burning sensation while urinating", "Frequent urge to urinate", "Lower abdominal discomfort"],
    guidance: "Drink plenty of water and avoid holding urine for long periods. Consult a doctor promptly, especially if fever or back pain develops.",
  },
  {
    id: "anemia",
    name: "Anemia (Low Iron/Hemoglobin)",
    symptoms: {
      fatigue: 0.7, pale_skin: 0.7, dizziness: 0.5, shortness_of_breath: 0.5,
      rapid_heartbeat: 0.4, headache: 0.2,
    },
    description: "A condition where the blood lacks enough healthy red blood cells to carry adequate oxygen to body tissues.",
    commonSymptoms: ["Persistent tiredness", "Pale skin", "Breathlessness on exertion"],
    guidance: "Iron-rich foods may help mild cases, but a blood test is needed for proper evaluation. Consult a doctor for persistent fatigue.",
  },
  {
    id: "viral_fever",
    name: "Viral Fever",
    symptoms: {
      fever: 0.8, body_ache: 0.6, fatigue: 0.6, headache: 0.4, chills: 0.4,
      loss_of_appetite: 0.3,
    },
    description: "A general term for fever caused by a viral infection, usually mild and self-limiting.",
    commonSymptoms: ["Fluctuating fever", "General weakness", "Mild body ache"],
    guidance: "Rest and fluids usually help within a few days. See a doctor if fever crosses 103°F, persists beyond 3 days, or is accompanied by rash.",
  },
];

// ---------------------------------------------------------------------------
// 3. RED_FLAG_SYMPTOMS
// Symptoms that can sometimes point to a serious problem regardless of which
// mild condition scores highest. js/prediction.js checks the user's selection
// against this list INDEPENDENTLY of the scoring model, and shows an
// "seek urgent care if severe" notice whenever any of them is selected.
// These symptoms are intentionally NOT weighted heavily in DISEASE_DB: the
// warning is a safety net, not part of the prediction.
// ---------------------------------------------------------------------------
const RED_FLAG_SYMPTOMS = ["chest_tightness", "shortness_of_breath", "rapid_heartbeat"];

/* =========================================================================
   IMPORTANT EDUCATIONAL DISCLAIMER (also shown throughout the UI)
   -------------------------------------------------------------------------
   This dataset is a small, simplified, illustrative sample created for a
   college minor project. It is NOT sourced from verified clinical data and
   must NEVER be used for real medical decisions. Many diseases share
   overlapping symptoms, and only a qualified medical professional can give
   an accurate diagnosis.
   ========================================================================= */

// Expose to other scripts (loaded via plain <script> tags, no bundler/module
// system needed — keeps the project runnable by just double-clicking
// index.html).
window.SYMPTOM_LIST = SYMPTOM_LIST;
window.DISEASE_DB = DISEASE_DB;
window.RED_FLAG_SYMPTOMS = RED_FLAG_SYMPTOMS;
