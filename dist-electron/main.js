var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { app, ipcMain, screen, BrowserWindow, desktopCapturer, globalShortcut } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path$1 from "node:path";
import { execFile } from "child_process";
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
      execFile(nativePath, [imagePath], (error, stdout, stderr) => {
        if (error) {
          console.error("OCR Process Error:", error);
          console.error("Stderr:", stderr);
          return reject(error);
        }
        try {
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch (e) {
          console.error("Failed to parse OCR output:", stdout);
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
      if (engine === "llm") {
        return await this.translateLLM(text, source, target, apiKeys);
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
  async translateLLM(text, source, target, apiKeys) {
    if (apiKeys == null ? void 0 : apiKeys.openai) {
      return await this.translateOpenAI(text, source, target, apiKeys.openai);
    } else if (apiKeys == null ? void 0 : apiKeys.anthropic) {
      return await this.translateAnthropic(text, source, target, apiKeys.anthropic);
    } else if (apiKeys == null ? void 0 : apiKeys.gemini) {
      return await this.translateGemini(text, source, target, apiKeys.gemini);
    }
    throw new Error("No API Key configured for LLM. Please check Settings.");
  }
  async translateOpenAI(text, source, target, apiKey) {
    var _a, _b, _c, _d;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        // or gpt-3.5-turbo
        messages: [
          {
            role: "system",
            content: `You are a professional translator. Translate the following text from ${source === "auto" ? "auto-detected language" : source} to ${target}. Output ONLY the translated text, no explanations.`
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
      throw new Error(`OpenAI API Error: ${((_a = err.error) == null ? void 0 : _a.message) || response.statusText}`);
    }
    const data = await response.json();
    const translatedText = (_d = (_c = (_b = data.choices[0]) == null ? void 0 : _b.message) == null ? void 0 : _c.content) == null ? void 0 : _d.trim();
    return {
      text: translatedText,
      engine: "llm-openai"
    };
  }
  async translateAnthropic(text, source, target, apiKey) {
    var _a, _b;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-opus-20240229",
        max_tokens: 1024,
        system: `You are a professional translator. Translate the following text from ${source === "auto" ? "auto-detected language" : source} to ${target}. Output ONLY the translated text.`,
        messages: [
          { role: "user", content: text }
        ]
      })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Anthropic API Error: ${((_a = err.error) == null ? void 0 : _a.message) || response.statusText}`);
    }
    const data = await response.json();
    const translatedText = (_b = data.content[0]) == null ? void 0 : _b.text;
    return {
      text: translatedText,
      engine: "llm-anthropic"
    };
  }
  async translateGemini(text, source, target, apiKey) {
    var _a, _b, _c, _d, _e, _f;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Translate the following to ${target}: ${text}`
          }]
        }]
      })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Gemini API Error: ${((_a = err.error) == null ? void 0 : _a.message) || response.statusText}`);
    }
    const data = await response.json();
    const translatedText = (_f = (_e = (_d = (_c = (_b = data.candidates) == null ? void 0 : _b[0]) == null ? void 0 : _c.content) == null ? void 0 : _d.parts) == null ? void 0 : _e[0]) == null ? void 0 : _f.text;
    return {
      text: translatedText || "Translation failed",
      engine: "llm-gemini"
    };
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
          // Fixed path
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
      const display = screen.getAllDisplays().find((d) => d.id === displayId);
      if (!display) {
        throw new Error("Display not found");
      }
      const scaleFactor = display.scaleFactor;
      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: {
          width: display.size.width * scaleFactor,
          height: display.size.height * scaleFactor
        }
      });
      const source = sources.find((s) => s.display_id === display.id.toString()) || sources.find((s) => s.id === `screen:${display.id}`);
      const targetSource = source || sources[0];
      if (!targetSource) throw new Error("No screen source found for display");
      const image = targetSource.thumbnail.crop({
        x: Math.round(rect.x * scaleFactor),
        y: Math.round(rect.y * scaleFactor),
        width: Math.round(rect.width * scaleFactor),
        height: Math.round(rect.height * scaleFactor)
      });
      const tempPath = path$1.join(app.getPath("temp"), `nexus_ocr_${Date.now()}.png`);
      fs.writeFileSync(tempPath, image.toPNG());
      this.closeCaptureWindows();
      const ocrResult = await nativeService.performOCR(tempPath);
      fs.unlinkSync(tempPath);
      (_a = this.mainWindow) == null ? void 0 : _a.webContents.send("ocr-result", ocrResult);
      (_b = this.mainWindow) == null ? void 0 : _b.show();
      (_c = this.mainWindow) == null ? void 0 : _c.focus();
    } catch (error) {
      console.error("Screenshot processing failed:", error);
      this.closeCaptureWindows();
      (_d = this.mainWindow) == null ? void 0 : _d.webContents.send("ocr-result", { text: `Error: ${error}` });
      (_e = this.mainWindow) == null ? void 0 : _e.show();
    }
  }
}
const screenshotService = new ScreenshotService();
createRequire(import.meta.url);
const __dirname$1 = path$1.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path$1.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path$1.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path$1.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path$1.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    icon: path$1.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path$1.join(__dirname$1, "preload.mjs")
    }
  });
  screenshotService.init(win);
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path$1.join(RENDERER_DIST, "index.html"));
  }
}
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
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
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
app.whenReady().then(() => {
  createWindow();
  globalShortcut.register("Alt+Space", () => {
    screenshotService.startCapture();
  });
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
