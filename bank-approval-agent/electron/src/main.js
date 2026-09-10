const { app, BrowserWindow, shell, dialog } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');

// ============================================================================
// 银行信贷审批智能 Agent — Electron 桌面封装
// 策略:主进程 fork 一个内嵌 Node 子进程跑后端 Express(server/dist),再加载前端。
//  - 开发模式(BA_A_DEV_URL 存在):加载 Vite dev server(浏览器开发体验一致)
//  - 生产模式:加载内嵌后端托管的 client/dist
// 因此"浏览器可开发、Electron 可分发"两套都成立。
// ============================================================================

const DEV_URL = process.env.BA_DEV_URL || process.env.BAA_DEV_URL || '';
const SERVER_PORT = Number(process.env.BAA_PORT || 8791);

let serverChild = null;
let win = null;

function waitForServer(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      http
        .get(url, (res) => {
          if (res.statusCode === 200) return resolve();
          res.resume();
          retry();
        })
        .on('error', retry);
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) return reject(new Error('内嵌后端启动超时'));
      setTimeout(tick, 300);
    };
    tick();
  });
}

function startServer() {
  const serverDir = path.join(__dirname, '..', '..', 'server');
  // 开发态:dist 未编译则用 tsx 跑源码;生产态:直接 node dist/index.js
  const rootNodeBin = path.join(__dirname, '..', '..', 'node_modules', '.bin');
  let entry = path.join(serverDir, 'dist', 'index.js');
  let cmd = process.execPath; // electron 的 node(配合 ELECTRON_RUN_AS_NODE=1)
  let args = [entry];
  let useTsx = false;
  if (!fs.existsSync(entry)) {
    useTsx = true;
    entry = path.join(serverDir, 'src', 'index.ts');
    cmd = 'node'; // 用系统 node 直接跑 .ts 需 tsx loader,改用下方的 tsx bin
    const tsxCandidates = [
      path.join(serverDir, 'node_modules', '.bin', 'tsx'),
      path.join(rootNodeBin, 'tsx'),
    ];
    const tsxBin = tsxCandidates.find((p) => fs.existsSync(p));
    if (!tsxBin) {
      console.error('未找到 tsx,请先 npm install(server 或根目录)。');
      app.quit();
      return null;
    }
    cmd = tsxBin;
    args = [entry];
  }

  const child = spawn(cmd, args, {
    cwd: serverDir,
    env: {
      ...process.env,
      PORT: String(SERVER_PORT),
      BAA_EMBEDDED: '1',
      ELECTRON_RUN_AS_NODE: '1', // 让 electron 二进制充当纯 Node,跑内嵌后端
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[server:err] ${d}`));
  child.on('exit', (code) => {
    if (!app.isQuitting) {
      console.error('内嵌后端退出 code=' + code);
      if (win) dialog.showErrorBox('后端异常', `审批服务意外退出(code=${code})。`);
      if (!useTsx && code !== 0) app.quit();
    }
  });
  return child;
}

async function createWindow() {
  const apiBase = `http://127.0.0.1:${SERVER_PORT}`;
  await waitForServer(`${apiBase}/api/health`);

  win = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1180,
    minHeight: 720,
    title: '银行信贷审批智能 Agent',
    backgroundColor: '#f1f5f9',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const loadUrl = DEV_URL || `${apiBase}/`;
  await win.loadURL(loadUrl);
}

app.on('window-all-closed', () => {
  app.isQuitting = true;
  if (serverChild) serverChild.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (serverChild) serverChild.kill();
});

app.whenReady().then(async () => {
  serverChild = startServer();
  try {
    await createWindow();
  } catch (e) {
    dialog.showErrorBox('启动失败', String(e));
    app.quit();
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
