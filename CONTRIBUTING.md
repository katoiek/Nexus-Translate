# Contributing to Nexus Translate

Thanks for your interest in contributing! This guide explains how to set up the project, the conventions we follow, and how to submit changes.

> 日本語版は[こちら](#コントリビューションガイド日本語)。

---

## Getting started

See the [Prerequisites](./README.md#prerequisites) and [Getting started](./README.md#getting-started) sections in the README for environment setup. In short:

```bash
npm install
npm run model:nllb-600m   # download the bundled offline model
npm run tauri dev
```

## Project layout

```
src/                     Frontend (React + TypeScript)
  components/            UI components
  services/              Translation / Ollama / OCR / clipboard services
  hooks/  lib/  locales/ Hooks, utilities, i18n strings
src-tauri/               Tauri (Rust) shell and commands
native/                  Native OCR helper (win: C#/.NET, mac: Swift)
docs/adr/                Architecture Decision Records
CONTEXT.md               Ubiquitous language / glossary
```

## Before you open a PR

Please make sure the following pass:

```bash
npm run lint              # ESLint (zero warnings)
npx tsc --noEmit          # TypeScript type check
cargo check               # in src-tauri/ — Rust check
```

## Conventions

- **Comments and docs**: write Japanese first, then English (`// データを読み込む / Load data`). Variable and function names are in English.
- **Commit messages**: use a short prefix (`feat:`, `fix:`, `build:`, `docs:`, `refactor:`) followed by a concise summary. Japanese or English is fine.
- **Branches**: create a topic branch from `main`; do not commit directly to `main`.
- **Generated artifacts** (`native/win/bin`, `native/win/obj`, `src-tauri/gen/schemas`, built binaries and models) are not committed.
- **Domain model**: when you introduce or change domain terms or make an architecturally significant decision, update [`CONTEXT.md`](./CONTEXT.md) and add an ADR under [`docs/adr/`](./docs/adr).

## Pull requests

1. Fork and create a topic branch.
2. Make your change with the checks above passing.
3. Describe the motivation and the change clearly in the PR.
4. Link any related issues.

## Reporting issues

Open an issue with reproduction steps, expected vs. actual behavior, your OS, and the translation engine in use (Offline / Ollama / Cloud). For OCR issues, a sample image and the captured region help a lot.

---

<a name="コントリビューションガイド日本語"></a>

# コントリビューションガイド（日本語）

貢献に興味を持っていただきありがとうございます。セットアップ方法・規約・変更の提出手順を説明します。

## セットアップ

環境構築は README の[前提条件](./README.md#前提条件)と[セットアップ](./README.md#セットアップ)を参照してください。要点:

```bash
npm install
npm run model:nllb-600m   # 同梱オフラインモデルを取得
npm run tauri dev
```

## ディレクトリ構成

```
src/                     フロントエンド（React + TypeScript）
  components/            UIコンポーネント
  services/              翻訳 / Ollama / OCR / クリップボード
  hooks/  lib/  locales/ フック・ユーティリティ・多言語文字列
src-tauri/               Tauri（Rust）シェルとコマンド
native/                  ネイティブOCR補助（win: C#/.NET, mac: Swift）
docs/adr/                アーキテクチャ決定記録（ADR）
CONTEXT.md               ユビキタス言語 / 用語集
```

## PR を出す前に

以下が通ることを確認してください。

```bash
npm run lint              # ESLint（警告ゼロ）
npx tsc --noEmit          # TypeScript 型チェック
cargo check               # src-tauri/ で実行（Rust チェック）
```

## 規約

- **コメント・ドキュメント**: 日本語 → 英語 の順で併記（`// データを読み込む / Load data`）。変数名・関数名は英語。
- **コミットメッセージ**: 短い接頭辞（`feat:` `fix:` `build:` `docs:` `refactor:`）＋簡潔な要約。日本語・英語どちらでも可。
- **ブランチ**: `main` からトピックブランチを作成。`main` への直接コミットは不可。
- **生成物**（`native/win/bin`, `native/win/obj`, `src-tauri/gen/schemas`、ビルド成果物・モデル）はコミットしない。
- **ドメインモデル**: ドメイン用語の追加・変更や、後戻りの難しい設計判断をした場合は [`CONTEXT.md`](./CONTEXT.md) を更新し、[`docs/adr/`](./docs/adr) に ADR を追加。

## プルリクエスト

1. フォークしてトピックブランチを作成。
2. 上記チェックが通る状態で変更。
3. 動機と変更内容を PR に明記。
4. 関連 Issue をリンク。

## 不具合報告

再現手順・期待動作と実際の動作・OS・使用エンジン（Offline / Ollama / Cloud）を添えて Issue を作成してください。OCR の不具合はサンプル画像とキャプチャ範囲があると助かります。
