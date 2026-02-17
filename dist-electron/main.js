var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { app, ipcMain, screen, BrowserWindow, clipboard, globalShortcut, nativeImage, Tray, Menu } from "electron";
import path$1 from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "child_process";
import path from "path";
import fs from "fs";
class NativeService {
  getNativePath(platform) {
    const isPackaged = app.isPackaged;
    if (platform === "darwin") {
      if (isPackaged) {
        return path.join(process.resourcesPath, "native/mac/main");
      } else {
        return path.join(process.cwd(), "native/mac/main");
      }
    } else if (platform === "win32") {
      if (isPackaged) {
        return path.join(process.resourcesPath, "native/win/NexusNative.exe");
      } else {
        return path.join(process.cwd(), "native/win/bin/Release/net10.0-windows10.0.19041.0/win-x64/publish/NexusNative.exe");
      }
    }
    return null;
  }
  async performOCR(imagePath) {
    return this.runNativeCommand(["ocr", imagePath]);
  }
  async performCaptureAndOCR(x, y, width, height) {
    const args = ["capture", x.toString(), y.toString(), width.toString(), height.toString()];
    return this.runNativeCommand(args);
  }
  async runNativeCommand(args) {
    return new Promise((resolve, reject) => {
      const nativePath = this.getNativePath(process.platform);
      if (!nativePath) {
        return reject(new Error(`Platform ${process.platform} not supported or native binary missing`));
      }
      if (!fs.existsSync(nativePath) && !app.isPackaged) {
        console.warn(`Native binary not found at ${nativePath}`);
        if (process.env.NODE_ENV === "development") {
          console.log("Returning mock OCR result");
          return resolve({ text: "Mock OCR Text: Japanese text would go here.", confidence: 0.99 });
        }
        return reject(new Error(`Native binary not found at ${nativePath}`));
      }
      execFile(nativePath, args, (error, stdout, stderr) => {
        if (error) {
          console.error("Native Process Error:", error);
          console.error("Stderr:", stderr);
          return reject(error);
        }
        try {
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch (e) {
          console.error("Failed to parse Native output:", stdout);
          reject(new Error("Invalid output structure from native sidecar"));
        }
      });
    });
  }
}
const M = new H();
class X {
  async translate(e, t) {
    const { engine: n, source: s, target: o, apiKeys: i } = t;
    try {
      if (n === "google-free")
        return await this.translateGoogleFree(e, s, o);
      if (n.startsWith("llm"))
        return await this.translateLLM(e, s, o, n, i);
      if (n === "native")
        return await this.translateGoogleFree(e, s, o);
      throw new Error(`Unsupported engine: ${n}`);
    } catch (u) {
      throw console.error("Translation Error:", u), u;
    }
  }
  async translateGoogleFree(e, t, n) {
    const s = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${t}&tl=${n}&dt=t&q=${encodeURIComponent(e)}`, o = await fetch(s);
    if (!o.ok)
      throw new Error(`Google Translate failed: ${o.statusText}`);
    return {
      text: (await o.json())[0].map((h) => h[0]).join(""),
      engine: "google-free"
    };
  }
  async translateLLM(e, t, n, s, o) {
    if (s === "llm-openai" && (o != null && o.openai))
      return await this.translateOpenAI(e, t, n, o.openai);
    if (s === "llm-anthropic" && (o != null && o.anthropic))
      return await this.translateAnthropic(e, t, n, o.anthropic);
    if (s === "llm-gemini" && (o != null && o.gemini))
      return await this.translateGemini(e, t, n, o.gemini);
    if (o != null && o.openai)
      return await this.translateOpenAI(e, t, n, o.openai);
    if (o != null && o.anthropic)
      return await this.translateAnthropic(e, t, n, o.anthropic);
    if (o != null && o.gemini)
      return await this.translateGemini(e, t, n, o.gemini);
    throw new Error(`No API Key configured for ${s}. Please check Settings.`);
  }
  async translateOpenAI(e, t, n, s) {
    var u, h, A, d;
    const o = [
      "gpt-4o",
      "gpt-4-turbo",
      "gpt-3.5-turbo"
    ];
    let i;
    for (const c of o)
      try {
        console.log(`Attempting OpenAI translation with model: ${c}`);
        const g = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${s}`
          },
          body: JSON.stringify({
            model: c,
            messages: [
              {
                role: "system",
                content: `You are a professional translator. Translate the following text from ${t === "auto" ? "auto-detected language" : t} to ${n}. Output ONLY the translated text. Do not provide explanations, notes, or alternative translations.`
              },
              {
                role: "user",
                content: e
              }
            ]
          })
        });
        if (!g.ok) {
          const f = await g.json();
          console.error(`OpenAI API Error (${c}):`, JSON.stringify(f, null, 2)), i = f;
          continue;
        }
        const p = (A = (h = (u = (await g.json()).choices[0]) == null ? void 0 : u.message) == null ? void 0 : h.content) == null ? void 0 : A.trim();
        if (!p)
          throw new Error("No translation in response");
        return {
          text: p,
          engine: `llm-openai (${c})`
        };
      } catch (g) {
        console.error(`Attempt failed for ${c}:`, g), i = g;
      }
    throw new Error(`OpenAI API Error: ${((d = i == null ? void 0 : i.error) == null ? void 0 : d.message) || (i == null ? void 0 : i.message) || "All models failed"}`);
  }
  async translateAnthropic(e, t, n, s) {
    var u, h, A;
    const o = [
      "claude-3-5-sonnet-20240620",
      "claude-3-opus-20240229",
      "claude-3-sonnet-20240229",
      "claude-3-haiku-20240307"
    ];
    let i;
    for (const d of o)
      try {
        console.log(`Attempting Anthropic translation with model: ${d}`);
        const c = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": s,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: d,
            max_tokens: 1024,
            system: `You are a high-performance translation engine. Translate the provided text to ${n}. Output ONLY the translated result. Do not output the language name, character count, or any introductory phrases like "Here is the translation". Return strictly the translation.`,
            messages: [
              { role: "user", content: e }
            ]
          })
        });
        if (!c.ok) {
          const p = await c.json();
          if (console.error(`Anthropic API Error (${d}):`, JSON.stringify(p, null, 2)), i = p, ((u = p.error) == null ? void 0 : u.type) === "authentication_error")
            throw new Error(`Anthropic Auth Error: ${p.error.message}`);
          continue;
        }
        return {
          text: (h = (await c.json()).content[0]) == null ? void 0 : h.text,
          engine: `llm-anthropic (${d})`
        };
      } catch (c) {
        if (console.error(`Attempt failed for ${d}:`, c), i = c, c.message && c.message.includes("Anthropic Auth Error"))
          throw c;
      }
    throw new Error(`Anthropic API Error: ${((A = i == null ? void 0 : i.error) == null ? void 0 : A.message) || (i == null ? void 0 : i.message) || "Unknown error"}`);
  }
  async translateGemini(e, t, n, s) {
    var u, h, A, d, c, g;
    const o = [
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      // Fallback for better rate limits
      "gemini-2.5-flash",
      // Try newer model
      "gemini-flash-latest"
    ];
    let i;
    for (const v of o)
      try {
        console.log(`Attempting Gemini translation with model: ${v}`);
        const p = `https://generativelanguage.googleapis.com/v1beta/models/${v}:generateContent?key=${s}`, f = await fetch(p, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `You are a professional translator. Translate the following text to ${n}. Output ONLY the translated text. Do not provide explanations, notes, or alternative translations.

Text: ${e}`
              }]
            }]
          })
        });
        if (!f.ok) {
          const W = await f.json();
          console.error(`Gemini API Error (${v}):`, JSON.stringify(W, null, 2)), i = W, f.status === 404 && v === o[0] && this.logAvailableGeminiModels(s).catch(console.error);
          continue;
        }
        const T = (c = (d = (A = (h = (u = (await f.json()).candidates) == null ? void 0 : u[0]) == null ? void 0 : h.content) == null ? void 0 : A.parts) == null ? void 0 : d[0]) == null ? void 0 : c.text;
        if (!T)
          throw new Error("No translation in response");
        return {
          text: T,
          engine: `llm-gemini (${v})`
        };
      } catch (p) {
        console.error(`Attempt failed for ${v}:`, p), i = p;
      }
    throw new Error(`Gemini API Error: ${((g = i == null ? void 0 : i.error) == null ? void 0 : g.message) || (i == null ? void 0 : i.message) || "All models failed"}`);
  }
  async logAvailableGeminiModels(e) {
    try {
      console.log("Fetching available Gemini models...");
      const n = await (await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${e}`)).json();
      n.models ? console.log("Available Gemini Models:", n.models.map((s) => s.name)) : console.log("Failed to list models:", n);
    } catch (t) {
      console.error("Error listing models:", t);
    }
  }
}
const Z = new X(), K = m.dirname(k(import.meta.url));
class ee {
  constructor() {
    x(this, "captureWindows", []);
    x(this, "mainWindow", null);
  }
  init(e) {
    this.mainWindow = e, w.on("start-capture", () => this.startCapture()), w.on("capture-complete", (t, n) => this.handleCaptureComplete(t, n)), w.on("cancel-capture", () => this.closeCaptureWindows()), w.on("close-capture-window", () => this.closeCaptureWindows());
  }
  startCapture() {
    if (this.captureWindows.length > 0) return;
    _.getAllDisplays().forEach((t) => {
      const n = new C({
        x: t.bounds.x,
        y: t.bounds.y,
        width: t.bounds.width,
        height: t.bounds.height,
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
          preload: path$1.join(__dirname$2, "preload.mjs"),
          nodeIntegration: false,
          contextIsolation: true
        }
      }), s = process.env.VITE_DEV_SERVER_URL;
      if (s)
        n.loadURL(`${s}?mode=screenshot&displayId=${t.id}`);
      else {
        const o = m.join(process.env.APP_ROOT || "", "dist");
        n.loadFile(m.join(o, "index.html"), { search: `mode=screenshot&displayId=${t.id}` });
      }
      n.on("closed", () => {
        this.captureWindows = this.captureWindows.filter((o) => o !== n);
      }), n.displayId = t.id, this.captureWindows.push(n);
    });
  }
  closeCaptureWindows() {
    var e, t;
    this.captureWindows.forEach((n) => n.close()), this.captureWindows = [], (e = this.mainWindow) == null || e.show(), (t = this.mainWindow) == null || t.focus();
  }
  async handleCaptureComplete(e, t) {
    var n, s, o, i, u;
    this.captureWindows.forEach((h) => h.hide());
    try {
      const h = C.fromWebContents(e.sender), A = h == null ? void 0 : h.displayId;
      if (!A)
        throw new Error("Could not identify display for capture");
      }
      this.logDebug(`Capture rect: ${JSON.stringify(rect)}, DisplayID: ${displayId}`);
      const display = screen.getAllDisplays().find((d) => d.id === displayId);
      if (!display) {
        throw new Error(`Display not found for ID: ${displayId}`);
      }
      const scaleFactor = display.scaleFactor;
      this.logDebug(`Display found: ${display.id}, Scale: ${scaleFactor}, Bounds: ${JSON.stringify(display.bounds)}`);
      const absoluteX = Math.round((display.bounds.x + rect.x) * scaleFactor);
      const absoluteY = Math.round((display.bounds.y + rect.y) * scaleFactor);
      const width = Math.round(rect.width * scaleFactor);
      const height = Math.round(rect.height * scaleFactor);
      this.logDebug(`Requesting Native Capture: x=${absoluteX}, y=${absoluteY}, w=${width}, h=${height}`);
      const ocrResult = await nativeService.performCaptureAndOCR(absoluteX, absoluteY, width, height);
      this.closeCaptureWindows();
      (_a = this.mainWindow) == null ? void 0 : _a.webContents.send("ocr-result", ocrResult);
      (_b = this.mainWindow) == null ? void 0 : _b.show();
      (_c = this.mainWindow) == null ? void 0 : _c.focus();
    } catch (error) {
      console.error("Screenshot processing failed:", error);
      this.logDebug(`ERROR: ${error}`);
      this.closeCaptureWindows();
      (_d = this.mainWindow) == null ? void 0 : _d.webContents.send("ocr-result", { text: `Error: ${error}` });
      (_e = this.mainWindow) == null ? void 0 : _e.show();
    }
  }
  logDebug(message) {
    try {
      const logPath = path$1.join(app.getPath("userData"), "screenshot_debug.log");
      fs.appendFileSync(logPath, `[${(/* @__PURE__ */ new Date()).toISOString()}] ${message}
`);
    } catch (e) {
      console.error("Failed to write log:", e);
    }
  }
}
const D = new ee();
class te {
  constructor() {
    x(this, "mainWindow", null);
    x(this, "watcherProcess", null);
    x(this, "lastChangeTime", 0);
    x(this, "lastSequence", 0);
  }
  init(e) {
    console.log("ClipboardWatcher: Initializing Native Approach..."), this.mainWindow = e, this.startNativeWatcher();
  }
  getNativePath() {
    const e = l.isPackaged;
    return process.platform === "darwin" ? e ? S.join(process.resourcesPath, "native/mac/main") : S.join(process.cwd(), "native/mac/main") : process.platform === "win32" ? e ? S.join(process.resourcesPath, "native/win/NexusNative.exe") : S.join(process.cwd(), "native/win/bin/Release/net8.0-windows10.0.19041.0/win-x64/publish/NexusNative.exe") : "";
  }
  startNativeWatcher() {
    const e = this.getNativePath();
    if (!e) {
      console.error(`ClipboardWatcher: Native path not found for platform ${process.platform}`);
      return;
    }
    console.log(`ClipboardWatcher: Spawning ${e} watch-clipboard`);
    try {
      this.watcherProcess = Y(e, ["watch-clipboard"]), this.watcherProcess.stdout.on("data", (t) => {
        const n = t.toString().split(`
`);
        for (const s of n)
          if (s.trim())
            try {
              const o = JSON.parse(s);
              this.handleNativeMessage(o);
            } catch {
            }
      }), this.watcherProcess.stderr.on("data", (t) => {
        console.error(`ClipboardWatcher Native Error: ${t}`);
      }), this.watcherProcess.on("close", (t) => {
        console.log(`ClipboardWatcher process exited with code ${t}`), this.watcherProcess = null;
      });
    } catch (t) {
      console.error("ClipboardWatcher: Failed to spawn native process", t);
    }
  }
  handleNativeMessage(e) {
    if (e.type === "init")
      this.lastSequence = e.sequence, console.log(`ClipboardWatcher: Native Init Sequence ${this.lastSequence}`);
    else if (e.type === "change") {
      const t = e.sequence, n = Date.now(), s = n - this.lastChangeTime;
      if (console.log(`Clipboard Native Change: ${this.lastSequence} -> ${t}, diff: ${s}ms`), s < 1e3) {
        const o = G.readText();
        console.log(`Double copy detected! Text length: ${o.length}`), o && o.trim().length > 0 && this.triggerSmartTranslate(o);
      }
      this.lastSequence = t, this.lastChangeTime = n;
    }
  }
  triggerSmartTranslate(e) {
    !this.mainWindow || this.mainWindow.isDestroyed() || (console.log("Smart Translate Triggered via Ctrl+C+C"), this.mainWindow.isMinimized() && this.mainWindow.restore(), this.mainWindow.isVisible() || this.mainWindow.show(), this.mainWindow.focus(), this.mainWindow.webContents.send("smart-translate", e));
  }
  stop() {
    this.watcherProcess && (this.watcherProcess.kill(), this.watcherProcess = null);
  }
}
const oe = new te();
class ne {
  constructor(e) {
    x(this, "path");
    x(this, "data");
    const t = l.getPath("userData");
    this.path = S.join(t, e), this.data = re(this.path, {});
  }
  get(e, t) {
    return this.data[e] !== void 0 ? this.data[e] : t;
  }
  set(e, t) {
    this.data[e] = t, E.writeFileSync(this.path, JSON.stringify(this.data));
  }
  getAll() {
    return this.data;
  }
}
function re(r, e) {
  try {
    return JSON.parse(E.readFileSync(r).toString());
  } catch {
    return e;
  }
}
const N = new ne("settings.json"), L = m.dirname(k(import.meta.url));
process.env.APP_ROOT = m.join(L, "..");
const y = process.env.VITE_DEV_SERVER_URL, pe = m.join(process.env.APP_ROOT, "dist-electron"), F = m.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = y ? m.join(process.env.APP_ROOT, "public") : F;
let a, $ = null;
function se() {
  if (!$)
    try {
      const r = "icon.png", e = m.join(process.env.VITE_PUBLIC, r);
      let t = O.createFromPath(e);
      t.isEmpty() && (console.warn(`Icon ${r} is empty or missing. Using fallback.`), t = O.createFromDataURL("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAB5JREFUOE9jZGBg+M+AAxjhP4phNAPQaBj1AAqDMAQA711W5dMc3tMAAAAASUVORK5CYII=")), $ = new B(t), $.setToolTip("Nexus Translate"), (() => {
        const s = J.buildFromTemplate([
          {
            label: "Show App",
            click: () => {
              a && (a.show(), a.focus());
            }
          },
          { type: "separator" },
          {
            label: "Quit",
            click: () => {
              l.isQuitting = !0, l.quit();
            }
          }
        ]);
        $ == null || $.setContextMenu(s);
      })(), $.on("click", () => {
        a && (a.isVisible() ? (a.isMinimized() && a.restore(), a.focus()) : (a.show(), a.focus()));
      });
    } catch (r) {
      console.error("Failed to create tray:", r);
    }
}
function V() {
  const r = m.join(process.env.VITE_PUBLIC, "icon.png");
  a = new C({
    title: "Nexus Translate",
    width: 1e3,
    height: 700,
    icon: r,
    autoHideMenuBar: !0,
    // Hide menu bar (File, Edit, etc.)
    webPreferences: {
      preload: m.join(L, "preload.mjs")
    }
  }), D.init(a), oe.init(a), a.on("close", (e) => {
    if (l.isQuitting)
      return;
    const t = N.get("closeBehavior", "ask");
    if (t !== "quit") {
      if (t === "minimize") {
        e.preventDefault(), a == null || a.hide();
        return;
      } else if (t === "ask") {
        e.preventDefault(), a == null || a.webContents.send("show-close-confirmation"), a == null || a.show(), a == null || a.focus();
        return;
      }
    }
  }), a.webContents.on("did-finish-load", () => {
    a == null || a.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), y ? a.loadURL(y) : a.loadFile(m.join(F, "index.html"));
}
l.isQuitting = !1;
l.on("before-quit", () => {
  l.isQuitting = !0;
});
l.on("window-all-closed", () => {
  process.platform !== "darwin" && (l.quit(), a = null);
});
l.on("will-quit", () => {
  j.unregisterAll();
});
l.on("activate", () => {
  const r = C.getAllWindows();
  r.length === 0 ? V() : r.forEach((e) => {
    e.isVisible() || e.show(), e.isMinimized() && e.restore(), e.focus();
  });
});
l.whenReady().then(() => {
  if (l.isPackaged) {
    const r = N.get("launchAtLogin", !1);
    l.setLoginItemSettings({
      openAtLogin: r,
      path: l.getPath("exe")
    });
  }
  if (se(), V(), process.platform === "darwin") {
    const r = m.join(process.env.VITE_PUBLIC, "icon.png"), e = O.createFromPath(r);
    l.dock.setIcon(e);
  }
  j.register("Alt+Space", () => {
    D.startCapture();
  });
});
w.handle("ocr-request", async (r, e) => {
  try {
    return await M.performOCR(e);
  } catch (t) {
    return console.error("OCR Error:", t), { text: `Error: ${t.message}`, confidence: 0 };
  }
});
w.handle("translate-request", async (r, e, t) => {
  try {
    return await Z.translate(e, t);
  } catch (n) {
    return console.error("Translation Error:", n), { text: `Error: ${n.message}`, engine: t.engine };
  }
});
w.handle("get-settings", () => N.getAll());
w.handle("set-setting", (r, e, t) => {
  N.set(e, t), e === "launchAtLogin" && l.isPackaged && l.setLoginItemSettings({
    openAtLogin: t,
    path: l.getPath("exe")
  });
});
w.on("confirm-close-action", (r, e) => {
  const t = C.getFocusedWindow();
  e === "quit" ? (l.isQuitting = !0, l.quit()) : t == null || t.hide();
});
w.on("window-minimize", () => {
  const r = C.getFocusedWindow();
  r == null || r.minimize();
});
w.on("window-maximize", () => {
  const r = C.getFocusedWindow();
  r != null && r.isMaximized() ? r.unmaximize() : r == null || r.maximize();
});
w.on("window-close", () => {
  const r = C.getFocusedWindow();
  r == null || r.close();
});
export {
  pe as MAIN_DIST,
  F as RENDERER_DIST,
  y as VITE_DEV_SERVER_URL
};
