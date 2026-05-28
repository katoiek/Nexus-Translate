# Nexus Translate 引き継ぎメモ 2026-05-29

## 目的

Tauri版 Nexus Translate のローカル翻訳エンジンとWindows OCRキャプチャの修正状況を、次のセッションで迷わず継続できるようにまとめる。

## 現在のブランチとコミット

- 作業ブランチ: `codex/wohy-mt2-local-llm`
- リモート: `origin/codex/wohy-mt2-local-llm`
- 最新コミット: `45f374e fix: ローカル翻訳とOCRキャプチャを修正`
- PR作成URL: `https://github.com/katoiek/Nexus-Translate/pull/new/codex/wohy-mt2-local-llm`

## 直近で解決したこと

- NLLB 600M / 1.3B のモデル配置とダウンロードスクリプトを修正。
- NLLB 1.3B の `sentencepiece.bpe.model` 404 を、参照リポジトリ変更で解消。
- Hy-MT2 Local をTauri/Rust経由で実行する構成に変更。
- Hy-MT2 Local の出力にプロンプトや原文が混ざる問題を、Rust側の出力クリーニングで軽減。
- Windows OCRで末尾文字が欠ける問題に対して、ネイティブ側キャプチャ範囲に16px余白を追加。
- Windows OCRの不要な日本語空白を `src/services/NativeService.ts` で後処理。
- Tauriの選択オーバーレイを表示したままOCRしていた問題を修正。`src/App.tsx` でキャプチャ前にスクリーンショット用ウィンドウを隠し、80ms待機してから実画面を撮るようにした。

## 重要ファイル

- `src-tauri/src/main.rs`
  - Hy-MT2 Local の `translate_hymt2_local` コマンド、llama-cli探索、モデル探索、出力クリーニング。
- `src/services/HyMT2TranslationService.ts`
  - フロント側からRustコマンドを呼ぶHy-MT2 Localサービス。
- `src/services/OfflineTranslationService.ts`
  - NLLBモデル存在チェック、共有語彙ファイル対応、起動タイムアウト。
- `scripts/download_1.3b_model.js`
  - NLLB 1.3B の修正済みダウンローダー。
- `scripts/download_hymt2_model.js`
  - Hy-MT2モデル取得。
- `scripts/download_llama_cpp.js`
  - llama.cppランタイム取得。
- `native/win/Program.cs`
  - Windows OCRキャプチャ、余白追加、画像拡大前処理。
- `src/App.tsx`
  - OCR前に選択オーバーレイを隠す修正。
- `src/services/NativeService.ts`
  - OCR結果の日本語空白整形。

## 検証済みコマンド

```powershell
npm run build:win-native
npm run build:tauri
npm run lint
cargo check
```

`cargo check` や `tauri dev` が `PermissionDenied` になる場合は、ワークスペース配下で起動中のsidecar/アプリを止めてから再実行する。

```powershell
$workspace = (Resolve-Path '.').Path
Get-Process | Where-Object { $_.Path -and ($_.Path.StartsWith($workspace)) } | Stop-Process -Force
```

## 注意点

- 作業ツリーには `native/win/bin`、`native/win/obj`、`src-tauri/gen/schemas` の生成物差分が残っている。直近コミットには含めていない。
- `src-tauri/models` は以前Git上でシンボリックリンクとして追跡されていたが、現在は実ディレクトリと `.gitkeep` に変更した。巨大モデル本体はコミット対象外。
- Windows OCRはOS標準の `Windows.Media.Ocr` を使っているため、太字日本語や濁点の精度には限界がある。

## 次に見るべき課題

- 添付動画 `C:\Users\katoi\Downloads\レコーディング 2026-05-28 163817.mp4` で、OCR精度がまだ悪い場面を再確認する。
- まず `npm run tauri dev` で、オーバーレイ非表示修正後のOCR結果を実機確認する。
- まだ誤認識が多い場合は、Windows OCRの前処理をさらに調整する。
  - 白背景・黒文字へ二値化する経路を試す。
  - 拡大倍率を固定または上限調整する。
  - 小さい文字向けと太字向けで前処理を分岐する。
- 精度要求が高い場合は、Windows.Media.OcrだけでなくPaddleOCRなどの任意エンジン追加を検討する。

## 推奨スキル

- `diagnose`
  - OCR精度改善は、同じ画像・同じ矩形で再現可能なフィードバックループを作って進めるのがよい。
- `handoff`
  - 次回さらに状態を渡す場合に使う。
- `improve-codebase-architecture`
  - OCRエンジン差し替えや前処理パイプライン化を行う場合に使う。
