# Nexus Translate - macOS Development Handoff Guide

## Project Overview
Nexus Translate is a privacy-focused desktop translation app.
The Windows version is fully implemented. The macOS version needs to be developed.

## Architecture
- **Frontend**: React (Vite).
- **Backend**: Electron (Main Process) spawns a native sidecar executable.
- **Communication**: JSON over stdio.

## Current Status
- **Windows**: Complete.
- **macOS**: Pending implementation.

## macOS Implementation Tasks

### 1. Native Helper (`native/mac`)
Create a **Swift command-line tool**.
- **Path**: `native/mac/main.swift`
- **Functionality**:
  - **Clipboard Watcher**: Monitor `NSPasteboard` change count. Output JSON updates.
  - **OCR**: Use Vision Framework (`VNRecognizeTextRequest`). Support Japanese. Output JSON text/confidence.

### 2. Electron Integration (`src/main/index.ts`)
- Update `ipcMain` handlers to detect `process.platform === 'darwin'`.
- Spawn the compiled Swift binary (`native/mac/nexus-native`).

### 3. Build Configuration (`package.json`)
- Add a build script for Mac: `swiftc native/mac/main.swift -o native/mac/nexus-native`.
- Configure `electron-builder` for macOS (`dmg`, `zip`).

## Recommended Tools
- `swiftc`: Swift compiler.
- `xcode-select --install`: Required for command line tools.

## Next Steps for You (The Mac Agent)
1. Initialize `native/mac/main.swift`.
2. Implement clipboard monitoring using `NSPasteboard`.
3. Implement OCR using `Vision`.
4. Update Electron main process to spawn the Mac binary.
5. Create a `build:mac` script.
