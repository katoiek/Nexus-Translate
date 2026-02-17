var U = Object.defineProperty;
var V = (r, t, e) => t in r ? U(r, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : r[t] = e;
var x = (r, t, e) => V(r, typeof t != "symbol" ? t + "" : t, e);
import { app as l, ipcMain as f, screen as _, BrowserWindow as C, desktopCapturer as z, clipboard as G, globalShortcut as j, nativeImage as O, Tray as B, Menu as J } from "electron";
import m from "node:path";
import { fileURLToPath as M } from "node:url";
import { execFile as Q, spawn as Y } from "child_process";
import S from "path";
import E from "fs";
class H {
  getNativePath(t) {
    const e = l.isPackaged;
    return t === "darwin" ? e ? S.join(process.resourcesPath, "native/mac/main") : S.join(process.cwd(), "native/mac/main") : t === "win32" ? e ? S.join(process.resourcesPath, "native/win/NexusNative.exe") : S.join(process.cwd(), "native/win/bin/Release/net8.0-windows10.0.19041.0/win-x64/publish/NexusNative.exe") : null;
  }
  async performOCR(t) {
    return new Promise((e, o) => {
      const s = this.getNativePath(process.platform);
      if (!s)
        return o(new Error(`Platform ${process.platform} not supported or native binary missing`));
      if (!E.existsSync(s) && !l.isPackaged)
        return console.warn(`Native binary not found at ${s}`), process.env.NODE_ENV === "development" ? (console.log("Returning mock OCR result"), e({ text: "Mock OCR Text: Japanese text would go here.", confidence: 0.99 })) : o(new Error(`Native binary not found at ${s}`));
      Q(s, ["ocr", t], (n, i, u) => {
        if (n)
          return console.error("OCR Process Error:", n), console.error("Stderr:", u), o(n);
        try {
          const h = JSON.parse(i.trim());
          e(h);
        } catch {
          console.error("Failed to parse OCR output:", i), o(new Error("Invalid output structure from native sidecar"));
        }
      });
    });
  }
}
const k = new H();
class X {
  async translate(t, e) {
    const { engine: o, source: s, target: n, apiKeys: i } = e;
    try {
      if (o === "google-free")
        return await this.translateGoogleFree(t, s, n);
      if (o.startsWith("llm"))
        return await this.translateLLM(t, s, n, o, i);
      if (o === "native")
        return await this.translateGoogleFree(t, s, n);
      throw new Error(`Unsupported engine: ${o}`);
    } catch (u) {
      throw console.error("Translation Error:", u), u;
    }
  }
  async translateGoogleFree(t, e, o) {
    const s = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${e}&tl=${o}&dt=t&q=${encodeURIComponent(t)}`, n = await fetch(s);
    if (!n.ok)
      throw new Error(`Google Translate failed: ${n.statusText}`);
    return {
      text: (await n.json())[0].map((h) => h[0]).join(""),
      engine: "google-free"
    };
  }
  async translateLLM(t, e, o, s, n) {
    if (s === "llm-openai" && (n != null && n.openai))
      return await this.translateOpenAI(t, e, o, n.openai);
    if (s === "llm-anthropic" && (n != null && n.anthropic))
      return await this.translateAnthropic(t, e, o, n.anthropic);
    if (s === "llm-gemini" && (n != null && n.gemini))
      return await this.translateGemini(t, e, o, n.gemini);
    if (n != null && n.openai)
      return await this.translateOpenAI(t, e, o, n.openai);
    if (n != null && n.anthropic)
      return await this.translateAnthropic(t, e, o, n.anthropic);
    if (n != null && n.gemini)
      return await this.translateGemini(t, e, o, n.gemini);
    throw new Error(`No API Key configured for ${s}. Please check Settings.`);
  }
  async translateOpenAI(t, e, o, s) {
    var u, h, A, d;
    const n = [
      "gpt-4o",
      "gpt-4-turbo",
      "gpt-3.5-turbo"
    ];
    let i;
    for (const c of n)
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
                content: `You are a professional translator. Translate the following text from ${e === "auto" ? "auto-detected language" : e} to ${o}. Output ONLY the translated text. Do not provide explanations, notes, or alternative translations.`
              },
              {
                role: "user",
                content: t
              }
            ]
          })
        });
        if (!g.ok) {
          const w = await g.json();
          console.error(`OpenAI API Error (${c}):`, JSON.stringify(w, null, 2)), i = w;
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
  async translateAnthropic(t, e, o, s) {
    var u, h, A;
    const n = [
      "claude-3-5-sonnet-20240620",
      "claude-3-opus-20240229",
      "claude-3-sonnet-20240229",
      "claude-3-haiku-20240307"
    ];
    let i;
    for (const d of n)
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
            system: `You are a high-performance translation engine. Translate the provided text to ${o}. Output ONLY the translated result. Do not output the language name, character count, or any introductory phrases like "Here is the translation". Return strictly the translation.`,
            messages: [
              { role: "user", content: t }
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
  async translateGemini(t, e, o, s) {
    var u, h, A, d, c, g;
    const n = [
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      // Fallback for better rate limits
      "gemini-2.5-flash",
      // Try newer model
      "gemini-flash-latest"
    ];
    let i;
    for (const v of n)
      try {
        console.log(`Attempting Gemini translation with model: ${v}`);
        const p = `https://generativelanguage.googleapis.com/v1beta/models/${v}:generateContent?key=${s}`, w = await fetch(p, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `You are a professional translator. Translate the following text to ${o}. Output ONLY the translated text. Do not provide explanations, notes, or alternative translations.

Text: ${t}`
              }]
            }]
          })
        });
        if (!w.ok) {
          const W = await w.json();
          console.error(`Gemini API Error (${v}):`, JSON.stringify(W, null, 2)), i = W, w.status === 404 && v === n[0] && this.logAvailableGeminiModels(s).catch(console.error);
          continue;
        }
        const T = (c = (d = (A = (h = (u = (await w.json()).candidates) == null ? void 0 : u[0]) == null ? void 0 : h.content) == null ? void 0 : A.parts) == null ? void 0 : d[0]) == null ? void 0 : c.text;
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
  async logAvailableGeminiModels(t) {
    try {
      console.log("Fetching available Gemini models...");
      const o = await (await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${t}`)).json();
      o.models ? console.log("Available Gemini Models:", o.models.map((s) => s.name)) : console.log("Failed to list models:", o);
    } catch (e) {
      console.error("Error listing models:", e);
    }
  }
}
const Z = new X(), K = m.dirname(M(import.meta.url));
class ee {
  constructor() {
    x(this, "captureWindows", []);
    x(this, "mainWindow", null);
  }
  init(t) {
    this.mainWindow = t, f.on("start-capture", () => this.startCapture()), f.on("capture-complete", (e, o) => this.handleCaptureComplete(e, o)), f.on("cancel-capture", () => this.closeCaptureWindows()), f.on("close-capture-window", () => this.closeCaptureWindows());
  }
  startCapture() {
    if (this.captureWindows.length > 0) return;
    _.getAllDisplays().forEach((e) => {
      const o = new C({
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
          preload: m.join(K, "preload.mjs"),
          // Fixed path
          nodeIntegration: !1,
          contextIsolation: !0
        }
      }), s = process.env.VITE_DEV_SERVER_URL;
      if (s)
        o.loadURL(`${s}?mode=screenshot&displayId=${e.id}`);
      else {
        const n = m.join(process.env.APP_ROOT || "", "dist");
        o.loadFile(m.join(n, "index.html"), { search: `mode=screenshot&displayId=${e.id}` });
      }
      o.on("closed", () => {
        this.captureWindows = this.captureWindows.filter((n) => n !== o);
      }), o.displayId = e.id, this.captureWindows.push(o);
    });
  }
  closeCaptureWindows() {
    var t, e;
    this.captureWindows.forEach((o) => o.close()), this.captureWindows = [], (t = this.mainWindow) == null || t.show(), (e = this.mainWindow) == null || e.focus();
  }
  async handleCaptureComplete(t, e) {
    var o, s, n, i, u;
    this.captureWindows.forEach((h) => h.hide());
    try {
      const h = C.fromWebContents(t.sender), A = h == null ? void 0 : h.displayId;
      if (!A)
        throw new Error("Could not identify display for capture");
      const d = _.getAllDisplays().find((b) => b.id === A);
      if (!d)
        throw new Error("Display not found");
      const c = d.scaleFactor, g = await z.getSources({
        types: ["screen"],
        thumbnailSize: {
          width: d.size.width * c,
          height: d.size.height * c
        }
      }), p = g.find((b) => b.display_id === d.id.toString()) || g.find((b) => b.id === `screen:${d.id}`) || g[0];
      if (!p) throw new Error("No screen source found for display");
      let w = p.thumbnail.crop({
        x: Math.round(e.x * c),
        y: Math.round(e.y * c),
        width: Math.round(e.width * c),
        height: Math.round(e.height * c)
      });
      const P = w.getSize();
      if (P.height < 100 || P.width < 100) {
        const b = Math.max(100 / P.height, 100 / P.width, 2), I = Math.round(P.width * b), R = Math.round(P.height * b);
        w = w.resize({ width: I, height: R, quality: "best" }), console.log(`Upscaled OCR image from ${P.width}x${P.height} to ${I}x${R}`);
      }
      const T = m.join(l.getPath("temp"), `nexus_ocr_${Date.now()}.png`);
      E.writeFileSync(T, w.toPNG()), this.closeCaptureWindows();
      const W = await k.performOCR(T);
      E.unlinkSync(T), (o = this.mainWindow) == null || o.webContents.send("ocr-result", W), (s = this.mainWindow) == null || s.show(), (n = this.mainWindow) == null || n.focus();
    } catch (h) {
      console.error("Screenshot processing failed:", h), this.closeCaptureWindows(), (i = this.mainWindow) == null || i.webContents.send("ocr-result", { text: `Error: ${h}` }), (u = this.mainWindow) == null || u.show();
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
  init(t) {
    console.log("ClipboardWatcher: Initializing Native Approach..."), this.mainWindow = t, this.startNativeWatcher();
  }
  getNativePath() {
    const t = l.isPackaged;
    return process.platform === "darwin" ? t ? S.join(process.resourcesPath, "native/mac/main") : S.join(process.cwd(), "native/mac/main") : process.platform === "win32" ? t ? S.join(process.resourcesPath, "native/win/NexusNative.exe") : S.join(process.cwd(), "native/win/bin/Release/net8.0-windows10.0.19041.0/win-x64/publish/NexusNative.exe") : "";
  }
  startNativeWatcher() {
    const t = this.getNativePath();
    if (!t) {
      console.error(`ClipboardWatcher: Native path not found for platform ${process.platform}`);
      return;
    }
    console.log(`ClipboardWatcher: Spawning ${t} watch-clipboard`);
    try {
      this.watcherProcess = Y(t, ["watch-clipboard"]), this.watcherProcess.stdout.on("data", (e) => {
        const o = e.toString().split(`
`);
        for (const s of o)
          if (s.trim())
            try {
              const n = JSON.parse(s);
              this.handleNativeMessage(n);
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
      const e = t.sequence, o = Date.now(), s = o - this.lastChangeTime;
      if (console.log(`Clipboard Native Change: ${this.lastSequence} -> ${e}, diff: ${s}ms`), s < 1e3) {
        const n = G.readText();
        console.log(`Double copy detected! Text length: ${n.length}`), n && n.trim().length > 0 && this.triggerSmartTranslate(n);
      }
      this.lastSequence = e, this.lastChangeTime = o;
    }
  }
  triggerSmartTranslate(t) {
    !this.mainWindow || this.mainWindow.isDestroyed() || (console.log("Smart Translate Triggered via Ctrl+C+C"), this.mainWindow.isMinimized() && this.mainWindow.restore(), this.mainWindow.isVisible() || this.mainWindow.show(), this.mainWindow.focus(), this.mainWindow.webContents.send("smart-translate", t));
  }
  stop() {
    this.watcherProcess && (this.watcherProcess.kill(), this.watcherProcess = null);
  }
}
const ne = new te();
class oe {
  constructor(t) {
    x(this, "path");
    x(this, "data");
    const e = l.getPath("userData");
    this.path = S.join(e, t), this.data = re(this.path, {});
  }
  get(t, e) {
    return this.data[t] !== void 0 ? this.data[t] : e;
  }
  set(t, e) {
    this.data[t] = e, E.writeFileSync(this.path, JSON.stringify(this.data));
  }
  getAll() {
    return this.data;
  }
}
function re(r, t) {
  try {
    return JSON.parse(E.readFileSync(r).toString());
  } catch {
    return t;
  }
}
const N = new oe("settings.json"), L = m.dirname(M(import.meta.url));
process.env.APP_ROOT = m.join(L, "..");
const y = process.env.VITE_DEV_SERVER_URL, pe = m.join(process.env.APP_ROOT, "dist-electron"), F = m.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = y ? m.join(process.env.APP_ROOT, "public") : F;
let a, $ = null;
function se() {
  if (!$)
    try {
      const r = "icon.png", t = m.join(process.env.VITE_PUBLIC, r);
      let e = O.createFromPath(t);
      e.isEmpty() && (console.warn(`Icon ${r} is empty or missing. Using fallback.`), e = O.createFromDataURL("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAB5JREFUOE9jZGBg+M+AAxjhP4phNAPQaBj1AAqDMAQA711W5dMc3tMAAAAASUVORK5CYII=")), $ = new B(e), $.setToolTip("Nexus Translate"), (() => {
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
function q() {
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
  }), D.init(a), ne.init(a), a.on("close", (t) => {
    if (l.isQuitting)
      return;
    const e = N.get("closeBehavior", "ask");
    if (e !== "quit") {
      if (e === "minimize") {
        t.preventDefault(), a == null || a.hide();
        return;
      } else if (e === "ask") {
        t.preventDefault(), a == null || a.webContents.send("show-close-confirmation"), a == null || a.show(), a == null || a.focus();
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
  C.getAllWindows().length === 0 && q();
});
l.whenReady().then(() => {
  const r = N.get("launchAtLogin", !1);
  if (l.setLoginItemSettings({
    openAtLogin: r,
    path: l.getPath("exe")
  }), se(), q(), process.platform === "darwin") {
    const t = m.join(process.env.VITE_PUBLIC, "icon.png"), e = O.createFromPath(t);
    l.dock.setIcon(e);
  }
  j.register("Alt+Space", () => {
    D.startCapture();
  });
});
f.handle("ocr-request", async (r, t) => {
  try {
    return await k.performOCR(t);
  } catch (e) {
    return console.error("OCR Error:", e), { text: `Error: ${e.message}`, confidence: 0 };
  }
});
f.handle("translate-request", async (r, t, e) => {
  try {
    return await Z.translate(t, e);
  } catch (o) {
    return console.error("Translation Error:", o), { text: `Error: ${o.message}`, engine: e.engine };
  }
});
f.handle("get-settings", () => N.getAll());
f.handle("set-setting", (r, t, e) => {
  N.set(t, e), t === "launchAtLogin" && l.setLoginItemSettings({
    openAtLogin: e,
    path: l.getPath("exe")
  });
});
f.on("confirm-close-action", (r, t) => {
  const e = C.getFocusedWindow();
  t === "quit" ? (l.isQuitting = !0, l.quit()) : e == null || e.hide();
});
f.on("window-minimize", () => {
  const r = C.getFocusedWindow();
  r == null || r.minimize();
});
f.on("window-maximize", () => {
  const r = C.getFocusedWindow();
  r != null && r.isMaximized() ? r.unmaximize() : r == null || r.maximize();
});
f.on("window-close", () => {
  const r = C.getFocusedWindow();
  r == null || r.close();
});
export {
  pe as MAIN_DIST,
  F as RENDERER_DIST,
  y as VITE_DEV_SERVER_URL
};
