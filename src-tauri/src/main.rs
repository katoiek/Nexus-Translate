#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Ollama 連携コマンド / Ollama integration commands
//
// 翻訳とモデル pull はストリーミングが必要なため Rust 側で reqwest を使い、
// 生成チャンクを Tauri の Channel でフロントへ逐次送る。
// （Translation and model pull need streaming, so we use reqwest here and
//  push chunks to the frontend through a Tauri Channel.）

use futures_util::StreamExt;
use serde::Serialize;
use serde_json::json;
use tauri::ipc::Channel;
use tauri::Manager;

// 翻訳ストリームのイベント / Translation stream events
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "type")]
enum TranslateEvent {
  Chunk { content: String },
  Done { full: String },
  Error { message: String },
}

// モデル pull ストリームのイベント / Model pull stream events
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "type")]
enum PullEvent {
  Progress {
    status: String,
    completed: Option<u64>,
    total: Option<u64>,
  },
  Done,
  Error { message: String },
}

fn normalize_base_url(base_url: &str) -> String {
  let trimmed = base_url.trim().trim_end_matches('/');
  if trimmed.is_empty() {
    "http://localhost:11434".to_string()
  } else {
    trimmed.to_string()
  }
}

// レスポンスボディを改行区切りJSON(NDJSON)として読み、各行をコールバックへ渡す。
// コールバックが true を返した時点で読み取りを終了する。
// （Read the response body as newline-delimited JSON and pass each parsed line to the
//  callback. Stop reading once the callback returns true.）
async fn for_each_ndjson_line<F>(resp: reqwest::Response, mut on_value: F) -> Result<(), String>
where
  F: FnMut(serde_json::Value) -> bool,
{
  let mut stream = resp.bytes_stream();
  let mut buffer = String::new();

  while let Some(chunk) = stream.next().await {
    let bytes = chunk.map_err(|e| format!("Ollama ストリームの読み取りに失敗しました: {e}"))?;
    buffer.push_str(&String::from_utf8_lossy(&bytes));

    while let Some(pos) = buffer.find('\n') {
      let line: String = buffer.drain(..=pos).collect();
      let trimmed = line.trim();
      if trimmed.is_empty() {
        continue;
      }
      if let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) {
        if on_value(value) {
          return Ok(());
        }
      }
    }
  }

  Ok(())
}

// Ollama の /api/chat をストリーミングで叩き、訳文チャンクを Channel に流す。
// （Stream Ollama /api/chat and forward translated chunks to the Channel.）
#[tauri::command]
async fn ollama_translate(
  base_url: String,
  model: String,
  system: String,
  prompt: String,
  temperature: Option<f64>,
  on_event: Channel<TranslateEvent>,
) -> Result<(), String> {
  let url = format!("{}/api/chat", normalize_base_url(&base_url));
  let body = json!({
    "model": model,
    "stream": true,
    "messages": [
      { "role": "system", "content": system },
      { "role": "user", "content": prompt }
    ],
    "options": {
      "temperature": temperature.unwrap_or(0.3)
    }
  });

  let client = reqwest::Client::new();
  let resp = match client.post(&url).json(&body).send().await {
    Ok(r) => r,
    Err(e) => {
      let message = format!("Ollama へ接続できませんでした: {e}");
      let _ = on_event.send(TranslateEvent::Error { message: message.clone() });
      return Err(message);
    }
  };

  if !resp.status().is_success() {
    let status = resp.status();
    let detail = resp.text().await.unwrap_or_default();
    let message = format!("Ollama がエラーを返しました (HTTP {status}): {detail}");
    let _ = on_event.send(TranslateEvent::Error { message: message.clone() });
    return Err(message);
  }

  let mut full = String::new();
  let outcome = for_each_ndjson_line(resp, |value| {
    if let Some(content) = value["message"]["content"].as_str() {
      if !content.is_empty() {
        full.push_str(content);
        let _ = on_event.send(TranslateEvent::Chunk {
          content: content.to_string(),
        });
      }
    }
    // done フラグで終了 / Stop on the done flag
    value["done"].as_bool().unwrap_or(false)
  })
  .await;

  match outcome {
    // done フラグ・自然終了どちらも完了として扱う / done flag or natural EOF both complete
    Ok(()) => {
      let _ = on_event.send(TranslateEvent::Done { full });
      Ok(())
    }
    Err(message) => {
      let _ = on_event.send(TranslateEvent::Error { message: message.clone() });
      Err(message)
    }
  }
}

// Ollama の /api/tags を叩いてモデル一覧JSONを返す。
// フロントの plugin-http から直接叩くと本番(WebView origin = http://tauri.localhost)では
// Ollama が CORS で 403 を返すため、origin ヘッダを送らない Rust(reqwest)経由で取得する。
// （Fetch /api/tags from Rust. The frontend plugin-http sends the webview Origin
//  (http://tauri.localhost in production), which Ollama rejects with 403. reqwest
//  doesn't attach an Origin header, so this path works in release builds too.）
#[tauri::command]
async fn ollama_tags(base_url: String) -> Result<serde_json::Value, String> {
  let url = format!("{}/api/tags", normalize_base_url(&base_url));
  let client = reqwest::Client::new();
  let resp = client
    .get(&url)
    .timeout(std::time::Duration::from_secs(3))
    .send()
    .await
    .map_err(|e| format!("Ollama へ接続できませんでした: {e}"))?;

  if !resp.status().is_success() {
    return Err(format!("Ollama がエラーを返しました (HTTP {})", resp.status()));
  }

  resp
    .json::<serde_json::Value>()
    .await
    .map_err(|e| format!("Ollama 応答の解析に失敗しました: {e}"))
}

// Ollama の /api/pull をストリーミングで叩き、進捗を Channel に流す。
// （Stream Ollama /api/pull and forward progress to the Channel.）
#[tauri::command]
async fn ollama_pull(
  base_url: String,
  model: String,
  on_event: Channel<PullEvent>,
) -> Result<(), String> {
  let url = format!("{}/api/pull", normalize_base_url(&base_url));
  let body = json!({ "model": model, "stream": true });

  let client = reqwest::Client::new();
  let resp = match client.post(&url).json(&body).send().await {
    Ok(r) => r,
    Err(e) => {
      let message = format!("Ollama へ接続できませんでした: {e}");
      let _ = on_event.send(PullEvent::Error { message: message.clone() });
      return Err(message);
    }
  };

  if !resp.status().is_success() {
    let status = resp.status();
    let detail = resp.text().await.unwrap_or_default();
    let message = format!("Ollama がエラーを返しました (HTTP {status}): {detail}");
    let _ = on_event.send(PullEvent::Error { message: message.clone() });
    return Err(message);
  }

  let mut pull_error: Option<String> = None;
  let outcome = for_each_ndjson_line(resp, |value| {
    if let Some(error) = value["error"].as_str() {
      let _ = on_event.send(PullEvent::Error {
        message: error.to_string(),
      });
      pull_error = Some(error.to_string());
      return true; // エラー行で終了 / stop on an error line
    }
    let status = value["status"].as_str().unwrap_or("").to_string();
    let _ = on_event.send(PullEvent::Progress {
      status,
      completed: value["completed"].as_u64(),
      total: value["total"].as_u64(),
    });
    false
  })
  .await;

  match outcome {
    Err(message) => {
      let _ = on_event.send(PullEvent::Error { message: message.clone() });
      Err(message)
    }
    Ok(()) => match pull_error {
      Some(message) => Err(message),
      None => {
        let _ = on_event.send(PullEvent::Done);
        Ok(())
      }
    },
  }
}

// メインウィンドウを表示して前面に出す（トレイから復帰する時に使う）。
// / Show and focus the main window (used when restoring from the tray).
fn show_main_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
  }
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
    .setup(|app| {
      use tauri::menu::{Menu, MenuItem};
      use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

      // トレイメニュー: 表示 / 終了 / Tray menu: Show / Quit
      let show_item = MenuItem::with_id(app, "show", "表示 / Show", true, None::<&str>)?;
      let quit_item = MenuItem::with_id(app, "quit", "終了 / Quit", true, None::<&str>)?;
      let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

      let mut builder = TrayIconBuilder::with_id("main-tray")
        .tooltip("Nexus Translate")
        .menu(&menu)
        // 左クリックはメニューではなくウィンドウ復帰に使う
        // / Left click restores the window instead of opening the menu
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
          "show" => show_main_window(app),
          "quit" => app.exit(0),
          _ => {}
        })
        .on_tray_icon_event(|tray, event| {
          if let TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
          } = event
          {
            show_main_window(tray.app_handle());
          }
        });

      if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
      }

      // ドロップで消えないよう管理ステートに保持 / Keep alive so the icon isn't dropped
      let tray = builder.build(app)?;
      app.manage(tray);

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![ollama_translate, ollama_pull, ollama_tags])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
