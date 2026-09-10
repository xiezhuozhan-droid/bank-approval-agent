import { createApp } from './app.js';

const PORT = Number(process.env.PORT || 8787);
const app = createApp();

// 仅在作为独立进程(而非被 Electron 内嵌导入)时启动监听
const isMain = process.argv[1] && (process.argv[1].endsWith('index.js') || process.argv[1].endsWith('index.ts'));
if (isMain || process.env.BAA_EMBEDDED !== '1') {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[bank-approval-agent] server listening on http://127.0.0.1:${PORT}`);
  });
}

export { createApp };
