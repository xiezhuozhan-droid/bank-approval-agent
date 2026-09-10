import type { Provider, Emit } from './provider.js';
import type { ChatRequest, ServerEvent, DeptId, DeptOpinion, ProductSolution, ApprovalDecision } from '../domain/types.js';
import { caseById } from '../kb/cases.js';
import { KB_SUMMARY } from '../kb/policies.js';
import { DEPARTMENTS, AUTHORITY_LADDER } from '../kb/index.js';

// ============================================================================
// CodeBuddy Provider —— 通过官方 @tencent-ai/agent-sdk 让 CodeBuddy Agent
// 扮演四个部门 + 产品经理 + 有权审批人,在其系统提示中注入银行知识库与职责边界。
//
// 说明:
//  - SDK 按需动态 import(依赖项未安装 / 未配置凭据时不应阻断 Mock 模式)
//  - 鉴权:复用已登录的 codebuddy CLI,或用环境变量 CODEBUDDY_API_KEY(参见 CODEBUDDY_INTERNET_ENVIRONMENT)
//  - 事件流:把 agent 输出的结构化 JSON(每行一条)转译为与 Mock 一致的 NDJSON 协议,
//    前端无需关心底层到底是规则引擎还是大模型
// ============================================================================

interface SdkMessage {
  type: string;
  message?: { content?: { type: string; text?: string; [k: string]: unknown }[] };
}

type StreamEvent = {
  stage: 'business' | 'tech' | 'risk' | 'compliance' | 'product' | 'decision';
  kind: 'opinion' | 'block' | 'product' | 'decision' | 'stage';
  blockId?: string;
  role?: string;
  dept?: DeptId;
  title?: string;
  text?: string;
  opinion?: DeptOpinion;
  product?: ProductSolution;
  decision?: ApprovalDecision;
};

let _sdkCache: Promise<typeof import('@tencent-ai/agent-sdk')> | null = null;
/** 动态加载 SDK(缺失或未配置时抛错,上层回退 Mock) */
async function loadSdk(): Promise<typeof import('@tencent-ai/agent-sdk')> {
  if (!_sdkCache) _sdkCache = import('@tencent-ai/agent-sdk');
  return _sdkCache;
}

function buildSystemPrompt(caseId: string): string {
  const deptLines = DEPARTMENTS.map(
    (d) => `## ${d.name}(${d.defense})\n职能:${d.functions.join(';')}\n职责边界:${d.boundaries.join(';')}\n一句话权责:${d.approvalDuty}`,
  ).join('\n\n');
  const ladder = AUTHORITY_LADDER.map((a) => `${a.range} → ${a.level}`).join('\n');
  return [
    '你是银行对公/零售授信审批协作智能体。为输入的授信申请,你需依次以四个部门 + 产品经理 + 有权审批人的视角完成审查。',
    '部门职责与边界(严禁越位):',
    deptLines,
    '分级授权(决策机构):',
    ladder,
    '业务金融知识库:',
    KB_SUMMARY(),
    '',
    '输出要求:',
    '1. 分阶段(依次)输出:business → tech → risk → compliance → product → decision。',
    '2. 每阶段输出 JSON 行,形如:',
    '{"stage":"risk","kind":"opinion","dept":"risk","opinion":{"dept":"risk","conclusion":"同意|有条件同意|否决","summary":"...","keyPoints":[...],"conditions":[...]}}',
    '{"stage":"product","kind":"product","product":{"productName":"...","amountWan":123,"termMonths":12,"rate":"...","repayment":"...","security":"...","channel":"...","rationale":[...],"conditions":[...]}}',
    '{"stage":"decision","kind":"decision","decision":{"verdict":"通过|有条件通过|否决|需人工复核","approvedAmountWan":123,"authorityLevel":"...","approver":"...","basis":"...","conditions":[...],"summary":"..."}}',
    '{"stage":"risk","kind":"block","blockId":"risk-1","dept":"risk","role":"风险审查官","title":"...","text":"<markdown 文字段落,供流式展示>"}',
    '3. 也可穿插自然语言(非 JSON 行)作为过程说明;JSON 行必须完整独占一行且为合法 JSON。',
    '4. 结合金融知识给出产品匹配理由(rationale 引用监管制度,如《流动资金贷款管理办法》抵押率、DSCR、月供收入比)。',
    '5. 若存在资本金不实、现金流不足、经营贷流入楼市、涉隐债等红线,risk 或 compliance 须输出否决/有条件结论,decision 给出对应 verdict。',
  ].join('\n\n');
}

export class CodeBuddyProvider implements Provider {
  readonly name = 'codebuddy' as const;
  readonly label = 'CodeBuddy Agent(真实大模型协同)';

  constructor(private getEnv: () => Record<string, string>) {}

  async run(req: ChatRequest, emit: Emit): Promise<void> {
    const c = caseById(req.caseId);
    if (!c) {
      emit({ type: 'error', message: `未找到案例:${req.caseId}` });
      return;
    }
    let sdk: typeof import('@tencent-ai/agent-sdk');
    try {
      sdk = await loadSdk();
    } catch {
      emit({
        type: 'error',
        message:
          '未安装 @tencent-ai/agent-sdk(或未登录 CodeBuddy CLI / 未配置 API Key)。请在「设置」中配置后切换,或使用内置 Mock 模式。',
      });
      return;
    }

    const userContext = [
      `授信申请案例:${c.title}`,
      `申请要素:金额 ${c.request.amountWan} 万,期限 ${c.request.termMonths} 个月,品种「${c.request.line}」,用途「${c.request.purpose}」,担保「${c.request.security}」`,
      `企业/个人画像:` + (c.financials ?? c.profile ?? []).map((f) => `${f.label}:${f.value}`).join(';'),
      `风险信号:` + (c.redFlags ?? []).map((f) => `[${f.level}]${f.text}`).join(';'),
    ].join('\n');
    const prompt =
      req.mode === 'question'
        ? `针对上述授信申请回答一个问题:\n${req.question}\n请引用相关监管制度与部门职责边界,给出可执行的结论。`
        : `请发起完整授信审批协作,四部门逐步审查后输出产品方案与最终决策。\n${userContext}`;

    try {
      const { query } = sdk;
      const options: Record<string, unknown> = {
        permissionMode: 'bypassPermissions',
        maxTurns: 40,
        cwd: process.cwd(),
        allowedTools: [],
        systemPrompt: buildSystemPrompt(c.id),
      };
      // 支持 API Key / 环境切换(仅当显式配置)
      const env = this.getEnv();
      const envVars: Record<string, string> = {};
      if (env.CODEBUDDY_API_KEY) envVars.CODEBUDDY_API_KEY = env.CODEBUDDY_API_KEY;
      if (env.CODEBUDDY_INTERNET_ENVIRONMENT) envVars.CODEBUDDY_INTERNET_ENVIRONMENT = env.CODEBUDDY_INTERNET_ENVIRONMENT;
      if (Object.keys(envVars).length) options.env = envVars;

      emit({ type: 'stage', stage: 'business', status: 'start', title: 'CodeBuddy 已接管,开始四部门协同审查' });
      const conversation = query({ prompt, options } as never);

      let jsonBuffer = '';
      for await (const msg of conversation as AsyncIterable<SdkMessage>) {
        if (msg.type !== 'assistant') continue;
        const blocks = msg.message?.content ?? [];
        for (const b of blocks) {
          if (b.type !== 'text' || !b.text) continue;
          jsonBuffer += b.text;
          // 逐行解析:提取每行独立 JSON
          let idx;
          while ((idx = jsonBuffer.indexOf('\n')) !== -1) {
            const line = jsonBuffer.slice(0, idx).trim();
            jsonBuffer = jsonBuffer.slice(idx + 1);
            if (!line || line.startsWith('//')) continue;
            if (line.startsWith('{') || line.startsWith('[')) {
              try {
                const parsed = JSON.parse(line);
                if (Array.isArray(parsed)) parsed.forEach((e) => this.applyEvent(e, emit));
                else this.applyEvent(parsed, emit);
              } catch {
                // 不是完整 JSON 行 → 当作文本增量交给默认渲染块
                this.delta(emit, line);
              }
            } else {
              this.delta(emit, line);
            }
          }
        }
      }
      emit({ type: 'done', summary: 'CodeBuddy 四部门协同审查结束。' });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      // 若因鉴权等失败,自动回退 Mock,让演示不中断
      if (this.getEnv().AUTO_FALLBACK !== 'off') {
        emit({ type: 'error', message: `CodeBuddy 调用失败(${detail}),已回退 Mock 模式。` });
        const { MockProvider } = await import('./mockProvider.js');
        await new MockProvider().run(req, emit);
      } else {
        emit({ type: 'error', message: `CodeBuddy 调用失败:${detail}` });
      }
    }
  }

  private delta(emit: Emit, text: string) {
    emit({ type: 'delta', blockId: 'cb', text });
  }

  private applyEvent(e: StreamEvent | Record<string, unknown>, emit: Emit) {
    const ev = e as StreamEvent;
    if (!ev || !ev.stage) return;
    emit({ type: 'stage', stage: ev.stage, status: 'start', title: ev.stage });
    switch (ev.kind) {
      case 'opinion':
        if (ev.opinion) emit({ type: 'opinion', dept: ev.dept ?? 'risk', opinion: ev.opinion });
        break;
      case 'product':
        if (ev.product) emit({ type: 'product', product: ev.product });
        break;
      case 'decision':
        if (ev.decision) emit({ type: 'decision', decision: ev.decision });
        break;
      case 'block':
      default:
        if (ev.text) {
          emit({ type: 'agent_block', blockId: ev.blockId ?? 'cb', stage: ev.stage, dept: ev.dept ?? 'risk', role: ev.role ?? '审查员', title: ev.title ?? '' });
          emit({ type: 'delta', blockId: ev.blockId ?? 'cb', text: ev.text });
          emit({ type: 'block_end', blockId: ev.blockId ?? 'cb' });
        }
    }
  }
}
