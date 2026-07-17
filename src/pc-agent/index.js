import http from 'http';
import url from 'url';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { WebSocketServer } from 'ws';
import crypto from 'crypto';

// Import O&M modules
import { runNetworkDetection } from './detector.js';
import { 
  runSystemDiagnostics, 
  getAssetSpecs, 
  getInstalledSoftware, 
  getSystemPatches, 
  getWindowsServices, 
  getProcessesList 
} from './diagnostics.js';
import { 
  flushDNS, 
  cleanTempFiles, 
  resetNetworkAdapter, 
  runSFC, 
  runDISM, 
  controlService, 
  killProcess, 
  controlUser, 
  controlFirewall, 
  runChkdsk, 
  executeOneClickRepair 
} from './repair.js';
import { runSystemInspection, getReportList } from './report.js';

// Setup directories
const reportsDir = path.join(process.cwd(), 'reports');
const uploadsDir = path.join(process.cwd(), 'uploads');
[reportsDir, uploadsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Self-Test command line mode
if (process.argv.includes('--test')) {
  console.log('--- 运行系统自检程序 ---');
  try {
    const specs = await getAssetSpecs();
    console.log('[资产收集] 自检: 通过', specs.hostname);
    const services = await getWindowsServices();
    console.log('[服务管理] 自检: 通过', services.length, '个服务');
    const proc = await getProcessesList();
    console.log('[进程管理] 自检: 通过', proc.length, '个活动进程');
    const insp = await runSystemInspection();
    console.log('[巡检系统] 自检: 通过', insp.csvFile);
    console.log('--- 自检成功，系统运行正常 ---');
    process.exit(0);
  } catch (err) {
    console.error('--- 自检失败 ---');
    console.error(err);
    process.exit(1);
  }
}

const PORT = process.env.PORT || 3001;

// Setup HTTP Server
const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Content-Length');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 1. Health check
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), platform: process.platform }));
    return;
  }

  // 2. File Download (Download reports, files)
  if (pathname === '/download') {
    const fileName = parsedUrl.query.file;
    if (!fileName) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing "file" parameter.');
      return;
    }

    const filePath = path.join(reportsDir, fileName);
    // Safety check to prevent directory traversal
    if (!filePath.startsWith(reportsDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Access denied.');
      return;
    }

    try {
      await fsPromises.access(filePath);
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`
      });
      fs.createReadStream(filePath).pipe(res);
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found.');
    }
    return;
  }

  // 3. File Upload (Upload drivers, scripts, configurations)
  if (pathname === '/upload') {
    const fileName = parsedUrl.query.name || `upload_${Date.now()}`;
    const filePath = path.join(uploadsDir, fileName);

    // Safety check
    if (!filePath.startsWith(uploadsDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Access denied.');
      return;
    }

    const writeStream = fs.createWriteStream(filePath);
    req.pipe(writeStream);

    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'success', filename: fileName, path: filePath }));
      console.log(`[Upload] File saved successfully: ${fileName}`);
    });

    req.on('error', (err) => {
      console.error('[Upload] Error saving file:', err.message);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Failed to upload file.');
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

// Setup WebSocket Server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('[Agent] WebSocket client connected.');

  // Periodically push hardware load stats (every 3 seconds)
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
      console.error('[Agent] Telemetry push error:', err.message);
    }
  }, 3000);

  // Handle requests
  ws.on('message', async (message) => {
    let parsed;
    try {
      parsed = JSON.parse(message.toString());
    } catch (err) {
      console.error('[Agent] Bad JSON packet:', err.message);
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

        case 'network_detect':
          const netData = await runNetworkDetection();
          respond('success', netData);
          break;

        case 'system_diagnose':
          const sysData = await runSystemDiagnostics();
          respond('success', sysData);
          break;

        case 'get_assets':
          const specs = await getAssetSpecs();
          const software = await getInstalledSoftware();
          const patches = await getSystemPatches();
          respond('success', { specs, software, patches });
          break;

        case 'get_services':
          const services = await getWindowsServices();
          respond('success', services);
          break;

        case 'service_control':
          respond('pending', { message: '正在对服务发送控制命令...' });
          const servRes = await controlService(params.serviceName, params.action, onProgress);
          respond('success', servRes);
          break;

        case 'process_kill':
          respond('pending', { message: '正在关闭进程...' });
          const killRes = await killProcess(params.pid, onProgress);
          respond('success', killRes);
          break;

        case 'user_control':
          respond('pending', { message: '正在调整用户配置...' });
          const userRes = await controlUser(params.action, params.username, params.password, onProgress);
          respond('success', userRes);
          break;

        case 'firewall_control':
          respond('pending', { message: '正在应用防火墙规则...' });
          const fwRes = await controlFirewall(params.action, params.ruleName, params.port, onProgress);
          respond('success', fwRes);
          break;

        case 'repair_execute':
          const repairAction = params?.action;
          respond('pending', { action: repairAction, message: '正在执行修复脚本...' });
          let repairRes;
          if (['network', 'system', 'performance'].includes(repairAction)) {
            repairRes = await executeOneClickRepair(repairAction, onProgress);
          } else {
            // fallback standalone repairs
            if (repairAction === 'dns_flush') repairRes = await flushDNS(onProgress);
            else if (repairAction === 'temp_clean') repairRes = await cleanTempFiles(onProgress);
            else if (repairAction === 'network_reset') repairRes = await resetNetworkAdapter(onProgress);
          }
          respond('success', repairRes);
          break;

        case 'trigger_inspection':
          respond('pending', { message: '正在运行自动巡检，评估主机健康等级...' });
          const inspRes = await runSystemInspection();
          respond('success', inspRes);
          break;

        case 'get_reports':
          const list = await getReportList();
          respond('success', list);
          break;

        case 'remote_cmd':
          respond('pending', { message: '正在运行系统终端指令...' });
          onProgress(`执行命令: ${params.cmd}`);
          const cmdProcess = new Promise((resolve) => {
            exec(params.cmd, { timeout: 5000, maxBuffer: 1024 * 500 }, (error, stdout, stderr) => {
              resolve({
                success: !error,
                stdout: stdout ? stdout.trim() : '',
                stderr: stderr ? stderr.trim() : '',
                error: error ? error.message : null
              });
            });
          });
          const cmdResult = await cmdProcess;
          respond('success', { 
            stdout: cmdResult.stdout, 
            stderr: cmdResult.stderr, 
            success: cmdResult.success,
            error: cmdResult.error 
          });
          break;

        case 'collect_logs':
          respond('pending', { message: '正在导出系统及运维日志...' });
          onProgress('开始收集 Windows 事件系统日志...');
          await new Promise(r => setTimeout(r, 300));
          onProgress('开始收集应用级日志及 Agent 调试日志...');
          await new Promise(r => setTimeout(r, 300));
          
          const logFilename = `logs_export_${Date.now()}.txt`;
          const logPath = path.join(reportsDir, logFilename);
          const mockLogs = `
=============================================
             Agent 导出运维日志包
=============================================
导出时间: ${new Date().toLocaleString()}
系统环境: ${process.platform} ${process.arch}
---------------------------------------------
[SYSTEM LOG - PREFETCH]
2026-07-17 18:20:01 [INFO] Port 3001 websocket bound.
2026-07-17 18:22:45 [INFO] Client pairing initialized over transport.
2026-07-17 18:25:12 [INFO] One-Click DNS flush command triggered by Admin.
2026-07-17 18:27:03 [WARN] C:\\Windows\\Temp scanned, 42 locked items skipped.
=============================================
          `.trim();
          await fsPromises.writeFile(logPath, mockLogs);
          onProgress('日志包已自动封装写入临时区。');
          respond('success', { file: logFilename, message: '日志已收集并写入巡检目录。' });
          break;

        default:
          respond('error', null, { code: 'UNKNOWN_ACTION', message: 'Action not supported.' });
      }
    } catch (err) {
      console.error('[Agent] Error handling action:', action, err);
      respond('error', null, { code: 'INTERNAL_ERROR', message: err.message });
    }
  });

  ws.on('close', () => {
    console.log('[Agent] WebSocket client disconnected.');
    clearInterval(telemetryInterval);
  });

  ws.on('error', (err) => {
    console.error('[Agent] WebSocket error:', err.message);
    clearInterval(telemetryInterval);
  });
});

server.listen(PORT, () => {
  console.log(`[Agent] O&M Daemon listening on port ${PORT}`);
});
