import { useEffect, useRef, useState } from 'react';
import type { ApprovalCase, BootstrapData, Mode, ProviderName } from '../lib/types';
import { runChat } from '../lib/api';
import { useApprovalEngine } from '../lib/useApprovalEngine';
import { Sidebar } from '../components/Sidebar';
import { Pipeline } from '../components/Pipeline';
import { MessageThread } from '../components/MessageThread';
import { DecisionPanel } from '../components/DecisionPanel';
import { REDFLAG_STYLE } from '../lib/ui';

type Group = 'all' | 'corporate' | 'retail';

export function Workbench({ bootstrap }: { bootstrap: BootstrapData }) {
  const { state, handleEvent, reset, begin } = useApprovalEngine();
  const [activeId, setActiveId] = useState<string>(bootstrap.cases[0]?.id ?? '');
  const [group, setGroup] = useState<Group>('all');
  const [mode, setMode] = useState<Mode>('full_review');
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const active = bootstrap.cases.find((c) => c.id === activeId);
  const currentProvider = bootstrap.config.provider;

  // 切换案例自动清空
  useEffect(() => {
    reset();
    setQuestion('');
  }, [activeId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const cfg = bootstrap.config;

  async function go() {
    if (!active || busy) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true);
    reset();
    try {
      await runChat({
        caseId: active.id,
        mode,
        provider: currentProvider,
        question: mode === 'question' ? question : undefined,
        onEvent: handleEvent,
        signal: ac.signal,
      });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        handleEvent({ type: 'error', message: (e as Error).message });
      }
    } finally {
      setBusy(false);
    }
  }

  const qaShortcuts = [
    '风控部的职责边界是什么?',
    '流动资金贷款受托支付有什么要求?',
    '本案例最大的风险点在哪?',
  ];

  return (
    <div className="grid h-full grid-cols-[240px_minmax(0,1fr)_360px] gap-3 p-3">
      {/* ===== 左:案例选择 ===== */}
      <aside className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70">
        <div className="border-b border-slate-200 bg-white px-2.5 py-2">
          <h2 className="text-sm font-semibold text-slate-800">授信案例库</h2>
          <div className="mt-1.5 flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-medium">
            {(['all', 'corporate', 'retail'] as Group[]).map((g) => (
              <button key={g} onClick={() => setGroup(g)}
                className={`flex-1 rounded-md py-1 ${group === g ? 'bg-white text-bank shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {g === 'all' ? '全部' : g === 'corporate' ? '对公' : '零售'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-2">
          <Sidebar cases={bootstrap.cases} group={group} activeId={activeId} onSelect={setActiveId} />
        </div>
        <div className="border-t border-slate-200 bg-white px-2.5 py-1.5 text-[10px] text-slate-400">
          Provider: {currentProvider === 'mock' ? 'Mock 规则引擎' : 'CodeBuddy Agent'} · {cfg.hasApiKey ? '已配置 Key' : '免 Key'}
        </div>
      </aside>

      {/* ===== 中:审批主线程 ===== */}
      <main className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* 控制条 */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-700 focus:border-bank focus:outline-none"
          >
            <option value="full_review">四部门全链路审批</option>
            <option value="product_plan">产品方案设计</option>
            <option value="question">知识问答</option>
          </select>

          {mode === 'question' ? (
            <>
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && go()}
                placeholder="提问:职责边界 / 授信政策 / 监管红线…"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] focus:border-bank focus:outline-none"
              />
              <div className="flex gap-1">
                {qaShortcuts.slice(0, 2).map((s) => (
                  <button key={s} onClick={() => setQuestion(s)}
                    className="hidden truncate rounded-full border border-slate-200 px-2 py-1 text-[10px] text-slate-500 hover:border-bank hover:text-bank xl:block">
                    {s}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="min-w-0 flex-1 truncate text-[11px] text-slate-400">
              {active?.title} · 申请 {active?.request.amountWan} 万 / {active?.request.termMonths} 月
            </p>
          )}

          <button
            onClick={go}
            disabled={busy || (mode === 'question' && !question.trim())}
            className="rounded-lg bg-bank px-4 py-1.5 text-[12.5px] font-semibold text-white shadow-sm transition-all hover:bg-bank-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? '审批进行中…' : mode === 'question' ? '提问' : mode === 'product_plan' ? '生成产品方案' : '发起全链路审批'}
          </button>
          {busy && (
            <button
              onClick={() => { abortRef.current?.abort(); setBusy(false); }}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] text-slate-500 hover:bg-slate-50"
            >
              停止
            </button>
          )}
        </div>

        {/* 主线程区:左 pipeline · 中消息 */}
        <div className="grid min-h-0 flex-1 grid-cols-[200px_minmax(0,1fr)]">
          <div className="min-h-0 overflow-y-auto border-r border-slate-100 p-2">
            <Pipeline state={state} />
          </div>
          <MessageThread state={state} />
        </div>
      </main>

      {/* ===== 右:决策看板 ===== */}
      <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto">
        {active && <CasePanel c={active} />}
        <DecisionPanel state={state} />
      </aside>
    </div>
  );
}

function CasePanel({ c }: { c: ApprovalCase }) {
  const isCorp = c.kind === 'corporate';
  const rows = isCorp ? c.financials : c.profile;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 text-[13px] font-bold leading-snug text-slate-800">{c.title}</h2>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{c.summary}</p>

      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        {[
          { k: '金额', v: `${c.request.amountWan}万` },
          { k: '期限', v: `${c.request.termMonths}月` },
          { k: '担保', v: c.request.security.split('+')[0].slice(0, 5) },
        ].map((x) => (
          <div key={x.k} className="rounded-lg bg-slate-50 px-1 py-1.5">
            <p className="text-[10px] text-slate-400">{x.k}</p>
            <p className="truncate text-[11.5px] font-semibold text-slate-700">{x.v}</p>
          </div>
        ))}
      </div>

      {rows && rows.length > 0 && (
        <div className="mt-2 rounded-lg border border-slate-100">
          {rows.slice(0, 6).map((r, i) => (
            <div key={i} className={`flex justify-between gap-2 px-2 py-1 text-[11px] ${i % 2 ? 'bg-slate-50/50' : ''}`}>
              <span className="shrink-0 text-slate-400">{r.label}</span>
              <span className="text-right font-medium text-slate-600">{r.value}</span>
            </div>
          ))}
        </div>
      )}

      {c.redFlags.length > 0 && (
        <div className="mt-2 space-y-1">
          {c.redFlags.map((f, i) => (
            <div key={i} className={`flex items-start gap-1.5 rounded-md border px-2 py-1 text-[10.5px] leading-snug ${REDFLAG_STYLE[f.level]}`}>
              <span className="mt-0.5">{f.level === 'high' ? '⛔' : f.level === 'medium' ? '⚠️' : '○'}</span>
              {f.text}
            </div>
          ))}
        </div>
      )}
      {c.note && <p className="mt-2 border-t border-slate-100 pt-1.5 text-[10.5px] italic text-slate-400">💡 {c.note}</p>}
    </div>
  );
}
