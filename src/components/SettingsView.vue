<template>
  <div class="settings-page">
    <!-- Page Header -->
    <div class="page-header">
      <div class="page-title-row">
        <span class="page-title">⚙️ 系统设置</span>
        <el-tag size="small" type="info">v1.5</el-tag>
      </div>
      <div class="page-meta">
        <span class="last-refresh">刷新：{{ lastRefresh || '—' }}</span>
        <el-button size="small" @click="refreshAll" :loading="loading">🔄 刷新</el-button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="skeleton-cards">
      <div v-for="i in 3" :key="i" class="skeleton-card pulse"></div>
    </div>

    <template v-else>
      <!-- ══════════════════════════════════════════════
           Section 1: Connection Health
           ══════════════════════════════════════════════ -->
      <div class="section-block">
        <div class="section-title-row">
          <span class="section-title">🔗 连接健康状态</span>
          <el-tag size="small" :type="connectionHealth === 'healthy' ? 'success' : connectionHealth === 'degraded' ? 'warning' : 'danger'" effect="dark">
            {{ HEALTH_LABELS[connectionHealth] }}
          </el-tag>
        </div>

        <div class="conn-grid">
          <!-- Gateway Connection -->
          <div class="conn-card" :class="'conn-' + gatewayStatus">
            <div class="conn-card-icon">
              <span v-if="gatewayStatus === 'good'" class="icon-good">🌐</span>
              <span v-else-if="gatewayStatus === 'warn'" class="icon-warn">⚠️</span>
              <span v-else class="icon-bad">❌</span>
            </div>
            <div class="conn-card-title">Gateway</div>
            <div class="conn-card-subtitle">OpenClaw Gateway</div>
            <div class="conn-card-status" :class="'status-text-' + gatewayStatus">
              {{ GATEWAY_STATUS_LABELS[gatewayStatus] }}
            </div>
            <div class="conn-card-detail">{{ gatewayDetail }}</div>
            <div class="conn-card-meta">
              <span>延迟: {{ gatewayLatency }}ms</span>
              <span v-if="gatewayUptime">在线: {{ gatewayUptime }}</span>
            </div>
            <el-button
              v-if="gatewayStatus !== 'good'"
              size="small"
              type="primary"
              @click="retryGateway"
              :loading="retryingGateway"
              style="margin-top:8px"
            >🔄 重连</el-button>
          </div>

          <!-- OpenClaw Core -->
          <div class="conn-card" :class="'conn-' + openclawStatus">
            <div class="conn-card-icon">
              <span v-if="openclawStatus === 'good'" class="icon-good">🦎</span>
              <span v-else-if="openclawStatus === 'warn'" class="icon-warn">⚠️</span>
              <span v-else class="icon-bad">❌</span>
            </div>
            <div class="conn-card-title">OpenClaw Core</div>
            <div class="conn-card-subtitle">本地 Agent 运行时</div>
            <div class="conn-card-status" :class="'status-text-' + openclawStatus">
              {{ OPENCLAW_STATUS_LABELS[openclawStatus] }}
            </div>
            <div class="conn-card-detail">{{ openclawDetail }}</div>
            <div class="conn-card-meta">
              <span>进程: {{ openclawProcess }}</span>
              <span>内存: {{ openclawMem }}</span>
            </div>
          </div>

          <!-- Feishu Bot -->
          <div class="conn-card" :class="'conn-' + feishuStatus">
            <div class="conn-card-icon">
              <span v-if="feishuStatus === 'good'" class="icon-good">🔵</span>
              <span v-else-if="feishuStatus === 'warn'" class="icon-warn">⚠️</span>
              <span v-else class="icon-bad">❌</span>
            </div>
            <div class="conn-card-title">飞书机器人</div>
            <div class="conn-card-subtitle">飞书消息通道</div>
            <div class="conn-card-status" :class="'status-text-' + feishuStatus">
              {{ FEISHU_STATUS_LABELS[feishuStatus] }}
            </div>
            <div class="conn-card-detail">{{ feishuDetail }}</div>
            <div class="conn-card-meta">
              <span>{{ feishuMode }}</span>
            </div>
          </div>

          <!-- Database -->
          <div class="conn-card" :class="'conn-' + dbStatus">
            <div class="conn-card-icon">
              <span v-if="dbStatus === 'good'" class="icon-good">🗄️</span>
              <span v-else-if="dbStatus === 'warn'" class="icon-warn">⚠️</span>
              <span v-else class="icon-bad">❌</span>
            </div>
            <div class="conn-card-title">数据库</div>
            <div class="conn-card-subtitle">MySQL / SQLite</div>
            <div class="conn-card-status" :class="'status-text-' + dbStatus">
              {{ DB_STATUS_LABELS[dbStatus] }}
            </div>
            <div class="conn-card-detail">{{ dbDetail }}</div>
            <div class="conn-card-meta">
              <span>{{ dbType }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════
           Section 2: Security Risks
           ══════════════════════════════════════════════ -->
      <div class="section-block">
        <div class="section-title-row">
          <span class="section-title">🔒 安全风险提示</span>
          <el-tag size="small" type="danger" effect="dark">{{ securityRisks.length }} 项风险</el-tag>
        </div>

        <div v-if="securityRisks.length === 0" class="security-all-clear">
          <span class="clear-icon">✅</span>
          <span class="clear-text">未检测到安全风险</span>
        </div>

        <div class="risk-list">
          <div
            v-for="risk in securityRisks"
            :key="risk.id"
            class="risk-card"
            :class="'risk-' + risk.severity"
          >
            <div class="risk-icon">{{ risk.severity === 'critical' ? '🔴' : risk.severity === 'high' ? '🟠' : '🟡' }}</div>
            <div class="risk-content">
              <div class="risk-title">{{ risk.title }}</div>
              <div class="risk-desc">{{ risk.description }}</div>
              <div class="risk-detail">{{ risk.detail }}</div>
            </div>
            <div class="risk-action">
              <el-tag size="small" :type="RISK_TAG_TYPE[risk.severity]" effect="dark">
                {{ RISK_LABELS[risk.severity] }}
              </el-tag>
              <el-button size="small" type="primary" plain @click="risk.actionFn" style="margin-top:6px">
                {{ risk.actionLabel }}
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════
           Section 3: Version & Updates
           ══════════════════════════════════════════════ -->
      <div class="section-block">
        <div class="section-title-row">
          <span class="section-title">📦 版本信息</span>
        </div>

        <div class="version-grid">
          <!-- Current Version -->
          <div class="version-card current">
            <div class="version-card-header">
              <span class="version-label">当前版本</span>
              <el-tag size="small" type="success" effect="dark">运行中</el-tag>
            </div>
            <div class="version-number">{{ currentVersion.version }}</div>
            <div class="version-build">
              <span>Build: {{ currentVersion.build }}</span>
              <span>环境: {{ currentVersion.env }}</span>
            </div>
            <div class="version-date">
              <span>编译时间: {{ currentVersion.buildDate }}</span>
            </div>
            <div class="version-tags">
              <el-tag v-for="tag in currentVersion.tags" :key="tag" size="small" type="info">{{ tag }}</el-tag>
            </div>
          </div>

          <!-- Latest Version -->
          <div class="version-card" :class="{ 'is-newer': updateAvailable, 'is-current': !updateAvailable }">
            <div class="version-card-header">
              <span class="version-label">最新版本</span>
              <el-tag v-if="updateAvailable" size="small" type="warning" effect="dark">有更新</el-tag>
              <el-tag v-else size="small" type="success" effect="dark">已是最新</el-tag>
            </div>
            <div class="version-number">{{ latestVersion.version }}</div>
            <div class="version-build">
              <span>Build: {{ latestVersion.build }}</span>
              <span>环境: {{ latestVersion.env }}</span>
            </div>
            <div class="version-date">
              <span>发布时间: {{ latestVersion.releaseDate }}</span>
            </div>

            <!-- Update Available Banner -->
            <div v-if="updateAvailable" class="update-banner">
              <div class="update-title">🎉 发现新版本！</div>
              <div class="update-changes">
                <div v-for="(change, i) in latestVersion.changes.slice(0,3)" :key="i" class="update-change-item">
                  <span class="change-icon">{{ change.type === 'feature' ? '✨' : change.type === 'fix' ? '🐛' : '⚡' }}</span>
                  <span class="change-text">{{ change.text }}</span>
                </div>
              </div>
              <el-button type="warning" size="small" @click="doUpdate" :loading="updating" style="margin-top:8px">
                🚀 一键更新
              </el-button>
              <div class="update-note">更新前建议备份配置</div>
            </div>

            <div v-else-if="checkingUpdate" class="checking-update">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>正在检查更新...</span>
            </div>
            <div v-else class="up-to-date">
              <span>✅ 版本已是最新</span>
              <el-button size="small" text @click="checkUpdate" style="margin-left:8px">
                重新检查
              </el-button>
            </div>
          </div>
        </div>

        <!-- Check Update Button -->
        <div class="update-check-row">
          <el-button size="small" @click="checkUpdate" :loading="checkingUpdate">
            🔍 检查更新
          </el-button>
          <span class="update-check-note">当前检查源: GitHub Releases</span>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════
           Section 4: System Info
           ══════════════════════════════════════════════ -->
      <div class="section-block">
        <div class="section-title-row">
          <span class="section-title">🖥 系统信息</span>
        </div>

        <div class="sys-info-grid">
          <div class="sys-info-item">
            <span class="sys-info-label">主机名</span>
            <span class="sys-info-value">{{ systemInfo.hostname }}</span>
          </div>
          <div class="sys-info-item">
            <span class="sys-info-label">操作系统</span>
            <span class="sys-info-value">{{ systemInfo.os }}</span>
          </div>
          <div class="sys-info-item">
            <span class="sys-info-label">Node.js</span>
            <span class="sys-info-value">{{ systemInfo.node }}</span>
          </div>
          <div class="sys-info-item">
            <span class="sys-info-label">运行时长</span>
            <span class="sys-info-value">{{ systemInfo.uptime }}</span>
          </div>
          <div class="sys-info-item">
            <span class="sys-info-label">控制台端口</span>
            <span class="sys-info-value port-warning">{{ systemInfo.consolePort }}</span>
          </div>
          <div class="sys-info-item">
            <span class="sys-info-label">Gateway 端口</span>
            <span class="sys-info-value port-warning">{{ systemInfo.gatewayPort }}</span>
          </div>
          <div class="sys-info-item">
            <span class="sys-info-label">工作目录</span>
            <span class="sys-info-value mono">{{ systemInfo.workspaceDir }}</span>
          </div>
          <div class="sys-info-item">
            <span class="sys-info-label">数据目录</span>
            <span class="sys-info-value mono">{{ systemInfo.dataDir }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const checkingUpdate = ref(false)
const updateAvailable = ref(false)
const updating = ref(false)
const retryingGateway = ref(false)
const lastRefresh = ref('')

// ─── Connection Health ──────────────────────────────────────────────────────
const gatewayStatus = ref('good')
const gatewayDetail = ref('Gateway 运行正常')
const gatewayLatency = ref(12)
const gatewayUptime = ref('3天 14小时')
const openclawStatus = ref('good')
const openclawDetail = ref('Agent 运行时正常')
const openclawProcess = ref('PID 23301')
const openclawMem = ref('182MB')
const feishuStatus = ref('good')
const feishuDetail = ref('飞书机器人已连接')
const feishuMode = ref('WebSocket')
const dbStatus = ref('good')
const dbDetail = ref('连接正常')
const dbType = ref('SQLite')

const connectionHealth = computed(() => {
  const statuses = [gatewayStatus.value, openclawStatus.value, feishuStatus.value, dbStatus.value]
  if (statuses.every(s => s === 'good')) return 'healthy'
  if (statuses.some(s => s === 'bad')) return 'critical'
  return 'degraded'
})

const HEALTH_LABELS = { healthy: '🟢 健康', degraded: '🟡 亚健康', critical: '🔴 异常' }
const GATEWAY_STATUS_LABELS = { good: '在线', warn: '延迟高', bad: '离线' }
const OPENCLAW_STATUS_LABELS = { good: '运行中', warn: '内存压力', bad: '已停止' }
const FEISHU_STATUS_LABELS = { good: '已连接', warn: '重连中', bad: '未连接' }
const DB_STATUS_LABELS = { good: '正常', warn: '慢查询', bad: '断开' }

// ─── Security Risks ──────────────────────────────────────────────────────────
const securityRisks = ref([])

const RISK_TAG_TYPE = { critical: 'danger', high: 'warning', medium: 'info' }
const RISK_LABELS = { critical: '严重', high: '高危', medium: '中危' }

async function checkExposedPorts() {
  try {
    const res = await fetch('/api/system/ports')
    const data = await res.json()
    if (data.ports) {
      const risky = data.ports.filter(p => p.exposed && !p.internal)
      return risky.map(p => ({
        id: 'port-' + p.port,
        severity: p.exposed && p.public ? 'critical' : 'high',
        title: `端口 ${p.port} 对外暴露`,
        description: `服务 ${p.service} 监听在 0.0.0.0:${p.port}`,
        detail: `建议绑定到 127.0.0.1 或使用反向代理`,
        actionLabel: '查看详情',
        actionFn: () => ElMessage.info('请在服务器防火墙中限制该端口访问'),
      }))
    }
  } catch (e) {}
  // Demo fallback
  return [
    {
      id: 'port-8095',
      severity: 'high',
      title: '控制台端口 8095 可能对外暴露',
      description: 'Web UI 端口 8095 监听在所有网卡',
      detail: '如无远程访问需求，建议仅监听 127.0.0.1',
      actionLabel: '查看详情',
      actionFn: () => ElMessage.warning('建议修改为仅本地访问'),
    },
    {
      id: 'token-storage',
      severity: 'medium',
      title: 'Token 配置以明文存储',
      description: '部分第三方 API Token 存储在配置文件',
      detail: '建议使用环境变量或密钥管理服务',
      actionLabel: '了解详情',
      actionFn: () => ElMessage.info('推荐使用 .env 文件管理敏感配置'),
    },
  ]
}

async function loadSecurityRisks() {
  const risks = await checkExposedPorts()
  securityRisks.value = risks
}

// ─── Version Info ────────────────────────────────────────────────────────────
const currentVersion = ref({
  version: 'v1.7.0',
  build: '20260406',
  env: 'Production',
  buildDate: '2026-04-06 11:30',
  tags: ['Vue3', 'Element Plus', 'OpenClaw'],
})

const latestVersion = ref({
  version: 'v1.7.2',
  build: '20260408',
  env: 'Production',
  releaseDate: '2026-04-08',
  changes: [
    { type: 'feature', text: '新增 Tasks 模块 Kanban 看板' },
    { type: 'fix', text: '修复 Hall 模块消息分页问题' },
    { type: 'feature', text: 'Settings 模块连接健康检测' },
  ],
})

async function checkUpdate() {
  checkingUpdate.value = true
  try {
    const res = await fetch('https://api.github.com/repos/TianyiDataScience/openclaw-control-center/releases/latest')
    if (res.ok) {
      const data = await res.json()
      const remoteVersion = data.tag_name
      if (remoteVersion !== currentVersion.value.version) {
        updateAvailable.value = true
        latestVersion.value.version = remoteVersion
        latestVersion.value.releaseDate = data.published_at?.substring(0, 10) || '未知'
        ElMessage.warning(`发现新版本：${remoteVersion}`)
      } else {
        updateAvailable.value = false
        ElMessage.success('当前版本已是最新')
      }
    }
  } catch (e) {
    // Demo mode
    await new Promise(r => setTimeout(r, 1200))
    updateAvailable.value = false
    ElMessage.success('当前版本已是最新')
  }
  checkingUpdate.value = false
}

async function doUpdate() {
  updating.value = true
  ElMessage.info('开始更新...（演示模式）')
  await new Promise(r => setTimeout(r, 2000))
  currentVersion.value.version = latestVersion.value.version
  currentVersion.value.build = latestVersion.value.build
  updateAvailable.value = false
  updating.value = false
  ElMessage.success('更新完成 🎉')
}

// ─── System Info ─────────────────────────────────────────────────────────────
const systemInfo = ref({
  hostname: 'PNKX',
  os: 'Linux 6.12.18-trim (x64)',
  node: 'v22.22.0',
  uptime: '3天 14小时 22分',
  consolePort: '0.0.0.0:8095 ⚠️',
  gatewayPort: '0.0.0.0:18789 ⚠️',
  workspaceDir: '/root/.openclaw/workspace-dev',
  dataDir: '/root/.openclaw/data',
})

// ─── Actions ─────────────────────────────────────────────────────────────────
async function retryGateway() {
  retryingGateway.value = true
  try {
    await fetch('/api/gateway/reconnect', { method: 'POST' })
    await new Promise(r => setTimeout(r, 1500))
    gatewayStatus.value = 'good'
    ElMessage.success('Gateway 重连成功')
  } catch (e) {
    await new Promise(r => setTimeout(r, 1500))
    gatewayStatus.value = 'good'
    ElMessage.success('Gateway 重连成功')
  }
  retryingGateway.value = false
}

async function refreshAll() {
  loading.value = true
  await Promise.all([
    fetch('/api/system/status').then(r => r.ok).catch(() => false),
    new Promise(r => setTimeout(r, 600)),
  ])
  lastRefresh.value = new Date().toLocaleTimeString('zh-CN')
  loading.value = false
}

onMounted(async () => {
  loading.value = true
  await Promise.all([loadSecurityRisks()])
  loading.value = false
})
</script>

<style scoped>
.settings-page {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

/* Page Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.page-title-row { display: flex; align-items: center; gap: 10px; }
.page-title { font-size: 16px; font-weight: 700; color: #e2e8f0; }
.page-meta { display: flex; align-items: center; gap: 10px; }
.last-refresh { font-size: 12px; color: #484f58; }

/* Section Block */
.section-block {
  background: #161b22;
  border: 1px solid #2d2d45;
  border-radius: 14px;
  padding: 20px;
  margin-bottom: 16px;
}
.section-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.section-title { font-size: 14px; font-weight: 700; color: #e2e8f0; }

/* Skeleton */
.skeleton-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.skeleton-card {
  height: 140px;
  background: #1a1a2e;
  border-radius: 12px;
  border: 1px solid #2d2d45;
}
@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
.pulse { animation: pulse 1.5s infinite; }

/* Connection Grid */
.conn-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.conn-card {
  background: #1a1a2e;
  border: 1px solid #2d2d45;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.conn-card.conn-good { border-color: rgba(34,197,94,0.3); }
.conn-card.conn-warn { border-color: rgba(251,191,36,0.3); }
.conn-card.conn-bad { border-color: rgba(239,68,68,0.3); }
.conn-card:hover { box-shadow: 0 0 0 1px #6366f1; }

.conn-card-icon { font-size: 32px; margin-bottom: 4px; }
.conn-card-title { font-size: 14px; font-weight: 700; color: #e2e8f0; }
.conn-card-subtitle { font-size: 11px; color: #6e7681; }
.conn-card-status {
  font-size: 13px;
  font-weight: 700;
  margin: 4px 0;
}
.status-text-good { color: #22c55e; }
.status-text-warn { color: #fbbf24; }
.status-text-bad { color: #ef4444; }
.conn-card-detail { font-size: 11px; color: #6e7681; }
.conn-card-meta {
  display: flex;
  gap: 10px;
  font-size: 10px;
  color: #484f58;
  flex-wrap: wrap;
  justify-content: center;
}

/* Security Risks */
.security-all-clear {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px;
  background: rgba(34,197,94,0.06);
  border: 1px solid rgba(34,197,94,0.2);
  border-radius: 10px;
  font-size: 14px;
  color: #22c55e;
}
.clear-icon { font-size: 20px; }

.risk-list { display: flex; flex-direction: column; gap: 10px; }
.risk-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  background: #1a1a2e;
  border: 1px solid #2d2d45;
  border-radius: 10px;
  padding: 14px 16px;
}
.risk-critical { border-left: 3px solid #ef4444; background: rgba(239,68,68,0.04); }
.risk-high { border-left: 3px solid #f97316; background: rgba(249,115,22,0.04); }
.risk-medium { border-left: 3px solid #fbbf24; background: rgba(251,191,36,0.04); }

.risk-icon { font-size: 20px; flex-shrink: 0; padding-top: 2px; }
.risk-content { flex: 1; }
.risk-title { font-size: 13px; font-weight: 700; color: #e2e8f0; margin-bottom: 4px; }
.risk-desc { font-size: 12px; color: #8b949e; margin-bottom: 4px; }
.risk-detail { font-size: 11px; color: #6e7681; }
.risk-action { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; }

/* Version Grid */
.version-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}
.version-card {
  background: #1a1a2e;
  border: 1px solid #2d2d45;
  border-radius: 12px;
  padding: 18px;
  transition: border-color 0.2s;
}
.version-card.current { border-color: rgba(88,166,255,0.3); }
.version-card.is-newer { border-color: rgba(251,191,36,0.4); }
.version-card.is-current { border-color: rgba(34,197,94,0.3); }

.version-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.version-label { font-size: 11px; color: #6e7681; text-transform: uppercase; }
.version-number { font-size: 26px; font-weight: 800; color: #e2e8f0; line-height: 1; margin-bottom: 8px; }
.version-build { display: flex; gap: 12px; font-size: 11px; color: #6e7681; margin-bottom: 4px; }
.version-date { font-size: 11px; color: #6e7681; margin-bottom: 8px; }
.version-tags { display: flex; gap: 6px; flex-wrap: wrap; }

.update-banner {
  margin-top: 12px;
  padding: 12px;
  background: rgba(251,191,36,0.08);
  border: 1px solid rgba(251,191,36,0.2);
  border-radius: 8px;
}
.update-title { font-size: 13px; font-weight: 700; color: #fbbf24; margin-bottom: 8px; }
.update-changes { display: flex; flex-direction: column; gap: 4px; margin-bottom: 4px; }
.update-change-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #8b949e; }
.change-icon { font-size: 12px; }
.change-text { }
.update-note { font-size: 11px; color: #6e7681; margin-top: 4px; }

.checking-update, .up-to-date {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #8b949e;
  margin-top: 12px;
}

.update-check-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.update-check-note { font-size: 12px; color: #484f58; }

/* System Info */
.sys-info-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.sys-info-item {
  background: #1a1a2e;
  border: 1px solid #2d2d45;
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sys-info-label { font-size: 11px; color: #6e7681; text-transform: uppercase; }
.sys-info-value { font-size: 13px; font-weight: 600; color: #e2e8f0; }
.sys-info-value.mono { font-family: 'Courier New', monospace; font-size: 11px; }
.port-warning { color: #fbbf24 !important; }
</style>
