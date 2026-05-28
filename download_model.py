from huggingface_hub import snapshot_download
import argparse
import os

# モデル設定
MODELS = {
    '600m': {
        'repo_id': 'JustFrederik/nllb-200-distilled-600M-ct2',
        'local_dir': 'src-tauri/models/nllb-200-distilled-600M',
        'description': 'NLLB-200 600M (高速・省メモリ)',
    },
    '1.3b': {
        'repo_id': 'entai2965/nllb-200-distilled-1.3B-ctranslate2',
        'local_dir': 'src-tauri/models/nllb-200-distilled-1.3B',
        'description': 'NLLB-200 1.3B (高品質)',
    },
    'hymt2': {
        'repo_id': 'tencent/Hy-MT2-1.8B-GGUF',
        'local_dir': 'src-tauri/models/hymt2-1.8b-gguf',
        'description': 'Tencent Hy-MT2 1.8B Q4_K_M GGUF (同梱ローカルLLM)',
        'allow_patterns': ['Hy-MT2-1.8B-Q4_K_M.gguf', '*.json', '*.md'],
    },
}

def download_model(model_key: str):
    cfg = MODELS[model_key]
    print(f"\n[{model_key}] {cfg['description']} をダウンロードします...")
    print(f"  リポジトリ: {cfg['repo_id']}")
    print(f"  保存先: {cfg['local_dir']}")

    os.makedirs(cfg['local_dir'], exist_ok=True)

    try:
        snapshot_download(
            repo_id=cfg['repo_id'],
            local_dir=cfg['local_dir'],
            local_dir_use_symlinks=False,
            allow_patterns=cfg.get('allow_patterns'),
        )
        print(f"[{model_key}] ダウンロード完了: {cfg['local_dir']}")
    except Exception as e:
        print(f"[{model_key}] ダウンロード失敗: {e}")
        print(f"  HuggingFace にアクセスできるか確認してください。")
        raise

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description='Nexus Translate 翻訳モデルダウンローダー'
    )
    parser.add_argument(
        '--model',
        choices=['600m', '1.3b', 'hymt2', 'both', 'all'],
        default='600m',
        help='ダウンロードするモデル (default: 600m)'
    )
    args = parser.parse_args()

    if args.model in ('600m', 'both', 'all'):
        download_model('600m')
    if args.model in ('1.3b', 'both', 'all'):
        download_model('1.3b')
    if args.model in ('hymt2', 'all'):
        download_model('hymt2')

    print("\n完了しました。")
