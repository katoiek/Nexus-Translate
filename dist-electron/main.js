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
        return path.join(process.cwd(), "native/win/bin/Release/net8.0-windows10.0.19041.0/win-x64/publish/NexusNative.exe");
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
          if (stdout) console.error("Stdout:", stdout);
          if (stderr) console.error("Stderr:", stderr);
          return reject(new Error(`Command failed: ${nativePath} ${args.join(" ")}
Output: ${stdout || ""}
Error: ${stderr || ""}`));
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
const nativeService = new NativeService();
class TranslationService {
  async translate(text, options) {
    const { engine, source, target, apiKeys } = options;
    try {
      if (engine === "google-free") {
        return await this.translateGoogleFree(text, source, target);
      }
      if (engine.startsWith("llm")) {
        return await this.translateLLM(text, source, target, engine, apiKeys);
      }
      if (engine === "native") {
        return await this.translateGoogleFree(text, source, target);
      }
      throw new Error(`Unsupported engine: ${engine}`);
    } catch (error) {
      console.error("Translation Error:", error);
      throw error;
    }
  }
  async translateGoogleFree(text, source, target) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google Translate failed: ${response.statusText}`);
    }
    const data = await response.json();
    const translatedText = data[0].map((segment) => segment[0]).join("");
    return {
      text: translatedText,
      engine: "google-free"
    };
  }
  async translateLLM(text, source, target, engineId, apiKeys) {
    if (engineId === "llm-openai" && (apiKeys == null ? void 0 : apiKeys.openai)) {
      return await this.translateOpenAI(text, source, target, apiKeys.openai);
    }
    if (engineId === "llm-anthropic" && (apiKeys == null ? void 0 : apiKeys.anthropic)) {
      return await this.translateAnthropic(text, source, target, apiKeys.anthropic);
    }
    if (engineId === "llm-gemini" && (apiKeys == null ? void 0 : apiKeys.gemini)) {
      return await this.translateGemini(text, source, target, apiKeys.gemini);
    }
    if (apiKeys == null ? void 0 : apiKeys.openai) {
      return await this.translateOpenAI(text, source, target, apiKeys.openai);
    } else if (apiKeys == null ? void 0 : apiKeys.anthropic) {
      return await this.translateAnthropic(text, source, target, apiKeys.anthropic);
    } else if (apiKeys == null ? void 0 : apiKeys.gemini) {
      return await this.translateGemini(text, source, target, apiKeys.gemini);
    }
    throw new Error(`No API Key configured for ${engineId}. Please check Settings.`);
  }
  async translateOpenAI(text, source, target, apiKey) {
    var _a, _b, _c, _d;
    const models = [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo"
    ];
    let lastError;
    for (const model of models) {
      try {
        console.log(`Attempting OpenAI translation with model: ${model}`);
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content: `You are a professional translator. Translate the following text from ${source === "auto" ? "auto-detected language" : source} to ${target}. Output ONLY the translated text. Do not provide explanations, notes, or alternative translations.`
              },
              {
                role: "user",
                content: text
              }
            ]
          })
        });
        if (!response.ok) {
          const err = await response.json();
          console.error(`OpenAI API Error (${model}):`, JSON.stringify(err, null, 2));
          lastError = err;
          if (response.status === 429 || response.status === 401) {
            break;
          }
          continue;
        }
        const data = await response.json();
        const translatedText = (_c = (_b = (_a = data.choices[0]) == null ? void 0 : _a.message) == null ? void 0 : _b.content) == null ? void 0 : _c.trim();
        if (!translatedText) {
          throw new Error("No translation in response");
        }
        return {
          text: translatedText,
          engine: `llm-openai (${model})`
        };
      } catch (error) {
        console.error(`Attempt failed for ${model}:`, error);
        lastError = error;
      }
    }
    throw new Error(`OpenAI API Error: ${((_d = lastError == null ? void 0 : lastError.error) == null ? void 0 : _d.message) || (lastError == null ? void 0 : lastError.message) || "All models failed"}`);
  }
  async translateAnthropic(text, _source, target, apiKey) {
    var _a, _b;
    const models = [
      "claude-3-5-haiku-20241022",
      "claude-3-5-sonnet-20240620",
      "claude-3-5-sonnet-20241022",
      "claude-3-opus-20240229"
    ];
    let lastError;
    for (const model of models) {
      try {
        console.log(`Attempting Anthropic translation with model: ${model}`);
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model,
            max_tokens: 1024,
            system: `You are a high-performance translation engine. Translate the provided text to ${target}. Output ONLY the translated result. Do not output the language name, character count, or any introductory phrases like "Here is the translation". Return strictly the translation.`,
            messages: [
              { role: "user", content: text }
            ]
          })
        });
        if (!response.ok) {
          const err = await response.json();
          console.error(`Anthropic API Error (${model}):`, JSON.stringify(err, null, 2));
          lastError = err;
          if (response.status === 429 || response.status === 401) {
            break;
          }
          continue;
        }
        const data = await response.json();
        const translatedText = (_a = data.content[0]) == null ? void 0 : _a.text;
        return {
          text: translatedText,
          engine: `llm-anthropic (${model})`
        };
      } catch (error) {
        console.error(`Attempt failed for ${model}:`, error);
        lastError = error;
        if (error.message && error.message.includes("Anthropic Auth Error")) {
          throw error;
        }
      }
    }
    throw new Error(`Anthropic API Error: ${((_b = lastError == null ? void 0 : lastError.error) == null ? void 0 : _b.message) || (lastError == null ? void 0 : lastError.message) || "Unknown error"}`);
  }
  async translateGemini(text, _source, target, apiKey) {
    var _a, _b, _c, _d, _e, _f;
    const models = [
      "gemini-flash-latest",
      "gemini-pro-latest",
      "gemini-2.0-flash-lite",
      "gemini-2.0-flash"
    ];
    let lastError;
    for (const model of models) {
      try {
        console.log(`Attempting Gemini translation with model: ${model}`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `You are a professional translator. Translate the following text to ${target}. Output ONLY the translated text. Do not provide explanations, notes, or alternative translations.

Text: ${text}`
              }]
            }]
          })
        });
        if (!response.ok) {
          const err = await response.json();
          console.error(`Gemini API Error (${model}):`, JSON.stringify(err, null, 2));
          lastError = err;
          if (response.status === 404 && model === models[0]) {
            this.logAvailableGeminiModels(apiKey).catch(console.error);
          }
          continue;
        }
        const data = await response.json();
        const translatedText = (_e = (_d = (_c = (_b = (_a = data.candidates) == null ? void 0 : _a[0]) == null ? void 0 : _b.content) == null ? void 0 : _c.parts) == null ? void 0 : _d[0]) == null ? void 0 : _e.text;
        if (!translatedText) {
          throw new Error("No translation in response");
        }
        return {
          text: translatedText,
          engine: `llm-gemini (${model})`
        };
      } catch (error) {
        console.error(`Attempt failed for ${model}:`, error);
        lastError = error;
      }
    }
    throw new Error(`Gemini API Error: ${((_f = lastError == null ? void 0 : lastError.error) == null ? void 0 : _f.message) || (lastError == null ? void 0 : lastError.message) || "All models failed"}`);
  }
  async logAvailableGeminiModels(apiKey) {
    try {
      console.log("Fetching available Gemini models...");
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const data = await response.json();
      if (data.models) {
        console.log("Available Gemini Models:", data.models.map((m) => m.name));
      } else {
        console.log("Failed to list models:", data);
      }
    } catch (e) {
      console.error("Error listing models:", e);
    }
  }
}
const translationService = new TranslationService();
const __dirname$2 = path$1.dirname(fileURLToPath(import.meta.url));
class ScreenshotService {
  constructor() {
    __publicField(this, "captureWindows", []);
    __publicField(this, "mainWindow", null);
  }
  init(mainWindow) {
    this.mainWindow = mainWindow;
    ipcMain.on("start-capture", () => this.startCapture());
    ipcMain.on("capture-complete", (event, rect) => this.handleCaptureComplete(event, rect));
    ipcMain.on("cancel-capture", () => this.closeCaptureWindows());
    ipcMain.on("close-capture-window", () => this.closeCaptureWindows());
  }
  startCapture() {
    if (this.captureWindows.length > 0) return;
    const displays = screen.getAllDisplays();
    displays.forEach((display) => {
      const window = new BrowserWindow({
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        movable: false,
        fullscreen: false,
        hasShadow: false,
        enableLargerThanScreen: true,
        webPreferences: {
          preload: path$1.join(__dirname$2, "preload.mjs"),
          nodeIntegration: false,
          contextIsolation: true
        }
      });
      const VITE_DEV_SERVER_URL2 = process.env["VITE_DEV_SERVER_URL"];
      if (VITE_DEV_SERVER_URL2) {
        window.loadURL(`${VITE_DEV_SERVER_URL2}?mode=screenshot&displayId=${display.id}`);
      } else {
        const rendererDist = path$1.join(process.env.APP_ROOT || "", "dist");
        window.loadFile(path$1.join(rendererDist, "index.html"), { search: `mode=screenshot&displayId=${display.id}` });
      }
      window.on("closed", () => {
        this.captureWindows = this.captureWindows.filter((w) => w !== window);
      });
      window.displayId = display.id;
      this.captureWindows.push(window);
    });
  }
  closeCaptureWindows() {
    var _a, _b;
    this.captureWindows.forEach((w) => w.close());
    this.captureWindows = [];
    (_a = this.mainWindow) == null ? void 0 : _a.show();
    (_b = this.mainWindow) == null ? void 0 : _b.focus();
  }
  async handleCaptureComplete(event, rect) {
    var _a, _b, _c, _d, _e;
    this.captureWindows.forEach((w) => w.hide());
    try {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      const displayId = senderWindow == null ? void 0 : senderWindow.displayId;
      if (!displayId) {
        throw new Error("Could not identify display for capture");
      }
      this.logDebug(`Capture rect: ${JSON.stringify(rect)}, DisplayID: ${displayId}`);
      const display = screen.getAllDisplays().find((d) => d.id === displayId);
      if (!display) {
        throw new Error(`Display not found for ID: ${displayId}`);
      }
      const isMac = process.platform === "darwin";
      const scaleFactor = display.scaleFactor;
      this.logDebug(`Display found: ${display.id}, Scale: ${scaleFactor}, Bounds: ${JSON.stringify(display.bounds)}`);
      const absoluteX = Math.round((display.bounds.x + rect.x) * (isMac ? 1 : scaleFactor));
      const absoluteY = Math.round((display.bounds.y + rect.y) * (isMac ? 1 : scaleFactor));
      const width = Math.round(rect.width * (isMac ? 1 : scaleFactor));
      const height = Math.round(rect.height * (isMac ? 1 : scaleFactor));
      this.logDebug(`Requesting Native Capture (${isMac ? "macOS/Points" : "Windows/Pixels"}): x=${absoluteX}, y=${absoluteY}, w=${width}, h=${height}`);
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
const screenshotService = new ScreenshotService();
class ClipboardWatcher {
  constructor() {
    __publicField(this, "mainWindow", null);
    __publicField(this, "watcherProcess", null);
    __publicField(this, "lastChangeTime", 0);
    __publicField(this, "lastSequence", 0);
  }
  init(window) {
    console.log("ClipboardWatcher: Initializing Native Approach...");
    this.mainWindow = window;
    this.startNativeWatcher();
  }
  getNativePath() {
    const isPackaged = app.isPackaged;
    if (process.platform === "darwin") {
      if (isPackaged) {
        return path.join(process.resourcesPath, "native/mac/main");
      } else {
        return path.join(process.cwd(), "native/mac/main");
      }
    }
    if (process.platform === "win32") {
      if (isPackaged) {
        return path.join(process.resourcesPath, "native/win/NexusNative.exe");
      } else {
        return path.join(process.cwd(), "native/win/bin/Release/net8.0-windows10.0.19041.0/win-x64/publish/NexusNative.exe");
      }
    }
    return "";
  }
  startNativeWatcher() {
    const nativePath = this.getNativePath();
    if (!nativePath) {
      console.error(`ClipboardWatcher: Native path not found for platform ${process.platform}`);
      return;
    }
    console.log(`ClipboardWatcher: Spawning ${nativePath} watch-clipboard`);
    try {
      this.watcherProcess = spawn(nativePath, ["watch-clipboard"]);
      this.watcherProcess.stdout.on("data", (data) => {
        const lines = data.toString().split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            this.handleNativeMessage(msg);
          } catch (e) {
          }
        }
      });
      this.watcherProcess.stderr.on("data", (data) => {
        console.error(`ClipboardWatcher Native Error: ${data}`);
      });
      this.watcherProcess.on("close", (code) => {
        console.log(`ClipboardWatcher process exited with code ${code}`);
        this.watcherProcess = null;
      });
    } catch (e) {
      console.error("ClipboardWatcher: Failed to spawn native process", e);
    }
  }
  handleNativeMessage(msg) {
    if (msg.type === "init") {
      this.lastSequence = msg.sequence;
      console.log(`ClipboardWatcher: Native Init Sequence ${this.lastSequence}`);
    } else if (msg.type === "change") {
      const currentSequence = msg.sequence;
      const now = Date.now();
      const timeDiff = now - this.lastChangeTime;
      const isRapid = timeDiff < 1e3 || currentSequence - this.lastSequence > 1;
      console.log(`Clipboard Native Change: ${this.lastSequence} -> ${currentSequence}, diff: ${timeDiff}ms, rapid: ${isRapid}`);
      if (isRapid) {
        const text = clipboard.readText();
        if (text && text.trim().length > 0) {
          this.triggerSmartTranslate(text);
        }
      }
      this.lastSequence = currentSequence;
      this.lastChangeTime = now;
    }
  }
  triggerSmartTranslate(text) {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    console.log("Smart Translate Triggered via Ctrl+C+C");
    if (this.mainWindow.isMinimized()) this.mainWindow.restore();
    if (!this.mainWindow.isVisible()) this.mainWindow.show();
    this.mainWindow.focus();
    this.mainWindow.webContents.send("smart-translate", text);
  }
  stop() {
    if (this.watcherProcess) {
      this.watcherProcess.kill();
      this.watcherProcess = null;
    }
  }
}
const clipboardWatcher = new ClipboardWatcher();
class Store {
  constructor(fileName) {
    __publicField(this, "path");
    __publicField(this, "data");
    const userDataPath = app.getPath("userData");
    this.path = path.join(userDataPath, fileName);
    this.data = parseDataFile(this.path, {});
  }
  get(key, defaultValue) {
    return this.data[key] !== void 0 ? this.data[key] : defaultValue;
  }
  set(key, val) {
    this.data[key] = val;
    fs.writeFileSync(this.path, JSON.stringify(this.data));
  }
  getAll() {
    return this.data;
  }
}
function parseDataFile(filePath, defaults) {
  try {
    return JSON.parse(fs.readFileSync(filePath).toString());
  } catch (error) {
    return defaults;
  }
}
const settingsStore = new Store("settings.json");
const __dirname$1 = path$1.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path$1.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path$1.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path$1.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path$1.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
let tray = null;
function createTray() {
  if (tray) return;
  try {
    const iconName = "icon.png";
    const iconPath = path$1.join(process.env.VITE_PUBLIC, iconName);
    let icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      console.warn(`Icon ${iconName} is empty or missing. Using fallback.`);
      icon = nativeImage.createFromDataURL("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAB5JREFUOE9jZGBg+M+AAxjhP4phNAPQaBj1AAqDMAQA711W5dMc3tMAAAAASUVORK5CYII=");
    }
    tray = new Tray(icon);
    tray.setToolTip("Nexus Translate");
    const updateContextMenu = () => {
      const contextMenu = Menu.buildFromTemplate([
        {
          label: "Show App",
          click: () => {
            if (win) {
              win.show();
              win.focus();
            }
          }
        },
        { type: "separator" },
        {
          label: "Quit",
          click: () => {
            app.isQuitting = true;
            app.quit();
          }
        }
      ]);
      tray == null ? void 0 : tray.setContextMenu(contextMenu);
    };
    updateContextMenu();
    tray.on("click", () => {
      if (win) {
        if (win.isVisible()) {
          if (win.isMinimized()) win.restore();
          win.focus();
        } else {
          win.show();
          win.focus();
        }
      }
    });
  } catch (error) {
    console.error("Failed to create tray:", error);
  }
}
function createWindow() {
  const iconPath = path$1.join(process.env.VITE_PUBLIC, "icon.png");
  win = new BrowserWindow({
    title: "Nexus Translate",
    width: 1e3,
    height: 700,
    icon: iconPath,
    autoHideMenuBar: true,
    // Hide menu bar (File, Edit, etc.)
    webPreferences: {
      preload: path$1.join(__dirname$1, "preload.mjs")
    }
  });
  screenshotService.init(win);
  clipboardWatcher.init(win);
  win.on("close", (event) => {
    if (app.isQuitting) {
      return;
    }
    const closeBehavior = settingsStore.get("closeBehavior", "ask");
    if (closeBehavior === "quit") ;
    else if (closeBehavior === "minimize") {
      event.preventDefault();
      win == null ? void 0 : win.hide();
      return;
    } else if (closeBehavior === "ask") {
      event.preventDefault();
      win == null ? void 0 : win.webContents.send("show-close-confirmation");
      win == null ? void 0 : win.show();
      win == null ? void 0 : win.focus();
      return;
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path$1.join(RENDERER_DIST, "index.html"));
  }
}
app.isQuitting = false;
app.on("before-quit", () => {
  app.isQuitting = true;
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length === 0) {
    createWindow();
  } else {
    allWindows.forEach((win2) => {
      if (!win2.isVisible()) win2.show();
      if (win2.isMinimized()) win2.restore();
      win2.focus();
    });
  }
});
app.whenReady().then(() => {
  if (app.isPackaged) {
    const launchAtLogin = settingsStore.get("launchAtLogin", false);
    app.setLoginItemSettings({
      openAtLogin: launchAtLogin,
      path: app.getPath("exe")
    });
  }
  createTray();
  createWindow();
  if (process.platform === "darwin") {
    const iconPath = path$1.join(process.env.VITE_PUBLIC, "icon.png");
    const image = nativeImage.createFromPath(iconPath);
    app.dock.setIcon(image);
  }
  globalShortcut.register("Alt+Space", () => {
    screenshotService.startCapture();
  });
});
ipcMain.handle("ocr-request", async (_event, imagePath) => {
  try {
    const result = await nativeService.performOCR(imagePath);
    return result;
  } catch (error) {
    console.error("OCR Error:", error);
    return { text: `Error: ${error.message}`, confidence: 0 };
  }
});
ipcMain.handle("translate-request", async (_event, text, options) => {
  try {
    const result = await translationService.translate(text, options);
    return result;
  } catch (error) {
    console.error("Translation Error:", error);
    return { text: `Error: ${error.message}`, engine: options.engine };
  }
});
ipcMain.handle("get-settings", () => {
  return settingsStore.getAll();
});
ipcMain.handle("set-setting", (_event, key, value) => {
  settingsStore.set(key, value);
  if (key === "launchAtLogin" && app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: value,
      path: app.getPath("exe")
    });
  }
});
ipcMain.on("confirm-close-action", (_event, action) => {
  const win2 = BrowserWindow.getFocusedWindow();
  if (action === "quit") {
    app.isQuitting = true;
    app.quit();
  } else {
    win2 == null ? void 0 : win2.hide();
  }
});
ipcMain.on("window-minimize", () => {
  const win2 = BrowserWindow.getFocusedWindow();
  win2 == null ? void 0 : win2.minimize();
});
ipcMain.on("window-maximize", () => {
  const win2 = BrowserWindow.getFocusedWindow();
  if (win2 == null ? void 0 : win2.isMaximized()) {
    win2.unmaximize();
  } else {
    win2 == null ? void 0 : win2.maximize();
  }
});
ipcMain.on("window-close", () => {
  const win2 = BrowserWindow.getFocusedWindow();
  win2 == null ? void 0 : win2.close();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
