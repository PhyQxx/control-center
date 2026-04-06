<template>
  <div class="tasks-page">
    <!-- Page Header -->
    <div class="page-header">
      <div class="page-title-row">
        <span class="page-title">📋 任务看板</span>
        <el-tag size="small" type="info">v1.5</el-tag>
      </div>
      <div class="page-meta">
        <span class="last-refresh">刷新：{{ lastRefresh || '—' }}</span>
        <el-select v-model="filterAssignee" size="small" placeholder="全部成员" clearable style="width:130px">
          <el-option v-for="a in agentOptions" :key="a.id" :label="a.name" :value="a.id" />
        </el-select>
        <el-select v-model="filterPriority" size="small" placeholder="全部优先级" clearable style="width:120px">
          <el-option label="🔴 P0 高" value="P0" />
          <el-option label="🟡 P1 中" value="P1" />
          <el-option label="🔵 P2 低" value="P2" />
        </el-select>
        <el-button size="small" type="primary" @click="showNewTask = true">＋ 新建任务</el-button>
        <el-button size="small" @click="fetchTasks" :loading="loading">🔄 刷新</el-button>
      </div>
    </div>

    <!-- Summary Stats -->
    <div class="task-stats-row">
      <div class="task-stat stat-pending">
        <span class="stat-icon">📝</span>
        <span class="stat-num">{{ pendingTasks.length }}</span>
        <span class="stat-label">待处理</span>
      </div>
      <div class="task-stat stat-running">
        <span class="stat-icon">⚡</span>
        <span class="stat-num">{{ runningTasks.length }}</span>
        <span class="stat-label">进行中</span>
      </div>
      <div class="task-stat stat-blocked">
        <span class="stat-icon">🚫</span>
        <span class="stat-num">{{ blockedTasks.length }}</span>
        <span class="stat-label">已阻塞</span>
      </div>
      <div class="task-stat stat-done">
        <span class="stat-icon">✅</span>
        <span class="stat-num">{{ doneTasks.length }}</span>
        <span class="stat-label">已完成</span>
      </div>
    </div>

    <!-- Kanban Board -->
    <div v-if="loading" class="kanban-loading">
      <div v-for="i in 4" :key="i" class="skeleton-col pulse"></div>
    </div>

    <div v-else class="kanban-board">
      <!-- Column: Pending -->
      <div class="kanban-col">
        <div class="kanban-header">
          <span class="kanban-title">📝 待处理</span>
          <el-tag size="small" type="info">{{ filteredPending.length }}</el-tag>
        </div>
        <div
          class="kanban-body"
          @dragover.prevent="onDragOver($event, 'pending')"
          @drop="onDrop($event, 'pending')"
        >
          <TaskCard
            v-for="task in filteredPending"
            :key="task.id"
            :task="task"
            :expanded="expandedTasks.has(task.id)"
            draggable="true"
            @dragstart="onDragStart($event, task)"
            @click="toggleExpand(task.id)"
            @star="toggleStar(task)"
          >
            <template #actions="{ task: t }">
              <button class="tc-action-btn btn-accept" @click="changeStatus(t, 'accepted')">✅ 接受</button>
              <button class="tc-action-btn btn-assign" @click="openAssign(t)">👤 指派</button>
            </template>
          </TaskCard>
          <div v-if="filteredPending.length === 0" class="kanban-empty">暂无待处理任务</div>
        </div>
      </div>

      <!-- Column: In Progress -->
      <div class="kanban-col">
        <div class="kanban-header">
          <span class="kanban-title">⚡ 进行中</span>
          <el-tag size="small" type="warning">{{ filteredRunning.length }}</el-tag>
        </div>
        <div
          class="kanban-body"
          @dragover.prevent="onDragOver($event, 'running')"
          @drop="onDrop($event, 'running')"
        >
          <TaskCard
            v-for="task in filteredRunning"
            :key="task.id"
            :task="task"
            :expanded="expandedTasks.has(task.id)"
            draggable="true"
            @dragstart="onDragStart($event, task)"
            @click="toggleExpand(task.id)"
            @star="toggleStar(task)"
          >
            <template #actions="{ task: t }">
              <button class="tc-action-btn btn-complete" @click="changeStatus(t, 'completed')">✅ 完成</button>
              <button class="tc-action-btn btn-block" @click="changeStatus(t, 'blocked')">🚫 阻塞</button>
            </template>
          </TaskCard>
          <div v-if="filteredRunning.length === 0" class="kanban-empty">暂无进行中任务</div>
        </div>
      </div>

      <!-- Column: Blocked -->
      <div class="kanban-col">
        <div class="kanban-header">
          <span class="kanban-title">🚫 已阻塞</span>
          <el-tag size="small" type="danger">{{ filteredBlocked.length }}</el-tag>
        </div>
        <div
          class="kanban-body"
          @dragover.prevent="onDragOver($event, 'blocked')"
          @drop="onDrop($event, 'blocked')"
        >
          <TaskCard
            v-for="task in filteredBlocked"
            :key="task.id"
            :task="task"
            :expanded="expandedTasks.has(task.id)"
            draggable="true"
            @dragstart="onDragStart($event, task)"
            @click="toggleExpand(task.id)"
            @star="toggleStar(task)"
          >
            <template #actions="{ task: t }">
              <button class="tc-action-btn btn-resume" @click="changeStatus(t, 'running')">▶ 继续</button>
              <button class="tc-action-btn btn-assign" @click="openAssign(t)">👤 指派</button>
            </template>
          </TaskCard>
          <div v-if="filteredBlocked.length === 0" class="kanban-empty">暂无阻塞任务 ✅</div>
        </div>
      </div>

      <!-- Column: Completed -->
      <div class="kanban-col">
        <div class="kanban-header">
          <span class="kanban-title">✅ 已完成</span>
          <el-tag size="small" type="success">{{ filteredDone.length }}</el-tag>
        </div>
        <div
          class="kanban-body"
          @dragover.prevent="onDragOver($event, 'completed')"
          @drop="onDrop($event, 'completed')"
        >
          <TaskCard
            v-for="task in filteredDone"
            :key="task.id"
            :task="task"
            :expanded="expandedTasks.has(task.id)"
            @click="toggleExpand(task.id)"
            @star="toggleStar(task)"
          >
            <template #actions="{ task: t }">
              <button class="tc-action-btn btn-reopen" @click="changeStatus(t, 'pending')">🔄 重开</button>
              <button class="tc-action-btn btn-delete" @click="deleteTask(t)">🗑</button>
            </template>
          </TaskCard>
          <div v-if="filteredDone.length === 0" class="kanban-empty">暂无已完成任务</div>
        </div>
      </div>
    </div>

    <!-- New Task Dialog -->
    <el-dialog v-model="showNewTask" title="＋ 新建任务" width="520px">
      <el-form :model="newTaskForm" label-width="90px" :rules="taskRules" ref="newTaskFormRef">
        <el-form-item label="任务标题" prop="title">
          <el-input v-model="newTaskForm.title" placeholder="请输入任务标题" />
        </el-form-item>
        <el-form-item label="任务描述">
          <el-input v-model="newTaskForm.description" type="textarea" :rows="3" placeholder="可选：详细描述" />
        </el-form-item>
        <el-form-item label="负责人">
          <el-select v-model="newTaskForm.assigneeId" placeholder="选择负责人" clearable style="width:100%">
            <el-option v-for="a in agentOptions" :key="a.id" :label="a.emoji + ' ' + a.name" :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="newTaskForm.priority" placeholder="选择优先级" style="width:100%">
            <el-option label="🔴 P0 高" value="P0" />
            <el-option label="🟡 P1 中" value="P1" />
            <el-option label="🔵 P2 低" value="P2" />
          </el-select>
        </el-form-item>
        <el-form-item label="截止时间">
          <el-date-picker
            v-model="newTaskForm.deadline"
            type="datetime"
            placeholder="选择截止时间"
            style="width:100%"
            format="MM-DD HH:mm"
            value-format="YYYY-MM-DD HH:mm"
          />
        </el-form-item>
        <el-form-item label="关联Agent">
          <el-select v-model="newTaskForm.agentId" placeholder="关联的Agent" clearable style="width:100%">
            <el-option v-for="a in agentOptions" :key="a.id" :label="a.emoji + ' ' + a.name" :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <el-select v-model="newTaskForm.tags" multiple placeholder="选择标签" style="width:100%">
            <el-option label="🔴 Bug" value="Bug" />
            <el-option label="🆕 新功能" value="新功能" />
            <el-option label="⚡ 优化" value="优化" />
            <el-option label="📄 文档" value="文档" />
            <el-option label="🔒 安全" value="安全" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showNewTask = false">取消</el-button>
        <el-button type="primary" @click="createTask" :loading="saving">创建任务</el-button>
      </template>
    </el-dialog>

    <!-- Assign Dialog -->
    <el-dialog v-model="showAssign" title="👤 指派任务" width="400px">
      <div class="assign-agent-list">
        <div
          v-for="agent in agentOptions"
          :key="agent.id"
          class="assign-agent-item"
          :class="{ selected: assignToId === agent.id }"
          @click="assignToId = agent.id"
        >
          <el-avatar :size="32" :style="{ backgroundColor: agent.color }">{{ agent.emoji }}</el-avatar>
          <div class="assign-agent-info">
            <div class="assign-agent-name">{{ agent.name }}</div>
            <div class="assign-agent-role">{{ agent.role }}</div>
          </div>
          <span v-if="assignToId === agent.id" class="assign-check">✓</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="showAssign = false">取消</el-button>
        <el-button type="primary" @click="confirmAssign" :disabled="!assignToId">确认指派</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import TaskCard from './tasks/TaskCard.vue'

const loading = ref(false)
const saving = ref(false)
const lastRefresh = ref('')
const showNewTask = ref(false)
const showAssign = ref(false)
const assignToId = ref('')
const assignTargetTask = ref(null)
const expandedTasks = ref(new Set())
const newTaskFormRef = ref(null)
const draggingTask = ref(null)

const filterAssignee = ref('')
const filterPriority = ref('')

const newTaskForm = ref({
  title: '',
  description: '',
  assigneeId: '',
  priority: 'P1',
  deadline: '',
  agentId: '',
  tags: [],
})

const taskRules = {
  title: [{ required: true, message: '请输入任务标题', trigger: 'blur' }],
}

const AGENT_OPTIONS = [
  { id: 'pd',     name: 'PD',      emoji: '👔', role: '项目总监',    color: '#DB61A2' },
  { id: 'pm',     name: 'PM',      emoji: '📋', role: '产品经理',    color: '#1F6FEB' },
  { id: 'dev',    name: 'Dev',     emoji: '💻', role: '开发工程师',  color: '#8957E5' },
  { id: 'dev-dq', name: '窦青',    emoji: '💻', role: '开发工程师',  color: '#DA3633' },
  { id: 'des',    name: 'Des',     emoji: '🎨', role: 'UI/UX设计师', color: '#2EA043' },
  { id: 'qa',     name: 'QA',      emoji: '🧪', role: '测试工程师',  color: '#238636' },
  { id: 'ops',    name: 'Ops',     emoji: '🚀', role: '运维工程师',  color: '#D29922' },
  { id: 'xiaoai', name: '小爱',    emoji: '🤵', role: '秘书',        color: '#D29922' },
]

const agentOptions = AGENT_OPTIONS

// ─── Task Data ───────────────────────────────────────────────────────────────
const tasks = ref([])

// Demo seed data
function seedTasks() {
  return [
    {
      id: 'TSK-001', title: '完成 Hall 协作模块 Phase3 交接流程', description: '实现 agent 间的任务交接（handoff）机制，支持确认/拒绝流程',
      assigneeId: 'dev', assigneeName: 'Dev', status: 'running', priority: 'P0',
      deadline: '04-07 18:00', agentId: 'dev', agentName: 'Dev',
      tags: ['新功能'], starred: false, createdAt: '2026-04-06 08:00',
    },
    {
      id: 'TSK-002', title: '控制台三模块 UI 设计评审', description: '由 Des 输出 Hall / Tasks / Settings 的高保真原型',
      assigneeId: 'des', assigneeName: 'Des', status: 'pending', priority: 'P0',
      deadline: '04-08 12:00', agentId: 'des', agentName: 'Des',
      tags: ['新功能'], starred: true, createdAt: '2026-04-06 09:00',
    },
    {
      id: 'TSK-003', title: 'Tasks 模块后端 API 设计与实现', description: '基于 console-v1.5-prd.md 实现 Tasks 5张表的 CRUD API',
      assigneeId: 'dev', assigneeName: 'Dev', status: 'pending', priority: 'P1',
      deadline: '04-10 18:00', agentId: 'dev', agentName: 'Dev',
      tags: ['新功能'], starred: false, createdAt: '2026-04-06 09:30',
    },
    {
      id: 'TSK-004', title: 'SOP M3 Bug 修复验收测试', description: '商城 price 字段和排行榜无参数 403 两个 Bug 的回归测试',
      assigneeId: 'qa', assigneeName: 'QA', status: 'completed', priority: 'P0',
      deadline: '04-06 17:00', agentId: 'qa', agentName: 'QA',
      tags: ['Bug'], starred: false, createdAt: '2026-04-06 07:00',
    },
    {
      id: 'TSK-005', title: 'Settings 模块安全风险评估', description: '检查 Gateway 暴露端口、Token 存储等安全隐患并输出报告',
      assigneeId: 'ops', assigneeName: 'Ops', status: 'blocked', priority: 'P1',
      deadline: '04-09 18:00', agentId: 'ops', agentName: 'Ops',
      tags: ['安全'], starred: false, createdAt: '2026-04-06 10:00',
    },
    {
      id: 'TSK-006', title: '控制台 PRD v1.5 文档输出', description: '输出 Hall / Tasks / Settings 三模块完整 PRD',
      assigneeId: 'pm', assigneeName: 'PM', status: 'completed', priority: 'P0',
      deadline: '04-06 12:00', agentId: 'pm', agentName: 'PM',
      tags: ['文档'], starred: false, createdAt: '2026-04-05 18:00',
    },
    {
      id: 'TSK-007', title: 'Gateway 健康检查接口联调', description: '对接 /api/health 接口，确保连接状态实时准确',
      assigneeId: 'ops', assigneeName: 'Ops', status: 'pending', priority: 'P2',
      deadline: '04-12 18:00', agentId: 'ops', agentName: 'Ops',
      tags: ['优化'], starred: false, createdAt: '2026-04-06 11:00',
    },
  ]
}

async function fetchTasks() {
  loading.value = true
  try {
    const res = await fetch('/api/tasks')
    if (res.ok) {
      const data = await res.json()
      if (data.tasks) tasks.value = data.tasks
      else tasks.value = seedTasks()
    } else {
      tasks.value = seedTasks()
    }
  } catch (e) {
    tasks.value = seedTasks()
  }
  lastRefresh.value = new Date().toLocaleTimeString('zh-CN')
  loading.value = false
}

// ─── Computed ────────────────────────────────────────────────────────────────
function filterTasks(list) {
  let result = list
  if (filterAssignee.value) result = result.filter(t => t.assigneeId === filterAssignee.value)
  if (filterPriority.value) result = result.filter(t => t.priority === filterPriority.value)
  return result
}

const pendingTasks = computed(() => tasks.value.filter(t => t.status === 'pending'))
const runningTasks = computed(() => tasks.value.filter(t => t.status === 'running'))
const blockedTasks = computed(() => tasks.value.filter(t => t.status === 'blocked'))
const doneTasks = computed(() => tasks.value.filter(t => t.status === 'completed'))

const filteredPending = computed(() => filterTasks(pendingTasks.value))
const filteredRunning = computed(() => filterTasks(runningTasks.value))
const filteredBlocked = computed(() => filterTasks(blockedTasks.value))
const filteredDone = computed(() => filterTasks(doneTasks.value))

// ─── Actions ────────────────────────────────────────────────────────────────
function toggleExpand(taskId) {
  if (expandedTasks.value.has(taskId)) expandedTasks.value.delete(taskId)
  else expandedTasks.value.add(taskId)
  expandedTasks.value = new Set(expandedTasks.value)
}

async function changeStatus(task, newStatus) {
  const oldStatus = task.status
  task.status = newStatus
  // Move in list
  tasks.value = [...tasks.value]
  try {
    await fetch(`/api/tasks/${task.id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
  } catch (e) {}
  ElMessage.success(`任务 "${task.title}" 已移至 ${STATUS_LABELS[newStatus]}`)
}

function openAssign(task) {
  assignTargetTask.value = task
  assignToId.value = task.assigneeId || ''
  showAssign.value = true
}

async function confirmAssign() {
  if (!assignTargetTask.value || !assignToId.value) return
  const agent = AGENT_OPTIONS.find(a => a.id === assignToId.value)
  if (!agent) return
  assignTargetTask.value.assigneeId = assignToId.value
  assignTargetTask.value.assigneeName = agent.name
  tasks.value = [...tasks.value]
  showAssign.value = false
  try {
    await fetch(`/api/tasks/${assignTargetTask.value.id}/assign`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigneeId: assignToId.value }),
    })
  } catch (e) {}
  ElMessage.success(`已指派给 ${agent.name}`)
}

async function toggleStar(task) {
  task.starred = !task.starred
  tasks.value = [...tasks.value]
  ElMessage.info(task.starred ? '已收藏 ⭐' : '已取消收藏')
}

async function deleteTask(task) {
  tasks.value = tasks.value.filter(t => t.id !== task.id)
  try {
    await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
  } catch (e) {}
  ElMessage.success('任务已删除')
}

async function createTask() {
  newTaskFormRef.value?.validate(async (valid) => {
    if (!valid) return
    saving.value = true
    const assignee = AGENT_OPTIONS.find(a => a.id === newTaskForm.value.assigneeId)
    const task = {
      id: 'TSK-' + String(Date.now()).slice(-6),
      title: newTaskForm.value.title,
      description: newTaskForm.value.description,
      assigneeId: newTaskForm.value.assigneeId || '',
      assigneeName: assignee ? assignee.name : '',
      status: 'pending',
      priority: newTaskForm.value.priority || 'P1',
      deadline: newTaskForm.value.deadline || '',
      agentId: newTaskForm.value.agentId || '',
      agentName: assignee ? assignee.name : '',
      tags: newTaskForm.value.tags || [],
      starred: false,
      createdAt: new Date().toISOString(),
    }
    tasks.value = [...tasks.value, task]
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      })
    } catch (e) {}
    showNewTask.value = false
    newTaskForm.value = { title: '', description: '', assigneeId: '', priority: 'P1', deadline: '', agentId: '', tags: [] }
    ElMessage.success('任务已创建')
    saving.value = false
  })
}

const STATUS_LABELS = {
  pending: '待处理', accepted: '已接受', running: '进行中',
  blocked: '已阻塞', completed: '已完成', rejected: '已拒绝',
}

// ─── Drag & Drop ─────────────────────────────────────────────────────────────
function onDragStart(event, task) {
  draggingTask.value = task
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', task.id)
}

function onDragOver(event, column) {
  event.dataTransfer.dropEffect = 'move'
}

async function onDrop(event, targetColumn) {
  if (!draggingTask.value) return
  const task = draggingTask.value
  if (task.status === targetColumn) {
    draggingTask.value = null
    return
  }
  await changeStatus(task, targetColumn)
  draggingTask.value = null
}

onMounted(() => fetchTasks())
</script>

<style scoped>
.tasks-page {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

/* Page Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 10px;
}
.page-title-row { display: flex; align-items: center; gap: 10px; }
.page-title { font-size: 16px; font-weight: 700; color: #e2e8f0; }
.page-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.last-refresh { font-size: 12px; color: #484f58; }

/* Task Stats */
.task-stats-row {
  display: flex;
  gap: 14px;
  margin-bottom: 16px;
}
.task-stat {
  flex: 1;
  background: #1a1a2e;
  border: 1px solid #2d2d45;
  border-radius: 10px;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.stat-icon { font-size: 20px; }
.stat-num { font-size: 24px; font-weight: 800; color: #e2e8f0; line-height: 1; }
.stat-label { font-size: 12px; color: #6e7681; }

/* Kanban */
.kanban-board {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  align-items: flex-start;
}
.kanban-col {
  background: #161b22;
  border: 1px solid #2d2d45;
  border-radius: 12px;
  overflow: hidden;
  min-height: 300px;
}
.kanban-header {
  padding: 12px 14px;
  border-bottom: 1px solid #2d2d45;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1a1a2e;
}
.kanban-title { font-size: 13px; font-weight: 700; color: #e2e8f0; }
.kanban-body {
  padding: 10px;
  min-height: 200px;
  transition: background 0.15s;
}
.kanban-body:empty,
.kanban-body:not(:has(.task-card)) {
  background: transparent;
}
.kanban-body:not(:has(.task-card)):hover {
  background: rgba(99,102,241,0.04);
}
.kanban-empty {
  text-align: center;
  color: #484f58;
  font-size: 12px;
  padding: 32px 0;
}

/* Loading skeleton */
.kanban-loading {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.skeleton-col {
  height: 300px;
  background: #1a1a2e;
  border-radius: 12px;
  border: 1px solid #2d2d45;
}
@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
.pulse { animation: pulse 1.5s infinite; }

/* Task Card action buttons */
:deep(.tc-action-btn) {
  padding: 3px 8px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid #2d2d45;
  cursor: pointer;
  transition: all 0.15s;
}
:deep(.btn-accept) { background: rgba(34,197,94,0.12); color: #22c55e; border-color: rgba(34,197,94,0.3); }
:deep(.btn-accept:hover) { background: rgba(34,197,94,0.2); }
:deep(.btn-assign) { background: rgba(99,102,241,0.12); color: #818cf8; border-color: rgba(99,102,241,0.3); }
:deep(.btn-assign:hover) { background: rgba(99,102,241,0.2); }
:deep(.btn-complete) { background: rgba(34,197,94,0.12); color: #22c55e; border-color: rgba(34,197,94,0.3); }
:deep(.btn-complete:hover) { background: rgba(34,197,94,0.2); }
:deep(.btn-block) { background: rgba(239,68,68,0.1); color: #ef4444; border-color: rgba(239,68,68,0.3); }
:deep(.btn-block:hover) { background: rgba(239,68,68,0.18); }
:deep(.btn-resume) { background: rgba(234,179,8,0.12); color: #eab308; border-color: rgba(234,179,8,0.3); }
:deep(.btn-resume:hover) { background: rgba(234,179,8,0.2); }
:deep(.btn-reopen) { background: rgba(99,102,241,0.12); color: #818cf8; border-color: rgba(99,102,241,0.3); }
:deep(.btn-reopen:hover) { background: rgba(99,102,241,0.2); }
:deep(.btn-delete) { background: rgba(239,68,68,0.1); color: #ef4444; border-color: rgba(239,68,68,0.3); }
:deep(.btn-delete:hover) { background: rgba(239,68,68,0.18); }

/* Assign Dialog */
.assign-agent-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.assign-agent-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid #2d2d45;
  cursor: pointer;
  transition: all 0.15s;
}
.assign-agent-item:hover { border-color: #6366f1; background: rgba(99,102,241,0.06); }
.assign-agent-item.selected { border-color: #6366f1; background: rgba(99,102,241,0.1); }
.assign-agent-info { flex: 1; }
.assign-agent-name { font-size: 13px; font-weight: 600; color: #e2e8f0; }
.assign-agent-role { font-size: 11px; color: #6e7681; }
.assign-check { color: #6366f1; font-weight: 700; font-size: 16px; }
</style>
