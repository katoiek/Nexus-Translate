# Nexus Translate

Nexus Translate は、DeepL のような使い心地を目指したプライバシー重視のデスクトップ翻訳アプリです。Tauri、React、Vite を中心に構成し、クラウドAIに加えて同梱ローカル翻訳エンジンを利用できます。

## 主な機能

- **同梱ローカル翻訳**
  - Tencent Hy-MT2 1.8B: `llama-cli` sidecar と GGUF モデルをアプリに同梱して実行
  - NLLB-200 600M: 高速・省メモリのオフライン翻訳
  - NLLB-200 1.3B: より高品質なオフライン翻訳
- **外部AI翻訳**
  - OpenAI
  - Anthropic Claude
  - Google Gemini
- **OCR**
  - 画面上のテキストをキャプチャして翻訳
- **クリップボード監視**
  - コピー操作をトリガーに翻訳を実行
- **グローバルショートカット**
  - `Alt+Space` で OCR キャプチャを起動

## Hy-MT2 1.8B の同梱準備

Hy-MT2 はローカルサーバーへ接続せず、アプリに同梱した `llama-cli` と GGUF モデルを直接実行します。初回ビルド前に次のコマンドでランタイムとモデルを準備してください。

```bash
npm run prepare:hymt2
```

このコマンドで次のファイルを配置します。

```text
src-tauri/llama-cli-x86_64-pc-windows-msvc.exe
src-tauri/llama-runtime/
src-tauri/models/hymt2-1.8b-gguf/Hy-MT2-1.8B-Q4_K_M.gguf
```

モデルを更新したい場合は、次のコマンドだけを実行します。

```bash
npm run model:hymt2
```

llama.cpp の Windows ランタイムだけを更新したい場合は、次を実行します。

```bash
npm run runtime:llama
```

## NLLB モデルの準備

NLLB-200 600M / 1.3B は CTranslate2 形式のモデルを `src-tauri/models/` に配置して実行します。初回利用前、またはモデルフォルダを作り直した場合は次を実行してください。

```bash
npm run model:nllb
```

個別に取得する場合は次を使います。

```bash
npm run model:nllb-600m
npm run model:nllb-1.3b
```

Hy-MT2 と NLLB をまとめて準備する場合は次を使います。

```bash
npm run prepare:local
```

## セットアップ

```bash
npm install
```

## 開発起動

```bash
npm run tauri dev
```

## ビルド

```bash
npm run build
```

Windows 向けにネイティブ補助プロセスも更新してからビルドする場合は、次を使います。

```bash
npm run build:win
```

## プライバシーについて

NLLB と Hy-MT2 Local はローカル実行のため、翻訳テキストを外部APIへ送信しません。ただし OpenAI、Claude、Gemini、Google Translate Web を利用する場合は、各サービスのサーバーへテキストが送信されます。機密情報を扱う場合はローカルエンジンの利用を推奨します。

## ライセンス

MIT
