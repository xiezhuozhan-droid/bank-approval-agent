import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ============================================================================
// 轻量配置存储:Provider 选择、CodeBuddy API Key 等。
// 存到用户目录下 .bank-approval-agent/config.json(不进 git)。
// ============================================================================

export interface AppConfig {
  provider: 'mock' | 'codebuddy';
  codebuddyApiKey: string;
  codebuddyEnvironment: string; // '' | external | internal | ioa | cloudhosted | selfhosted
  autoFallback: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  provider: 'mock',
  codebuddyApiKey: '',
  codebuddyEnvironment: '',
  autoFallback: true,
};

function configDir(): string {
  const base = process.env.BAA_CONFIG_DIR || path.join(os.homedir(), '.bank-approval-agent');
  fs.mkdirSync(base, { recursive: true });
  return base;
}

export function configFile(): string {
  return path.join(configDir(), 'config.json');
}

export function readConfig(): AppConfig {
  try {
    const raw = JSON.parse(fs.readFileSync(configFile(), 'utf-8'));
    return { ...DEFAULT_CONFIG, ...raw };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function writeConfig(patch: Partial<AppConfig>): AppConfig {
  const next = { ...readConfig(), ...patch };
  fs.writeFileSync(configFile(), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

/** 每次请求时把当前配置展开成 Provider 能读到的环境 */
export function toEnv(cfg: AppConfig): Record<string, string> {
  const env: Record<string, string> = {};
  if (cfg.codebuddyApiKey) env.CODEBUDDY_API_KEY = cfg.codebuddyApiKey;
  if (cfg.codebuddyEnvironment) env.CODEBUDDY_INTERNET_ENVIRONMENT = cfg.codebuddyEnvironment;
  if (!cfg.autoFallback) env.AUTO_FALLBACK = 'off';
  return env;
}
