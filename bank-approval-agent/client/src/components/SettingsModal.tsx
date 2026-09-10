import { useState } from 'react';
import type { BootstrapData, ProviderName } from '../lib/types';
import { saveConfig } from '../lib/api';

export function SettingsModal({ bootstrap, onClose, onSaved }: {
  bootstrap: BootstrapData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const cfg = bootstrap.config;
  const [provider, setProvider] = useState<ProviderName>(cfg.provider);
  const [apiKey, setApiKey] = useState('');
  const [env, setEnv] = useState(cfg.codebuddyEnvironment || '');
  const [autoFallback, setAutoFallback] = useState(cfg.autoFallback);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const envOptions = [
    ['', '复用 CodeBuddy CLI 登录态 / 默认环境'],
    ['internal', '中国版(copilot.tencent.com)'],
    ['external', '海外版(codebuddy.ai)'],
    ['ioa', '腾讯 iOA 专网版'],
    ['cloudhosted', '专享版'],
    ['selfhosted', '私有化部署'],
  ];

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await saveConfig({
        provider,
        codebuddyApiKey: apiKey.trim() || undefined,
        codebuddyEnvironment: env,
        autoFallback,
      });
      setMsg({ ok: true, text: '已保存。若切换至 CodeBuddy 需已登录 CLI 或配置 API Key。' });
      onSaved();
    } catch (e) {
      setMsg({ ok: false, text: `保存失败:${(e as Error).message}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-[15px] font-bold text-slate-800">设置 · Agent 引擎</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-slate-600">审批引擎 Provider</p>
            <div className="space-y-2">
              <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 ${provider === 'mock' ? 'border-bank bg-bank/5' : 'border-slate-200 hover:border-slate-300'}`}>
                <input type="radio" checked={provider === 'mock'} onChange={() => setProvider('mock')} className="mt-1 accent-[#0f4c81]" />
                <div>
                  <p className="text-[13px] font-semibold text-slate-800">内置 Mock 规则引擎</p>
                  <p className="text-[11px] text-slate-500">内置银行知识库+规则引擎,离线可用,无需任何凭据。适合演示与开发。</p>
                </div>
              </label>
              <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 ${provider === 'codebuddy' ? 'border-bank bg-bank/5' : 'border-slate-200 hover:border-slate-300'}`}>
                <input type="radio" checked={provider === 'codebuddy'} onChange={() => setProvider('codebuddy')} className="mt-1 accent-[#0f4c81]" />
                <div>
                  <p className="text-[13px] font-semibold text-slate-800">CodeBuddy Agent(真实大模型)</p>
                  <p className="text-[11px] text-slate-500">由 CodeBuddy Agent 扮演四部门+产品经理+有权审批人协同审查。需已登录 CodeBuddy CLI 或配置 API Key。</p>
                </div>
              </label>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[12px] font-semibold text-slate-600">CodeBuddy 认证</p>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={cfg.hasApiKey ? '已配置 API Key(留空保持不变)…' : '粘贴 CODEBUDDY_API_KEY(可选)…'}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] focus:border-bank focus:outline-none"
            />
            <select value={env} onChange={(e) => setEnv(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] focus:border-bank focus:outline-none">
              {envOptions.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
            <p className="mt-1 text-[10.5px] text-slate-400">未配置时自动复用已登录的 CodeBuddy CLI;若两者皆无会回退 Mock。</p>
          </div>

          <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
            <input type="checkbox" checked={autoFallback} onChange={(e) => setAutoFallback(e.target.checked)} className="accent-[#0f4c81]" />
            CodeBuddy 调用失败时自动回退 Mock,保证演示不中断
          </label>

          {msg && (
            <p className={`rounded-lg px-3 py-2 text-[12px] ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg.text}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-[12.5px] text-slate-600 hover:bg-slate-50">取消</button>
          <button onClick={save} disabled={saving}
            className="rounded-lg bg-bank px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-bank-light disabled:opacity-60">
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
