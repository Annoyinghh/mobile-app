# 构建指南：USB Agent 零预装版本

本指南帮助你构建包含 USB Agent 原生模块的 Expo 应用。

## 📋 前提条件

1. 已安装 Node.js 18+
2. 已安装 Android Studio 和 Android SDK
3. 已配置 ANDROID_HOME 环境变量
4. 已登录 Expo 账号：`npx eas-cli login`

## 🚀 构建步骤

### 步骤 1：安装依赖

```bash
cd D:\Project\netops-repair\mobile-app
npm install
```

### 步骤 2：构建开发版本（本地测试）

需要连接 Android 设备或模拟器：

```bash
npx expo run:android
```

这会生成一个包含原生模块的开发 APK。

### 步骤 3：生产构建（使用 EAS）

```bash
npx eas build --platform android --profile preview
```

构建完成后，下载 APK 并安装到手机。

## 📁 文件结构

```
mobile-app/
├── modules/
│   └── usb-agent/              # 自定义 Expo 模块
│       ├── src/
│       │   └── index.ts        # TypeScript 接口
│       ├── android/
│       │   └── src/main/java/expo/modules/usbagent/
│       │       └── UsbAgentModule.kt  # Kotlin 原生实现
│       ├── app.plugin.js       # Expo 配置插件
│       ├── expo-module.config.json
│       └── package.json
├── android/
│   └── app/src/main/res/xml/
│       └── device_filter.xml   # USB 设备过滤器
├── App.js                      # 应用主文件
├── app.json                    # Expo 配置
└── package.json
```

## 🔧 工作原理

### 1. USB 设备检测

当手机插入电脑 USB 接口时：
- Android 系统触发 `USB_DEVICE_ATTACHED` 广播
- `UsbAgentModule` 捕获事件并发送到 JavaScript 层
- App 开始自动部署流程

### 2. Agent 推送（模拟）

由于 Expo 的限制，当前实现是模拟版本。完整实现需要：

**方案 A：使用 ADB 协议**
- 手机内置 `adb.exe`（约 5MB）
- 通过 ADB 推送 `NetOpsAgent.exe` 到电脑
- 通过 ADB shell 启动 Agent

**方案 B：使用 USB 大容量存储**
- 手机以磁盘模式连接电脑
- 电脑自动挂载手机存储
- 用户手动运行 Agent（不满足需求）

**方案 C：使用 AOA 协议（Android Open Accessory）**
- 手机作为 USB 设备，电脑作为主机
- 需要复杂的底层通信实现

### 3. 当前可用的方案

由于 Expo 的限制，最可行的方案是：

**混合方案：用户手动运行一次 Agent.exe**

1. 用户首次使用时，从手机 App 下载 `NetOpsAgent.exe`
2. 用户在电脑上运行一次 `NetOpsAgent.exe`
3. Agent 自动注册为 Windows 服务
4. 之后手机插入 USB 就能自动连接

## 🎯 下一步行动

### 选择 1：继续完善原生模块（推荐）

我可以帮你：
1. 集成真实的 ADB 工具链
2. 实现文件推送和 Agent 启动
3. 处理 USB 权限请求
4. 测试完整流程

### 选择 2：使用混合方案（最快）

我可以帮你：
1. 创建 Agent 下载页面
2. 添加 Windows 服务注册功能
3. 优化自动连接逻辑

---

## 当前状态

✅ 已完成：
- Expo 项目配置
- USB Agent 模块骨架
- Kotlin 原生模块基础
- TypeScript 接口定义
- Expo Config Plugin

⏳ 待完成：
- 实现 USB 文件传输逻辑
- 集成 ADB 工具链
- 测试 USB 权限流程
- 编译并测试 APK

---

## 立即测试

要测试当前实现，运行：

```bash
npx expo run:android
```

然后在 App 中点击"开始自动连接"按钮。