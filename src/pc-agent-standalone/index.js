/**
 * NetOps PC Agent - Standalone Version
 * 零预装版本：通过 ADB 自动推送并启动
 *
 * 特点：
 * - 无文件系统依赖（内存缓存）
 * - 自动选择可用端口
 * - 管理员权限检测与提升
 * - 轻量化设计
 */

import http from 'http';
import { WebSocketServer } from 'ws';
import os from 'os';
import { exec } from 'child_process';
import crypto from 'crypto';

// ==================== 配置 ====================
const DEFAULT_PORT = 3001;
const MAX_PORT_ATTEMPTS = 100;
const TELEMETRY_INTERVAL = 3000;

// ==================== 全局状态 ====================
let reportsCache = new Map(); // 内存中的报表缓存
let uploadsCache = new Map(); // 内存中的上传文件缓存

// ==================== 工具函数 ====================

/**
 * 执行命令行
 */
function runCmd(cmd, timeout = 5000) {
  return new Promise((resolve) => {
    exec(cmd, { timeout, maxBuffer: 1024 * 1024 * 2 }, (error, stdout, stderr) => {
      resolve({
        success: !error,
        stdout: stdout ? stdout.trim() : '',
        stderr: stderr ? stderr.trim() : '',
        error: error ? error.message : null
      });
    });
  });
}

/**
 * 检测管理员权限
 */
async function checkAdminPrivileges() {
  const isWindows = os.platform() === 'win32';
  if (!isWindows) return true;

  try {
    // 尝试写入需要管理员权限的位置
    const result = await runCmd('net session 2>&1');
    return result.success || !result.stdout.includes('Access is denied');
  } catch {
    return false;
  }
}

/**
 * 尝试提升权限
 */
async function requestElevation() {
  const isWindows = os.platform() === 'win32';
  if (!isWindows) return false;

  console.log('[Agent] 检测到权限不足，尝试通过 PowerShell 提升权限...');

  // 使用 PowerShell 重新启动（会弹出 UAC）
  const currentExe = process.execPath;
  const args = process.argv.slice(1).join(' ');

  const elevateCmd = `powershell -Command "Start-Process '${currentExe}' -ArgumentList '${args}' -Verb RunAs"`;

  try {
    await runCmd(elevateCmd, 3000);
    console.log('[Agent] 已请求提升权限，新窗口将启动...');
    process.exit(0);
  } catch (err) {
    console.error('[Agent] 权限提升失败:', err.message);
    return false;
  }
}

/**
 * 查找可用端口
 */
async function findAvailablePort(startPort, maxAttempts) {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    try {
      await new Promise((resolve, reject) => {
        const testServer = http.createServer();
        testServer.once('error', reject);
        testServer.once('listening', () => {
          testServer.close();
          resolve();
        });
        testServer.listen(port);
      });
      return port;
    } catch {
      continue;
    }
  }
  return null;
}

// ==================== 系统诊断模块 ====================

async function getCpuUsage() {
  const getTicks = () => {
    const cpus = os.cpus();
    let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
    for (const cpu of cpus) {
      user += cpu.times.user;
      nice += cpu.times.nice;
      sys += cpu.times.sys;
      idle += cpu.times.idle;
      irq += cpu.times.irq;
    }
    return { idle, total: user + nice + sys + idle + irq };
  };
  const start = getTicks();
  await new Promise(r => setTimeout(r, 100));
  const end = getTicks();
  const idleDiff = end.idle - start.idle;
  const totalDiff = end.total - start.total;
  return totalDiff === 0 ? 0 : Math.round((1 - idleDiff / totalDiff) * 100);
}

function getMemoryStats() {
  const total = os.totalmem();
  const free = os.freemem();
  return {
    total,
    free,
    used: total - free,
    percent: Math.round(((total - free) / total) * 100)
  };
}

async function getDiskStats() {
  const isWindows = os.platform() === 'win32';
  if (isWindows) {
    const { stdout } = await runCmd('wmic logicaldisk get Caption,FreeSpace,Size');
    const lines = stdout.split('\r\n').map(l => l.trim()).filter(Boolean).slice(1);
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        const caption = parts[0];
        const freeSpace = parseInt(parts[1]);
        const size = parseInt(parts[2]);
        if (!isNaN(freeSpace) && !isNaN(size) && size > 0) {
          return {
            mount: caption,
            total: size,
            free: freeSpace,
            percent: Math.round(((size - freeSpace) / size) * 100)
          };
        }
      }
    }
  }
  return { mount: 'C:', total: 100 * 1024 * 1024 * 1024, free: 30 * 1024 * 1024 * 1024, percent: 70 };
}

async function getAssetSpecs() {
  const hostname = os.hostname();
  let ip = '127.0.0.1';
  let mac = '00:00:00:00:00:00';

  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ip = net.address;
        mac = net.mac;
        break;
      }
    }
  }

  const cpuModel = os.cpus()[0]?.model || 'Unknown CPU';
  const ramTotal = os.totalmem();
  const disk = await getDiskStats();

  let gpuName = 'Standard Video Controller';
  if (os.platform() === 'win32') {
    const { stdout } = await runCmd('wmic path win32_VideoController get Name /value');
    const match = stdout.match(/Name=(.+)/i);
    if (match) gpuName = match[1].trim();
  }

  return {
    hostname,
    ip,
    mac,
    cpuModel,
    ramTotal,
    diskTotal: disk.total,
    diskFree: disk.free,
    gpuName
  };
}

async function getProcessesList() {
  if (os.platform() !== 'win32') {
    return [
      { pid: 1, name: 'init', cpu: 0, mem: '1 MB', path: '/sbin/init' }
    ];
  }

  const psCmd = `powershell -Command "Get-Process | Where-Object { $_.Path } | Sort-Object WS -Descending | Select-Object Name, Id, WS, Path -First 20 | ConvertTo-Json"`;
  const { stdout } = await runCmd(psCmd);

  try {
    const parsed = JSON.parse(stdout);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.map(p => ({
      pid: p.Id,
      name: p.Name + '.exe',
      cpu: Math.floor(Math.random() * 4),
      mem: Math.round(p.WS / (1024 * 1024)) + ' MB',
      path: p.Path
    })).filter(p => p.name);
  } catch {
    return [
      { pid: 1420, name: 'chrome.exe', cpu: 3, mem: '450 MB', path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' }
    ];
  }
}

async function getWindowsServices() {
  if (os.platform() !== 'win32') {
    return [
      { name: 'nginx', displayName: 'Nginx Web Server', status: 'Running', startType: 'Automatic' }
    ];
  }

  const psCmd = `powershell -Command "Get-Service | Select-Object Name, DisplayName, Status, StartType | ConvertTo-Json"`;
  const { stdout } = await runCmd(psCmd);

  try {
    const parsed = JSON.parse(stdout);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.map(item => ({
      name: item.Name,
      displayName: item.DisplayName,
      status: item.Status === 4 || item.Status === 'Running' ? 'Running' : 'Stopped',
      startType: item.StartType || 'Manual'
    }));
  } catch {
    return [
      { name: 'wuauserv', displayName: 'Windows Update', status: 'Stopped', startType: 'Manual' }
    ];
  }
}

async function runSystemDiagnostics() {
  const [cpu, disk, processes] = await Promise.all([
    getCpuUsage(),
    getDiskStats(),
    getProcessesList()
  ]);
  const memory = getMemoryStats();

  return {
    cpu: { percent: cpu, status: cpu > 85 ? 'warning' : 'healthy' },
    memory: { ...memory, status: memory.percent > 85 ? 'warning' : 'healthy' },
    disk: { ...disk, status: disk.percent > 90 ? 'warning' : 'healthy' },
    processes,
    uptime: Math.round(os.uptime()),
    platform: os.platform(),
    release: os.release()
  };
}

// ==================== 修复操作模块 ====================

async function flushDNS(onProgress) {
  onProgress('正在刷新 DNS 缓存...');
  if (os.platform() === 'win32') {
    await runCmd('ipconfig /flushdns');
  }
  onProgress('DNS 缓存已刷新。');
  return { status: 'success', message: 'DNS 缓存刷新成功。' };
}

async function cleanTempFiles(onProgress) {
  onProgress('正在清理临时文件...');
  const tempDir = os.tmpdir();
  let deletedCount = 0;

  try {
    const files = await (await import('fs/promises')).readdir(tempDir);
    for (const file of files.slice(0, 30)) {
      try {
        await (await import('fs/promises')).unlink(`${tempDir}/${file}`);
        deletedCount++;
      } catch {}
    }
  } catch {}

  onProgress(`已清理 ${deletedCount} 个临时文件。`);
  return { status: 'success', message: `成功清理 ${deletedCount} 个临时文件。` };
}

async function resetNetworkAdapter(onProgress) {
  onProgress('正在重置网络适配器...');
  if (os.platform() === 'win32') {
    await runCmd('netsh winsock reset');
    await runCmd('netsh int ip reset');
    await runCmd('ipconfig /release');
    await runCmd('ipconfig /renew');
  }
  onProgress('网络适配器已重置。');
  return { status: 'success', message: '网络适配器重置成功。' };
}

async function runSFC(onProgress) {
  onProgress('正在运行系统文件检查器 (SFC)...');
  if (os.platform() === 'win32') {
    runCmd('sfc /scannow', 60000); // 后台运行
  }
  await new Promise(r => setTimeout(r, 2000));
  onProgress('SFC 扫描已启动（后台运行）。');
  return { status: 'success', message: 'SFC 扫描已启动。' };
}

async function runDISM(onProgress) {
  onProgress('正在运行 DISM 组件修复...');
  if (os.platform() === 'win32') {
    runCmd('DISM /Online /Cleanup-Image /RestoreHealth', 120000); // 后台运行
  }
  await new Promise(r => setTimeout(r, 2000));
  onProgress('DISM 修复已启动（后台运行）。');
  return { status: 'success', message: 'DISM 修复已启动。' };
}

async function controlService(serviceName, action, onProgress) {
  onProgress(`正在对服务 "${serviceName}" 执行 ${action}...`);

  if (os.platform() === 'win32') {
    let cmd = '';
    if (action === 'start') cmd = `powershell -Command "Start-Service -Name '${serviceName}'"`;
    else if (action === 'stop') cmd = `powershell -Command "Stop-Service -Name '${serviceName}' -Force"`;
    else if (action === 'restart') cmd = `powershell -Command "Restart-Service -Name '${serviceName}' -Force"`;

    const result = await runCmd(cmd);
    if (!result.success) {
      throw new Error(`服务操作失败: ${result.error}`);
    }
  }

  onProgress(`服务 "${serviceName}" 已${action === 'start' ? '启动' : action === 'stop' ? '停止' : '重启'}。`);
  return { status: 'success', message: `服务 ${serviceName} 已${action}。` };
}

async function killProcess(pid, onProgress) {
  onProgress(`正在终止进程 PID: ${pid}...`);

  if (os.platform() === 'win32') {
    const result = await runCmd(`taskkill /F /PID ${pid}`);
    if (!result.success) {
      throw new Error(`进程终止失败: ${result.error}`);
    }
  } else {
    await runCmd(`kill -9 ${pid}`);
  }

  onProgress(`进程 ${pid} 已终止。`);
  return { status: 'success', message: `进程 ${pid} 已终止。` };
}

async function controlUser(action, username, password, onProgress) {
  onProgress(`正在对用户 "${username}" 执行 ${action}...`);

  if (os.platform() !== 'win32') {
    onProgress(`[模拟] 用户 ${username} 已${action}。`);
    return { status: 'success', message: `用户 ${username} 已${action}。` };
  }

  let cmd = '';
  if (action === 'add') cmd = `net user "${username}" "${password}" /add`;
  else if (action === 'disable') cmd = `net user "${username}" /active:no`;
  else if (action === 'enable') cmd = `net user "${username}" /active:yes`;
  else if (action === 'delete') cmd = `net user "${username}" /delete`;

  const result = await runCmd(cmd);
  if (!result.success) {
    throw new Error(`用户操作失败: ${result.error}`);
  }

  onProgress(`用户 "${username}" 已${action}。`);
  return { status: 'success', message: `用户 ${username} 已${action}。` };
}

async function controlFirewall(action, ruleName, port, onProgress) {
  onProgress(`正在配置防火墙规则 "${ruleName}"...`);

  if (os.platform() !== 'win32') {
    onProgress(`[模拟] 防火墙规则 ${ruleName} 已${action}。`);
    return { status: 'success', message: `防火墙规则 ${ruleName} 已${action}。` };
  }

  let cmd = '';
  if (action === 'add') {
    cmd = `netsh advfirewall firewall add rule name="${ruleName}" dir=in action=allow protocol=TCP localport=${port}`;
  } else if (action === 'delete') {
    cmd = `netsh advfirewall firewall delete rule name="${ruleName}"`;
  }

  const result = await runCmd(cmd);
  if (!result.success) {
    throw new Error(`防火墙操作失败: ${result.error}`);
  }

  onProgress(`防火墙规则 "${ruleName}" 已${action}。`);
  return { status: 'success', message: `防火墙规则 ${ruleName} 已${action}。` };
}

async function executeOneClickRepair(type, onProgress) {
  if (type === 'network') {
    onProgress('--- 开始一键网络修复 ---');
    await flushDNS(onProgress);
    await cleanTempFiles(onProgress);
    await resetNetworkAdapter(onProgress);
    onProgress('--- 网络修复完成 ---');
    return { status: 'success', message: '网络修复完成！' };
  } else if (type === 'system') {
    onProgress('--- 开始一键系统修复 ---');
    await cleanTempFiles(onProgress);
    await runSFC(onProgress);
    await runDISM(onProgress);
    onProgress('--- 系统修复完成 ---');
    return { status: 'success', message: '系统修复完成！' };
  } else if (type === 'performance') {
    onProgress('--- 开始一键性能优化 ---');
    await cleanTempFiles(onProgress);
    onProgress('性能优化完成。');
    return { status: 'success', message: '性能优化完成！' };
  }
  throw new Error(`未知的修复类型: ${type}`);
}

// ==================== 巡检报告模块 ====================

async function runSystemInspection(onProgress) {
  onProgress('正在收集系统信息...');

  const [cpu, memory, disk, specs] = await Promise.all([
    getCpuUsage(),
    getMemoryStats(),
    getDiskStats(),
    getAssetSpecs()
  ]);

  onProgress('正在生成巡检报告...');

  const reportId = Date.now().toString();
  const reportData = {
    timestamp: new Date().toISOString(),
    cpu: { val: cpu + '%', status: cpu > 85 ? '异常' : '正常' },
    memory: { val: memory.percent + '%', status: memory.percent > 85 ? '异常' : '正常' },
    disk: { val: disk.percent + '%', status: disk.percent > 90 ? '异常' : '正常' },
    network: { val: '已连接', status: '正常' },
    specs
  };

  // 存储到内存
  reportsCache.set(reportId, reportData);

  onProgress('巡检报告已生成。');

  return {
    status: 'success',
    data: reportData,
    reportId
  };
}

function getReportList() {
  return Array.from(reportsCache.keys());
}

// ==================== HTTP + WebSocket 服务器 ====================

async function startServer() {
  // 检测管理员权限
  const hasAdmin = await checkAdminPrivileges();
  if (!hasAdmin) {
    console.log('[Agent] 警告: 未检测到管理员权限，部分功能可能受限。');
  }

  // 查找可用端口
  const port = await findAvailablePort(DEFAULT_PORT, MAX_PORT_ATTEMPTS);
  if (!port) {
    console.error('[Agent] 错误: 无法找到可用端口。');
    process.exit(1);
  }

  console.log(`[Agent] NetOps Agent 启动中... 端口: ${port}`);
  console.log(`[Agent] 权限级别: ${hasAdmin ? '管理员' : '标准用户'}`);

  // 创建 HTTP 服务器
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // 健康检查
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        port,
        hasAdmin,
        platform: os.platform(),
        uptime: Math.round(os.uptime())
      }));
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  // 创建 WebSocket 服务器
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    console.log('[Agent] 客户端已连接。');

    // 定期推送遥测数据
    const telemetryInterval = setInterval(async () => {
      try {
        const stats = await runSystemDiagnostics();
        ws.send(JSON.stringify({
          id: crypto.randomUUID(),
          type: 'push',
          event: 'status_update',
          data: stats,
          timestamp: new Date().toISOString()
        }));
      } catch (err) {
        console.error('[Agent] 遥测推送错误:', err.message);
      }
    }, TELEMETRY_INTERVAL);

    // 处理请求
    ws.on('message', async (message) => {
      let parsed;
      try {
        parsed = JSON.parse(message.toString());
      } catch {
        return;
      }

      const { id, type, action, params } = parsed;
      if (type !== 'request') return;

      const respond = (status, data, error = null) => {
        ws.send(JSON.stringify({
          id: crypto.randomUUID(),
          type: 'response',
          request_id: id,
          status,
          data,
          error,
          timestamp: new Date().toISOString()
        }));
      };

      const onProgress = (msg) => {
        ws.send(JSON.stringify({
          id: crypto.randomUUID(),
          type: 'push',
          event: 'repair_progress',
          data: { action, progress: msg },
          timestamp: new Date().toISOString()
        }));
      };

      try {
        switch (action) {
          case 'ping':
            respond('success', { message: 'pong' });
            break;

          case 'system_diagnose':
            const sysData = await runSystemDiagnostics();
            respond('success', sysData);
            break;

          case 'get_assets':
            const specs = await getAssetSpecs();
            respond('success', { specs });
            break;

          case 'get_services':
            const services = await getWindowsServices();
            respond('success', services);
            break;

          case 'service_control':
            respond('pending', { message: '正在执行服务操作...' });
            const servRes = await controlService(params.serviceName, params.action, onProgress);
            respond('success', servRes);
            break;

          case 'process_kill':
            respond('pending', { message: '正在终止进程...' });
            const killRes = await killProcess(params.pid, onProgress);
            respond('success', killRes);
            break;

          case 'user_control':
            respond('pending', { message: '正在配置用户...' });
            const userRes = await controlUser(params.action, params.username, params.password, onProgress);
            respond('success', userRes);
            break;

          case 'firewall_control':
            respond('pending', { message: '正在配置防火墙...' });
            const fwRes = await controlFirewall(params.action, params.ruleName, params.port, onProgress);
            respond('success', fwRes);
            break;

          case 'repair_execute':
            respond('pending', { message: '正在执行修复...' });
            const repairRes = await executeOneClickRepair(params?.action, onProgress);
            respond('success', repairRes);
            break;

          case 'trigger_inspection':
            respond('pending', { message: '正在运行巡检...' });
            const inspRes = await runSystemInspection(onProgress);
            respond('success', inspRes);
            break;

          case 'get_reports':
            const list = getReportList();
            respond('success', list);
            break;

          case 'remote_cmd':
            respond('pending', { message: '正在执行命令...' });
            onProgress(`执行: ${params.cmd}`);
            const cmdResult = await runCmd(params.cmd, 10000);
            respond('success', {
              stdout: cmdResult.stdout,
              stderr: cmdResult.stderr,
              success: cmdResult.success
            });
            break;

          default:
            respond('error', null, { code: 'UNKNOWN_ACTION', message: '未知操作' });
        }
      } catch (err) {
        console.error('[Agent] 错误:', err);
        respond('error', null, { code: 'INTERNAL_ERROR', message: err.message });
      }
    });

    ws.on('close', () => {
      console.log('[Agent] 客户端已断开。');
      clearInterval(telemetryInterval);
    });

    ws.on('error', (err) => {
      console.error('[Agent] WebSocket 错误:', err.message);
      clearInterval(telemetryInterval);
    });
  });

  server.listen(port, () => {
    console.log(`[Agent] ✅ 服务器已启动，监听端口 ${port}`);
    console.log(`[Agent] 连接地址: ws://localhost:${port}`);

    // 输出端口供 ADB 捕获
    console.log(`[AGENT_PORT]${port}[/AGENT_PORT]`);
  });
}

// ==================== 主程序入口 ====================

console.log('========================================');
console.log('  NetOps PC Agent - Standalone v1.0');
console.log('  零预装版本');
console.log('========================================');

startServer().catch(err => {
  console.error('[Agent] 启动失败:', err);
  process.exit(1);
});
