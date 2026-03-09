# Nexus Translate Mac Handover Guide

Windows版（Tauri v2）の主要機能が安定したため、Mac版の実装に向けた技術情報をまとめます。

## 現在のステータス (Windows v2.0.0)
- **OCRキャプチャ**: C# (NexusNative) サイドカー＋Tauri `availableMonitors` によるマルチディスプレイ対応。
- **オフライン翻訳**: Python (CTranslate2/NLLB-200) サイドカーによる高速オフライン翻訳。
- **クリップボード監視**: C# サイドカーによる高速（Ctrl+C+C対応）なクリップボードイベント検知。
- **UI/UX**: 透明レイヤーによるスクショ選択、レスポンシブな翻訳ビュー、設定画面。

## Mac実装に向けた要件

### 1. サイドカーのバイナリ作成
現在 `externalBin` に指定されている以下のバイナリのMac版を作成し、`src-tauri/binaries` に配置する必要があります。
- `translator` (Python/CTranslate2): Mac用のバイナリ（PyInstaller/Nuitka等）が必要。
- `NexusNative` (C#): Mac版では **Swift/Objective-C** で同機能（OCR、クリップボード監視、キャプチャ）を実装し、バイナリ化する必要があります。

### 2. OCRの実装 (Vision Framework)
Mac版では、Windows版のTesseract系ロジックの代わりに、Appleの **Vision Framework (VNRecognizeTextRequest)** を使用することを強く推奨します。精度・速度共にOS標準機能が最も優れています。

### 3. スクリーンキャプチャの権限
macOSでは画面収録（Screen Recording）の権限設定が厳しいため、初回起動時にシステム設定へ誘導する処理が必要です。

### 4. マルチディスプレイ対応の検証
現在 `App.tsx` では `availableMonitors()` を用いて全モニターのバウンディングボックスを計算し、ウィンドウを広げるロジックを実装しています。Mac環境での `PhysicalPosition` の挙動（Retinaディスプレイの倍率影響など）を確認してください。

## リファクタリング済み項目
- **Loggerの導入**: `src/lib/logger.ts` を導入し、`IS_DEV = false` で全コンソールログを抑制可能です。
- **メッセージダイアログの整理**: `message()` によるポップアップを、致命的なエラー以外は抑制しました。
- **パス解決のポータビリティ**: `resolveResource` を使用するように統一し、OSごとのリソースパスの違いに対応しています。

## 最新の修正事項とMac版での対応 (v2.0.0)

Windows版の開発中に発生した不具合と、Mac版をビルドする際に必要な対応を追記しました。

### 1. DPIスケーリング（Retinaディスプレイ）への対応
`ScreenshotView.tsx` において、CSSピクセル座標を物理ピクセル座標に変換するロジックを追加しました。
- **修正内容**: `window.devicePixelRatio` (DPR) を使用して、マウス座標をOSの物理座標系に変換。
- **Macへの影響**: Retinaディスプレイ（DPR=2.0など）でもスクショ範囲が正確にキャプチャされるようになります。

### 2. リソースパス（モデル）の解決方法
`tauri.conf.json` でのリソース解決を安定させるため、パスの指定方法を変更しました。
- **変更点**: `../native/models/` を直接参照せず、`src-tauri/models` を経由するように変更。
- **Macでの作業**: `src-tauri` ディレクトリ内で、以下のコマンドを実行してシンボリックリンクを作成してください：
  ```bash
  cd src-tauri
  ln -s ../native/models models
  ```

### 3. 日本語OCRの読み取り精度向上
Windows OCR特有の挙動（文字間の不要な空白）を解消する処理を `NativeService.ts` に追加しました。
- **修正内容**: 日本語・中国語の文字間に挟まった半角スペースを正規表現で自動除去。
- **Macへの影響**: Mac版のOCRエンジンでも同様の現象が発生する場合、このロジックが有効に働きます。

### 4. リリースビルドの成功確認 (Windows)
Windows版において、`npm run tauri build` によるインストーラー（NSIS）の生成に成功しました。
- **モデル同梱**: 約600MBのNLLBモデルが正常にパッケージングされ、1つのインストーラーとして配布可能な状態です。
- **端末ウィンドウの抑制**: `main.rs` に `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` を追加し、リリース版起動時にターミナルが表示されないよう修正済みです。
- **最新バージョンの確認**: `tauri.conf.json` の `package.version` が `2.0.1` に更新されていることを確認してください。
- **ビルド時の注意**: `tsc` による型チェックが厳格なため、未使用のインポート等があるとビルドが止まります。Mac版でも `npm run build:tauri` が通ることを確認してください。
- **依存関係**: `src-tauri/Cargo.toml` の `tauri-build` 等を最新版に更新しました。

## 次のステップ
1. Mac開発環境での `npm install`。
2. `src-tauri/models` シンボリックリンクの作成。
3. Swiftでの `NexusNative` 互換サイドカーの実装。
4. Mac用サイドカーバイナリ（`translator`, `NexusNative`）のビルドと `src-tauri/binaries` への配置。
5. `v2-mac` ブランチ等での検証開始。
6. `npm run tauri build` によるMac版リリースパッケージ (.dmg / .app) の生成確認。
