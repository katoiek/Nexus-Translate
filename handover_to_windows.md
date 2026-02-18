# Windows版 オフライン翻訳機能実装ハンドオーバー

Mac版で実装された「CTranslate2 + SentencePiece」を用いたオフライン翻訳機能を、Windows環境へ移植・ビルドするための手順書です。

## 1. 前提条件 (Prerequisites)

*   **OS**: Windows 10/11
*   **Dev Tools**:
    *   Visual Studio 2022 (C++ Desktop Development workload)
    *   CMake (3.20+)
    *   Git

## 2. 依存ライブラリの準備

Windowsでは `vcpkg` を使用するか、コンパイル済みのバイナリを手動で配置する必要があります。現在は `native/cpp/CMakeLists.txt` が `FetchContent` パターンではないため、以下のライブラリの `.lib` (インポートライブラリ) と `.dll` (動的リンクライブラリ)、およびヘッダーファイルが必要です。

### 必要なライブラリ
1.  **CTranslate2** (C++ Library)
2.  **SentencePiece** (C++ Library)
3.  **nlohmann/json** (Header only)

### 推奨構成
Mac版とディレクトリ構成を合わせるか、Windows用に調整する必要があります。
```
native/
  cpp/
    libs/
      windows/
        ctranslate2/
          include/
          lib/
          bin/
        sentencepiece/
          include/
          lib/
          bin/
```

## 3. ビルド手順 (Build Steps)

`native/cpp` ディレクトリで PowerShell または Command Prompt を開き、以下のコマンドを実行します。

```powershell
mkdir build
cd build
cmake .. -DCMAKE_BUILD_TYPE=Release -DVCPKG_TARGET_TRIPLET=x64-windows
cmake --build . --config Release
```

**注意**: `CMakeLists.txt` は現在 Mac/Linux 向けの設定が主になっている可能性があります。Windows用の分岐 (`if(WIN32)`) を追加し、ライブラリのリンク設定（`.lib` ファイルの指定）を適切に行う必要があります。

## 4. Electron 連携の確認

`electron/services/OfflineTranslationService.ts` はプラットフォームごとの実行ファイルパスを区別するように実装する必要があります。Macでは `translator` ですが、Windowsでは `translator.exe` となリます。

## 5. 実行に必要なファイル (Runtime Requirements)

ビルド後に生成される `translator.exe` を実行するには、依存するDLLが同じフォルダ（またはPATH）に存在する必要があります。

*   `ctranslate2.dll`
*   `sentencepiece.dll`
*   その他依存DLL (libompなど)

これらを `native/cpp/build/Release/` (または最終的な配置場所) にコピーする処理を `CMakeLists.txt` の post-build command に追加するか、手動でコピーしてください。

## 6. モデルファイル

Mac版と同じモデルファイル (`nllb-200-distilled-600M` フォルダ内) がそのまま使用可能です。

## 7. タスクリスト

1.  [ ] `native/cpp/CMakeLists.txt` を編集し、Windowsビルド設定を追加する。
2.  [ ] 依存ライブラリ (CTranslate2, SentencePiece) のWindows用バイナリを取得・配置する。
3.  [ ] `cmake` & `build` を実行し、`translator.exe` を生成する。
4.  [ ] 実行に必要なDLLを `exe` と同じ場所に配置する。
5.  [ ] アプリを起動し、「Offline (NLLB-200)」を選択して翻訳動作を確認する。
