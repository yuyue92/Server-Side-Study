use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{Mutex, Notify};

// ── Constants ──────────────────────────────────────────────────────────────────
const CHUNK_SIZE: usize = 1024 * 1024; // 1 MB
const DEFAULT_PORT: u16 = 8848;

// ── Protocol messages (JSON over TCP, newline-delimited) ──────────────────────
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Message {
    FileOffer {
        file_name: String,
        file_size: u64,
        file_hash: String, // SHA-256 of full file, hex
        transfer_id: String,
    },
    Accept {
        transfer_id: String,
    },
    Reject {
        transfer_id: String,
        reason: String,
    },
    Chunk {
        transfer_id: String,
        index: u64,
        total: u64,
        data: String, // base64-encoded chunk
    },
    Done {
        transfer_id: String,
    },
    Error {
        message: String,
    },
    Ping,
    Pong,
}

fn encode_msg(msg: &Message) -> Result<Vec<u8>> {
    let mut bytes = serde_json::to_vec(msg)?;
    bytes.push(b'\n');
    Ok(bytes)
}

async fn read_msg(stream: &mut TcpStream) -> Result<Message> {
    let mut buf = Vec::new();
    let mut byte = [0u8; 1];
    loop {
        let n = stream.read(&mut byte).await?;
        if n == 0 {
            anyhow::bail!("Connection closed");
        }
        if byte[0] == b'\n' {
            break;
        }
        buf.push(byte[0]);
    }
    let msg: Message = serde_json::from_slice(&buf)?;
    Ok(msg)
}

// ── App state ─────────────────────────────────────────────────────────────────
#[derive(Debug, Default)]
pub struct AppState {
    pub connection: Mutex<Option<Arc<Mutex<TcpStream>>>>,
    pub local_ip: Mutex<String>,
    pub pending_offer: Mutex<Option<Message>>,        // offer waiting for user confirmation
    pub offer_decision: Mutex<HashMap<String, bool>>, // transfer_id → accept/reject
    pub offer_notify: Arc<Notify>,
}

// ── Frontend event payloads ────────────────────────────────────────────────────
#[derive(Serialize, Clone)]
struct ProgressEvent {
    transfer_id: String,
    file_name: String,
    file_size: u64,
    transferred: u64,
    speed_bps: u64, // bytes per second
}

#[derive(Serialize, Clone)]
struct OfferEvent {
    transfer_id: String,
    file_name: String,
    file_size: u64,
}

#[derive(Serialize, Clone)]
struct StatusEvent {
    status: String,
    message: String,
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Returns the local LAN IP:port string.
#[tauri::command]
async fn get_local_address(state: State<'_, Arc<AppState>>) -> Result<String, String> {
    let ip = state.local_ip.lock().await.clone();
    Ok(format!("{}:{}", ip, DEFAULT_PORT))
}

/// Start listening for incoming connections (runs a background task).
#[tauri::command]
async fn start_listener(app: AppHandle, state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let addr = format!("0.0.0.0:{}", DEFAULT_PORT);
    let listener = TcpListener::bind(&addr).await.map_err(|e| e.to_string())?;

    // Resolve local IP
    let local_ip = local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string());
    *state.local_ip.lock().await = local_ip.clone();

    let app_clone = app.clone();
    let state_arc = Arc::clone(app.state::<Arc<AppState>>().inner());

    tokio::spawn(async move {
        loop {
            match listener.accept().await {
                Ok((stream, peer_addr)) => {
                    log::info!("Incoming connection from {}", peer_addr);
                    let app2 = app_clone.clone();
                    let state2 = state_arc.clone();
                    tokio::spawn(handle_incoming(app2, state2, stream, peer_addr));
                }
                Err(e) => {
                    log::error!("Accept error: {}", e);
                }
            }
        }
    });

    Ok(())
}

/// Connect to a remote peer as initiator.
#[tauri::command]
async fn connect_to_peer(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    ip: String,
) -> Result<(), String> {
    let addr = if ip.contains(':') {
        ip.clone()
    } else {
        format!("{}:{}", ip, DEFAULT_PORT)
    };

    let stream = TcpStream::connect(&addr)
        .await
        .map_err(|e| format!("连接失败: {}", e))?;

    stream
        .set_nodelay(true)
        .map_err(|e| e.to_string())?;

    *state.connection.lock().await = Some(Arc::new(Mutex::new(stream)));

    let _ = app.emit(
        "connection_status",
        StatusEvent {
            status: "connected".to_string(),
            message: format!("已连接到 {}", addr),
        },
    );

    Ok(())
}

/// Disconnect from current peer.
#[tauri::command]
async fn disconnect(app: AppHandle, state: State<'_, Arc<AppState>>) -> Result<(), String> {
    *state.connection.lock().await = None;
    let _ = app.emit(
        "connection_status",
        StatusEvent {
            status: "disconnected".to_string(),
            message: "已断开连接".to_string(),
        },
    );
    Ok(())
}

/// Send a file to the connected peer.
#[tauri::command]
async fn send_file(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    file_path: String,
) -> Result<(), String> {
    let path = PathBuf::from(&file_path);

    if !path.exists() {
        return Err("文件不存在".to_string());
    }

    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let file_size = path
        .metadata()
        .map_err(|e| e.to_string())?
        .len();

    // Hash the file
    let _ = app.emit(
        "transfer_status",
        StatusEvent {
            status: "hashing".to_string(),
            message: "正在计算文件哈希…".to_string(),
        },
    );
    let file_hash = hash_file(&path).await.map_err(|e| e.to_string())?;

    let transfer_id = uuid::Uuid::new_v4().to_string();

    // Grab connection
    let conn_guard = state.connection.lock().await;
    let stream_arc = conn_guard
        .as_ref()
        .ok_or("未连接到对方")?
        .clone();
    drop(conn_guard);

    // Send offer
    {
        let mut stream = stream_arc.lock().await;
        let offer = Message::FileOffer {
            file_name: file_name.clone(),
            file_size,
            file_hash: file_hash.clone(),
            transfer_id: transfer_id.clone(),
        };
        stream
            .write_all(&encode_msg(&offer).map_err(|e| e.to_string())?)
            .await
            .map_err(|e| e.to_string())?;
    }

    let _ = app.emit(
        "transfer_status",
        StatusEvent {
            status: "waiting_accept".to_string(),
            message: "等待对方确认接收…".to_string(),
        },
    );

    // Wait for accept/reject
    let response = {
        let mut stream = stream_arc.lock().await;
        read_msg(&mut stream).await.map_err(|e| e.to_string())?
    };

    match response {
        Message::Accept { transfer_id: tid } if tid == transfer_id => {}
        Message::Reject { reason, .. } => {
            return Err(format!("对方拒绝接收: {}", reason));
        }
        _ => return Err("收到意外的响应".to_string()),
    }

    // Start sending chunks
    let app_clone = app.clone();
    let tid = transfer_id.clone();
    let fname = file_name.clone();

    tokio::spawn(async move {
        if let Err(e) =
            send_chunks(app_clone.clone(), stream_arc, path, file_size, tid, fname).await
        {
            let _ = app_clone.emit(
                "transfer_status",
                StatusEvent {
                    status: "error".to_string(),
                    message: format!("发送失败: {}", e),
                },
            );
        }
    });

    Ok(())
}

async fn send_chunks(
    app: AppHandle,
    stream_arc: Arc<Mutex<TcpStream>>,
    path: PathBuf,
    file_size: u64,
    transfer_id: String,
    file_name: String,
) -> Result<()> {
    use tokio::fs::File;
    let mut file = File::open(&path).await?;

    let total_chunks = (file_size + CHUNK_SIZE as u64 - 1) / CHUNK_SIZE as u64;
    let mut buf = vec![0u8; CHUNK_SIZE];
    let mut sent: u64 = 0;
    let start = Instant::now();
    let mut chunk_index: u64 = 0;

    loop {
        let n = file.read(&mut buf).await?;
        if n == 0 {
            break;
        }

        let encoded = base64_encode(&buf[..n]);
        let msg = Message::Chunk {
            transfer_id: transfer_id.clone(),
            index: chunk_index,
            total: total_chunks,
            data: encoded,
        };

        {
            let mut stream = stream_arc.lock().await;
            stream.write_all(&encode_msg(&msg)?).await?;
        }

        sent += n as u64;
        chunk_index += 1;

        let elapsed = start.elapsed().as_secs_f64().max(0.001);
        let speed = (sent as f64 / elapsed) as u64;

        let _ = app.emit(
            "transfer_progress",
            ProgressEvent {
                transfer_id: transfer_id.clone(),
                file_name: file_name.clone(),
                file_size,
                transferred: sent,
                speed_bps: speed,
            },
        );
    }

    // Send done
    {
        let mut stream = stream_arc.lock().await;
        let done = Message::Done {
            transfer_id: transfer_id.clone(),
        };
        stream.write_all(&encode_msg(&done)?).await?;
    }

    let _ = app.emit(
        "transfer_status",
        StatusEvent {
            status: "send_complete".to_string(),
            message: "文件发送完成！".to_string(),
        },
    );

    Ok(())
}

/// Called by receiver frontend to accept or reject an incoming offer.
#[tauri::command]
async fn respond_to_offer(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    transfer_id: String,
    accept: bool,
    save_path: String,
) -> Result<(), String> {
    let conn_guard = state.connection.lock().await;
    let stream_arc = conn_guard
        .as_ref()
        .ok_or("未连接")?
        .clone();
    drop(conn_guard);

    if accept {
        let msg = Message::Accept {
            transfer_id: transfer_id.clone(),
        };
        let mut stream = stream_arc.lock().await;
        stream
            .write_all(&encode_msg(&msg).map_err(|e| e.to_string())?)
            .await
            .map_err(|e| e.to_string())?;
        drop(stream);

        // Get pending offer info
        let offer = state.pending_offer.lock().await.clone();
        if let Some(Message::FileOffer {
            file_name,
            file_size,
            file_hash,
            transfer_id: tid,
        }) = offer
        {
            let app2 = app.clone();
            tokio::spawn(async move {
                if let Err(e) =
                    receive_chunks(app2.clone(), stream_arc, save_path, file_name, file_size, file_hash, tid).await
                {
                    let _ = app2.emit(
                        "transfer_status",
                        StatusEvent {
                            status: "error".to_string(),
                            message: format!("接收失败: {}", e),
                        },
                    );
                }
            });
        }
    } else {
        let msg = Message::Reject {
            transfer_id,
            reason: "用户拒绝".to_string(),
        };
        let mut stream = stream_arc.lock().await;
        stream
            .write_all(&encode_msg(&msg).map_err(|e| e.to_string())?)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

async fn receive_chunks(
    app: AppHandle,
    stream_arc: Arc<Mutex<TcpStream>>,
    save_dir: String,
    file_name: String,
    file_size: u64,
    expected_hash: String,
    transfer_id: String,
) -> Result<()> {
    use tokio::fs::File;
    use tokio::io::BufWriter;

    let save_path = PathBuf::from(&save_dir).join(format!("{}.part", file_name));
    let final_path = PathBuf::from(&save_dir).join(&file_name);

    let mut out_file = BufWriter::new(File::create(&save_path).await?);
    let mut received: u64 = 0;
    let start = Instant::now();

    loop {
        let msg = {
            let mut stream = stream_arc.lock().await;
            read_msg(&mut stream).await?
        };

        match msg {
            Message::Chunk { data, .. } => {
                let bytes = base64_decode(&data)?;
                out_file.write_all(&bytes).await?;
                received += bytes.len() as u64;

                let elapsed = start.elapsed().as_secs_f64().max(0.001);
                let speed = (received as f64 / elapsed) as u64;

                let _ = app.emit(
                    "transfer_progress",
                    ProgressEvent {
                        transfer_id: transfer_id.clone(),
                        file_name: file_name.clone(),
                        file_size,
                        transferred: received,
                        speed_bps: speed,
                    },
                );
            }
            Message::Done { .. } => break,
            Message::Error { message } => anyhow::bail!("对方报告错误: {}", message),
            _ => {}
        }
    }

    out_file.flush().await?;
    drop(out_file);

    // Verify hash
    let _ = app.emit(
        "transfer_status",
        StatusEvent {
            status: "verifying".to_string(),
            message: "正在校验文件完整性…".to_string(),
        },
    );

    let actual_hash = hash_file(&save_path).await?;
    if actual_hash != expected_hash {
        tokio::fs::remove_file(&save_path).await.ok();
        anyhow::bail!("文件哈希校验失败，文件可能已损坏");
    }

    // Rename to final
    tokio::fs::rename(&save_path, &final_path).await?;

    let _ = app.emit(
        "transfer_status",
        StatusEvent {
            status: "receive_complete".to_string(),
            message: format!("文件已保存到: {}", final_path.display()),
        },
    );

    Ok(())
}

/// Handle incoming connection from a remote peer (receiver-side initial handling).
async fn handle_incoming(
    app: AppHandle,
    state: Arc<AppState>,
    stream: TcpStream,
    peer_addr: SocketAddr,
) {
    stream.set_nodelay(true).ok();

    let _ = app.emit(
        "connection_status",
        StatusEvent {
            status: "connected".to_string(),
            message: format!("对方已连接: {}", peer_addr),
        },
    );

    let stream_arc = Arc::new(Mutex::new(stream));
    *state.connection.lock().await = Some(stream_arc.clone());

    // Read first message (should be a FileOffer or Ping)
    loop {
        let msg = {
            let mut s = stream_arc.lock().await;
            match read_msg(&mut s).await {
                Ok(m) => m,
                Err(e) => {
                    log::info!("Connection ended: {}", e);
                    break;
                }
            }
        };

        match msg {
            Message::Ping => {
                let mut s = stream_arc.lock().await;
                s.write_all(&encode_msg(&Message::Pong).unwrap_or_default())
                    .await
                    .ok();
            }
            Message::FileOffer { .. } => {
                // Store pending offer and notify frontend
                if let Message::FileOffer {
                    ref file_name,
                    file_size,
                    ref transfer_id,
                    ..
                } = msg
                {
                    let event = OfferEvent {
                        transfer_id: transfer_id.clone(),
                        file_name: file_name.clone(),
                        file_size,
                    };
                    *state.pending_offer.lock().await = Some(msg);
                    let _ = app.emit("file_offer", event);
                }
                // After offer is handled, break and let respond_to_offer take over
                break;
            }
            _ => {}
        }
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async fn hash_file(path: &PathBuf) -> Result<String> {
    use tokio::fs::File;
    let mut file = File::open(path).await?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; CHUNK_SIZE];
    loop {
        let n = file.read(&mut buf).await?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}

fn base64_encode(data: &[u8]) -> String {
    // Simple base64 without external dep beyond what's already available
    // Use the standard base64 alphabet
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(CHARS[((n >> 18) & 63) as usize] as char);
        out.push(CHARS[((n >> 12) & 63) as usize] as char);
        out.push(if chunk.len() > 1 { CHARS[((n >> 6) & 63) as usize] as char } else { '=' });
        out.push(if chunk.len() > 2 { CHARS[(n & 63) as usize] as char } else { '=' });
    }
    out
}

fn base64_decode(s: &str) -> Result<Vec<u8>> {
    fn val(c: u8) -> Result<u32> {
        Ok(match c {
            b'A'..=b'Z' => (c - b'A') as u32,
            b'a'..=b'z' => (c - b'a' + 26) as u32,
            b'0'..=b'9' => (c - b'0' + 52) as u32,
            b'+' => 62,
            b'/' => 63,
            b'=' => 0,
            _ => anyhow::bail!("Invalid base64 char: {}", c),
        })
    }
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len() / 4 * 3);
    for chunk in bytes.chunks(4) {
        if chunk.len() < 4 {
            break;
        }
        let n = (val(chunk[0])? << 18)
            | (val(chunk[1])? << 12)
            | (val(chunk[2])? << 6)
            | val(chunk[3])?;
        out.push(((n >> 16) & 0xFF) as u8);
        if chunk[2] != b'=' {
            out.push(((n >> 8) & 0xFF) as u8);
        }
        if chunk[3] != b'=' {
            out.push((n & 0xFF) as u8);
        }
    }
    Ok(out)
}

// Arc clone helper for AppState
trait ArcClone: Sized {
    fn clone_arc(self: &Arc<Self>) -> Arc<Self>;
}

impl ArcClone for AppState {
    fn clone_arc(self: &Arc<Self>) -> Arc<Self> {
        Arc::clone(self)
    }
}

// ── Tauri app entry ───────────────────────────────────────────────────────────
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(Arc::new(AppState::default()))
        .invoke_handler(tauri::generate_handler![
            get_local_address,
            start_listener,
            connect_to_peer,
            disconnect,
            send_file,
            respond_to_offer,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            let state: State<Arc<AppState>> = app.state();
            let state_arc = state.inner().clone();

            tauri::async_runtime::spawn(async move {
                // Auto-start listener on launch
                let addr = format!("0.0.0.0:{}", DEFAULT_PORT);
                match TcpListener::bind(&addr).await {
                    Ok(listener) => {
                        let local_ip = local_ip_address::local_ip()
                            .map(|ip| ip.to_string())
                            .unwrap_or_else(|_| "127.0.0.1".to_string());
                        *state_arc.local_ip.lock().await = local_ip;

                        loop {
                            match listener.accept().await {
                                Ok((stream, peer_addr)) => {
                                    log::info!("Incoming connection from {}", peer_addr);
                                    let app2 = app_handle.clone();
                                    let state2 = state_arc.clone();
                                    tokio::spawn(handle_incoming(app2, state2, stream, peer_addr));
                                }
                                Err(e) => log::error!("Accept error: {}", e),
                            }
                        }
                    }
                    Err(e) => {
                        log::error!("Failed to bind listener: {}", e);
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
