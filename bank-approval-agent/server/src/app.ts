import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CASES, DEPARTMENTS, PIPELINE_OWNERSHIP, AUTHORITY_LADDER, POLICY_LIBRARY } from './kb/index.js';
import type { ChatRequest, ServerEvent } from './domain/types.js';
import { createRegistry } from './providers/registry.js';
import { StreamWriter } from './lib/stream.js';
import { readConfig, writeConfig, toEnv } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: '1mb' }));

  const registry = createRegistry(() => toEnv(readConfig()));

  // ---------------- 静态资源:生产模式下由 server 托管 client 构建产物 ----------------
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('/', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  // ============================================================================
  // REST API
  // ============================================================================
  app.get('/api/bootstrap', (_req, res) => {
    const cfg = readConfig();
    res.json({
      cases: CASES,
      departments: DEPARTMENTS,
      pipelineOwnership: PIPELINE_OWNERSHIP,
      authorityLadder: AUTHORITY_LADDER,
      policies: POLICY_LIBRARY,
      providers: registry.list(),
      config: {
        provider: cfg.provider,
        codebuddyEnvironment: cfg.codebuddyEnvironment,
        autoFallback: cfg.autoFallback,
        hasApiKey: !!cfg.codebuddyApiKey,
      },
    });
  });

  app.get('/api/cases', (_req, res) => res.json(CASES));
  app.get('/api/departments', (_req, res) => res.json(DEPARTMENTS));
  app.get('/api/policies', (_req, res) => res.json(POLICY_LIBRARY));
  app.get('/api/providers', (_req, res) => res.json(registry.list()));
  app.get('/api/config', (_req, res) => {
    const cfg = readConfig();
    res.json({ ...cfg, codebuddyApiKey: cfg.codebuddyApiKey ? '••••••••' : '' });
  });

  app.post('/api/config', (req, res) => {
    const body = (req.body ?? {}) as Partial<import('./config.js').AppConfig>;
    const patch: Partial<import('./config.js').AppConfig> = {};
    if (typeof body.provider === 'string') patch.provider = body.provider as never;
    if (typeof body.codebuddyApiKey === 'string') patch.codebuddyApiKey = body.codebuddyApiKey;
    if (typeof body.codebuddyEnvironment === 'string') patch.codebuddyEnvironment = body.codebuddyEnvironment;
    if (typeof body.autoFallback === 'boolean') patch.autoFallback = body.autoFallback;
    const next = writeConfig(patch);
    res.json({ ok: true, config: { ...next, codebuddyApiKey: next.codebuddyApiKey ? '••••••••' : '' } });
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

  // ============================================================================
  // 核心:POST /api/chat —— NDJSON 流式输出
  // ============================================================================
  app.post('/api/chat', async (req, res) => {
    const body = (req.body ?? {}) as ChatRequest;
    if (!body.caseId) {
      res.status(400).json({ error: 'caseId 必填' });
      return;
    }
    if (!['full_review', 'question', 'product_plan'].includes(body.mode ?? '')) body.mode = 'full_review';

    const sw = new StreamWriter(res);
    let aborted = false;
    res.on('close', () => { aborted = true; if (!res.writableEnded) sw.end(); });

    try {
      const cfg = readConfig();
      const provider = registry.get(body.provider ?? cfg.provider);
      const emit = (ev: ServerEvent) => { if (!aborted) sw.write(ev); };
      await provider.run(body, emit);
      if (!aborted && !sw.isClosed) sw.end();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      sw.error(`服务异常:${msg}`);
    }
  });

  return app;
}
