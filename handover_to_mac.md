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

### 1b. マルチモニター座標変換バグの修正 (`App.tsx`)
`availableMonitors()` から取得したオフセット（物理ピクセル）を `scaleFactor` で割って論理ピクセルで保存していたバグを修正しました。
- **修正内容**: `App.tsx` の `screenshot_offset` を物理ピクセルのまま `localStorage` に保存するよう変更（`/ scaleFactor` を削除）。`ScreenshotView.tsx` 側はそのまま（物理ピクセル加算）。
- **Macへの影響**: Retinaディスプレイ（DPR=2.0）やマルチモニター環境でキャプチャ範囲がズレる問題を防ぎます。Mac版でも同じロジックが適用されるため、そのまま機能するはずです。

### 2. リソースパス（モデル）の解決方法
`tauri.conf.json` でのリソース解決を安定させるため、パスの指定方法を変更しました。
- **変更点**: `../native/models/` を直接参照せず、`src-tauri/models` を経由するように変更。
- **Macでの作業**: `src-tauri` ディレクトリ内で、以下のコマンドを実行してシンボリックリンクを作成してください：
  ```bash
  cd src-tauri
  ln -s ../native/models models
  ```

### 3. 日本語OCRの読み取り精度向上
Windows OCR特有の挙動（文字間の不要な空白）を解消する処理を `NativeService.ts` に追加・修正しました。

#### 3a. CJK文字間スペース除去バグの修正 (`NativeService.ts` 行64)
従来の正規表現は `$1$2` 置換によって右側の文字が「消費」されるため、3文字以上連続する場合に1パスで全除去できないバグがありました。
- **修正内容**: **lookahead (`(?=...)`) を使用**するように変更。右側の文字を消費せず、連鎖するスペースを1パスで全除去できるようになりました。
  ```typescript
  // 変更後 (lookahead使用)
  result.text = result.text.replace(
    /([\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff])\s+(?=[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff])/g,
    '$1'
  );
  ```
- **Macへの影響**: Mac版（Vision Framework）でも文字間スペースが挿入される場合、このロジックが有効に働きます。

#### 3b. OCR前処理の改善 (`native/win/Program.cs` 相当、Mac版では Swift で実装)
Windows版の `NexusNative` (C#) での画像前処理に以下の改善を加えました。Mac版の Swift サイドカーを実装する際も同様のロジックを取り入れることを推奨します。

| 改善項目 | 変更前 | 変更後 | 理由 |
|---------|--------|--------|------|
| **アップスケール目標サイズ** | `150px` | `300px` | OCR推奨の300dpi相当に合わせ、小さいフォントの認識率向上 |
| **補間モード** | 常に `HighQualityBicubic` | 2倍以上の拡大時は `NearestNeighbor` を使用 | BicubicはテキストエッジをぼかすためOCR精度が低下する。`NearestNeighbor`はエッジを保持しOCRに有利 |
| **背景色検出** | 4隅のピクセル平均 | 内側8点サンプリング＋**中央値**で判定 | UIボーダーやシャドウによる誤判定を防ぎ、背景の明暗反転の精度向上 |

Mac版の Swift 実装では:
- `VNRecognizeTextRequest` に渡す前に `CGImage` を同様にアップスケールする。
- 背景色の判定は `CIImage` の `averageColor` フィルタや `CGContext` サンプリングで実現できます。
- `NearestNeighbor` 相当は `CGInterpolationQuality.none` (= `kCGInterpolationNone`) を使用します。

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
