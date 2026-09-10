import { useCallback, useEffect, useState } from 'react';
import { loadBootstrap } from './lib/api';
import type { BootstrapData } from './lib/types';
import { Workbench } from './pages/Workbench';
import { Knowledge } from './pages/Knowledge';
import { Boundaries } from './pages/Boundaries';
import { SettingsModal } from './components/SettingsModal';

type Page = 'workbench' | 'knowledge' | 'boundaries';

export default function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [page, setPage] = useState<Page>('workbench');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setBootstrap(await loadBootstrap());
      setErr(null);
    } catch (e) {
      setErr(`无法连接后端服务:${(e as Error).message}.请确认 server 已启动(见 README)。`);
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const nav: { id: Page; label: string; icon: string }[] = [
    { id: 'workbench', label: '审批工作台', icon: '🏦' },
    { id: 'knowledge', label: '金融知识库', icon: '📚' },
    { id: 'boundaries', label: '职责与边界', icon: '🧭' },
  ];

  if (err) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div className="max-w-sm rounded-2xl bg-white p-6 text-center shadow-lg">
          <div className="mb-2 text-4xl">🔌</div>
          <h1 className="mb-1 text-[15px] font-bold text-slate-800">后端服务未连接</h1>
          <p className="mb-4 text-[12.5px] leading-relaxed text-slate-500">{err}</p>
          <button onClick={reload} className="rounded-lg bg-bank px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-bank-light">重试</button>
        </div>
      </div>
    );
  }

  if (!bootstrap) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div className="flex items-center gap-3 text-slate-400">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-bank border-t-transparent" />
          加载中…
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      {/* 顶栏 */}
      <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-2 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-bank text-[15px] font-bold text-white">银</span>
          <div>
            <h1 className="text-[14px] font-bold leading-tight text-slate-800">银行信贷审批智能 Agent</h1>
            <p className="text-[10px] leading-tight text-slate-400">对公/零售审批 · 四部门职责边界 · 知识驱动产品方案</p>
          </div>
        </div>

        <nav className="mx-auto flex gap-1 rounded-xl bg-slate-100 p-0.5">
          {nav.map((n) => (
            <button key={n.id} onClick={() => setPage(n.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-all ${
                page === n.id ? 'bg-white text-bank shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              <span>{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>

        <button onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] text-slate-600 hover:border-bank hover:text-bank">
          ⚙️ 设置
          <span className={`rounded-full px-1.5 text-[10px] font-semibold text-white ${bootstrap.config.provider === 'mock' ? 'bg-slate-400' : 'bg-bank'}`}>
            {bootstrap.config.provider === 'mock' ? 'Mock' : 'CodeBuddy'}
          </span>
        </button>
      </header>

      {/* 主体 */}
      <main className="min-h-0 flex-1">
        {page === 'workbench' && <Workbench bootstrap={bootstrap} />}
        {page === 'knowledge' && <Knowledge bootstrap={bootstrap} />}
        {page === 'boundaries' && <Boundaries bootstrap={bootstrap} />}
      </main>

      {settingsOpen && (
        <SettingsModal bootstrap={bootstrap} onClose={() => setSettingsOpen(false)} onSaved={reload} />
      )}
    </div>
  );
}
