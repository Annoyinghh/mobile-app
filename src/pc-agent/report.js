import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { runSystemDiagnostics, getAssetSpecs } from './diagnostics.js';
import { runNetworkDetection } from './detector.js';

/**
 * Run system inspection and compile report documents
 */
export async function runSystemInspection() {
  const reportsDir = path.join(process.cwd(), 'reports');
  
  // Ensure reports directory exists
  try {
    await fs.mkdir(reportsDir, { recursive: true });
  } catch (e) {
    // Already exists
  }

  // Gather live parameters
  const sys = await runSystemDiagnostics();
  const specs = await getAssetSpecs();
  const net = await runNetworkDetection();
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const nowStr = new Date().toLocaleString();

  // Evaluate status rules
  const cpuStatus = sys.cpu.percent > 85 ? '警告' : '正常';
  const memStatus = sys.memory.percent > 85 ? '警告' : '正常';
  const diskStatus = sys.disk.percent > 90 ? '警告' : '正常';
  const netStatus = net.ping.status === 'success' ? '正常' : '异常';

  const reportData = {
    time: nowStr,
    hostname: specs.hostname,
    ip: specs.ip,
    cpu: { val: `${sys.cpu.percent}%`, status: cpuStatus },
    memory: { val: `${sys.memory.percent}%`, status: memStatus },
    disk: { val: `${sys.disk.percent}%`, status: diskStatus },
    network: { val: net.ping.status === 'success' ? `${net.ping.latency} ms` : '测试失败', status: netStatus },
    services: { val: '正常', status: '正常' }
  };

  // Compile CSV (Excel compatible with UTF-8 BOM)
  const csvFilename = `inspection_report_${timestamp}.csv`;
  const csvPath = path.join(reportsDir, csvFilename);
  
  const csvHeaders = '\ufeff指标项目,监控数值,健康状态\n';
  const csvRows = [
    `检测时间,${reportData.time},正常`,
    `主机名称,${reportData.hostname},正常`,
    `局域网 IP,${reportData.ip},正常`,
    `CPU 使用率,${reportData.cpu.val},${reportData.cpu.status}`,
    `内存占用率,${reportData.memory.val},${reportData.memory.status}`,
    `磁盘空间 (C盘),${reportData.disk.val},${reportData.disk.status}`,
    `外网通信延迟,${reportData.network.val},${reportData.network.status}`
  ].join('\n');
  
  await fs.writeFile(csvPath, csvHeaders + csvRows);

  // Compile TXT Report (simulated PDF export)
  const txtFilename = `inspection_report_${timestamp}.txt`;
  const txtPath = path.join(reportsDir, txtFilename);
  
  const txtContent = `
=============================================
        Windows 智能运维助手 - 主机自检巡检报告
=============================================
检测时间: ${reportData.time}
主机名称: ${reportData.hostname}
本地 IP : ${reportData.ip}
---------------------------------------------
【系统状态摘要】
* CPU 状态: ${reportData.cpu.val} -- [${reportData.cpu.status}]
* 内存状态: ${reportData.memory.val} -- [${reportData.memory.status}]
* 磁盘状态: ${reportData.disk.val} -- [${reportData.disk.status}]
* 网络通信: ${reportData.network.val} -- [${reportData.network.status}]

【详细审计指标】
1. 操作系统: ${specs.osName} (${specs.osRelease})
2. 物理内存: ${(specs.ramTotal / (1024*1024*1024)).toFixed(2)} GB
3. 处理器  : ${specs.cpuModel}
4. 显卡设备: ${specs.gpuName}

【巡检结论】
${cpuStatus === '正常' && memStatus === '正常' && diskStatus === '正常' 
  ? '结论：系统目前各项运行指标极其健康，未发现资源占用异常。' 
  : '结论：警告！部分硬件指标已触发黄色阈值告警，请在手机控制端及时清理垃圾或终止异常高占用进程。'}
=============================================
  `.trim();

  await fs.writeFile(txtPath, txtContent);

  return {
    csvFile: csvFilename,
    pdfFile: txtFilename,
    data: reportData
  };
}

/**
 * Fetch list of generated O&M inspection reports
 */
export async function getReportList() {
  const reportsDir = path.join(process.cwd(), 'reports');
  try {
    const files = await fs.readdir(reportsDir);
    return files.filter(f => f.startsWith('inspection_report_')).sort().reverse();
  } catch (e) {
    return [];
  }
}
