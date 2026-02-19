var q = Object.defineProperty;
var B = (i, t, e) => t in i ? q(i, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : i[t] = e;
var m = (i, t, e) => B(i, typeof t != "symbol" ? t + "" : t, e);
import { app as d, ipcMain as A, screen as R, BrowserWindow as x, clipboard as U, globalShortcut as L, nativeImage as _, Tray as V, Menu as z } from "electron";
import w from "node:path";
import { fileURLToPath as I } from "node:url";
import { execFile as J, spawn as W } from "child_process";
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
  async performCaptureAndOCR(t, e, n, r) {
    const o = ["capture", t.toString(), e.toString(), n.toString(), r.toString()];
    return this.runNativeCommand(o);
  }
  async runNativeCommand(t) {
    return new Promise((e, n) => {
      const r = this.getNativePath(process.platform);
      if (!r)
        return n(new Error(`Platform ${process.platform} not supported or native binary missing`));
      if (!O.existsSync(r) && !d.isPackaged)
        return console.warn(`Native binary not found at ${r}`), process.env.NODE_ENV === "development" ? (console.log("Returning mock OCR result"), e({ text: "Mock OCR Text: Japanese text would go here.", confidence: 0.99 })) : n(new Error(`Native binary not found at ${r}`));
      J(r, t, (o, s, h) => {
        if (h && console.log(`Native Diagnostic (Stderr): ${h.trim()}`), o)
          return console.error(`Native Command Failed: ${t.join(" ")}`), s && console.log(`Native Output (Stdout): ${s.trim()}`), n(new Error(`Command failed: ${r}
Error: ${o.message}`));
        try {
          const c = JSON.parse(s.trim());
          console.log(`Native Result Received: ${JSON.stringify(c)}`), e(c);
        } catch {
          console.error(`Failed to parse Native output: ${s}`), n(new Error("Invalid JSON from native sidecar"));
        }
      });
    });
  }
}
const j = new G();
class Q {
  async translate(t, e) {
    const { engine: n, source: r, target: o, apiKeys: s } = e;
    try {
      if (n === "google-free")
        return await this.translateGoogleFree(t, r, o);
      if (n.startsWith("llm"))
        return await this.translateLLM(t, r, o, n, s);
      if (n === "native")
        return await this.translateGoogleFree(t, r, o);
      throw new Error(`Unsupported engine: ${n}`);
    } catch (h) {
      throw console.error("Translation Error:", h), h;
    }
  }
  async translateGoogleFree(t, e, n) {
    const r = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${e}&tl=${n}&dt=t&q=${encodeURIComponent(t)}`, o = await fetch(r);
    if (!o.ok)
      throw new Error(`Google Translate failed: ${o.statusText}`);
    return {
      text: (await o.json())[0].map((c) => c[0]).join(""),
      engine: "google-free"
    };
  }
  async translateLLM(t, e, n, r, o) {
    if (r === "llm-openai" && (o != null && o.openai))
      return await this.translateOpenAI(t, e, n, o.openai);
    if (r === "llm-anthropic" && (o != null && o.anthropic))
      return await this.translateAnthropic(t, e, n, o.anthropic);
    if (r === "llm-gemini" && (o != null && o.gemini))
      return await this.translateGemini(t, e, n, o.gemini);
    if (o != null && o.openai)
      return await this.translateOpenAI(t, e, n, o.openai);
    if (o != null && o.anthropic)
      return await this.translateAnthropic(t, e, n, o.anthropic);
    if (o != null && o.gemini)
      return await this.translateGemini(t, e, n, o.gemini);
    throw new Error(`No API Key configured for ${r}. Please check Settings.`);
  }
  async translateOpenAI(t, e, n, r) {
    var h, c, u, a;
    const o = [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo"
    ];
    let s;
    for (const p of o)
      try {
        console.log(`Attempting OpenAI translation with model: ${p}`);
        const f = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${r}`
          },
          body: JSON.stringify({
            model: p,
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
          if (console.error(`OpenAI API Error (${p}):`, JSON.stringify(b, null, 2)), s = b, f.status === 429 || f.status === 401)
            break;
          continue;
        }
        const S = (u = (c = (h = (await f.json()).choices[0]) == null ? void 0 : h.message) == null ? void 0 : c.content) == null ? void 0 : u.trim();
        if (!S)
          throw new Error("No translation in response");
        return {
          text: S,
          engine: `llm-openai (${p})`
        };
      } catch (f) {
        console.error(`Attempt failed for ${p}:`, f), s = f;
      }
    throw new Error(`OpenAI API Error: ${((a = s == null ? void 0 : s.error) == null ? void 0 : a.message) || (s == null ? void 0 : s.message) || "All models failed"}`);
  }
  async translateAnthropic(t, e, n, r) {
    var h, c;
    const o = [
      "claude-3-5-haiku-20241022",
      "claude-3-5-sonnet-20240620",
      "claude-3-5-sonnet-20241022",
      "claude-3-opus-20240229"
    ];
    let s;
    for (const u of o)
      try {
        console.log(`Attempting Anthropic translation with model: ${u}`);
        const a = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": r,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: u,
            max_tokens: 1024,
            system: `You are a high-performance translation engine. Translate the provided text to ${n}. Output ONLY the translated result. Do not output the language name, character count, or any introductory phrases like "Here is the translation". Return strictly the translation.`,
            messages: [
              { role: "user", content: t }
            ]
          })
        });
        if (!a.ok) {
          const v = await a.json();
          if (console.error(`Anthropic API Error (${u}):`, JSON.stringify(v, null, 2)), s = v, a.status === 429 || a.status === 401)
            break;
          continue;
        }
        return {
          text: (h = (await a.json()).content[0]) == null ? void 0 : h.text,
          engine: `llm-anthropic (${u})`
        };
      } catch (a) {
        if (console.error(`Attempt failed for ${u}:`, a), s = a, a.message && a.message.includes("Anthropic Auth Error"))
          throw a;
      }
    throw new Error(`Anthropic API Error: ${((c = s == null ? void 0 : s.error) == null ? void 0 : c.message) || (s == null ? void 0 : s.message) || "Unknown error"}`);
  }
  async translateGemini(t, e, n, r) {
    var h, c, u, a, p, f;
    const o = [
      "gemini-flash-latest",
      "gemini-pro-latest",
      "gemini-2.0-flash-lite",
      "gemini-2.0-flash"
    ];
    let s;
    for (const v of o)
      try {
        console.log(`Attempting Gemini translation with model: ${v}`);
        const S = `https://generativelanguage.googleapis.com/v1beta/models/${v}:generateContent?key=${r}`, b = await fetch(S, {
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
          console.error(`Gemini API Error (${v}):`, JSON.stringify($, null, 2)), s = $, b.status === 404 && v === o[0] && this.logAvailableGeminiModels(r).catch(console.error);
          continue;
        }
        const T = (p = (a = (u = (c = (h = (await b.json()).candidates) == null ? void 0 : h[0]) == null ? void 0 : c.content) == null ? void 0 : u.parts) == null ? void 0 : a[0]) == null ? void 0 : p.text;
        if (!T)
          throw new Error("No translation in response");
        return {
          text: T,
          engine: `llm-gemini (${v})`
        };
      } catch (S) {
        console.error(`Attempt failed for ${v}:`, S), s = S;
      }
    throw new Error(`Gemini API Error: ${((f = s == null ? void 0 : s.error) == null ? void 0 : f.message) || (s == null ? void 0 : s.message) || "All models failed"}`);
  }
  async logAvailableGeminiModels(t) {
    try {
      console.log("Fetching available Gemini models...");
      const n = await (await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${t}`)).json();
      n.models ? console.log("Available Gemini Models:", n.models.map((r) => r.name)) : console.log("Failed to list models:", n);
    } catch (e) {
      console.error("Error listing models:", e);
    }
  }
}
const Y = new Q();
class H {
  constructor() {
    m(this, "process", null);
    m(this, "isReady", !1);
    m(this, "queue", []);
    m(this, "restartAttempts", 0);
    m(this, "maxRestarts", 3);
    m(this, "restartDelay", 1e3);
  }
  init() {
    var c, u;
    if (this.process) return;
    const t = !d.isPackaged, e = t ? g.join(process.cwd()) : g.join(process.resourcesPath), n = process.platform === "win32" ? "translator.exe" : "translator", r = g.join(e, "native/cpp/build", n), o = g.join(e, "native/cpp", n), s = t ? r : o, h = t ? g.join(e, "native/models/nllb-200-distilled-600M") : g.join(e, "native/models/nllb-200-distilled-600M");
    console.log("[OfflineTranslationService] Initializing..."), console.log("[OfflineTranslationService] Executable:", s), console.log("[OfflineTranslationService] Model:", h);
    try {
      this.process = W(s, [h]), (c = this.process.stdout) == null || c.on("data", (a) => {
        const p = a.toString().split(`
`);
        for (const f of p)
          f.trim() && this.handleOutput(f.trim());
      }), (u = this.process.stderr) == null || u.on("data", (a) => {
        const p = a.toString();
        console.error("[Translator Stderr]:", p);
      }), this.process.on("close", (a) => {
        console.log(`[OfflineTranslationService] Process exited with code ${a}`), this.process = null, this.isReady = !1, a !== 0 && a !== null ? this.handleUnexpectedExit() : this.rejectAllPending("Service stopped");
      }), this.process.on("error", (a) => {
        console.error("[OfflineTranslationService] Failed to spawn process:", a), this.handleUnexpectedExit();
      });
    } catch (a) {
      console.error("[OfflineTranslationService] Initialization error:", a);
    }
  }
  handleUnexpectedExit() {
    this.restartAttempts < this.maxRestarts ? (this.restartAttempts++, console.log(`[OfflineTranslationService] Restarting service in ${this.restartDelay}ms (Attempt ${this.restartAttempts}/${this.maxRestarts})...`), setTimeout(() => {
      this.init();
    }, this.restartDelay)) : (console.error("[OfflineTranslationService] Max restart attempts reached. Service is dead."), this.rejectAllPending("Translation service crashed and could not be restarted."));
  }
  rejectAllPending(t) {
    for (; this.queue.length > 0; ) {
      const e = this.queue.shift();
      e == null || e.reject(new Error(t));
    }
  }
  handleOutput(t) {
    try {
      const e = JSON.parse(t);
      if (e.status === "ready") {
        this.isReady = !0, this.restartAttempts = 0, console.log("[OfflineTranslationService] Service Ready");
        return;
      }
      const n = this.queue.shift();
      if (!n)
        return;
      if (e.error)
        n.reject(new Error(e.error));
      else {
        let r = e.text;
        typeof r == "string" && (r = r.replace(/^[a-z]{3}_[A-Z][a-z]{3}\s+/gm, "").trim()), n.resolve({ ...e, text: r });
      }
    } catch {
      console.error("[OfflineTranslationService] Failed to parse output:", t);
    }
  }
  async translate(t, e, n) {
    if (this.process || (this.init(), this.isReady || console.log("[OfflineTranslationService] Waiting for service...")), !this.isReady) {
      if (this.process === null && this.restartAttempts >= this.maxRestarts)
        return { text: t, error: "Translation service is unavailable" };
      await new Promise((s, h) => {
        const c = Date.now(), u = setInterval(() => {
          this.isReady && (clearInterval(u), s()), Date.now() - c > 5e3 && (clearInterval(u), h(new Error("Service initialization timeout")));
        }, 100);
      });
    }
    let r = [];
    try {
      const s = new Intl.Segmenter(e, { granularity: "sentence" });
      r = Array.from(s.segment(t)).map((h) => h.segment);
    } catch {
      r = t.split(`
`);
    }
    const o = r.filter((s) => s.trim().length > 0);
    if (o.length === 0)
      return { text: "", detectedSourceLanguage: e };
    try {
      return {
        text: (await this.translateBatch(o, e, n)).text,
        detectedSourceLanguage: e
      };
    } catch (s) {
      return console.error("[OfflineTranslationService] Batch translation failed", s), { text: t, error: String(s) };
    }
  }
  translateBatch(t, e, n) {
    return new Promise((r, o) => {
      if (!this.process || !this.process.stdin)
        return o(new Error("Offline translation service not running"));
      const s = this.mapToNLLB(e), h = this.mapToNLLB(n), c = t.map((p) => p.replace(/\n/g, " ").replace(/\r/g, "")), u = JSON.stringify({ text: c, source: s, target: h });
      this.process.stdin.write(u + `
`) || console.warn("[OfflineTranslationService] Stdin buffer full"), this.queue.push({ resolve: r, reject: o });
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
const E = new H(), X = w.dirname(I(import.meta.url));
class Z {
  constructor() {
    m(this, "captureWindows", []);
    m(this, "mainWindow", null);
  }
  init(t) {
    this.mainWindow = t, A.on("start-capture", () => this.startCapture()), A.on("capture-complete", (e, n) => this.handleCaptureComplete(e, n)), A.on("cancel-capture", () => this.closeCaptureWindows()), A.on("close-capture-window", () => this.closeCaptureWindows());
  }
  startCapture() {
    if (this.captureWindows.length > 0) return;
    R.getAllDisplays().forEach((e) => {
      const n = new x({
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
          preload: w.join(X, "preload.mjs"),
          nodeIntegration: !1,
          contextIsolation: !0
        }
      }), r = process.env.VITE_DEV_SERVER_URL;
      if (r)
        n.loadURL(`${r}?mode=screenshot&displayId=${e.id}`);
      else {
        const o = w.join(process.env.APP_ROOT || "", "dist");
        n.loadFile(w.join(o, "index.html"), { search: `mode=screenshot&displayId=${e.id}` });
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
    var n, r, o, s, h;
    this.captureWindows.forEach((c) => c.hide());
    try {
      const c = x.fromWebContents(t.sender), u = c == null ? void 0 : c.displayId;
      if (!u)
        throw new Error("Could not identify display for capture");
      this.logDebug(`Capture rect: ${JSON.stringify(e)}, DisplayID: ${u}`);
      const a = R.getAllDisplays().find(($) => $.id === u);
      if (!a)
        throw new Error(`Display not found for ID: ${u}`);
      const p = process.platform === "darwin", f = a.scaleFactor;
      this.logDebug(`Display found: ${a.id}, Scale: ${f}, Bounds: ${JSON.stringify(a.bounds)}`);
      const v = Math.round((a.bounds.x + e.x) * (p ? 1 : f)), S = Math.round((a.bounds.y + e.y) * (p ? 1 : f)), b = Math.round(e.width * (p ? 1 : f)), N = Math.round(e.height * (p ? 1 : f));
      this.logDebug(`Requesting Native Capture (${p ? "macOS/Points" : "Windows/Pixels"}): x=${v}, y=${S}, w=${b}, h=${N}`);
      const T = await j.performCaptureAndOCR(v, S, b, N);
      this.closeCaptureWindows(), (n = this.mainWindow) == null || n.webContents.send("ocr-result", T), (r = this.mainWindow) == null || r.show(), (o = this.mainWindow) == null || o.focus();
    } catch (c) {
      console.error("Screenshot processing failed:", c), this.logDebug(`ERROR: ${c}`), this.closeCaptureWindows(), (s = this.mainWindow) == null || s.webContents.send("ocr-result", { text: `Error: ${c}` }), (h = this.mainWindow) == null || h.show();
    }
  }
  logDebug(t) {
    try {
      const e = w.join(d.getPath("userData"), "screenshot_debug.log");
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
    m(this, "mainWindow", null);
    m(this, "watcherProcess", null);
    m(this, "lastChangeTime", 0);
    m(this, "lastSequence", 0);
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
      this.watcherProcess = W(t, ["watch-clipboard"]), this.watcherProcess.stdout.on("data", (e) => {
        const n = e.toString().split(`
`);
        for (const r of n)
          if (r.trim())
            try {
              const o = JSON.parse(r);
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
      const e = t.sequence, n = Date.now(), r = n - this.lastChangeTime, o = r > 10 && r < 500;
      if (console.log(`Clipboard Native Change: ${this.lastSequence} -> ${e}, diff: ${r}ms, rapid: ${o}`), o) {
        const s = U.readText();
        s && s.trim().length > 0 && this.triggerSmartTranslate(s);
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
    m(this, "path");
    m(this, "data");
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
const y = new te("settings.json"), k = w.dirname(I(import.meta.url));
process.env.APP_ROOT = w.join(k, "..");
const C = process.env.VITE_DEV_SERVER_URL, de = w.join(process.env.APP_ROOT, "dist-electron"), M = w.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = C ? w.join(process.env.APP_ROOT, "public") : M;
let l, P = null;
function oe() {
  if (!P)
    try {
      const i = "icon.png", t = w.join(process.env.VITE_PUBLIC, i);
      let e = _.createFromPath(t);
      e.isEmpty() && (console.warn(`Icon ${i} is empty or missing. Using fallback.`), e = _.createFromDataURL("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAB5JREFUOE9jZGBg+M+AAxjhP4phNAPQaBj1AAqDMAQA711W5dMc3tMAAAAASUVORK5CYII=")), P = new V(e), P.setToolTip("Nexus Translate"), (() => {
        const r = z.buildFromTemplate([
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
        P == null || P.setContextMenu(r);
      })(), P.on("click", () => {
        l && (l.isVisible() ? (l.isMinimized() && l.restore(), l.focus()) : (l.show(), l.focus()));
      });
    } catch (i) {
      console.error("Failed to create tray:", i);
    }
}
function F() {
  const i = w.join(process.env.VITE_PUBLIC, "icon.png");
  l = new x({
    title: "Nexus Translate",
    width: 1e3,
    height: 700,
    icon: i,
    autoHideMenuBar: !0,
    // Hide menu bar (File, Edit, etc.)
    webPreferences: {
      preload: w.join(k, "preload.mjs"),
      contextIsolation: !0,
      // Explicitly enable context isolation
      nodeIntegration: !1
      // Ensure node integration is off
    }
  }), D.init(l), ee.init(l), E.init(), l.on("close", (t) => {
    if (d.isQuitting)
      return;
    const e = y.get("closeBehavior", "ask");
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
  }), C ? l.loadURL(C) : l.loadFile(w.join(M, "index.html"));
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
  const i = x.getAllWindows();
  i.length === 0 ? F() : i.forEach((t) => {
    t.isVisible() || t.show(), t.isMinimized() && t.restore(), t.focus();
  });
});
d.whenReady().then(() => {
  if (d.isPackaged) {
    const i = y.get("launchAtLogin", !1);
    d.setLoginItemSettings({
      openAtLogin: i,
      path: d.getPath("exe")
    });
  }
  if (oe(), F(), process.platform === "darwin") {
    const i = w.join(process.env.VITE_PUBLIC, "icon.png"), t = _.createFromPath(i);
    d.dock.setIcon(t);
  }
  L.register("Alt+Space", () => {
    D.startCapture();
  });
});
A.handle("ocr-request", async (i, t) => {
  try {
    return await j.performOCR(t);
  } catch (e) {
    return console.error("OCR Error:", e), { text: `Error: ${e.message}`, confidence: 0 };
  }
});
A.handle("translate-request", async (i, t, e) => {
  try {
    return e.engine === "offline" ? { text: (await E.translate(t, e.source, e.target)).text, engine: "offline" } : await Y.translate(t, e);
  } catch (n) {
    return console.error("Translation Error:", n), { text: `Error: ${n.message}`, engine: e.engine };
  }
});
A.handle("get-settings", () => y.getAll());
A.handle("set-setting", (i, t, e) => {
  y.set(t, e), t === "launchAtLogin" && d.isPackaged && d.setLoginItemSettings({
    openAtLogin: e,
    path: d.getPath("exe")
  });
});
A.on("confirm-close-action", (i, t) => {
  const e = x.getFocusedWindow();
  t === "quit" ? (d.isQuitting = !0, d.quit()) : e == null || e.hide();
});
A.on("window-minimize", () => {
  const i = x.getFocusedWindow();
  i == null || i.minimize();
});
A.on("window-maximize", () => {
  const i = x.getFocusedWindow();
  i != null && i.isMaximized() ? i.unmaximize() : i == null || i.maximize();
});
A.on("window-close", () => {
  const i = x.getFocusedWindow();
  i == null || i.close();
});
export {
  de as MAIN_DIST,
  M as RENDERER_DIST,
  C as VITE_DEV_SERVER_URL
};
