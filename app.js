/*
 * StudySprint — UI logic
 * Wires the page to the hybrid engine (hybrid.js): task prompts, routing
 * preview, result rendering (markdown / flashcards / quiz), the routing
 * log, engine status pills, and a localStorage-backed session library.
 */

import { runHybridTask, decideRoute, getEngineStatus, onEngineEvent, CLOUD_CHAR_THRESHOLD } from "./hybrid.js";
import { CLOUD_MODEL } from "./firebase-config.js";

/* ------------------------------------------------------------------ */
/* Sample texts                                                        */
/* ------------------------------------------------------------------ */

const SAMPLES = {
  short: `Photosynthesis — Lecture Notes (Biology 101)

Photosynthesis is the process by which green plants, algae, and some bacteria convert light energy into chemical energy stored in glucose. The overall equation is: 6CO2 + 6H2O + light energy → C6H12O6 + 6O2.

The process happens in chloroplasts and has two stages:

1. Light-dependent reactions (thylakoid membrane): chlorophyll absorbs sunlight, water molecules are split (photolysis), releasing oxygen. ATP and NADPH are produced. Remember: oxygen comes from WATER, not from CO2 — a classic exam trap.

2. Light-independent reactions / Calvin cycle (stroma): CO2 is fixed into organic molecules using the ATP and NADPH from stage one. The enzyme RuBisCO carries out carbon fixation. The cycle produces G3P, which the plant converts into glucose.

Factors affecting the rate of photosynthesis: light intensity, CO2 concentration, and temperature. At low light, light is the limiting factor; at high light, CO2 or temperature limits instead. The compensation point is the light intensity at which photosynthesis exactly balances respiration.

Why it matters: nearly all life on Earth depends on photosynthesis, directly or indirectly. It produces the oxygen we breathe and forms the base of almost every food chain.`,

  meeting: `Product Team Standup — Meeting Notes, Tuesday 9:00 AM
Attendees: Maya (PM), Jordan (Engineering), Priya (Design), Sam (QA)

Updates:
- Jordan: the new checkout flow is live behind a feature flag. Conversion is up 4% in the first 48 hours. The payment retry bug is fixed.
- Priya: final mockups for the onboarding redesign are ready for review. User testing starts next week with 8 participants.
- Sam: regression testing for release 2.4 is 80% complete. Two critical bugs remain, both in the refunds module.

Decisions:
- We will ship release 2.4 on Friday if QA signs off by Thursday noon.
- The onboarding redesign moves to the next sprint.

Action items:
- Jordan will write the migration script for the refunds module by Wednesday.
- Priya must share the onboarding prototype link with the whole team today.
- Sam needs to finish regression testing and send the QA report by Thursday 11 AM.
- Maya will schedule a follow-up meeting with the payments provider next week to discuss transaction fees.
- Everyone: review the RFC for the new notification system before Friday's planning session.`,

  long: `How the Internet Actually Works: Packets, Protocols, and the Path of a Web Page

When you type a web address into your browser and press Enter, you trigger a chain of events that crosses the planet in a fraction of a second. To understand the internet, it helps to follow a single request on its journey.

It begins with a name. Humans remember words like "example.com", but computers locate each other using numerical IP addresses, such as 93.184.216.34. The translation between the two is handled by the Domain Name System (DNS), often called the phone book of the internet. Your browser asks a DNS resolver — usually run by your internet provider — for the address of the site. The resolver checks its cache; if the answer is not there, it asks a series of other servers, from the root servers that know where all top-level domains live, down to the site's own authoritative server. This lookup usually takes a few tens of milliseconds and is cached aggressively, because almost everything else on the internet depends on it.

With an IP address in hand, your browser opens a connection to the server. For the modern web this means establishing a TCP connection, then negotiating a TLS handshake so the conversation is encrypted. TCP, the Transmission Control Protocol, guarantees that data arrives complete and in order: every chunk is numbered, acknowledged, and retransmitted if lost. TLS adds privacy and integrity on top, verifying the server's identity with a certificate issued by a trusted certificate authority. Only after these handshakes — several round trips before a single word of the page is sent — does the actual request begin.

The request itself is written in HTTP, the HyperText Transfer Protocol. A typical request is surprisingly human-readable: a method such as GET, the path of the resource, and a set of headers describing the browser, accepted languages, and cookies. The server responds with a status code — 200 for success, 404 for not found, 301 for a permanent redirect — followed by headers and the body, usually an HTML document.

But how does the data physically travel? It does not flow in a continuous stream like water in a pipe. Instead, everything is chopped into packets: small envelopes of data, each labeled with source and destination addresses. Packets from your browser may travel through your home router, your provider's network, undersea fiber-optic cables, and a dozen intermediate routers, each of which reads the destination address and forwards the packet toward its goal. Remarkably, packets belonging to the same page may take entirely different routes and arrive out of order; TCP at the destination patiently reassembles them. This design, called packet switching, was chosen in the 1960s because it is resilient: if one route fails, packets simply flow around the damage.

The HTML that arrives is only the skeleton of the page. The browser parses it into a structure called the DOM, discovers references to stylesheets, scripts, fonts, and images, and issues dozens — sometimes hundreds — of additional requests to fetch them. Modern sites often load resources from content delivery networks (CDNs): fleets of servers placed in cities around the world so that a user in Jakarta downloads files from a nearby data center rather than one in Virginia. Geography matters because light in fiber travels at roughly 200,000 kilometers per second; a round trip across the Pacific cannot beat physics, so engineers move the data closer instead.

While resources stream in, the browser's rendering engine gets to work. It combines the DOM with CSS rules to compute the layout of every element, paints pixels to the screen, and executes JavaScript, which can rewrite the page on the fly. Frameworks may then request yet more data from APIs — small, structured conversations in formats like JSON that power everything from weather widgets to the endless scroll of a social feed. Much of what feels like a single "page" is really a program assembled live from pieces fetched across the globe.

Several invisible systems keep this machinery trustworthy and fast. Caches at every level — in your browser, at your provider, at the CDN — store copies of popular content so it need not be fetched twice. Load balancers distribute incoming requests across many identical servers so no single machine is overwhelmed. And when something breaks, the status codes and error messages produced along the way are the clues engineers use to trace the failure.

The journey looks different depending on where you start it. On a phone, your request first travels as radio waves to a nearby cell tower, through the mobile operator's core network, and only then onto the public internet — adding hops, but following the same rules once it arrives. In a coffee shop, your packets share the air with dozens of strangers, which is precisely why the TLS encryption negotiated at the start matters so much: on an open network, anyone can watch the envelopes pass, but the contents stay sealed. At home late at night, the same request might cross only a handful of routers and return before you have consciously registered the click. The protocols do not care which path is taken; that indifference to the underlying transport is not an accident but the deepest design decision of all, the one that let the network absorb technologies its inventors never imagined, from dial-up modems to fiber to 5G, without changing its fundamental language.

It is worth pausing on how improbable all of this is. The internet was designed by researchers who assumed a cooperative network of universities. Nobody centrally planned the streaming platforms, cloud computing, or the billions of phones that now depend on it. The protocols succeeded because they were simple, open, and layered: each layer — physical links, IP routing, TCP reliability, HTTP meaning — solves one problem and trusts the others. That layering is why the same network that carried text-only email in the 1980s now carries live video, banking, and the video call you will make tonight, all without being redesigned.

So the next time a page appears in the blink of an eye, consider what just happened: a name was resolved, an encrypted channel was negotiated across a dozen networks, hundreds of packets were routed independently around the planet and reassembled in order, and a program was constructed and executed on your machine — all before you finished moving your finger from the keyboard.`,
};

/* ------------------------------------------------------------------ */
/* DOM refs + state                                                    */
/* ------------------------------------------------------------------ */

const $ = (sel) => document.querySelector(sel);
const inputEl = $("#inputText");
const charCountEl = $("#charCount");
const routeHintEl = $("#routeHint");
const resultsEl = $("#results");
const logEl = $("#routingLog");
const libraryEl = $("#library");
const runBtn = $("#runBtn");

let currentTask = "summary";
let currentPref = "auto";

const TASK_LABELS = {
  summary: "Summary",
  flashcards: "Flashcards",
  quiz: "Quiz",
  eli5: "Explain simply",
  translate: "Translation",
  actions: "Action items",
};

/* ------------------------------------------------------------------ */
/* Prompts                                                             */
/* ------------------------------------------------------------------ */

const SYSTEM_PROMPT =
  "You are StudySprint, an expert study assistant. Be accurate and faithful to the source text provided by the user. Never invent facts, names, or numbers that are not in the source. Write clearly and concisely.";

function buildPrompt(task, text, targetLang) {
  switch (task) {
    case "summary":
      return `Summarize the text below for a student who needs to learn it fast.

Use exactly this Markdown structure:
## TL;DR
Two or three sentences capturing the whole text.

## Key points
- Five to seven bullet points with the most important ideas.

## Remember this
One sentence: the single most important takeaway.

TEXT:
"""
${text}
"""`;
    case "flashcards":
      return `Create exactly 8 flashcards that test the most important facts and concepts in the text below.

Respond with ONLY a JSON array, no markdown fences and no commentary:
[{"front": "a question or prompt", "back": "the answer"}]

TEXT:
"""
${text}
"""`;
    case "quiz":
      return `Create exactly 5 multiple-choice questions that test understanding of the text below. Each question needs 4 options and exactly one correct answer.

Respond with ONLY a JSON array, no markdown fences and no commentary:
[{"question": "...", "options": ["...", "...", "...", "..."], "answer": 0, "explanation": "why the correct answer is right"}]
The "answer" field is the zero-based index of the correct option.

TEXT:
"""
${text}
"""`;
    case "eli5":
      return `Explain the text below as if the reader is 12 years old: simple words, short sentences, and one everyday analogy. Maximum 200 words. Stay faithful to the source.

TEXT:
"""
${text}
"""`;
    case "translate":
      return `Translate the following text into ${targetLang}. Preserve the meaning, tone, and paragraph structure. Output ONLY the translation.

TEXT:
"""
${text}
"""`;
    case "actions":
      return `Extract every action item, task, commitment, and deadline from the meeting notes below.

Format the answer as a Markdown checklist:
- [ ] The task — Owner (if stated) — Deadline (if stated)

If the notes contain no action items, reply with exactly: "No action items found in this text."

TEXT:
"""
${text}
"""`;
    default:
      return text;
  }
}

/* ------------------------------------------------------------------ */
/* Markdown-lite renderer (input is model output; always escaped)     */
/* ------------------------------------------------------------------ */

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function inlineMd(s) {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function mdToHtml(md) {
  const lines = escapeHtml(md).split("\n");
  let html = "";
  let listType = null;
  const closeList = () => { if (listType) { html += listType === "ul" ? "</ul>" : "</ol>"; listType = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#{1,4}\s/.test(line)) {
      closeList();
      html += `<h3>${inlineMd(line.replace(/^#{1,4}\s/, ""))}</h3>`;
    } else if (/^\s*[-*]\s\[.\]\s/.test(line)) {
      if (listType !== "ul") { closeList(); html += "<ul>"; listType = "ul"; }
      html += `<li>☐ ${inlineMd(line.replace(/^\s*[-*]\s\[.\]\s/, ""))}</li>`;
    } else if (/^\s*[-*]\s+/.test(line)) {
      if (listType !== "ul") { closeList(); html += "<ul>"; listType = "ul"; }
      html += `<li>${inlineMd(line.replace(/^\s*[-*]\s+/, ""))}</li>`;
    } else if (/^\s*\d+[.)]\s+/.test(line)) {
      if (listType !== "ol") { closeList(); html += "<ol>"; listType = "ol"; }
      html += `<li>${inlineMd(line.replace(/^\s*\d+[.)]\s+/, ""))}</li>`;
    } else if (line.trim() === "") {
      closeList();
    } else {
      closeList();
      html += `<p>${inlineMd(line)}</p>`;
    }
  }
  closeList();
  return html;
}

function extractJsonArray(text) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Result cards                                                        */
/* ------------------------------------------------------------------ */

function badgeClass(engine) {
  return engine === "on-device" ? "badge-device" : engine === "cloud" ? "badge-cloud" : "badge-fallback";
}

function renderResultBody(task, text) {
  if (task === "flashcards") {
    const cards = extractJsonArray(text);
    if (cards && cards.length && cards[0].front !== undefined) {
      return `<div class="deck">${cards.map((c, i) => `
        <div class="flashcard" data-flip>
          <div class="flashcard-inner">
            <div class="flash-face flash-front"><span class="flash-tag">Card ${i + 1} · Question — tap to flip</span><div>${escapeHtml(String(c.front))}</div></div>
            <div class="flash-face flash-back"><span class="flash-tag">Answer</span><div>${escapeHtml(String(c.back))}</div></div>
          </div>
        </div>`).join("")}</div>`;
    }
  }
  if (task === "quiz") {
    const qs = extractJsonArray(text);
    if (qs && qs.length && qs[0].question !== undefined) {
      return qs.map((q, qi) => `
        <div class="quiz-q">
          <p>${qi + 1}. ${escapeHtml(String(q.question))}</p>
          ${q.options.map((opt, oi) => `<button class="quiz-opt" data-quiz="${qi}" data-opt="${oi}" data-answer="${q.answer}">${escapeHtml(String(opt))}</button>`).join("")}
          <div class="quiz-expl" hidden>${escapeHtml(String(q.explanation || ""))}</div>
        </div>`).join("");
    }
  }
  return mdToHtml(text);
}

function makeResultCard({ task, result, inputPreview }) {
  const card = document.createElement("article");
  card.className = "result-card";
  const warnings = (result.warnings || []).map((w) => `<p class="warning">⚠ ${escapeHtml(w)}</p>`).join("");
  card.innerHTML = `
    <div class="result-head">
      <span class="result-title">${TASK_LABELS[task] || task}</span>
      <span class="badge ${badgeClass(result.engine)}">${result.engine === "on-device" ? "📱 " : result.engine === "cloud" ? "☁️ " : "🧰 "}${escapeHtml(result.engineLabel)}</span>
      <span class="meta-chip">⏱ ${result.latencyMs.toLocaleString()} ms</span>
      <span class="meta-chip">via ${escapeHtml(result.via)}</span>
    </div>
    <p class="route-reason"><strong>Why this engine?</strong> ${escapeHtml(result.routeReason)}${result.sourceNote ? `<br/><em>${escapeHtml(result.sourceNote)}</em>` : ""}</p>
    ${warnings}
    <div class="result-body">${renderResultBody(task, result.text)}</div>
    <div class="result-actions">
      <button class="mini-btn" data-copy>📋 Copy result</button>
    </div>`;
  card.querySelector("[data-copy]").addEventListener("click", (e) => {
    navigator.clipboard.writeText(result.text).then(() => { e.target.textContent = "✓ Copied"; setTimeout(() => (e.target.textContent = "📋 Copy result"), 1500); });
  });
  card.addEventListener("click", (e) => {
    const fc = e.target.closest("[data-flip]");
    if (fc) fc.classList.toggle("flipped");
    const opt = e.target.closest(".quiz-opt");
    if (opt) {
      const container = opt.closest(".quiz-q");
      const answer = Number(opt.dataset.answer);
      container.querySelectorAll(".quiz-opt").forEach((b) => {
        b.disabled = true;
        if (Number(b.dataset.opt) === answer) b.classList.add("correct");
      });
      if (Number(opt.dataset.opt) !== answer) opt.classList.add("wrong");
      const expl = container.querySelector(".quiz-expl");
      if (expl && expl.textContent.trim()) expl.hidden = false;
    }
  });
  if (inputPreview) card.dataset.inputPreview = inputPreview;
  return card;
}

/* ------------------------------------------------------------------ */
/* Routing log                                                         */
/* ------------------------------------------------------------------ */

function logLine(kind, message) {
  const li = document.createElement("li");
  const time = new Date().toLocaleTimeString([], { hour12: false });
  li.innerHTML = `<time>${time}</time><span class="log-${kind}">${escapeHtml(message)}</span>`;
  logEl.prepend(li);
}

onEngineEvent((evt) => {
  if (evt.type === "route-decided") logLine("route", `🧭 Routed "${evt.task}" → ${evt.target === "device" ? "on-device" : "cloud"}: ${evt.reason}`);
  else if (evt.type === "engine-answered") logLine(evt.engine === "on-device" ? "device" : evt.engine === "cloud" ? "cloud" : "info", `✓ Answered by ${evt.engine} via ${evt.via} in ${evt.latencyMs} ms`);
  else if (evt.type === "engine-error") logLine("error", `✗ Engine error: ${evt.message}`);
  else if (evt.type === "firebase-ready") logLine("info", `🔥 Firebase AI Logic initialized (cloud model: ${evt.cloudModel})`);
  else if (evt.type === "download-progress") {
    const pct = Math.round((evt.loaded || 0) * 100);
    if (pct % 25 === 0) logLine("info", `⬇ Gemini Nano model download: ${pct}%`);
  }
});

/* ------------------------------------------------------------------ */
/* Status pills                                                        */
/* ------------------------------------------------------------------ */

async function refreshStatus() {
  const status = await getEngineStatus();
  const pillDevice = $("#pillDevice");
  const pillFirebase = $("#pillFirebase");
  const deviceText = {
    available: "On-device (Gemini Nano): available ✓",
    downloadable: "On-device (Gemini Nano): model will download on first use",
    downloading: "On-device (Gemini Nano): model downloading…",
    unavailable: "On-device (Gemini Nano): not available on this device",
    unsupported: "On-device: Prompt API missing — use Chrome 139+ on desktop",
  }[status.onDevice];
  const deviceDot = status.onDevice === "available" ? "dot-ok" : status.onDevice === "downloadable" || status.onDevice === "downloading" ? "dot-warn" : "dot-bad";
  pillDevice.innerHTML = `<span class="dot ${deviceDot}"></span><span>${deviceText}</span>`;
  pillFirebase.innerHTML = status.firebaseConfigured
    ? `<span class="dot dot-ok"></span><span>Firebase AI Logic: connected · cloud model ${CLOUD_MODEL}</span>`
    : `<span class="dot dot-warn"></span><span>Firebase AI Logic: DEMO mode — paste a real config in firebase-config.js to enable cloud</span>`;
  return status;
}

/* ------------------------------------------------------------------ */
/* Routing preview + input wiring                                      */
/* ------------------------------------------------------------------ */

function refreshRoutePreview() {
  const text = inputEl.value;
  charCountEl.textContent = `${text.length.toLocaleString()} characters`;
  if (!text.trim()) { routeHintEl.textContent = ""; return; }
  const route = decideRoute(currentTask, text, currentPref);
  routeHintEl.textContent = `Auto-preview: this would run ${route.target === "device" ? "📱 on-device" : "☁️ in the cloud"} — ${route.reason}`;
}

inputEl.addEventListener("input", refreshRoutePreview);
$("#clearBtn").addEventListener("click", () => { inputEl.value = ""; refreshRoutePreview(); inputEl.focus(); });

document.querySelectorAll("[data-sample]").forEach((btn) => {
  btn.addEventListener("click", () => {
    inputEl.value = SAMPLES[btn.dataset.sample];
    refreshRoutePreview();
  });
});

document.querySelectorAll(".task-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".task-btn").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    currentTask = btn.dataset.task;
    $("#translateRow").hidden = currentTask !== "translate";
    refreshRoutePreview();
  });
});

const PREF_NOTES = {
  auto: `Auto routes short, private tasks to Gemini Nano on your device and escalates long documents (>${CLOUD_CHAR_THRESHOLD.toLocaleString()} chars) & heavy generation to cloud Gemini — via Firebase AI Logic InferenceModes.`,
  device: "On-device only (InferenceMode.ONLY_ON_DEVICE): answers are generated by Gemini Nano locally. Nothing is sent to the cloud — if the model is unavailable, the task fails instead of falling back.",
  cloud: "Cloud only (InferenceMode.ONLY_IN_CLOUD): every task goes to cloud Gemini through Firebase AI Logic — strongest quality, requires internet and a Firebase config.",
};

document.querySelectorAll(".seg").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".seg").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    currentPref = btn.dataset.pref;
    $("#prefNote").textContent = PREF_NOTES[currentPref];
    $("#pillMode").innerHTML = `<span class="dot dot-info"></span><span>Routing: ${btn.textContent}</span>`;
    refreshRoutePreview();
  });
});

/* ------------------------------------------------------------------ */
/* Library (localStorage)                                              */
/* ------------------------------------------------------------------ */

const LIB_KEY = "studysprint.sessions.v1";

function loadLibrary() {
  try { return JSON.parse(localStorage.getItem(LIB_KEY)) || []; } catch { return []; }
}
function saveToLibrary(entry) {
  const lib = loadLibrary();
  lib.unshift(entry);
  localStorage.setItem(LIB_KEY, JSON.stringify(lib.slice(0, 30)));
  renderLibrary();
}
function renderLibrary() {
  const lib = loadLibrary();
  if (!lib.length) {
    libraryEl.innerHTML = `<li class="library-empty">No saved sessions yet — your runs will appear here, stored only in this browser.</li>`;
    return;
  }
  libraryEl.innerHTML = "";
  for (const item of lib) {
    const li = document.createElement("li");
    const when = new Date(item.ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    li.innerHTML = `
      <div class="lib-main">
        <div class="lib-title">${escapeHtml(item.title)}</div>
        <div class="lib-sub">${TASK_LABELS[item.task] || item.task} · ${when} · ${escapeHtml(item.engineLabel)} · ${item.latencyMs.toLocaleString()} ms</div>
      </div>
      <button class="mini-btn" data-view>View</button>
      <button class="mini-btn" data-del>✕</button>`;
    li.querySelector("[data-view]").addEventListener("click", () => {
      const card = makeResultCard({
        task: item.task,
        result: { text: item.output, engine: item.engine, engineLabel: item.engineLabel, latencyMs: item.latencyMs, routeReason: item.routeReason, via: item.via, warnings: [] },
      });
      resultsEl.prepend(card);
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    li.querySelector("[data-del]").addEventListener("click", () => {
      localStorage.setItem(LIB_KEY, JSON.stringify(loadLibrary().filter((x) => x.id !== item.id)));
      renderLibrary();
    });
    libraryEl.appendChild(li);
  }
}
$("#clearLibraryBtn").addEventListener("click", () => { localStorage.removeItem(LIB_KEY); renderLibrary(); });

/* ------------------------------------------------------------------ */
/* Run                                                                 */
/* ------------------------------------------------------------------ */

$("#clearResultsBtn").addEventListener("click", () => { resultsEl.innerHTML = ""; });
$("#clearLogBtn").addEventListener("click", () => { logEl.innerHTML = ""; });

runBtn.addEventListener("click", async () => {
  const text = inputEl.value.trim();
  if (!text) {
    inputEl.focus();
    inputEl.placeholder = "⚠ Paste some text first — or load a sample above.";
    return;
  }
  const empty = $("#emptyState");
  if (empty) empty.remove();

  runBtn.disabled = true;
  runBtn.innerHTML = `<span class="spinner"></span> Thinking…`;

  const pending = document.createElement("article");
  pending.className = "result-card";
  pending.innerHTML = `<div class="result-head"><span class="result-title">${TASK_LABELS[currentTask]}</span><span class="meta-chip"><span class="spinner"></span> routing…</span></div><p class="route-reason">Asking the hybrid router which engine should handle this…</p>`;
  resultsEl.prepend(pending);

  try {
    const result = await runHybridTask({
      task: currentTask,
      text,
      targetLanguage: $("#targetLang").value,
      preference: currentPref,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildPrompt(currentTask, text, $("#targetLang").value),
    });
    const card = makeResultCard({ task: currentTask, result, inputPreview: text.slice(0, 80) });
    pending.replaceWith(card);
    saveToLibrary({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      task: currentTask,
      title: text.split("\n")[0].slice(0, 70) || "Untitled text",
      output: result.text,
      engine: result.engine,
      engineLabel: result.engineLabel,
      latencyMs: result.latencyMs,
      routeReason: result.routeReason,
      via: result.via,
    });
    refreshStatus();
  } catch (err) {
    pending.innerHTML = `<div class="result-head"><span class="result-title">${TASK_LABELS[currentTask]}</span><span class="badge badge-fallback">Error</span></div><p class="warning">Something went wrong: ${escapeHtml(String(err && err.message || err))}</p>`;
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = "⚡ Run with hybrid AI";
  }
});

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ------------------------------------------------------------------ */

refreshStatus();
renderLibrary();
refreshRoutePreview();
logLine("info", "StudySprint ready. Hybrid router armed — on-device first, cloud when it counts.");
