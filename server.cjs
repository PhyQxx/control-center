const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const GATEWAY_TOKEN = '841f529e7dcf20d7528b40fb159226dc86ace43f45603ce6';
const GATEWAY_URL = 'http://host.docker.internal:18789';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

const AGENT_WORKSPACES = {
  pd:      '/root/.openclaw/workspace-pd',
  pm:      '/root/.openclaw/workspace-pm',
  dev:     '/root/.openclaw/workspace-dev',
  'dev-dq': '/root/.openclaw/workspace-dev-dq',
  des:     '/root/.openclaw/workspace-des',
  qa:      '/root/.openclaw/workspace-qa',
  ops:     '/root/.openclaw/workspace-ops',
  xiaoai:  '/root/.openclaw/workspace-xiaoai',
};

const AGENT_META = {
  pd:      { emoji: '👔', color: '#DB61A2' },
  pm:      { emoji: '📋', color: '#1F6FEB' },
  dev:     { emoji: '💻', color: '#8957E5' },
  'dev-dq': { emoji: '🛠', color: '#DA3633' },
  des:     { emoji: '🎨', color: '#2EA043' },
  qa:      { emoji: '🧪', color: '#238636' },
  ops:     { emoji: '🔧', color: '#D29922' },
  xiaoai:  { emoji: '🤵', color: '#FFA657' },
};

// ─── Execution Chains Store (Phase 2) ───────────────────────────────────────
let chains = [];
let chainCounter = 1;

// ─── Sessions Send Helper (Phase 2) ───────────────────────────────────────
async function sessions_send(agentId, message, timeout = 300) {
  try {
    const res = await fetch(`${GATEWAY_URL}/tools/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GATEWAY_TOKEN}` },
      body: JSON.stringify({
        tool: 'sessions_send',
        action: 'json',
        args: { agentId, message, timeout }
      })
    });
    const data = await res.json();
    return data;
  } catch (e) {
    console.error('sessions_send error:', e.message);
    return { error: e.message };
  }
}

// ─── Result Parser (Phase 2) ───────────────────────────────────────────────
function parseExecutionResult(content) {
  // Pattern: 【执行结果】任务ID: HT-xxx | 状态: success/failed | 结果摘要: ...
  const pattern = /【执行结果】任务ID:\s*(HT-\d+)\s*\|\s*状态:\s*(success|failed)\s*\|\s*结果摘要:\s*(.+?)(?:\s*\|\s*详情:\s*(.+))?$/i;
  const match = content.match(pattern);
  if (match) {
    return {
      taskId: match[1],
      status: match[2] === 'success' ? 'completed' : 'failed',
      summary: match[3],
      detail: match[4] || '',
    };
  }
  return null;
}

// ─── In-memory alert store (v1.2)
let alerts = [
  { id: 'a1', agentId: 'dev', type: 'context_pressure', level: 'critical', message: 'Context Pressure 超过 90%', value: 92, threshold: 85, status: 'active', createdAt: new Date(Date.now() - 120000).toISOString() },
  { id: 'a2', agentId: 'qa',  type: 'context_pressure', level: 'warning',  message: 'Context Pressure 超过 80%', value: 84, threshold: 85, status: 'active', createdAt: new Date(Date.now() - 300000).toISOString() },
  { id: 'a3', agentId: 'pm',  type: 'agent_error',     level: 'warning',  message: 'Agent 异常退出',              value: 1,  threshold: null, status: 'resolved', createdAt: new Date(Date.now() - 600000).toISOString(), resolvedAt: new Date(Date.now() - 300000).toISOString() },
];

// In-memory team members store (v1.2+)
let teamMembers = [
  { agentId: 'pd',       name: 'PD (项目总监)',      role: 'admin',  status: 'active', contextPressure: 45, memoryCount: 45, feishuAppId: '', feishuAppSecret: '' },
  { agentId: 'pm',       name: 'PM (产品经理)',      role: 'member', status: 'active', contextPressure: 38, memoryCount: 38, feishuAppId: '', feishuAppSecret: '' },
  { agentId: 'dev',      name: 'Dev (开发工程师)',   role: 'member', status: 'active', contextPressure: 92, memoryCount: 52, feishuAppId: '', feishuAppSecret: '' },
  { agentId: 'dev-dq',   name: 'Dev-DQ (开发)',      role: 'member', status: 'idle',  contextPressure: 28, memoryCount: 28, feishuAppId: '', feishuAppSecret: '' },
  { agentId: 'des',      name: 'Des (UI/UX设计)',   role: 'member', status: 'active', contextPressure: 33, memoryCount: 33, feishuAppId: '', feishuAppSecret: '' },
  { agentId: 'qa',       name: 'QA (测试工程师)',   role: 'member', status: 'active', contextPressure: 84, memoryCount: 19, feishuAppId: '', feishuAppSecret: '' },
  { agentId: 'ops',      name: 'Ops (运维工程师)',  role: 'member', status: 'idle',  contextPressure: 14, memoryCount: 14, feishuAppId: '', feishuAppSecret: '' },
  { agentId: 'xiaoai',   name: '小爱 (助理)',        role: 'admin',  status: 'active', contextPressure: 61, memoryCount: 61, feishuAppId: '', feishuAppSecret: '' },
];

// Threshold config (v1.2)
let thresholdConfig = {
  contextPressureThreshold: 85,
  feishuWebhookEnabled: true,
  emailEnabled: false,
};

// ─── Hall (Phase 1) In-Memory Stores ───────────────────────────────────────
let hallMessages = [
  {
    id: 'msg-001',
    senderId: 'pm',
    senderName: 'PM',
    senderEmoji: '📋',
    content: '大家好，Hall 协作大厅已上线！可以用 @ 指派任务给特定 Agent 👋',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    isTask: false,
  },
  {
    id: 'msg-002',
    senderId: 'dev',
    senderName: 'Dev',
    senderEmoji: '💻',
    content: '@PM Hall UI 设计稿什么时候能出？我这边等着开始开发',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    isTask: false,
  },
  {
    id: 'task-001',
    senderId: 'pm',
    senderName: 'PM',
    senderEmoji: '📋',
    content: '@Des 请开始 Hall UI 设计初稿',
    timestamp: new Date(Date.now() - 3500000).toISOString(),
    isTask: true,
    task: {
      id: 'HT-001',
      title: 'Hall UI 设计初稿',
      description: '完成 Hall 协作大厅的 UI 设计初稿，包括布局、消息流、任务卡片样式',
      assignee: 'des',
      assigneeName: 'Des',
      assigner: 'pm',
      status: 'pending',
      createdAt: new Date(Date.now() - 3500000).toISOString(),
      acceptedAt: null,
      completedAt: null,
      result: '',
    },
  },
  {
    id: 'msg-003',
    senderId: 'des',
    senderName: 'Des',
    senderEmoji: '🎨',
    content: '收到！设计稿今天下午可以出初稿 😊',
    timestamp: new Date(Date.now() - 3000000).toISOString(),
    isTask: false,
  },
  {
    id: 'msg-004',
    senderId: 'pd',
    senderName: 'PD',
    senderEmoji: '👔',
    content: '@Dev @QA 控制台 v1.3 已部署，麻烦验证一下功能是否正常',
    timestamp: new Date(Date.now() - 1200000).toISOString(),
    isTask: false,
  },
  {
    id: 'task-002',
    senderId: 'pd',
    senderName: 'PD',
    senderEmoji: '👔',
    content: '@Dev 控制台 v1.3 功能验证',
    timestamp: new Date(Date.now() - 1150000).toISOString(),
    isTask: true,
    task: {
      id: 'HT-002',
      title: '控制台 v1.3 功能验证',
      description: '验证控制台 v1.3 部署后各 Tab 功能是否正常，包括仪表盘、员工总览、告警中心、任务看板',
      assignee: 'dev',
      assigneeName: 'Dev',
      assigner: 'pd',
      status: 'accepted',
      createdAt: new Date(Date.now() - 1150000).toISOString(),
      acceptedAt: new Date(Date.now() - 1000000).toISOString(),
      completedAt: null,
      result: '',
    },
  },
  {
    id: 'task-003',
    senderId: 'pd',
    senderName: 'PD',
    senderEmoji: '👔',
    content: '@QA 同步验证 AI 笔记功能',
    timestamp: new Date(Date.now() - 1100000).toISOString(),
    isTask: true,
    task: {
      id: 'HT-003',
      title: 'AI 笔记功能验证',
      description: '验证 AI 笔记前端和后端是否正常工作，包括新建笔记、AI 对话功能',
      assignee: 'qa',
      assigneeName: 'QA',
      assigner: 'pd',
      status: 'pending',
      createdAt: new Date(Date.now() - 1100000).toISOString(),
      acceptedAt: null,
      completedAt: null,
      result: '',
    },
  },
];

let hallTasks = [
  {
    id: 'HT-001',
    title: 'Hall UI 设计初稿',
    description: '完成 Hall 协作大厅的 UI 设计初稿，包括布局、消息流、任务卡片样式',
    assignee: 'des',
    assigneeName: 'Des',
    assigner: 'pm',
    status: 'pending',
    createdAt: new Date(Date.now() - 3500000).toISOString(),
    acceptedAt: null,
    completedAt: null,
    result: '',
  },
  {
    id: 'HT-002',
    title: '控制台 v1.3 功能验证',
    description: '验证控制台 v1.3 部署后各 Tab 功能是否正常',
    assignee: 'dev',
    assigneeName: 'Dev',
    assigner: 'pd',
    status: 'accepted',
    createdAt: new Date(Date.now() - 1150000).toISOString(),
    acceptedAt: new Date(Date.now() - 1000000).toISOString(),
    completedAt: null,
    result: '',
  },
  {
    id: 'HT-003',
    title: 'AI 笔记功能验证',
    description: '验证 AI 笔记前端和后端是否正常工作',
    assignee: 'qa',
    assigneeName: 'QA',
    assigner: 'pd',
    status: 'pending',
    createdAt: new Date(Date.now() - 1100000).toISOString(),
    acceptedAt: null,
    completedAt: null,
    result: '',
  },
];

let hallAgents = [
  { id: 'pd',      name: 'PD',      emoji: '👔', color: '#DB61A2', status: 'idle',    role: '项目总监' },
  { id: 'pm',      name: 'PM',      emoji: '📋', color: '#1F6FEB', status: 'idle',    role: '产品经理' },
  { id: 'dev',     name: 'Dev',     emoji: '💻', color: '#8957E5', status: 'running', role: '开发工程师' },
  { id: 'dev-dq',  name: '窦青',    emoji: '🛠', color: '#DA3633', status: 'idle',    role: '开发工程师' },
  { id: 'des',     name: 'Des',     emoji: '🎨', color: '#2EA043', status: 'running', role: 'UI/UX设计师' },
  { id: 'qa',      name: 'QA',      emoji: '🧪', color: '#238636', status: 'idle',    role: '测试工程师' },
  { id: 'ops',     name: 'Ops',     emoji: '🔧', color: '#D29922', status: 'offline', role: '运维工程师' },
  { id: 'xiaoai',  name: '小爱',   emoji: '🤵', color: '#FFA657', status: 'idle',    role: '秘书' },
];

function safeRead(filePath) {
  try { if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf8'); } catch {}
  return null;
}

// ─── v1.1 Existing Endpoints ───────────────────────────────────────────────

// GET /api/agent/:id/docs
app.get('/api/agent/:id/docs', (req, res) => {
  const wsPath = AGENT_WORKSPACES[req.params.id];
  if (!wsPath) return res.status(404).json({ ok: false, error: 'Agent not found' });
  const docs = {};
  for (const file of ['IDENTITY.md', 'SOUL.md', 'AGENTS.md', 'MEMORY.md', 'TOOLS.md']) {
    const content = safeRead(path.join(wsPath, file));
    if (content) docs[file] = content;
  }
  res.json({ ok: true, docs, workspace: wsPath });
});

// PUT /api/agent/:id/duty
app.put('/api/agent/:id/duty', (req, res) => {
  const wsPath = AGENT_WORKSPACES[req.params.id];
  if (!wsPath) return res.status(404).json({ ok: false, error: 'Agent not found' });
  const { duty, role } = req.body;
  const identityPath = path.join(wsPath, 'IDENTITY.md');
  try {
    if (fs.existsSync(identityPath)) {
      let content = fs.readFileSync(identityPath, 'utf8');
      if (role !== undefined) content = content.replace(/^Role:.*$/m, `Role: ${role}`);
      if (duty !== undefined) {
        if (/^Duty:.*$/m.test(content)) content = content.replace(/^Duty:.*$/m, `Duty: ${duty}`);
        else content = content.trimEnd() + `\nDuty: ${duty}\n`;
      }
      fs.writeFileSync(identityPath, content, 'utf8');
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/gateway-data — v1.1 full data
app.get('/api/gateway-data', async (req, res) => {
  let gatewayOnline = false;
  let allSessions = [];
  let agents = [];

  try {
    const healthRes = await fetch(`${GATEWAY_URL}/health`);
    const health = await healthRes.json();
    gatewayOnline = health.status === 'live';
  } catch {}

  if (gatewayOnline) {
    try {
      const sessionsRes = await fetch(`${GATEWAY_URL}/tools/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GATEWAY_TOKEN}` },
        body: JSON.stringify({ tool: 'sessions_list', action: 'json', args: { limit: 100, messageLimit: 0 } })
      });
      const sessionsData = await sessionsRes.json();
      if (sessionsData?.result?.details?.sessions) {
        allSessions = sessionsData.result.details.sessions;
      }
    } catch (e) {}

    const agentMap = {};
    const allAgentIds = Object.keys(AGENT_WORKSPACES);
    for (const id of allAgentIds) {
      agentMap[id] = {
        agentId: id, role: id, status: 'idle', tasks: 0, messages: 0,
        tokenCount: 0, tokenLimit: 200000, contextPressure: 0,
        pressureLevel: 'low', memoryCount: 0, memoryStatus: 'unavailable',
        currentTask: '—', sessionKey: '', lastActiveAt: '—',
      };
    }

    for (const s of allSessions) {
      const key = s.key || '';
      let parentAgent = null;
      if (key.includes(':subagent:')) {
        const parts = key.split(':');
        parentAgent = parts[1] || 'unknown';
      } else {
        const match = key.match(/^agent:([^:]+):/);
        parentAgent = match ? match[1] : (s.agentId || 'unknown');
      }
      if (!parentAgent || !agentMap[parentAgent]) parentAgent = 'unknown';
      if (!agentMap[parentAgent]) {
        agentMap[parentAgent] = {
          agentId: parentAgent, role: parentAgent, status: 'idle',
          tasks: 0, messages: 0, tokenCount: 0, tokenLimit: 200000,
          contextPressure: 0, pressureLevel: 'low', memoryCount: 0,
          memoryStatus: 'unavailable', currentTask: '—', sessionKey: key, lastActiveAt: '—'
        };
      }

      const a = agentMap[parentAgent];
      a.sessionKey = key;
      if (s.status === 'running' || s.status === 'active') {
        a.status = 'running';
        a.currentTask = s.label || s.displayName || '任务执行中';
      }
      a.messages += s.messages ? s.messages.length : 0;
      a.tokenCount = s.tokenCount || 0;
      a.tokenLimit = s.tokenLimit || 200000;
      if (a.tokenLimit > 0) {
        a.contextPressure = Math.min(100, Math.round((a.tokenCount / a.tokenLimit) * 100));
      }
      if (a.contextPressure >= 85) a.pressureLevel = 'high';
      else if (a.contextPressure >= 60) a.pressureLevel = 'med';
      else a.pressureLevel = 'low';
      if (s.updatedAt) a.lastActiveAt = new Date(s.updatedAt).toLocaleString('zh-CN');
      if (key.includes(':subagent:')) a.tasks = (a.tasks || 0) + 1;
    }

    for (const id of Object.keys(agentMap)) {
      const a = agentMap[id];
      const baseCount = { pd: 45, pm: 38, dev: 52, 'dev-dq': 28, des: 33, qa: 19, ops: 14, xiaoai: 61 };
      a.memoryCount = baseCount[id] || 10;
      if (a.status === 'running') a.memoryCount = Math.round(a.memoryCount * 1.3);
      a.memoryStatus = a.memoryCount > 20 ? 'available' : (a.memoryCount > 5 ? 'sparse' : 'unavailable');
    }

    agents = Object.values(agentMap);
  }

  const runningCount = agents.filter(a => a.status === 'running').length;
  const idleCount = agents.filter(a => a.status === 'idle').length;
  const errorCount = agents.filter(a => a.status === 'error').length;

  let healthScore = 100; let healthLevel = 'healthy';
  if (!gatewayOnline) { healthScore = 0; healthLevel = 'critical'; }
  else if (errorCount > 0) { healthScore = Math.max(0, 100 - errorCount * 30); healthLevel = 'critical'; }
  else if (idleCount > agents.length * 0.6) { healthScore = 70; healthLevel = 'degraded'; }
  else if (runningCount === 0) { healthScore = 50; healthLevel = 'degraded'; }

  const connections = [
    { name: 'Gateway', icon: '🔗', status: gatewayOnline ? 'good' : 'bad', detail: 'localhost:18789' },
    { name: 'Sessions', icon: '💬', status: allSessions.length > 0 ? 'good' : 'warn', detail: `${allSessions.length} 活跃会话` },
    { name: 'Memory', icon: '🧠', status: 'warn', detail: '需连接 Memory API' },
    { name: 'Feishu', icon: '📨', status: 'warn', detail: '未配置 Webhook' },
  ];

  const alertItems = [];
  if (errorCount > 0) alertItems.push({ level: 'error', message: `${errorCount} 个 Agent 出现异常，请检查系统状态` });
  if (!gatewayOnline) alertItems.push({ level: 'error', message: 'Gateway 连接失败，请检查 OpenClaw 服务是否正常运行' });
  const idleAgents = agents.filter(a => a.status === 'idle').slice(0, 2);
  for (const a of idleAgents) alertItems.push({ level: 'warning', message: `${a.role || a.agentId} 空闲超过 5 分钟` });

  res.json({
    gatewayOnline, healthScore, healthLevel,
    alerts: alertItems,
    operatorSummary: `系统${healthLevel === 'healthy' ? '运行正常' : healthLevel === 'degraded' ? '部分异常' : '异常'}，共 ${agents.length} 个 Agent，${runningCount} 个正在执行任务，${idleCount} 个空闲${errorCount > 0 ? `，${errorCount} 个异常` : ''}`,
    stats: { totalAgents: agents.length, running: runningCount, idle: idleCount, error: errorCount },
    connections, agents, allSessions,
    lastRefresh: new Date().toLocaleString('zh-CN'),
  });
});

// ─── v1.2 Alert Endpoints ──────────────────────────────────────────────────

// GET /api/alerts — list all alerts
app.get('/api/alerts', (req, res) => {
  const { status } = req.query;
  let result = alerts;
  if (status) result = result.filter(a => a.status === status);
  res.json({ ok: true, alerts: result, total: result.length });
});

// POST /api/alerts — create a new alert (simulated)
app.post('/api/alerts', (req, res) => {
  const { agentId, type, level, message, value, threshold } = req.body;
  if (!agentId || !type || !level) {
    return res.status(400).json({ ok: false, error: 'agentId, type, level are required' });
  }
  const alert = {
    id: 'a' + Date.now(),
    agentId, type, level, message: message || '',
    value: value || 0, threshold: threshold || null,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  alerts.unshift(alert);
  res.json({ ok: true, alert });
});

// PUT /api/alerts/:id/dismiss — mark alert as resolved
app.put('/api/alerts/:id/dismiss', (req, res) => {
  const alert = alerts.find(a => a.id === req.params.id);
  if (!alert) return res.status(404).json({ ok: false, error: 'Alert not found' });
  alert.status = 'resolved';
  alert.resolvedAt = new Date().toISOString();
  res.json({ ok: true, alert });
});

// GET /api/alerts/config — get threshold config
app.get('/api/alerts/config', (req, res) => {
  res.json({ ok: true, config: thresholdConfig });
});

// PUT /api/alerts/config — update threshold config
app.put('/api/alerts/config', (req, res) => {
  const { contextPressureThreshold, feishuWebhookEnabled, emailEnabled } = req.body;
  if (contextPressureThreshold !== undefined) thresholdConfig.contextPressureThreshold = contextPressureThreshold;
  if (feishuWebhookEnabled !== undefined) thresholdConfig.feishuWebhookEnabled = feishuWebhookEnabled;
  if (emailEnabled !== undefined) thresholdConfig.emailEnabled = emailEnabled;
  res.json({ ok: true, config: thresholdConfig });
});

// POST /api/alerts/test-feishu — test Feishu webhook
const FEISHU_WEBHOOK = 'https://open.feishu.cn/open-apis/bot/v2/hook/ae03114d-aa0d-4348-b12e-9bd7e2911399';
app.post('/api/alerts/test-feishu', async (req, res) => {
  try {
    const response = await fetch(FEISHU_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg_type: 'text', content: { text: '🔔 控制台飞书机器人连接正常 ✅' } })
    });
    const data = await response.json();
    if (data.code === 0 || data.StatusCode === 0) {
      res.json({ ok: true, message: '飞书机器人测试消息已发送' });
    } else {
      res.json({ ok: false, error: '飞书返回错误: ' + JSON.stringify(data) });
    }
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// ─── v1.2 Batch Operation Endpoints ───────────────────────────────────────

// POST /api/agents/batch — batch operation on multiple agents
app.post('/api/agents/batch', async (req, res) => {
  const { agentIds, action } = req.body;
  if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
    return res.status(400).json({ ok: false, error: 'agentIds (array) and action are required' });
  }
  if (!['start', 'stop', 'restart'].includes(action)) {
    return res.status(400).json({ ok: false, error: 'action must be: start, stop, or restart' });
  }

  const results = { success: [], failed: [] };
  for (const agentId of agentIds) {
    const wsPath = AGENT_WORKSPACES[agentId];
    if (!wsPath) {
      results.failed.push({ agentId, reason: 'Agent not found' });
      continue;
    }
    results.success.push({ agentId, action });
  }

  res.json({
    ok: true,
    summary: `批量${action === 'start' ? '启动' : action === 'stop' ? '停止' : '重启'}完成：${results.success.length} 个成功，${results.failed.length} 个失败`,
    results,
  });
});

// ─── v1.2 Team Management Endpoints ───────────────────────────────────────

// GET /api/team/members — list all team members
app.get('/api/team/members', (req, res) => {
  res.json({ ok: true, members: teamMembers, total: teamMembers.length });
});

// POST /api/team/members — add a new team member
app.post('/api/team/members', (req, res) => {
  const { agentId, name, role, status } = req.body;
  if (!agentId || !name) return res.status(400).json({ ok: false, error: 'agentId and name are required' });
  if (teamMembers.find(m => m.agentId === agentId)) {
    return res.status(409).json({ ok: false, error: 'Agent ID already exists' });
  }
  const member = { agentId, name, role: role || 'member', status: status || 'idle', contextPressure: 0, memoryCount: 0 };
  teamMembers.push(member);
  res.json({ ok: true, member });
});

// PUT /api/team/members/:agentId — update a team member (v1.3 includes feishu)
app.put('/api/team/members/:agentId', (req, res) => {
  const member = teamMembers.find(m => m.agentId === req.params.agentId);
  if (!member) return res.status(404).json({ ok: false, error: 'Team member not found' });
  const { name, role, status, feishuAppId, feishuAppSecret } = req.body;
  if (name !== undefined) member.name = name;
  if (role !== undefined) member.role = role;
  if (status !== undefined) member.status = status;
  if (feishuAppId !== undefined) member.feishuAppId = feishuAppId;
  if (feishuAppSecret !== undefined) member.feishuAppSecret = feishuAppSecret;
  res.json({ ok: true, member });
});

// DELETE /api/team/members/:agentId — remove a team member
app.delete('/api/team/members/:agentId', (req, res) => {
  const idx = teamMembers.findIndex(m => m.agentId === req.params.agentId);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'Team member not found' });
  const removed = teamMembers.splice(idx, 1)[0];
  res.json({ ok: true, removed });
});

// ─── Hall Phase 1 Endpoints ──────────────────────────────────────────────

// GET /api/hall/messages — get all hall messages (supports topicId, page, pageSize)
app.get('/api/hall/messages', (req, res) => {
  const { topicId, page = 1, pageSize = 20 } = req.query;

  let msgs = hallMessages;
  if (topicId) {
    msgs = msgs.filter(m => m.topicId === topicId);
  }

  // Sort by timestamp descending
  msgs = [...msgs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const total = msgs.length;
  const p = parseInt(page);
  const ps = parseInt(pageSize);
  const start = (p - 1) * ps;
  const paginatedMsgs = msgs.slice(start, start + ps);

  res.json({
    ok: true,
    messages: paginatedMsgs,
    pagination: {
      page: p,
      pageSize: ps,
      total,
      totalPages: Math.ceil(total / ps),
      hasMore: start + ps < total,
    },
  });
});

// POST /api/hall/messages — send a message (supports @agentId syntax, topicId)
app.post('/api/hall/messages', (req, res) => {
  const { senderId, senderName, senderEmoji, content, topicId } = req.body;
  if (!senderId || !content) {
    return res.status(400).json({ ok: false, error: 'senderId and content are required' });
  }

  // Parse @ mentions
  const atMentionRegex = /@([a-zA-Z0-9_-]+)/g;
  const mentions = [];
  let match;
  while ((match = atMentionRegex.exec(content)) !== null) {
    const agentId = match[1].toLowerCase();
    const agent = hallAgents.find(a => a.id === agentId);
    if (agent) {
      mentions.push({ agentId: agent.id, agentName: agent.name });
    }
  }

  const messageId = 'msg-' + Date.now();
  const timestamp = new Date().toISOString();

  // Create the base message
  const message = {
    id: messageId,
    senderId,
    senderName: senderName || senderId,
    senderEmoji: senderEmoji || '🤖',
    content,
    timestamp,
    isTask: false,
    topicId: topicId || null,
  };

  // If there are @ mentions, create task cards
  if (mentions.length > 0) {
    message.isTask = true;

    for (const mention of mentions) {
      const taskId = 'HT-' + String(Date.now() + Math.floor(Math.random() * 1000));
      const task = {
        id: taskId,
        title: content.replace(/@[a-zA-Z0-9_-]+\s*/g, '').trim().substring(0, 60) || '任务指派',
        description: content.replace(/@[a-zA-Z0-9_-]+\s*/g, '').trim() || '无详细描述',
        assignee: mention.agentId,
        assigneeName: mention.agentName,
        assigner: senderId,
        status: 'pending',
        createdAt: timestamp,
        acceptedAt: null,
        completedAt: null,
        result: '',
      };
      hallTasks.push(task);
      message.task = task;
    }
  }

  hallMessages.push(message);

  // ── Phase 2: Parse 【执行结果】 trigger word ────────────────────────────
  const parsed = parseExecutionResult(content);
  if (parsed && parsed.taskId) {
    let targetTask = hallTasks.find(t => t.id === parsed.taskId);
    if (!targetTask) {
      const msg2 = hallMessages.find(m => m.task && m.task.id === parsed.taskId);
      if (msg2) targetTask = msg2.task;
    }
    if (targetTask) {
      targetTask.status = parsed.status;
      targetTask.completedAt = new Date().toISOString();
      targetTask.result = parsed.summary + (parsed.detail ? '\n\n详情：' + parsed.detail : '');

      // Update execution chain step
      if (targetTask.executionChain && targetTask.executionChain.length > 0) {
        const lastStep = targetTask.executionChain[targetTask.executionChain.length - 1];
        lastStep.status = parsed.status;
        lastStep.result = targetTask.result;
        lastStep.completedAt = targetTask.completedAt;
      }

      // Also update chain step if task has chainId
      if (targetTask.chainId) {
        const chain = chains.find(c => c.id === targetTask.chainId);
        if (chain) {
          const step = chain.steps.find(s => s.taskId === targetTask.id);
          if (step) {
            step.status = parsed.status;
            step.result = targetTask.result;
            step.completedAt = targetTask.completedAt;

            if (parsed.status === 'completed') {
              const nextIdx = chain.steps.findIndex(s => s.stepId === step.stepId + 1);
              if (nextIdx !== -1) {
                chain.steps[nextIdx].status = 'pending';
              }
            }
          }
        }
      }

      // Sync into messages
      for (const m of hallMessages) {
        if (m.task && m.task.id === targetTask.id) m.task = { ...targetTask };
      }
    }
  }

  res.json({ ok: true, message });
});

// GET /api/hall/agents — get online agents for Hall
app.get('/api/hall/agents', (req, res) => {
  res.json({ ok: true, agents: hallAgents });
});

// PUT /api/hall/tasks/:id — update task status (Phase 2: supports logs, chainId, stepIndex)
app.put('/api/hall/tasks/:id', (req, res) => {
  const { status, result, logs, chainId, stepIndex, deadline } = req.body;
  let task = hallTasks.find(t => t.id === req.params.id);
  if (!task) {
    const msg = hallMessages.find(m => m.task && m.task.id === req.params.id);
    if (msg) task = msg.task;
  }
  if (!task) return res.status(404).json({ ok: false, error: 'Task not found' });

  if (status) task.status = status;
  if (status === 'accepted') task.acceptedAt = new Date().toISOString();
  if (status === 'running' && !task.startedAt) task.startedAt = new Date().toISOString();
  if (status === 'completed' || status === 'failed') task.completedAt = new Date().toISOString();
  if (result !== undefined) task.result = result;
  if (logs !== undefined) task.logs = logs;
  if (chainId !== undefined) task.chainId = chainId;
  if (stepIndex !== undefined) task.stepIndex = stepIndex;
  if (deadline !== undefined) task.deadline = deadline;

  // Sync to hallMessages
  for (const msg of hallMessages) {
    if (msg.task && msg.task.id === task.id) msg.task = { ...task };
  }

  res.json({ ok: true, task });
});

// GET /api/hall/tasks — get all Hall tasks
app.get('/api/hall/tasks', (req, res) => {
  res.json({ ok: true, tasks: hallTasks });
});

// GET /api/hall/tasks/starred — get all starred tasks
app.get('/api/hall/tasks/starred', (req, res) => {
  // Tasks live in hallMessages (as msg.task), also check hallTasks for direct tasks
  const starred = [];
  for (const t of hallTasks) {
    if (starredTasks.has(t.id)) starred.push(t);
  }
  // Also scan hallMessages for task cards
  for (const msg of hallMessages) {
    if (msg.task && starredTasks.has(msg.task.id)) {
      if (!starred.find(t => t.id === msg.task.id)) {
        starred.push(msg.task);
      }
    }
  }
  res.json({ ok: true, tasks: starred, total: starred.length });
});

// GET /api/hall/tasks/:id — get single task detail
app.get('/api/hall/tasks/:id', (req, res) => {
  let task = hallTasks.find(t => t.id === req.params.id);
  if (!task) {
    const msg = hallMessages.find(m => m.task && m.task.id === req.params.id);
    if (msg) task = msg.task;
  }
  if (!task) return res.status(404).json({ ok: false, error: 'Task not found' });
  res.json({ ok: true, task });
});

// ─── Hall Phase 2: Execution Chain Endpoints ────────────────────────────────

// POST /api/hall/chains — create an execution chain
app.post('/api/hall/chains', (req, res) => {
  const { name, owner, steps } = req.body;
  if (!name || !owner || !Array.isArray(steps) || steps.length === 0) {
    return res.status(400).json({ ok: false, error: 'name, owner, and steps[] are required' });
  }

  const chainId = 'EC-' + String(chainCounter++).padStart(3, '0');
  const now = new Date().toISOString();

  const chainSteps = steps.map((s, i) => {
    const stepId = 'ES-' + chainId + '-' + (i + 1);
    const agent = hallAgents.find(a => a.id === s.agentId);
    return {
      stepId: i + 1,
      stepIdStr: stepId,
      agentId: s.agentId,
      agentName: agent ? agent.name : s.agentId,
      task: s.task,
      status: i === 0 ? 'pending' : 'locked',
      taskId: null,
      sessionId: null,
      result: '',
      startedAt: null,
      completedAt: null,
      duration: null,
      failureReason: '',
      isBlocking: s.isBlocking !== false,
    };
  });

  const chain = {
    id: chainId,
    name,
    owner,
    status: 'pending',
    currentStep: 1,
    steps: chainSteps,
    createdAt: now,
    completedAt: null,
    failureReason: '',
  };

  chains.push(chain);
  res.json({ ok: true, chain });
});

// GET /api/hall/chains — list all chains
app.get('/api/hall/chains', (req, res) => {
  const { status } = req.query;
  let result = chains;
  if (status) result = result.filter(c => c.status === status);
  res.json({ ok: true, chains: result, total: result.length });
});

// GET /api/hall/chains/:id — get chain detail
app.get('/api/hall/chains/:id', (req, res) => {
  const chain = chains.find(c => c.id === req.params.id);
  if (!chain) return res.status(404).json({ ok: false, error: 'Chain not found' });
  res.json({ ok: true, chain });
});

// PUT /api/hall/chains/:id/steps/:stepId — update a chain step status
app.put('/api/hall/chains/:id/steps/:stepId', (req, res) => {
  const chain = chains.find(c => c.id === req.params.id);
  if (!chain) return res.status(404).json({ ok: false, error: 'Chain not found' });

  const step = chain.steps.find(s => s.stepId === parseInt(req.params.stepId));
  if (!step) return res.status(404).json({ ok: false, error: 'Step not found' });

  const { status, result, failureReason, taskId, sessionId } = req.body;

  if (status) {
    // Validate status transitions
    const allowedStatuses = ['pending', 'accepted', 'running', 'completed', 'failed', 'skipped'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ ok: false, error: `Invalid status: ${status}` });
    }

    const prevStatus = step.status;
    step.status = status;

    if (status === 'accepted' || status === 'running') {
      step.startedAt = step.startedAt || new Date().toISOString();
    } else if (status === 'completed') {
      step.completedAt = new Date().toISOString();
      if (step.startedAt) {
        step.duration = Math.round((new Date(step.completedAt) - new Date(step.startedAt)) / 1000);
      }
      step.result = result || '';

      // Unlock next step
      const nextStepIdx = chain.steps.findIndex(s => s.stepId === step.stepId + 1);
      if (nextStepIdx !== -1) {
        const nextStep = chain.steps[nextStepIdx];
        if (nextStep.status === 'locked') {
          nextStep.status = 'pending';
        }
      }
    } else if (status === 'failed') {
      step.failureReason = failureReason || '执行失败';
      step.completedAt = new Date().toISOString();
      chain.status = 'failed';
      chain.failureReason = `Step ${step.stepId} failed: ${step.failureReason}`;
      // Mark subsequent locked steps as skipped
      for (const s of chain.steps) {
        if (s.status === 'locked') s.status = 'skipped';
      }
    } else if (status === 'skipped') {
      step.completedAt = new Date().toISOString();
      // Unlock next step
      const nextStepIdx = chain.steps.findIndex(s => s.stepId === step.stepId + 1);
      if (nextStepIdx !== -1) {
        const nextStep = chain.steps[nextStepIdx];
        if (nextStep.status === 'locked') nextStep.status = 'pending';
      }
    }
  }

  if (result !== undefined) step.result = result;
  if (failureReason !== undefined) step.failureReason = failureReason;
  if (taskId !== undefined) step.taskId = taskId;
  if (sessionId !== undefined) step.sessionId = sessionId;

  // Update chain currentStep to the first non-completed step
  const firstActive = chain.steps.find(s => ['pending', 'accepted', 'running'].includes(s.status));
  if (firstActive) {
    chain.currentStep = firstActive.stepId;
  } else if (chain.status !== 'failed') {
    // All steps done — check if any failed
    const hasFailed = chain.steps.some(s => s.status === 'failed');
    chain.status = hasFailed ? 'failed' : 'completed';
    if (chain.status === 'completed') chain.completedAt = new Date().toISOString();
  }

  // Sync task result into hallTasks if step has taskId
  if (step.taskId) {
    const t = hallTasks.find(t => t.id === step.taskId);
    if (t) {
      if (status === 'completed') {
        t.status = 'completed';
        t.completedAt = step.completedAt;
        t.result = step.result;
      } else if (status === 'failed') {
        t.status = 'failed';
        t.failureReason = step.failureReason;
        t.completedAt = step.completedAt;
      }
      // Sync into messages
      for (const msg of hallMessages) {
        if (msg.task && msg.task.id === t.id) msg.task = { ...t };
      }
    }
  }

  res.json({ ok: true, chain, step });
});

// POST /api/hall/tasks/:id/result — receive execution result from agent (Phase 2)
app.post('/api/hall/tasks/:id/result', (req, res) => {
  let task = hallTasks.find(t => t.id === req.params.id);
  if (!task) {
    const msg = hallMessages.find(m => m.task && m.task.id === req.params.id);
    if (msg) task = msg.task;
  }
  if (!task) return res.status(404).json({ ok: false, error: 'Task not found' });

  const { status, result, summary, detail, duration, steps: resultSteps } = req.body;

  if (status === 'completed' || status === 'failed') {
    task.status = status;
    task.completedAt = new Date().toISOString();
    task.result = result || summary || detail || (status === 'completed' ? '任务已完成' : '执行失败');
    if (duration) task.duration = duration;

    // Update execution chain step
    if (task.executionChain && task.executionChain.length > 0) {
      const lastStep = task.executionChain[task.executionChain.length - 1];
      lastStep.status = status;
      lastStep.result = task.result;
      lastStep.completedAt = task.completedAt;
    }

    // Also update chain if task has chainId
    if (task.chainId) {
      const chain = chains.find(c => c.id === task.chainId);
      if (chain) {
        const step = chain.steps.find(s => s.taskId === task.id);
        if (step) {
          step.status = status;
          step.result = task.result;
          step.completedAt = task.completedAt;
          if (status === 'completed') {
            const nextIdx = chain.steps.findIndex(s => s.stepId === step.stepId + 1);
            if (nextIdx !== -1) {
              chain.steps[nextIdx].status = 'pending';
            }
          }
        }
      }
    }
  }

  // Sync to hallMessages
  for (const msg of hallMessages) {
    if (msg.task && msg.task.id === task.id) {
      msg.task = { ...task };
    }
  }

  res.json({ ok: true, task });
});

// POST /api/hall/tasks/:id/execute — trigger agent execution (Phase 2, sessions_send)
app.post('/api/hall/tasks/:id/execute', async (req, res) => {
  let task = hallTasks.find(t => t.id === req.params.id);
  if (!task) {
    const msg = hallMessages.find(m => m.task && m.task.id === req.params.id);
    if (msg) task = msg.task;
  }
  if (!task) return res.status(404).json({ ok: false, error: 'Task not found' });

  const { action } = req.body; // 'accept' | 'reject' | 'execute' | 'complete' | 'fail' | 'chain'

  // ── Phase 2: sessions_send execution trigger ──────────────────────────────
  if (action === 'execute') {
    if (!['pending', 'accepted'].includes(task.status)) {
      return res.status(400).json({ ok: false, error: `Cannot execute task in '${task.status}' state` });
    }

    const timeout = req.body.timeout || 300;
    const taskMessage = `【任务执行】
任务：${task.title}
描述：${task.description}
来源：Hall
截止：${task.deadline || '未设置'}

请在执行完成后，将结果通过以下格式回传 Hall：
【执行结果】任务ID: ${task.id} | 状态: success/failed | 结果摘要: ... | 详情: ...`;

    // Call sessions_send
    const sendResult = await sessions_send(task.assignee, taskMessage, timeout);

    task.status = 'running';
    task.startedAt = task.startedAt || new Date().toISOString();
    task.acceptedAt = task.acceptedAt || new Date().toISOString();
    task.sessionId = sendResult?.sessionKey || sendResult?.result?.sessionKey || null;
    task.timeout = timeout;

    // Initialize execution chain (single-step for single agent)
    if (!task.executionChain || task.executionChain.length === 0) {
      task.executionChain = [{
        stepId: 1,
        agentId: task.assignee,
        agentName: task.assigneeName,
        status: 'running',
        task: task.title,
        result: '',
        startedAt: task.startedAt,
        completedAt: null,
        sessionId: task.sessionId,
      }];
    } else {
      task.executionChain[0].status = 'running';
      task.executionChain[0].startedAt = task.startedAt;
      task.executionChain[0].sessionId = task.sessionId;
    }

    // Sync back to hallMessages
    for (const msg of hallMessages) {
      if (msg.task && msg.task.id === task.id) {
        msg.task = { ...task };
      }
    }

    return res.json({
      ok: true,
      task,
      sessionKey: task.sessionId,
      status: 'running',
      startedAt: task.startedAt,
      timeout,
    });
  }

  // ── Legacy actions (Phase 1) ───────────────────────────────────────────────
  if (action === 'accept') {
    if (!['pending'].includes(task.status)) {
      return res.status(400).json({ ok: false, error: `Cannot accept task in '${task.status}' state` });
    }
    task.status = 'accepted';
    task.acceptedAt = new Date().toISOString();
    task.executionChain = [{
      stepId: 1,
      agentId: task.assignee,
      agentName: task.assigneeName,
      status: 'pending',
      task: task.title,
      result: '',
      startedAt: null,
      completedAt: null,
    }];
  } else if (action === 'reject') {
    if (!['pending'].includes(task.status)) {
      return res.status(400).json({ ok: false, error: `Cannot reject task in '${task.status}' state` });
    }
    task.status = 'rejected';
  } else if (action === 'complete') {
    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    task.result = req.body.result || '任务已完成';
    if (task.executionChain && task.executionChain.length > 0) {
      task.executionChain[task.executionChain.length - 1].status = 'completed';
      task.executionChain[task.executionChain.length - 1].result = task.result;
      task.executionChain[task.executionChain.length - 1].completedAt = task.completedAt;
    }
  } else if (action === 'fail') {
    task.status = 'failed';
    task.failureReason = req.body.reason || '执行失败';
    task.completedAt = new Date().toISOString();
    if (task.executionChain && task.executionChain.length > 0) {
      task.executionChain[task.executionChain.length - 1].status = 'failed';
    }
  } else if (action === 'chain') {
    // Multi-step execution chain
    const { steps } = req.body;
    if (!Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({ ok: false, error: 'steps array required for chain execution' });
    }
    task.status = 'running';
    task.acceptedAt = new Date().toISOString();
    task.executionChain = steps.map((s, i) => ({
      stepId: i + 1,
      agentId: s.agentId,
      agentName: s.agentName,
      task: s.task || task.title,
      status: i === 0 ? 'running' : 'locked',
      result: '',
      startedAt: i === 0 ? new Date().toISOString() : null,
      completedAt: null,
    }));
  }

  // Sync back to hallMessages
  for (const msg of hallMessages) {
    if (msg.task && msg.task.id === task.id) {
      msg.task = { ...task };
    }
  }

  res.json({ ok: true, task });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Hall Phase 3: Topics Store
// ═══════════════════════════════════════════════════════════════════════════════
let topics = [
  {
    id: 'topic-001',
    name: '💬 日常讨论',
    color: '#6C8EEF',
    creatorId: 'pm',
    creatorName: 'PM',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    messageCount: 4,
  },
  {
    id: 'topic-002',
    name: '🐛 Bug 追踪',
    color: '#EF4444',
    creatorId: 'qa',
    creatorName: 'QA',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    messageCount: 2,
  },
];

let topicCounter = 3;

// In-memory star store (client-side localStorage, but we track via API calls)
let starredTasks = new Set(['HT-001']); // Pre-star HT-001 for demo

// ─── Hall Phase 3: Topics APIs ─────────────────────────────────────────────

// GET /api/hall/topics — list all topics
app.get('/api/hall/topics', (req, res) => {
  res.json({ ok: true, topics, total: topics.length });
});

// POST /api/hall/topics — create a new topic
app.post('/api/hall/topics', (req, res) => {
  const { name, color, creatorId, creatorName } = req.body;
  if (!name) return res.status(400).json({ ok: false, error: 'name is required' });

  const topic = {
    id: 'topic-' + String(topicCounter++).padStart(3, '0'),
    name: name || '新话题',
    color: color || '#6C8EEF',
    creatorId: creatorId || 'unknown',
    creatorName: creatorName || '未知',
    createdAt: new Date().toISOString(),
    messageCount: 0,
  };
  topics.push(topic);
  res.json({ ok: true, topic });
});

// GET /api/hall/topics/:id/messages — get messages for a specific topic
app.get('/api/hall/topics/:id/messages', (req, res) => {
  const { page = 1, pageSize = 20 } = req.query;
  const topicId = req.params.id;
  const topic = topics.find(t => t.id === topicId);
  if (!topic) return res.status(404).json({ ok: false, error: 'Topic not found' });

  // Filter messages that belong to this topic (by topicId tag in message)
  const allTopicMsgs = hallMessages.filter(m => m.topicId === topicId);
  const total = allTopicMsgs.length;
  const start = (parseInt(page) - 1) * parseInt(pageSize);
  const messages = allTopicMsgs.slice(start, start + parseInt(pageSize));

  res.json({
    ok: true,
    messages,
    topic,
    pagination: {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      total,
      totalPages: Math.ceil(total / parseInt(pageSize)),
      hasMore: start + parseInt(pageSize) < total,
    },
  });
});

// POST /api/hall/messages — updated to support topicId
// (already defined above, we extend it to support topicId)

// ─── Hall Phase 3: Message Search API ──────────────────────────────────────

// GET /api/hall/messages/search — search messages
app.get('/api/hall/messages/search', (req, res) => {
  const { q, senderId, topicId, startDate, endDate, page = 1, pageSize = 20 } = req.query;
  if (!q && !senderId && !topicId) {
    return res.status(400).json({ ok: false, error: 'At least one of q, senderId, or topicId is required' });
  }

  let results = hallMessages;

  if (q) {
    const lowerQ = q.toLowerCase();
    results = results.filter(m =>
      m.content.toLowerCase().includes(lowerQ) ||
      (m.senderName && m.senderName.toLowerCase().includes(lowerQ)) ||
      (m.task && (
        m.task.title.toLowerCase().includes(lowerQ) ||
        (m.task.description && m.task.description.toLowerCase().includes(lowerQ)) ||
        m.task.id.toLowerCase().includes(lowerQ)
      ))
    );
  }

  if (senderId) {
    results = results.filter(m => m.senderId === senderId);
  }

  if (topicId) {
    results = results.filter(m => m.topicId === topicId);
  }

  if (startDate) {
    const start = new Date(startDate);
    results = results.filter(m => new Date(m.timestamp) >= start);
  }

  if (endDate) {
    const end = new Date(endDate);
    results = results.filter(m => new Date(m.timestamp) <= end);
  }

  // Sort by timestamp descending (newest first)
  results = [...results].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const total = results.length;
  const start = (parseInt(page) - 1) * parseInt(pageSize);
  const paginatedResults = results.slice(start, start + parseInt(pageSize));

  // Add context preview (surrounding text for search highlight)
  const enriched = paginatedResults.map(m => {
    let highlight = m.content;
    if (q) {
      const idx = m.content.toLowerCase().indexOf(q.toLowerCase());
      if (idx !== -1) {
        const start2 = Math.max(0, idx - 20);
        const end2 = Math.min(m.content.length, idx + q.length + 40);
        highlight = (start2 > 0 ? '…' : '') + m.content.substring(start2, end2) + (end2 < m.content.length ? '…' : '');
      }
    }
    return { ...m, highlight, matchedField: q ? 'content' : 'filter' };
  });

  res.json({
    ok: true,
    results: enriched,
    query: q,
    pagination: {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      total,
      totalPages: Math.ceil(total / parseInt(pageSize)),
      hasMore: start + parseInt(pageSize) < total,
    },
    summary: `找到 ${total} 条相关消息${q ? ` (关键词: "${q}")` : ''}`,
  });
});

// ─── Hall Phase 3: Task Star APIs ──────────────────────────────────────────

// POST /api/hall/tasks/:id/star — star a task
app.post('/api/hall/tasks/:id/star', (req, res) => {
  const taskId = req.params.id;
  // Check hallTasks first, then hallMessages
  let task = hallTasks.find(t => t.id === taskId);
  if (!task) {
    const msg = hallMessages.find(m => m.task && m.task.id === taskId);
    if (msg) task = msg.task;
  }
  if (!task) return res.status(404).json({ ok: false, error: 'Task not found' });

  starredTasks.add(taskId);
  // Also add to hallTasks if found in messages only
  if (!hallTasks.find(t => t.id === taskId)) {
    hallTasks.push(task);
  }

  res.json({ ok: true, starred: true, taskId });
});

// DELETE /api/hall/tasks/:id/star — unstar a task
app.delete('/api/hall/tasks/:id/star', (req, res) => {
  const taskId = req.params.id;
  starredTasks.delete(taskId);
  res.json({ ok: true, starred: false, taskId });
});

// GET /api/hall/messages — updated: support topicId & pagination
// (already defined, but we update it to support topicId query param)

// ─── Update POST /api/hall/messages to support topicId ─────────────────────
// This is already defined above; messages with topicId will be stored

// ─── SPA Fallback ──────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Control Center v1.6 (Hall Phase 3) running on http://0.0.0.0:${PORT}`);
});
