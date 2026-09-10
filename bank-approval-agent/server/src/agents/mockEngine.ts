import { FINANCIAL_RULES, PRODUCT_MATCHING, INDUSTRY_NOTES, deptMap } from '../kb/index.js';
import type { ApprovalCase, ProductSolution, DeptId } from '../domain/types.js';
import { caseById } from '../kb/cases.js';

// ============================================================================
// Mock 规则引擎:把"银行金融知识"固化为可解释的判断逻辑。
// 每个部门给出结构化结论,便于前端 pipeline 呈现;结论文本是流式"打出来的"。
// ============================================================================

export interface EngineResult {
  business: { opinion: string[]; needDeepCheck: string[]; decision: '受理' | '需补充' };
  tech: { opinion: string[]; dataFlags: string[]; passed: boolean };
  risk: {
    passed: boolean;
    ratioChecks: { label: string; value: string; threshold: string; ok: boolean }[];
    riskPoints: string[];
    recommendation: string;
  };
  compliance: { passed: boolean; points: string[]; legalRisks: string[] };
  product: ProductSolution;
  authority: { level: string; approver: string; basis: string };
  redFlagAnalysis: { level: 'high' | 'medium' | 'low'; text: string; by: DeptId }[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function getCase(id: string): ApprovalCase | undefined {
  return caseById(id);
}

// ---------- 通用:从自由文本里抽取行业 ----------
function detectIndustry(freeText: string): string | undefined {
  const names = Object.keys(INDUSTRY_NOTES);
  return names.find((n) => freeText.includes(n));
}

export async function buildEngineResult(c: ApprovalCase): Promise<EngineResult> {
  // 模拟各环节耗时,让前端 streaming 更真实
  await sleep(60);

  const deptName = (id: DeptId) => deptMap[id]?.short ?? id;
  const industry = detectIndustry(`${c.title}${c.summary}${c.applicant}`);

  // ---------- 1. 业务部:受理与尽调 ----------
  const business: EngineResult['business'] = {
    opinion: [
      `客户经理已面谈/实地走访,核实营业执照、实际控制人及经营场所,主体真实性通过(${deptName('business')}尽调第一责任)。`,
      `资料清单:证件、财报、流水、纳税证明、征信授权、权证原件核对齐全。`,
    ],
    needDeepCheck: [],
    decision: '受理',
  };
  if (c.redFlags.some((f) => f.level === 'high')) {
    business.needDeepCheck.push('存在高危信号,已标注"加强尽调"并同步风控/合规重点关注。');
  }
  if (industry) business.opinion.push(`行业属性识别:${industry}(${INDUSTRY_NOTES[industry]})`);

  // ---------- 2. 科技部:数据核验与系统支撑 ----------
  const tech: EngineResult['tech'] = {
    opinion: [],
    dataFlags: [],
    passed: true,
  };
  const ext = c.kind === 'corporate' ? '工商/司法/税务/征信/不动产登记' : '征信/公积金/不动产登记/个税';
  tech.opinion.push(
    `已调用行内数据中台与外部数据源(${ext})完成交叉核验,接口状态正常,日志留痕满足审计。`,
  );
  if (c.redFlags.some((f) => f.level === 'high')) {
    tech.dataFlags.push('外部数据命中异常标记(建议人工复核名单/司法/关联关系)。');
    tech.passed = false; // 交由人工复核,但不直接否决
  } else {
    tech.opinion.push('数据核验通过,评分卡/反欺诈模型未见显著异常。');
  }
  tech.opinion.push(`(科技部仅保障核验通道与模型可用性,授信结论由业务/风控/合规条线作出——技术不替代业务判断。)`);

  // ---------- 3. 风控部:独立审查 ----------
  const F = FINANCIAL_RULES;
  const ratioChecks: EngineResult['risk']['ratioChecks'] = [];
  let riskPassed = true;
  const riskPoints: string[] = [];
  let recommendation = '同意';

  const riskContext = c.kind === 'corporate' ? `${c.summary} ${(c.financials ?? []).map((f) => `${f.label}:${f.value}`).join(';')}` : `${c.summary} ${(c.profile ?? []).map((p) => `${p.label}:${p.value}`).join(';')}`;

  if (c.kind === 'corporate') {
    const parse = (label: string, re: RegExp) => {
      const hit = (c.financials ?? []).find((f) => f.label.includes(label))?.value ?? '';
      const m = hit.match(re);
      return m ? parseFloat(m[1]) : undefined;
    };
    const debtRatio = parse('资产负债率', /([\d.]+)%/);
    const current = parse('流动比率', /^([\d.]+)/);
    if (debtRatio !== undefined) {
      const ok = debtRatio <= F.corporate.debtRatioMax * 100;
      ratioChecks.push({ label: '资产负债率', value: `${debtRatio}%`, threshold: `≤${F.corporate.debtRatioMax * 100}%`, ok });
      if (!ok) riskPoints.push('资产负债率高于参考线,关注资本结构与再融资能力。');
    }
    if (current !== undefined) {
      const ok = current >= F.corporate.currentRatioMin;
      ratioChecks.push({ label: '流动比率', value: `${current}`, threshold: `≥${F.corporate.currentRatioMin}`, ok });
      if (!ok) riskPoints.push('短期偿债指标偏弱,需核验营运资金缺口测算。');
    }
    // 对公二:现金流不足(硬伤,通过文本模式识别)
    if (riskContext.includes('DSCR') && /0\.8|1\.1|偏弱/.test(riskContext)) {
      riskPassed = false;
      riskPoints.push('项目自身经营性现金流前 5 年无法覆盖本息(DSCR<1.2),依赖土地出让回款,偿债来源不稳健。');
    }
    if (riskContext.includes('资本金')) {
      riskPoints.push('资本金穿透核查:股东借款/土地预收益计入资本金不符合真实性要求,须自有资金实缴到位后方可申报。');
    }
    if (/集中度|集团客户|关联/.test(riskContext)) riskPoints.push('集团/关联客户:提示核查统一授信与风险暴露合并计算。');
    if (riskPoints.length === 0) riskPoints.push('财务结构合理,现金流覆盖良好,授信支持度较高。');
    if (!riskPassed) recommendation = '否决';
  } else {
    // ---------- 零售 ----------
    if (c.id.includes('mortgage')) {
      const profile = c.profile ?? [];
      const income = profile.find((p) => p.label.includes('家庭月收入'))?.value;
      ratioChecks.push({ label: '月供收入比(家庭口径)', value: '≈22%', threshold: `≤${F.retail.mortgage.dtiMax * 100}%`, ok: true });
      ratioChecks.push({ label: '抵押率(首套)', value: '70%', threshold: `≤${F.retail.mortgage.ltvMaxFirst * 100}%`, ok: true });
      ratioChecks.push({ label: '收入可验证性', value: '工资+个税+公积金', threshold: '三方交叉验证', ok: true });
      if (income) riskPoints.push(`借款人及家庭收入${income},覆盖能力强;职业稳定性良好。`);
      if (c.redFlags.some((f) => f.level === 'medium' || f.level === 'high')) {
        riskPoints.push('需关注行业波动对收入持续性的影响,已纳入贷后监测。');
      }
      riskPoints.push('首付来源清晰(自有资金),无首付贷迹象。');
      recommendation = '同意';
    } else if (c.id.includes('biz')) {
      // 经营贷:用途存疑案例
      ratioChecks.push({ label: '合理装修资金需求', value: '约 50–70 万', threshold: '申请额 150 万明显超额', ok: false });
      ratioChecks.push({ label: '资金用途真实性', value: '装修合同无施工/付款佐证', threshold: '需受托支付+实地核验', ok: false });
      riskPassed = false;
      riskPoints.push('申请额度远超门店翻新合理需求,近 3 个月新购住房+密集征信查询,存在套取经营贷流入楼市嫌疑(监管红线)。');
      riskPoints.push('建议:降额至与实际装修需求匹配并逐笔受托支付,待施工合同、发票、现场照片核验后再放款。');
      recommendation = '有条件同意(降额+受托支付)';
    } else {
      riskPoints.push('消费贷:核实还款来源与资金用途禁止项(购房/投资),金额在限额内。');
      recommendation = '同意';
    }
    if (!riskPassed && !recommendation.startsWith('有条件')) recommendation = '有条件同意';
  }

  // 高红旗 => 上收
  const hasHigh = c.redFlags.some((f) => f.level === 'high');
  const authority =
    c.kind === 'corporate'
      ? hasHigh
        ? { level: '总行/一级分行审贷会(超授权上收)', approver: '审贷会主任委员', basis: '差异化授权办法:集团/平台/超 1 亿及高风险客户上收总行审贷会' }
        : { level: '一级分行审贷会', approver: '分行行长授权专职审批人', basis: '单户授信>3,000 万,须经分行审贷会会签' }
      : hasHigh
        ? { level: '二级分行信贷审批部(人工复核)', approver: '专职审批人', basis: '零售人工审批规则:命中高风险名单/用途疑点须人工复核' }
        : { level: '自动化审批(低风险快批)', approver: '系统规则+人工抽查', basis: '零售标准化审批授权:评分达标且无预警自动通过' };

  // ---------- 4. 合规部 ----------
  const compliance: EngineResult['compliance'] = { passed: true, points: [], legalRisks: [] };
  const isPlatform = /城投|平台|政府融资/.test(riskContext);
  const amlSuspicious = c.redFlags.some((f) => f.level === 'high' && /购房|隐性债务|关联/.test(f.text));
  compliance.points.push('KYC 与受益所有人识别完成;签署个保/征信授权书,要素合规。');
  if (isPlatform) {
    compliance.legalRisks.push('城投平台客户:严禁新增政府隐性债务,资本金不得以土地预收益/股东借款虚增,须出具不新增隐债承诺并核验名单。');
    compliance.passed = false; // 一票否决
  }
  if (amlSuspicious) {
    compliance.legalRisks.push('反洗钱可疑特征(资金用途异常+新增大额负债):触发强化尽调,未消除前不得用信。');
  }
  if (c.kind === 'retail' && c.id.includes('biz')) {
    compliance.legalRisks.push('经营贷资金流向房地产属监管明令禁止,须落实受托支付与贷后资金监控条款。');
    compliance.passed = false;
  }
  if (compliance.legalRisks.length === 0) compliance.points.push('未发现违法违规或监管禁止事项,合同文本审查通过。');

  // ---------- 5. 产品方案(知识驱动的产品匹配) ----------
  const product = buildProduct(c, riskPassed, recommendation, authority.level);

  // 红旗归属
  const redFlagAnalysis: EngineResult['redFlagAnalysis'] = c.redFlags.map((f) => {
    const by: DeptId = /购房|隐性债务|关联/.test(f.text) ? 'compliance' : /现金流|资本金|集中|用途|负债/.test(f.text) ? 'risk' : f.level === 'high' ? 'compliance' : 'risk';
    return { ...f, by };
  });

  return {
    business, tech, risk: { passed: riskPassed, ratioChecks, riskPoints, recommendation },
    compliance, product, authority, redFlagAnalysis,
  };
}

// ---------- 产品方案生成 ----------
function buildProduct(c: ApprovalCase, riskPassed: boolean, recommendation: string, authority: string): ProductSolution {
  const base = {
    conditions: [] as string[],
    mitigants: [] as string[],
    rationale: [] as string[],
  };
  if (c.kind === 'corporate') {
    if (c.request.line.includes('流动')) {
      const gap = '参考营运资金缺口法:营运资金量≈3.6亿×0.62≈2.2亿,现有流动资金(含他行+本行)约1.6亿 → 新增缺口约 5,000–6,000 万,本次 2,000 万低于缺口上限,额度合理';
      base.rationale = [
        gap,
        PRODUCT_MATCHING.floating.fit,
        '用途为原材料采购,属真实贸易背景,受托支付比例与监管要求匹配。',
        '利率锚定 1Y LPR(3.0%)+风险加点:考虑客户评级 A/押品二押/综合贡献,建议 3.45%–3.85%(示意,以 FTP 测算为准)。',
      ];
      base.conditions = [
        '放款前提:落实厂房二押登记(或追加一押行同意函),抵押率≤70%',
        '受托支付:单笔超 500 万或超授信 30% 的交易须受托支付至交易对手',
        '实控人夫妇连带保证签署并核保',
        '贷后:按季度核查纳税与回款,监控主机厂年降影响',
      ];
      base.mitigants = ['核心车企供应商地位+应收可转让形成贸易链闭环', '现金流持续为正,利息保障倍数高', '追加保证强化第二还款来源'];
      return {
        productName: '流动资金贷款(循环额度)',
        productKind: '流动资金贷款',
        amountWan: riskPassed ? 2000 : 0,
        termMonths: 12,
        rate: '3.45%–3.85%(LPR+45~85BP,示意)',
        repayment: '按季付息,到期还本(可随借随还)',
        security: '厂房二押 + 实控人连带保证',
        channel: '受托支付为主,自主支付限额内',
        rationale: base.rationale, conditions: base.conditions, mitigants: base.mitigants,
      };
    }
    // 项目贷款(否决案例)
    base.rationale = [
      PRODUCT_MATCHING.project.fit,
      '本次方案因资本金不实+现金流不足不具备放款条件,方案判定为"不予立项"。',
    ];
    base.conditions = [
      '如后续补充:资本金以自有资金实缴(≥25%,不含土地预收益)',
      '提供 DSCR≥1.3 的可行运营预测与第三方运营方协议',
      '剥离政府隐性债务名单关联,出具不新增隐债承诺',
    ];
    base.mitigants = [];
    return {
      productName: '固定资产(项目)贷款 —— 暂缓/否决',
      productKind: '项目融资',
      amountWan: 0,
      termMonths: 96,
      rate: '—',
      repayment: '—',
      security: '—',
      channel: '—',
      rationale: base.rationale, conditions: base.conditions, mitigants: base.mitigants,
    };
  }
  // ---------- 零售 ----------
  if (c.id.includes('mortgage')) {
    base.rationale = [
      PRODUCT_MATCHING.mortgage.fit,
      '首付比例 30% 达标,抵押率 70% 与首套上限一致,月供收入比 22% 远低于 50% 红线。',
      '定价锚定 5Y LPR(3.85%)+政策加点,首套可享利率优惠(示意 3.3%),存量定价随 LPR 重定价。',
    ];
    base.conditions = [
      '放款前提:所购房产过户并办妥抵押登记(他项权证),放款至卖方监管账户',
      '首付款流水凭证与资金来源审查留存',
      '收入三方(工资+个税+公积金)核验通过',
    ];
    base.mitigants = ['首套自住+家庭收入覆盖强', '房龄新、地段优,抵押物处置流动性好'];
    return {
      productName: '个人住房按揭贷款(首套)',
      productKind: '住房按揭',
      amountWan: 280,
      termMonths: 360,
      rate: '3.3%(5Y LPR 减点,示意)',
      repayment: '等额本息 30 年',
      security: '所购房产抵押(70%)',
      channel: '资金监管账户直付卖方',
      rationale: base.rationale, conditions: base.conditions, mitigants: base.mitigants,
    };
  }
  // 经营贷
  base.rationale = [
    PRODUCT_MATCHING['biz-loan'].fit,
    '本次用途真实性存疑,故按"有条件授信"设计:额度压降至合理装修需求,并全流程受托支付+资金监控。',
  ];
  base.conditions = [
    '授信压降至 60 万以内(与实际装修/翻新合同匹配)',
    '逐笔受托支付至装修施工方/设备供应商,留存发票与验收单',
    '放款前完成门店实地核验与施工合同真实性核查',
    '贷后按季度监控经营流水,防止资金回流挪用',
  ];
  base.mitigants = [];
  return {
    productName: '个人经营性贷款(有条件/降额方案)',
    productKind: '个人经营贷',
    amountWan: 60,
    termMonths: 36,
    rate: '4.0%(1Y LPR+100BP,示意)',
    repayment: '按月等额/先息后本分期',
    security: '设备抵押+第三方保证',
    channel: '受托支付(装修/设备供应商)',
    rationale: base.rationale, conditions: base.conditions, mitigants: base.mitigants,
  };
}

// 完整最终结论:由各环节投票
export function deriveVerdict(e: EngineResult): '通过' | '有条件通过' | '否决' | '需人工复核' {
  if (!e.compliance.passed) return '否决';
  if (!e.risk.passed) {
    return e.risk.recommendation.startsWith('有条件') ? '有条件通过' : '否决';
  }
  if (e.redFlagAnalysis.some((f) => f.level === 'high')) return '需人工复核';
  return '通过';
}
