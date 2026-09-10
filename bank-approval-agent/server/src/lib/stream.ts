import type { ServerEvent } from '../domain/types.js';

// ============================================================================
// NDJSON 流式写入工具:把 ServerEvent 编码为 `data: {...}\n\n`(SSE 兼容),
// 便于前端用 fetch + ReadableStream 逐行消费。
// ============================================================================

export class StreamWriter {
  private closed = false;

  constructor(private res: import('express').Response) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 关闭 nginx 缓冲
    res.flushHeaders?.();
  }

  write(ev: ServerEvent): boolean {
    if (this.closed) return false;
    this.res.write(`data: ${JSON.stringify(ev)}\n\n`);
    return true;
  }

  /** 结束流(尝试发送 done 由调用方决定) */
  end() {
    if (this.closed) return;
    this.closed = true;
    this.res.end();
  }

  error(message: string) {
    this.write({ type: 'error', message });
    this.end();
  }

  get isClosed() {
    return this.closed;
  }
}
