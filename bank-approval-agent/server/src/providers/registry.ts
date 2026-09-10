import type { Provider } from './provider.js';
import type { ProviderName } from '../domain/types.js';
import { MockProvider } from './mockProvider.js';
import { CodeBuddyProvider } from './codebuddyProvider.js';

// ============================================================================
// Provider 注册表:Mock 始终可用;CodeBuddy 需要 SDK + 登录/API Key,
// 未就绪时注册为"占位",切换时会得到清晰的错误提示或自动回退。
// ============================================================================

export function createRegistry(getEnv: () => Record<string, string>) {
  const mock = new MockProvider();
  const codebuddy = new CodeBuddyProvider(getEnv);

  const providers: Record<ProviderName, Provider> = {
    mock,
    codebuddy,
  };

  function get(name?: ProviderName): Provider {
    return (name && providers[name]) || mock;
  }

  return { get, list: (): { name: ProviderName; label: string }[] =>
    Object.values(providers).map((p) => ({ name: p.name, label: p.label })) };
}

export type ProviderRegistry = ReturnType<typeof createRegistry>;
