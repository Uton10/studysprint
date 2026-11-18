/*
 * StudySprint — Hybrid inference engine
 * ============================================================================
 * Routing architecture (the heart of the #BuildHybridAI entry):
 *
 *   1. PRIMARY PATH — Firebase AI Logic (Hybrid Inference SDK for Web).
 *      We create GenerativeModel instances with explicit InferenceModes:
 *        - light/private tasks  -> InferenceMode.PREFER_ON_DEVICE
 *        - heavy/long tasks     -> InferenceMode.PREFER_IN_CLOUD
 *        - user-forced device   -> InferenceMode.ONLY_ON_DEVICE
 *        - user-forced cloud    -> InferenceMode.ONLY_IN_CLOUD
 *      With PREFER_ON_DEVICE the SDK itself runs Gemini Nano on-device via
 *      Chrome's Prompt API when available and transparently falls back to
 *      cloud Gemini (Gemini Developer API backend) when it is not.
 *
 *   2. DEMO PATH — when no real Firebase config is present (see
 *      firebase-config.js), the app still works: on-device tasks call
 *      Chrome's Prompt API directly (the exact same underlying engine the
 *      Firebase SDK uses on web), and cloud-bound tasks degrade to a
 *      clearly-labelled local extractive fallback. The Firebase code path
 *      above is complete and activates the moment a real config is pasted in.
 *
 * Every result reports which engine actually answered, the routing reason,
 * and the latency — hybrid inference is a visible product feature here,
 * not invisible plumbing.
 * ============================================================================
 */

import { firebaseConfig, CLOUD_MODEL, isFirebaseConfigured } from "./firebase-config.js";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/** Inputs longer than this are escalated to the cloud in Auto mode. */
export const CLOUD_CHAR_THRESHOLD = 6000;

/** Tasks that are always treated as "heavy" in Auto mode. */
const HEAVY_TASKS = new Set(["quiz", "flashcards"]);

/* ------------------------------------------------------------------ */
/* Small utilities                                                     */
/* ------------------------------------------------------------------ */

const listeners = new Set();
export function onEngineEvent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(type, data = {}) {
  for (const fn of listeners) {
    try { fn({ type, at: Date.now(), ...data }); } catch { /* listener errors never break inference */ }
  }
}

function normalizeSource(raw) {
  if (!raw) return null;
  const s = String(raw).toUpperCase();
  if (s.includes("DEVICE")) return "on-device";
  if (s.includes("CLOUD")) return "cloud";
  return null;
}

/** Try every known location where the SDK may annotate the inference source. */
function detectSdkSource(result) {
  const candidates = [
    result?.response?.inferenceSource,
    result?.inferenceSource,
    result?.response?.inference_source,
    result?.response?.usageMetadata?.inferenceSource,
  ];
  for (const c of candidates) {
    const n = normalizeSource(c);
    if (n) return n;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Chrome Prompt API (Gemini Nano) — probe + direct calls              */
/* ------------------------------------------------------------------ */

function getPromptAPI() {
  if (typeof LanguageModel !== "undefined") return { kind: "standard", api: LanguageModel };
  if (typeof window !== "undefined" && window.ai && window.ai.languageModel) {
    return { kind: "legacy", api: window.ai.languageModel };
  }
  return null;
}

let availabilityCache = null;

/**
 * Returns { state: 'available'|'downloadable'|'downloading'|'unavailable'|'unsupported', raw }
 * 'unsupported' = this browser has no Prompt API at all (not Chrome 139+ desktop).
 */
export async function getOnDeviceAvailability(force = false) {
  if (availabilityCache && !force) return availabilityCache;
  const found = getPromptAPI();
  if (!found) {
    availabilityCache = { state: "unsupported", raw: null };
    return availabilityCache;
  }
  try {
    let state;
    if (found.kind === "standard") {
      state = await found.api.availability();
      // standard API: 'available' | 'downloadable' | 'downloading' | 'unavailable'
    } else {
      const caps = await found.api.capabilities();
      state = { readily: "available", "after-download": "downloadable", no: "unavailable" }[caps.available] || "unavailable";
    }
    availabilityCache = { state, raw: state };
  } catch (err) {
    availabilityCache = { state: "unavailable", raw: String(err && err.message || err) };
  }
  return availabilityCache;
}

/** Direct Prompt API call — used on the demo path (no Firebase config). */
async function promptOnDevice(systemPrompt, userPrompt, onProgress) {
  const found = getPromptAPI();
  if (!found) throw new Error("Prompt API not present in this browser.");
  let session;
  if (found.kind === "standard") {
    session = await found.api.create({
      systemPrompt,
      monitor(m) {
        m.addEventListener("downloadprogress", (e) => {
          if (onProgress) onProgress(e.loaded);
          emit("download-progress", { loaded: e.loaded });
        });
      },
    });
  } else {
    session = await found.api.create({ systemPrompt });
  }
  try {
    return await session.prompt(userPrompt);
  } finally {
    if (session.destroy) session.destroy();
  }
}

/* ------------------------------------------------------------------ */
/* Firebase AI Logic — lazy, real, complete code path                  */
/* ------------------------------------------------------------------ */

const FIREBASE_CDN = "https://www.gstatic.com/firebasejs/12.5.0";
let firebaseReady = null; // Promise<{ models: Map<string, GenerativeModel> }>

async function initFirebase() {
  if (firebaseReady) return firebaseReady;
  firebaseReady = (async () => {
    const [{ initializeApp }, aiMod, appCheckMod] = await Promise.all([
      import(/* @vite-ignore */ `${FIREBASE_CDN}/firebase-app.js`),
      import(/* @vite-ignore */ `${FIREBASE_CDN}/firebase-ai.js`),
      import(/* @vite-ignore */ `${FIREBASE_CDN}/firebase-app-check.js`),
    ]);

    const app = initializeApp(firebaseConfig);

    // App Check is required by AI Logic. We use the App Check debug token
    // flow (debug tokens are accepted for hackathon submissions): the UUID
    // below is registered in the Firebase console under App Check → Apps →
    // StudySprint Web → Manage debug tokens. In production, swap this for
    // the reCAPTCHA provider with a real site key — see firebase-config.js.
    if (typeof self !== "undefined")
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = "a3480be5-2853-4d60-9a54-f1211c71d0eb";
    appCheckMod.initializeAppCheck(app, {
      provider: new appCheckMod.ReCaptchaV3Provider("studysprint-debug-token-flow"),
      isTokenAutoRefreshEnabled: true,
    });

    const ai = aiMod.getAI(app, { backend: new aiMod.GoogleAIBackend() });
    const { InferenceMode } = aiMod;

    const makeModel = (mode) =>
      aiMod.getGenerativeModel(ai, {
        mode,
        inCloudParams: { model: CLOUD_MODEL },
      });

    const models = new Map([
      ["prefer-device", makeModel(InferenceMode.PREFER_ON_DEVICE)],
      ["prefer-cloud", makeModel(InferenceMode.PREFER_IN_CLOUD)],
      ["only-device", makeModel(InferenceMode.ONLY_ON_DEVICE)],
      ["only-cloud", makeModel(InferenceMode.ONLY_IN_CLOUD)],
    ]);

    // initializeDeviceModel() must be called after a user interaction and
    // before the first generateContent() on hybrid/on-device models.
    const deviceInitDone = new Set();
    async function ensureDeviceModel(key) {
      if (deviceInitDone.has(key)) return;
      deviceInitDone.add(key);
      const model = models.get(key);
      if (model && typeof model.initializeDeviceModel === "function") {
        await model.initializeDeviceModel((val) => {
          emit("download-progress", { loaded: val });
        });
      }
    }

    emit("firebase-ready", { cloudModel: CLOUD_MODEL });
    return { models, ensureDeviceModel, InferenceMode };
  })();
  return firebaseReady;
}

async function runViaFirebase(modelKey, systemPrompt, userPrompt, expectDevice) {
  const { models, ensureDeviceModel } = await initFirebase();
  const model = models.get(modelKey);
  if (modelKey !== "only-cloud") await ensureDeviceModel(modelKey);

  const started = performance.now();
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    systemInstruction: systemPrompt,
  });
  const latencyMs = Math.round(performance.now() - started);
  const text = result.response.text();

  let engine = detectSdkSource(result);
  let sourceNote;
  if (engine) {
    sourceNote = "Engine reported by the Firebase AI Logic SDK response.";
  } else if (modelKey === "only-device") {
    engine = "on-device";
    sourceNote = "ONLY_ON_DEVICE mode guarantees the on-device engine.";
  } else if (modelKey === "only-cloud") {
    engine = "cloud";
    sourceNote = "ONLY_IN_CLOUD mode guarantees the cloud engine.";
  } else {
    // Hybrid modes: derive from the pre-flight availability probe and say so.
    const avail = await getOnDeviceAvailability();
    engine = expectDevice && avail.state === "available" ? "on-device" : "cloud";
    sourceNote = "SDK did not annotate this response; engine inferred from routing mode + on-device availability probe.";
  }
  return { text, engine, latencyMs, sourceNote, via: "Firebase AI Logic" };
}

/* ------------------------------------------------------------------ */
/* Local dev fallback (extractive — NOT generative AI, always labelled)*/
/* ------------------------------------------------------------------ */

function splitSentences(text) {
  return (text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]+["')\]]*|\S[^.!?]*$/g) || [])
    .map((s) => s.trim())
    .filter((s) => s.length > 25);
}

function keySentences(text, count = 5) {
  const sentences = splitSentences(text);
  if (sentences.length <= count) return sentences;
  const freq = new Map();
  for (const w of text.toLowerCase().match(/[a-z][a-z\-']{2,}/g) || []) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  const scored = sentences.map((s, i) => {
    const words = s.toLowerCase().match(/[a-z][a-z\-']{2,}/g) || [];
    const score = words.reduce((acc, w) => acc + (freq.get(w) || 0), 0) / Math.max(words.length, 1);
    return { s, i, score };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
}

function localFallback(task, text) {
  const keys = keySentences(text, task === "summary" ? 4 : 6);
  const header =
    "⚠ LOCAL DEV FALLBACK — no AI engine was reachable, so this was produced by a simple extractive algorithm (sentence ranking), not by a language model.\n\n";
  switch (task) {
    case "summary":
      return header + "**TL;DR (extractive):** " + keys.slice(0, 2).join(" ") +
        "\n\n**Key sentences:**\n" + keys.map((s) => "- " + s).join("\n");
    case "flashcards":
      return header + keys.map((s, i) => {
        const words = s.split(" ");
        const mid = words[Math.floor(words.length / 2)] || "…";
        return `Card ${i + 1}\nQ: Which word completes this sentence from the text? "${s.replace(mid, "_____")}"\nA: ${mid}`;
      }).join("\n\n");
    case "quiz":
      return header + keys.slice(0, 3).map((s, i) =>
        `Q${i + 1}. True or false: "${s}"\nAnswer: True (verbatim from the source text).`
      ).join("\n\n");
    case "eli5":
      return header + "Simplest key ideas from the text:\n" + keys.slice(0, 3).map((s) => "- " + s).join("\n");
    case "actions":
      return header + "Sentences that look like commitments or next steps:\n" +
        (splitSentences(text).filter((s) => /\b(will|should|must|need to|deadline|by (mon|tue|wed|thu|fri|tomorrow)|todo|action)\b/i.test(s)).slice(0, 6).map((s) => "- " + s).join("\n") ||
          "- (none detected by the extractive fallback)");
    case "translate":
      return header + "Translation needs a real AI engine. Add a Firebase config (cloud) or open this page in Chrome 139+ with Gemini Nano enabled (on-device).";
    default:
      return header + keys.map((s) => "- " + s).join("\n");
  }
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

/**
 * Decide where a task should run.
 * preference: 'auto' | 'device' | 'cloud'
 * Returns { target: 'device'|'cloud', reason: string, modelKey: string|null }
 */
export function decideRoute(task, text, preference) {
  const chars = text.length;
  if (preference === "device") {
    return { target: "device", modelKey: "only-device", reason: "You forced On-device only mode — nothing leaves this device." };
  }
  if (preference === "cloud") {
    return { target: "cloud", modelKey: "only-cloud", reason: "You forced Cloud only mode — the strongest model, needs internet." };
  }
  if (HEAVY_TASKS.has(task)) {
    return { target: "cloud", modelKey: "prefer-cloud", reason: `"${task}" is a heavy generation task — cloud Gemini gives the most reliable structured output.` };
  }
  if (chars > CLOUD_CHAR_THRESHOLD) {
    return { target: "cloud", modelKey: "prefer-cloud", reason: `${chars.toLocaleString()} characters is beyond the comfortable on-device context — escalating to cloud Gemini.` };
  }
  return { target: "device", modelKey: "prefer-device", reason: `Short ${task} task (${chars.toLocaleString()} chars) — on-device is instant, free, and private.` };
}

/**
 * Run one AI task end-to-end with hybrid routing.
 * task: 'summary'|'flashcards'|'quiz'|'eli5'|'translate'|'actions'
 * Returns { text, engine, engineLabel, latencyMs, routeReason, via, warnings[] }
 */
export async function runHybridTask({ task, text, targetLanguage, preference = "auto", systemPrompt, userPrompt }) {
  const route = decideRoute(task, text, preference);
  const warnings = [];
  emit("route-decided", { task, target: route.target, reason: route.reason });

  const configured = isFirebaseConfigured();
  const started = performance.now();

  /* ---- Path A: real Firebase AI Logic (config present) ---- */
  if (configured) {
    try {
      const r = await runViaFirebase(route.modelKey, systemPrompt, userPrompt, route.target === "device");
      emit("engine-answered", { engine: r.engine, via: r.via, latencyMs: r.latencyMs });
      return {
        text: r.text,
        engine: r.engine,
        engineLabel: r.engine === "on-device" ? "On-device · Gemini Nano" : `Cloud · ${CLOUD_MODEL}`,
        latencyMs: r.latencyMs,
        routeReason: route.reason,
        via: r.via,
        sourceNote: r.sourceNote,
        warnings,
      };
    } catch (err) {
      warnings.push(`Firebase AI Logic call failed (${err && err.message ? err.message : err}). Falling back.`);
      emit("engine-error", { message: String(err && err.message || err) });
      // fall through to Path B
    }
  } else {
    warnings.push("Demo mode: no Firebase config yet — using the direct on-device path / local fallback. Paste a real config in firebase-config.js to activate Firebase AI Logic cloud routing.");
  }

  /* ---- Path B: direct on-device Prompt API (same engine Firebase uses) ---- */
  const avail = await getOnDeviceAvailability();
  if (route.target === "device" || avail.state === "available" || avail.state === "downloadable" || avail.state === "downloading") {
    if (preference !== "cloud") {
      try {
        const out = await promptOnDevice(systemPrompt, userPrompt, null);
        const latencyMs = Math.round(performance.now() - started);
        if (route.target === "cloud") {
          warnings.push("This task was routed to the cloud, but no cloud backend is configured — answered on-device instead. Long inputs may be truncated by the on-device context window.");
        }
        emit("engine-answered", { engine: "on-device", via: "Prompt API (direct)", latencyMs });
        return {
          text: out,
          engine: "on-device",
          engineLabel: "On-device · Gemini Nano",
          latencyMs,
          routeReason: route.reason,
          via: configured ? "Prompt API (direct, after Firebase error)" : "Prompt API (direct — demo mode)",
          sourceNote: "Answered by Chrome's built-in Gemini Nano via the Prompt API.",
          warnings,
        };
      } catch (err) {
        warnings.push(`On-device Prompt API failed (${err && err.message ? err.message : err}).`);
        emit("engine-error", { message: String(err && err.message || err) });
      }
    }
  }

  /* ---- Path C: clearly-labelled local extractive fallback ---- */
  const latencyMs = Math.round(performance.now() - started);
  emit("engine-answered", { engine: "local-fallback", via: "Extractive (local)", latencyMs });
  return {
    text: localFallback(task, text),
    engine: "local-fallback",
    engineLabel: "Local dev fallback (not AI)",
    latencyMs,
    routeReason: route.reason,
    via: "Extractive algorithm (local)",
    sourceNote: "No AI engine was reachable; extractive fallback used and labelled as such.",
    warnings,
  };
}

/** Snapshot of engine status for the UI status panel. */
export async function getEngineStatus() {
  const avail = await getOnDeviceAvailability();
  return {
    firebaseConfigured: isFirebaseConfigured(),
    cloudModel: CLOUD_MODEL,
    onDevice: avail.state,
    promptApiPresent: avail.state !== "unsupported",
  };
}
