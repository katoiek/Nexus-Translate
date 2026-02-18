var q = Object.defineProperty;
var B = (i, t, e) => t in i ? q(i, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : i[t] = e;
var v = (i, t, e) => B(i, typeof t != "symbol" ? t + "" : t, e);
import { app as d, ipcMain as S, screen as R, BrowserWindow as P, clipboard as V, globalShortcut as L, nativeImage as C, Tray as z, Menu as U } from "electron";
import m from "node:path";
import { fileURLToPath as W } from "node:url";
import { execFile as J, spawn as I } from "child_process";
import g from "path";
import O from "fs";
class G {
  getNativePath(t) {
    const e = d.isPackaged;
    return t === "darwin" ? e ? g.join(process.resourcesPath, "native/mac/main") : g.join(process.cwd(), "native/mac/main") : t === "win32" ? e ? g.join(process.resourcesPath, "native/win/NexusNative.exe") : g.join(process.cwd(), "native/win/bin/Release/net10.0-windows10.0.19041.0/win-x64/publish/NexusNative.exe") : null;
  }
  async performOCR(t) {
    return this.runNativeCommand(["ocr", t]);
  }
  async performCaptureAndOCR(t, e, n, s) {
    const o = ["capture", t.toString(), e.toString(), n.toString(), s.toString()];
    return this.runNativeCommand(o);
  }
  async runNativeCommand(t) {
    return new Promise((e, n) => {
      const s = this.getNativePath(process.platform);
      if (!s)
        return n(new Error(`Platform ${process.platform} not supported or native binary missing`));
      if (!O.existsSync(s) && !d.isPackaged)
        return console.warn(`Native binary not found at ${s}`), process.env.NODE_ENV === "development" ? (console.log("Returning mock OCR result"), e({ text: "Mock OCR Text: Japanese text would go here.", confidence: 0.99 })) : n(new Error(`Native binary not found at ${s}`));
      J(s, t, (o, r, h) => {
        if (h && console.log(`Native Diagnostic (Stderr): ${h.trim()}`), o)
          return console.error(`Native Command Failed: ${t.join(" ")}`), r && console.log(`Native Output (Stdout): ${r.trim()}`), n(new Error(`Command failed: ${s}
Error: ${o.message}`));
        try {
          const c = JSON.parse(r.trim());
          console.log(`Native Result Received: ${JSON.stringify(c)}`), e(c);
        } catch {
          console.error(`Failed to parse Native output: ${r}`), n(new Error("Invalid JSON from native sidecar"));
        }
      });
    });
  }
}
const j = new G();
class Q {
  async translate(t, e) {
    const { engine: n, source: s, target: o, apiKeys: r } = e;
    try {
      if (n === "google-free")
        return await this.translateGoogleFree(t, s, o);
      if (n.startsWith("llm"))
        return await this.translateLLM(t, s, o, n, r);
      if (n === "native")
        return await this.translateGoogleFree(t, s, o);
      throw new Error(`Unsupported engine: ${n}`);
    } catch (h) {
      throw console.error("Translation Error:", h), h;
    }
  }
  async translateGoogleFree(t, e, n) {
    const s = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${e}&tl=${n}&dt=t&q=${encodeURIComponent(t)}`, o = await fetch(s);
    if (!o.ok)
      throw new Error(`Google Translate failed: ${o.statusText}`);
    return {
      text: (await o.json())[0].map((c) => c[0]).join(""),
      engine: "google-free"
    };
  }
  async translateLLM(t, e, n, s, o) {
    if (s === "llm-openai" && (o != null && o.openai))
      return await this.translateOpenAI(t, e, n, o.openai);
    if (s === "llm-anthropic" && (o != null && o.anthropic))
      return await this.translateAnthropic(t, e, n, o.anthropic);
    if (s === "llm-gemini" && (o != null && o.gemini))
      return await this.translateGemini(t, e, n, o.gemini);
    if (o != null && o.openai)
      return await this.translateOpenAI(t, e, n, o.openai);
    if (o != null && o.anthropic)
      return await this.translateAnthropic(t, e, n, o.anthropic);
    if (o != null && o.gemini)
      return await this.translateGemini(t, e, n, o.gemini);
    throw new Error(`No API Key configured for ${s}. Please check Settings.`);
  }
  async translateOpenAI(t, e, n, s) {
    var h, c, p, a;
    const o = [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo"
    ];
    let r;
    for (const u of o)
      try {
        console.log(`Attempting OpenAI translation with model: ${u}`);
        const f = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${s}`
          },
          body: JSON.stringify({
            model: u,
            messages: [
              {
                role: "system",
                content: `You are a professional translator. Translate the following text from ${e === "auto" ? "auto-detected language" : e} to ${n}. Output ONLY the translated text. Do not provide explanations, notes, or alternative translations.`
              },
              {
                role: "user",
                content: t
              }
            ]
          })
        });
        if (!f.ok) {
          const b = await f.json();
          if (console.error(`OpenAI API Error (${u}):`, JSON.stringify(b, null, 2)), r = b, f.status === 429 || f.status === 401)
            break;
          continue;
        }
        const A = (p = (c = (h = (await f.json()).choices[0]) == null ? void 0 : h.message) == null ? void 0 : c.content) == null ? void 0 : p.trim();
        if (!A)
          throw new Error("No translation in response");
        return {
          text: A,
          engine: `llm-openai (${u})`
        };
      } catch (f) {
        console.error(`Attempt failed for ${u}:`, f), r = f;
      }
    throw new Error(`OpenAI API Error: ${((a = r == null ? void 0 : r.error) == null ? void 0 : a.message) || (r == null ? void 0 : r.message) || "All models failed"}`);
  }
  async translateAnthropic(t, e, n, s) {
    var h, c;
    const o = [
      "claude-3-5-haiku-20241022",
      "claude-3-5-sonnet-20240620",
      "claude-3-5-sonnet-20241022",
      "claude-3-opus-20240229"
    ];
    let r;
    for (const p of o)
      try {
        console.log(`Attempting Anthropic translation with model: ${p}`);
        const a = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": s,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: p,
            max_tokens: 1024,
            system: `You are a high-performance translation engine. Translate the provided text to ${n}. Output ONLY the translated result. Do not output the language name, character count, or any introductory phrases like "Here is the translation". Return strictly the translation.`,
            messages: [
              { role: "user", content: t }
            ]
          })
        });
        if (!a.ok) {
          const w = await a.json();
          if (console.error(`Anthropic API Error (${p}):`, JSON.stringify(w, null, 2)), r = w, a.status === 429 || a.status === 401)
            break;
          continue;
        }
        return {
          text: (h = (await a.json()).content[0]) == null ? void 0 : h.text,
          engine: `llm-anthropic (${p})`
        };
      } catch (a) {
        if (console.error(`Attempt failed for ${p}:`, a), r = a, a.message && a.message.includes("Anthropic Auth Error"))
          throw a;
      }
    throw new Error(`Anthropic API Error: ${((c = r == null ? void 0 : r.error) == null ? void 0 : c.message) || (r == null ? void 0 : r.message) || "Unknown error"}`);
  }
  async translateGemini(t, e, n, s) {
    var h, c, p, a, u, f;
    const o = [
      "gemini-flash-latest",
      "gemini-pro-latest",
      "gemini-2.0-flash-lite",
      "gemini-2.0-flash"
    ];
    let r;
    for (const w of o)
      try {
        console.log(`Attempting Gemini translation with model: ${w}`);
        const A = `https://generativelanguage.googleapis.com/v1beta/models/${w}:generateContent?key=${s}`, b = await fetch(A, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `You are a professional translator. Translate the following text to ${n}. Output ONLY the translated text. Do not provide explanations, notes, or alternative translations.

Text: ${t}`
              }]
            }]
          })
        });
        if (!b.ok) {
          const $ = await b.json();
          console.error(`Gemini API Error (${w}):`, JSON.stringify($, null, 2)), r = $, b.status === 404 && w === o[0] && this.logAvailableGeminiModels(s).catch(console.error);
          continue;
        }
        const x = (u = (a = (p = (c = (h = (await b.json()).candidates) == null ? void 0 : h[0]) == null ? void 0 : c.content) == null ? void 0 : p.parts) == null ? void 0 : a[0]) == null ? void 0 : u.text;
        if (!x)
          throw new Error("No translation in response");
        return {
          text: x,
          engine: `llm-gemini (${w})`
        };
      } catch (A) {
        console.error(`Attempt failed for ${w}:`, A), r = A;
      }
    throw new Error(`Gemini API Error: ${((f = r == null ? void 0 : r.error) == null ? void 0 : f.message) || (r == null ? void 0 : r.message) || "All models failed"}`);
  }
  async logAvailableGeminiModels(t) {
    try {
      console.log("Fetching available Gemini models...");
      const n = await (await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${t}`)).json();
      n.models ? console.log("Available Gemini Models:", n.models.map((s) => s.name)) : console.log("Failed to list models:", n);
    } catch (e) {
      console.error("Error listing models:", e);
    }
  }
}
const Y = new Q();
class H {
  constructor() {
    v(this, "process", null);
    v(this, "isReady", !1);
    v(this, "queue", []);
  }
  init() {
    var c, p;
    if (this.process) return;
    const t = !d.isPackaged, e = t ? g.join(process.cwd()) : g.join(process.resourcesPath), n = process.platform === "win32" ? "translator.exe" : "translator", s = g.join(e, "native/cpp/build", n), o = g.join(e, "bin", n), r = t ? s : o, h = t ? g.join(e, "native/models/nllb-200-distilled-600M") : g.join(e, "native/models/nllb-200-distilled-600M");
    console.log("[OfflineTranslationService] Initializing..."), console.log("[OfflineTranslationService] Executable:", r), console.log("[OfflineTranslationService] Model:", h);
    try {
      this.process = I(r, [h]), (c = this.process.stdout) == null || c.on("data", (a) => {
        const u = a.toString().split(`
`);
        for (const f of u)
          f.trim() && this.handleOutput(f.trim());
      }), (p = this.process.stderr) == null || p.on("data", (a) => {
        const u = a.toString();
        console.error("[Translator Stderr]:", u);
      }), this.process.on("close", (a) => {
        for (console.log(`[OfflineTranslationService] Process exited with code ${a}`), this.process = null, this.isReady = !1; this.queue.length > 0; ) {
          const u = this.queue.shift();
          u == null || u.reject(new Error("Translation service exited unexpectedly"));
        }
      }), this.process.on("error", (a) => {
        console.error("[OfflineTranslationService] Failed to spawn process:", a);
      });
    } catch (a) {
      console.error("[OfflineTranslationService] Initialization error:", a);
    }
  }
  handleOutput(t) {
    try {
      const e = JSON.parse(t);
      if (e.status === "ready") {
        this.isReady = !0, console.log("[OfflineTranslationService] Service Ready");
        return;
      }
      const n = this.queue.shift();
      if (!n)
        return;
      if (e.error)
        n.reject(new Error(e.error));
      else {
        const s = e.text.replace(/^[a-z]{3}_[A-Z][a-z]{3}\s+/gm, "").trim();
        n.resolve({ ...e, text: s });
      }
    } catch {
      console.error("[OfflineTranslationService] Failed to parse output:", t);
    }
  }
  async translate(t, e, n) {
    this.process || (this.init(), this.isReady || console.log("[OfflineTranslationService] Waiting for service...")), this.isReady || await new Promise((r) => {
      const h = setInterval(() => {
        this.isReady && (clearInterval(h), r());
      }, 100);
    });
    let s = [];
    try {
      const r = new Intl.Segmenter(e, { granularity: "sentence" });
      s = Array.from(r.segment(t)).map((h) => h.segment);
    } catch (r) {
      console.warn("[OfflineTranslationService] Intl.Segmenter failed, falling back to newline splitting:", r), s = t.split(`
`);
    }
    const o = s.filter((r) => r.trim().length > 0);
    if (o.length === 0)
      return { text: "", detectedSourceLanguage: e };
    try {
      return {
        text: (await this.translateBatch(o, e, n)).text,
        detectedSourceLanguage: e
      };
    } catch (r) {
      return console.error("[OfflineTranslationService] Batch translation failed", r), { text: t, error: String(r) };
    }
  }
  translateBatch(t, e, n) {
    return new Promise((s, o) => {
      if (!this.process || !this.process.stdin)
        return o(new Error("Offline translation service not running"));
      const r = this.mapToNLLB(e), h = this.mapToNLLB(n), c = t.map((a) => a.replace(/\n/g, " ").replace(/\r/g, "")), p = JSON.stringify({ text: c, source: r, target: h });
      this.process.stdin.write(p + `
`), this.queue.push({ resolve: s, reject: o });
    });
  }
  mapToNLLB(t) {
    return {
      en: "eng_Latn",
      ja: "jpn_Jpan",
      es: "spa_Latn",
      fr: "fra_Latn",
      de: "deu_Latn",
      zh: "zho_Hans",
      ko: "kor_Hang",
      it: "ita_Latn",
      pt: "por_Latn",
      ru: "rus_Cyrl",
      nl: "nld_Latn",
      pl: "pol_Latn",
      tr: "tur_Latn",
      vi: "vie_Latn",
      th: "tha_Thai",
      id: "ind_Latn",
      hi: "hin_Deva",
      ar: "arb_Arab",
      bn: "ben_Beng",
      cs: "ces_Latn",
      da: "dan_Latn",
      fi: "fin_Latn",
      el: "ell_Grek",
      he: "heb_Hebr",
      hu: "hun_Latn",
      ms: "zsm_Latn",
      no: "nob_Latn",
      ro: "ron_Latn",
      sv: "swe_Latn",
      tl: "tgl_Latn",
      uk: "ukr_Cyrl"
    }[t] || t;
  }
  dispose() {
    this.process && (this.process.kill(), this.process = null);
  }
}
const E = new H(), X = m.dirname(W(import.meta.url));
class Z {
  constructor() {
    v(this, "captureWindows", []);
    v(this, "mainWindow", null);
  }
  init(t) {
    this.mainWindow = t, S.on("start-capture", () => this.startCapture()), S.on("capture-complete", (e, n) => this.handleCaptureComplete(e, n)), S.on("cancel-capture", () => this.closeCaptureWindows()), S.on("close-capture-window", () => this.closeCaptureWindows());
  }
  startCapture() {
    if (this.captureWindows.length > 0) return;
    R.getAllDisplays().forEach((e) => {
      const n = new P({
        x: e.bounds.x,
        y: e.bounds.y,
        width: e.bounds.width,
        height: e.bounds.height,
        transparent: !0,
        frame: !1,
        alwaysOnTop: !0,
        skipTaskbar: !0,
        resizable: !1,
        movable: !1,
        fullscreen: !1,
        hasShadow: !1,
        enableLargerThanScreen: !0,
        webPreferences: {
          preload: m.join(X, "preload.mjs"),
          nodeIntegration: !1,
          contextIsolation: !0
        }
      }), s = process.env.VITE_DEV_SERVER_URL;
      if (s)
        n.loadURL(`${s}?mode=screenshot&displayId=${e.id}`);
      else {
        const o = m.join(process.env.APP_ROOT || "", "dist");
        n.loadFile(m.join(o, "index.html"), { search: `mode=screenshot&displayId=${e.id}` });
      }
      n.on("closed", () => {
        this.captureWindows = this.captureWindows.filter((o) => o !== n);
      }), n.displayId = e.id, this.captureWindows.push(n);
    });
  }
  closeCaptureWindows() {
    var t, e;
    this.captureWindows.forEach((n) => n.close()), this.captureWindows = [], (t = this.mainWindow) == null || t.show(), (e = this.mainWindow) == null || e.focus();
  }
  async handleCaptureComplete(t, e) {
    var n, s, o, r, h;
    this.captureWindows.forEach((c) => c.hide());
    try {
      const c = P.fromWebContents(t.sender), p = c == null ? void 0 : c.displayId;
      if (!p)
        throw new Error("Could not identify display for capture");
      this.logDebug(`Capture rect: ${JSON.stringify(e)}, DisplayID: ${p}`);
      const a = R.getAllDisplays().find(($) => $.id === p);
      if (!a)
        throw new Error(`Display not found for ID: ${p}`);
      const u = process.platform === "darwin", f = a.scaleFactor;
      this.logDebug(`Display found: ${a.id}, Scale: ${f}, Bounds: ${JSON.stringify(a.bounds)}`);
      const w = Math.round((a.bounds.x + e.x) * (u ? 1 : f)), A = Math.round((a.bounds.y + e.y) * (u ? 1 : f)), b = Math.round(e.width * (u ? 1 : f)), _ = Math.round(e.height * (u ? 1 : f));
      this.logDebug(`Requesting Native Capture (${u ? "macOS/Points" : "Windows/Pixels"}): x=${w}, y=${A}, w=${b}, h=${_}`);
      const x = await j.performCaptureAndOCR(w, A, b, _);
      this.closeCaptureWindows(), (n = this.mainWindow) == null || n.webContents.send("ocr-result", x), (s = this.mainWindow) == null || s.show(), (o = this.mainWindow) == null || o.focus();
    } catch (c) {
      console.error("Screenshot processing failed:", c), this.logDebug(`ERROR: ${c}`), this.closeCaptureWindows(), (r = this.mainWindow) == null || r.webContents.send("ocr-result", { text: `Error: ${c}` }), (h = this.mainWindow) == null || h.show();
    }
  }
  logDebug(t) {
    try {
      const e = m.join(d.getPath("userData"), "screenshot_debug.log");
      O.appendFileSync(e, `[${(/* @__PURE__ */ new Date()).toISOString()}] ${t}
`);
    } catch (e) {
      console.error("Failed to write log:", e);
    }
  }
}
const D = new Z();
class K {
  constructor() {
    v(this, "mainWindow", null);
    v(this, "watcherProcess", null);
    v(this, "lastChangeTime", 0);
    v(this, "lastSequence", 0);
  }
  init(t) {
    console.log("ClipboardWatcher: Initializing Native Approach..."), this.mainWindow = t, this.startNativeWatcher();
  }
  getNativePath() {
    const t = d.isPackaged;
    return process.platform === "darwin" ? t ? g.join(process.resourcesPath, "native/mac/main") : g.join(process.cwd(), "native/mac/main") : process.platform === "win32" ? t ? g.join(process.resourcesPath, "native/win/NexusNative.exe") : g.join(process.cwd(), "native/win/bin/Release/net10.0-windows10.0.19041.0/win-x64/publish/NexusNative.exe") : "";
  }
  startNativeWatcher() {
    const t = this.getNativePath();
    if (!t) {
      console.error(`ClipboardWatcher: Native path not found for platform ${process.platform}`);
      return;
    }
    console.log(`ClipboardWatcher: Spawning ${t} watch-clipboard`);
    try {
      this.watcherProcess = I(t, ["watch-clipboard"]), this.watcherProcess.stdout.on("data", (e) => {
        const n = e.toString().split(`
`);
        for (const s of n)
          if (s.trim())
            try {
              const o = JSON.parse(s);
              this.handleNativeMessage(o);
            } catch {
            }
      }), this.watcherProcess.stderr.on("data", (e) => {
        console.error(`ClipboardWatcher Native Error: ${e}`);
      }), this.watcherProcess.on("close", (e) => {
        console.log(`ClipboardWatcher process exited with code ${e}`), this.watcherProcess = null;
      });
    } catch (e) {
      console.error("ClipboardWatcher: Failed to spawn native process", e);
    }
  }
  handleNativeMessage(t) {
    if (t.type === "init")
      this.lastSequence = t.sequence, console.log(`ClipboardWatcher: Native Init Sequence ${this.lastSequence}`);
    else if (t.type === "change") {
      const e = t.sequence, n = Date.now(), s = n - this.lastChangeTime, o = s > 10 && s < 500;
      if (console.log(`Clipboard Native Change: ${this.lastSequence} -> ${e}, diff: ${s}ms, rapid: ${o}`), o) {
        const r = V.readText();
        r && r.trim().length > 0 && this.triggerSmartTranslate(r);
      }
      this.lastSequence = e, this.lastChangeTime = n;
    }
  }
  triggerSmartTranslate(t) {
    !this.mainWindow || this.mainWindow.isDestroyed() || (console.log("Smart Translate Triggered via Ctrl+C+C"), this.mainWindow.isMinimized() && this.mainWindow.restore(), this.mainWindow.isVisible() || this.mainWindow.show(), this.mainWindow.focus(), this.mainWindow.webContents.send("smart-translate", t));
  }
  stop() {
    this.watcherProcess && (this.watcherProcess.kill(), this.watcherProcess = null);
  }
}
const ee = new K();
class te {
  constructor(t) {
    v(this, "path");
    v(this, "data");
    const e = d.getPath("userData");
    this.path = g.join(e, t), this.data = ne(this.path, {});
  }
  get(t, e) {
    return this.data[t] !== void 0 ? this.data[t] : e;
  }
  set(t, e) {
    this.data[t] = e, O.writeFileSync(this.path, JSON.stringify(this.data));
  }
  getAll() {
    return this.data;
  }
}
function ne(i, t) {
  try {
    return JSON.parse(O.readFileSync(i).toString());
  } catch {
    return t;
  }
}
const N = new te("settings.json"), k = m.dirname(W(import.meta.url));
process.env.APP_ROOT = m.join(k, "..");
const y = process.env.VITE_DEV_SERVER_URL, de = m.join(process.env.APP_ROOT, "dist-electron"), M = m.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = y ? m.join(process.env.APP_ROOT, "public") : M;
let l, T = null;
function oe() {
  if (!T)
    try {
      const i = "icon.png", t = m.join(process.env.VITE_PUBLIC, i);
      let e = C.createFromPath(t);
      e.isEmpty() && (console.warn(`Icon ${i} is empty or missing. Using fallback.`), e = C.createFromDataURL("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAB5JREFUOE9jZGBg+M+AAxjhP4phNAPQaBj1AAqDMAQA711W5dMc3tMAAAAASUVORK5CYII=")), T = new z(e), T.setToolTip("Nexus Translate"), (() => {
        const s = U.buildFromTemplate([
          {
            label: "Show App",
            click: () => {
              l && (l.show(), l.focus());
            }
          },
          { type: "separator" },
          {
            label: "Quit",
            click: () => {
              d.isQuitting = !0, d.quit();
            }
          }
        ]);
        T == null || T.setContextMenu(s);
      })(), T.on("click", () => {
        l && (l.isVisible() ? (l.isMinimized() && l.restore(), l.focus()) : (l.show(), l.focus()));
      });
    } catch (i) {
      console.error("Failed to create tray:", i);
    }
}
function F() {
  const i = m.join(process.env.VITE_PUBLIC, "icon.png");
  l = new P({
    title: "Nexus Translate",
    width: 1e3,
    height: 700,
    icon: i,
    autoHideMenuBar: !0,
    // Hide menu bar (File, Edit, etc.)
    webPreferences: {
      preload: m.join(k, "preload.mjs")
    }
  }), D.init(l), ee.init(l), E.init(), l.on("close", (t) => {
    if (d.isQuitting)
      return;
    const e = N.get("closeBehavior", "ask");
    if (e !== "quit") {
      if (e === "minimize") {
        t.preventDefault(), l == null || l.hide();
        return;
      } else if (e === "ask") {
        t.preventDefault(), l == null || l.webContents.send("show-close-confirmation"), l == null || l.show(), l == null || l.focus();
        return;
      }
    }
  }), l.webContents.on("did-finish-load", () => {
    l == null || l.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), y ? l.loadURL(y) : l.loadFile(m.join(M, "index.html"));
}
d.isQuitting = !1;
d.on("before-quit", () => {
  d.isQuitting = !0, E.dispose();
});
d.on("window-all-closed", () => {
  process.platform !== "darwin" && (d.quit(), l = null);
});
d.on("will-quit", () => {
  L.unregisterAll();
});
d.on("activate", () => {
  const i = P.getAllWindows();
  i.length === 0 ? F() : i.forEach((t) => {
    t.isVisible() || t.show(), t.isMinimized() && t.restore(), t.focus();
  });
});
d.whenReady().then(() => {
  if (d.isPackaged) {
    const i = N.get("launchAtLogin", !1);
    d.setLoginItemSettings({
      openAtLogin: i,
      path: d.getPath("exe")
    });
  }
  if (oe(), F(), process.platform === "darwin") {
    const i = m.join(process.env.VITE_PUBLIC, "icon.png"), t = C.createFromPath(i);
    d.dock.setIcon(t);
  }
  L.register("Alt+Space", () => {
    D.startCapture();
  });
});
S.handle("ocr-request", async (i, t) => {
  try {
    return await j.performOCR(t);
  } catch (e) {
    return console.error("OCR Error:", e), { text: `Error: ${e.message}`, confidence: 0 };
  }
});
S.handle("translate-request", async (i, t, e) => {
  try {
    return e.engine === "offline" ? { text: (await E.translate(t, e.source, e.target)).text, engine: "offline" } : await Y.translate(t, e);
  } catch (n) {
    return console.error("Translation Error:", n), { text: `Error: ${n.message}`, engine: e.engine };
  }
});
S.handle("get-settings", () => N.getAll());
S.handle("set-setting", (i, t, e) => {
  N.set(t, e), t === "launchAtLogin" && d.isPackaged && d.setLoginItemSettings({
    openAtLogin: e,
    path: d.getPath("exe")
  });
});
S.on("confirm-close-action", (i, t) => {
  const e = P.getFocusedWindow();
  t === "quit" ? (d.isQuitting = !0, d.quit()) : e == null || e.hide();
});
S.on("window-minimize", () => {
  const i = P.getFocusedWindow();
  i == null || i.minimize();
});
S.on("window-maximize", () => {
  const i = P.getFocusedWindow();
  i != null && i.isMaximized() ? i.unmaximize() : i == null || i.maximize();
});
S.on("window-close", () => {
  const i = P.getFocusedWindow();
  i == null || i.close();
});
export {
  de as MAIN_DIST,
  M as RENDERER_DIST,
  y as VITE_DEV_SERVER_URL
};
