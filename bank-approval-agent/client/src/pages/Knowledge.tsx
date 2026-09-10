import { useMemo, useState } from 'react';
import type { BootstrapData } from '../lib/types';

export function Knowledge({ bootstrap }: { bootstrap: BootstrapData }) {
  const [kw, setKw] = useState('');
  const [cat, setCat] = useState('all');

  const cats = useMemo(
    () => Array.from(new Set(bootstrap.policies.map((p) => p.category))),
    [bootstrap.policies],
  );
  const list = bootstrap.policies.filter(
    (p) => (cat === 'all' || p.category === cat) &&
      (kw.trim() === '' || `${p.title}${p.body}`.includes(kw.trim())),
  );

  return (
    <div className="mx-auto max-w-4xl p-5">
      <div className="mb-4">
        <h1 className="text-lg font-bold text-slate-800">银行业务金融知识库</h1>
        <p className="text-[12px] text-slate-500">
          授信政策与监管制度库 —— 这些知识被注入到审批 Agent 的判断中(产品匹配、风控阈值、合规红线)。
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          placeholder="搜索制度,如:受托支付、DSCR、抵押率…"
          className="min-w-[240px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] focus:border-bank focus:outline-none"
        />
        <div className="flex gap-1">
          {['all', ...cats].map((c) => (
            <button key={c}
              onClick={() => setCat(c)}
              className={`rounded-full border px-2.5 py-1 text-[11px] ${cat === c ? 'border-bank bg-bank text-white' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700'}`}>
              {c === 'all' ? '全部' : c}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {list.map((p) => (
          <details key={p.id} className="group rounded-xl border border-slate-200 bg-white shadow-sm open:border-bank/40">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 [&::-webkit-details-marker]:hidden">
              <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${p.scope === 'corporate' ? 'bg-sky-100 text-sky-700' : p.scope === 'retail' ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {p.scope === 'corporate' ? '对公' : p.scope === 'retail' ? '零售' : '通用'}
              </span>
              <span className="flex-1 text-[13px] font-medium text-slate-700">{p.title}</span>
              <span className="text-[11px] text-slate-300 group-open:rotate-90 transition-transform">▸</span>
            </summary>
            <div className="border-t border-slate-100 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-slate-600">
              {p.body}
            </div>
          </details>
        ))}
        {list.length === 0 && <p className="py-8 text-center text-[12.5px] text-slate-400">无匹配条目</p>}
      </div>
    </div>
  );
}
