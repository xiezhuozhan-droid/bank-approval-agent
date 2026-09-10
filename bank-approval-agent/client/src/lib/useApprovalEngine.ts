import { useCallback, useReducer } from 'react';
import type {
  ServerEvent, StageId, DeptId, DeptOpinion, ProductSolution,
  ApprovalDecision, CaseKind,
} from './types';

// ============================================================================
// 前端状态机:把后端 NDJSON 事件流规约成可渲染 UI 状态。
// 一个"卡"(block) = agent_block + 若干 delta + block_end + 若干 tool 调用
// ============================================================================

export interface StageState {
  id: StageId;
  title: string;
  status: 'idle' | 'active' | 'done' | 'error';
  note?: string;
}

export interface BlockState {
  blockId: string;
  stage: StageId;
  dept: DeptId;
  role: string;
  title: string;
  verdict?: string;
  text: string;
  running: boolean;
  tools: { tool: string; status: 'start' | 'end' | 'error'; title: string }[];
}

export interface EngineState {
  running: boolean;
  runId?: string;
  kind?: CaseKind;
  stages: Record<StageId, StageState>;
  order: StageId[];
  blocks: BlockState[];
  activeBlock?: string;
  opinions: Partial<Record<DeptId, DeptOpinion>>;
  product?: ProductSolution;
  decision?: ApprovalDecision;
  qa?: { q: string; a: string };
  done?: string;
  error?: string;
}

const STAGE_ORDER: StageId[] = ['business', 'tech', 'risk', 'compliance', 'product', 'decision'];

function freshStages(): Record<StageId, StageState> {
  const titles: Record<StageId, string> = {
    business: '业务受理与尽调',
    tech: '科技数据核验',
    risk: '风险独立审查',
    compliance: '合规审查',
    product: '产品方案',
    decision: '有权审批',
  };
  return Object.fromEntries(
    STAGE_ORDER.map((id) => [id, { id, title: titles[id], status: 'idle' }]),
  ) as Record<StageId, StageState>;
}

export const INITIAL: EngineState = {
  running: false,
  stages: freshStages(),
  order: STAGE_ORDER,
  blocks: [],
  opinions: {},
};

type Action =
  | { type: 'reset' }
  | { type: 'begin'; runId: string; kind: CaseKind }
  | ServerEvent;

function applyStage(state: EngineState, ev: Extract<ServerEvent, { type: 'stage' }>): EngineState {
  const s = state.stages[ev.stage] ?? { id: ev.stage, title: ev.title, status: 'idle' };
  const status: StageState['status'] = ev.status === 'start' ? 'active' : ev.status === 'error' ? 'error' : 'done';
  // 若后续 start 又回来(CodeBuddy 每段都发 start)则覆盖
  return {
    ...state,
    stages: { ...state.stages, [ev.stage]: { ...s, title: ev.title, note: ev.note, status } },
  };
}

function upsertBlock(state: EngineState, blockId: string, patch: Partial<BlockState>): EngineState {
  const idx = state.blocks.findIndex((b) => b.blockId === blockId);
  if (idx >= 0) {
    const blocks = state.blocks.slice();
    blocks[idx] = { ...blocks[idx], ...patch };
    return { ...state, blocks };
  }
  const base: BlockState = {
    blockId,
    stage: 'business',
    dept: 'business',
    role: 'Agent',
    title: '',
    text: '',
    running: true,
    tools: [],
  };
  return { ...state, blocks: [...state.blocks, { ...base, ...patch }] };
}

function reducer(state: EngineState, action: Action): EngineState {
  switch (action.type) {
    case 'reset':
      return { ...INITIAL, stages: freshStages() };
    case 'begin':
      return { ...INITIAL, stages: freshStages(), running: true, runId: action.runId, kind: action.kind };

    case 'stage':
      return applyStage(state, action);
    case 'agent_block': {
      const next = upsertBlock(state, action.blockId, {
        stage: action.stage, dept: action.dept, role: action.role, title: action.title,
        verdict: action.verdict, running: true,
      });
      return { ...next, activeBlock: action.blockId };
    }
    case 'delta': {
      const next = upsertBlock(state, action.blockId, { running: true });
      const idx = next.blocks.findIndex((b) => b.blockId === action.blockId);
      const blocks = next.blocks.slice();
      blocks[idx] = { ...blocks[idx], text: blocks[idx].text + action.text };
      return { ...next, blocks };
    }
    case 'tool': {
      const next = upsertBlock(state, action.blockId, {});
      const idx = next.blocks.findIndex((b) => b.blockId === action.blockId);
      const tools = next.blocks[idx].tools.slice();
      const tidx = tools.findIndex((t) => t.tool === action.tool);
      const tool = { tool: action.tool, status: action.status, title: action.title };
      if (tidx >= 0) tools[tidx] = { ...tools[tidx], status: action.status, title: action.title };
      else tools.push(tool);
      const blocks = next.blocks.slice();
      blocks[idx] = { ...blocks[idx], tools };
      return { ...next, blocks };
    }
    case 'block_end': {
      const idx = state.blocks.findIndex((b) => b.blockId === action.blockId);
      if (idx < 0) return state;
      const blocks = state.blocks.slice();
      blocks[idx] = { ...blocks[idx], running: false };
      return { ...state, blocks };
    }
    case 'opinion':
      return { ...state, opinions: { ...state.opinions, [action.dept]: action.opinion } };
    case 'product':
      return { ...state, product: action.product };
    case 'decision':
      return { ...state, decision: action.decision };
    case 'qa':
      return { ...state, qa: { q: action.q, a: action.a } };
    case 'done':
      return { ...state, running: false, done: action.summary };
    case 'error':
      return { ...state, running: false, error: action.message };
    default:
      return state;
  }
}

export function useApprovalEngine() {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const handleEvent = useCallback((ev: ServerEvent) => dispatch(ev), []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);
  const begin = useCallback((runId: string, kind: CaseKind) => dispatch({ type: 'begin', runId, kind }), []);
  return { state, dispatch, handleEvent, reset, begin };
}

