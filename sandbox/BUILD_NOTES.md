# 应用构建说明

## 构建包含原生模块的 APK

### 前置条件
1. Node.js 18+
2. Android Studio（SDK 34+）
3. ANDROID_HOME 环境变量已配置
4. Expo 账号已登录

### 构建开发版本（本地测试）
```bash
npm install
npx expo prebuild --clean
npx expo run:android
```

### 构建生产版本（EAS Build）
```bash
# 在 Windows 上设置代理（如果网络需要）
set HTTP_PROXY=http://127.0.0.1:7890
set HTTPS_PROXY=http://127.0.0.1:7890

# 构建
npx eas build --platform android --profile preview
```

## 当前限制

由于 Expo 原生模块的限制，全自动的"USB 即插即用"方案需要满足以下条件之一：

1. **使用 Expo Dev Client 构建**（需要预装 Android Studio）
2. **使用 EAS Build 云端构建**（需要 Expo 账号）
3. **使用混合方案**（首次需手动运行 Agent，之后自动）

推荐使用方案 3 作为快速启动方案：首次在电脑上运行一次 `NetOpsAgent.exe`，之后 App 插上 USB 就能自动连接。