# 🏦 银行信贷审批智能 Agent

基于 **CodeBuddy Agent SDK** 的客户端 Agent Web 应用,实现:
1. **银行对公/零售业务的授信审批功能**(四部门协同全链路);
2. **结合银行金融知识确定产品方案**(授信政策 + 财务阈值 → 产品匹配);
3. **明确业务/风控/科技/合规四部门职能与职责边界**(三道防线 + RACI + 分级授权)。

架构上:**一个代码库,三种运行形态** —— 浏览器开发、浏览器生产访问、Electron 桌面封装,全部共用同一前端 + 同一 Agent 后端。

---

## 一、功能总览

| 能力 | 说明 |
|------|------|
| 四部门协同审批 | 业务部(真实性)→ 金融科技部(数据核验)→ 风控部(独立审查)→ 合规部(反洗钱/合规),事件流式输出,前端可见"部门流水线 + 打字机 + 工具调用" |
| 知识驱动的产品方案 | 依据案例画像 + 监管制度(流动资金贷款管理办法、抵押率、DSCR、月供收入比、经营贷用途红线…)自动匹配授信品种/金额/期限/利率/担保/支付方式,并给出"方案理由 + 用信条件 + 风险缓释" |
| 四部门职责边界 | 「职责与边界」页:四部门职能矩阵、RACI 职责矩阵、差异化分级授权、流程主责表;支持自然语言问答(如"风控部的职责边界是什么?") |
| 审批决策 | 有权审批人/审贷会按分级授权给出 通过 / 有条件通过 / 否决 / 需人工复核,并列明放款条件 |
| 双 Agent 引擎 | **Mock 规则引擎**(内置银行知识库,离线可用,开箱即演示)+ **CodeBuddy Agent**(真实大模型扮演四部门协同),可在设置中一键切换,CodeBuddy 失败自动回退 |
| 预置案例 | 4 个覆盖不同结论路径的案例:制造业流贷(通过)· 城投平台项目贷(否决/隐债红线)· 首套按揭(通过)· 个体工商户经营贷(用途存疑/有条件) |

### 两种引擎怎么选

| | Mock 规则引擎 | CodeBuddy Agent |
|---|---|---|
| 运行前提 | 无 | 已登录 CodeBuddy CLI,或配置 `CODEBUDDY_API_KEY` |
| 输出 | 规则引擎确定性结论 | 大模型多 Agent 协同(可解释、更接近真实语义) |
| 定位 | 开发 / 演示 / 测试 | 真实生产化接入 |

> 关于 **`codebuddy-chat-web` skill**:调研了 npm / GitHub / CodeBuddy 官方插件市场与官方 demo 仓库,并无此 skill。CodeBuddy 官方生态提供的是 **Agent SDK** + 内置 **Web UI**(`codebuddy --serve`);官方 SDK 示例 `chat-demo`(React+WS)与 `spreadsheet-assistant`(Electron IPC)即是"chat web + electron"的范式。本应用据此以 **SDK + Web + Electron** 三条路径实现等价能力。

---

## 二、架构

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  前端 client (React+Vite)   │        │  后端 server (Express+TS)     │
│  审批工作台/知识库/职责页    │  HTTP  │  ┌────────────────────────┐  │
│                             │◄──────►│  │ Provider 注册表         │  │
│  · fetch /api/*            │ NDJSON │  │  ├─ MockProvider        │  │
│  · 四部门流水线状态机        │  流    │  │  │   ·规则引擎+知识库    │  │
│  · 打字机卡片 / 决策看板     │        │  │  └─ CodeBuddyProvider  │  │
└─────────────────────────────┘        │      ·@tencent-ai/agent-sdk│  │
                                       │      ·系统提示注入职责边界  │  │
┌─────────────────────────────┐        │  ┌────────────────────────┐  │
│ Electron 主进程             │  spawn │  │ 银行金融知识库 KB       │  │
│ · 内嵌后端子进程(node)      │ ──────►│  · 部门职责(三道防线)     │  │
│ · 加载 dev URL 或 http 静态 │        │  · 监管制度/产品政策      │  │
└─────────────────────────────┘        │  · 分级授权 / RACI       │  │
                                       └──────────────────────────┘  │
                                       └──────────────────────────────┘
```

- **前端**:React + Tailwind,`client/src`。
- **后端**:Express,流式协议为 **SSE 风格 NDJSON**(`data: {...}\n\n`),前端 `ReadableStream` 逐行解析。
- **领域层**:`server/src/domain/types.ts` 定义线协议与领域对象;`server/src/kb/` 银行知识库;`server/src/agents/mockEngine.ts` 规则引擎;`server/src/providers/` Provider 抽象。
- **Electron**:`electron/src/main.js` 主进程 **fork 后端为子进程**(复用 `ELECTRON_RUN_AS_NODE`),健康检查后加载页面。

### 数据流
`POST /api/chat {caseId, mode, provider}` → Provider 编排 → 事件流:
`meta` → `stage`(部门阶段 start/end)→ `agent_block`(卡片开)→ `tool`(工具调用)→ `delta`(流式文字)→ `opinion/product/decision`(结构化结论)→ `done`。

---

## 三、快速开始

要求:Node.js ≥ 18.20。

```bash
cd bank-approval-agent
npm install                 # 安装全部 workspace 依赖(server / client / electron)
```

### 方式 A:浏览器开发(推荐)

```bash
npm run dev:web             # 同时起后端(:8787)与 Vite(:5173,/api 已代理)
# 打开 http://127.0.0.1:5173
```

前端改动即时热更新;后端改动由 `tsx watch` 自动重载。**全程无需 Electron,纯浏览器即可开发与演示。**

### 方式 B:浏览器访问"生产构建"

```bash
npm run build               # 编译 client(dist)+ server(dist)
npm run start               # 后端(:8787)直接托管构建产物
# 打开 http://127.0.0.1:8787
```

### 方式 C:Electron 桌面封装

```bash
# 1) 开发模式(桌面壳 + Vite 热更新)
npm run build -w server     # 首次:先生成 server/dist
BAA_DEV_URL=http://127.0.0.1:5173 npm run dev

# 2) 生产模式(加载内嵌后端托管产物)
npm run build
npm run dev -w electron     # electron 启动,内嵌后端自动起(:8791)

# 3) 打包分发(需要时)
npm run dist -w electron    # electron-builder → AppImage/deb/nsis/dmg
```

> Electron 首次安装二进制较慢;国内网络可设镜像:
> `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install -w electron`

---

## 四、接入真实 CodeBuddy(可选)

Mock 模式开箱即用;要切换真实 CodeBuddy Agent:

1. **方式一 · 复用 CLI 登录态(推荐)**
   ```bash
   npm i -g @tencent-ai/codebuddy-code
   codebuddy            # 完成登录
   ```
2. **方式二 · API Key**
   ```bash
   export CODEBUDDY_API_KEY=xxx
   export CODEBUDDY_INTERNET_ENVIRONMENT=internal   # 中国版;海外不设/或 external;iOA=ioa;专享=cloudhosted;私有=selfhosted
   ```
3. 打开应用 → **设置** → 选择 **CodeBuddy Agent**,必要时粘贴 Key 并选择环境 → 保存。

> 说明:SDK 进程会按 SDK 自身通道与 CodeBuddy 通信;本机若无可达的 CodeBuddy 服务,会按设置自动回退 Mock 并在消息流中提示,演示不断流。Agent 的系统提示已注入四部门职责、分级授权与金融知识库(见 `server/src/providers/codebuddyProvider.ts` 的 `buildSystemPrompt`)。

---

## 五、银行领域要点(职责边界是如何落到代码的)

| 概念 | 位置 |
|------|------|
| 三道防线 / 四部门职能与**不越位边界** | `server/src/kb/departments.ts` |
| 授信政策制度库(对公/零售/通用) | `server/src/kb/policies.ts` |
| 财务/还款阈值(资产负债率、DSCR、月供收入比、抵押率…) | `server/src/kb/policies.ts` 的 `FINANCIAL_RULES` |
| 案例库(含风险信号) | `server/src/kb/cases.ts` |
| 四部门协同编排(确定性脚本) | `server/src/providers/mockProvider.ts` |
| 规则引擎(风控指标校验、合规红线、产品匹配) | `server/src/agents/mockEngine.ts` |
| 前端流水线状态机 / 决策看板 | `client/src/lib/useApprovalEngine.ts`、`components/*` |

**审批制衡原则(应用内模型):**
- **前台发起,中台审查,后台支撑,合规独立监督,审批权归有权人/审贷会。**
- 业务部不得自审自批(第一道防线负真实性责任);
- 风控部独立审查不受业务干预(第二道防线,可否决);
- 科技部只保障系统与数据,不决定贷与不贷;
- 合规部对触碰监管红线(涉隐债、经营贷入楼市、反洗钱可疑等)行使**独立一票否决**(第三道防线)。

---

## 六、目录结构

```
bank-approval-agent/
├─ client/                前端 React + Vite + Tailwind
│  └─ src/
│     ├─ pages/           Workbench(工作台)/ Knowledge(知识库)/ Boundaries(职责边界)
│     ├─ components/      Pipeline/ MessageThread/ DecisionPanel/ Sidebar/ SettingsModal…
│     └─ lib/             api(流式客户端)/ useApprovalEngine(状态机)/ types(镜像线协议)
├─ server/                后端 Express + TypeScript
│  └─ src/
│     ├─ domain/          types.ts 线协议与领域类型
│     ├─ kb/              银行金融知识库(部门/制度/案例)
│     ├─ agents/          mockEngine.ts 规则引擎
│     ├─ providers/       MockProvider / CodeBuddyProvider / registry
│     └─ app.ts index.ts  Express 装配与入口
└─ electron/              桌面封装(main.js)+ electron-builder 配置
```

---

## 七、常见问题

- **浏览器打开后提示"后端服务未连接"**:确认后端已启动(`npm run dev:web` 或 `npm run start`);若用 Vite,`/api` 已代理到 `:8787`。
- **CodeBuddy 切换后报"未安装 SDK / 未配置 Key"**:按第四节配置登录或 Key;或回到 Mock。
- **想加案例**:在 `server/src/kb/cases.ts` 的 `CASES` 数组追加一条(对公填 `financials`,零售填 `profile`,可配 `redFlags`),前端会自动出现在案例库。
- **规则阈值/知识想调**:编辑 `server/src/kb/policies.ts` 后保存,后端热重载即生效。
- **Linux 无显示器跑 Electron**:`xvfb-run electron .` 或设 `DISPLAY=:99`。

---

## 八、roadmap(可扩展)

- 用 CodeBuddy 多 **sub-agent**(`agents:` 配置)替代单一 query 内的角色扮演,真正"四个 Agent 各跑一段";
- 接入 MCP(征信/工商/司法查询工具)让 Agent 自行取数;
- 审批留痕与工单状态持久化(SQLite)、多人会签 UI;
- 大模型输出结构化 JSON 的 schema 校验与重试(降低解析失败率)。

> 免责:本应用为**银行业务演示 / 概念验证**,审批结论与授权层级均为示意,不构成真实信贷决策依据。
