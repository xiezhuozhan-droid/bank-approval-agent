import { useEffect, useRef } from 'react';
import type { BlockState, EngineState } from '../lib/useApprovalEngine';
import { DEPT_META } from '../lib/ui';
import { Md } from './Markdown';

function DeptAvatar({ dept }: { dept: BlockState['dept'] }) {
  const meta = DEPT_META[dept];
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white text-[11px] font-bold shadow-sm"
      style={{ background: meta.color }}
    >
      {meta.label.slice(0, 2)}
    </div>
  );
}

function ToolPill({ tools }: { tools: BlockState['tools'] }) {
  const active = tools[tools.length - 1];
  if (!active || active.status !== 'start') return null;
  return (
    <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-bank/20 bg-bank/5 px-2 py-0.5 text-[10.5px] text-bank-dark">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bank" />
      <span className="font-medium">{active.tool}</span>
      <span className="text-slate-400">·</span>
      <span className="text-slate-500">{active.title}</span>
    </div>
  );
}

function BlockCard({ block, streaming }: { block: BlockState; streaming: boolean }) {
  const meta = DEPT_META[block.dept];
  const isStreaming = streaming && block.running;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* 卡头 */}
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-3 py-2" style={{ background: `${meta.color}08` }}>
        <DeptAvatar dept={block.dept} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-slate-800">{block.role}</span>
            {block.verdict && (
              <span className="rounded border px-1.5 py-px text-[10px] font-medium" style={{ color: meta.color, borderColor: `${meta.color}55`, background: `${meta.color}10` }}>
                {block.verdict}
              </span>
            )}
          </div>
          <p className="truncate text-[11px] text-slate-400">{block.title}</p>
        </div>
        {isStreaming && (
          <span className="flex items-center gap-1 text-[10px] text-slate-400">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-bank" />
            生成中
          </span>
        )}
      </div>
      {/* 卡体 */}
      <div className="px-3 py-2.5">
        <ToolPill tools={block.tools} />
        {block.text ? (
          <Md>{block.text}</Md>
        ) : (
          <div className="flex space-x-1 py-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:0ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:120ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:240ms]" />
          </div>
        )}
      </div>
    </div>
  );
}

export function MessageThread({ state }: { state: EngineState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [state.blocks.length, state.blocks.map((b) => b.text.length).reduce((a, b) => a + b, 0)]);

  // 空态提示
  if (!state.running && state.blocks.length === 0 && !state.done && !state.error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-400">
        <div className="text-5xl">🏦</div>
        <p className="max-w-xs text-[13px] leading-relaxed">
          选择左侧案例,点击 <b className="text-slate-500">「发起全链路审批」</b>,
          四部门(业务/科技/风控/合规)将协同审查并给出产品方案与审批决策。
        </p>
      </div>
    );
  }

  return (
    <div ref={ref} className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      {state.blocks.map((b) => (
        <BlockCard key={b.blockId} block={b} streaming={state.running} />
      ))}
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-[12.5px] text-red-700">
          ⚠️ {state.error}
        </div>
      )}
      {state.running && state.blocks.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-[12.5px] text-slate-500">
          <span className="h-2 w-2 animate-ping rounded-full bg-bank" /> 正在组织四部门协同审查…
        </div>
      )}
    </div>
  );
}
