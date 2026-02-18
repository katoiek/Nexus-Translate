var L = Object.defineProperty;
var F = (r, e, t) => e in r ? L(r, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : r[e] = t;
var P = (r, e, t) => F(r, typeof e != "symbol" ? e + "" : e, t);
import { app as c, ipcMain as w, screen as I, BrowserWindow as S, clipboard as q, globalShortcut as R, nativeImage as W, Tray as V, Menu as U } from "electron";
import g from "node:path";
import { fileURLToPath as y } from "node:url";
import { execFile as G, spawn as B } from "child_process";
import b from "path";
import N from "fs";
class J {
  getNativePath(e) {
    const t = c.isPackaged;
    return e === "darwin" ? t ? b.join(process.resourcesPath, "native/mac/main") : b.join(process.cwd(), "native/mac/main") : e === "win32" ? t ? b.join(process.resourcesPath, "native/win/NexusNative.exe") : b.join(process.cwd(), "native/win/bin/Release/net8.0-windows10.0.19041.0/win-x64/publish/NexusNative.exe") : null;
  }
  async performOCR(e) {
    return this.runNativeCommand(["ocr", e]);
  }
  async performCaptureAndOCR(e, t, o, s) {
    const n = ["capture", e.toString(), t.toString(), o.toString(), s.toString()];
    return this.runNativeCommand(n);
  }
  async runNativeCommand(e) {
    return new Promise((t, o) => {
      const s = this.getNativePath(process.platform);
      if (!s)
        return o(new Error(`Platform ${process.platform} not supported or native binary missing`));
      if (!N.existsSync(s) && !c.isPackaged)
        return console.warn(`Native binary not found at ${s}`), process.env.NODE_ENV === "development" ? (console.log("Returning mock OCR result"), t({ text: "Mock OCR Text: Japanese text would go here.", confidence: 0.99 })) : o(new Error(`Native binary not found at ${s}`));
      G(s, e, (n, i, d) => {
        if (n)
          return console.error("Native Process Error:", n), i && console.error("Stdout:", i), d && console.error("Stderr:", d), o(new Error(`Command failed: ${s} ${e.join(" ")}
Output: ${i || ""}
Error: ${d || ""}`));
        try {
          const h = JSON.parse(i.trim());
          t(h);
        } catch {
          console.error("Failed to parse Native output:", i), o(new Error("Invalid output structure from native sidecar"));
        }
      });
    });
  }
}
const j = new J();
class z {
  async translate(e, t) {
    const { engine: o, source: s, target: n, apiKeys: i } = t;
    try {
      if (o === "google-free")
        return await this.translateGoogleFree(e, s, n);
      if (o.startsWith("llm"))
        return await this.translateLLM(e, s, n, o, i);
      if (o === "native")
        return await this.translateGoogleFree(e, s, n);
      throw new Error(`Unsupported engine: ${o}`);
    } catch (d) {
      throw console.error("Translation Error:", d), d;
    }
  }
  async translateGoogleFree(e, t, o) {
    const s = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${t}&tl=${o}&dt=t&q=${encodeURIComponent(e)}`, n = await fetch(s);
    if (!n.ok)
      throw new Error(`Google Translate failed: ${n.statusText}`);
    return {
      text: (await n.json())[0].map((h) => h[0]).join(""),
      engine: "google-free"
    };
  }
  async translateLLM(e, t, o, s, n) {
    if (s === "llm-openai" && (n != null && n.openai))
      return await this.translateOpenAI(e, t, o, n.openai);
    if (s === "llm-anthropic" && (n != null && n.anthropic))
      return await this.translateAnthropic(e, t, o, n.anthropic);
    if (s === "llm-gemini" && (n != null && n.gemini))
      return await this.translateGemini(e, t, o, n.gemini);
    if (n != null && n.openai)
      return await this.translateOpenAI(e, t, o, n.openai);
    if (n != null && n.anthropic)
      return await this.translateAnthropic(e, t, o, n.anthropic);
    if (n != null && n.gemini)
      return await this.translateGemini(e, t, o, n.gemini);
    throw new Error(`No API Key configured for ${s}. Please check Settings.`);
  }
  async translateOpenAI(e, t, o, s) {
    var d, h, p, l;
    const n = [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo"
    ];
    let i;
    for (const m of n)
      try {
        console.log(`Attempting OpenAI translation with model: ${m}`);
        const u = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${s}`
          },
          body: JSON.stringify({
            model: m,
            messages: [
              {
                role: "system",
                content: `You are a professional translator. Translate the following text from ${t === "auto" ? "auto-detected language" : t} to ${o}. Output ONLY the translated text. Do not provide explanations, notes, or alternative translations.`
              },
              {
                role: "user",
                content: e
              }
            ]
          })
        });
        if (!u.ok) {
          const v = await u.json();
          if (console.error(`OpenAI API Error (${m}):`, JSON.stringify(v, null, 2)), i = v, u.status === 429 || u.status === 401)
            break;
          continue;
        }
        const A = (p = (h = (d = (await u.json()).choices[0]) == null ? void 0 : d.message) == null ? void 0 : h.content) == null ? void 0 : p.trim();
        if (!A)
          throw new Error("No translation in response");
        return {
          text: A,
          engine: `llm-openai (${m})`
        };
      } catch (u) {
        console.error(`Attempt failed for ${m}:`, u), i = u;
      }
    throw new Error(`OpenAI API Error: ${((l = i == null ? void 0 : i.error) == null ? void 0 : l.message) || (i == null ? void 0 : i.message) || "All models failed"}`);
  }
  async translateAnthropic(e, t, o, s) {
    var d, h;
    const n = [
      "claude-3-5-haiku-20241022",
      "claude-3-5-sonnet-20240620",
      "claude-3-5-sonnet-20241022",
      "claude-3-opus-20240229"
    ];
    let i;
    for (const p of n)
      try {
        console.log(`Attempting Anthropic translation with model: ${p}`);
        const l = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": s,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: p,
            max_tokens: 1024,
            system: `You are a high-performance translation engine. Translate the provided text to ${o}. Output ONLY the translated result. Do not output the language name, character count, or any introductory phrases like "Here is the translation". Return strictly the translation.`,
            messages: [
              { role: "user", content: e }
            ]
          })
        });
        if (!l.ok) {
          const f = await l.json();
          if (console.error(`Anthropic API Error (${p}):`, JSON.stringify(f, null, 2)), i = f, l.status === 429 || l.status === 401)
            break;
          continue;
        }
        return {
          text: (d = (await l.json()).content[0]) == null ? void 0 : d.text,
          engine: `llm-anthropic (${p})`
        };
      } catch (l) {
        if (console.error(`Attempt failed for ${p}:`, l), i = l, l.message && l.message.includes("Anthropic Auth Error"))
          throw l;
      }
    throw new Error(`Anthropic API Error: ${((h = i == null ? void 0 : i.error) == null ? void 0 : h.message) || (i == null ? void 0 : i.message) || "Unknown error"}`);
  }
  async translateGemini(e, t, o, s) {
    var d, h, p, l, m, u;
    const n = [
      "gemini-flash-latest",
      "gemini-pro-latest",
      "gemini-2.0-flash-lite",
      "gemini-2.0-flash"
    ];
    let i;
    for (const f of n)
      try {
        console.log(`Attempting Gemini translation with model: ${f}`);
        const A = `https://generativelanguage.googleapis.com/v1beta/models/${f}:generateContent?key=${s}`, v = await fetch(A, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `You are a professional translator. Translate the following text to ${o}. Output ONLY the translated text. Do not provide explanations, notes, or alternative translations.

Text: ${e}`
              }]
            }]
          })
        });
        if (!v.ok) {
          const x = await v.json();
          console.error(`Gemini API Error (${f}):`, JSON.stringify(x, null, 2)), i = x, v.status === 404 && f === n[0] && this.logAvailableGeminiModels(s).catch(console.error);
          continue;
        }
        const C = (m = (l = (p = (h = (d = (await v.json()).candidates) == null ? void 0 : d[0]) == null ? void 0 : h.content) == null ? void 0 : p.parts) == null ? void 0 : l[0]) == null ? void 0 : m.text;
        if (!C)
          throw new Error("No translation in response");
        return {
          text: C,
          engine: `llm-gemini (${f})`
        };
      } catch (A) {
        console.error(`Attempt failed for ${f}:`, A), i = A;
      }
    throw new Error(`Gemini API Error: ${((u = i == null ? void 0 : i.error) == null ? void 0 : u.message) || (i == null ? void 0 : i.message) || "All models failed"}`);
  }
  async logAvailableGeminiModels(e) {
    try {
      console.log("Fetching available Gemini models...");
      const o = await (await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${e}`)).json();
      o.models ? console.log("Available Gemini Models:", o.models.map((s) => s.name)) : console.log("Failed to list models:", o);
    } catch (t) {
      console.error("Error listing models:", t);
    }
  }
}
const Q = new z(), Y = g.dirname(y(import.meta.url));
class H {
  constructor() {
    P(this, "captureWindows", []);
    P(this, "mainWindow", null);
  }
  init(e) {
    this.mainWindow = e, w.on("start-capture", () => this.startCapture()), w.on("capture-complete", (t, o) => this.handleCaptureComplete(t, o)), w.on("cancel-capture", () => this.closeCaptureWindows()), w.on("close-capture-window", () => this.closeCaptureWindows());
  }
  startCapture() {
    if (this.captureWindows.length > 0) return;
    I.getAllDisplays().forEach((t) => {
      const o = new S({
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
          preload: g.join(Y, "preload.mjs"),
          nodeIntegration: !1,
          contextIsolation: !0
        }
      }), s = process.env.VITE_DEV_SERVER_URL;
      if (s)
        o.loadURL(`${s}?mode=screenshot&displayId=${t.id}`);
      else {
        const n = g.join(process.env.APP_ROOT || "", "dist");
        o.loadFile(g.join(n, "index.html"), { search: `mode=screenshot&displayId=${t.id}` });
      }
      o.on("closed", () => {
        this.captureWindows = this.captureWindows.filter((n) => n !== o);
      }), o.displayId = t.id, this.captureWindows.push(o);
    });
  }
  closeCaptureWindows() {
    var e, t;
    this.captureWindows.forEach((o) => o.close()), this.captureWindows = [], (e = this.mainWindow) == null || e.show(), (t = this.mainWindow) == null || t.focus();
  }
  async handleCaptureComplete(e, t) {
    var o, s, n, i, d;
    this.captureWindows.forEach((h) => h.hide());
    try {
      const h = S.fromWebContents(e.sender), p = h == null ? void 0 : h.displayId;
      if (!p)
        throw new Error("Could not identify display for capture");
      this.logDebug(`Capture rect: ${JSON.stringify(t)}, DisplayID: ${p}`);
      const l = I.getAllDisplays().find((x) => x.id === p);
      if (!l)
        throw new Error(`Display not found for ID: ${p}`);
      const m = process.platform === "darwin", u = l.scaleFactor;
      this.logDebug(`Display found: ${l.id}, Scale: ${u}, Bounds: ${JSON.stringify(l.bounds)}`);
      const f = Math.round((l.bounds.x + t.x) * (m ? 1 : u)), A = Math.round((l.bounds.y + t.y) * (m ? 1 : u)), v = Math.round(t.width * (m ? 1 : u)), T = Math.round(t.height * (m ? 1 : u));
      this.logDebug(`Requesting Native Capture (${m ? "macOS/Points" : "Windows/Pixels"}): x=${f}, y=${A}, w=${v}, h=${T}`);
      const C = await j.performCaptureAndOCR(f, A, v, T);
      this.closeCaptureWindows(), (o = this.mainWindow) == null || o.webContents.send("ocr-result", C), (s = this.mainWindow) == null || s.show(), (n = this.mainWindow) == null || n.focus();
    } catch (h) {
      console.error("Screenshot processing failed:", h), this.logDebug(`ERROR: ${h}`), this.closeCaptureWindows(), (i = this.mainWindow) == null || i.webContents.send("ocr-result", { text: `Error: ${h}` }), (d = this.mainWindow) == null || d.show();
    }
  }
  logDebug(e) {
    try {
      const t = g.join(c.getPath("userData"), "screenshot_debug.log");
      N.appendFileSync(t, `[${(/* @__PURE__ */ new Date()).toISOString()}] ${e}
`);
    } catch (t) {
      console.error("Failed to write log:", t);
    }
  }
}
const D = new H();
class X {
  constructor() {
    P(this, "mainWindow", null);
    P(this, "watcherProcess", null);
    P(this, "lastChangeTime", 0);
    P(this, "lastSequence", 0);
  }
  init(e) {
    console.log("ClipboardWatcher: Initializing Native Approach..."), this.mainWindow = e, this.startNativeWatcher();
  }
  getNativePath() {
    const e = c.isPackaged;
    return process.platform === "darwin" ? e ? b.join(process.resourcesPath, "native/mac/main") : b.join(process.cwd(), "native/mac/main") : process.platform === "win32" ? e ? b.join(process.resourcesPath, "native/win/NexusNative.exe") : b.join(process.cwd(), "native/win/bin/Release/net8.0-windows10.0.19041.0/win-x64/publish/NexusNative.exe") : "";
  }
  startNativeWatcher() {
    const e = this.getNativePath();
    if (!e) {
      console.error(`ClipboardWatcher: Native path not found for platform ${process.platform}`);
      return;
    }
    console.log(`ClipboardWatcher: Spawning ${e} watch-clipboard`);
    try {
      this.watcherProcess = B(e, ["watch-clipboard"]), this.watcherProcess.stdout.on("data", (t) => {
        const o = t.toString().split(`
`);
        for (const s of o)
          if (s.trim())
            try {
              const n = JSON.parse(s);
              this.handleNativeMessage(n);
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
      const t = e.sequence, o = Date.now(), s = o - this.lastChangeTime, n = s < 1e3 || t - this.lastSequence > 1;
      if (console.log(`Clipboard Native Change: ${this.lastSequence} -> ${t}, diff: ${s}ms, rapid: ${n}`), n) {
        const i = q.readText();
        i && i.trim().length > 0 && this.triggerSmartTranslate(i);
      }
      this.lastSequence = t, this.lastChangeTime = o;
    }
  }
  triggerSmartTranslate(e) {
    !this.mainWindow || this.mainWindow.isDestroyed() || (console.log("Smart Translate Triggered via Ctrl+C+C"), this.mainWindow.isMinimized() && this.mainWindow.restore(), this.mainWindow.isVisible() || this.mainWindow.show(), this.mainWindow.focus(), this.mainWindow.webContents.send("smart-translate", e));
  }
  stop() {
    this.watcherProcess && (this.watcherProcess.kill(), this.watcherProcess = null);
  }
}
const Z = new X();
class K {
  constructor(e) {
    P(this, "path");
    P(this, "data");
    const t = c.getPath("userData");
    this.path = b.join(t, e), this.data = ee(this.path, {});
  }
  get(e, t) {
    return this.data[e] !== void 0 ? this.data[e] : t;
  }
  set(e, t) {
    this.data[e] = t, N.writeFileSync(this.path, JSON.stringify(this.data));
  }
  getAll() {
    return this.data;
  }
}
function ee(r, e) {
  try {
    return JSON.parse(N.readFileSync(r).toString());
  } catch {
    return e;
  }
}
const E = new K("settings.json"), _ = g.dirname(y(import.meta.url));
process.env.APP_ROOT = g.join(_, "..");
const O = process.env.VITE_DEV_SERVER_URL, le = g.join(process.env.APP_ROOT, "dist-electron"), k = g.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = O ? g.join(process.env.APP_ROOT, "public") : k;
let a, $ = null;
function te() {
  if (!$)
    try {
      const r = "icon.png", e = g.join(process.env.VITE_PUBLIC, r);
      let t = W.createFromPath(e);
      t.isEmpty() && (console.warn(`Icon ${r} is empty or missing. Using fallback.`), t = W.createFromDataURL("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAB5JREFUOE9jZGBg+M+AAxjhP4phNAPQaBj1AAqDMAQA711W5dMc3tMAAAAASUVORK5CYII=")), $ = new V(t), $.setToolTip("Nexus Translate"), (() => {
        const s = U.buildFromTemplate([
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
              c.isQuitting = !0, c.quit();
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
function M() {
  const r = g.join(process.env.VITE_PUBLIC, "icon.png");
  a = new S({
    title: "Nexus Translate",
    width: 1e3,
    height: 700,
    icon: r,
    autoHideMenuBar: !0,
    // Hide menu bar (File, Edit, etc.)
    webPreferences: {
      preload: g.join(_, "preload.mjs")
    }
  }), D.init(a), Z.init(a), a.on("close", (e) => {
    if (c.isQuitting)
      return;
    const t = E.get("closeBehavior", "ask");
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
  }), O ? a.loadURL(O) : a.loadFile(g.join(k, "index.html"));
}
c.isQuitting = !1;
c.on("before-quit", () => {
  c.isQuitting = !0;
});
c.on("window-all-closed", () => {
  process.platform !== "darwin" && (c.quit(), a = null);
});
c.on("will-quit", () => {
  R.unregisterAll();
});
c.on("activate", () => {
  const r = S.getAllWindows();
  r.length === 0 ? M() : r.forEach((e) => {
    e.isVisible() || e.show(), e.isMinimized() && e.restore(), e.focus();
  });
});
c.whenReady().then(() => {
  if (c.isPackaged) {
    const r = E.get("launchAtLogin", !1);
    c.setLoginItemSettings({
      openAtLogin: r,
      path: c.getPath("exe")
    });
  }
  if (te(), M(), process.platform === "darwin") {
    const r = g.join(process.env.VITE_PUBLIC, "icon.png"), e = W.createFromPath(r);
    c.dock.setIcon(e);
  }
  R.register("Alt+Space", () => {
    D.startCapture();
  });
});
w.handle("ocr-request", async (r, e) => {
  try {
    return await j.performOCR(e);
  } catch (t) {
    return console.error("OCR Error:", t), { text: `Error: ${t.message}`, confidence: 0 };
  }
});
w.handle("translate-request", async (r, e, t) => {
  try {
    return await Q.translate(e, t);
  } catch (o) {
    return console.error("Translation Error:", o), { text: `Error: ${o.message}`, engine: t.engine };
  }
});
w.handle("get-settings", () => E.getAll());
w.handle("set-setting", (r, e, t) => {
  E.set(e, t), e === "launchAtLogin" && c.isPackaged && c.setLoginItemSettings({
    openAtLogin: t,
    path: c.getPath("exe")
  });
});
w.on("confirm-close-action", (r, e) => {
  const t = S.getFocusedWindow();
  e === "quit" ? (c.isQuitting = !0, c.quit()) : t == null || t.hide();
});
w.on("window-minimize", () => {
  const r = S.getFocusedWindow();
  r == null || r.minimize();
});
w.on("window-maximize", () => {
  const r = S.getFocusedWindow();
  r != null && r.isMaximized() ? r.unmaximize() : r == null || r.maximize();
});
w.on("window-close", () => {
  const r = S.getFocusedWindow();
  r == null || r.close();
});
export {
  le as MAIN_DIST,
  k as RENDERER_DIST,
  O as VITE_DEV_SERVER_URL
};
