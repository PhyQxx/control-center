const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const GATEWAY_TOKEN = '841f529e7dcf20d7528b40fb159226dc86ace43f45603ce6';
const GATEWAY_URL = 'http://localhost:18789';

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

// In-memory alert store (v1.2) — replace with DB/persistence in production
let alerts = [
  { id: 'a1', agentId: 'dev', type: 'context_pressure', level: 'critical', message: 'Context Pressure 超过 90%', value: 92, threshold: 85, status: 'active', createdAt: new Date(Date.now() - 120000).toISOString() },
  { id: 'a2', agentId: 'qa',  type: 'context_pressure', level: 'warning',  message: 'Context Pressure 超过 80%', value: 84, threshold: 85, status: 'active', createdAt: new Date(Date.now() - 300000).toISOString() },
  { id: 'a3', agentId: 'pm',  type: 'agent_error',     level: 'warning',  message: 'Agent 异常退出',              value: 1,  threshold: null, status: 'resolved', createdAt: new Date(Date.now() - 600000).toISOString(), resolvedAt: new Date(Date.now() - 300000).toISOString() },
];

// In-memory team members store (v1.2)
let teamMembers = [
  { agentId: 'pd',       name: 'PD (项目总监)',      role: 'admin',  status: 'active', contextPressure: 45, memoryCount: 45 },
  { agentId: 'pm',       name: 'PM (产品经理)',      role: 'member', status: 'active', contextPressure: 38, memoryCount: 38 },
  { agentId: 'dev',      name: 'Dev (开发工程师)',   role: 'member', status: 'active', contextPressure: 92, memoryCount: 52 },
  { agentId: 'dev-dq',   name: 'Dev-DQ (开发)',      role: 'member', status: 'idle',  contextPressure: 28, memoryCount: 28 },
  { agentId: 'des',      name: 'Des (UI/UX设计)',   role: 'member', status: 'active', contextPressure: 33, memoryCount: 33 },
  { agentId: 'qa',       name: 'QA (测试工程师)',   role: 'member', status: 'active', contextPressure: 84, memoryCount: 19 },
  { agentId: 'ops',      name: 'Ops (运维工程师)',  role: 'member', status: 'idle',  contextPressure: 14, memoryCount: 14 },
  { agentId: 'xiaoai',   name: '小爱 (助理)',        role: 'admin',  status: 'active', contextPressure: 61, memoryCount: 61 },
];

// Threshold config (v1.2)
let thresholdConfig = {
  contextPressureThreshold: 85,
  feishuWebhookEnabled: true,
  emailEnabled: false,
};

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
    { name: 'Gateway', icon: '🔗', status: gatewayOnline ? 'good' : 'bad', detail: gatewayOnline ? 'localhost:18789' : '无法连接' },
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
    // Simulate operation — in production this calls Gateway API
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

// PUT /api/team/members/:agentId — update a team member
app.put('/api/team/members/:agentId', (req, res) => {
  const member = teamMembers.find(m => m.agentId === req.params.agentId);
  if (!member) return res.status(404).json({ ok: false, error: 'Team member not found' });
  const { name, role, status } = req.body;
  if (name !== undefined) member.name = name;
  if (role !== undefined) member.role = role;
  if (status !== undefined) member.status = status;
  res.json({ ok: true, member });
});

// DELETE /api/team/members/:agentId — remove a team member
app.delete('/api/team/members/:agentId', (req, res) => {
  const idx = teamMembers.findIndex(m => m.agentId === req.params.agentId);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'Team member not found' });
  const removed = teamMembers.splice(idx, 1)[0];
  res.json({ ok: true, removed });
});

// ─── SPA Fallback ──────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Control Center v1.2 running on http://0.0.0.0:${PORT}`);
});
