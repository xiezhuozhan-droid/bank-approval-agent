// ============================================================================
// 领域类型与线协议：银行信贷审批 Agent
// 这些类型同时被后端 Mock / CodeBuddy Provider 与前端共同理解(前端以 .d.ts 镜像)
// ============================================================================

// ---------- 四大部门(职责边界核心对象) ----------
export type DeptId = 'business' | 'risk' | 'tech' | 'compliance';

export interface Department {
  id: DeptId;
  name: string;
  short: string;
  /** 前台 / 中台 / 后台 / 独立条线 */
  position: '前台' | '中台' | '后台';
  /** 一/二/三道防线 */
  defense: string;
  color: string;
  icon: string;
  mission: string;
  /** 核心职能 */
  functions: string[];
  /** 权责:有权做什么 */
  authorities: string[];
  /** 职责边界:不与其它部门重叠的界限 / 配合关系 */
  boundaries: string[];
  /** 审批/审查类权责 */
  approvalDuty: string;
}

// ---------- 审批案例 ----------
export type CaseKind = 'corporate' | 'retail';

export interface ApprovalCase {
  id: string;
  kind: CaseKind;
  title: string;
  summary: string;
  applicant: string;
  /** 授信申请:金额(万元)/期限(月)/用途/担保 */
  request: {
    amountWan: number;
    termMonths: number;
    purpose: string;
    security: string;
    line: string; // 授信品种
  };
  /** 财务状况(对公) */
  financials?: { label: string; value: string }[];
  /** 借款人画像(零售) */
  profile?: { label: string; value: string }[];
  /** 可疑信号(触发深审) */
  redFlags: { level: 'high' | 'medium' | 'low'; text: string }[];
  note?: string;
}

// ---------- 授信评审的部门意见 ----------
export interface DeptOpinion {
  dept: DeptId;
  /** 结论 */
  conclusion: '同意' | '有条件同意' | '否决' | '补充材料' | '不适用';
  summary: string;
  keyPoints: string[];
  conditions: string[];
  veto?: boolean;
}

// ---------- 产品方案 ----------
export interface ProductSolution {
  productName: string;
  productKind: '流动资金贷款' | '项目融资' | '住房按揭' | '个人经营贷' | '消费贷' | '票据/供应链' | '其他';
  amountWan: number;
  termMonths: number;
  /** LPR 加点表示,例如 "3.85% + 85BP" */
  rate: string;
  repayment: string;
  security: string;
  channel: string; // 放款/支付方式
  /** 匹配理由(结合金融知识与企业/个人情况) */
  rationale: string[];
  conditions: string[]; // 用信条件
  mitigants: string[]; // 风险缓释
}

// ---------- 审批决策 ----------
export type DecisionVerdict = '通过' | '有条件通过' | '否决' | '需人工复核';

export interface ApprovalDecision {
  verdict: DecisionVerdict;
  /** 金额(万元) */
  approvedAmountWan: number;
  termMonths: number;
  /** 授权层级,如 分行审贷会 */
  authorityLevel: string;
  approver: string;
  /** 依据的分级授权条款 */
  basis: string;
  conditions: string[];
  summary: string;
}

// ============================================================================
// 线协议:POST /api/chat 返回 NDJSON 流
// ============================================================================
export type StageId =
  | 'business' // 业务受理/尽调
  | 'tech'     // 科技核验
  | 'risk'     // 风险审查
  | 'compliance' // 合规审查
  | 'decision' // 有权审批人/审贷会决策
  | 'product'; // 产品方案
export type StageStatus = 'start' | 'end' | 'error';

export type ServerEvent =
  | { type: 'meta'; runId: string; kind: CaseKind }
  | { type: 'stage'; stage: StageId; status: StageStatus; title: string; note?: string }
  | { type: 'agent_block'; blockId: string; stage: StageId; dept: DeptId; role: string; title: string; verdict?: string }
  | { type: 'tool'; blockId: string; tool: string; status: 'start' | 'end' | 'error'; title: string; detail?: string }
  | { type: 'delta'; blockId: string; text: string }
  | { type: 'block_end'; blockId: string }
  | { type: 'opinion'; dept: DeptId; opinion: DeptOpinion }
  | { type: 'product'; product: ProductSolution }
  | { type: 'decision'; decision: ApprovalDecision }
  | { type: 'qa'; q: string; a: string }
  | { type: 'done'; summary: string }
  | { type: 'error'; message: string };

// ---------- 请求 ----------
export interface ChatRequest {
  caseId: string;
  mode: 'full_review' | 'question' | 'product_plan';
  question?: string;
  presetPrompt?: string;
  provider?: ProviderName;
  context?: string[];
}

export type ProviderName = 'mock' | 'codebuddy';

// 工具调用结构化描述(供前端渲染"Agent 正在做什么")
export interface ToolEvent {
  tool: string;
  title: string;
}
