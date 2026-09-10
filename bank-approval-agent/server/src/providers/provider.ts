import type { ServerEvent, ChatRequest } from '../domain/types.js';

// ============================================================================
// Provider 抽象:Mock(规则引擎+知识库,开箱即用)与 CodeBuddy(真实 Agent SDK)
// 遵循同一事件流协议,前端无需感知底层差异
// ============================================================================

export interface Provider {
  readonly name: 'mock' | 'codebuddy';
  readonly label: string;
  /**
   * 执行一次交互(全链路审批 / 产品方案 / 知识问答),把事件逐个写入 emit。
   * 可异步 yield 事件流,也可用回调同步推送;实现二选一,由 providerRegistry 适配。
   */
  run(req: ChatRequest, emit: (ev: ServerEvent) => void): Promise<void>;
}

export type Emit = (ev: ServerEvent) => void;

/** 小工具:让 async generator 式实现也能当普通函数用 */
export async function runProvider(p: Provider, req: ChatRequest, emit: Emit): Promise<void> {
  await p.run(req, emit);
}
