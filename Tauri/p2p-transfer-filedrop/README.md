# FileDrop — 局域网点对点文件传输工具

> Vue3 + Tauri 2 + Rust，TCP 切片传输，SHA-256 校验，局域网 P2P 文件传输。

---

## 功能特性

- ✅ 局域网内任意两台电脑点对点传输
- ✅ TCP 直连，无需中转服务器
- ✅ 1 MB 分块传输，实时进度 + 速度显示
- ✅ SHA-256 文件完整性校验
- ✅ 接收方弹窗确认
- ✅ `.part` 临时文件，传完校验后重命名
- ✅ 极简终端风格 UI

---

## 环境要求

| 工具 | 版本 | 说明 |
|------|------|------|
| Rust | ≥ 1.77 | [rustup.rs](https://rustup.rs) |
| Node.js | ≥ 20 | [nodejs.org](https://nodejs.org) |
| npm | ≥ 10 | 随 Node.js 一起安装 |
| Tauri CLI | v2 | `npm install` 自动安装 |

### 系统依赖

**macOS**：只需 Xcode Command Line Tools
```bash
xcode-select --install
```

**Windows**：安装 [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

**Linux (Ubuntu/Debian)**：
```bash
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

---

## 快速开始

### 1. 克隆 / 解压项目

```bash
cd filedrop
```

### 2. 安装 Node 依赖

```bash
npm install
```

### 3. 开发模式运行

```bash
npm run tauri dev
```

首次运行会编译 Rust 代码，大约需要 2-5 分钟，后续启动很快。

### 4. 构建发布版

```bash
npm run tauri build
```

产物在 `src-tauri/target/release/bundle/` 下，根据系统生成 `.dmg` / `.exe` / `.deb` 等安装包。

---

## 使用流程

### 发送方（A）

1. 打开 FileDrop，查看顶部显示的 **本机 IP:8848**
2. 在「TARGET」输入框填入 **接收方 IP**（如 `192.168.1.20`）
3. 点击「连接」
4. 连接成功后，点击「选择文件」选择要发送的文件
5. 点击「发送」，等待接收方确认

### 接收方（B）

1. 打开 FileDrop（无需操作，自动监听 8848 端口）
2. 等待发送方连接
3. 收到文件请求时，弹窗显示文件名和大小
4. 点击「接收」——文件自动保存到**下载文件夹**
5. 双方实时查看传输进度

---

## 项目结构

```
filedrop/
├── src/                    # Vue3 前端
│   ├── App.vue             # 主界面（全部 UI 逻辑）
│   ├── main.js             # 入口
│   └── assets/
│       └── style.css       # 全局样式
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── lib.rs          # 核心逻辑（TCP/协议/命令）
│   │   └── main.rs         # 程序入口
│   ├── capabilities/
│   │   └── default.json    # Tauri 权限配置
│   ├── Cargo.toml          # Rust 依赖
│   ├── build.rs            # 构建脚本
│   └── tauri.conf.json     # Tauri 配置
├── index.html              # HTML 入口
├── vite.config.js          # Vite 配置
└── package.json            # Node 依赖
```

---

## 协议说明

FileDrop 使用自定义的 **JSON over TCP 换行分隔** 协议：

```
FileOffer  → { type: "file_offer", file_name, file_size, file_hash, transfer_id }
Accept     → { type: "accept", transfer_id }
Reject     → { type: "reject", transfer_id, reason }
Chunk      → { type: "chunk", transfer_id, index, total, data: <base64> }
Done       → { type: "done", transfer_id }
```

每条消息以 `\n` 结尾，简单可靠。

---

## 常见问题

**Q: 连接超时 / 连接失败**
A: 确认两台电脑在同一 Wi-Fi / 局域网；检查防火墙是否放行 8848 端口。

**macOS 防火墙**：系统设置 → 隐私与安全 → 防火墙 → 允许 FileDrop

**Windows 防火墙**：首次运行时系统会弹窗询问，点击「允许访问」即可。

**Linux**：
```bash
sudo ufw allow 8848/tcp
```

**Q: 端口被占用**
A: 修改 `src-tauri/src/lib.rs` 中的 `DEFAULT_PORT` 常量，同时修改 `tauri.conf.json` 的标题不影响功能。

**Q: 文件保存在哪里？**
A: 自动保存到系统**下载文件夹**（~/Downloads 或 Windows 的"下载"目录）。

---

## 后续可扩展

- [ ] 多文件 / 文件夹批量发送
- [ ] 断点续传
- [ ] 自动发现局域网设备（mDNS）
- [ ] 传输加密（TLS）
- [ ] 穿透互联网（WebRTC / STUN）
