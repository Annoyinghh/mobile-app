/**
 * UsbAgent Expo Config Plugin
 *
 * 添加 USB 权限和原生模块配置
 */

const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

/**
 * 修改 AndroidManifest 添加 USB 权限
 */
function withUsbAndroidManifest(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;

    // 添加 USB 权限
    if (!androidManifest.manifest['$']) {
      androidManifest.manifest['$'] = {};
    }

    // 添加 uses-feature
    if (!androidManifest.manifest['uses-feature']) {
      androidManifest.manifest['uses-feature'] = [];
    }
    androidManifest.manifest['uses-feature'].push({
      $: {
        'android:name': 'android.hardware.usb.host',
        'android:required': 'false',
      },
    });

    // 添加 USB 设备过滤
    const mainActivity = androidManifest.manifest['application'][0]['activity'][0];
    if (!mainActivity['intent-filter']) {
      mainActivity['intent-filter'] = [];
    }

    mainActivity['intent-filter'].push({
      action: [{ $: { 'android:name': 'android.hardware.usb.action.USB_DEVICE_ATTACHED' } }],
    });

    mainActivity['intent-filter'].push({
      action: [{ $: { 'android:name': 'android.hardware.usb.action.USB_DEVICE_DETACHED' } }],
    });

    if (!mainActivity['meta-data']) {
      mainActivity['meta-data'] = [];
    }
    mainActivity['meta-data'].push({
      $: {
        'android:name': 'android.hardware.usb.action.USB_DEVICE_ATTACHED',
        'android:resource': '@xml/device_filter',
      },
    });

    return config;
  });
}

/**
 * UsbAgent 插件
 */
function withUsbAgent(config) {
  // 添加权限
  config = AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.USB_PERMISSION',
    'android.permission.INTERNET',
    'android.permission.ACCESS_NETWORK_STATE',
  ]);

  // 修改 AndroidManifest
  config = withUsbAndroidManifest(config);

  return config;
}

module.exports = withUsbAgent;