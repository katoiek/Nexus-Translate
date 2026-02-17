import { app } from 'electron';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';

interface OCRResult {
  text: string;
  confidence: number;
}

export class NativeService {
  private getNativePath(platform: NodeJS.Platform): string | null {
    const isPackaged = app.isPackaged;

    // In development mode:
    // Mac: native/mac/main
    // Win: native/win/bin/...
    // But for simplicity in dev, we might need to point to the source or built binary if available.

    if (platform === 'darwin') {
      if (isPackaged) {
        return path.join(process.resourcesPath, 'native/mac/main');
      } else {
        return path.join(process.cwd(), 'native/mac/main');
      }
    } else if (platform === 'win32') {
      if (isPackaged) {
        return path.join(process.resourcesPath, 'native/win/NexusNative.exe');
      } else {
        // In dev, point to the release build if it exists.
        // During dev we might not have it built, but assuming the user will build it manually as per instructions.
        return path.join(process.cwd(), 'native/win/bin/Release/net10.0-windows10.0.19041.0/win-x64/publish/NexusNative.exe');
      }
    }

    return null;
  }

  public async performOCR(imagePath: string): Promise<OCRResult> {
    return this.runNativeCommand(['ocr', imagePath]);
  }

  public async performCaptureAndOCR(x: number, y: number, width: number, height: number): Promise<OCRResult> {
    const args = ['capture', x.toString(), y.toString(), width.toString(), height.toString()];
    return this.runNativeCommand(args);
  }

  private async runNativeCommand(args: string[]): Promise<OCRResult> {
    return new Promise((resolve, reject) => {
      const nativePath = this.getNativePath(process.platform);

      if (!nativePath) {
        return reject(new Error(`Platform ${process.platform} not supported or native binary missing`));
      }

      if (!fs.existsSync(nativePath) && !app.isPackaged) {
        console.warn(`Native binary not found at ${nativePath}`);
        if (process.env.NODE_ENV === 'development') {
          console.log('Returning mock OCR result');
          return resolve({ text: "Mock OCR Text: Japanese text would go here.", confidence: 0.99 });
        }
        return reject(new Error(`Native binary not found at ${nativePath}`));
      }

      execFile(nativePath, args, (error, stdout, stderr) => {
        if (error) {
          console.error('Native Process Error:', error);
          console.error('Stderr:', stderr);
          return reject(error);
        }

        try {
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch (e) {
          console.error('Failed to parse Native output:', stdout);
          reject(new Error('Invalid output structure from native sidecar'));
        }
      });
    });
  }
}

export const nativeService = new NativeService();
