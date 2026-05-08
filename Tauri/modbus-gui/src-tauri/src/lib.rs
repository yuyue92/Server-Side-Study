
// ════════════════════════════════════════════════════════
//  Modbus RTU 命令（预留桩）
//  实际实现时取消注释并引入 tokio-modbus / serialport
// ════════════════════════════════════════════════════════

/// 获取可用串口列表
#[tauri::command]
fn get_available_ports() -> Vec<String> {
    // TODO: 实际实现
    // use serialport;
    // serialport::available_ports()
    //     .unwrap_or_default()
    //     .iter()
    //     .map(|p| p.port_name.clone())
    //     .collect()
    vec![]
}

/// 连接串口
#[tauri::command]
async fn modbus_connect(
    port: String,
    baud_rate: u32,
    data_bits: u8,
    stop_bits: u8,
    parity: String,
    slave_id: u8,
) -> Result<(), String> {
    // TODO: 实际实现
    // 使用 tokio-modbus 建立 RTU 连接并存储到 AppState
    println!(
        "[Modbus] 连接: port={} baud={} data={} stop={} parity={} slave={}",
        port, baud_rate, data_bits, stop_bits, parity, slave_id
    );
    Ok(())
}

/// 断开连接
#[tauri::command]
async fn modbus_disconnect() -> Result<(), String> {
    // TODO: 实际实现
    println!("[Modbus] 断开连接");
    Ok(())
}

/// 读取保持寄存器（FC03）
/// 返回寄存器原始整数值
#[tauri::command]
async fn modbus_read_register(address: u16, slave_id: u8) -> Result<u16, String> {
    // TODO: 实际实现
    // let mut ctx = get_modbus_context().await?;
    // let response = ctx.read_holding_registers(address, 1).await
    //     .map_err(|e| e.to_string())?;
    // Ok(response[0])
    println!("[Modbus] 读寄存器 addr={} slave={}", address, slave_id);
    Err("未连接（桩实现）".to_string())
}

/// 写单个保持寄存器（FC06）
#[tauri::command]
async fn modbus_write_register(address: u16, value: u16, slave_id: u8) -> Result<(), String> {
    // TODO: 实际实现
    // let mut ctx = get_modbus_context().await?;
    // ctx.write_single_register(address, value).await
    //     .map_err(|e| e.to_string())?;
    println!(
        "[Modbus] 写寄存器 addr={} value={} slave={}",
        address, value, slave_id
    );
    Err("未连接（桩实现）".to_string())
}

// ════════════════════════════════════════════════════════
//  App Entry
// ════════════════════════════════════════════════════════

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            get_available_ports,
            modbus_connect,
            modbus_disconnect,
            modbus_read_register,
            modbus_write_register,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
