# Ollama 翻訳は Rust 経由でストリーミングする / Route Ollama translation through Rust for streaming

DeepL ライクな逐次表示（ストリーミング）を確実に実現するため、Ollama の翻訳呼び出しは **Rust 側の Tauri コマンドに置き、生成チャンクを event/channel でフロントへ流す**。Ollama のストリーミングは NDJSON を逐次返すが、フロントの `@tauri-apps/plugin-http` はレスポンスをバッファリングしがちで逐次読み取りが不安定なため。

モデル検出（`/api/tags`）とモデル pull はフロントの `plugin-http` のまま行い、クラウドエンジン（OpenAI/Anthropic/Gemini）も従来どおりフロントから直接叩く。結果として「翻訳経路だけ Ollama は Rust、それ以外はフロント」という非対称が生じるが、ストリーミング確実性を優先した意図的な選択である。

## Consequences

- Ollama 翻訳・クラウド翻訳でコードパスが分かれるため、ストリーミング表示のフロント側受け口は両者で共通化しておくとよい。
- 将来 `plugin-http` のストリーミングが安定すれば、この非対称は解消候補となる（その際は本ADRを supersede する）。
