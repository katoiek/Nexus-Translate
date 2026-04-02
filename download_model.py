from huggingface_hub import snapshot_download
import argparse
import os

# モデル設定
MODELS = {
    '600m': {
        'repo_id': 'softcatala/nllb-200-distilled-600M-ct2-int8',
        'local_dir': 'src-tauri/models/nllb-200-distilled-600M',
        'description': 'NLLB-200 600M (高速・省メモリ)',
    },
    '1.3b': {
        'repo_id': 'michaelfeil/ct2fast-nllb-200-distilled-1.3B',
        'local_dir': 'src-tauri/models/nllb-200-distilled-1.3B',
        'description': 'NLLB-200 1.3B (高品質)',
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
        choices=['600m', '1.3b', 'both'],
        default='600m',
        help='ダウンロードするモデル (default: 600m)'
    )
    args = parser.parse_args()

    if args.model in ('600m', 'both'):
        download_model('600m')
    if args.model in ('1.3b', 'both'):
        download_model('1.3b')

    print("\n完了しました。")
