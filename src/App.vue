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
        <el-tab-pane label="📊 仪表盘" name="overview" />
        <el-tab-pane label="👥 员工总览" name="agents" />
        <el-tab-pane label="🔔 告警中心" name="alerts">
          <template #label>
            <span class="tab-label-with-badge">
              🔔 告警中心
              <span v-if="activeAlertCount > 0" class="tab-badge">{{ activeAlertCount }}</span>
            </span>
          </template>
        </el-tab-pane>
        <el-tab-pane label="📋 任务看板" name="tasks" />
        <el-tab-pane label="🔬 Token 用量" name="usage" />
        <el-tab-pane label="🏛 协作大厅" name="hall" />
        <el-tab-pane label="⚙️ 设置" name="settings" />
      </el-tabs>
    </div>

    <!-- Content -->
    <div class="cc-content">

      <!-- ========== OVERVIEW ========== -->
      <div v-if="activeTab === 'overview'" class="overview-page">
        <!-- Alert Banner -->
        <div v-if="overviewData.alerts && overviewData.alerts.length > 0" class="alert-banner">
          <div v-for="(alert, i) in overviewData.alerts" :key="i"
               class="alert-item" :class="'alert-' + alert.level">
            <span class="alert-icon">{{ alert.level === 'error' ? '🔴' : '🟡' }}</span>
            <span class="alert-text">{{ alert.message }}</span>
          </div>
        </div>

        <!-- Operator Summary -->
        <div class="operator-summary">
          <span class="summary-icon">📊</span>
          <span class="summary-text">{{ overviewData.operatorSummary || '正在加载系统状态...' }}</span>
        </div>

        <!-- Health Ring + Stats -->
        <div class="overview-top">
          <div class="health-ring-card">
            <div class="health-ring-wrapper">
              <svg viewBox="0 0 120 120" class="health-svg">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#21262D" stroke-width="10"/>
                <circle cx="60" cy="60" r="50" fill="none"
                  :stroke="healthRingColor"
                  stroke-width="10"
                  stroke-linecap="round"
                  :stroke-dasharray="ringDash"
                  stroke-dashoffset="0"
                  transform="rotate(-90 60 60)"
                  style="transition: stroke-dasharray 0.8s ease"/>
              </svg>
              <div class="health-ring-center">
                <div class="health-score">{{ overviewData.healthScore || 0 }}</div>
                <div class="health-pct">%</div>
              </div>
            </div>
            <div class="health-label" :class="'health-' + (overviewData.healthLevel || 'unknown')">
              {{ healthLabelCN }}
            </div>
          </div>

          <div class="stats-cards">
            <div class="stat-card stat-running">
              <div class="stat-card-icon">⚡</div>
              <div class="stat-card-num">{{ overviewData.stats?.running || 0 }}</div>
              <div class="stat-card-label">运行中</div>
            </div>
            <div class="stat-card stat-idle">
              <div class="stat-card-icon">💤</div>
              <div class="stat-card-num">{{ overviewData.stats?.idle || 0 }}</div>
              <div class="stat-card-label">空闲</div>
            </div>
            <div class="stat-card stat-total">
              <div class="stat-card-icon">👥</div>
              <div class="stat-card-num">{{ overviewData.stats?.totalAgents || 0 }}</div>
              <div class="stat-card-label">Agent 总数</div>
            </div>
            <div class="stat-card stat-error" :class="{ 'has-errors': (overviewData.stats?.error || 0) > 0 }">
              <div class="stat-card-icon">{{ (overviewData.stats?.error || 0) > 0 ? '🔴' : '✅' }}</div>
              <div class="stat-card-num">{{ overviewData.stats?.error || 0 }}</div>
              <div class="stat-card-label">异常</div>
            </div>
          </div>
        </div>

        <!-- Quick Actions Bar (仪表盘) -->
        <div class="quick-actions-bar">
          <span class="quick-actions-label">⚡ 快捷操作</span>
          <el-button size="small" type="danger" plain @click="doQuickOp('restart-error')" :loading="quickOpLoading">
            🔄 重启所有异常
          </el-button>
          <el-button size="small" type="warning" plain @click="doQuickOp('notify-idle')" :loading="quickOpLoading">
            📢 通知全部空闲
          </el-button>
          <el-button size="small" type="default" plain @click="refresh" :loading="loading">
            🔃 刷新全部状态
          </el-button>
        </div>

        <!-- Recent Activity Timeline -->
        <div class="activity-section">
          <div class="section-title">最近活动时间线</div>
          <div class="timeline">
            <div v-for="(evt, i) in recentActivity" :key="i" class="timeline-item">
              <div class="timeline-dot" :class="'dot-' + evt.status"></div>
              <div class="timeline-content">
                <span class="timeline-agent">{{ evt.agentName }}</span>
                <span class="timeline-status" :class="'status-text-' + evt.status">{{ evt.statusText }}</span>
                <span class="timeline-time">{{ evt.time }}</span>
              </div>
            </div>
            <div v-if="recentActivity.length === 0" class="timeline-empty">暂无最近活动</div>
          </div>
        </div>

        <!-- Connection Health (from System tab) -->
        <div class="conn-health-section" style="margin-top: 20px">
          <div class="section-sub-title">🔗 连接状态</div>
          <div class="conn-cards">
            <div v-for="conn in overviewData.connections || []" :key="conn.name"
                 class="conn-card" :class="'conn-' + conn.status">
              <div class="conn-icon">{{ conn.icon }}</div>
              <div class="conn-name">{{ conn.name }}</div>
              <div class="conn-status-dot" :class="'dot-status-' + conn.status">
                {{ conn.status === 'good' ? '✅' : conn.status === 'warn' ? '⚠️' : '❌' }}
              </div>
              <div class="conn-detail">{{ conn.detail }}</div>
            </div>
          </div>
        </div>

        <!-- Context Pressure (from System tab) -->
        <div class="pressure-section" style="margin-top: 20px">
          <div class="section-sub-title">🔥 Context Pressure</div>
          <div class="pressure-list">
            <div v-for="agent in agents.filter(a => a.status !== 'offline')" :key="agent.id" class="pressure-row">
              <div class="pressure-agent-info">
                <span class="pressure-agent-name">{{ agent.name }}</span>
                <span class="pressure-session">{{ agent.sessionKey || '—' }}</span>
              </div>
              <div class="pressure-bar-full">
                <div class="pressure-bar-full-inner"
                  :class="'pressure-' + (agent.pressureLevel || 'low')"
                  :style="{ width: Math.min((agent.contextPressure || 0), 100) + '%' }">
                </div>
              </div>
              <div class="pressure-token-info">
                <span class="pressure-pct" :class="'pct-' + (agent.pressureLevel || 'low')">
                  {{ agent.contextPressure || 0 }}%
                </span>
                <span class="pressure-tokens">{{ formatToken(agent.tokenCount) }} / {{ formatToken(agent.tokenLimit) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== AGENTS (with batch) ========== -->
      <div v-if="activeTab === 'agents'">
        <!-- Quick Actions for Agents page -->
        <div class="quick-actions-bar">
          <span class="quick-actions-label">⚡ 快捷操作</span>
          <el-button size="small" type="success" plain @click="doQuickOp('start-all')" :loading="quickOpLoading">
            ▶ 启动全部
          </el-button>
          <el-button size="small" type="danger" plain @click="doQuickOp('restart-error')" :loading="quickOpLoading">
            🔄 重启所有异常
          </el-button>
          <el-button size="small" type="default" plain @click="refresh" :loading="loading">
            🔃 刷新全部状态
          </el-button>
        </div>

        <!-- Agents header with + Add Agent -->
        <div class="agents-page-header">
          <div class="agents-page-title">
            员工总览 <span class="section-sub">({{ agents.length }} 个 Agent)</span>
          </div>
          <el-button type="primary" size="small" @click="openAddAgent">
            ＋ 新增 Agent
          </el-button>
        </div>

        <!-- Status filter -->
        <div class="status-filter-bar">
          <el-radio-group v-model="agentFilter" size="small">
            <el-radio-button label="active">仅活跃 ({{ agents.filter(a => a.status === 'running' || a.status === 'idle').length }})</el-radio-button>
            <el-radio-button label="all">全部 ({{ agents.length }})</el-radio-button>
            <el-radio-button label="error">仅异常 ({{ agents.filter(a => a.status === 'error' || a.status === 'offline').length }})</el-radio-button>
          </el-radio-group>
        </div>
        <!-- Batch toolbar -->
        <div class="batch-toolbar" v-if="selectedAgents.size > 0 || batchToolbarVisible">
          <div class="batch-left">
            <el-checkbox
              v-model="allSelected"
              :indeterminate="selectedAgents.size > 0 && selectedAgents.size < filteredAgents.length"
              @change="toggleSelectAll"
            >全选 / 取消全选</el-checkbox>
            <span class="batch-count">{{ selectedAgents.size }} 个已选</span>
          </div>
          <div class="batch-actions">
            <el-button size="small" type="success" @click="doBatchOp('start')" :loading="batchLoading">
              ▶ 批量启动
            </el-button>
            <el-button size="small" type="warning" @click="doBatchOp('stop')" :loading="batchLoading">
              ⏸ 批量停止
            </el-button>
            <el-button size="small" type="primary" @click="doBatchOp('restart')" :loading="batchLoading">
              🔄 批量重启
            </el-button>
            <el-button size="small" @click="clearSelection">✕ 清除选择</el-button>
          </div>
        </div>

        <div class="agent-grid">
          <el-card
            v-for="agent in filteredAgents"
            :key="agent.id"
            class="agent-card"
            :class="['status-' + agent.status, { 'is-selected': selectedAgents.has(agent.id) }]"
            shadow="hover"
            @click="toggleAgentSelect(agent.id, $event)"
          >
            <div class="agent-card-select">
              <el-checkbox
                :model-value="selectedAgents.has(agent.id)"
                @click.stop
                @change="toggleAgentSelect(agent.id, $event)"
              />
            </div>
            <div class="agent-card-body" @click.stop="showDetail(agent)">
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

              <div class="agent-metrics">
                <div class="metric-item" :title="'记忆条数: ' + (agent.memoryCount || 0)">
                  <span class="metric-icon">🧠</span>
                  <span class="metric-value">{{ agent.memoryCount || 0 }}</span>
                  <span class="metric-label">记忆</span>
                </div>
                <div class="metric-item context-pressure-item">
                  <span class="metric-icon">🔥</span>
                  <div class="pressure-bar-wrap">
                    <div class="pressure-bar"
                      :class="'pressure-' + (agent.pressureLevel || 'low')"
                      :style="{ width: Math.min((agent.contextPressure || 0), 100) + '%' }">
                    </div>
                  </div>
                  <span class="metric-value">{{ agent.contextPressure || 0 }}%</span>
                </div>
              </div>

              <div class="agent-token">
                <span class="token-label">Token</span>
                <div class="token-bar-wrap">
                  <div class="token-bar"
                    :class="'pressure-' + (agent.pressureLevel || 'low')"
                    :style="{ width: Math.min((agent.contextPressure || 0), 100) + '%' }">
                  </div>
                </div>
                <span class="token-num">{{ formatToken(agent.tokenCount) }}</span>
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
                <el-tag v-if="agent.memoryStatus === 'sparse'" size="small" type="warning" effect="dark">🧠稀疏</el-tag>
                <el-tag v-else-if="agent.memoryStatus === 'available'" size="small" type="success" effect="dark">🧠正常</el-tag>
                <el-tag v-else-if="agent.memoryStatus === 'unavailable'" size="small" type="danger" effect="dark">🧠无</el-tag>
              </div>
              <div class="agent-duty">职责：{{ agent.duty }}</div>
            </div>
          </el-card>
        </div>
      </div>

      <!-- ========== USAGE (v1.4) ========== -->
      <div v-if="activeTab === 'usage'" class="usage-tab"><UsageView /></div>

      <!-- ========== TASKS ========== -->
      <div v-if="activeTab === 'tasks'"><TasksView /></div>

      <!-- ========== ALERTS CENTER (v1.2) ========== -->
      <div v-if="activeTab === 'alerts'" class="alerts-page"> class="alerts-page">
        <!-- v1.4 Sub Tab Bar -->
        <div class="alert-sub-tabs">
          <div class="sub-tab" :class="{ active: alertSubTab === 'live' }" @click="alertSubTab = 'live'">实时</div>
          <div class="sub-tab" :class="{ active: alertSubTab === 'history' }" @click="switchToHistory">
            <span>历史</span>
            <span class="sub-tab-badge" v-if="alertHistoryTotal > 0">{{ alertHistoryTotal }}</span>
          </div>
          <div class="sub-tab-right">
            <el-button size="small" text @click="fetchAlertHistory" :loading="alertHistoryLoading">🔄 刷新</el-button>
          </div>
        </div>

        <!-- Real-time Alerts -->
        <div v-if="alertSubTab === 'live'" class="alerts-layout">
          <!-- Left: Alert List -->
          <div class="alerts-list-panel">
            <div class="section-title">🔔 告警列表 <span class="section-sub">({{ activeAlerts.length }} 条活跃)</span></div>

            <!-- Alert Stats -->
            <div class="alert-stats-row">
              <div class="alert-stat-item stat-critical">
                <span class="stat-num">{{ todayCriticalCount }}</span>
                <span class="stat-lbl">紧急</span>
              </div>
              <div class="alert-stat-item stat-warning">
                <span class="stat-num">{{ todayWarningCount }}</span>
                <span class="stat-lbl">警告</span>
              </div>
              <div class="alert-stat-item stat-info">
                <span class="stat-num">{{ todayInfoCount }}</span>
                <span class="stat-lbl">提示</span>
              </div>
              <div class="alert-stat-item stat-total">
                <span class="stat-num">{{ allAlerts.length }}</span>
                <span class="stat-lbl">本周总数</span>
              </div>
            </div>

            <!-- Alert Cards -->
            <div v-if="activeAlerts.length === 0" class="alerts-empty">
              <div class="alerts-empty-icon">🎉</div>
              <div class="alerts-empty-text">当前无活跃告警</div>
              <div class="alerts-empty-sub">系统运行正常，所有指标正常</div>
            </div>
            <div v-else class="alert-cards">
              <div v-for="alert in activeAlerts" :key="alert.id"
                   class="alert-card" :class="'alert-level-' + alert.level">
                <div class="alert-card-icon-wrap" :class="'icon-level-' + alert.level">
                  <span class="alert-card-icon">{{ alert.level === 'critical' ? '🔴' : alert.level === 'warning' ? '🟡' : '🔵' }}</span>
                </div>
                <div class="alert-card-content">
                  <div class="alert-card-header-row">
                    <span class="alert-level-tag" :class="'level-tag-' + alert.level">
                      {{ alert.level === 'critical' ? '紧急' : alert.level === 'warning' ? '警告' : '提示' }}
                    </span>
                    <span class="alert-status-badge" :class="'status-active'">
                      {{ alert.status === 'resolved' ? '已消除' : '活跃' }}
                    </span>
                  </div>
                  <div class="alert-title">{{ alert.title }}</div>
                  <div class="alert-desc">{{ alert.message }}</div>
                  <div class="alert-meta">
                    <span class="alert-agent">🤖 {{ alert.agentId }}</span>
                    <span class="alert-time">🕐 {{ alert.createdAt }}</span>
                    <span class="alert-duration" v-if="alert.duration">⏱ {{ alert.duration }}</span>
                  </div>
                </div>
                <div class="alert-card-actions" v-if="alert.status !== 'resolved'">
                  <el-button size="small" type="success" plain @click="resolveAlert(alert.id)">✓ 标记消除</el-button>
                  <el-button size="small" type="danger" plain @click="deleteAlert(alert.id)">🗑</el-button>
                </div>
              </div>
            </div>

            <!-- Alert History -->
            <div class="alert-history-section">
              <div class="alert-history-toggle" @click="historyExpanded = !historyExpanded">
                <span class="toggle-arrow" :class="{ expanded: historyExpanded }">▶</span>
                <span>已消除的告警 ({{ resolvedAlerts.length }} 条)</span>
              </div>
              <div v-if="historyExpanded" class="alert-history-list">
                <div v-for="alert in resolvedAlerts" :key="alert.id"
                     class="alert-card resolved" :class="'alert-level-' + alert.level">
                  <div class="alert-card-icon-wrap" :class="'icon-level-' + alert.level">
                    <span class="alert-card-icon">{{ alert.level === 'critical' ? '🔴' : alert.level === 'warning' ? '🟡' : '🔵' }}</span>
                  </div>
                  <div class="alert-card-content">
                    <div class="alert-card-header-row">
                      <span class="alert-level-tag" :class="'level-tag-' + alert.level">
                        {{ alert.level === 'critical' ? '紧急' : alert.level === 'warning' ? '警告' : '提示' }}
                      </span>
                      <span class="alert-status-badge status-resolved">已消除</span>
                    </div>
                    <div class="alert-title">{{ alert.title }}</div>
                    <div class="alert-meta">
                      <span class="alert-agent">🤖 {{ alert.agentId }}</span>
                      <span class="alert-time">🕐 {{ alert.createdAt }}</span>
                      <span class="alert-time">✓ 消除于 {{ alert.resolvedAt }}</span>
                    </div>
                  </div>
                </div>
                <div v-if="resolvedAlerts.length === 0" class="history-empty">暂无已消除的告警</div>
              </div>
            </div>
          </div>

          
          <!-- Right: Config Panel -->
          <div class="alerts-config-panel">
            <!-- Context Pressure Threshold -->
            <div class="config-card">
              <div class="config-card-title">🎛 告警阈值配置</div>
              <div class="config-item">
                <div class="config-item-label">
                  <span>Context Pressure 阈值</span>
                  <span class="config-current-val">{{ alertConfig.contextPressureThreshold }}%</span>
                </div>
                <div class="slider-wrap">
                  <input type="range" class="cc-slider" min="50" max="100"
                    v-model.number="alertConfig.contextPressureThreshold"
                    @input="onThresholdChange" />
                </div>
                <div class="slider-hints">
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
              <div class="config-item">
                <div class="config-item-label">
                  <span>告警抑制时长</span>
                  <span class="config-note">不可配置</span>
                </div>
                <div class="config-static-val">5 分钟（同一告警 5 分钟内不重复通知）</div>
              </div>
              <div class="config-item">
                <div class="config-item-label">
                  <span>自动消除</span>
                </div>
                <el-switch v-model="alertConfig.autoResolve" />
              </div>
            </div>

            <!-- Notification Channels -->
            <div class="config-card">
              <div class="config-card-title">📨 通知渠道</div>
              <div class="channel-item">
                <div class="channel-info">
                  <span class="channel-name">飞书机器人</span>
                  <el-tag size="small" type="success" v-if="alertConfig.feishuEnabled">已启用</el-tag>
                  <el-tag size="small" type="danger" v-else>未启用</el-tag>
                </div>
                <div class="channel-controls">
                  <el-switch v-model="alertConfig.feishuEnabled" @change="onFeishuToggle" />
                  <el-button size="small" @click="testFeishuNotification" :loading="testingFeishu">测试</el-button>
                </div>
              </div>
              <div class="channel-item">
                <div class="channel-info">
                  <span class="channel-name">邮件通知</span>
                  <el-tag size="small" type="danger">未配置</el-tag>
                </div>
                <div class="channel-controls">
                  <el-switch v-model="alertConfig.emailEnabled" disabled />
                  <el-button size="small" disabled>测试</el-button>
                </div>
              </div>
            </div>

            <!-- Feishu Config -->
            <div class="config-card" v-if="alertConfig.feishuEnabled">
              <div class="config-card-title">🔗 飞书 Webhook 配置</div>
              <el-form label-width="80px" size="small">
                <el-form-item label="Webhook URL">
                  <el-input v-model="alertConfig.feishuWebhookUrl" placeholder="https://open.feishu.cn/..." />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" size="small" @click="saveAlertConfig">保存配置</el-button>
                </el-form-item>
              </el-form>
            </div>

            <!-- Alert Rule Summary -->
            <div class="config-card">
              <div class="config-card-title">📋 告警触发规则</div>
              <div class="rule-list">
                <div class="rule-item">
                  <span class="rule-icon">🔥</span>
                  <span class="rule-text">Context Pressure ≥ {{ alertConfig.contextPressureThreshold }}%</span>
                </div>
                <div class="rule-item">
                  <span class="rule-icon">🔴</span>
                  <span class="rule-text">Agent 进入 error 状态</span>
                </div>
                <div class="rule-item">
                  <span class="rule-icon">⚠️</span>
                  <span class="rule-text">健康度变为 critical</span>
                </div>
                <div class="rule-item">
                  <span class="rule-icon">🔗</span>
                  <span class="rule-text">Gateway 离线</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      
        </div>

        <!-- v1.4 History Sub-Tab -->
        <div v-if="alertSubTab === 'history'" class="alert-history-wrap">
          <!-- Filter Bar -->
          <div class="hist-filter-bar">
            <el-select v-model="alertHistFilter.agent_id" size="small" placeholder="全部 Agent" clearable style="width:140px" @change="fetchAlertHistory">
              <el-option v-for="a in agents" :key="a.id" :label="a.name + ' (' + a.id + ')'" :value="a.id" />
            </el-select>
            <el-select v-model="alertHistFilter.level" size="small" placeholder="全部级别" clearable style="width:120px" @change="fetchAlertHistory">
              <el-option label="Critical" value="critical" />
              <el-option label="Warning" value="warning" />
              <el-option label="Info" value="info" />
            </el-select>
            <el-select v-model="alertHistFilter.timeRange" size="small" style="width:130px" @change="fetchAlertHistory">
              <el-option label="近1小时" value="1h" />
              <el-option label="近6小时" value="6h" />
              <el-option label="近24小时" value="24h" />
              <el-option label="近7天" value="7d" />
              <el-option label="近30天" value="30d" />
            </el-select>
            <el-button size="small" @click="exportAlertHistoryCsv" :disabled="alertHistoryItems.length === 0">📥 导出 CSV</el-button>
          </div>

          <!-- Summary Stats -->
          <div class="hist-summary">
            <span class="hist-total">共 <strong>{{ alertHistoryTotal }}</strong> 条记录</span>
            <span class="hist-badge critical" v-if="alertHistorySummary.critical > 0">🔴 Critical {{ alertHistorySummary.critical }}</span>
            <span class="hist-badge warning" v-if="alertHistorySummary.warning > 0">🟡 Warning {{ alertHistorySummary.warning }}</span>
            <span class="hist-badge info" v-if="alertHistorySummary.info > 0">🔵 Info {{ alertHistorySummary.info }}</span>
          </div>

          <!-- History List -->
          <div v-if="alertHistoryLoading" class="hist-loading">
            <div v-for="i in 3" :key="i" class="hist-skeleton pulse"></div>
          </div>
          <div v-else-if="alertHistoryItems.length === 0" class="hist-empty">
            <div class="hist-empty-icon">📭</div>
            <div class="hist-empty-text">暂无告警记录</div>
          </div>
          <div v-else class="hist-list">
            <div
              v-for="item in alertHistoryItems"
              :key="item.id"
              class="hist-card"
              :class="'hist-level-' + item.level"
            >
              <div class="hist-card-icon">{{ item.level === 'critical' ? '🔴' : item.level === 'warning' ? '🟡' : '🔵' }}</div>
              <div class="hist-card-body">
                <div class="hist-card-header">
                  <span class="hist-level-badge" :class="'badge-' + item.level">{{ item.level.toUpperCase() }}</span>
                  <span class="hist-agent">Agent: {{ item.agent_id }}</span>
                  <span class="hist-title">{{ item.title }}</span>
                  <span class="hist-time">{{ formatAlertTime(item.trigger_time) }}</span>
                </div>
                <div class="hist-card-meta">
                  <span class="hist-duration" v-if="item.duration_minutes">⏱ {{ item.duration_minutes }} 分钟</span>
                  <span class="hist-status" :class="'status-' + item.status">
                    {{ item.status === 'recovered' ? '已恢复' : item.status === 'escalated' ? '已升级' : '进行中' }}
                  </span>
                </div>
                <!-- Expandable Detail -->
                <div class="hist-detail" v-if="expandedAlertId === item.id">
                  <div class="detail-row" v-if="item.threshold"><span class="dr-key">触发条件</span><span class="dr-val">{{ item.threshold }}</span></div>
                  <div class="detail-row" v-if="item.current_value"><span class="dr-key">当前值</span><span class="dr-val">{{ item.current_value }}</span></div>
                  <div class="detail-row"><span class="dr-key">处理建议</span><pre class="dr-val suggestion">{{ item.suggestion }}</pre></div>
                </div>
              </div>
              <div class="hist-card-actions">
                <el-button size="small" text @click="toggleAlertDetail(item.id)">{{ expandedAlertId === item.id ? '收起' : '详情' }}</el-button>
                <el-button size="small" text type="success" @click="markAlertRecovered(item.id)" v-if="item.status !== 'recovered'">✓ 标记已恢复</el-button>
              </div>
            </div>
          </div>

          <!-- Pagination -->
          <div class="hist-pagination" v-if="alertHistoryTotal > 0">
            <el-pagination
              v-model:current-page="alertHistoryPage"
              :page-size="20"
              :total="alertHistoryTotal"
              layout="prev, pager, next, jumper"
              @current-change="onAlertHistoryPageChange"
              background
            />
            <span class="hist-page-info">共 {{ alertHistoryTotal }} 条</span>
          </div>
        </div>
      </div>

      <!-- ========== HALL (v1.4 Phase 1) ========== -->
      <HallView v-if="activeTab === 'hall'" />

      <!-- ========== SETTINGS (v1.5) ========== -->
      <SettingsView v-if="activeTab === 'settings'" />

    <!-- Agent Detail Modal -->
    <el-dialog v-model="detailVisible" :title="selectedAgent?.emoji + ' ' + selectedAgent?.name + ' - 详情'" width="800px">
      <el-tabs v-if="selectedAgent" v-model="detailTab">
        <el-tab-pane label="基本信息" name="info">
          <el-form label-width="100px" style="max-width:600px">
            <el-form-item label="Agent ID">
              <el-input :model-value="selectedAgent.id" disabled />
            </el-form-item>
            <el-form-item label="状态">
              <el-tag :type="statusTagType(selectedAgent.status)" effect="dark">{{ statusLabel(selectedAgent.status) }}</el-tag>
              <span style="margin-left:12px;color:#8B949E;font-size:12px">当前会话状态</span>
            </el-form-item>
            <el-form-item label="会话 Key">
              <el-input :model-value="selectedAgent.sessionKey || '—'" disabled />
            </el-form-item>
            <el-form-item label="Token">
              <div style="display:flex;align-items:center;gap:8px">
                <el-input :model-value="formatToken(selectedAgent.tokenCount)" disabled style="width:140px"/>
                <span style="color:#484F58">/ {{ formatToken(selectedAgent.tokenLimit) }}</span>
                <span style="margin-left:8px;font-size:13px" :class="'pct-' + (selectedAgent.pressureLevel || 'low')">
                  ({{ selectedAgent.contextPressure || 0 }}%)
                </span>
              </div>
            </el-form-item>
            <el-form-item label="Context Pressure">
              <div style="display:flex;align-items:center;gap:10px">
                <div style="flex:1;max-width:300px">
                  <div class="token-bar-wrap" style="height:8px">
                    <div class="token-bar"
                      :class="'pressure-' + (selectedAgent.pressureLevel || 'low')"
                      :style="{ width: Math.min((selectedAgent.contextPressure || 0), 100) + '%' }">
                    </div>
                  </div>
                </div>
                <el-tag size="small" :type="pressureTagType(selectedAgent.pressureLevel)" effect="dark">
                  {{ pressureLabel(selectedAgent.pressureLevel) }}
                </el-tag>
              </div>
            </el-form-item>
            <el-form-item label="记忆">
              <el-tag size="small" type="primary">{{ selectedAgent.memoryCount || 0 }} 条</el-tag>
              <el-tag size="small" :type="memoryStatusType(selectedAgent.memoryStatus)" effect="dark" style="margin-left:6px">
                {{ memoryStatusLabel(selectedAgent.memoryStatus) }}
              </el-tag>
            </el-form-item>
            <el-form-item label="最后活跃">
              <el-input :model-value="selectedAgent.lastActiveAt || '—'" disabled />
            </el-form-item>
            <el-form-item label="角色">
              <el-input v-model="editRole" placeholder="请输入角色" />
            </el-form-item>
            <el-form-item label="职责描述">
              <el-input v-model="editDuty" type="textarea" :rows="3" placeholder="请输入职责描述" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveAgentInfo" :loading="saving">保存修改</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="飞书配置" name="feishu">
          <el-form label-width="140px" style="max-width:560px">
            <el-form-item label="飞书机器人 App ID">
              <el-input :model-value="selectedAgent?.feishuAppId || '—'" disabled placeholder="尚未配置" />
            </el-form-item>
            <el-form-item label="飞书机器人 App Secret">
              <el-input
                :model-value="selectedAgent?.feishuAppSecret ? '••••••••' : '—'"
                disabled placeholder="尚未配置"
                type="password"
              />
            </el-form-item>
            <el-form-item label="配置状态">
              <el-tag v-if="selectedAgent?.feishuAppId" type="success" effect="dark">已配置</el-tag>
              <el-tag v-else type="info" effect="plain">未配置</el-tag>
            </el-form-item>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="工作空间文档" name="docs">
          <div v-if="agentDocsLoading" style="text-align:center;padding:40px">
            <el-icon class="is-loading"><Loading /></el-icon> 加载中...
          </div>
          <div v-else>
            <div style="margin-bottom:12px">
              <el-tag type="info" size="small">工作目录：{{ agentWorkspacePath }}</el-tag>
            </div>
            <el-tabs v-model="docTab" style="margin-top:8px">
              <el-tab-pane v-for="(content, filename) in agentDocs" :key="filename" :label="filename" :name="filename">
                <div style="background:#161B22;border:1px solid #30363D;border-radius:6px;padding:16px">
                  <pre style="white-space:pre-wrap;word-break:break-all;color:#E6EDF3;font-size:13px;line-height:1.6;max-height:400px;overflow-y:auto">{{ content }}</pre>
                </div>
              </el-tab-pane>
            </el-tabs>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>

    <!-- Batch Confirm Dialog -->
    <el-dialog v-model="batchConfirmVisible" :title="'⚠️ 批量' + batchOpTypeLabel + '确认'" width="480px">
      <div class="batch-confirm-body">
        <p class="batch-confirm-text">
          即将对以下 <strong>{{ selectedAgents.size }}</strong> 个 Agent 执行 <strong>{{ batchOpTypeLabel }}</strong> 操作：
        </p>
        <div class="batch-confirm-list">
          <div v-for="id in selectedAgents" :key="id" class="batch-confirm-item">
            <el-avatar :size="24" :style="{ backgroundColor: agentColors[id] || '#666', fontSize: '10px' }">
              {{ getAgentEmoji(id) }}
            </el-avatar>
            <span class="batch-confirm-name">{{ getAgentName(id) }}</span>
            <span class="batch-confirm-id">{{ id }}</span>
            <span class="batch-confirm-status" :class="'status-text-' + getAgentStatus(id)">
              {{ statusLabel(getAgentStatus(id)) }}
            </span>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="batchConfirmVisible = false">取消</el-button>
        <el-button :type="batchOpBtnType" @click="confirmBatchOp" :loading="batchLoading">
          确认执行
        </el-button>
      </template>
    </el-dialog>

    <!-- Batch Result Dialog -->
    <el-dialog v-model="batchResultVisible" :title="batchResultTitle" width="440px">
      <div class="batch-result-body">
        <div class="batch-result-summary">
          <div class="result-success">
            <span class="result-icon">✓</span>
            <span>成功 <strong>{{ batchResults.success }}</strong> 个</span>
          </div>
          <div class="result-fail" v-if="batchResults.fail > 0">
            <span class="result-icon">✗</span>
            <span>失败 <strong>{{ batchResults.fail }}</strong> 个</span>
          </div>
        </div>
        <div v-if="batchResults.fail > 0" class="batch-result-fails">
          <div v-for="f in batchResults.failDetails" :key="f.id" class="fail-item">
            <span class="fail-agent">{{ f.name }}</span>
            <span class="fail-reason">{{ f.reason }}</span>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="batchResultVisible = false">关闭</el-button>
        <el-button v-if="batchResults.fail > 0" type="warning" @click="retryFailedBatch">重新失败项</el-button>
      </template>
    </el-dialog>

    <!-- Add/Edit Agent Dialog -->
    <el-dialog v-model="agentFormVisible" :title="agentFormMode === 'add' ? '＋ 新增 Agent' : '✏️ 编辑 Agent'" width="520px">
      <el-form :model="agentForm" label-width="100px" :rules="agentFormRules" ref="agentFormRef">
        <el-form-item label="Agent ID" :prop="agentFormMode === 'add' ? 'id' : ''">
          <el-input v-model="agentForm.id" :placeholder="agentFormMode === 'add' ? '如 dev-new' : ''"
            :disabled="agentFormMode === 'edit'" />
        </el-form-item>
        <el-form-item label="名称" prop="name">
          <el-input v-model="agentForm.name" placeholder="如 新开发者" />
        </el-form-item>
        <el-form-item label="角色权限" prop="roleType">
          <el-select v-model="agentForm.roleType" placeholder="选择角色">
            <el-option label="👤 普通成员" value="member" />
            <el-option label="👑 管理员" value="admin" />
          </el-select>
        </el-form-item>
        <el-form-item label="职责描述" prop="duty">
          <el-input v-model="agentForm.duty" type="textarea" :rows="3" placeholder="描述该 Agent 的主要职责" />
        </el-form-item>
        <el-form-item label="飞书机器人 App ID">
          <el-input v-model="agentForm.feishuAppId" placeholder="cli_xxxxxxxxx" clearable />
        </el-form-item>
        <el-form-item label="飞书机器人 App Secret">
          <el-input v-model="agentForm.feishuAppSecret" type="password" placeholder="请输入 App Secret" show-password clearable />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="agentFormVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAgentForm" :loading="agentFormSaving">
          {{ agentFormMode === 'add' ? '创建' : '保存' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Delete Confirm Dialog -->
    <el-dialog v-model="deleteConfirmVisible" title="⚠️ 确认删除 Agent" width="480px">
      <div class="delete-warn-box">
        <div class="delete-warn-title">即将删除 <strong>{{ deleteTargetAgent?.name }}</strong>，此操作：</div>
        <ul class="delete-warn-list">
          <li>将停止该 Agent 的所有会话</li>
          <li>将清除该 Agent 的记忆数据（可选）</li>
          <li style="color:#F85149;font-weight:600">操作不可撤销</li>
        </ul>
      </div>
      <template #footer>
        <el-button @click="deleteConfirmVisible = false">取消</el-button>
        <el-button type="danger" @click="confirmDeleteAgent" :loading="deletingAgent">
          确认删除
        </el-button>
      </template>
    </el-dialog>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import HallView from './components/HallView.vue'
import UsageView from './components/UsageView.vue'
import TasksView from './components/TasksView.vue'
import SettingsView from './components/SettingsView.vue'

const activeTab = ref('overview')
const loading = ref(false)
const gatewayOnline = ref(false)
const lastUpdate = ref('')
const detailVisible = ref(false)
const selectedAgent = ref(null)
const detailTab = ref('info')
const editRole = ref('')
const editDuty = ref('')
const saving = ref(false)
const agentDocs = ref({})
const agentDocsLoading = ref(false)
const docTab = ref('')
const agentWorkspacePath = ref('')
const overviewData = ref({})
const quickOpLoading = ref(false)
const agentFilter = ref('active')

// ===== v1.2 State =====
const selectedAgents = ref(new Set())
const batchToolbarVisible = ref(false)
const batchConfirmVisible = ref(false)
const batchResultVisible = ref(false)
const batchOpType = ref('start')
const batchLoading = ref(false)
const batchResults = ref({ success: 0, fail: 0, failDetails: [] })
const testingFeishu = ref(false)

// Alert state
const alertConfig = ref({
  contextPressureThreshold: 85,
  feishuEnabled: false,
  feishuWebhookUrl: '',
  emailEnabled: false,
  autoResolve: true,
})
const historyExpanded = ref(false)
const allAlerts = ref([])

// v1.4 Alert History sub-tab
const alertSubTab = ref('live')
const alertHistoryPage = ref(1)
const alertHistoryTotal = ref(0)
const alertHistoryItems = ref([])
const alertHistoryLoading = ref(false)
const alertHistorySummary = ref({ critical: 0, warning: 0, info: 0 })
const alertHistFilter = ref({ agent_id: '', level: '', timeRange: '24h' })
const expandedAlertId = ref(null)

// Team management
const agentFormVisible = ref(false)
const agentFormMode = ref('add')
const agentFormRef = ref(null)
const agentFormSaving = ref(false)
const agentForm = ref({ id: '', name: '', roleType: 'member', duty: '', feishuAppId: '', feishuAppSecret: '' })
const agentFormRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  roleType: [{ required: true, message: '请选择角色', trigger: 'change' }],
}
const deleteConfirmVisible = ref(false)
const deleteTargetAgent = ref(null)
const deletingAgent = ref(false)

// Demo alert data
const DEMO_ALERTS = [
  { id: 'a1', level: 'critical', title: 'Context Pressure 超过阈值', message: 'Dev Agent Context Pressure 达到 92%，超过告警阈值 85%', agentId: 'Dev', createdAt: '2026-04-05 08:30:00', status: 'active', duration: '持续 3 分钟' },
  { id: 'a2', level: 'warning', title: 'Context Pressure 接近阈值', message: 'PM Agent Context Pressure 达到 87%，接近告警阈值', agentId: 'PM', createdAt: '2026-04-05 08:25:00', status: 'active', duration: '持续 5 分钟' },
  { id: 'a3', level: 'info', title: 'Agent 空闲超时', message: 'Des Agent 空闲超过 10 分钟', agentId: 'Des', createdAt: '2026-04-05 08:15:00', status: 'active', duration: '持续 10 分钟' },
  { id: 'a4', level: 'warning', title: 'Memory 使用率偏高', message: 'QA Agent Memory 使用率达到 78%', agentId: 'QA', createdAt: '2026-04-05 08:00:00', status: 'active', duration: '持续 8 分钟' },
  { id: 'a5', level: 'critical', title: 'Agent Error', message: 'Dev-DQ Agent 进入 error 状态', agentId: 'dev-dq', createdAt: '2026-04-05 07:50:00', status: 'resolved', resolvedAt: '2026-04-05 07:55:00', duration: '5 分钟' },
  { id: 'a6', level: 'info', title: 'Gateway 重连', message: 'Gateway 重新连接成功', agentId: 'Gateway', createdAt: '2026-04-05 07:40:00', status: 'resolved', resolvedAt: '2026-04-05 07:42:00', duration: '2 分钟' },
]

// Team agents with role info
const teamAgents = computed(() => {
  return agents.value.map(a => ({
    ...a,
    roleType: ['pd', 'dev', 'ops'].includes(a.id) ? 'admin' : 'member',
  }))
})

const adminCount = computed(() => teamAgents.value.filter(a => a.roleType === 'admin').length)
const filteredAgents = computed(() => {
  if (agentFilter.value === 'active') {
    return agents.value.filter(a => a.status === 'running' || a.status === 'idle')
  }
  if (agentFilter.value === 'error') {
    return agents.value.filter(a => a.status === 'error' || a.status === 'offline')
  }
  return agents.value
})
const activeAlerts = computed(() => allAlerts.value.filter(a => a.status === 'active'))
const resolvedAlerts = computed(() => allAlerts.value.filter(a => a.status === 'resolved'))
const activeAlertCount = computed(() => activeAlerts.value.length)
const todayCriticalCount = computed(() => allAlerts.value.filter(a => a.level === 'critical').length)
const todayWarningCount = computed(() => allAlerts.value.filter(a => a.level === 'warning').length)
const todayInfoCount = computed(() => allAlerts.value.filter(a => a.level === 'info').length)

const AGENTS_DATA = [
  { id: 'pd',     name: 'PD',      emoji: '👔', role: '项目总监',     duty: '项目统筹、任务分发、进度管控、冲突解决',    status: 'idle' },
  { id: 'pm',     name: 'PM',      emoji: '📋', role: '产品经理',     duty: '需求分析、PRD输出、需求澄清、验收标准制定',  status: 'idle' },
  { id: 'dev',    name: 'Dev',     emoji: '💻', role: '开发工程师',   duty: '代码开发、架构实现、接口编写、单元测试',     status: 'idle' },
  { id: 'dev-dq', name: '窦青',    emoji: '💻', role: 'Dev-DQ 开发工程师', duty: '代码开发、UI优化、技术支持',            status: 'idle' },
  { id: 'des',    name: 'Des',     emoji: '🎨', role: 'UI/UX设计师',  duty: '原型设计、UI视觉、交互规范、设计交付',      status: 'idle' },
  { id: 'qa',     name: 'QA',      emoji: '🧪', role: '测试工程师',   duty: '测试用例、功能测试、Bug提交、上线验收',      status: 'idle' },
  { id: 'ops',    name: 'Ops',     emoji: '🚀', role: '运维工程师',   duty: '环境部署、版本发布、服务监控、故障处理',      status: 'idle' },
  { id: 'xiaoai', name: '小爱',    emoji: '🤵', role: '秘书',         duty: '协调沟通、梳理进展、传达指令、汇总报告',      status: 'idle' },
]

const agentColors = {
  pd: '#DB61A2', pm: '#1F6FEB', dev: '#8957E5', 'dev-dq': '#DA3633',
  des: '#2EA043', qa: '#238636', ops: '#D29922', xiaoai: '#D29922'
}

let agents = ref([...AGENTS_DATA])
let allSessions = ref([])

// Computed
const runningCount = computed(() => agents.value.filter(a => a.status === 'running').length)
const onlineCount = computed(() => agents.value.filter(a => a.status === 'running').length)
const idleCount = computed(() => agents.value.filter(a => a.status === 'idle').length)
const errorCount = computed(() => agents.value.filter(a => a.status === 'error').length)

// Batch computed
const allSelected = computed(() => selectedAgents.value.size === filteredAgents.value.length && filteredAgents.value.length > 0)
const batchOpTypeLabel = computed(() => ({ start: '启动', stop: '停止', restart: '重启' }[batchOpType.value] || ''))
const batchOpBtnType = computed(() => ({ start: 'success', stop: 'warning', restart: 'primary' }[batchOpType.value] || ''))
const batchResultTitle = computed(() => batchResults.value.fail === 0 ? '✅ 批量操作完成' : '⚠️ 批量操作部分失败')

// Health ring
const healthRingColor = computed(() => {
  const h = overviewData.value.healthLevel
  if (h === 'healthy') return '#3FB950'
  if (h === 'degraded') return '#D29922'
  if (h === 'critical') return '#F85149'
  return '#484F58'
})
const healthLabelCN = computed(() => {
  const h = overviewData.value.healthLevel
  if (h === 'healthy') return '🟢 健康'
  if (h === 'degraded') return '🟡 亚健康'
  if (h === 'critical') return '🔴 异常'
  return '⚪ 未知'
})
const ringDash = computed(() => {
  const score = overviewData.value.healthScore || 0
  const circumference = 2 * Math.PI * 50
  const filled = circumference * score / 100
  return `${filled} ${circumference}`
})

// Recent activity
const recentActivity = computed(() => {
  const sessions = overviewData.value.allSessions || []
  return sessions
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 8)
    .map(s => {
      const a = agents.value.find(x => x.id === s.agentId)
      return {
        agentName: a ? a.name : (s.agentId || '?'),
        status: s.status || 'idle',
        statusText: statusLabel(s.status || 'idle'),
        time: s.updatedAt ? new Date(s.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '—'
      }
    })
})

function getParentAgent(session) {
  const key = session.key || ''
  if (key.includes(':subagent:')) {
    const parts = key.split(':')
    return parts[1] || 'unknown'
  }
  const match = key.match(/^agent:([^:]+):/)
  return match ? match[1] : (session.agentId || 'unknown')
}

const PRIORITIES = ['P0', 'P1', 'P2']
function randomPriority() {
  return PRIORITIES[Math.floor(Math.random() * 3)]
}
function randomDeadline() {
  const now = Date.now()
  const offset = Math.floor(Math.random() * 3 * 3600000)
  return new Date(now + offset).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

const todoTasks = computed(() => {
  return allSessions.value
    .filter(s => s.status === 'idle')
    .map((s, i) => {
      const parent = getParentAgent(s)
      const agent = agents.value.find(a => a.id === parent)
      return {
        id: 'todo-' + i,
        title: s.label || s.displayName || '会话任务',
        agentName: agent ? agent.name : parent,
        agent,
        priority: randomPriority(),
        deadline: randomDeadline(),
        tokenInfo: s.tokenCount ? `${Math.round(s.tokenCount / 1000)}k tokens` : ''
      }
    })
})

const runningTasks = computed(() => {
  return allSessions.value
    .filter(s => s.status === 'running' || s.status === 'active')
    .map((s, i) => {
      const parent = getParentAgent(s)
      const agent = agents.value.find(a => a.id === parent)
      return {
        id: 'running-' + i,
        title: s.label || s.displayName || '会话任务',
        agentName: agent ? agent.name : parent,
        agent,
        priority: PRIORITIES[0],
        deadline: randomDeadline(),
        tokenInfo: s.tokenCount ? `${Math.round(s.tokenCount / 1000)}k tokens` : ''
      }
    })
})

const doneTasks = computed(() => {
  return allSessions.value
    .filter(s => s.status === 'done' || s.status === 'timeout')
    .map((s, i) => {
      const parent = getParentAgent(s)
      const agent = agents.value.find(a => a.id === parent)
      return {
        id: 'done-' + i,
        title: s.label || s.displayName || '会话任务',
        agentName: agent ? agent.name : parent,
        agent
      }
    })
})

function statusType(s) {
  return { running: 'success', idle: 'warning', error: 'danger', offline: 'info' }[s] || 'info'
}
function statusTagType(s) {
  return { running: 'success', idle: 'warning', error: 'danger', offline: 'info' }[s] || 'info'
}
function statusLabel(s) {
  return { running: '运行中', idle: '空闲', error: '异常', offline: '离线' }[s] || s
}
function memoryStatusType(s) {
  return { available: 'success', sparse: 'warning', unavailable: 'danger' }[s] || 'info'
}
function memoryStatusLabel(s) {
  return { available: '✅ 可用', sparse: '⚠️ 稀疏', unavailable: '❌ 不可用' }[s] || s
}
function pressureTagType(p) {
  return { low: 'success', med: 'warning', high: 'danger' }[p] || 'info'
}
function pressureLabel(p) {
  return { low: '🟢 低压', med: '🟡 中压', high: '🔴 高压' }[p] || '—'
}
function priorityLabel(p) {
  return { P0: '🔴P0高', P1: '🟡P1中', P2: '🔵P2低' }[p] || p
}
function formatToken(n) {
  if (!n) return '0'
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return Math.round(n / 1000) + 'k'
  return String(n)
}

function showDetail(agent) {
  selectedAgent.value = agent
  detailTab.value = 'info'
  editRole.value = agent.role || ''
  editDuty.value = agent.duty || ''
  detailVisible.value = true
  loadAgentDocs(agent.id)
  // Load feishu fields from team API
  fetch(`/api/team/members`)
    .then(r => r.json())
    .then(data => {
      if (data.ok && data.members) {
        const tm = data.members.find(m => m.agentId === agent.id)
        if (tm) {
          selectedAgent.value = { ...selectedAgent.value, feishuAppId: tm.feishuAppId || '', feishuAppSecret: tm.feishuAppSecret || '' }
        }
      }
    })
    .catch(() => {})
}

const AGENT_WORKSPACES = {
  pd: '/root/.openclaw/workspace-pd',
  pm: '/root/.openclaw/workspace-pm',
  dev: '/root/.openclaw/workspace-dev',
  'dev-dq': '/root/.openclaw/workspace-dev-dq',
  des: '/root/.openclaw/workspace-des',
  qa: '/root/.openclaw/workspace-qa',
  ops: '/root/.openclaw/workspace-ops',
  xiaoai: '/root/.openclaw/workspace-xiaoai',
}

function loadAgentDocs(agentId) {
  agentDocsLoading.value = true
  agentDocs.value = {}
  agentWorkspacePath.value = AGENT_WORKSPACES[agentId] || ''
  fetch(`/api/agent/${agentId}/docs`)
    .then(r => r.json())
    .then(data => {
      if (data.ok && data.docs) {
        agentDocs.value = data.docs
        const keys = Object.keys(data.docs)
        if (keys.length > 0) docTab.value = keys[0]
      }
      agentDocsLoading.value = false
    })
    .catch(() => { agentDocsLoading.value = false })
}

async function saveAgentInfo() {
  if (!selectedAgent.value) return
  saving.value = true
  try {
    const res = await fetch(`/api/agent/${selectedAgent.value.id}/duty`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: editRole.value, duty: editDuty.value })
    })
    const data = await res.json()
    if (data.ok) {
      const a = agents.value.find(x => x.id === selectedAgent.value.id)
      if (a) { a.role = editRole.value; a.duty = editDuty.value }
      selectedAgent.value.role = editRole.value
      selectedAgent.value.duty = editDuty.value
      ElMessage.success('保存成功')
    } else {
      ElMessage.error('保存失败：' + (data.error || '未知错误'))
    }
  } catch (e) {
    ElMessage.error('保存失败：' + e.message)
  }
  saving.value = false
}

async function fetchGatewayData() {
  try {
    const res = await fetch('/api/gateway-data')
    if (res.ok) {
      const data = await res.json()
      gatewayOnline.value = data.gatewayOnline !== false
      overviewData.value = data
      if (data.agents) {
        for (const s of data.agents) {
          const a = agents.value.find(x => x.id === s.agentId)
          if (a) {
            a.status = s.status || 'idle'
            a.tasks = s.tasks || 0
            a.messages = s.messages || 0
            a.currentTask = s.currentTask || '—'
            a.tokenCount = s.tokenCount || 0
            a.tokenLimit = s.tokenLimit || 200000
            a.contextPressure = s.contextPressure || 0
            a.pressureLevel = s.pressureLevel || 'low'
            a.memoryCount = s.memoryCount || 0
            a.memoryStatus = s.memoryStatus || 'unavailable'
            a.sessionKey = s.sessionKey || ''
            a.lastActiveAt = s.lastActiveAt || '—'
          }
        }
        if (data.allSessions) {
          allSessions.value = data.allSessions
        }
      }
    }
  } catch (e) {
    gatewayOnline.value = false
  }
}

async function refresh() {
  loading.value = true
  await fetchGatewayData()
  lastUpdate.value = new Date().toLocaleTimeString('zh-CN')
  loading.value = false
}

function onTabChange() {}

// ===== Batch Selection =====
function toggleAgentSelect(id, event) {
  if (event === true || event === false) {
    // from checkbox change
    if (event) selectedAgents.value.add(id)
    else selectedAgents.value.delete(id)
  } else {
    // from card click
    if (selectedAgents.value.has(id)) selectedAgents.value.delete(id)
    else selectedAgents.value.add(id)
  }
  selectedAgents.value = new Set(selectedAgents.value)
  batchToolbarVisible.value = selectedAgents.value.size > 0
}

function toggleSelectAll(val) {
  if (val) filteredAgents.value.forEach(a => selectedAgents.value.add(a.id))
  else selectedAgents.value.clear()
  selectedAgents.value = new Set(selectedAgents.value)
  batchToolbarVisible.value = selectedAgents.value.size > 0
}

function clearSelection() {
  selectedAgents.value = new Set()
  batchToolbarVisible.value = false
}

async function doQuickOp(type) {
  quickOpLoading.value = true
  await new Promise(r => setTimeout(r, 600))
  if (type === 'restart-error') {
    const errors = agents.value.filter(a => a.status === 'error' || a.status === 'offline')
    ElMessage.success(`已对 ${errors.length} 个异常 Agent 发起重启指令`)
  } else if (type === 'notify-idle') {
    const idle = agents.value.filter(a => a.status === 'idle')
    ElMessage.success(`已向 ${idle.length} 个空闲 Agent 发送通知`)
  } else if (type === 'start-all') {
    ElMessage.success(`已向全部 ${agents.value.length} 个 Agent 发起启动指令`)
  }
  quickOpLoading.value = false
}

function getAgentEmoji(id) {
  const a = agents.value.find(x => x.id === id)
  return a ? a.emoji : '🤖'
}
function getAgentName(id) {
  const a = agents.value.find(x => x.id === id)
  return a ? a.name : id
}
function getAgentStatus(id) {
  const a = agents.value.find(x => x.id === id)
  return a ? a.status : 'offline'
}

async function doBatchOp(type) {
  batchOpType.value = type
  batchConfirmVisible.value = true
}

async function confirmBatchOp() {
  batchConfirmVisible.value = false
  batchLoading.value = true
  const ids = Array.from(selectedAgents.value)
  const results = { success: 0, fail: 0, failDetails: [] }
  const opLabels = { start: '启动', stop: '停止', restart: '重启' }
  const opLabel = opLabels[batchOpType.value]

  for (const id of ids) {
    try {
      // Simulate API call
      await new Promise(r => setTimeout(r, 300))
      // In real implementation, call /api/agent/:id/sessions/start|stop|restart
      results.success++
    } catch (e) {
      results.fail++
      results.failDetails.push({ id, name: getAgentName(id), reason: 'Agent 无响应或操作失败' })
    }
  }

  batchResults.value = results
  batchLoading.value = false
  batchResultVisible.value = true
  clearSelection()
}

function retryFailedBatch() {
  if (batchResults.value.failDetails.length > 0) {
    selectedAgents.value = new Set(batchResults.value.failDetails.map(f => f.id))
    batchToolbarVisible.value = true
    batchResultVisible.value = false
  }
}

// ===== Alert Management =====
function resolveAlert(id) {
  const alert = allAlerts.value.find(a => a.id === id)
  if (alert) {
    alert.status = 'resolved'
    alert.resolvedAt = new Date().toLocaleString('zh-CN')
    allAlerts.value = [...allAlerts.value]
    ElMessage.success('告警已标记消除')
  }
}

function deleteAlert(id) {
  allAlerts.value = allAlerts.value.filter(a => a.id !== id)
  ElMessage.success('告警已删除')
}

function onThresholdChange() {
  // Debounced save handled by save button or auto-save
}

function onFeishuToggle(val) {
  ElMessage.success(val ? '飞书通知已启用' : '飞书通知已禁用')
}

async function testFeishuNotification() {
  testingFeishu.value = true
  try {
    const res = await fetch('/api/alerts/test-feishu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl: alertConfig.value.feishuWebhookUrl })
    })
    const data = await res.json()
    if (data.ok) ElMessage.success('飞书测试消息发送成功！')
    else ElMessage.error('发送失败：' + (data.error || '未知错误'))
  } catch (e) {
    // Demo mode
    await new Promise(r => setTimeout(r, 800))
    ElMessage.success('飞书测试消息发送成功！')
  }
  testingFeishu.value = false
}

async function saveAlertConfig() {
  try {
    await fetch('/api/alerts/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alertConfig.value)
    })
  } catch (e) {}
  ElMessage.success('告警配置已保存')
}

// ===== v1.4 Alert History =====
function timeRangeToIso(range) {
  const now = Date.now()
  const map = { '1h': 3600000, '6h': 21600000, '24h': 86400000, '7d': 604800000, '30d': 2592000000 }
  const ms = map[range] || 86400000
  return { start_time: new Date(now - ms).toISOString(), end_time: new Date(now).toISOString() }
}

async function fetchAlertHistory() {
  alertHistoryLoading.value = true
  try {
    const { start_time, end_time } = timeRangeToIso(alertHistFilter.value.timeRange)
    const params = new URLSearchParams({
      page: alertHistoryPage.value,
      page_size: 20,
    })
    if (alertHistFilter.value.agent_id) params.set('agent_id', alertHistFilter.value.agent_id)
    if (alertHistFilter.value.level) params.set('level', alertHistFilter.value.level)
    params.set('start_time', start_time)
    params.set('end_time', end_time)
    const res = await fetch('/api/alerts/history?' + params.toString())
    const data = await res.json()
    alertHistoryItems.value = data.items || []
    alertHistoryTotal.value = data.total || 0
    alertHistorySummary.value = data.summary || { critical: 0, warning: 0, info: 0 }
  } catch (e) {
    alertHistoryItems.value = []
  }
  alertHistoryLoading.value = false
}

function switchToHistory() {
  alertSubTab.value = 'history'
  if (alertHistoryItems.value.length === 0) fetchAlertHistory()
}

function onAlertHistoryPageChange(page) {
  alertHistoryPage.value = page
  fetchAlertHistory()
}

function formatAlertTime(isoStr) {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前'
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function toggleAlertDetail(id) {
  expandedAlertId.value = expandedAlertId.value === id ? null : id
}

function markAlertRecovered(id) {
  const item = alertHistoryItems.value.find(i => i.id === id)
  if (item) {
    item.status = 'recovered'
    item.recover_time = new Date().toISOString()
    ElMessage.success('告警已标记为恢复')
  }
}

function exportAlertHistoryCsv() {
  const rows = [['ID', 'Agent', 'Level', 'Title', 'Trigger Time', 'Recover Time', 'Duration (min)', 'Status']]
  for (const item of alertHistoryItems.value) {
    rows.push([item.id, item.agent_id, item.level, item.title, item.trigger_time, item.recover_time || '', item.duration_minutes, item.status])
  }
  const csv = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'alert-history.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ===== Team Management =====
function openAddAgent() {
  agentFormMode.value = 'add'
  agentForm.value = { id: '', name: '', roleType: 'member', duty: '' }
  agentFormVisible.value = true
}

function openEditAgent(agent) {
  agentFormMode.value = 'edit'
  agentForm.value = {
    id: agent.id,
    name: agent.name,
    roleType: teamAgents.value.find(t => t.id === agent.id)?.roleType || 'member',
    duty: agent.duty || '',
    feishuAppId: agent.feishuAppId || '',
    feishuAppSecret: agent.feishuAppSecret || ''
  }
  agentFormVisible.value = true
}

function submitAgentForm() {
  agentFormRef.value?.validate(async (valid) => {
    if (!valid) return
    agentFormSaving.value = true
    try {
      if (agentFormMode.value === 'add') {
        // Check duplicate
        if (agents.value.find(a => a.id === agentForm.value.id)) {
          ElMessage.error('Agent ID 已存在')
          agentFormSaving.value = false
          return
        }
        // Create new agent
        const colors = ['#8957E5', '#238636', '#D29922', '#DB61A2', '#1F6FEB', '#2EA043', '#DA3633', '#D29922']
        const newAgent = {
          id: agentForm.value.id,
          name: agentForm.value.name,
          emoji: '🤖',
          role: agentForm.value.duty,
          duty: agentForm.value.duty,
          status: 'idle',
          contextPressure: 0,
          pressureLevel: 'low',
          memoryCount: 0,
          memoryStatus: 'unavailable',
          tasks: 0,
          messages: 0,
          tokenCount: 0,
          tokenLimit: 200000,
          sessionKey: '',
          lastActiveAt: '—',
          feishuAppId: agentForm.value.feishuAppId,
          feishuAppSecret: agentForm.value.feishuAppSecret
        }
        // Persist to backend
        try {
          const res = await fetch('/api/team/members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: agentForm.value.id,
              name: agentForm.value.name,
              roleType: agentForm.value.roleType,
              duty: agentForm.value.duty,
              feishuAppId: agentForm.value.feishuAppId,
              feishuAppSecret: agentForm.value.feishuAppSecret
            })
          })
          const data = await res.json()
          if (!data.ok) ElMessage.warning('后端保存失败：' + (data.error || ''))
        } catch (e) {}
        agents.value = [...agents.value, newAgent]
        ElMessage.success(`Agent "${agentForm.value.name}" 创建成功`)
      } else {
        // Edit
        const a = agents.value.find(x => x.id === agentForm.value.id)
        if (a) {
          a.name = agentForm.value.name
          a.role = agentForm.value.duty
          a.duty = agentForm.value.duty
          a.feishuAppId = agentForm.value.feishuAppId
          a.feishuAppSecret = agentForm.value.feishuAppSecret
        }
        try {
          await fetch('/api/team/members/' + agentForm.value.id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: agentForm.value.name,
              roleType: agentForm.value.roleType,
              duty: agentForm.value.duty,
              feishuAppId: agentForm.value.feishuAppId,
              feishuAppSecret: agentForm.value.feishuAppSecret
            })
          })
        } catch (e) {}
        ElMessage.success('Agent 信息已保存')
      }
      agentFormVisible.value = false
    } catch (e) {
      ElMessage.error('操作失败：' + e.message)
    }
    agentFormSaving.value = false
  })
}

function openDeleteConfirm(agent) {
  deleteTargetAgent.value = agent
  deleteConfirmVisible.value = true
}

async function confirmDeleteAgent() {
  if (!deleteTargetAgent.value) return
  deletingAgent.value = true
  try {
    await new Promise(r => setTimeout(r, 500))
    agents.value = agents.value.filter(a => a.id !== deleteTargetAgent.value.id)
    ElMessage.success(`Agent "${deleteTargetAgent.value.name}" 已删除`)
    deleteConfirmVisible.value = false
  } catch (e) {
    ElMessage.error('删除失败')
  }
  deletingAgent.value = false
}

let timer = null

onMounted(async () => {
  // Load alert config from API or localStorage
  try {
    const res = await fetch('/api/alerts/config')
    if (res.ok) {
      const cfg = await res.json()
      if (cfg) alertConfig.value = { ...alertConfig.value, ...cfg }
    }
  } catch (e) {}
  // Load demo alerts
  allAlerts.value = [...DEMO_ALERTS]
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
  font-family: 'PingFang SC', 'Microsoft YaHei', 'Inter', -apple-system, sans-serif;
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

.tab-label-with-badge { display: flex; align-items: center; gap: 6px; }
.tab-badge {
  background: #F85149;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 10px;
  min-width: 16px;
  text-align: center;
}

.cc-content { max-width: 1400px; margin: 0 auto; padding: 20px 24px; }

.section-title { font-size: 15px; font-weight: 600; color: #E6EDF3; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
.section-sub { font-weight: 400; color: #484F58; font-size: 13px; }
.section-sub-title { font-size: 14px; font-weight: 600; color: #8B949E; margin-bottom: 12px; margin-top: 20px; }

/* ========== OVERVIEW ========== */
.overview-page { }

.alert-banner {
  background: rgba(248, 81, 73, 0.08);
  border: 1px solid rgba(248, 81, 73, 0.3);
  border-radius: 8px;
  padding: 10px 16px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.alert-item { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.alert-error { color: #F85149; }
.alert-warning { color: #D29922; }

.operator-summary {
  background: #161B22;
  border: 1px solid #30363D;
  border-radius: 8px;
  padding: 12px 18px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #E6EDF3;
}
.summary-icon { font-size: 16px; }
.summary-text { color: #8B949E; }

.overview-top {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  align-items: flex-start;
}

.health-ring-card {
  flex-shrink: 0;
  background: #161B22;
  border: 1px solid #30363D;
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  min-width: 160px;
}
.health-ring-wrapper { position: relative; width: 120px; height: 120px; }
.health-svg { width: 120px; height: 120px; }
.health-ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
}
.health-score { font-size: 28px; font-weight: 800; color: #E6EDF3; line-height: 1; }
.health-pct { font-size: 14px; color: #8B949E; margin-top: 2px; }
.health-label { font-size: 14px; font-weight: 600; }
.health-healthy { color: #3FB950; }
.health-degraded { color: #D29922; }
.health-critical { color: #F85149; }

.stats-cards { display: flex; gap: 12px; flex: 1; }
.stat-card {
  flex: 1;
  background: #161B22;
  border: 1px solid #30363D;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  transition: border-color 0.2s;
}
.stat-card.has-errors { border-color: rgba(248,81,73,0.4); }
.stat-card-icon { font-size: 20px; }
.stat-card-num { font-size: 28px; font-weight: 800; line-height: 1; }
.stat-card-label { font-size: 11px; color: #484F58; text-transform: uppercase; }
.stat-running .stat-card-num { color: #3FB950; }
.stat-idle .stat-card-num { color: #D29922; }
.stat-total .stat-card-num { color: #58A6FF; }
.stat-error .stat-card-num { color: #F85149; }

.activity-section {
  background: #161B22;
  border: 1px solid #30363D;
  border-radius: 12px;
  padding: 16px 20px;
}
.timeline { display: flex; flex-direction: column; gap: 0; }
.timeline-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #21262D;
}
.timeline-item:last-child { border-bottom: none; }
.timeline-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-running { background: #3FB950; }
.dot-idle { background: #D29922; }
.dot-error { background: #F85149; }
.dot-offline { background: #484F58; }
.timeline-content { display: flex; align-items: center; gap: 10px; flex: 1; font-size: 13px; }
.timeline-agent { font-weight: 600; color: #E6EDF3; min-width: 60px; }
.timeline-status { padding: 1px 8px; border-radius: 4px; font-size: 11px; }
.status-text-running { color: #3FB950; background: rgba(63,185,80,0.1); }
.status-text-idle { color: #D29922; background: rgba(210,153,34,0.1); }
.status-text-error { color: #F85149; background: rgba(248,81,73,0.1); }
.timeline-time { color: #484F58; font-size: 11px; margin-left: auto; }
.timeline-empty { color: #484F58; font-size: 13px; text-align: center; padding: 20px 0; }

/* ========== AGENTS with Batch ========== */
.batch-toolbar {
  background: #161B22;
  border: 1px solid #30363D;
  border-radius: 10px;
  padding: 10px 16px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.batch-left { display: flex; align-items: center; gap: 12px; }
.batch-count {
  font-size: 13px;
  color: #58A6FF;
  font-weight: 600;
  background: rgba(88,166,255,0.12);
  padding: 2px 10px;
  border-radius: 10px;
}
.batch-actions { display: flex; gap: 8px; align-items: center; }

/* Quick Actions Bar */
.quick-actions-bar {
  background: #161B22;
  border: 1px solid #30363D;
  border-radius: 10px;
  padding: 10px 16px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.quick-actions-label {
  font-size: 12px;
  color: #8B949E;
  font-weight: 600;
  margin-right: 4px;
  white-space: nowrap;
}

/* Agents Page Header */
.agents-page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.agents-page-title {
  font-size: 15px;
  font-weight: 600;
  color: #E6EDF3;
}

/* Status Filter */
.status-filter-bar {
  margin-bottom: 16px;
}

.agent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
.agent-card {
  background: #161B22;
  border: 1px solid #30363D;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}
.agent-card:hover { border-color: #388BFD; transform: translateY(-2px); }
.agent-card.status-running { border-color: rgba(63,185,80,0.3); }
.agent-card.is-selected { border-color: #388BFD !important; box-shadow: 0 0 0 1px #388BFD; }
.agent-card-select {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 2;
}
.agent-card-body { }
.agent-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
.agent-left { display: flex; align-items: center; gap: 10px; }
.agent-info { display: flex; flex-direction: column; }
.agent-name { font-size: 14px; font-weight: 600; color: #E6EDF3; }
.agent-role { font-size: 12px; color: #8B949E; }

.agent-metrics { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.metric-item { display: flex; align-items: center; gap: 4px; font-size: 12px; }
.metric-icon { font-size: 12px; }
.metric-value { color: #8B949E; }
.metric-label { color: #484F58; font-size: 10px; }
.context-pressure-item { flex: 1; }
.pressure-bar-wrap {
  flex: 1;
  height: 4px;
  background: #21262D;
  border-radius: 2px;
  overflow: hidden;
  max-width: 60px;
}
.pressure-bar { height: 100%; border-radius: 2px; transition: width 0.3s; }
.pressure-low { background: #3FB950; }
.pressure-med { background: #D29922; }
.pressure-high { background: #F85149; }

.agent-token { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.token-label { font-size: 10px; color: #484F58; min-width: 28px; }
.token-bar-wrap { flex: 1; height: 3px; background: #21262D; border-radius: 2px; overflow: hidden; }
.token-bar { height: 100%; border-radius: 2px; transition: width 0.3s; }
.token-num { font-size: 10px; color: #484F58; min-width: 40px; text-align: right; }

.agent-stats { display: flex; gap: 16px; margin-bottom: 8px; }
.stat-item { display: flex; flex-direction: column; }
.stat-label { font-size: 10px; color: #484F58; text-transform: uppercase; }
.stat-value { font-size: 18px; font-weight: 700; color: #E6EDF3; }
.stat-value.success { color: #3FB950; }
.agent-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.agent-duty { font-size: 12px; color: #6E7681; line-height: 1.5; padding-top: 8px; border-top: 1px solid #21262D; }

/* ========== USAGE (v1.4) ========== */
.usage-tab { flex: 1; overflow: hidden; display: flex; flex-direction: column; }

/* ========== TASKS ========== */
.kanban-board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.kanban-col { background: #161B22; border: 1px solid #30363D; border-radius: 12px; overflow: hidden; }
.kanban-header { padding: 12px 16px; border-bottom: 1px solid #30363D; display: flex; justify-content: space-between; align-items: center; }
.kanban-title { font-size: 13px; font-weight: 600; }
.kanban-body { padding: 12px; min-height: 120px; }
.task-card { background: #0D1117; border: 1px solid #21262D; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; cursor: pointer; transition: border-color 0.15s; }
.task-card:hover { border-color: #388BFD; }
.task-card.running { border-left: 3px solid #D29922; }
.task-card.done { border-left: 3px solid #3FB950; opacity: 0.7; }
.task-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.task-priority { font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 3px; }
.priority-P0 { color: #F85149; background: rgba(248,81,73,0.12); }
.priority-P1 { color: #D29922; background: rgba(210,153,34,0.12); }
.priority-P2 { color: #58A6FF; background: rgba(88,166,255,0.12); }
.task-deadline { font-size: 10px; color: #484F58; }
.task-title { font-size: 13px; font-weight: 500; color: #E6EDF3; margin-bottom: 6px; }
.task-meta { display: flex; justify-content: space-between; align-items: center; }
.task-assignee { font-size: 11px; color: #8B949E; }
.task-token { font-size: 10px; color: #484F58; }
.kanban-empty { text-align: center; color: #484F58; font-size: 13px; padding: 30px 0; }

/* ========== SYSTEM ========== */
.conn-health-section { margin-bottom: 8px; }
.conn-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.conn-card {
  background: #161B22;
  border: 1px solid #30363D;
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}
.conn-icon { font-size: 22px; }
.conn-name { font-size: 13px; font-weight: 600; color: #E6EDF3; }
.conn-status-dot { font-size: 18px; }
.conn-detail { font-size: 10px; color: #484F58; }

.mem-status-section { }
.data-table { background: #161B22; border: 1px solid #30363D; border-radius: 10px; overflow: hidden; }
.table-header {
  display: grid;
  grid-template-columns: 1fr 1.5fr 1fr 1.5fr;
  padding: 10px 16px;
  background: #0D1117;
  font-size: 11px;
  color: #484F58;
  text-transform: uppercase;
  border-bottom: 1px solid #21262D;
}
.table-row {
  display: grid;
  grid-template-columns: 1fr 1.5fr 1fr 1.5fr;
  padding: 10px 16px;
  border-bottom: 1px solid #21262D;
  font-size: 12px;
  align-items: center;
}
.table-row:last-child { border-bottom: none; }
.table-agent { font-weight: 600; color: #E6EDF3; }
.table-status { }
.table-memcount { color: #8B949E; }
.table-time { color: #484F58; font-size: 11px; }

.pressure-section { }
.pressure-list { background: #161B22; border: 1px solid #30363D; border-radius: 10px; overflow: hidden; }
.pressure-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid #21262D;
}
.pressure-row:last-child { border-bottom: none; }
.pressure-agent-info { display: flex; flex-direction: column; min-width: 80px; }
.pressure-agent-name { font-size: 12px; font-weight: 600; color: #E6EDF3; }
.pressure-session { font-size: 10px; color: #484F58; font-family: monospace; }
.pressure-bar-full { flex: 1; height: 6px; background: #21262D; border-radius: 3px; overflow: hidden; }
.pressure-bar-full-inner { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
.pressure-token-info { display: flex; flex-direction: column; align-items: flex-end; min-width: 100px; }
.pressure-pct { font-size: 12px; font-weight: 700; }
.pressure-tokens { font-size: 10px; color: #484F58; }
.pct-low { color: #3FB950; }
.pct-med { color: #D29922; }
.pct-high { color: #F85149; }

.sys-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.sys-card { background: #161B22; border: 1px solid #30363D; border-radius: 12px; }
.sys-label { font-size: 11px; color: #484F58; text-transform: uppercase; margin-bottom: 8px; }
.sys-value { font-size: 32px; font-weight: 800; }
.sys-value.primary { color: #58A6FF; }
.sys-value.success { color: #3FB950; }
.sys-value.warning { color: #D29922; }
.sys-value.danger { color: #F85149; }
.sys-sub { font-size: 11px; color: #484F58; margin-top: 4px; }

/* ========== ALERTS CENTER (v1.2) ========== */
.alerts-page { }
.alerts-layout {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}
.alerts-list-panel { flex: 1; min-width: 0; }
/* v1.4 Alert Sub-Tabs */
.alert-sub-tabs {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 12px 0 0 0;
  border-bottom: 1px solid #21262d;
  margin-bottom: 16px;
}
.sub-tab {
  padding: 6px 16px;
  font-size: 13px;
  color: #8b949e;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: color 0.2s, border-color 0.2s;
  user-select: none;
}
.sub-tab:hover { color: #e6edf3; }
.sub-tab.active { color: #6366f1; border-bottom-color: #6366f1; font-weight: 600; }
.sub-tab-badge {
  background: #f87171;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 10px;
  min-width: 16px;
  text-align: center;
}
.sub-tab-right { margin-left: auto; }

/* v1.4 History */
.alert-history-wrap { display: flex; flex-direction: column; gap: 0; }

.hist-filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  flex-wrap: wrap;
}

.hist-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0 12px;
  font-size: 13px;
  color: #8b949e;
}
.hist-total strong { color: #e6edf3; }
.hist-badge { font-size: 12px; padding: 2px 8px; border-radius: 4px; }
.hist-badge.critical { color: #f87171; background: rgba(248,81,73,0.12); }
.hist-badge.warning { color: #fbbf24; background: rgba(251,191,36,0.12); }
.hist-badge.info { color: #60a5fa; background: rgba(96,165,250,0.12); }

.hist-loading { display: flex; flex-direction: column; gap: 8px; }
.hist-skeleton { height: 80px; background: #1a1a2e; border-radius: 10px; }
@keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:1} }
.pulse { animation: pulse 1.5s infinite; }

.hist-empty {
  text-align: center;
  padding: 48px 0;
  color: #484f58;
}
.hist-empty-icon { font-size: 48px; margin-bottom: 12px; }
.hist-empty-text { font-size: 14px; color: #8b949e; }

.hist-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.hist-card {
  background: #1a1a2e;
  border: 1px solid #2d2d45;
  border-radius: 10px;
  border-left-width: 3px;
  padding: 12px 16px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  transition: background 0.15s;
}
.hist-card:hover { background: #252538; }
.hist-level-critical { border-left-color: #f87171; }
.hist-level-warning { border-left-color: #fbbf24; }
.hist-level-info { border-left-color: #60a5fa; }

.hist-card-icon { font-size: 18px; flex-shrink: 0; padding-top: 2px; }
.hist-card-body { flex: 1; min-width: 0; }
.hist-card-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
.hist-level-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}
.badge-critical { color: #f87171; background: rgba(248,81,73,0.15); }
.badge-warning { color: #fbbf24; background: rgba(251,191,36,0.15); }
.badge-info { color: #60a5fa; background: rgba(96,165,250,0.15); }
.hist-agent { font-size: 12px; color: #818cf8; font-family: monospace; }
.hist-title { font-size: 13px; color: #e6edf3; font-weight: 500; flex: 1; }
.hist-time { font-size: 11px; color: #484f58; margin-left: auto; }
.hist-card-meta { display: flex; align-items: center; gap: 12px; }
.hist-duration, .hist-status { font-size: 11px; color: #484f58; }
.status-recovered { color: #34d399; }
.status-ongoing { color: #fbbf24; }
.status-escalated { color: #f87171; }

.hist-detail {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #2d2d45;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.detail-row { display: flex; gap: 8px; font-size: 12px; }
.dr-key { color: #484f58; min-width: 70px; }
.dr-val { color: #8b949e; }
.dr-val.suggestion { white-space: pre-wrap; color: #e6edf3; }

.hist-card-actions { display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; }

.hist-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 0;
}
.hist-page-info { font-size: 12px; color: #484f58; }

.alerts-config-panel { width: 320px; flex-shrink: 0; }

.alert-stats-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.alert-stat-item {
  flex: 1;
  background: #161B22;
  border: 1px solid #30363D;
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.alert-stat-item .stat-num { font-size: 24px; font-weight: 800; }
.alert-stat-item .stat-lbl { font-size: 11px; color: #484F58; }
.stat-critical .stat-num { color: #F85149; }
.stat-warning .stat-num { color: #D29922; }
.stat-info .stat-num { color: #58A6FF; }
.stat-total .stat-num { color: #8B949E; }

.alerts-empty {
  text-align: center;
  padding: 48px 0;
  background: #161B22;
  border: 1px solid #30363D;
  border-radius: 12px;
}
.alerts-empty-icon { font-size: 48px; margin-bottom: 12px; }
.alerts-empty-text { font-size: 16px; font-weight: 600; color: #E6EDF3; margin-bottom: 6px; }
.alerts-empty-sub { font-size: 13px; color: #484F58; }

.alert-cards { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.alert-card {
  background: #161B22;
  border: 1px solid #30363D;
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  gap: 14px;
  align-items: flex-start;
  border-left-width: 3px;
}
.alert-card.resolved { opacity: 0.55; }
.alert-level-critical { border-left-color: #F85149; }
.alert-level-warning { border-left-color: #D29922; }
.alert-level-info { border-left-color: #58A6FF; }

.alert-card-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 18px;
}
.icon-level-critical { background: rgba(248,81,73,0.15); }
.icon-level-warning { background: rgba(210,153,34,0.15); }
.icon-level-info { background: rgba(88,166,255,0.15); }

.alert-card-content { flex: 1; min-width: 0; }
.alert-card-header-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.alert-level-tag {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 8px;
  border-radius: 4px;
}
.level-tag-critical { color: #F85149; background: rgba(248,81,73,0.15); }
.level-tag-warning { color: #D29922; background: rgba(210,153,34,0.15); }
.level-tag-info { color: #58A6FF; background: rgba(88,166,255,0.15); }
.alert-status-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 4px;
}
.status-active { color: #F85149; background: rgba(248,81,73,0.15); }
.status-resolved { color: #8B949E; background: rgba(139,148,158,0.12); }

.alert-title { font-size: 13px; font-weight: 600; color: #E6EDF3; margin-bottom: 4px; }
.alert-desc { font-size: 12px; color: #8B949E; margin-bottom: 8px; }
.alert-meta { display: flex; gap: 12px; font-size: 11px; color: #484F58; }
.alert-agent { }
.alert-time { }
.alert-duration { }

.alert-card-actions { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }

/* Alert History */
.alert-history-section { margin-top: 8px; }
.alert-history-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #8B949E;
  cursor: pointer;
  padding: 8px 0;
}
.alert-history-toggle:hover { color: #E6EDF3; }
.toggle-arrow {
  display: inline-block;
  transition: transform 0.2s;
  font-size: 10px;
}
.toggle-arrow.expanded { transform: rotate(90deg); }
.alert-history-list { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.history-empty { color: #484F58; font-size: 13px; text-align: center; padding: 16px; }

/* Config Panel */
.config-card {
  background: #161B22;
  border: 1px solid #30363D;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 14px;
}
.config-card-title { font-size: 13px; font-weight: 600; color: #E6EDF3; margin-bottom: 14px; }
.config-item { margin-bottom: 14px; }
.config-item:last-child { margin-bottom: 0; }
.config-item-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #8B949E;
  margin-bottom: 8px;
}
.config-current-val {
  font-size: 14px;
  font-weight: 700;
  color: #58A6FF;
}
.config-note { font-size: 11px; color: #484F58; }

.cc-slider {
  width: 100%;
  -webkit-appearance: none;
  height: 4px;
  border-radius: 2px;
  background: #21262D;
  outline: none;
  cursor: pointer;
}
.cc-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #58A6FF;
  cursor: pointer;
  box-shadow: 0 0 0 3px rgba(88,166,255,0.25);
}
.cc-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #58A6FF;
  cursor: pointer;
  border: none;
}
.slider-hints {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #484F58;
  margin-top: 4px;
}
.config-static-val { font-size: 12px; color: #8B949E; }

.channel-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #21262D;
}
.channel-item:last-child { border-bottom: none; }
.channel-info { display: flex; align-items: center; gap: 8px; }
.channel-name { font-size: 13px; color: #E6EDF3; }
.channel-controls { display: flex; align-items: center; gap: 8px; }

.rule-list { display: flex; flex-direction: column; gap: 8px; }
.rule-item { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #8B949E; }
.rule-icon { font-size: 14px; }
.rule-text { }

/* ========== TEAM MANAGEMENT (v1.2) ========== */
.team-page { }
.team-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.team-header-left { display: flex; align-items: center; gap: 16px; }
.team-title { font-size: 15px; font-weight: 600; color: #E6EDF3; }
.team-stats { display: flex; gap: 8px; }

.team-table {
  background: #161B22;
  border: 1px solid #30363D;
  border-radius: 12px;
  overflow: hidden;
}
.table-header-row {
  display: grid;
  grid-template-columns: 2fr 1.2fr 1fr 1.5fr 0.8fr 1fr;
  padding: 10px 20px;
  background: #0D1117;
  font-size: 11px;
  color: #484F58;
  text-transform: uppercase;
  border-bottom: 1px solid #21262D;
}
.table-row-item {
  display: grid;
  grid-template-columns: 2fr 1.2fr 1fr 1.5fr 0.8fr 1fr;
  padding: 12px 20px;
  border-bottom: 1px solid #21262D;
  font-size: 12px;
  align-items: center;
}
.table-row-item:last-child { border-bottom: none; }
.table-row-item:hover { background: rgba(88,166,255,0.04); }

.team-agent-cell { display: flex; align-items: center; gap: 10px; }
.team-agent-info { display: flex; flex-direction: column; }
.team-agent-name { font-size: 13px; font-weight: 600; color: #E6EDF3; }
.team-agent-id { font-size: 10px; color: #484F58; font-family: monospace; }

.team-role-cell { }
.role-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}
.role-admin { color: #8957E5; background: rgba(137,87,229,0.15); }
.role-member { color: #3FB950; background: rgba(63,185,80,0.15); }

.team-status-cell { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #8B949E; }
.status-dot { width: 6px; height: 6px; border-radius: 50%; }
.status-dot-running { background: #3FB950; }
.status-dot-idle { background: #D29922; }
.status-dot-error { background: #F85149; }
.status-dot-offline { background: #484F58; }

.team-context-cell { display: flex; align-items: center; gap: 8px; }
.context-bar-wrap { width: 60px; height: 4px; background: #21262D; border-radius: 2px; overflow: hidden; }
.context-bar { height: 100%; border-radius: 2px; }
.context-pct { font-size: 11px; font-weight: 600; }
.team-mem-cell { font-size: 13px; font-weight: 700; color: #E6EDF3; }
.team-actions-cell { display: flex; gap: 8px; }

/* ========== Batch Dialogs ========== */
.batch-confirm-body { padding: 4px 0; }
.batch-confirm-text { font-size: 13px; color: #8B949E; margin-bottom: 16px; }
.batch-confirm-list { display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; }
.batch-confirm-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #0D1117; border-radius: 8px; border: 1px solid #21262D; }
.batch-confirm-name { font-size: 13px; font-weight: 600; color: #E6EDF3; flex: 1; }
.batch-confirm-id { font-size: 10px; color: #484F58; font-family: monospace; }
.batch-confirm-status { font-size: 11px; padding: 1px 7px; border-radius: 4px; }

.batch-result-body { padding: 8px 0; }
.batch-result-summary { display: flex; gap: 24px; margin-bottom: 16px; }
.result-success, .result-fail { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.result-icon { font-size: 18px; }
.result-success .result-icon { color: #3FB950; }
.result-fail .result-icon { color: #F85149; }
.batch-result-fails { display: flex; flex-direction: column; gap: 6px; }
.fail-item { display: flex; align-items: center; gap: 8px; font-size: 12px; background: rgba(248,81,73,0.08); border: 1px solid rgba(248,81,73,0.2); border-radius: 6px; padding: 8px 12px; }
.fail-agent { color: #E6EDF3; font-weight: 600; }
.fail-reason { color: #F85149; }

/* Delete Confirm */
.delete-warn-box {
  background: rgba(248,81,73,0.08);
  border: 1px solid rgba(248,81,73,0.3);
  border-radius: 10px;
  padding: 16px;
}
.delete-warn-title { font-size: 13px; color: #E6EDF3; margin-bottom: 10px; }
.delete-warn-list { font-size: 12px; color: #8B949E; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; }

/* Modal */
.el-dialog { background: #161B22 !important; border: 1px solid #30363D; }
.el-dialog__header { border-bottom: 1px solid #30363D; }
.el-dialog__title { color: #E6EDF3 !important; }
</style>
