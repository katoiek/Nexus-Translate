# Nexus Translate

A privacy-focused desktop translation app with a DeepL-like experience, built with Tauri, React, and Vite. It bundles a lightweight offline engine and also lets you use your local [Ollama](https://ollama.com) models or major cloud AI providers as translation engines.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue)

> 日本語の説明は[こちら](#nexus-translate-日本語)。

---

## Features

### Translation engines

- **Offline (bundled, zero-setup)** — NLLB-200 600M (int8). A lightweight, low-memory offline engine that works out of the box and serves as the default and fallback.
- **Ollama (local LLM)** — Use models already installed in your local Ollama. Pick the model from a dropdown in Settings. Results stream incrementally, and `keep_alive` keeps the model resident so subsequent translations are fast. If Ollama is unreachable or has no models, the app shows the status and automatically falls back to the offline engine.
- **Cloud AI** — OpenAI / Anthropic Claude / Google Gemini (enabled once you set each API key).

### AI features (available with the Ollama / Cloud AI engines only)

- **Tone adjustment** — Switch the translation tone (formal, casual, business, technical).
- **Rephrase** — Rewrite the translation to be more natural and concise.
- **Alternatives & explanation** — Show several alternative translations and nuance notes.
- **Glossary** — Register "always translate this term like this" pairs; they are injected into the prompt.

### Other

- **OCR** — Capture on-screen text and translate it (`Alt+Space`). The OCR engine auto-selects between Japanese and English.
- **Clipboard watch** — Translate triggered by a copy action.

## Privacy

NLLB (bundled) and Ollama (local) run locally and never send your text to external servers. When you use OpenAI, Claude, or Gemini, your text is sent to those services. Prefer the local engines for sensitive content.

## Architecture

- **Frontend**: React + Vite (TypeScript), Tailwind CSS.
- **Shell / backend**: Tauri (Rust). Ollama translation is streamed through a Rust command (`/api/chat`) and forwarded to the frontend via a Tauri channel.
- **Offline translation**: NLLB-200 (CTranslate2) executed as a `translator` sidecar.
- **OCR**: a native helper process (`NexusNative`, C#/.NET on Windows; Swift on macOS).

Design decisions and the ubiquitous language are documented in [`CONTEXT.md`](./CONTEXT.md) and [`docs/adr/`](./docs/adr).

## Prerequisites

- [Node.js](https://nodejs.org) 20+
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- Platform-specific OCR helper build tools:
  - **Windows**: .NET SDK 10+ (NativeAOT publish requires the Visual Studio C++ build tools / `vswhere`)
  - **macOS**: Xcode command line tools (Swift)
- (Optional, runtime) [Ollama](https://ollama.com/download) for the local-LLM engine

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Download the bundled offline model (NLLB-200 600M, int8 ~623MB)
npm run model:nllb-600m

# 3. Run in development
npm run tauri dev
```

To use the Ollama engine, install Ollama, pull a multilingual model, then select it under **Settings → Ollama**:

```bash
ollama pull qwen2.5:7b
```

## Build

```bash
# Production build (current platform)
npm run build

# Windows: also rebuild the native OCR helper, then build the installer
npm run build:win
```

The Windows installer is produced at:

```
src-tauri/target/release/bundle/nsis/nexus-translate_<version>_x64-setup.exe
```

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and our [Code of Conduct](./CODE_OF_CONDUCT.md) before opening an issue or pull request.

## License

[MIT](./LICENSE) © Kei Kato

---

<a name="nexus-translate-日本語"></a>

# Nexus Translate（日本語）

DeepL のような使い心地を目指した、プライバシー重視のデスクトップ翻訳アプリです。Tauri・React・Vite で構成し、軽量な同梱オフラインエンジンに加えて、ローカルの [Ollama](https://ollama.com) モデルや主要なクラウドAIを翻訳エンジンとして選べます。

## 主な機能

### 翻訳エンジン

- **Offline（同梱・ゼロ設定）** — NLLB-200 600M (int8)。軽量・省メモリで、インストール後すぐ動く既定エンジン兼フォールバック。
- **Ollama（ローカルLLM）** — PC にインストール済みの Ollama のモデルを利用。設定のドロップダウンから使用モデルを選択。結果はストリーミング表示され、`keep_alive` でモデルが常駐し2回目以降が高速。未接続やモデル0個のときは状態を表示し、自動的にオフラインエンジンへフォールバックします。
- **クラウドAI** — OpenAI / Anthropic Claude / Google Gemini（各APIキー設定で有効化）。

### AI機能（Ollama / クラウドAI 選択時のみ）

- **トーン調整** — 丁寧・カジュアル・ビジネス・技術的など訳文のトーンを切替。
- **言い換え** — 訳文をより自然・簡潔に書き直し。
- **代替案・説明** — 複数の訳し方とニュアンスの違いを提示。
- **用語集（グロッサリ）** — 「この語は必ずこう訳す」を登録し、プロンプトに反映。

### その他

- **OCR** — 画面上のテキストをキャプチャして翻訳（`Alt+Space`）。日本語・英語を自動でエンジン選択。
- **クリップボード監視** — コピー操作をトリガーに翻訳。

## プライバシーについて

NLLB（同梱）と Ollama（ローカル）はローカル実行のため、翻訳テキストを外部APIへ送信しません。OpenAI・Claude・Gemini を利用する場合は各サービスへテキストが送信されます。機密情報を扱う場合はローカルエンジンの利用を推奨します。

## アーキテクチャ

- **フロントエンド**: React + Vite（TypeScript）、Tailwind CSS。
- **シェル/バックエンド**: Tauri（Rust）。Ollama 翻訳は Rust コマンド（`/api/chat`）でストリーミングし、Tauri channel でフロントへ流します。
- **オフライン翻訳**: NLLB-200（CTranslate2）を `translator` サイドカーとして実行。
- **OCR**: ネイティブ補助プロセス（`NexusNative`。Windows は C#/.NET、macOS は Swift）。

設計判断とユビキタス言語は [`CONTEXT.md`](./CONTEXT.md) と [`docs/adr/`](./docs/adr) に記録しています。

## 前提条件

- [Node.js](https://nodejs.org) 20 以上
- [Rust](https://www.rust-lang.org/tools/install)（stable）
- OCR補助プロセスのビルドツール:
  - **Windows**: .NET SDK 10 以上（NativeAOT 発行に Visual Studio C++ ビルドツール / `vswhere` が必要）
  - **macOS**: Xcode コマンドラインツール（Swift）
- （任意・実行時）ローカルLLM用に [Ollama](https://ollama.com/download)

## セットアップ

```bash
# 1. 依存関係をインストール
npm install

# 2. 同梱オフラインモデルを取得（NLLB-200 600M, int8 約623MB）
npm run model:nllb-600m

# 3. 開発起動
npm run tauri dev
```

Ollama エンジンを使うには、Ollama をインストールし多言語モデルを取得してから、**設定 → Ollama** で選択します。

```bash
ollama pull qwen2.5:7b
```

## ビルド

```bash
# 本番ビルド（現在のプラットフォーム）
npm run build

# Windows: ネイティブOCR補助も再ビルドしてからインストーラーを作成
npm run build:win
```

Windows インストーラーの出力先:

```
src-tauri/target/release/bundle/nsis/nexus-translate_<version>_x64-setup.exe
```

## コントリビュート

歓迎します。Issue や Pull Request を作成する前に [CONTRIBUTING.md](./CONTRIBUTING.md) と [行動規範](./CODE_OF_CONDUCT.md) をご確認ください。

## ライセンス

[MIT](./LICENSE) © Kei Kato
