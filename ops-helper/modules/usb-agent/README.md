# USB Agent Expo Module

自动推送 Agent 到电脑并启动的 Expo 原生模块。

## 安装

```bash
npm install
npx expo install
```

## 使用方法

```typescript
import UsbAgentModule from 'usb-agent';

// 启动自动部署
const result = await UsbAgentModule.startAutoDeploy();
console.log('Agent port:', result.port);

// 监听事件
UsbAgentModule.addOnAgentReadyListener((event) => {
  console.log('Agent ready on port:', event.port);
});
```

## 构建开发版本

```bash
npx expo run:android
```

## 生产构建

```bash
eas build --platform android
```
