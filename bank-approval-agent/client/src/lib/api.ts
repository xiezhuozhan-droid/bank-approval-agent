import type {
  ServerEvent, BootstrapData, Mode, ProviderName,
} from './types';

const BASE = import.meta.env.VITE_API_BASE ?? '';

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

export async function loadBootstrap(): Promise<BootstrapData> {
  return json<BootstrapData>('/api/bootstrap');
}

export async function saveConfig(body: {
  provider?: ProviderName;
  codebuddyApiKey?: string;
  codebuddyEnvironment?: string;
  autoFallback?: boolean;
}) {
  return json<{ ok: boolean; config: Record<string, unknown> }>('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * 发起一次审批/问答,消费 NDJSON(Sse 风格)事件流。
 * onEvent 每收到一条事件回调一次;返回 Promise 在流结束时 resolve。
 */
export async function runChat(params: {
  caseId: string;
  mode: Mode;
  provider: ProviderName;
  question?: string;
  onEvent: (ev: ServerEvent) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      caseId: params.caseId,
      mode: params.mode,
      provider: params.provider,
      question: params.question,
    }),
    signal: params.signal,
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const line = chunk.trim();
        if (line.startsWith('data: ')) {
          try {
            params.onEvent(JSON.parse(line.slice(6)) as ServerEvent);
          } catch {
            /* 忽略无法解析的行 */
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
