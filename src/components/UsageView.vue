<template>
  <div class="usage-page">
    <!-- Page Header -->
    <div class="page-header">
      <div class="page-title-row">
        <span class="page-title">🔬 Token 用量追踪</span>
        <el-tag size="small" type="info">v1.4</el-tag>
      </div>
      <div class="page-meta">
        <span class="last-refresh">数据刷新：{{ lastRefresh || '加载中...' }}</span>
        <el-select v-model="period" size="small" style="width:110px" @change="fetchUsage">
          <el-option label="全部时间" value="all" />
          <el-option label="本月" value="month" />
          <el-option label="本周" value="week" />
          <el-option label="今日" value="today" />
        </el-select>
        <el-button size="small" @click="fetchUsage" :loading="loading">🔄 刷新</el-button>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="skeleton-cards">
      <div v-for="i in 4" :key="i" class="skeleton-card pulse"></div>
    </div>

    <template v-else-if="summary">
      <!-- ===== Top Overview Cards ===== -->
      <div class="overview-cards">
        <div class="ov-card">
          <div class="ov-card-icon">🔢</div>
          <div class="ov-card-val">{{ formatNumber(summary.totalTokens) }}</div>
          <div class="ov-card-label">总消耗 Token</div>
        </div>
        <div class="ov-card">
          <div class="ov-card-icon">📊</div>
          <div class="ov-card-val">{{ formatNumber(dailyAvg) }}</div>
          <div class="ov-card-label">日均消耗</div>
        </div>
        <div class="ov-card">
          <div class="ov-card-icon">🏆</div>
          <div class="ov-card-val danger">{{ peakAgent?.agentId || '—' }}</div>
          <div class="ov-card-label">峰值 Agent</div>
        </div>
        <div class="ov-card">
          <div class="ov-card-icon">💰</div>
          <div class="ov-card-val success">¥{{ costEstimate }}</div>
          <div class="ov-card-label">成本估算</div>
        </div>
      </div>

      <!-- ===== Charts Row ===== -->
      <div class="charts-row">
        <!-- Left: Doughnut Chart -->
        <div class="chart-card doughnut-card">
          <div class="chart-card-title">📊 各 Agent Token 消耗占比</div>
          <div class="doughnut-layout">
            <div class="doughnut-wrap">
              <svg viewBox="0 0 200 200" class="doughnut-svg">
                <circle cx="100" cy="100" r="70" fill="none" stroke="#252538" stroke-width="24"/>
                <circle
                  v-for="(seg, i) in doughnutSegments"
                  :key="i"
                  cx="100" cy="100" r="70"
                  fill="none"
                  :stroke="seg.color"
                  stroke-width="24"
                  :stroke-dasharray="`${seg.dash} ${circumference}`"
                  :stroke-dashoffset="seg.offset"
                  stroke-linecap="butt"
                  transform="rotate(-90 100 100)"
                  class="doughnut-seg"
                  @mouseenter="hoveredSeg = i"
                  @mouseleave="hoveredSeg = -1"
                  :style="{ transform: hoveredSeg === i ? 'rotate(-90 100 100) scale(1.03)' : 'rotate(-90 100 100)', transformOrigin: '100px 100px', transition: 'transform 0.2s' }"
                />
                <text x="100" y="94" text-anchor="middle" class="doughnut-center-num">{{ formatCompact(summary.totalTokens) }}</text>
                <text x="100" y="112" text-anchor="middle" class="doughnut-center-label">总 Token</text>
              </svg>
            </div>
            <div class="doughnut-legend">
              <div
                v-for="(seg, i) in doughnutSegments"
                :key="i"
                class="legend-item"
                :class="{ 'legend-hover': hoveredSeg === i }"
                @mouseenter="hoveredSeg = i"
                @mouseleave="hoveredSeg = -1"
              >
                <span class="legend-dot" :style="{ background: seg.color }"></span>
                <span class="legend-agent">{{ seg.agentId }}</span>
                <span class="legend-pct">{{ seg.pct }}%</span>
                <span class="legend-tokens">{{ formatCompact(seg.tokens) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Bar Chart + Ranking -->
        <div class="right-panels">
          <!-- Bar Chart -->
          <div class="chart-card bar-card">
            <div class="chart-card-title">📈 近 7 天消耗趋势</div>
            <div class="bar-chart-wrap">
              <div class="bar-y-axis">
                <span v-for="y in yAxisLabels" :key="y" class="y-label">{{ y }}</span>
              </div>
              <div class="bar-bars">
                <div
                  v-for="(bar, i) in trendBars"
                  :key="i"
                  class="bar-col"
                  @mouseenter="hoveredBar = i"
                  @mouseleave="hoveredBar = -1"
                >
                  <div class="bar-tooltip" v-if="hoveredBar === i">
                    <strong>{{ bar.dateLabel }}</strong><br/>
                    {{ formatNumber(bar.total) }} tokens
                  </div>
                  <div
                    class="bar-fill"
                    :class="{ 'bar-hover': hoveredBar === i }"
                    :style="{ height: bar.pct + '%' }"
                  ></div>
                  <span class="bar-x-label">{{ bar.dayLabel }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Agent Ranking Table -->
          <div class="chart-card ranking-card">
            <div class="chart-card-title">🏅 Agent 排行榜</div>
            <div class="ranking-table">
              <div class="ranking-header">
                <span class="r-col-rank">排名</span>
                <span class="r-col-agent">Agent</span>
                <span class="r-col-tokens">Token 消耗</span>
                <span class="r-col-pct">占比</span>
              </div>
              <div
                v-for="(row, i) in rankingRows"
                :key="row.agentId"
                class="ranking-row"
                :class="'rank-' + (i + 1)"
              >
                <span class="r-col-rank">
                  <span v-if="i === 0" class="medal">🥇</span>
                  <span v-else-if="i === 1" class="medal">🥈</span>
                  <span v-else-if="i === 2" class="medal">🥉</span>
                  <span v-else class="rank-num">{{ i + 1 }}</span>
                </span>
                <span class="r-col-agent">
                  <span class="rank-emoji">{{ row.emoji }}</span>
                  {{ row.agentId }}
                </span>
                <span class="r-col-tokens">{{ formatNumber(row.totalTokens) }}</span>
                <span class="r-col-pct">{{ row.pct }}%</span>
              </div>
              <div v-if="rankingRows.length === 0" class="ranking-empty">暂无数据</div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <div class="empty-icon">📊</div>
      <div class="empty-title">暂无 Token 用量数据</div>
      <div class="empty-sub">当前周期内无会话记录，请确认 Gateway 已连接</div>
      <el-button type="primary" size="small" @click="fetchUsage">重新加载</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const loading = ref(false)
const period = ref('all')
const lastRefresh = ref('')
const summary = ref(null)
const agents = ref([])
const hoveredSeg = ref(-1)
const hoveredBar = ref(-1)

const TOKEN_RATE = 0.0045 // USD per 1K tokens (GPT-4o-mini ref)

const circumference = 2 * Math.PI * 70 // r=70

const dailyAvg = computed(() => {
  if (!summary.value) return 0
  // Approximate days from period
  const days = period.value === 'today' ? 1 : period.value === 'week' ? 7 : period.value === 'month' ? 30 : 7
  return Math.round(summary.value.totalTokens / days)
})

const costEstimate = computed(() => {
  if (!summary.value) return '0.00'
  const usd = (summary.value.totalTokens / 1000) * TOKEN_RATE
  return usd.toFixed(2)
})

const peakAgent = computed(() => {
  if (!agents.value.length) return null
  return agents.value.reduce((max, a) => a.totalTokens > (max?.totalTokens || 0) ? a : max, null)
})

const doughnutSegments = computed(() => {
  if (!summary.value || summary.value.totalTokens === 0) return []
  const total = summary.value.totalTokens
  let offset = 0
  const colors = ['#6366f1', '#818cf8', '#a78bfa', '#c4b5fd', '#818cf8', '#94a3b8']
  return agents.value
    .filter(a => a.totalTokens > 0)
    .map((a, i) => {
      const pct = Math.round((a.totalTokens / total) * 1000) / 10
      const dash = (pct / 100) * circumference
      const seg = {
        agentId: a.agentId,
        tokens: a.totalTokens,
        pct,
        color: colors[i % colors.length],
        dash,
        offset: -offset,
      }
      offset += dash
      return seg
    })
})

const trendBars = computed(() => {
  if (!agents.value.length) return []
  // Aggregate 7-day trend from all agents
  const dayMap = {}
  const now = Date.now()
  for (let d = 6; d >= 0; d--) {
    const dt = new Date(now - d * 86400000)
    const key = dt.toISOString().substring(0, 10)
    dayMap[key] = { date: key, total: 0 }
  }
  for (const a of agents.value) {
    for (const s of (a.sessions || [])) {
      if (!s.startedAt) continue
      const key = s.startedAt.substring(0, 10)
      if (dayMap[key]) dayMap[key].total += s.totalTokens || 0
    }
  }
  const days = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date))
  const maxVal = Math.max(...days.map(d => d.total), 1)
  const dayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return days.map(d => {
    const dt = new Date(d.date)
    return {
      date: d.date,
      total: d.total,
      dayLabel: dayLabels[dt.getDay()],
      dateLabel: d.date,
      pct: Math.max(2, Math.round((d.total / maxVal) * 100)),
    }
  })
})

const yAxisLabels = computed(() => {
  if (!summary.value) return ['0', '0', '0']
  const max = Math.max(...(trendBars.value.map(b => b.total) || [1]), 1)
  return [
    formatCompact(Math.round(max)),
    formatCompact(Math.round(max * 0.5)),
    '0',
  ]
})

const rankingRows = computed(() => {
  if (!agents.value.length) return []
  const total = summary.value?.totalTokens || 1
  return agents.value
    .filter(a => a.totalTokens > 0)
    .slice(0, 8)
    .map(a => ({
      ...a,
      pct: Math.round((a.totalTokens / total) * 1000) / 10,
    }))
})

function formatNumber(n) {
  if (!n) return '0'
  return n.toLocaleString('en-US')
}

function formatCompact(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return Math.round(n / 1000) + 'k'
  return String(n)
}

async function fetchUsage() {
  loading.value = true
  try {
    const res = await fetch(`/api/usage?period=${period.value}`)
    const data = await res.json()
    if (data.ok) {
      summary.value = data.summary
      agents.value = data.agents || []
      lastRefresh.value = data.lastRefresh || new Date().toLocaleTimeString('zh-CN')
    }
  } catch (e) {
    summary.value = null
  }
  loading.value = false
}

onMounted(() => {
  fetchUsage()
})
</script>

<style scoped>
.usage-page {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.page-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.page-title {
  font-size: 16px;
  font-weight: 700;
  color: #e2e8f0;
}
.page-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}
.last-refresh {
  font-size: 12px;
  color: #484f58;
}

/* Skeleton */
.skeleton-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}
.skeleton-card {
  height: 100px;
  background: #1a1a2e;
  border-radius: 12px;
  border: 1px solid #2d2d45;
}
@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
.pulse { animation: pulse 1.5s infinite; }

/* Overview Cards */
.overview-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}
.ov-card {
  background: #1a1a2e;
  border: 1px solid #2d2d45;
  border-radius: 12px;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.ov-card:hover {
  border-color: #6366f1;
  box-shadow: 0 0 0 1px #6366f1;
}
.ov-card-icon { font-size: 20px; margin-bottom: 4px; }
.ov-card-val {
  font-size: 26px;
  font-weight: 800;
  color: #e2e8f0;
  line-height: 1;
}
.ov-card-val.danger { color: #f87171; font-size: 20px; }
.ov-card-val.success { color: #34d399; }
.ov-card-label { font-size: 12px; color: #94a3b8; }

/* Charts Row */
.charts-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.chart-card {
  background: #1a1a2e;
  border: 1px solid #2d2d45;
  border-radius: 12px;
  padding: 16px 20px;
}
.chart-card-title {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
  margin-bottom: 16px;
}

/* Doughnut */
.doughnut-card {
  width: 340px;
  flex-shrink: 0;
}
.doughnut-layout {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.doughnut-wrap {
  position: relative;
  width: 200px;
  height: 200px;
}
.doughnut-svg { width: 200px; height: 200px; }
.doughnut-seg { cursor: pointer; }
.doughnut-center-num {
  font-size: 18px;
  font-weight: 800;
  fill: #e2e8f0;
}
.doughnut-center-label {
  font-size: 11px;
  fill: #94a3b8;
}
.doughnut-legend {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 6px;
  border-radius: 6px;
  cursor: default;
  font-size: 12px;
  transition: background 0.15s;
}
.legend-item.legend-hover { background: #252538; }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.legend-agent { color: #e2e8f0; flex: 1; min-width: 60px; }
.legend-pct { color: #94a3b8; min-width: 40px; text-align: right; }
.legend-tokens { color: #6366f1; font-weight: 600; min-width: 50px; text-align: right; font-size: 11px; }

/* Right panels */
.right-panels {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

/* Bar Chart */
.bar-card { }
.bar-chart-wrap {
  display: flex;
  gap: 8px;
  height: 160px;
  align-items: flex-end;
}
.bar-y-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 130px;
  padding-bottom: 20px;
}
.y-label {
  font-size: 10px;
  color: #94a3b8;
  white-space: nowrap;
}
.bar-bars {
  flex: 1;
  display: flex;
  gap: 8px;
  height: 160px;
  align-items: flex-end;
  border-left: 1px solid #2d2d45;
  border-bottom: 1px solid #2d2d45;
  padding: 0 4px;
}
.bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: 100%;
  position: relative;
  cursor: default;
}
.bar-fill {
  width: 100%;
  background: #6366f1;
  border-radius: 4px 4px 0 0;
  min-height: 4px;
  transition: height 0.3s, background 0.2s;
  position: absolute;
  bottom: 20px;
  left: 0;
}
.bar-fill.bar-hover { background: #818cf8; }
.bar-x-label {
  font-size: 10px;
  color: #94a3b8;
  position: absolute;
  bottom: 0;
}
.bar-tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: #252538;
  border: 1px solid #6366f1;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 11px;
  color: #e2e8f0;
  white-space: nowrap;
  z-index: 10;
  pointer-events: none;
}

/* Ranking Table */
.ranking-card { }
.ranking-table { display: flex; flex-direction: column; }
.ranking-header {
  display: grid;
  grid-template-columns: 48px 1fr 120px 80px;
  padding: 8px 8px;
  font-size: 11px;
  color: #484f58;
  text-transform: uppercase;
  border-bottom: 1px solid #2d2d45;
}
.ranking-row {
  display: grid;
  grid-template-columns: 48px 1fr 120px 80px;
  padding: 10px 8px;
  font-size: 13px;
  align-items: center;
  border-bottom: 1px solid #21262d;
  transition: background 0.15s;
}
.ranking-row:last-child { border-bottom: none; }
.ranking-row:hover { background: #252538; }
.ranking-row.rank-1 { border-left: 3px solid #fbbf24; }
.ranking-row.rank-2 { border-left: 3px solid #94a3b8; }
.ranking-row.rank-3 { border-left: 3px solid #cd7c2e; }
.r-col-rank { text-align: center; }
.r-col-agent {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: #e2e8f0;
}
.rank-emoji { font-size: 14px; }
.rank-num { color: #484f58; font-size: 12px; }
.r-col-tokens {
  text-align: right;
  font-family: 'Courier New', monospace;
  color: #e2e8f0;
  font-size: 12px;
}
.r-col-pct {
  text-align: right;
  color: #6366f1;
  font-weight: 600;
}
.ranking-empty { text-align: center; padding: 24px; color: #484f58; font-size: 13px; }

/* Empty State */
.empty-state {
  text-align: center;
  padding: 80px 0;
}
.empty-icon { font-size: 64px; margin-bottom: 16px; }
.empty-title { font-size: 18px; font-weight: 700; color: #e2e8f0; margin-bottom: 8px; }
.empty-sub { font-size: 13px; color: #484f58; margin-bottom: 20px; }
</style>
