import type { ApprovalCase } from '../lib/types';

function CaseCard({ c, active, onSelect }: { c: ApprovalCase; active: boolean; onSelect: () => void }) {
  const isCorp = c.kind === 'corporate';
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-lg border px-2.5 py-2 text-left transition-all ${
        active ? 'border-bank bg-bank/5 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${isCorp ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}`}>
          {isCorp ? '对公' : '零售'}
        </span>
        <span className="text-[11px] font-semibold text-slate-500">{c.request.amountWan} 万</span>
      </div>
      <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-snug text-slate-700">{c.title}</p>
      <p className="mt-0.5 text-[10.5px] leading-snug text-slate-400">{c.request.line}</p>
      {/* 风险信号点 */}
      <div className="mt-1 flex gap-1">
        {c.redFlags.map((f, i) => (
          <span
            key={i}
            title={f.text}
            className={`h-1.5 w-1.5 rounded-full ${f.level === 'high' ? 'bg-red-500' : f.level === 'medium' ? 'bg-amber-400' : 'bg-slate-300'}`}
          />
        ))}
      </div>
    </button>
  );
}

export function Sidebar({
  cases, activeId, onSelect, group,
}: {
  cases: ApprovalCase[];
  activeId?: string;
  onSelect: (id: string) => void;
  group: 'all' | 'corporate' | 'retail';
}) {
  const filtered = cases.filter((c) => group === 'all' || c.kind === group);
  const corporate = filtered.filter((c) => c.kind === 'corporate');
  const retail = filtered.filter((c) => c.kind === 'retail');

  const Section = ({ title, list }: { title: string; list: ApprovalCase[] }) =>
    list.length === 0 ? null : (
      <div>
        <p className="mb-1 px-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
        <div className="space-y-1.5">
          {list.map((c) => (
            <CaseCard key={c.id} c={c} active={activeId === c.id} onSelect={() => onSelect(c.id)} />
          ))}
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      <Section title="对公授信案例" list={corporate} />
      <Section title="零售信贷案例" list={retail} />
    </div>
  );
}
