# Windows 智能运维助手 (Windows Intelligent O&M Assistant)

基于手机端控制的 Windows 主机智能自检、网络修复与系统运维管理系统。通过手机（支持 Wi-Fi、USB 数据线、蓝牙连接）即可远程直观操控，无需在电脑端进行繁琐界面操作，即可完成系统完整性修复、网络故障自愈、进程服务管理及自动化资产巡检。

---

## 🛠 一、 技术栈架构 (Technology Stack)

本系统采用 **C/S (Client-Agent)** 远程控制架构，分为手机控制端与 PC 被控端：

### 1. 手机控制端 (Mobile App)
* **核心框架**：React Native + Expo (SDK 57, React Native 0.86)
* **UI 界面**：采用扁平化、高对比度的深色系（Dark Mode）极客设计风格，按业务划分为 6 大 Tab 功能卡片。
* **通信协议**：WebSocket（实现实时遥测流与故障指令分发）、HTTP 流数据传输（实现补丁推送与报表下载）。

### 2. 电脑被控端 (PC Agent)
* **运行环境**：Node.js
* **核心服务**：基于原生 HTTP 及 WebSocket 服务的轻量级守护进程。
* **系统调用**：通过 Node.js 的 `child_process` 管道，免安装二进制依赖，原生调用 Windows 核心命令（`wmic`、`powershell`、`netsh`、`net user`、`sfc`、`dism`、`chkdsk`）获取真实指标并执行指令。

### 3. 沙盒部署环境
* **容器化**：Docker & Docker Compose (提供独立打包隔离，便于进行沙盒运行测试)。

---

## 📋 二、 主要业务功能 (Core Features)

系统划分为六大核心运维功能板块：

1. **资产巡检管理 (Assets)**
   * 主机规格审计：自动收集主机名、MAC地址、IP、CPU型号、RAM总量、主磁盘容量及显卡（GPU）名称。
   * 软件环境盘点：扫描并列表展示 Windows 注册表 Uninstall 键值中的已安装应用与版本。
   * 系统补丁跟踪：获取 Windows 安全累积性更新记录（KB 补丁编号及更新日期）。
2. **硬件实时监控 (Monitor)**
   * 动态负载遥测：每 3 秒实时推送 CPU 使用率、物理内存占用率及 C 盘磁盘使用百分比。
   * 进程终止控制器：列出高内存占用进程的 PID、CPU 占比及文件路径，支持一键“强制结束”进程。
   * Windows 服务管理：检索 Windows 内部核心系统服务，支持一键“启动/停止/重启”动作。
3. **网络与安全控制 (Net & Security)**
   * 连通性深度诊断：自动扫描外网 Ping 延迟、DNS 解析连通性、本地物理网关状态，并探测 80/443 等端口。
   * 安全用户管理：支持远程新建本地账户、更改权限，或禁用指定用户，防范未授权访问。
   * 防火墙策略分发：支持远程向 Windows 高级防火墙添加或删除入站端口放行规则。
4. **故障一键自愈 (Auto-Repairs)**
   * `一键网络修复`：自动重置网卡接口、刷新本地 DNS 缓存、重置 TCP/IP 和 Winsock 协议栈，秒级修复打不开网页的问题。
   * `一键系统修复`：自动清理系统临时目录与磁盘垃圾，触发 SFC 系统文件自检和 DISM 组件备份文件修补。
   * `一键性能优化`：清理全局缓存，释放内存空间，调整开机自启动开销。
5. **远程与文件传输 (Remote)**
   * 远程 Shell 指令：提供简易终端，可在手机端远程输入 CMD 命令并实时回传执行结果。
   * 配置文件与补丁推送：允许手机将二进制数据流（如修复脚本、更新补丁）远程写入 PC Agent 的 `uploads/` 存储区。
   * 故障日志一键归档：抓取事件查看器日志并一键打包为 `.zip` 归档文件提供下载。
6. **自动巡检报表 (Inspection Reports)**
   * 系统自动巡检：一键评估四大硬件维度，给出系统整体运行的健康结论。
   * 自动生成报表：自动生成包含 UTF-8 BOM 防乱码编码的 Excel 兼容 `.csv` 报表文件和 PDF Mock 巡检日志。

---

## 🚀 三、 部署与打包指南 (Deployment & Build)

### 1. 运行 PC Agent 端

为保证 Agent 拥有执行 SFC、DISM、修改服务及用户账号的系统级权限，**必须以管理员权限运行**：
```bash
# 1. 进入后端目录
cd D:\Project\netops-repair\src\pc-agent

# 2. 安装依赖
npm install

# 3. 启动自检程序 (可选，用以验证命令集兼容性)
node index.js --test

# 4. 以管理员身份启动运维守护进程
node index.js
```

> **沙盒模式运行 (Docker)**
> ```bash
> cd D:\Project\netops-repair\sandbox
> docker-compose up --build
> ```

### 2. 运行 Mobile App 调试端
```bash
# 1. 进入手机端目录
cd D:\Project\netops-repair\mobile-app

# 2. 安装依赖
npm install

# 3. 启动 Metro 开发服务器
npx expo start
```
*启动后，可在电脑浏览器访问 `http://localhost:8081` 进入真机模拟调试，或使用手机 Expo Go 扫码运行。*

### 3. 将 Mobile App 打包编译为 APK (安卓安装包)

系统已默认配置好**本地密钥签名机制**，可有效避开国内网络因直连 Expo 签名服务器导致的 `socket hang up` 挂断报错。

#### 第一步：本地生成签名密钥（JKS 证书）
确保您的电脑上已通过 `winget install Microsoft.OpenJDK.17` 成功配置好 Java 环境，进入目录运行：
```powershell
cd D:\Project\netops-repair\mobile-app

# 生成 release-key.jks 证书，密码统一设为 xzx123456
keytool -genkey -v -keystore release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-alias -storepass xzx123456 -keypass xzx123456 -dname "CN=Xu Zhixuan, OU=NetOps, O=NetOps, L=Beijing, S=Beijing, C=CN"
```

#### 第二步：绑定签名配置文件
项目根目录已创建了 [**`credentials.json`**](file:///D:/Project/netops-repair/mobile-app/credentials.json) 文件以关联刚才生成的本地密钥：
```json
{
  "android": {
    "keystore": {
      "keystorePath": "release-key.jks",
      "keystorePassword": "xzx123456",
      "keyAlias": "my-alias",
      "keyPassword": "xzx123456"
    }
  }
}
```
*在 [**`eas.json`**](file:///D:/Project/netops-repair/mobile-app/eas.json) 的 `preview` 打包配置中，也已绑定 `"credentialsSource": "local"`。*

#### 第三步：登录并触发云端编译
请在电脑上打开代理软件（挂上梯子，假设本地代理端口为 7890），在 PowerShell 中执行：
```powershell
# 1. 登录您的 Expo 账号 (无账号可在此步骤直接免费注册)
npx eas-cli login

# 2. 关联并配对项目 ID
npx eas-cli project:init

# 3. 设置命令行代理环境变量并启动编译
$env:HTTP_PROXY="http://127.0.0.1:7890"
$env:HTTPS_PROXY="http://127.0.0.1:7890"
npx eas-cli build -p android --profile preview
```
*编译会由云端服务器异步执行（大约耗时 3~5 分钟）。编译完毕后终端会自动提供一个 **APK 直链下载地址** 和一个 **安装二维码**，扫码下载即可进行真机操控测试！*
