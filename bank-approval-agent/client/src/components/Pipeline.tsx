import type { EngineState } from '../lib/useApprovalEngine';
import { DEPT_META } from '../lib/ui';
import type { DeptId } from '../lib/types';

const STAGE_DEPT: Record<string, DeptId> = {
  business: 'business',
  tech: 'tech',
  risk: 'risk',
  compliance: 'compliance',
  product: 'business',
  decision: 'risk',
};

export function Pipeline({ state }: { state: EngineState }) {
  const { stages, order, blocks } = state;

  // 每阶段当前区块数(用于徽标)
  const countIn = (sid: string) => blocks.filter((b) => b.stage === sid && b.text.trim().length > 0).length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          {state.running && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bank opacity-60" />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${state.running ? 'bg-bank' : 'bg-slate-300'}`} />
        </span>
        <h2 className="text-sm font-semibold text-slate-800">四部门协同流水线</h2>
        {state.runId && <span className="ml-auto font-mono text-[10px] text-slate-400">run #{state.runId}</span>}
      </div>

      <ol className="space-y-1.5">
        {order.map((sid, i) => {
          const s = stages[sid];
          const meta = DEPT_META[STAGE_DEPT[sid]];
          const n = countIn(sid);
          const dot = s.status === 'done' ? '✓' : s.status === 'active' ? '…' : s.status === 'error' ? '✕' : String(i + 1);
          const ring = s.status === 'active' ? 'ring-2 ring-bank ring-offset-1' : '';
          return (
            <li
              key={sid}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-all ${ring} ${
                s.status === 'done' ? 'border-slate-200 bg-slate-50/60' : 'border-slate-200 bg-white'
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${
                  s.status === 'done' ? '' : s.status === 'active' ? '' : 'opacity-40'
                }`}
                style={{ background: s.status === 'active' || s.status === 'done' ? meta.color : '#cbd5e1' }}
              >
                {dot}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12.5px] font-medium text-slate-700">{s.title}</span>
                  <span className="rounded px-1 text-[10px] font-medium" style={{ color: meta.color, background: meta.bg }}>
                    {meta.label}
                  </span>
                </div>
                {s.note && <p className="truncate text-[10.5px] text-slate-400">{s.note}</p>}
              </div>
              {n > 0 && (
                <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-500">{n} 卡</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
