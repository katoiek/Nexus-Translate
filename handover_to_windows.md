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
`src-tauri/tauri.conf.json` の `bundle > externalBin` に `translator` と `NexusNative` が含まれていることを確認してください。

## 4. Tauri v2 への移行
アプリケーションを Electron から **Tauri v2** へ移行しました。これに伴い、以下のバイナリを `src-tauri/binaries` に配置する必要があります。
- `translator-x86_64-pc-windows-msvc.exe` (C++): `native/cpp/build/translator.exe`
- `NexusNative-x86_64-pc-windows-msvc.exe` (OCR): `native/win/bin/Release/...`

## 5. リソースパスと準備
モデル解決のため、`src-tauri` 内にジャンクションを作成してください：
```powershell
mklink /J src-tauri\models native\models
```

## 6. 最新の修正内容 (v2.0.1)
- **DPIスケーリング対応**: Retina/4Kなどの高解像度モニタでもスクショ範囲がずれないよう修正しました。
- **日本語OCR空白除去**: Windows OCRの結果に含まれる日本語内の不要なスペースを自動的に除去します。
- **リリースビルドの成功**: `npm run tauri build` によりモデル同梱のインストーラー生成を確認済み。

## 7. タスクリスト
1. [x] Tauri v2 / Sidecar の実装。
2. [x] モデル配置用ジャンクションの作成。
3. [x] 翻訳およびスクショOCRの動作確認完了。
4. [x] リリース用インストーラー (.exe) のビルド成功。
