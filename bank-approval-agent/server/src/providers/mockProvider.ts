import { randomUUID } from 'node:crypto';
import type { Provider, Emit } from './provider.js';
import type {
  ChatRequest, StageId, DeptId, DeptOpinion, ProductSolution, ApprovalCase,
} from '../domain/types.js';
import { DEPARTMENTS, KB } from '../kb/index.js';
import { buildEngineResult, deriveVerdict, getCase, type EngineResult } from '../agents/mockEngine.js';

// ============================================================================
// Mock Provider:确定性多 Agent 编排 —— 用"银行知识库 + 规则引擎"模拟四个部门
// 依次:业务受理 → 科技核验 → 风控审查 → 合规审查 → 产品方案 → 有权审批决策
// 事件流遵循 /api/chat NDJSON 协议,前端可渲染出"部门流水线 + 打字机"效果
//
// 流式模型(前端按 blockId 累积 delta;block_end 仅是"该卡已写完"标记):
//   agent_block(开卡) → tool start → [delta 流式文字] → tool end → block_end(收卡)
// ============================================================================

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const STAGE_TITLE: Record<StageId, string> = {
  business: '业务受理与尽职调查',
  tech: '金融科技 · 数据核验',
  risk: '风险独立审查',
  compliance: '合规与反洗钱审查',
  product: '产品方案设计',
  decision: '有权审批决策',
};

class StreamWriter {
  constructor(private emit: Emit) {}
  /** 直接发送一条协议事件(供需要内嵌非文字结构化事件时使用) */
  send(ev: import('../domain/types.js').ServerEvent) {
    this.emit(ev);
  }
  stage(stage: StageId, status: 'start' | 'end', note?: string) {
    this.emit({ type: 'stage', stage, status, title: STAGE_TITLE[stage], note });
  }
  tool(blockId: string, tool: string, status: 'start' | 'end', title: string) {
    this.emit({ type: 'tool', blockId, tool, status, title });
  }
  blockStart(blockId: string, stage: StageId, dept: DeptId, role: string, title: string, verdict?: string) {
    this.emit({ type: 'agent_block', blockId, stage, dept, role, title, verdict });
  }
  blockEnd(blockId: string) {
    this.emit({ type: 'block_end', blockId });
  }
  delta(blockId: string, text: string) {
    this.emit({ type: 'delta', blockId, text });
  }
  /** 把一段话切成小块流式输出 */
  async speak(blockId: string, text: string, speedMs = 12): Promise<void> {
    const CHUNK = 4;
    for (let i = 0; i < text.length; i += CHUNK) {
      this.delta(blockId, text.slice(i, i + CHUNK));
      await wait(speedMs);
    }
  }
  /** 一个部门整卡输出:工具开始 → 逐条观点流式 → 工具结束 → 收卡 */
  async deptCard(
    blockId: string,
    stage: StageId,
    dept: DeptId,
    role: string,
    title: string,
    verdict: string,
    bullets: string[],
    tool: string,
  ) {
    this.blockStart(blockId, stage, dept, role, title, verdict);
    this.tool(blockId, tool, 'start', `【${role}】${tool}`);
    for (let i = 0; i < bullets.length; i++) {
      const head = i === 0 ? '' : '\n\n';
      await this.speak(blockId, `${head}${i + 1}. ${bullets[i]}`);
    }
    this.tool(blockId, tool, 'end', `【${role}】完成`);
    this.blockEnd(blockId);
  }
}

export class MockProvider implements Provider {
  readonly name = 'mock' as const;
  readonly label = 'Mock 规则引擎(内置银行知识库)';

  async run(req: ChatRequest, emit: Emit): Promise<void> {
    const c = getCase(req.caseId);
    if (!c) {
      emit({ type: 'error', message: `未找到案例:${req.caseId}` });
      return;
    }
    const runId = randomUUID().slice(0, 8);
    emit({ type: 'meta', runId, kind: c.kind });

    // 先整体跑一遍规则引擎(决定各部门要"说"什么)
    const e = await buildEngineResult(c);
    const w = new StreamWriter(emit);
    const title = c.title;

    if (req.mode === 'question') {
      await this.runQuestion(req, c, w);
      return;
    }

    // ---------------- 1. 业务部:受理引导 + 尽调 ----------------
    w.stage('business', 'start', '业务部受理并开展尽职调查');
    const bizBlock = 'biz';
    w.blockStart(bizBlock, 'business', 'business', '受理助理', '授信申请受理与受理意见', '受理');
    await w.speak(bizBlock, `收到授信申请:**${title}**\n\n我将以四部门协同模式开展审查:业务部(真实性)→ 金融科技部(数据)→ 风控部(审慎性)→ 合规部(合规性),并给出产品方案与审批决策。\n\n申请要素:金额 **${c.request.amountWan} 万**,期限 **${c.request.termMonths} 个月**,品种「${c.request.line}」,用途「${c.request.purpose}」,担保「${c.request.security}」。`);
    w.blockEnd(bizBlock);

    w.blockStart('biz-due', 'business', 'business', '客户经理', '尽职调查与申报', '同意提报');
    w.tool('biz-due', '客户尽调', 'start', '面谈 / 实地走访 / 资料核对');
    const bizLines = e.business.opinion;
    for (let i = 0; i < bizLines.length; i++) {
      await w.speak('biz-due', `${i === 0 ? '' : '\n\n'}${i + 1}. ${bizLines[i]}`);
    }
    if (e.business.needDeepCheck.length) {
      await w.speak('biz-due', `\n\n⚠️ ${e.business.needDeepCheck.join(' ')}`);
    }
    w.tool('biz-due', '客户尽调', 'end', '完成');
    w.blockEnd('biz-due');
    emit({
      type: 'opinion', dept: 'business',
      opinion: {
        dept: 'business',
        conclusion: e.business.decision === '受理' ? '同意' : '补充材料',
        summary: '客户主体与经营真实性经尽职调查确认,资料齐全,同意提报审查。',
        keyPoints: e.business.opinion,
        conditions: e.business.needDeepCheck,
      },
    });
    w.stage('business', 'end');

    // ---------------- 2. 金融科技部 ----------------
    w.stage('tech', 'start', '行内数据中台与外部数据交叉核验');
    const techBlock = 'tech';
    w.blockStart(techBlock, 'tech', 'tech', '数据科学家', '数据核验与技术支撑意见', e.tech.passed ? '通过' : '需人工复核');
    w.tool(techBlock, '外部数据接入', 'start', '征信/司法/税务交叉核验');
    const techLines = e.tech.opinion;
    for (let i = 0; i < techLines.length; i++) {
      await w.speak(techBlock, `${i === 0 ? '' : '\n\n'}${i + 1}. ${techLines[i]}`);
    }
    w.tool(techBlock, '外部数据接入', 'end', '完成');
    w.blockEnd(techBlock);
    emit({
      type: 'opinion', dept: 'tech',
      opinion: {
        dept: 'tech',
        conclusion: e.tech.passed ? '同意' : '补充材料',
        summary: '数据核验通道与模型运行正常;命中异常标记已转人工复核。',
        keyPoints: e.tech.opinion,
        conditions: e.tech.dataFlags,
      },
    });
    w.stage('tech', 'end');

    // ---------------- 3. 风控部 ----------------
    w.stage('risk', 'start', '独立风险审查(不受业务条线干预)');
    const riskBlock = 'risk';
    w.blockStart(riskBlock, 'risk', 'risk', '风险审查官', '独立风险审查意见', e.risk.passed ? '同意' : e.risk.recommendation);
    w.tool(riskBlock, '财务分析', 'start', '关键财务指标阈值校验');
    if (e.risk.ratioChecks.length) {
      const lines = e.risk.ratioChecks.map((r) => `${r.label} **${r.value}**(阈值 ${r.threshold}) ${r.ok ? '✓' : '✗ 未达标'}`);
      await w.speak(riskBlock, `**指标校验:**\n- ${lines.join('\n- ')}`);
    }
    w.tool(riskBlock, '财务分析', 'end', '完成');
    w.tool(riskBlock, '还款测算', 'start', 'DSCR / 现金流覆盖测算');
    const riskLines = e.risk.riskPoints;
    for (let i = 0; i < riskLines.length; i++) {
      await w.speak(riskBlock, `\n\n${riskLines[i]}`);
    }
    w.tool(riskBlock, '还款测算', 'end', '完成');
    w.blockEnd(riskBlock);
    emit({
      type: 'opinion', dept: 'risk',
      opinion: {
        dept: 'risk',
        conclusion: e.risk.passed ? '同意' : e.risk.recommendation.startsWith('有条件') ? '有条件同意' : '否决',
        summary: e.risk.recommendation,
        keyPoints: e.risk.riskPoints,
        conditions: [],
      },
    });
    w.stage('risk', 'end');

    // ---------------- 4. 合规部 ----------------
    w.stage('compliance', 'start', '法律合规与反洗钱独立审查');
    const compBlock = 'comp';
    w.blockStart(compBlock, 'compliance', 'compliance', '合规官', '合规与法律审查意见', e.compliance.passed ? '通过' : '一票否决');
    w.tool(compBlock, 'AML/KYC 筛查', 'start', '制裁名单 / 受益所有人识别');
    const compLines = [...e.compliance.points, ...e.compliance.legalRisks];
    for (let i = 0; i < compLines.length; i++) {
      await w.speak(compBlock, `${i === 0 ? '' : '\n\n'}${i + 1}. ${compLines[i]}`);
    }
    if (!e.compliance.passed) {
      await w.speak(compBlock, `\n\n🚫 合规部行使**独立否决权**(其一票否决与风险否决并行、不受业务条线制约)。`);
    }
    w.tool(compBlock, 'AML/KYC 筛查', 'end', '完成');
    w.blockEnd(compBlock);
    emit({
      type: 'opinion', dept: 'compliance',
      opinion: {
        dept: 'compliance',
        conclusion: e.compliance.passed ? '同意' : '否决',
        summary: e.compliance.passed ? '未发现违法违规或监管禁止事项。' : '存在监管红线问题,合规否决。',
        keyPoints: e.compliance.legalRisks.length ? e.compliance.legalRisks : e.compliance.points,
        conditions: e.compliance.legalRisks,
        veto: !e.compliance.passed,
      },
    });
    w.stage('compliance', 'end');

    // ---------------- 5. 产品方案 ----------------
    if (req.mode === 'product_plan') {
      w.stage('product', 'start', '依据企业与行业知识匹配产品');
      await this.productCard(w, e.product);
      w.stage('product', 'end');
      emit({
        type: 'done',
        summary: `已依据企业/个人画像与监管制度给出产品方案(详见决策面板)。${e.product.conditions.length ? '含 ' + e.product.conditions.length + ' 条用信条件。' : ''}`,
      });
      return;
    }

    w.stage('product', 'start', '结合金融知识确定产品要素');
    await this.productCard(w, e.product);
    w.stage('product', 'end');

    // ---------------- 6. 有权审批 / 审贷会决策 ----------------
    w.stage('decision', 'start', `由 ${e.authority.level} 决策`);
    const verdict = deriveVerdict(e);
    const decBlock = 'decision';
    w.blockStart(decBlock, 'decision', 'risk', '有权审批人/审贷会', `终审决策(${e.authority.level})`, verdict);
    await w.speak(decBlock, `**综合四部门意见** ——\n\n业务受理 ✓ · 数据核验 ${e.tech.passed ? '✓' : '⚠️'} · 风控 ${e.risk.passed ? '✓' : '✗'} · 合规 ${e.compliance.passed ? '✓' : '✗'}\n\n**结论:${verdict}**\n\n- 授权层级:${e.authority.level}\n- 审批人:${e.authority.approver}\n- 授权依据:${e.authority.basis}`);
    if (e.product.conditions.length) {
      await w.speak(decBlock, `\n\n放款前须落实条件:\n- ${e.product.conditions.join('\n- ')}`);
    }
    w.blockEnd(decBlock);
    emit({
      type: 'decision',
      decision: {
        verdict,
        approvedAmountWan: verdict === '否决' ? 0 : e.product.amountWan,
        termMonths: e.product.termMonths,
        authorityLevel: e.authority.level,
        approver: e.authority.approver,
        basis: e.authority.basis,
        conditions: e.product.conditions,
        summary: `审批结论「${verdict}」:批准金额 ${verdict === '否决' ? 0 : e.product.amountWan} 万 / ${e.product.termMonths} 个月,由 ${e.authority.level} 决策。`,
      },
    });
    w.stage('decision', 'end');

    emit({
      type: 'done',
      summary:
        verdict === '否决'
          ? `审批全流程结束。**${verdict}**:因合规/风险红线,未予通过。职责边界已按第一/二/三防线与授权矩阵落实(见「职责与边界」页)。`
          : `审批全流程结束。**${verdict}**:批 ${e.product.amountWan} 万,产品「${e.product.productName}」,${e.product.conditions.length} 条放款条件。职责边界见「职责与边界」页。`,
    });
  }

  private async productCard(w: StreamWriter, p: ProductSolution): Promise<void> {
    const blockId = 'product';
    w.blockStart(blockId, 'product', 'business', '产品经理', '产品方案设计(知识驱动)', '建议方案');
    w.tool(blockId, '产品匹配', 'start', '依据授信政策匹配产品');
    await w.speak(blockId, `**推荐方案:** ${p.productName}\n\n金额 **${p.amountWan} 万** · 期限 **${p.termMonths} 个月** · 利率 **${p.rate}**\n\n- 还款方式:${p.repayment}\n- 担保安排:${p.security}\n- 支付方式:${p.channel}`);
    const rationale = p.rationale;
    for (let i = 0; i < rationale.length; i++) {
      await w.speak(blockId, `\n\n**方案理由 ${i + 1}:** ${rationale[i]}`);
    }
    if (p.conditions.length) {
      await w.speak(blockId, `\n\n**用信条件(放款前落实):**\n- ${p.conditions.join('\n- ')}`);
    }
    if (p.mitigants.length) {
      await w.speak(blockId, `\n\n**风险缓释:** ${p.mitigants.join(';')}`);
    }
    w.tool(blockId, '产品匹配', 'end', '完成');
    w.blockEnd(blockId);
    w.send({ type: 'product', product: p });
  }

  // ---------------- 问答模式 ----------------
  private async runQuestion(req: ChatRequest, c: ApprovalCase, w: StreamWriter): Promise<void> {
    const q = (req.question ?? '').trim();
    const context = `${c.title}\n${c.summary}\n${(c.financials ?? c.profile ?? []).map((f) => `${f.label}:${f.value}`).join('\n')}`;
    const low = `${q}\n${context}`.toLowerCase();
    const blockId = 'qa';
    w.blockStart(blockId, 'business', 'business', '知识助手', '知识问答', '回答');

    const answer = await answerQuestion(q, low, context);
    await w.speak(blockId, answer.answer, 8);
    if (answer.related.length) {
      await w.speak(blockId, `\n\n**相关职能/制度速览:**\n- ${answer.related.slice(0, 6).join('\n- ')}`);
    }
    if (answer.sources.length) {
      await w.speak(blockId, `\n\n_知识来源:${answer.sources.join('、')}_`);
    }
    w.blockEnd(blockId);
    w.send({ type: 'qa', q, a: answer.answer });
    w.send({ type: 'done', summary: '问答完成。' });
  }
}

// ---------- 简易规则问答 ----------
interface QAResult { answer: string; related: string[]; sources: string[] }

async function answerQuestion(q: string, low: string, context: string): Promise<QAResult> {
  const departments = DEPARTMENTS;
  const named = ['业务', '风控', '风险', '科技', '合规'].filter((n) => low.includes(n));
  if (low.includes('职责') || low.includes('职能') || low.includes('边界') || low.includes('谁负责') || low.includes('分工')) {
    const related = departments.map((d) => `**${d.short}**(${d.defense}):${d.approvalDuty}`);
    if (named.length === 1) {
      const d = departments.find((x) => x.short.includes(named[0]) || x.name.includes(named[0]));
      if (d) {
        return {
          answer: `**${d.name} 的职责与边界**\n\n定位:${d.position} · ${d.defense}\n\n核心职能:\n${d.functions.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\n权责:${d.authorities.join(';')}\n\n职责边界(不越位):\n${d.boundaries.map((b, i) => `${i + 1}. ${b}`).join('\n')}\n\n一句话:${d.approvalDuty}`,
          related, sources: [d.name],
        };
      }
    }
    return {
      answer: `四大部门遵循"三道防线"与"四眼原则",核心是**前台发起、中台风控、后台科技支撑、合规独立监督,审批决策权归风险条线牵头的有权审批人/审贷会**:\n\n${related.join('\n\n')}\n\n关键制衡:业务部不得自审自批;风控独立审查不受业务干预;合规拥有一票否决(与风险否决并行);科技只保障系统与数据,不决定贷与不贷。`,
      related, sources: ['部门职责模型'],
    };
  }
  const matched = KB.policies.filter((p) => {
    const kws = q.replace(/[，。？?、]/g, ' ').split(' ').filter((s) => s.length >= 2);
    return kws.some((s) => p.title.includes(s) || p.body.includes(s));
  });
  if (matched.length) {
    return {
      answer: matched.map((p) => `**【${p.title}】**\n${p.body}`).join('\n\n'),
      related: matched.map((p) => p.title),
      sources: matched.map((p) => p.title),
    };
  }
  return {
    answer: `我可以围绕**职责边界**(如"业务部与风控部如何分工")、**授信政策**(如"流动资金贷款额度怎么定")、**监管红线**(如"经营贷流入楼市")以及本案例风险点作答。请试试:「风控部的职责边界是什么?」「流动资金贷款受托支付有何要求?」「本案例最大的风险点在哪?」`,
    related: KB.departments.map((d) => `${d.short}:${d.approvalDuty}`),
    sources: ['内置银行知识库'],
  };
}
