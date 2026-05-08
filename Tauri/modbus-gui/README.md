# Modbus RTU 控制上位机

基于 **Tauri 2 + Vue 3** 的工业控制上位机 GUI 软件。

## 功能特性

- 📂 **Excel 驱动界面**：启动后选择 `.xlsx` 配置文件，自动渲染控制面板
- 📑 **多 Sheet → 多标签页**：每个工作表对应一个 Tab 页面
- 📐 **N × 4 网格布局**：条目按顺序自动排列（ceil(总数/4) 行）
- 🔧 **INPUT / SELECT 组件**：根据配置渲染不同控件类型
- 🔒 **READONLY / READWRITE 权限**：只读条目禁止编辑
- 🔌 **串口配置面板**：波特率、停止位、轮询间隔等可折叠配置区
- ⚡ **Mock 模式**：未连接时可用模拟数据测试界面（内置随机值轮询）
- 🦀 **Modbus 预留接口**：Rust 后端命令桩已就位，取消注释即可接入真实设备

---

## 快速开始

### 环境要求

| 工具 | 版本 |
|------|------|
| Node.js | ≥ 18 |
| Rust | ≥ 1.77 (stable) |
| Tauri CLI | v2 |

```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Tauri CLI
cargo install tauri-cli --version "^2.0"
# 或者用 npm：
npm install -g @tauri-apps/cli@latest
```

各平台额外依赖见 [Tauri Prerequisites](https://tauri.app/start/prerequisites/)

- **Windows**：Microsoft Build Tools + WebView2
- **macOS**：Xcode Command Line Tools
- **Linux**：`libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`

### 安装依赖并运行

```bash
cd modbus-gui

# 安装前端依赖
npm install

# 开发模式（同时启动 Vite + Tauri）
npm run tauri dev

# 打包构建
npm run tauri build
```

---

## 配置文件格式

创建 `.xlsx` 文件，每个 Sheet 是一个控制页签，第一行为列名：

| 列名 | 说明 | 示例 |
|------|------|------|
| `name` | 控件标签名称 | `电机转速` |
| `寄存器地址` | Modbus 保持寄存器地址 | `40001` |
| `小数位数` | 原始值缩放精度（读到 1480 → 显示 `148.0`） | `1` |
| `单位` | 显示在标签旁的单位 | `RPM` |
| `读写权限` | `READONLY` 或 `READWRITE` | `READONLY` |
| `组件类型` | `INPUT` 或 `SELECT` | `INPUT` |
| `选项数据` | SELECT 专用，JSON 数组格式 | `[{"label":"运行","value":"1"}]` |

> **注意**：选项数据字段需为合法 JSON（双引号），也兼容单引号格式

### 生成示例配置文件

```bash
pip install openpyxl
python3 gen_sample_config.py
# → 生成 sample-config.xlsx
```

---

## 项目结构

```
modbus-gui/
├── src/
│   ├── main.js                   # Vue 应用入口
│   ├── App.vue                   # 根组件（布局 + 状态管理）
│   ├── styles/
│   │   └── global.css            # 全局样式（工业暗色主题）
│   ├── components/
│   │   ├── SerialPortPanel.vue   # 串口配置面板
│   │   ├── SheetTab.vue          # Sheet 页签网格
│   │   └── ControlItem.vue       # 单个控制条目（INPUT / SELECT）
│   ├── composables/
│   │   └── useModbus.js          # Modbus 逻辑（含 Mock 模式）
│   └── utils/
│       └── excelParser.js        # Excel 解析 + 数值换算工具
├── src-tauri/
│   ├── src/
│   │   ├── main.rs               # Tauri 入口
│   │   └── lib.rs                # Rust 命令（Modbus 桩）
│   ├── tauri.conf.json           # Tauri 配置
│   ├── Cargo.toml                # Rust 依赖
│   └── capabilities/
│       └── default.json          # 权限配置
├── package.json
├── vite.config.js
├── index.html
└── gen_sample_config.py          # 生成示例 xlsx 的辅助脚本
```

---

## 接入真实 Modbus 设备

1. 在 `src-tauri/Cargo.toml` 解注释 `tokio`、`tokio-modbus`、`serialport` 依赖

2. 在 `src-tauri/src/lib.rs` 实现真实的连接/读/写逻辑

3. 在 `src/composables/useModbus.js` 中：
   ```js
   import { invoke } from '@tauri-apps/api/core'
   
   // 替换 Mock connect：
   await invoke('modbus_connect', { port, baudRate, ... })
   
   // 替换 Mock readRegister：
   return await invoke('modbus_read_register', { address, slaveId })
   
   // 替换 Mock writeRegister：
   await invoke('modbus_write_register', { address, value: rawValue, slaveId })
   ```

---

## 数值换算规则

| 操作 | 公式 |
|------|------|
| 读显示 | `display = rawValue / 10^decimals` |
| 写原始 | `rawValue = round(display × 10^decimals)` |

示例：`decimals=2`，寄存器读到 `1234` → 显示 `12.34`；用户输入 `15.00` → 写入 `1500`

---

## 开发说明

- **Mock 轮询**：连接串口（即使端口不存在也会 Mock 成功）后开始轮询，
  内置各地址的模拟典型值（含随机抖动），方便前端开发调试
- **轮询间隔**：配置为 0 时无等待连续轮询；否则每个完整周期结束后等待指定毫秒
- **写值触发**：INPUT 按 Enter 触发；SELECT 点击选项触发；仅 READWRITE 条目有效
