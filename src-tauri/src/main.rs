#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
  collections::HashSet,
  fs,
  path::{Path, PathBuf},
  process::{Command, Stdio},
  thread,
  time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

const HYMT2_MODEL_DIR: &str = "hymt2-1.8b-gguf";
const HYMT2_MODEL_FILE: &str = "Hy-MT2-1.8B-Q4_K_M.gguf";
const HYMT2_TIMEOUT: Duration = Duration::from_secs(180);

#[tauri::command]
fn translate_hymt2_local(app: AppHandle, prompt: String) -> Result<String, String> {
  let resource_dir = app
    .path()
    .resource_dir()
    .map_err(|error| format!("リソースディレクトリを解決できませんでした: {error}"))?;
  let exe_dir = std::env::current_exe()
    .ok()
    .and_then(|path| path.parent().map(Path::to_path_buf));

  let llama_cli = find_llama_cli(&resource_dir, exe_dir.as_deref())
    .ok_or_else(|| "llama-cli sidecar が見つかりません。npm run prepare:hymt2 を実行してください。".to_string())?;
  let model_path = find_hymt2_model(&resource_dir, exe_dir.as_deref())
    .ok_or_else(|| format!("Hy-MT2 モデルが見つかりません: models/{HYMT2_MODEL_DIR}/{HYMT2_MODEL_FILE}"))?;
  let prompt_path = write_prompt_file(&prompt)?;

  let output = run_llama_cli(&llama_cli, &model_path, &prompt_path);
  let _ = fs::remove_file(&prompt_path);

  let output = output?;
  let translated = clean_hymt2_output(&output, &prompt);
  if translated.trim().is_empty() {
    return Err("Hy-MT2 から翻訳結果が返りませんでした。".to_string());
  }

  Ok(translated)
}

fn find_llama_cli(resource_dir: &Path, exe_dir: Option<&Path>) -> Option<PathBuf> {
  let mut candidates = Vec::new();
  let names = if cfg!(windows) {
    vec!["llama-cli.exe", "llama-cli-x86_64-pc-windows-msvc.exe"]
  } else if cfg!(target_os = "macos") {
    vec!["llama-cli", "llama-cli-aarch64-apple-darwin", "llama-cli-x86_64-apple-darwin"]
  } else {
    vec!["llama-cli"]
  };

  for name in &names {
    candidates.push(resource_dir.join(name));
    if let Some(dir) = exe_dir {
      candidates.push(dir.join(name));
    }
  }

  candidates.into_iter().find(|path| path.exists())
}

fn find_hymt2_model(resource_dir: &Path, exe_dir: Option<&Path>) -> Option<PathBuf> {
  let relative_model = Path::new("models").join(HYMT2_MODEL_DIR).join(HYMT2_MODEL_FILE);
  let mut candidates = vec![resource_dir.join(&relative_model)];
  if let Some(dir) = exe_dir {
    candidates.push(dir.join(&relative_model));
  }

  candidates.into_iter().find(|path| path.exists())
}

fn write_prompt_file(prompt: &str) -> Result<PathBuf, String> {
  let timestamp = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map_err(|error| format!("時刻の取得に失敗しました: {error}"))?
    .as_millis();
  let path = std::env::temp_dir().join(format!(
    "nexus-hymt2-prompt-{}-{timestamp}.txt",
    std::process::id()
  ));
  fs::write(&path, prompt).map_err(|error| format!("プロンプトファイルを書き込めませんでした: {error}"))?;
  Ok(path)
}

fn run_llama_cli(llama_cli: &Path, model_path: &Path, prompt_path: &Path) -> Result<String, String> {
  let mut child = Command::new(llama_cli)
    .current_dir(
      llama_cli
        .parent()
        .ok_or_else(|| "llama-cli の親ディレクトリを解決できませんでした。".to_string())?,
    )
    .args([
      "-m",
      &model_path.to_string_lossy(),
      "-f",
      &prompt_path.to_string_lossy(),
      "-n",
      "4096",
      "--temp",
      "0.7",
      "--top-p",
      "0.6",
      "--no-display-prompt",
      "--single-turn",
      "--no-warmup",
      "--no-perf",
      "--log-disable",
    ])
    .stdin(Stdio::null())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()
    .map_err(|error| format!("llama-cli を起動できませんでした: {error}"))?;

  let start = SystemTime::now();
  loop {
    if child
      .try_wait()
      .map_err(|error| format!("llama-cli の状態確認に失敗しました: {error}"))?
      .is_some()
    {
      let output = child
        .wait_with_output()
        .map_err(|error| format!("llama-cli の出力取得に失敗しました: {error}"))?;
      if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("llama-cli が失敗しました: {stderr}"));
      }
      return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    }

    if start.elapsed().unwrap_or_default() > HYMT2_TIMEOUT {
      let _ = child.kill();
      return Err(format!(
        "Hy-MT2 translation timeout ({}s).",
        HYMT2_TIMEOUT.as_secs()
      ));
    }

    thread::sleep(Duration::from_millis(100));
  }
}

fn clean_hymt2_output(output: &str, prompt: &str) -> String {
  let prompt_lines: HashSet<String> = prompt
    .lines()
    .map(|line| normalize_model_line(line))
    .filter(|line| !line.is_empty())
    .collect();

  let normalized = strip_ansi(output)
    .replace("[end of text]", "")
    .replace("[end_of_text]", "")
    .replace("</s>", "")
    .replace('\r', "");

  let lines: Vec<&str> = normalized.lines().collect();
  let prompt_index = lines.iter().rposition(|line| line.trim_start().starts_with("> "));
  let candidate_lines = match prompt_index {
    Some(index) => &lines[index + 1..],
    None => &lines[..],
  };

  candidate_lines
    .iter()
    .map(|line| normalize_model_line(line))
    .filter(|line| {
      !line.is_empty()
        && !prompt_lines.contains(line)
        && !is_prompt_echo_line(line, &prompt_lines)
        && !(line.starts_with('[') && line.contains("Generation:"))
        && line.as_str() != "Exiting..."
        && line.as_str() != "Loading model..."
        && !line.starts_with("build      :")
        && !line.starts_with("model      :")
        && !line.starts_with("modalities :")
        && line.as_str() != "available commands:"
        && !line.starts_with('/')
    })
    .collect::<Vec<String>>()
    .join("\n")
    .trim()
    .to_string()
}

fn normalize_model_line(line: &str) -> String {
  line.trim().trim_start_matches("> ").trim().to_string()
}

fn is_prompt_echo_line(line: &str, prompt_lines: &HashSet<String>) -> bool {
  if line.contains("(truncated)") {
    return true;
  }

  // llama-cli は長いプロンプトを途中で省略表示することがあるため、
  // 完全一致だけでなく、プロンプト行の先頭と大きく一致する行も除外する。
  prompt_lines.iter().any(|prompt_line| {
    let common_prefix_len = line
      .chars()
      .zip(prompt_line.chars())
      .take_while(|(left, right)| left == right)
      .count();
    common_prefix_len >= 24 && common_prefix_len * 2 >= line.chars().count()
  })
}

fn strip_ansi(input: &str) -> String {
  let mut output = String::with_capacity(input.len());
  let mut chars = input.chars().peekable();

  while let Some(ch) = chars.next() {
    if ch == '\u{1b}' && chars.peek() == Some(&'[') {
      chars.next();
      for next in chars.by_ref() {
        if next == 'm' {
          break;
        }
      }
    } else {
      output.push(ch);
    }
  }

  output
}

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .plugin(tauri_plugin_os::init())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_process::init())
    .invoke_handler(tauri::generate_handler![translate_hymt2_local])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
