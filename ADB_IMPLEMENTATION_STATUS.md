## ADB 零预装方案 - 实施状态

### ✅ 已完成

#### 1. PC Agent Standalone 版本 (`src/pc-agent-standalone/`)
- ✅ 创建了精简版 Agent (`index.js`)
  - 移除文件系统依赖，使用内存缓存
  - 自动选择可用端口
  - 管理员权限检测与提升
  - 轻量化设计（无外部依赖）
- ✅ 创建了 `package.json` 配置文件

#### 2. 手机 App 改造 (`mobile-app/App.js`)
- ✅ 重写了 App.js，实现：
  - 新的连接模式：`USB 即插即用`
  - ADB 自动发现流程（5 步骤）
    - 检测 USB 设备
    - 推送 Agent 到电脑
    - 启动 Agent 进程
    - 等待 Agent 就绪
    - 建立 WebSocket 连接
  - 简化的 UI（5 个核心功能 Tab）
  - 状态显示：检测中 / 推送中 / 启动中 / 连接中

#### 3. Android 原生模块 (`android/app/src/main/java/com/netops/app/`)
- ✅ `AdbModule.java` - ADB 功能原生桥接
  - `getDevices()` - 检测 USB 设备
  - `pushFile()` - 推送文件到电脑
  - `startAgent()` - 启动 Agent 进程
  - `checkPort()` - 检查端口就绪状态
  - `executeAdbCommand()` - 执行 ADB 命令
- ✅ `AdbPackage.java` - React Native 包注册
- ✅ `MainActivity.java` - 主 Activity
- ✅ `MainApplication.java` - 应用入口，注册 AdbPackage

---

### 🚧 待完成（下一步）

#### 1. 编译 PC Agent 为 .exe
```bash
cd D:\Project\netops-repair\src\pc-agent-standalone
npm install
npm run build:exe
```
需要：
- 安装 `@yao-pkg/pkg` 或 `pkg`
- 添加 UAC manifest（请求管理员权限）
- 测试生成的 `NetOpsAgent.exe`

#### 2. 将 ADB 工具和 Agent.exe 打包进 APK
需要添加到 `android/app/src/main/assets/`:
- `tools/adb.exe`
- `tools/AdbWinApi.dll`
- `tools/AdbWinUsbApi.dll`
- `agent/NetOpsAgent.exe`

#### 3. 完善 AdbModule 原生实现
当前是模拟实现，需要：
- 实现真实的 ADB 协议或调用 `adb.exe`
- 处理 USB 权限请求
- 实现文件推送逻辑
- 实现 ADB 端口转发

#### 4. AndroidManifest.xml 配置
需要添加：
```xml
<uses-feature android:name="android.hardware.usb.host" />
<uses-permission android:name="android.permission.USB_PERMISSION" />

<intent-filter>
    <action android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED" />
</intent-filter>
```

#### 5. 测试与调试
- 在真实 Android 设备上测试 USB 连接
- 测试 Agent 推送和启动流程
- 测试不同 Windows 版本兼容性
- 处理错误情况（权限、驱动、防火墙等）

---

### 技术架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        手机 App                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ React Native UI (App.js)                             │  │
│  │  - USB 即插即用模式                                   │  │
│  │  - ADB 自动发现流程                                   │  │
│  │  - WebSocket 连接管理                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↕                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Native Module (AdbModule.java)                       │  │
│  │  - USB 设备检测                                       │  │
│  │  - 文件推送 (ADB push)                                │  │
│  │  - Agent 启动 (ADB shell)                             │  │
│  │  - 端口检测 (ADB forward)                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↕                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Assets (内置资源)                                     │  │
│  │  - adb.exe + DLLs                                    │  │
│  │  - NetOpsAgent.exe (编译后的 Agent)                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕ USB Cable
┌─────────────────────────────────────────────────────────────┐
│                       电脑 PC                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 临时目录 (C:\Windows\Temp\NetOpsAgent.exe)           │  │
│  │  - 自动推送到此                                       │  │
│  │  - 自动启动                                           │  │
│  │  - 自动请求管理员权限                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↕                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ PC Agent Standalone (index.js)                       │  │
│  │  - HTTP Server (健康检查)                            │  │
│  │  - WebSocket Server (实时通信)                       │  │
│  │  - 系统诊断、修复、管理功能                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

### 使用流程（用户视角）

1. **手机插上 USB 数据线** → 自动检测到电脑
2. **App 自动推送 Agent** → 进度显示："正在推送 Agent..."
3. **Agent 自动启动** → 进度显示："正在启动 Agent..."
4. **自动建立连接** → 进度显示："已连接"
5. **开始控制电脑** → 使用各项功能

**无需用户在电脑上做任何操作！**

---

### 下一步行动

要继续实施，请告诉我：

1. **直接编译 Agent.exe？** 我可以帮你配置 pkg 并生成可执行文件
2. **完善原生模块？** 我可以实现真实的 ADB 命令执行逻辑
3. **配置 AndroidManifest？** 我可以添加 USB 权限配置
4. **全部一起做？** 我可以按顺序完成所有步骤

你想先做哪一步？