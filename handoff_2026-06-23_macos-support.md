# 引き継ぎ: Nexus Translate macOS 対応 / Handoff: macOS support

作成日 / Updated: 2026-06-23
対象 / Goal: Nexus Translate を **macOS でビルド・動作・配布**できるようにする。
（Windows 版は v2.5.0 として公開済み。次は mac。）

## 現在地 / Where we are

- リポジトリ: https://github.com/katoiek/Nexus-Translate
- ブランチ `main` 最新: **`e9c7335`**（Windows 作業はすべて取り込み済み）
  - `e9c7335` fix: OCRキャプチャの極小選択クラッシュ修正（GetPixel座標クランプ）
  - `6b89c24` fix: システムトレイ常駐
  - `857ab7d` docs: OSS公開ドキュメント整備（README英→日, LICENSE, CONTRIBUTING, CODE_OF_CONDUCT）
- 公開リリース: https://github.com/katoiek/Nexus-Translate/releases/tag/v2.5.0
  - Windows インストーラー `nexus-translate_2.5.0_x64-setup.exe` を**OCR修正込みビルドへ差し替え済み**。
  - 注: タグ自体は `6b89c24` を指したまま（アセットのみ最新バイナリに差し替え）。
- 設計判断・用語は `CONTEXT.md`, `docs/adr/0001`,`0002` を参照（重複記載しない）。
- 翻訳/AI/OCR/トレイ/dev環境の変更点はコミット履歴・README参照。OCR改善とトレイは下記の mac 影響に直結。

## Mac でのビルド方法 / How to build on macOS

> 前提: Apple Silicon または Intel Mac、Xcode Command Line Tools、Node 20+、Rust stable。
> Windows 専用の .NET / vswhere は **mac では不要**（mac の OCR は Swift）。

```bash
# 0) ツール準備
xcode-select --install                 # swiftc など
# Rust: https://rustup.rs  /  Node 20+: nvm 等

# 1) 依存関係
npm install

# 2) 同梱オフラインモデル（NLLB-200 600M int8, 約623MB / OS共通）
npm run model:nllb-600m

# 3) ネイティブOCR補助(Swift)をビルド
#    native/mac/main.swift -> src-tauri/NexusNative-<arch>-apple-darwin を生成
npm run build:mac

# 4) 開発起動（dev ポート 1430）
npm run tauri dev

# 5) 本番ビルド（mac は .app / .dmg）。※先に下記 tauri.conf の targets 対応が必要
npm run build
# 生成物: src-tauri/target/release/bundle/{macos/*.app, dmg/*.dmg}
```

### 5 の前に必須: バンドルターゲットの mac 対応
`src-tauri/tauri.conf.json` の `bundle.targets` が現在 **`["nsis"]`（Windows専用）**。
このままだと mac の `tauri build` が「unsupported target」で失敗する。次のいずれかにする:
- `"targets": "all"` … 各プラットフォームで適切なものを自動選択（最も簡単）
- もしくは mac 用に `["app", "dmg"]` を含める

### サイドカーのアーキ
- `externalBin` は `["translator", "NexusNative"]`。Tauri は実行時に `-<target-triple>` 付き
  （例 `NexusNative-aarch64-apple-darwin`）を解決する。
- 現状 `src-tauri/` に `NexusNative-aarch64-apple-darwin` と `translator-aarch64-apple-darwin` あり。
  **Intel(x86_64) 版が無い**ので、Intel Mac / Universal 配布をするなら両アーキ用意が必要。
  - `build:mac` は `uname -m` 依存なので、ビルドする Mac のアーキ分しか作らない点に注意。

## Mac でやること / Tasks

### 1. Swift OCR(`native/mac/main.swift`) を Windows と同等の挙動へ
今回 OCR を改善したのは **Windows 側(`native/win/Program.cs`)のみ**。Swift 側を確認・追随させる:
- 認識言語に英語+日本語を指定（Vision の `recognitionLanguages = ["ja","en"]` 等）し、
  日本語固定にしない。Windows は「日本語結果のCJK数 vs 英語結果のラテン文字数」で自動選択している。
- 出力は **UTF-8 の JSON** `{ "text": "...", "confidence": 0.0 }`（フロント `src/services/NativeService.ts` が UTF-8 前提で解析）。
- 極小選択でクラッシュしないこと（Windows は座標クランプで対処済み。Swift 側も範囲ガードを確認）。
- フロントの mac キャプチャ経路: `src/App.tsx` の `handleScreenshotRequest`（`osName === 'macos'` 分岐, `performMacInteractiveCapture`）。

### 2. translator サイドカー(NLLB/CTranslate2)の mac ビルド元を特定（最優先・未解決）
- `src-tauri/translator-aarch64-apple-darwin` は prebuilt で存在するが、**ビルド手順/ソースがリポジトリに無い**（package.json にも translator のビルドスクリプト無し）。
- 何で生成された何か（CTranslate2+Python? Rust?）、x86_64版の有無、再生成方法を特定する。これが無いと CI 自動ビルドが組めない。

### 3. システムトレイ（メニューバー）の確認
- `src-tauri/src/main.rs` の `setup` でトレイ実装済み（`default_window_icon()` 使用、左クリックで復帰、メニュー「表示/終了」）。
- mac メニューバーでは **テンプレート画像（モノクロ）** が望ましい。表示崩れを確認し、必要なら mac 用アイコン設定を追加。
- クローズ時のトレイ格納は `src/App.tsx`（`onCloseRequested` → hide）で実装済み。mac で意図通り動くか確認。

### 4. 署名 & notarization（配布の要）
- 署名なしは Gatekeeper でブロックされる。Apple Developer ID 証明書、`tauri.conf.json` の `bundle.macOS`（signingIdentity 等）、notarization（Apple ID + app-specific password か API key）。
- CI なら `tauri-action` の署名/notarize env（`APPLE_CERTIFICATE`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` 等）を GitHub Secrets に設定。

### 5. その他確認
- Ollama: mac でも `localhost:11434` の HTTP で同一動作の見込み（capability 設定済み）。
- グローバルショートカット `Alt+Space`（mac は Option+Space）が登録・動作するか。
- `macOSPrivateApi: true` 設定済み（透過/スクショ用）。

## CI（GitHub Actions）の穴
- `.github/workflows/release.yml` は matrix に `macos-latest` を含むが、**サイドカービルドとモデル取得がプレースホルダー**（`mkdir binaries` のみ）。このままでは mac/Windows とも CI ビルドは失敗する。
- 今回の v2.5.0 は **ローカルでビルドした実物**を Release に手動アップロードした（CIは未使用）。
- 直す場合: ジョブに `npm run model:nllb-600m` / `npm run build:mac`(NexusNative) / translator取得（手順確定後）/ tauri.conf の targets 対応 を追加。

## 既知の落とし穴 / Gotchas
- `git checkout` でのブランチ切替時、`src-tauri/models` 配下の大容量ファイルがロックされていると失敗する（Windows で発生）。切替前に dev/サイドカーを停止。今回はチェックアウトを避け `git push origin HEAD:main`（ff）でマージした。
- 生成物（`native/win/bin`,`obj`, `src-tauri/gen/schemas`, ビルド成果物・モデル）はコミットしない（`CONTRIBUTING.md` 参照）。
- NSIS(Windows) は 2GB 超ファイルを梱包できないため、同梱 NLLB は **int8(約623MB)** にしてある（`scripts/download_offline_model.js`）。mac の dmg では制約は異なるが int8 のままで問題ない。

## 参照アーティファクト / Reference artifacts
- `README.md`(EN→JA, 前提条件/ビルド), `CONTRIBUTING.md`, `CONTEXT.md`, `docs/adr/0001`,`0002`
- 主要ファイル: `package.json`(build:mac), `native/mac/main.swift`, `src-tauri/tauri.conf.json`(targets/bundle/署名), `src-tauri/src/main.rs`(tray), `src/App.tsx`(mac capture/close), `src/services/NativeService.ts`(OCR出力パース)
- メモリ(`~/.claude/projects/.../memory/`): `dev-process-cleanup`, `native-aot-vswhere`(Windows専用)

## 推奨スキル / Suggested skills
- `diagnose` … Swift OCR の精度/挙動を、同じ画像で再現ループを作って詰める。
- `improve-codebase-architecture` … Windows(C#)/mac(Swift) の OCR 実装差を共通インターフェースに整理する場合。
- `domain-modeling` … プラットフォーム差や新概念が出たら `CONTEXT.md`/ADR を更新。
- `handoff` … 次セッションへさらに渡す場合。
