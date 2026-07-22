/**
 * USB Agent Module - TypeScript 接口
 *
 * 自动推送 Agent 到电脑并启动
 */

import { requireNativeModule, EventEmitter, EventSubscription } from 'expo-modules-core';

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

const UsbAgent = requireNativeModule('UsbAgent');

const eventEmitter = new EventEmitter(UsbAgent);

/**
 * USB Agent 模块
 */
export const UsbAgentModule = {
  /**
   * 获取已连接的 USB 设备列表
   */
  async getDevices(): Promise<UsbDevice[]> {
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
  async startAutoDeploy(): Promise<{ success: boolean; port: number }> {
    if (!UsbAgent) {
      throw new Error('UsbAgent module is not available');
    }
    return UsbAgent.startAutoDeploy();
  },

  /**
   * 停止部署流程
   */
  async stopDeploy(): Promise<void> {
    if (!UsbAgent) return;
    return UsbAgent.stopDeploy();
  },

  /**
   * 检查 Agent 是否就绪
   */
  async checkAgentReady(): Promise<boolean> {
    if (!UsbAgent) return false;
    return UsbAgent.checkAgentReady();
  },

  /**
   * 提取内置的 Agent.exe 到临时目录
   */
  async extractAgentFile(): Promise<{ success: boolean; path: string }> {
    if (!UsbAgent) {
      throw new Error('UsbAgent module is not available');
    }
    return UsbAgent.extractAgentFile();
  },

  /**
   * 监听 USB 设备连接事件
   */
  addOnUsbDeviceAttachedListener(
    callback: (event: UsbDeviceEvent) => void
  ): EventSubscription {
    // @ts-ignore
    return eventEmitter.addListener('onUsbDeviceAttached', callback);
  },

  /**
   * 监听 USB 设备断开事件
   */
  addOnUsbDeviceDetachedListener(
    callback: (event: UsbDeviceEvent) => void
  ): EventSubscription {
    // @ts-ignore
    return eventEmitter.addListener('onUsbDeviceDetached', callback);
  },

  /**
   * 监听 Agent 就绪事件
   */
  addOnAgentReadyListener(
    callback: (event: AgentReadyEvent) => void
  ): EventSubscription {
    // @ts-ignore
    return eventEmitter.addListener('onAgentReady', callback);
  },

  /**
   * 监听部署进度事件
   */
  addOnDeployProgressListener(
    callback: (event: DeployProgressEvent) => void
  ): EventSubscription {
    // @ts-ignore
    return eventEmitter.addListener('onDeployProgress', callback);
  },

  /**
   * 监听错误事件
   */
  addOnErrorListener(
    callback: (event: ErrorEvent) => void
  ): EventSubscription {
    // @ts-ignore
    return eventEmitter.addListener('onError', callback);
  },
};

export default UsbAgentModule;