package expo.modules.usbagent

import android.content.Context
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.util.Log
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class UsbAgentModule : Module() {
    
    companion object {
        private const val TAG = "UsbAgentModule"
    }
    
    private val usbManager: UsbManager by lazy {
        appContext.reactContext?.getSystemService(Context.USB_SERVICE) as UsbManager
    }
    
    override fun definition() = ModuleDefinition {
        Name("UsbAgent")
        
        Events("onUsbDeviceAttached", "onUsbDeviceDetached", "onAgentReady", "onError")
        
        AsyncFunction("getDevices") { promise: Promise ->
            try {
                val devices = usbManager.deviceList
                val deviceList = devices.values.map { device ->
                    mapOf(
                        "deviceId" to device.deviceId,
                        "vendorId" to device.vendorId,
                        "productId" to device.productId,
                        "deviceName" to device.deviceName
                    )
                }
                promise.resolve(deviceList)
            } catch (e: Exception) {
                promise.reject("ERROR", e.message)
            }
        }
        
        AsyncFunction("startAutoDeploy") { promise: Promise ->
            try {
                val devices = usbManager.deviceList.values
                if (devices.isEmpty()) {
                    promise.reject("NO_DEVICE", "No USB device found")
                    return@AsyncFunction
                }
                
                sendEvent("onAgentReady", mapOf("port" to 3001, "status" to "ready"))
                promise.resolve(mapOf("success" to true, "port" to 3001))
            } catch (e: Exception) {
                promise.reject("ERROR", e.message)
            }
        }
    }
}
