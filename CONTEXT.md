# Nexus Translate

DeepL ライクな使い心地を目指す、プライバシー重視のデスクトップ翻訳アプリ。
クラウドAI翻訳・ローカル翻訳・OCR・クリップボード監視を備える。
（DeepL-like privacy-focused desktop translation app with cloud AI, local translation, OCR, and clipboard watching.）

## Language

### 翻訳エンジン / Translation Engines

**Engine（翻訳エンジン）**:
ユーザーがドロップダウンで選択する翻訳の実行手段。クラウドAIエンジンとローカルエンジンに大別される。
_Avoid_: Provider, Backend, Service（コード内クラス名としては Service を使うが、ドメイン語としては Engine）

**Bundled Engine（同梱エンジン）**:
アプリにモデルを同梱し、追加セットアップなしで動くローカルエンジン。移行後は **NLLB-600M** のみを最小同梱の「ゼロ設定の既定エンジン」として残す。
_Avoid_: Offline Engine（"offline" はコード上のIDだが、Ollamaもオフライン動作のため曖昧。同梱か否かで区別する）

**Ollama Engine（Ollamaエンジン）**:
ユーザーPCに既にインストールされた Ollama を介して動くローカルエンジン。HTTP API（`localhost:11434`）経由。メインのエンジン選択には「Ollama」が1つだけ並び、使用モデルは設定メニューのドロップダウンで選ぶ。
_Avoid_: Local LLM（Hy-MT2も従来Local LLMと呼んでいたため曖昧）

**Translation-capable Model（翻訳可能モデル）**:
Ollama のモデルのうち、翻訳に使えるチャット/生成モデル。設定ドロップダウンにはこれだけを載せる（埋め込み専用モデル等はベストエフォートで除外）。未pullの場合は翻訳に強い多言語モデル（`qwen2.5`, `aya`, `gemma2` 等）をワンクリックpullで案内する。
_Avoid_: Available Model（"available" だと埋め込み系も含むため）

**Cloud Engine（クラウドエンジン）**:
外部APIへテキストを送信して翻訳するエンジン。OpenAI / Anthropic Claude / Google Gemini。
_Avoid_: External AI, Online Engine

### AI機能 / AI Features

LLMの生成能力を活かした拡張機能群。**Ollama / クラウドエンジン選択時のみ有効**で、翻訳専用の NLLB-600M 選択時は無効（グレーアウト）。

**Tone Adjustment（トーン・丁寧さ調整）**:
訳文のトーン（フォーマル/カジュアル、ビジネス/口語など）を切り替える機能。

**Rephrase（言い換え・文章改善）**:
原文または訳文を、より自然・簡潔に書き直す機能（DeepL Write 相当）。

**Alternatives（代替案・詳細説明）**:
複数の訳し方の提示、ニュアンス説明、語意解説。

**Glossary（用語集）**:
「この語は必ずこう訳す」を登録し翻訳に反映する機能。LLMエンジンへはプロンプト注入で反映する。
_Avoid_: Dictionary, Terminology DB

**Fallback（フォールバック）**:
選択中のエンジンが使えないとき、翻訳を自動で代替エンジンに切り替える挙動。Ollama未接続時は NLLB-600M（または直近のクラウド）へ自動切替し、ノンブロッキングで通知する。設定画面では未接続の原因（未インストール/未起動/モデル0）を出し分けて案内する。

### 廃止済み / Removed

**Hy-MT2 Local**:
同梱 `llama-cli` + GGUF を翻訳のたびに毎回プロセス起動していた旧ローカルLLMエンジン。Ollama移行に伴い**削除済み**（コード・スクリプト・同梱物すべて）。

**NLLB-1.3B (Offline HQ)**:
高品質だが巨大な同梱CTranslate2モデル。Ollama移行に伴い**削除済み**。
