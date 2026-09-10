import type { EngineState } from '../lib/useApprovalEngine';
import { DEPT_META, VERDICT_STYLE, money } from '../lib/ui';
import type { DeptId, DeptOpinion } from '../lib/types';

function OpinionCard({ op }: { op: DeptOpinion }) {
  const meta = DEPT_META[op.dept];
  const badge = {
    同意: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    有条件同意: 'bg-amber-50 text-amber-700 border-amber-200',
    否决: 'bg-red-50 text-red-700 border-red-200',
    补充材料: 'bg-blue-50 text-blue-700 border-blue-200',
    不适用: 'bg-slate-100 text-slate-500 border-slate-200',
  }[op.conclusion];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
      <div className="mb-1 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
        <span className="text-[12px] font-semibold text-slate-700">{meta.label}</span>
        <span className={`ml-auto rounded-full border px-2 py-px text-[10.5px] font-medium ${badge}`}>{op.conclusion}</span>
      </div>
      <p className="text-[11.5px] leading-relaxed text-slate-500">{op.summary}</p>
      {op.veto && <p className="mt-1 text-[10.5px] font-medium text-red-500">🚫 合规独立否决</p>}
    </div>
  );
}

function DeptAvatars({ opinions }: { opinions: Partial<Record<DeptId, DeptOpinion>> }) {
  const depts: DeptId[] = ['business', 'tech', 'risk', 'compliance'];
  return (
    <div className="flex items-center gap-1">
      {depts.map((d) => {
        const op = opinions[d];
        const meta = DEPT_META[d];
        const ok = op?.conclusion === '同意' || op?.conclusion === '有条件同意' || op?.conclusion === '不适用';
        const color = !op ? '#cbd5e1' : op.conclusion === '否决' ? '#dc2626' : meta.color;
        return (
          <span key={d} title={op ? `${meta.label}:${op.conclusion}` : `${meta.label}:等待`}
            className="flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px]"
            style={{ borderColor: `${color}44`, background: `${color}0c`, color }}>
            <span className={`h-1.5 w-1.5 rounded-full`} style={{ background: color }} />
            {op ? (ok ? '✓' : '✕') : '…'}{meta.label.slice(0, 2)}
          </span>
        );
      })}
    </div>
  );
}

export function DecisionPanel({ state }: { state: EngineState }) {
  const { product, decision, opinions, done } = state;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-800">审批结论看板</h2>

      {/* 部门意见 */}
      {Object.keys(opinions).length > 0 && (
        <section>
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">部门审查意见</h3>
          <DeptAvatars opinions={opinions} />
          <div className="mt-2 space-y-2">
            {(['business', 'tech', 'risk', 'compliance'] as DeptId[])
              .filter((d) => opinions[d])
              .map((d) => <OpinionCard key={d} op={opinions[d]!} />)}
          </div>
        </section>
      )}

      {/* 产品方案 */}
      {product && (
        <section>
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">产品方案(知识驱动)</h3>
          <div className="rounded-lg border border-bank/20 bg-bank/5 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[13px] font-bold text-bank-dark">{product.productName}</p>
              <span className="text-[11px] text-slate-400">{money(product.amountWan)}</span>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-600">
              <span>期限:{product.termMonths} 个月</span>
              <span>利率:{product.rate}</span>
              <span className="col-span-2">担保:{product.security}</span>
              <span className="col-span-2">支付:{product.channel}</span>
            </div>
            {product.rationale.slice(0, 3).map((r, i) => (
              <p key={i} className="mt-1.5 text-[11px] leading-relaxed text-slate-500">• {r}</p>
            ))}
          </div>
        </section>
      )}

      {/* 决策 */}
      {decision && (
        <section>
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">有权审批决策</h3>
          <div className="rounded-lg border border-slate-200 p-3">
            <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[13px] font-bold ${VERDICT_STYLE[decision.verdict].cls}`}>
              <span>{VERDICT_STYLE[decision.verdict].icon}</span>
              {decision.verdict}
            </span>
            <dl className="mt-2 space-y-1 text-[11.5px]">
              <div className="flex justify-between"><dt className="text-slate-400">批准金额</dt><dd className="font-semibold text-slate-700">{money(decision.approvedAmountWan)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">授权层级</dt><dd className="text-right text-slate-700">{decision.authorityLevel}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">审批人</dt><dd className="text-slate-700">{decision.approver}</dd></div>
            </dl>
            <p className="mt-2 border-t border-slate-100 pt-1.5 text-[11px] leading-relaxed text-slate-500">{decision.summary}</p>
          </div>
        </section>
      )}

      {/* 完成汇总 */}
      {done && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-[11.5px] leading-relaxed text-emerald-800">
          {done}
        </div>
      )}

      {!product && !decision && Object.keys(opinions).length === 0 && (
        <div className="py-6 text-center text-[12px] text-slate-400">
          运行审批后,部门意见、产品方案与决策将在此汇总
        </div>
      )}
    </div>
  );
}
