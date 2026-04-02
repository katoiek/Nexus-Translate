# Nexus Translate - Mac ビルド引き継ぎガイド

Windows版の安定稼働を確認済み。Mac版のビルドに必要な情報をまとめる。
**Mac向けのコード実装は大部分が完了しており、バイナリのビルドと配置が主な残作業。**

---

## 現在のステータス (v2.0.0)

### 実装済み（コード変更不要）

| 項目 | 場所 | 内容 |
|------|------|------|
| macOS 分岐処理 | `src/App.tsx` | `osType() === 'macos'` でインタラクティブキャプチャフローに切り替え |
| Mac ネイティブサイドカー | `native/mac/main.swift` | Swift + Vision Framework 実装済み |
| macOS ウィンドウ設定 | `src-tauri/tauri.macos.conf.json` | タイトルバーOverlay・透明化設定済み |
| macOS Private API | `src-tauri/Cargo.toml` | `features = ["macos-private-api"]` 有効化済み |

### Mac キャプチャフロー（実装済み）

Windows版（スクリーンショットオーバーレイウィンドウ）と異なり、Mac版は以下のフローで動作する：

1. OCRボタン押下 → `osType() === 'macos'` を検出
2. メインウィンドウを非表示
3. `NexusNative` サイドカーの `interactive-capture` コマンドを呼び出し
4. Swift側で `screencapture -i -x <tempfile>` を起動（macOS標準の範囲選択UI）
5. キャプチャ画像に対して Vision Framework (`VNRecognizeTextRequest`) でOCR
6. JSON (`{"text": "...", "confidence": 1.0}`) を stdout に出力
7. メインウィンドウを再表示し、テキストを翻訳ビューに渡す

---

## Mac サイドカー (`native/mac/main.swift`) の仕様

| コマンド | 引数 | 説明 |
|---------|------|------|
| `ocr` | `<image_path>` | 画像ファイルのOCR |
| `capture` | `<x> <y> <width> <height>` | 座標指定キャプチャ+OCR |
| `watch-clipboard` | なし | クリップボード変更監視（100msポーリング） |
| `interactive-capture` | なし | `screencapture -i` で範囲選択→OCR |
| `version` | なし | ビルド情報の出力 |

OCR言語設定: `["ja-JP", "en-US"]`、認識レベル: `.accurate`

---

## Mac でやるべき作業

### 1. Swift バイナリのビルド

```bash
# プロジェクトルートで実行
swiftc native/mac/main.swift \
  -o src-tauri/binaries/NexusNative-aarch64-apple-darwin \
  -framework Foundation \
  -framework Vision \
  -framework AppKit

# Intel Mac の場合
swiftc native/mac/main.swift \
  -o src-tauri/binaries/NexusNative-x86_64-apple-darwin \
  -framework Foundation \
  -framework Vision \
  -framework AppKit
```

> **注意**: `src-tauri/` 直下に `NexusNative-aarch64-apple-darwin` というファイルが存在するが、これは `src-tauri/binaries/` に配置する必要がある。

### 2. Python トランスレーターのビルド

`src-tauri/binaries/translator-aarch64-apple-darwin`（または `x86_64`）を用意する。

```bash
# native/Python/ 以下のソースから PyInstaller でビルド（Mac環境で実行）
# 詳細は native/Python/ の README または既存の Windows ビルドスクリプトを参照
pip install pyinstaller
pyinstaller --onefile translator.py -n translator
# 出力されたバイナリを src-tauri/binaries/ にリネームして配置
```

> `src-tauri/` 直下に `translator-aarch64-apple-darwin` というファイルが存在する場合は、`src-tauri/binaries/` に移動する。

### 3. モデルの配置

```bash
# src-tauri/models/ シンボリックリンクの作成（まだ存在しない場合）
cd src-tauri
ln -s ../native/models models
```

配置が必要なモデルディレクトリ:
- `models/nllb-200-distilled-600M/` （高速・省メモリ、`offline` エンジン）
- `models/nllb-200-distilled-1.3B/` （高品質・GPU対応、`offline-hq` エンジン）

### 4. macOS の権限設定（初回のみ）

- **画面収録 (Screen Recording)**: アプリ初回起動時、またはスクリーンキャプチャ実行時にシステムが自動で権限ダイアログを表示する。`NexusNative` の Swift コード内で `CGPreflightScreenCaptureAccess()` チェックを実装済み。
- **アクセシビリティ**: グローバルショートカット (`tauri-plugin-global-shortcut`) に必要な場合あり。

### 5. ビルド実行

```bash
npm install
npm run tauri build -- --config src-tauri/tauri.macos.conf.json
```

`tauri.macos.conf.json` は `tauri.conf.json` にオーバーレイ適用される（ウィンドウのタイトルバースタイル等を macOS 向けに上書き）。

---

## 翻訳エンジン一覧

| エンジンID | 説明 | Mac対応 |
|------------|------|---------|
| `offline` | NLLB-200 600M（ローカル・高速） | ✅ バイナリ配置のみ |
| `offline-hq` | NLLB-200 1.3B（ローカル・高品質・GPU対応） | ✅ バイナリ配置のみ |
| `llm-openai` | OpenAI GPT（APIキー必要） | ✅ コード変更不要 |
| `llm-anthropic` | Anthropic Claude（APIキー必要、フォールバックリスト付き） | ✅ コード変更不要 |
| `llm-gemini` | Google Gemini（APIキー必要、フォールバックリスト付き） | ✅ コード変更不要 |

---

## アーキテクチャ概要

```
src/                        # React/TypeScript フロントエンド
  App.tsx                   # ビュー切替・OCRフロー（macOS分岐あり）
  components/
    TranslationView.tsx     # 翻訳メインUI
    SettingsView.tsx        # 設定（general/appearance/ai/languages タブ）
    ScreenshotView.tsx      # Windows用スクリーンショット選択UI
    LanguageSelector.tsx
  services/
    TranslationService.ts       # 翻訳エンジン振り分け
    OfflineTranslationService.ts  # NLLB サイドカー管理
    NativeService.ts            # NexusNative サイドカー呼び出し
    ClipboardWatcherService.ts
  contexts/
    LanguageContext.tsx     # UI言語 (en/ja)
    ThemeContext.tsx        # テーマ (galaxy/emerald/sky/amethyst/ruby/midnight)

src-tauri/                  # Tauri/Rust
  src/main.rs               # プラグイン初期化のみ
  tauri.conf.json           # 共通設定
  tauri.macos.conf.json     # macOS上書き設定（ウィンドウ等）
  binaries/                 # ← ここにプラットフォーム別バイナリを配置
  models/                   # ← native/models へのシンボリックリンク

native/
  mac/main.swift            # Swift OCR + クリップボード監視
  win/Program.cs            # C# OCR + クリップボード監視（Windows専用）
  models/                   # NLLBモデル本体
```

---

## 既知の注意点

- `src-tauri/main.rs` の `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` は Windows専用属性のため、Mac ビルドでは無視される（問題なし）。
- APIキーとテーマ・UI言語は `localStorage` に保存。
- ウィンドウは `main` と `screenshot` の2つが定義されているが、Mac では `screenshot` ウィンドウは使用されない（`interactive-capture` フローを使うため）。
- CJK文字間の不要なスペース除去は `NativeService.ts` 側で処理するため、Windows・Mac共通で機能する。
