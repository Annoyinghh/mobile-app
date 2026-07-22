/**
 * USB Agent Module - TypeScript 接口
 *
 * 自动推送 Agent 到电脑并启动
 */
import { EventSubscription } from 'expo-modules-core';
export interface UsbDevice {
    deviceId: number;
    vendorId: number;
    productId: number;
    deviceName: string;
    productName?: string;
    manufacturerName?: string;
}
export interface AgentReadyEvent {
    port: number;
    status: 'ready' | 'error';
}
export interface UsbDeviceEvent {
    deviceName: string;
    productId?: number;
    vendorId?: number;
}
export interface ErrorEvent {
    message: string;
}
export interface DeployProgressEvent {
    message: string;
}
/**
 * USB Agent 模块
 */
export declare const UsbAgentModule: {
    /**
     * 获取已连接的 USB 设备列表
     */
    getDevices(): Promise<UsbDevice[]>;
    /**
     * 启动自动部署流程
     * 1. 检测 USB 设备
     * 2. 推送 Agent 到电脑
     * 3. 启动 Agent
     * 4. 返回端口
     */
    startAutoDeploy(): Promise<{
        success: boolean;
        port: number;
    }>;
    /**
     * 停止部署流程
     */
    stopDeploy(): Promise<void>;
    /**
     * 检查 Agent 是否就绪
     */
    checkAgentReady(): Promise<boolean>;
    /**
     * 提取内置的 Agent.exe 到临时目录
     */
    extractAgentFile(): Promise<{
        success: boolean;
        path: string;
    }>;
    /**
     * 监听 USB 设备连接事件
     */
    addOnUsbDeviceAttachedListener(callback: (event: UsbDeviceEvent) => void): EventSubscription;
    /**
     * 监听 USB 设备断开事件
     */
    addOnUsbDeviceDetachedListener(callback: (event: UsbDeviceEvent) => void): EventSubscription;
    /**
     * 监听 Agent 就绪事件
     */
    addOnAgentReadyListener(callback: (event: AgentReadyEvent) => void): EventSubscription;
    /**
     * 监听部署进度事件
     */
    addOnDeployProgressListener(callback: (event: DeployProgressEvent) => void): EventSubscription;
    /**
     * 监听错误事件
     */
    addOnErrorListener(callback: (event: ErrorEvent) => void): EventSubscription;
};
export default UsbAgentModule;
//# sourceMappingURL=index.d.ts.map