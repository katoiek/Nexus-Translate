fn main() {
    // binaries/ 以下のファイルが変更されたら再実行（サイドカーバイナリの更新を確実に反映）
    println!("cargo:rerun-if-changed=binaries/");
    tauri_build::build()
}
