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

## 次のステップ
1. Mac開発環境での `npm install`。
2. Swiftでの `NexusNative` 互換サイドカーの実装。
3. `tauri.conf.json` の `bundle -> externalBin` 設定への追加。
4. `v2-mac` ブランチ等での検証開始。
