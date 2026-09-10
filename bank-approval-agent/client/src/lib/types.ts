// 与 server/src/domain/types.ts 保持一致的线协议类型(前端镜像)
// 改动时两端同步。

export type DeptId = 'business' | 'risk' | 'tech' | 'compliance';

export interface Department {
  id: DeptId;
  name: string;
  short: string;
  position: '前台' | '中台' | '后台';
  defense: string;
  color: string;
  icon: string;
  mission: string;
  functions: string[];
  authorities: string[];
  boundaries: string[];
  approvalDuty: string;
}

export type CaseKind = 'corporate' | 'retail';

export interface ApprovalCase {
  id: string;
  kind: CaseKind;
  title: string;
  summary: string;
  applicant: string;
  request: {
    amountWan: number;
    termMonths: number;
    purpose: string;
    security: string;
    line: string;
  };
  financials?: { label: string; value: string }[];
  profile?: { label: string; value: string }[];
  redFlags: { level: 'high' | 'medium' | 'low'; text: string }[];
  note?: string;
}

export interface DeptOpinion {
  dept: DeptId;
  conclusion: '同意' | '有条件同意' | '否决' | '补充材料' | '不适用';
  summary: string;
  keyPoints: string[];
  conditions: string[];
  veto?: boolean;
}

export interface ProductSolution {
  productName: string;
  amountWan: number;
  termMonths: number;
  rate: string;
  repayment: string;
  security: string;
  channel: string;
  rationale: string[];
  conditions: string[];
  mitigants: string[];
}

export type DecisionVerdict = '通过' | '有条件通过' | '否决' | '需人工复核';

export interface ApprovalDecision {
  verdict: DecisionVerdict;
  approvedAmountWan: number;
  termMonths: number;
  authorityLevel: string;
  approver: string;
  basis: string;
  conditions: string[];
  summary: string;
}

export type StageId =
  | 'business' | 'tech' | 'risk' | 'compliance' | 'decision' | 'product';
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

export type Mode = 'full_review' | 'question' | 'product_plan';
export type ProviderName = 'mock' | 'codebuddy';

export interface BootstrapData {
  cases: ApprovalCase[];
  departments: Department[];
  pipelineOwnership: { stage: string; owner: string; supporter: string }[];
  authorityLadder: { range: string; level: string; owner: string }[];
  policies: {
    id: string; category: string; title: string; body: string; scope: string;
  }[];
  providers: { name: ProviderName; label: string }[];
  config: {
    provider: ProviderName;
    codebuddyEnvironment: string;
    autoFallback: boolean;
    hasApiKey: boolean;
  };
}
