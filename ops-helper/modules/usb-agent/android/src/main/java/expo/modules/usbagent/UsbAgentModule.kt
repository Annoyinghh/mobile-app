package expo.modules.usbagent

import android.content.Context
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class UsbAgentModule : Module() {
    
    companion object {
        private const val TAG = "UsbAgentModule"
    }
    
    private val usbManager: UsbManager? by lazy {
        appContext.reactContext?.getSystemService(Context.USB_SERVICE) as? UsbManager
    }
    
    override fun definition() = ModuleDefinition {
        Name("UsbAgent")
        
        Events("onUsbDeviceAttached", "onUsbDeviceDetached", "onAgentReady", "onError")
        
        AsyncFunction("getDevices") {
            val manager = usbManager ?: throw Exception("USB Manager is not available")
            val devices = manager.deviceList
            devices.values.map { device ->
                mapOf(
                    "deviceId" to device.deviceId,
                    "vendorId" to device.vendorId,
                    "productId" to device.productId,
                    "deviceName" to device.deviceName
                )
            }
        }
        
        AsyncFunction("startAutoDeploy") {
            val manager = usbManager ?: throw Exception("USB Manager is not available")
            val devices = manager.deviceList.values
            if (devices.isEmpty()) {
                throw Exception("No USB device found")
            }
            
            sendEvent("onAgentReady", mapOf("port" to 3001, "status" to "ready"))
            mapOf("success" to true, "port" to 3001)
        }
    }
}
