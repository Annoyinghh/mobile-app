# NetOps Repair — 智能运维助手

基于手机端控制的 Windows 主机智能自检、网络修复与系统运维管理系统。通过手机（Wi-Fi / USB 数据线 / 蓝牙）即可远程操控，无需在电脑端进行繁琐界面操作，即可完成系统完整性修复、网络故障自愈、进程服务管理及自动化资产巡检。

---

## 项目结构

```
netops-repair/
├── ops-helper/              # 手机控制端 App（React Native + Expo SDK 57）
│   ├── App.js                # 主应用（6 大 Tab 功能卡片）
│   ├── modules/              # Expo 原生模块
│   │   └── usb-agent/        # USB 自动部署 Agent 的原生模块（Kotlin）
│   ├── assets/               # 图标、Agent 二进制文件、工具集
│   ├── android/              # 原生 Android 构建产物
│   └── src/adb/              # ADB 辅助工具
├── src/pc-agent/             # PC 被控端 Agent（Node.js 守护进程）
│   ├── index.js              # WebSocket + HTTP 服务入口
│   ├── detector.js           # 硬件资产检测
│   ├── diagnostics.js        # 网络诊断
│   ├── repair.js             # 一键修复逻辑
│   └── report.js             # 巡检报表生成
├── sandbox/                  # Docker 沙盒部署环境
│   ├── Dockerfile.agent      # Agent 容器镜像
│   └── docker-compose.yml    # 编排配置
└── README.md
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 手机控制端 | React Native + Expo SDK 57 (React Native 0.86) |
| 通信协议 | WebSocket（实时遥测 + 指令分发）+ HTTP 流（补丁推送 / 报表下载） |
| PC 被控端 | Node.js 原生 HTTP + WebSocket 守护进程 |
| 系统调用 | `child_process` 管道调用 `wmic`、`powershell`、`netsh`、`sfc`、`dism`、`chkdsk` |
| USB 部署 | Expo 原生模块（Kotlin），自动推送 Agent 到电脑并启动 |
| 沙盒 | Docker & Docker Compose |

## 功能概览

1. **资产巡检** — 自动收集主机名、MAC、IP、CPU、RAM、磁盘、显卡，扫描已安装应用与系统补丁
2. **硬件监控** — 每 3 秒实时推送 CPU / 内存 / 磁盘负载，支持进程强制终止与 Windows 服务管理
3. **网络与安全** — 外网 Ping、DNS、网关诊断，防火墙策略分发，本地账户管理
4. **一键自愈** — 网络重置（DNS / TCP/IP / Winsock）、系统修复（SFC / DISM）、性能优化
5. **远程与文件** — 远程 Shell 终端、文件推送、事件日志一键归档
6. **自动巡检报表** — 一键评估硬件健康度，生成 UTF-8 BOM 兼容的 CSV 报表

## 快速开始

### 启动 PC Agent

以管理员身份运行：

```bash
cd src/pc-agent
npm install
node index.js
```

### 启动手机 App

```bash
cd ops-helper
npm install
npx expo start
```

### 沙盒模式

```bash
cd sandbox
docker-compose up --build
```

## 打包 APK

项目已配置本地 JKS 签名与 `eas.json` 的 `preview` profile。打包前需挂代理并登录 Expo 账号：

```powershell
npx eas-cli login
$env:HTTP_PROXY="http://127.0.0.1:7890"
$env:HTTPS_PROXY="http://127.0.0.1:7890"
npx eas-cli build -p android --profile preview
```

## 许可

MIT License © 2025 Xu Zhixuan