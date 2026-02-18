from huggingface_hub import snapshot_download
import os

model_id = "softcatala/nllb-200-distilled-600M-ct2-int8"
local_dir = "native/models/nllb-200-distilled-600M"

snapshot_download(
    repo_id=model_id,
    local_dir=local_dir,
    local_dir_use_symlinks=False
)
print(f"Downloaded model to {local_dir}")
