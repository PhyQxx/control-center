<template>
  <div class="cc-root">
    <!-- Header -->
    <header class="cc-header">
      <div class="header-left">
        <span class="logo-icon">💻</span>
        <span class="logo-text">OpenClaw 控制台</span>
      </div>
      <div class="header-right">
        <el-tag :type="gatewayOnline ? 'success' : 'danger'" effect="dark" size="small">
          {{ gatewayOnline ? '● Gateway 在线' : '● Gateway 离线' }}
        </el-tag>
        <el-button type="success" size="small" @click="refresh" :loading="loading">
          🔄 刷新
        </el-button>
        <span class="last-update" v-if="lastUpdate">最后更新：{{ lastUpdate }}</span>
      </div>
    </header>

    <!-- Tab Bar -->
    <div class="cc-tabs">
      <el-tabs v-model="activeTab" @tab-change="onTabChange">
        <el-tab-pane label="👥 员工总览" name="agents" />
        <el-tab-pane label="📋 任务看板" name="tasks" />
        <el-tab-pane label="💻 系统状态" name="system" />
      </el-tabs>
    </div>

    <!-- Content -->
    <div class="cc-content">
      <!-- Agent Overview -->
      <div v-if="activeTab === 'agents'">
        <div class="section-title">
          员工总览 <span class="section-sub">({{ agents.length }} 个 Agent)</span>
        </div>
        <div class="agent-grid">
          <el-card
            v-for="agent in agents"
            :key="agent.id"
            class="agent-card"
            :class="'status-' + agent.status"
            shadow="hover"
            @click="showDetail(agent)"
          >
            <div class="agent-card-header">
              <div class="agent-left">
                <el-avatar :size="40" :style="{ backgroundColor: agentColors[agent.id] || '#666' }">
                  {{ agent.emoji }}
                </el-avatar>
                <div class="agent-info">
                  <div class="agent-name">{{ agent.name }}</div>
                  <div class="agent-role">{{ agent.role }}</div>
                </div>
              </div>
              <el-badge is-dot :type="statusType(agent.status)" />
            </div>
            <div class="agent-stats">
              <div class="stat-item">
                <div class="stat-label">任务</div>
                <div class="stat-value" :class="{ success: agent.tasks > 0 }">{{ agent.tasks }}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">消息</div>
                <div class="stat-value">{{ agent.messages }}</div>
              </div>
            </div>
            <div class="agent-tags">
              <el-tag size="small" type="primary">{{ agent.id }}</el-tag>
              <el-tag size="small" :type="statusTagType(agent.status)" effect="dark">
                {{ statusLabel(agent.status) }}
              </el-tag>
            </div>
            <div class="agent-duty">职责：{{ agent.duty }}</div>
          </el-card>
        </div>
      </div>

      <!-- Task Board -->
      <div v-if="activeTab === 'tasks'">
        <div class="section-title">任务看板</div>
        <div class="kanban-board">
          <div class="kanban-col">
            <div class="kanban-header">
              <span class="kanban-title">📝 待处理</span>
              <el-tag size="small">{{ todoTasks.length }}</el-tag>
            </div>
            <div class="kanban-body">
              <div v-for="task in todoTasks" :key="task.id" class="task-card" @click="showDetail(task.agent)">
                <div class="task-title">{{ task.title }}</div>
                <div class="task-meta">
                  <span class="task-assignee">{{ task.agentName }}</span>
                </div>
              </div>
              <div v-if="todoTasks.length === 0" class="kanban-empty">暂无待处理任务</div>
            </div>
          </div>
          <div class="kanban-col">
            <div class="kanban-header">
              <span class="kanban-title">⚡ 进行中</span>
              <el-tag size="small" type="warning">{{ runningTasks.length }}</el-tag>
            </div>
            <div class="kanban-body">
              <div v-for="task in runningTasks" :key="task.id" class="task-card running" @click="showDetail(task.agent)">
                <div class="task-title">{{ task.title }}</div>
                <div class="task-meta">
                  <span class="task-assignee">{{ task.agentName }}</span>
                </div>
              </div>
              <div v-if="runningTasks.length === 0" class="kanban-empty">暂无进行中任务</div>
            </div>
          </div>
          <div class="kanban-col">
            <div class="kanban-header">
              <span class="kanban-title">✅ 已完成</span>
              <el-tag size="small" type="success">{{ doneTasks.length }}</el-tag>
            </div>
            <div class="kanban-body">
              <div v-for="task in doneTasks" :key="task.id" class="task-card done" @click="showDetail(task.agent)">
                <div class="task-title">{{ task.title }}</div>
                <div class="task-meta">
                  <span class="task-assignee">{{ task.agentName }}</span>
                </div>
              </div>
              <div v-if="doneTasks.length === 0" class="kanban-empty">暂无已完成任务</div>
            </div>
          </div>
        </div>
      </div>

      <!-- System Status -->
      <div v-if="activeTab === 'system'">
        <div class="section-title">系统状态</div>
        <div class="sys-grid">
          <el-card class="sys-card">
            <div class="sys-label">Gateway 连接数</div>
            <div class="sys-value primary">{{ runningCount }}</div>
            <div class="sys-sub">实时 WebSocket 连接</div>
          </el-card>
          <el-card class="sys-card">
            <div class="sys-label">在线 Agent</div>
            <div class="sys-value success">{{ onlineCount }}</div>
            <div class="sys-sub">当前活跃</div>
          </el-card>
          <el-card class="sys-card">
            <div class="sys-label">空闲 Agent</div>
            <div class="sys-value warning">{{ idleCount }}</div>
            <div class="sys-sub">等待任务</div>
          </el-card>
          <el-card class="sys-card">
            <div class="sys-label">异常 Agent</div>
            <div class="sys-value danger">{{ errorCount }}</div>
            <div class="sys-sub">需关注</div>
          </el-card>
        </div>
        <div class="sys-chart-card">
          <div class="chart-header">
            <span class="chart-title">📊 24小时会话趋势</span>
          </div>
          <div class="chart-canvas">
            <canvas ref="trendChart" width="800" height="200"></canvas>
          </div>
        </div>
      </div>
    </div>

    <!-- Agent Detail Modal -->
    <el-dialog v-model="detailVisible" :title="selectedAgent?.name + ' - 详情'" width="600px">
      <template v-if="selectedAgent">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="Agent ID">{{ selectedAgent.id }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(selectedAgent.status)" effect="dark">{{ statusLabel(selectedAgent.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="角色">{{ selectedAgent.role }}</el-descriptions-item>
          <el-descriptions-item label="任务数">{{ selectedAgent.tasks }}</el-descriptions-item>
          <el-descriptions-item label="消息数" :span="2">{{ selectedAgent.messages }}</el-descriptions-item>
          <el-descriptions-item label="职责" :span="2">{{ selectedAgent.duty }}</el-descriptions-item>
          <el-descriptions-item label="当前工作" :span="2">{{ selectedAgent.currentTask }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

const activeTab = ref('agents')
const loading = ref(false)
const gatewayOnline = ref(false)
const lastUpdate = ref('')
const detailVisible = ref(false)
const selectedAgent = ref(null)
const trendChart = ref(null)

const AGENTS_DATA = [
  { id: 'pd',     name: 'PD',      emoji: '👔', role: '项目总监',     duty: '项目统筹、任务分发、进度管控、冲突解决',    status: 'running' },
  { id: 'pm',     name: 'PM',      emoji: '📋', role: '产品经理',     duty: '需求分析、PRD输出、需求澄清、验收标准制定',  status: 'idle' },
  { id: 'dev',    name: 'Dev',     emoji: '💻', role: '开发工程师',   duty: '代码开发、架构实现、接口编写、单元测试',     status: 'idle' },
  { id: 'dev-dq', name: '窦青',    emoji: '💻', role: 'Dev-DQ 开发工程师', duty: '代码开发、UI优化、技术支持',            status: 'idle' },
  { id: 'des',    name: 'Des',     emoji: '🎨', role: 'UI/UX设计师',  duty: '原型设计、UI视觉、交互规范、设计交付',      status: 'idle' },
  { id: 'qa',     name: 'QA',      emoji: '🧪', role: '测试工程师',   duty: '测试用例、功能测试、Bug提交、上线验收',      status: 'idle' },
  { id: 'ops',    name: 'Ops',     emoji: '🚀', role: '运维工程师',   duty: '环境部署、版本发布、服务监控、故障处理',      status: 'idle' },
  { id: 'xiaoai', name: '小爱',   emoji: '🤵', role: '秘书',         duty: '协调沟通、梳理进展、传达指令、汇总报告',      status: 'idle' },
]

const agentColors = {
  pd: '#DB61A2', pm: '#1F6FEB', dev: '#8957E5', 'dev-dq': '#DA3633',
  des: '#2EA043', qa: '#238636', ops: '#D29922', xiaoai: '#D29922'
}

let agents = ref([...AGENTS_DATA])
let sessionHistory = ref([])
let chartCtx = null

const runningCount = computed(() => agents.value.filter(a => a.status === 'running').length)
const onlineCount = computed(() => agents.value.filter(a => a.status === 'running').length)
const idleCount = computed(() => agents.value.filter(a => a.status === 'idle').length)
const errorCount = computed(() => agents.value.filter(a => a.status === 'error').length)

const todoTasks = computed(() => [
  { id: 1, title: 'AI 笔记第三轮测试', agentName: 'QA', agent: agents.value.find(a => a.id === 'qa') },
  { id: 2, title: '控制台 UI 优化', agentName: 'Des', agent: agents.value.find(a => a.id === 'des') },
])
const runningTasks = computed(() => [
  { id: 3, title: '控制台 Vue 重构', agentName: 'Dev', agent: agents.value.find(a => a.id === 'dev') },
])
const doneTasks = computed(() => [
  { id: 4, title: '控制台 Phase 1 开发', agentName: 'Dev', agent: agents.value.find(a => a.id === 'dev') },
])

function statusType(s) {
  return { running: 'success', idle: 'warning', error: 'danger', offline: 'info' }[s] || 'info'
}
function statusTagType(s) {
  return { running: 'success', idle: 'warning', error: 'danger', offline: 'info' }[s] || 'info'
}
function statusLabel(s) {
  return { running: '运行中', idle: '空闲', error: '异常', offline: '离线' }[s] || s
}

function showDetail(agent) {
  selectedAgent.value = agent
  detailVisible.value = true
}

async function fetchGatewayData() {
  try {
    const res = await fetch('/api/gateway-data')
    if (res.ok) {
      const data = await res.json()
      gatewayOnline.value = data.gatewayOnline !== false
      if (data.agents) {
        // Merge real data into AGENTS_DATA
        for (const s of data.agents) {
          const a = agents.value.find(x => x.id === s.agentId)
          if (a) {
            a.status = s.status || 'idle'
            a.tasks = s.tasks || 0
            a.messages = s.messages || 0
            a.currentTask = s.currentTask || '—'
          }
        }
        // Update history
        const now = new Date()
        sessionHistory.value.push({
          time: now,
          count: data.agents.filter(s => s.status === 'running').length
        })
        if (sessionHistory.value.length > 144) sessionHistory.value.shift()
      }
    }
  } catch (e) {
    gatewayOnline.value = false
  }
}

function drawChart() {
  if (!trendChart.value) return
  const canvas = trendChart.value
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)

  const hist = sessionHistory.value
  if (hist.length < 2) {
    ctx.fillStyle = '#8B949E'
    ctx.font = '14px PingFang SC'
    ctx.textAlign = 'center'
    ctx.fillText('数据不足，请等待一段时间后刷新', w / 2, h / 2)
    return
  }

  const max = Math.max(...hist.map(h => h.count), 1)
  const stepX = (w - 40) / Math.max(hist.length - 1, 1)
  const stepY = (h - 40) / max

  // Grid
  ctx.strokeStyle = '#30363D'
  ctx.lineWidth = 1
  for (let i = 0; i <= max; i++) {
    const y = h - 20 - i * stepY
    ctx.beginPath()
    ctx.moveTo(20, y)
    ctx.lineTo(w - 20, y)
    ctx.stroke()
    ctx.fillStyle = '#484F58'
    ctx.font = '10px PingFang SC'
    ctx.textAlign = 'right'
    ctx.fillText(i, 15, y + 3)
  }

  // Line
  ctx.strokeStyle = '#3FB950'
  ctx.lineWidth = 2
  ctx.beginPath()
  hist.forEach((h, i) => {
    const x = 20 + i * stepX
    const y = h - 20 - h.count * stepY
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.stroke()

  // Dots
  ctx.fillStyle = '#3FB950'
  hist.forEach((h, i) => {
    const x = 20 + i * stepX
    const y = h - 20 - h.count * stepY
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.fill()
  })
}

async function refresh() {
  loading.value = true
  await fetchGatewayData()
  lastUpdate.value = new Date().toLocaleTimeString('zh-CN')
  loading.value = false
  await nextTick()
  drawChart()
}

function onTabChange(tab) {
  if (tab === 'system') {
    nextTick(() => drawChart())
  }
}

let timer = null

onMounted(async () => {
  await refresh()
  timer = setInterval(() => fetchGatewayData(), 10000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0D1117; }

.cc-root {
  min-height: 100vh;
  background: #0D1117;
  color: #E6EDF3;
  font-family: 'PingFang SC', 'Microsoft YaHei', 'Inter', sans-serif;
}

.cc-header {
  background: #161B22;
  border-bottom: 1px solid #30363D;
  padding: 0 24px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 100;
}
.header-left { display: flex; align-items: center; gap: 10px; }
.logo-icon { font-size: 24px; }
.logo-text { font-size: 16px; font-weight: 700; color: #58A6FF; }
.header-right { display: flex; align-items: center; gap: 12px; }
.last-update { font-size: 12px; color: #484F58; }

.cc-tabs { padding: 0 24px; background: #161B22; }
.cc-tabs .el-tabs__header { margin-bottom: 0; }
.cc-tabs .el-tabs__nav-wrap::after { display: none; }
.cc-tabs .el-tabs__item { color: #8B949E; font-size: 14px; }
.cc-tabs .el-tabs__item.is-active { color: #58A6FF; }
.cc-tabs .el-tabs__active-bar { background-color: #58A6FF; }

.cc-content { max-width: 1400px; margin: 0 auto; padding: 20px 24px; }

.section-title { font-size: 15px; font-weight: 600; color: #E6EDF3; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
.section-sub { font-weight: 400; color: #484F58; font-size: 13px; }

/* Agent Grid */
.agent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
.agent-card { background: #161B22; border: 1px solid #30363D; border-radius: 12px; cursor: pointer; transition: all 0.2s; }
.agent-card:hover { border-color: #388BFD; transform: translateY(-2px); }
.agent-card.status-running { border-color: rgba(63,185,80,0.3); }
.agent-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
.agent-left { display: flex; align-items: center; gap: 10px; }
.agent-info { display: flex; flex-direction: column; }
.agent-name { font-size: 14px; font-weight: 600; color: #E6EDF3; }
.agent-role { font-size: 12px; color: #8B949E; }
.agent-stats { display: flex; gap: 16px; margin-bottom: 10px; }
.stat-item { display: flex; flex-direction: column; }
.stat-label { font-size: 10px; color: #484F58; text-transform: uppercase; }
.stat-value { font-size: 18px; font-weight: 700; color: #E6EDF3; }
.stat-value.success { color: #3FB950; }
.agent-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.agent-duty { font-size: 12px; color: #6E7681; line-height: 1.5; padding-top: 8px; border-top: 1px solid #21262D; }

/* Kanban */
.kanban-board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.kanban-col { background: #161B22; border: 1px solid #30363D; border-radius: 12px; overflow: hidden; }
.kanban-header { padding: 12px 16px; border-bottom: 1px solid #30363D; display: flex; justify-content: space-between; align-items: center; }
.kanban-title { font-size: 13px; font-weight: 600; }
.kanban-body { padding: 12px; min-height: 120px; }
.task-card { background: #0D1117; border: 1px solid #21262D; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; cursor: pointer; transition: border-color 0.15s; }
.task-card:hover { border-color: #388BFD; }
.task-card.running { border-left: 3px solid #D29922; }
.task-card.done { border-left: 3px solid #3FB950; opacity: 0.7; }
.task-title { font-size: 13px; font-weight: 500; color: #E6EDF3; margin-bottom: 6px; }
.task-meta { display: flex; justify-content: space-between; align-items: center; }
.task-assignee { font-size: 11px; color: #8B949E; }
.kanban-empty { text-align: center; color: #484F58; font-size: 13px; padding: 30px 0; }

/* System */
.sys-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
.sys-card { background: #161B22; border: 1px solid #30363D; border-radius: 12px; }
.sys-label { font-size: 11px; color: #484F58; text-transform: uppercase; margin-bottom: 8px; }
.sys-value { font-size: 32px; font-weight: 800; }
.sys-value.primary { color: #58A6FF; }
.sys-value.success { color: #3FB950; }
.sys-value.warning { color: #D29922; }
.sys-value.danger { color: #F85149; }
.sys-sub { font-size: 11px; color: #484F58; margin-top: 4px; }
.sys-chart-card { background: #161B22; border: 1px solid #30363D; border-radius: 12px; padding: 20px; }
.chart-header { margin-bottom: 16px; }
.chart-title { font-size: 14px; font-weight: 600; }
.chart-canvas { width: 100%; }

/* Modal */
.el-dialog { background: #161B22 !important; border: 1px solid #30363D; }
.el-dialog__header { border-bottom: 1px solid #30363D; }
.el-dialog__title { color: #E6EDF3 !important; }
.el-descriptions__label { color: #8B949E !important; background: #0D1117 !important; }
.el-descriptions__content { color: #E6EDF3 !important; background: #161B22 !important; }
</style>
