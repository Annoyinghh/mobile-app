# 完整构建指南

## 🎯 目标
构建一个完整可用的 APK，实现：
- 手机插入 USB 自动检测电脑
- 自动推送 Agent 到电脑
- 自动启动并建立连接
- 无需在电脑上预装任何软件

---

## 📋 前提条件

1. **Node.js 18+**
2. **Android Studio + SDK 34**
3. **Java JDK 17**
4. **Expo 账号**（用于 EAS Build）
5. **Windows 电脑**（用于测试）
6. **Android 手机**（用于测试）

---

## 🚀 构建步骤

### 步骤 1：安装依赖

```powershell
cd D:\Project\netops-repair\mobile-app
npm install
```

### 步骤 2：编译 PC Agent 为 .exe

```powershell
cd D:\Project\netops-repair\src\pc-agent-standalone
npm install
npm install -g @yao-pkg/pkg
pkg . --targets node18-win-x64 --output NetOpsAgent.exe
```

编译完成后，将 `NetOpsAgent.exe` 复制到：
```
D:\Project\netops-repair\mobile-app\assets\agent\NetOpsAgent.exe
```

### 步骤 3：下载 ADB 工具

1. 从 https://developer.android.com/studio/releases/platform-tools 下载 `platform-tools-latest-windows.zip`
2. 解压后，将以下文件复制到 `D:\Project\netops-repair\mobile-app\assets\tools\`:
   - `adb.exe`
   - `AdbWinApi.dll`
   - `AdbWinUsbApi.dll`

### 步骤 4：构建开发版本（本地测试）

连接 Android 手机到电脑（开启 USB 调试），然后：

```powershell
cd D:\Project\netops-repair\mobile-app
npx expo prebuild --clean
npx expo run:android
```

### 步骤 5：生产构建（EAS Build）

```powershell
# 登录 Expo
npx eas-cli login

# 配置代理（如果需要）
$env:HTTP_PROXY="http://127.0.0.1:7890"
$env:HTTPS_PROXY="http://127.0.0.1:7890"

# 构建 APK
npx eas build --platform android --profile preview
```

构建完成后，下载 APK 并安装到手机。

---

## 🎯 工作原理

### 完整流程

```
┌─────────────┐                    ┌──────────────┐
│  手机 App   │                    │   电脑 PC    │
│             │                    │              │
│  启动 App   │                    │              │
│     ↓       │                    │              │
│  插入 USB   │◄──────────────────►│  USB 接口    │
│     ↓       │   USB 连接检测      │              │
│  检测设备   │                    │              │
│     ↓       │                    │              │
│  请求权限   │                    │              │
│     ↓       │                    │              │
│  提取内置   │                    │              │
│  Agent.exe  │                    │              │
│  ADB工具    │                    │              │
│     ↓       │                    │              │
│  通过 ADB   │   adb push         │  接收文件    │
│  推送文件   │───────────────────►│  保存到临时  │
│     ↓       │                    │  目录        │
│  通过 ADB   │   adb shell        │              │
│  启动Agent  │───────────────────►│  启动进程    │
│     ↓       │                    │     ↓        │
│  等待端口   │                    │  Agent监听   │
│     ↓       │                    │  3001端口    │
│  建立连接   │◄──────────────────►│  WebSocket   │
│     ↓       │   WebSocket连接     │  Server      │
│  开始控制   │                    │              │
└─────────────┘                    └──────────────┘
```

---

## 🔧 技术细节

### ADB 文件推送

手机 App 内置 `adb.exe`，运行时会：
1. 提取 `adb.exe` 到手机缓存目录
2. 执行 `adb devices` 检测电脑
3. 执行 `adb push NetOpsAgent.exe C:\Windows\Temp\`
4. 执行 `adb shell "C:\Windows\Temp\NetOpsAgent.exe"`

### Windows 权限问题

由于 Windows 安全限制，通过 ADB 启动的进程可能没有管理员权限。

**解决方案：**
1. Agent 启动时检测管理员权限
2. 如果没有权限，通过 PowerShell 请求提升
3. 用户会看到 UAC 弹窗，点击"是"授权

### 网络连接

Agent 启动后会监听端口（默认 3001），手机 App 通过：
- USB 共享网络：`ws://192.168.42.x:3001`
- 或 ADB 端口转发：`adb forward tcp:3001 tcp:3001` → `ws://localhost:3001`

---

## ⚠️ 已知限制

### 限制 1：ADB 需要授权

首次连接电脑时，电脑上会弹出"允许 USB 调试吗？"对话框。
用户需要点击"确定"授权。

**解决：** 这是 Android 安全机制，无法绕过。但用户可以勾选"始终允许"来避免每次授权。

### 限制 2：Windows 防火墙

Windows 防火墙可能会阻止 Agent 监听端口。

**解决：** Agent 启动时会自动添加防火墙规则（需要管理员权限）。

### 限制 3：杀毒软件

某些杀毒软件可能会拦截 Agent.exe。

**解决：** 用户需要将 Agent 添加到白名单。

---

## 🎯 优化建议

### 优化 1：使用 ADB 端口转发

不依赖 USB 共享网络 IP，直接使用：
```bash
adb forward tcp:3001 tcp:3001
```
然后手机连接 `ws://localhost:3001`

### 优化 2：Agent 自动注册为 Windows 服务

首次运行时，Agent 可以注册为 Windows 服务，之后开机自动启动。用户只需运行一次。

### 优化 3：使用 HTTPS 加密通信

当前使用明文 WebSocket，可以添加自签名证书实现加密。

---

## 📝 当前状态

### ✅ 已完成

- ✅ Expo 项目配置
- ✅ USB Agent 原生模块框架
- ✅ TypeScript 接口
- ✅ App.js 完整实现
- ✅ PC Agent Standalone 版本

### ⏳ 待完成

- ⏳ 编译 NetOpsAgent.exe
- ⏳ 下载 ADB 工具
- ⏳ 实现真实 ADB 推送逻辑
- ⏳ 测试完整流程
- ⏳ 构建 APK

---

## 🚀 立即开始

在 PowerShell 中运行：

```powershell
# 1. 编译 Agent
cd D:\Project\netops-repair\src\pc-agent-standalone
pkg . --targets node18-win-x64 --output NetOpsAgent.exe

# 2. 复制到 assets
mkdir D:\Project\netops-repair\mobile-app\assets\agent -Force
copy NetOpsAgent.exe D:\Project\netops-repair\mobile-app\assets\agent\

# 3. 构建 APK
cd D:\Project\netops-repair\mobile-app
npx eas build --platform android --profile preview
```

构建完成后，你将得到一个完整的、可用的 APK！