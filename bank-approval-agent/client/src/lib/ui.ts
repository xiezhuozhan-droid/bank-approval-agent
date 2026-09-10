import type { DeptId, DecisionVerdict } from './types';

export const DEPT_META: Record<DeptId, { color: string; bg: string; border: string; label: string }> = {
  business: { color: '#0f6fbf', bg: '#eaf3fb', border: '#0f6fbf', label: '业务部' },
  risk: { color: '#c0392b', bg: '#fdf0ee', border: '#c0392b', label: '风控部' },
  tech: { color: '#16a085', bg: '#e9f7f3', border: '#16a085', label: '科技部' },
  compliance: { color: '#8e44ad', bg: '#f6eefb', border: '#8e44ad', label: '合规部' },
};

export const VERDICT_STYLE: Record<DecisionVerdict, { cls: string; icon: string }> = {
  通过: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: '✓' },
  有条件通过: { cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: '◐' },
  否决: { cls: 'bg-red-50 text-red-700 border-red-200', icon: '✕' },
  需人工复核: { cls: 'bg-blue-50 text-blue-700 border-blue-200', icon: '△' },
};

export const REDFLAG_STYLE: Record<string, string> = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-50 text-slate-600 border-slate-200',
};

export function money(v: number): string {
  return v.toLocaleString('zh-CN') + ' 万';
}

export function esc(s: string): string {
  const el = document.createElement('div');
  el.textContent = s;
  return el.innerHTML;
}
