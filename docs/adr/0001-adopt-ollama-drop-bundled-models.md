# Ollama を採用し重量級の同梱モデルを廃止する / Adopt Ollama and drop heavy bundled models

巨大モデル（Hy-MT2 1.8B GGUF、NLLB-1.3B CTranslate2）をアプリに同梱・配布する方式は、ビルド・配布・更新コストが高く保守が重い。代わりに、ユーザーPCに既にインストールされた **Ollama** を HTTP API（`http://localhost:11434`）経由で利用し、ユーザーが pull 済みのモデルを設定ドロップダウンから選ぶ方式へ移行する。`Hy-MT2 Local` と `Offline HQ (NLLB-1.3B)` は廃止する。

ただし「インストールすればすぐ動く」体験を守るため、軽量な **NLLB-600M のみ最小同梱**を継続し、Ollama 未導入時のゼロ設定既定エンジン兼フォールバック先とする。

## Considered Options

- **全モデル同梱継続**: 配布物が肥大化し更新が重い。却下。
- **完全 Ollama 一本化（同梱ゼロ）**: 最軽量だが、Ollama 未導入の初回ユーザーがオフライン翻訳不可になりUX後退。却下。
- **NLLB-600M のみ同梱 + Ollama 併用**（採用）: 後退なしで移行でき、配布物も大幅に軽量化。

## Consequences

- Ollama で入る汎用LLM（llama3/qwen/gemma 等）は翻訳専用モデルより出力が不安定なことがあり、プロンプト設計と「翻訳向きモデル」の案内が品質の鍵になる。
- Ollama 未インストール/未起動/モデル0個の状態を設定画面で出し分け、翻訳時は自動フォールバックする必要がある。
