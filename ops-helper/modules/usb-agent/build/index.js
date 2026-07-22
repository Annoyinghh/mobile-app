/**
 * USB Agent Module - TypeScript 接口
 *
 * 自动推送 Agent 到电脑并启动
 */
import { requireNativeModule, EventEmitter } from 'expo-modules-core';
const UsbAgent = requireNativeModule('UsbAgent');
const eventEmitter = new EventEmitter(UsbAgent);
/**
 * USB Agent 模块
 */
export const UsbAgentModule = {
    /**
     * 获取已连接的 USB 设备列表
     */
    async getDevices() {
        if (!UsbAgent) {
            throw new Error('UsbAgent module is not available');
        }
        return UsbAgent.getDevices();
    },
    /**
     * 启动自动部署流程
     * 1. 检测 USB 设备
     * 2. 推送 Agent 到电脑
     * 3. 启动 Agent
     * 4. 返回端口
     */
    async startAutoDeploy() {
        if (!UsbAgent) {
            throw new Error('UsbAgent module is not available');
        }
        return UsbAgent.startAutoDeploy();
    },
    /**
     * 停止部署流程
     */
    async stopDeploy() {
        if (!UsbAgent)
            return;
        return UsbAgent.stopDeploy();
    },
    /**
     * 检查 Agent 是否就绪
     */
    async checkAgentReady() {
        if (!UsbAgent)
            return false;
        return UsbAgent.checkAgentReady();
    },
    /**
     * 提取内置的 Agent.exe 到临时目录
     */
    async extractAgentFile() {
        if (!UsbAgent) {
            throw new Error('UsbAgent module is not available');
        }
        return UsbAgent.extractAgentFile();
    },
    /**
     * 监听 USB 设备连接事件
     */
    addOnUsbDeviceAttachedListener(callback) {
        // @ts-ignore
        return eventEmitter.addListener('onUsbDeviceAttached', callback);
    },
    /**
     * 监听 USB 设备断开事件
     */
    addOnUsbDeviceDetachedListener(callback) {
        // @ts-ignore
        return eventEmitter.addListener('onUsbDeviceDetached', callback);
    },
    /**
     * 监听 Agent 就绪事件
     */
    addOnAgentReadyListener(callback) {
        // @ts-ignore
        return eventEmitter.addListener('onAgentReady', callback);
    },
    /**
     * 监听部署进度事件
     */
    addOnDeployProgressListener(callback) {
        // @ts-ignore
        return eventEmitter.addListener('onDeployProgress', callback);
    },
    /**
     * 监听错误事件
     */
    addOnErrorListener(callback) {
        // @ts-ignore
        return eventEmitter.addListener('onError', callback);
    },
};
export default UsbAgentModule;
//# sourceMappingURL=index.js.map