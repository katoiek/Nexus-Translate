# Windows版 オフライン翻訳機能実装ハンドオーバー

Mac版で実装された「CTranslate2 + SentencePiece」を用いたオフライン翻訳機能を、Windows環境へ移植・ビルドするための手順書です。

## 1. 前提条件 (Prerequisites)

*   **OS**: Windows 10/11
*   **Dev Tools**:
    *   Visual Studio 2026 community (C++ Desktop Development workload)
    *   CMake (3.20+)
    *   Git

## 2. 依存ライブラリの準備

 `native/cpp/CMakeLists.txt` を更新し、`FetchContent` を使用して自動的に依存ライブラリ（`nlohmann/json`, `CTranslate2`, `SentencePiece`）をダウンロード・ビルドするように変更しました。

 **手動でのライブラリ配置は不要です。** ビルド時に自動的に取得されます。

 ## 3. ビルド手順 (Build Steps)

 `native/cpp` ディレクトリで PowerShell または Command Prompt を開き、以下のコマンドを実行します。

 ```powershell
 mkdir build
 cd build
 # 静的リンク(Static Linking)を有効にしてビルドします
 cmake .. -DCMAKE_BUILD_TYPE=Release
 cmake --build . --config Release
 ```

 ## 4. Electron 連携の確認

 `electron/services/OfflineTranslationService.ts` はプラットフォームを判別し、Windowsでは `translator.exe` を使用するように実装済みです。

 ## 5. 実行に必要なファイル (Runtime Requirements)

 `CMakeLists.txt` で `BUILD_SHARED_LIBS OFF` を設定しているため、基本的には `translator.exe` 単体（または少数のDLL）で動作するはずです。

 生成場所: `native/cpp/build/Release/translator.exe`

 *注意*: もし実行時にDLLエラーが出る場合は、`build/Release` フォルダにある `.dll` ファイルを `translator.exe` と同じ場所に配置してください。

 ## 6. モデルファイル

 Mac版と同じモデルファイル (`native/models/nllb-200-distilled-600M` フォルダ内) が必要です。
 Windows環境でも同じパス構造 (`native/models/...`) にモデルファイルを配置してください。

 ## 7. タスクリスト

 1.  [x] `native/cpp/CMakeLists.txt` をWindows対応（FetchContent化、静的リンク設定）に更新済み。
 2.  [ ] `cmake` & `build` を実行し、`translator.exe` を生成する。
 3.  [ ] （必要であれば）DLLを `exe` と同じ場所に配置する。
 4.  [ ] アプリを起動し、「Offline (NLLB-200)」を選択して翻訳動作を確認する。
