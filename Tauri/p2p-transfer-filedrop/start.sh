#!/usr/bin/env bash
# FileDrop 一键安装运行脚本 (macOS / Linux)
set -e

echo ""
echo "  ███████╗██╗██╗     ███████╗██████╗ ██████╗  ██████╗ ██████╗ "
echo "  ██╔════╝██║██║     ██╔════╝██╔══██╗██╔══██╗██╔═══██╗██╔══██╗"
echo "  █████╗  ██║██║     █████╗  ██║  ██║██████╔╝██║   ██║██████╔╝"
echo "  ██╔══╝  ██║██║     ██╔══╝  ██║  ██║██╔══██╗██║   ██║██╔═══╝ "
echo "  ██║     ██║███████╗███████╗██████╔╝██║  ██║╚██████╔╝██║     "
echo "  ╚═╝     ╚═╝╚══════╝╚══════╝╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝     "
echo ""
echo "  局域网点对点文件传输工具"
echo ""

# Check Node
if ! command -v node &>/dev/null; then
  echo "❌ 未找到 Node.js，请先安装: https://nodejs.org"
  exit 1
fi

# Check Rust/Cargo
if ! command -v cargo &>/dev/null; then
  echo "⚙️  未找到 Rust，正在自动安装..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
fi

echo "✅ Rust $(rustc --version)"
echo "✅ Node $(node --version)"

# Install npm deps
echo ""
echo "📦 安装 Node 依赖..."
npm install

echo ""
echo "🚀 启动开发模式（首次编译约 2-5 分钟，请耐心等待）..."
echo ""
npm run tauri dev
