# Windows Build Instructions (v1.0.0 Candidate)

This document outlines the steps to build Nexus Translate on Windows.

## 1. Prerequisites

Ensure the following are installed on your Windows machine:

1.  **Node.js** (v20 or later recommended)
2.  **Git**
3.  **.NET 8.0 SDK** (Required for building the native helper)
    - Download: [https://dotnet.microsoft.com/en-us/download/dotnet/8.0](https://dotnet.microsoft.com/en-us/download/dotnet/8.0)

## 2. Setup

1.  Clone or pull the latest repository (main branch).
    ```powershell
    git checkout main
    git pull origin main
    ```

2.  Install dependencies.
    ```powershell
    npm install
    ```

## 3. Build

Run the dedicated Windows build command. This script will:
1.  Compile the native C# helper (`native/win/NexusNative.csproj`) using `dotnet publish`.
2.  Compile the TypeScript code.
3.  Build the Vite frontend.
4.  Package the application using `electron-builder`.

```powershell
npm run build:win
```

## 4. Output

The installer (setup.exe) and portable files will be generated in:
`release/0.0.1/` (or current version in package.json)

## 5. Troubleshooting

- **Native Build Fails:** Ensure `.NET 8.0 SDK` is correctly installed and `dotnet` command is available in your PATH.
- **Permission Errors:** Run PowerShell as Administrator if you encounter file permission issues.
- **Icon Issues:** Verify that `public/icon.png` is present.

## 6. Version Note
We are aiming for **v1.0.0**. Before the final build, please update the version in `package.json` if it hasn't been updated yet.
