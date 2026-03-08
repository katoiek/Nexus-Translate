# Windows版 オフライン翻訳機能実装ハンドオーバー (Tauri v2版)

Mac版で修正・完了した「CTranslate2 + SentencePiece」を用いたオフライン翻訳機能を、Windows環境へ移植・ビルドするための手順書です。

## 1. 前提条件 (Prerequisites)

*   **OS**: Windows 10/11
*   **Dev Tools**:
    *   Visual Studio 2022 (C++ によるデスクトップ開発 ワークロードが必要)
    *   CMake (3.20+)
    *   Git

## 2. ネイティブバイナリのビルド (translator.exe)

`native/cpp/CMakeLists.txt` は `FetchContent` を使用しており、依存ライブラリは自動取得されます。

1.  `native/cpp` ディレクトリで PowerShell 等を開く。
2.  以下のコマンドでビルド：
    ```powershell
    mkdir build
    cd build
    cmake .. -DCMAKE_BUILD_TYPE=Release
    cmake --build . --config Release
    ```
3.  生成された `native/cpp/build/Release/translator.exe` を確認。

## 3. Tauri 連携の設定確認

### セキュリティ権限 (Capabilities)
`src-tauri/capabilities/default.json` において、`fs` (ファイルシステム) の権限を拡大しています。Windows版でもモデルファイルを読み込むために必要です。

### 実行ファイルの設定
`src-tauri/tauri.conf.json` の `bundle > externalBin` に `translator` が含まれていることを確認してください。

## 4. モデルファイルの配置

Mac版と同じモデルファイルが必要です。
`native/models/nllb-200-distilled-600M`

## 5. パス解決のロジック (OfflineTranslationService.ts)

現在のロジックは以下の優先順位でモデルを探します：
1.  **絶対パス優先 (開発用)**: `/Users/kei.kato/...` (Mac用) がハードコードされています。**Windowsで開発する場合は、ここを自分の環境の絶対パスに書き換えるか、コメントアウトしてください。**
2.  **標準リソース解決**: `resolveResource` を使用します。ビルド済みアプリではこれがメインになります。

## 6. Windows版での検証タスク

1.  [ ] `translator.exe` をビルドする。
2.  [ ] `native/models` ディレクトリが存在し、モデルが配置されていることを確認。
3.  [ ] `npm run tauri dev` を実行。
4.  [ ] オフライン翻訳が動作することを確認（ログに `Found model at...` と出れば成功）。
