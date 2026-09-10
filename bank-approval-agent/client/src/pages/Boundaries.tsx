import { useState } from 'react';
import type { BootstrapData, DeptId, Department } from '../lib/types';
import { DEPT_META } from '../lib/ui';

// 各环节 × 部门 RACI:谁主责 / 谁支持 / 谁审批 / 谁知情
const RACI: { task: string; R: DeptId; A: DeptId; C: DeptId; I: DeptId }[] = [
  { task: '客户营销与尽职调查', R: 'business', A: 'business', C: 'risk', I: 'tech' },
  { task: '评级 / 限额 / 押品评估', R: 'risk', A: 'risk', C: 'compliance', I: 'business' },
  { task: '信贷系统与数据接口', R: 'tech', A: 'tech', C: 'risk', I: 'compliance' },
  { task: '合规审查与反洗钱', R: 'compliance', A: 'compliance', C: 'risk', I: 'business' },
  { task: '授信审批(有权人/审贷会)', R: 'risk', A: 'risk', C: 'compliance', I: 'business' },
  { task: '放款前提条件落实', R: 'business', A: 'risk', C: 'compliance', I: 'tech' },
  { task: '贷后监测与预警处理', R: 'business', A: 'risk', C: 'compliance', I: 'tech' },
];

const RACI_LABEL: Record<string, { t: string; d: string }> = {
  R: { t: 'R·负责执行', d: 'Responsible,实际经办与执行' },
  A: { t: 'A·批准/审批', d: 'Accountable,对结果承担最终责任' },
  C: { t: 'C·咨询/会签', d: 'Consulted,提供意见后被咨询' },
  I: { t: 'I·知情', d: 'Informed,结果需知会' },
};

function DeptCard({ d }: { d: Department }) {
  const meta = DEPT_META[d.id];
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="px-3 py-2.5" style={{ borderTop: `3px solid ${meta.color}` }}>
        <div className="flex items-center gap-2">
          <span className="rounded px-1.5 py-px text-[10px] font-bold text-white" style={{ background: meta.color }}>
            {d.position}
          </span>
          <h3 className="flex-1 text-[14px] font-bold text-slate-800">{d.short}</h3>
          <span className="text-[10.5px] text-slate-400">{d.defense}</span>
        </div>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-600">{d.mission}</p>
      </div>
      <div className="border-t border-slate-100 px-3 py-2 text-[11.5px]">
        <p className="mb-1 font-semibold text-slate-500">核心职能</p>
        <ul className="mb-2 list-disc space-y-0.5 pl-4 text-slate-600">{d.functions.map((f, i) => <li key={i}>{f}</li>)}</ul>
        <p className="mb-1 font-semibold text-slate-500">职责边界(不越位)</p>
        <ul className="space-y-0.5 border-l-2 pl-3 text-slate-500" style={{ borderColor: meta.color }}>
          {d.boundaries.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      </div>
    </div>
  );
}

export function Boundaries({ bootstrap }: { bootstrap: BootstrapData }) {
  const { departments, pipelineOwnership, authorityLadder } = bootstrap;
  const [tab, setTab] = useState<'matrix' | 'raci' | 'authority' | 'flow'>('matrix');

  const deptById = (id: DeptId) => departments.find((x) => x.id === id);
  const cell = (id: DeptId) => {
    const m = DEPT_META[id];
    return <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: m.color }}>{m.label.slice(0, 2)}</span>;
  };

  return (
    <div className="mx-auto max-w-5xl p-5">
      <div className="mb-4">
        <h1 className="text-lg font-bold text-slate-800">部门职能与职责边界</h1>
        <p className="text-[12px] text-slate-500">
          银行"三道防线"组织治理:前台业务(一道)·中台风控(二道)·后台科技(支撑)·合规(三道独立监督)。审批决策权归有权审批人/审贷会。
        </p>
      </div>

      <div className="mb-3 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 w-fit">
        {([
          ['matrix', '四部门总览'],
          ['raci', 'RACI 职责矩阵'],
          ['authority', '分级授权'],
          ['flow', '流程主责'],
        ] as [string, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k as never)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium ${tab === k ? 'bg-bank text-white' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'matrix' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {departments.map((d) => <DeptCard key={d.id} d={d} />)}
        </div>
      )}

      {tab === 'raci' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-2 text-left text-slate-500">授信环节</th>
                {(['business', 'tech', 'risk', 'compliance'] as DeptId[]).map((id) => (
                  <th key={id} className="px-2 py-2 text-center">
                    <div className="mb-0.5 flex justify-center">{cell(id)}</div>
                    <span className="text-[11px] font-semibold text-slate-600">{DEPT_META[id].label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RACI.map((row, i) => {
                const cols: (keyof typeof row)[] = ['R', 'A', 'C', 'I'];
                const map: Record<string, DeptId> = { R: row.R, A: row.A, C: row.C, I: row.I };
                return (
                  <tr key={i} className={i % 2 ? 'bg-slate-50/40' : ''}>
                    <td className="px-3 py-2 font-medium text-slate-700">{row.task}</td>
                    {cols.map((k) => {
                      const d = map[k];
                      const meta = DEPT_META[d];
                      const info = RACI_LABEL[k];
                      return (
                        <td key={k} className="border-l border-slate-100 px-2 py-2 text-center">
                          <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold"
                            style={{ color: meta.color, borderColor: `${meta.color}44`, background: `${meta.color}0a` }}>
                            {info.t.split('·')[0]}·{meta.label}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-3 border-t border-slate-100 bg-slate-50/50 px-3 py-2 text-[10.5px] text-slate-500">
            {Object.entries(RACI_LABEL).map(([k, v]) => (
              <span key={k}>{v.t}:{v.d}</span>
            ))}
          </div>
        </div>
      )}

      {tab === 'authority' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                <th className="px-3 py-2">授信范围 / 风险</th>
                <th className="px-3 py-2">授权决策层级</th>
                <th className="px-3 py-2">牵头条线</th>
              </tr>
            </thead>
            <tbody>
              {authorityLadder.map((a, i) => (
                <tr key={i} className={i % 2 ? 'bg-slate-50/40' : 'border-t border-slate-100'}>
                  <td className="px-3 py-2 text-slate-600">{a.range}</td>
                  <td className="px-3 py-2 font-medium text-slate-700">{a.level}</td>
                  <td className="px-3 py-2 text-slate-500">{a.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
            注:示意性分级授权,实际以各行《授信审批授权管理办法》与客户评级/行业政策为准。超权限、集团客户、高风险客户一律上收。
          </p>
        </div>
      )}

      {tab === 'flow' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                <th className="px-3 py-2">环节</th>
                <th className="px-3 py-2">主责部门</th>
                <th className="px-3 py-2">配合部门</th>
              </tr>
            </thead>
            <tbody>
              {pipelineOwnership.map((r, i) => (
                <tr key={i} className={i % 2 ? 'bg-slate-50/40' : 'border-t border-slate-100'}>
                  <td className="px-3 py-2 font-medium text-slate-700">{r.stage}</td>
                  <td className="px-3 py-2 text-slate-600">{r.owner}</td>
                  <td className="px-3 py-2 text-slate-500">{r.supporter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
