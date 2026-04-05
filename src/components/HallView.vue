<template>
  <div class="hall-root">
    <!-- Left: Sidebar (Agent / Topic tabs) -->
    <aside class="hall-sidebar">
      <!-- Tab Switcher -->
      <div class="sidebar-tabs">
        <button
          class="sidebar-tab"
          :class="{ active: leftTab === 'agents' }"
          @click="leftTab = 'agents'"
        >
          🤖 成员
        </button>
        <button
          class="sidebar-tab"
          :class="{ active: leftTab === 'topics' }"
          @click="switchToTopics"
        >
          📌 话题
        </button>
        <button
          class="sidebar-tab"
          :class="{ active: leftTab === 'starred' }"
          @click="leftTab = 'starred'; loadStarredTasks()"
        >
          ⭐ 收藏
        </button>
      </div>

      <div class="hall-sidebar-header">
        <span class="sidebar-title">
          {{ leftTab === 'agents' ? '🏛 Hall' : leftTab === 'topics' ? '📌 话题' : '⭐ 收藏' }}
        </span>
        <span v-if="leftTab === 'agents'" class="agent-count-badge">{{ filteredAgents.length }}</span>
        <span v-if="leftTab === 'topics'" class="agent-count-badge">{{ topics.length }}</span>
      </div>

      <!-- Search (agents/topics) -->
      <div v-if="leftTab !== 'starred'" class="agent-search-wrap">
        <el-input
          v-model="agentSearch"
          :placeholder="leftTab === 'agents' ? '🔍 搜索成员...' : '🔍 搜索话题...'"
          size="small"
          clearable
          class="agent-search-input"
        />
      </div>

      <!-- Agent List (leftTab === 'agents') -->
      <div v-if="leftTab === 'agents'" class="agent-list">
        <div class="agent-status-filter">
          <button
            v-for="f in statusFilters"
            :key="f.value"
            class="status-filter-btn"
            :class="{ active: statusFilter === f.value }"
            @click="statusFilter = f.value"
          >
            {{ f.label }}
          </button>
        </div>

        <div
          v-for="agent in filteredAgents"
          :key="agent.id"
          class="agent-item"
          :class="{ selected: selectedAgentId === agent.id }"
          @click="selectedAgentId = agent.id"
        >
          <div class="agent-item-left">
            <div class="agent-status-dot" :class="'dot-' + agent.status"></div>
            <el-avatar :size="28" :style="{ backgroundColor: agent.color }">
              {{ agent.emoji }}
            </el-avatar>
            <div class="agent-item-info">
              <div class="agent-item-name">{{ agent.name }}</div>
              <div class="agent-item-role">{{ agent.role }}</div>
            </div>
          </div>
          <div class="agent-item-status" :class="'status-text-' + agent.status">
            {{ agentStatusLabel(agent.status) }}
          </div>
        </div>

        <div v-if="filteredAgents.length === 0" class="agent-list-empty">
          暂无匹配的成员
        </div>
      </div>

      <!-- Topics List (leftTab === 'topics') -->
      <div v-if="leftTab === 'topics'" class="topic-list">
        <!-- Create Topic Button -->
        <button class="create-topic-btn" @click="showCreateTopic = true">
          ➕ 新建话题
        </button>

        <div
          v-for="topic in filteredTopics"
          :key="topic.id"
          class="topic-item"
          :class="{ selected: selectedTopicId === topic.id }"
          @click="selectTopic(topic.id)"
        >
          <div class="topic-color-bar" :style="{ backgroundColor: topic.color }"></div>
          <div class="topic-info">
            <div class="topic-name">{{ topic.name }}</div>
            <div class="topic-meta">
              <span class="topic-creator">{{ topic.creatorName }}</span>
              <span class="topic-count">{{ topic.messageCount }} 条</span>
            </div>
          </div>
        </div>

        <div v-if="filteredTopics.length === 0" class="agent-list-empty">
          暂无话题
        </div>
      </div>

      <!-- Starred Tasks List (leftTab === 'starred') -->
      <div v-if="leftTab === 'starred'" class="topic-list">
        <div
          v-for="task in starredTasksList"
          :key="task.id"
          class="topic-item starred-task-item"
          @click="goToStarredTask(task)"
        >
          <div class="star-indicator">⭐</div>
          <div class="topic-info">
            <div class="topic-name">{{ task.title }}</div>
            <div class="topic-meta">
              <span class="status-pill small" :class="'pill-' + task.status">{{ statusLabel(task.status) }}</span>
              <span class="topic-count">{{ task.assigneeName }}</span>
            </div>
          </div>
        </div>

        <div v-if="starredTasksList.length === 0" class="agent-list-empty">
          暂无收藏任务
        </div>
      </div>
    </aside>

    <!-- Right: Main Content Area -->
    <main class="hall-main">
      <!-- Top Bar: Topic Header / Search -->
      <div class="hall-topbar">
        <!-- Active topic breadcrumb -->
        <div v-if="leftTab === 'topics' && selectedTopicName" class="topbar-breadcrumb">
          <span class="topic-color-dot" :style="{ backgroundColor: selectedTopicColor }"></span>
          <span class="topic-breadcrumb-name">{{ selectedTopicName }}</span>
          <button v-if="selectedTopicId" class="leave-topic-btn" @click="leaveTopic">✕ 退出话题</button>
        </div>

        <!-- Search Bar -->
        <div class="hall-search-bar">
          <div class="search-input-wrap">
            <span class="search-icon">🔍</span>
            <input
              v-model="searchQuery"
              class="hall-search-input"
              placeholder="搜索消息... (关键词 / 发送者 / 话题)   [Ctrl+K 快捷指令]"
              @keydown.enter="doSearch"
              @input="onSearchInput"
            />
            <button v-if="searchQuery" class="search-clear" @click="clearSearch">✕</button>
          </div>
          <!-- Search Filters -->
          <div v-if="showSearchFilters" class="search-filters">
            <div class="filter-row">
              <label class="filter-label">发送者</label>
              <select v-model="searchSenderId" class="filter-select">
                <option value="">全部</option>
                <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option>
              </select>
              <label class="filter-label">时间范围</label>
              <input v-model="searchStartDate" type="date" class="filter-date" />
              <span class="filter-sep">~</span>
              <input v-model="searchEndDate" type="date" class="filter-date" />
              <button class="filter-apply" @click="doSearch">应用</button>
            </div>
          </div>
        </div>

        <!-- View Toggle -->
        <div class="view-toggle">
          <button
            v-for="v in viewModes"
            :key="v.value"
            class="view-toggle-btn"
            :class="{ active: viewMode === v.value }"
            @click="viewMode = v.value"
          >
            {{ v.icon }} {{ v.label }}
          </button>
        </div>
      </div>

      <!-- Search Results Panel -->
      <div v-if="isSearching" class="search-results-panel">
        <div class="search-results-header">
          <span class="search-results-title">🔍 搜索结果</span>
          <span class="search-results-count">{{ searchResults.length }} 条</span>
          <button class="search-close" @click="clearSearch">✕ 关闭</button>
        </div>
        <div class="search-results-list">
          <div
            v-for="msg in searchResults"
            :key="msg.id"
            class="search-result-item"
            @click="jumpToMessage(msg)"
          >
            <div class="result-header">
              <span class="result-sender">{{ msg.senderName }}</span>
              <span class="result-time">{{ formatTime(msg.timestamp) }}</span>
              <span v-if="msg.topicId" class="result-topic-badge">📌</span>
            </div>
            <div class="result-content" v-html="highlightSearch(msg.highlight || msg.content)"></div>
          </div>
          <div v-if="searchResults.length === 0" class="search-empty">
            未找到匹配的消息
          </div>
        </div>
      </div>

      <!-- Message List -->
      <div class="message-list" ref="messageListRef">
        <!-- Load More History -->
        <div v-if="hasMoreMessages && !isSearching" class="load-more-wrap">
          <button class="load-more-btn" @click="loadMoreMessages" :disabled="loadingMore">
            {{ loadingMore ? '⏳ 加载中...' : '📜 加载更多消息' }}
          </button>
          <span class="history-hint">历史消息</span>
        </div>

        <template v-for="(group, groupKey) in groupedMessages" :key="groupKey">
          <!-- Time Divider -->
          <div class="time-divider">
            <span class="time-divider-label">{{ groupKey }}</span>
          </div>

          <!-- Messages in group -->
          <div
            v-for="msg in group"
            :key="msg.id"
            class="message-row"
            :class="{
              'msg-own': msg.senderId === currentUserId,
              'msg-historical': isHistorical(msg)
            }"
          >
            <!-- Task Card (Phase 2+3) -->
            <div v-if="msg.isTask && msg.task" class="task-card-wrap">
              <div
                class="task-card phase2"
                :class="[
                  'status-' + msg.task.status,
                  { expanded: expandedTasks.has(msg.task.id) }
                ]"
                @click="toggleTaskExpand(msg.task.id)"
              >
                <!-- Card Header (always visible) -->
                <div class="card-header">
                  <span class="card-header-left">
                    <span class="task-icon">📋</span>
                    <span class="task-title-short">{{ msg.task.title | truncate(50) }}</span>
                  </span>
                  <div class="card-header-right">
                    <!-- Star Button (Phase 3) -->
                    <button
                      class="star-btn"
                      :class="{ starred: isStarred(msg.task.id) }"
                      @click.stop="toggleStar(msg.task)"
                      :title="isStarred(msg.task.id) ? '取消收藏' : '收藏任务'"
                    >
                      {{ isStarred(msg.task.id) ? '⭐' : '☆' }}
                    </button>
                    <!-- Running progress bar -->
                    <div v-if="msg.task.status === 'running'" class="progress-wrapper">
                      <div class="progress-indeterminate"></div>
                    </div>
                    <!-- Status pill -->
                    <span class="status-pill" :class="'pill-' + msg.task.status">
                      {{ statusLabel(msg.task.status) }}
                    </span>
                    <!-- Running spin icon -->
                    <span v-if="msg.task.status === 'running'" class="icon-running">🔄</span>
                    <!-- Expand toggle -->
                    <span class="expand-toggle">{{ expandedTasks.has(msg.task.id) ? '▼' : '▶' }}</span>
                  </div>
                </div>

                <!-- Card Body (expanded) -->
                <div v-if="expandedTasks.has(msg.task.id)" class="card-body" @click.stop>
                  <!-- Basic Info -->
                  <div class="info-section">
                    <div class="info-row">
                      <span class="info-label">任务 ID</span>
                      <span class="info-value">{{ msg.task.id }}</span>
                    </div>
                    <div class="info-row" v-if="msg.task.description">
                      <span class="info-label">任务描述</span>
                      <span class="info-value">{{ msg.task.description }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">指派给</span>
                      <span class="info-value highlight">{{ msg.task.assigneeName }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">发起人</span>
                      <span class="info-value">{{ msg.task.assignerName || msg.task.assigner }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">创建时间</span>
                      <span class="info-value">{{ formatDateTime(msg.task.createdAt) }}</span>
                    </div>
                    <div class="info-row" v-if="msg.task.deadline">
                      <span class="info-label">截止时间</span>
                      <span class="info-value">{{ msg.task.deadline }}</span>
                    </div>
                    <div class="info-row" v-if="msg.task.startedAt">
                      <span class="info-label">开始时间</span>
                      <span class="info-value">{{ formatDateTime(msg.task.startedAt) }}</span>
                    </div>
                    <div class="info-row" v-if="msg.task.acceptedAt">
                      <span class="info-label">接受时间</span>
                      <span class="info-value">{{ formatDateTime(msg.task.acceptedAt) }}</span>
                    </div>
                    <div class="info-row" v-if="msg.task.duration">
                      <span class="info-label">执行耗时</span>
                      <span class="info-value">{{ msg.task.duration }}秒</span>
                    </div>
                  </div>

                  <!-- Execution Chain Bar (Phase 2) -->
                  <div v-if="msg.task.executionChain && msg.task.executionChain.length > 0" class="chain-section">
                    <div class="section-title">执行链 🔗</div>
                    <div class="chain-bar">
                      <template v-for="(step, idx) in msg.task.executionChain" :key="step.stepId">
                        <div class="chain-step" :class="'chain-step-' + step.status">
                          <div class="step-status-icon">
                            <span v-if="step.status === 'completed'">✅</span>
                            <span v-else-if="step.status === 'running'" class="exec-spinner">🔄</span>
                            <span v-else-if="step.status === 'failed'">❌</span>
                            <span v-else-if="step.status === 'skipped'">⏭</span>
                            <span v-else-if="step.status === 'locked'">🔒</span>
                            <span v-else>⏳</span>
                          </div>
                          <div class="step-agent">{{ step.agentName || step.agentId }}</div>
                          <div class="step-time" v-if="step.startedAt">
                            {{ step.status === 'completed' && step.completedAt
                              ? formatTime(step.completedAt)
                              : formatTime(step.startedAt) }}
                          </div>
                          <div class="step-time" v-else>—</div>
                        </div>
                        <div v-if="idx < msg.task.executionChain.length - 1" class="chain-arrow">
                          <span :class="msg.task.executionChain[idx + 1].status !== 'locked' && msg.task.executionChain[idx + 1].status !== 'skipped' ? 'arrow-active' : 'arrow-inactive'">→</span>
                        </div>
                      </template>
                    </div>
                  </div>

                  <!-- Result Section -->
                  <div v-if="msg.task.status === 'completed' && msg.task.result" class="result-section">
                    <div class="section-title">
                      执行结果
                      <button class="btn-ghost" @click="copyResult(msg.task.result)">📋 复制</button>
                    </div>
                    <pre class="result-code-block">{{ msg.task.result }}</pre>
                  </div>

                  <!-- Failure Reason -->
                  <div v-if="msg.task.status === 'failed' && msg.task.failureReason" class="failure-section">
                    <div class="section-title">失败原因</div>
                    <div class="failure-reason">❌ {{ msg.task.failureReason }}</div>
                  </div>

                  <!-- Execution Logs -->
                  <div v-if="msg.task.logs && msg.task.logs.length > 0" class="log-section">
                    <div class="section-title">执行日志</div>
                    <div class="log-list">
                      <div v-for="(log, i) in msg.task.logs" :key="i" class="log-entry">
                        <span class="log-time">{{ log.time }}</span>
                        <span class="log-agent" :style="{ color: log.agentColor || '#58A6FF' }">{{ log.agent }}</span>
                        <span class="log-text">{{ log.text }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Action Footer -->
                <div class="card-footer" @click.stop>
                  <template v-if="msg.task.status === 'pending'">
                    <button class="task-btn task-btn-accept" @click="acceptTask(msg.task)">✅ 接受</button>
                    <button class="task-btn task-btn-reject" @click="rejectTask(msg.task)">❌ 拒绝</button>
                  </template>
                  <template v-else-if="msg.task.status === 'accepted'">
                    <button class="task-btn task-btn-execute" @click="executeTask(msg.task)">▶️ 开始执行</button>
                  </template>
                  <template v-else-if="msg.task.status === 'running'">
                    <button class="task-btn task-btn-complete" @click="completeTask(msg.task)">✅ 完成</button>
                    <button class="task-btn task-btn-fail" @click="failTask(msg.task)">❌ 失败</button>
                  </template>
                </div>
              </div>

              <!-- Sender Meta -->
              <div class="msg-meta">
                <span class="msg-sender">{{ msg.senderName }}</span>
                <span class="msg-time">{{ formatTime(msg.timestamp) }}</span>
                <span v-if="msg.topicId" class="msg-topic-badge">📌</span>
              </div>
            </div>

            <!-- Regular Message Bubble -->
            <div v-else class="message-bubble-wrap">
              <div class="message-bubble" :class="{ own: msg.senderId === currentUserId }">
                <div class="bubble-header">
                  <span class="bubble-sender-emoji">{{ msg.senderEmoji }}</span>
                  <span class="bubble-sender-name">{{ msg.senderName }}</span>
                  <span class="bubble-time">{{ formatTime(msg.timestamp) }}</span>
                </div>
                <div class="bubble-content" v-html="renderContent(msg.content)"></div>
              </div>
            </div>
          </div>
        </template>

        <!-- Empty State -->
        <div v-if="messages.length === 0 && !isSearching" class="hall-empty">
          <div class="hall-empty-icon">🏛</div>
          <div class="hall-empty-text">
            {{ leftTab === 'topics' && !selectedTopicId ? '选择一个话题查看消息' : '协作大厅空空如也' }}
          </div>
          <div class="hall-empty-sub">发送消息开始讨论，或用 @ 指派任务给成员</div>
        </div>
      </div>

      <!-- Input Area -->
      <div class="hall-input-area">
        <!-- @ Mention Picker -->
        <div v-if="showAgentPicker" class="agent-picker" ref="agentPickerRef">
          <div class="agent-picker-header">
            <span>选择要 @ 的成员</span>
            <button class="picker-close" @click="showAgentPicker = false">✕</button>
          </div>
          <div class="agent-picker-list">
            <div
              v-for="agent in filteredPickerAgents"
              :key="agent.id"
              class="picker-agent-item"
              @click="insertAtMention(agent)"
            >
              <div class="agent-status-dot small" :class="'dot-' + agent.status"></div>
              <el-avatar :size="20" :style="{ backgroundColor: agent.color }">{{ agent.emoji }}</el-avatar>
              <span class="picker-agent-name">{{ agent.name }}</span>
              <span class="picker-agent-role">{{ agent.role }}</span>
            </div>
          </div>
        </div>

        <!-- Quick Commands Panel (Phase 3) -->
        <div v-if="showCommandsPanel" class="commands-panel" ref="commandsPanelRef">
          <div class="commands-header">
            <span>⚡ 快捷指令</span>
            <button class="picker-close" @click="showCommandsPanel = false">✕</button>
          </div>
          <div class="commands-list">
            <div
              v-for="cmd in filteredCommands"
              :key="cmd.id"
              class="command-item"
              @click="executeCommand(cmd)"
            >
              <span class="cmd-icon">{{ cmd.icon }}</span>
              <div class="cmd-info">
                <div class="cmd-name">{{ cmd.name }}</div>
                <div class="cmd-desc">{{ cmd.description }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Create Topic Modal -->
        <div v-if="showCreateTopic" class="modal-overlay" @click.self="showCreateTopic = false">
          <div class="modal-box">
            <div class="modal-title">➕ 创建新话题</div>
            <div class="modal-field">
              <label>话题名称</label>
              <input v-model="newTopicName" class="modal-input" placeholder="例如: #Bug讨论" />
            </div>
            <div class="modal-field">
              <label>颜色标签</label>
              <div class="color-picker">
                <button
                  v-for="c in topicColors"
                  :key="c"
                  class="color-swatch"
                  :class="{ selected: newTopicColor === c }"
                  :style="{ backgroundColor: c }"
                  @click="newTopicColor = c"
                ></button>
              </div>
            </div>
            <div class="modal-actions">
              <button class="modal-cancel" @click="showCreateTopic = false">取消</button>
              <button class="modal-confirm" @click="createTopic">创建</button>
            </div>
          </div>
        </div>

        <!-- Input Row -->
        <div class="input-row">
          <div class="input-wrap" :class="{ 'has-mentions': mentionAgents.length > 0 }">
            <!-- Mention Tags -->
            <div v-if="mentionAgents.length > 0" class="mention-tags">
              <span v-for="ma in mentionAgents" :key="ma.id" class="mention-tag">
                @{{ ma.name }}
                <button class="mention-tag-remove" @click="removeMention(ma.id)">×</button>
              </span>
            </div>

            <textarea
              ref="inputRef"
              v-model="inputText"
              class="hall-input"
              :placeholder="mentionAgents.length > 0 ? '输入任务描述...' : '💬 输入消息... (/ 快捷指令  @ 指派任务)'"
              rows="1"
              @keydown.enter.exact.prevent="sendMessage"
              @keydown.enter.shift.enter="inputText += '\n'"
              @input="onInputChange"
              @keyup="onKeyUp"
            ></textarea>
          </div>

          <button
            class="send-btn"
            :disabled="!canSend"
            @click="sendMessage"
          >
            ▶ 发送
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'

// ─── State ──────────────────────────────────────────────────────────────────
const messages = ref([])
const agents = ref([])
const topics = ref([])
const inputText = ref('')
const mentionAgents = ref([])
const showAgentPicker = ref(false)
const agentSearch = ref('')
const statusFilter = ref('all')
const selectedAgentId = ref(null)
const messageListRef = ref(null)
const inputRef = ref(null)
const agentPickerRef = ref(null)
const currentUserId = ref('pd')
const currentUserName = ref('PD')
const currentUserEmoji = ref('👔')

// Phase 3: Left sidebar tab
const leftTab = ref('agents') // 'agents' | 'topics' | 'starred'
const selectedTopicId = ref(null)
const selectedTopicName = ref('')
const selectedTopicColor = ref('#6C8EEF')
const showCreateTopic = ref(false)
const newTopicName = ref('')
const newTopicColor = ref('#6C8EEF')

// Phase 3: Search
const searchQuery = ref('')
const isSearching = ref(false)
const searchResults = ref([])
const showSearchFilters = ref(false)
const searchSenderId = ref('')
const searchStartDate = ref('')
const searchEndDate = ref('')

// Phase 3: Pagination
const currentPage = ref(1)
const pageSize = ref(20)
const hasMoreMessages = ref(true)
const loadingMore = ref(false)

// Phase 3: View modes
const viewMode = ref('all') // 'all' | 'mine' | 'tasks'
const viewModes = [
  { value: 'all', label: '全部', icon: '💬' },
  { value: 'mine', label: '我的', icon: '👤' },
  { value: 'tasks', label: '任务', icon: '📋' },
]

// Phase 3: Starred tasks
const starredTasksList = ref([])
const starredSet = ref(new Set(JSON.parse(localStorage.getItem('hall_starred') || '["HT-001"]')))

// Phase 3: Commands
const showCommandsPanel = ref(false)
const commandSearch = ref('')

const topicColors = ['#6C8EEF', '#EF4444', '#22C55E', '#EAB308', '#A855F7', '#EC4899', '#14B8A6', '#F97316']

const commands = [
  { id: 'task-dev', icon: '📋', name: '/任务 @Dev', description: '创建任务并指派给 Dev', pattern: '/任务' },
  { id: 'topic-new', icon: '📌', name: '/话题', description: '新建话题分组', pattern: '/话题' },
  { id: 'search', icon: '🔍', name: '/搜索', description: '搜索历史消息', pattern: '/搜索' },
  { id: 'my-tasks', icon: '👤', name: '/我的任务', description: '查看我的任务列表', pattern: '/我的任务' },
  { id: 'starred', icon: '⭐', name: '/收藏', description: '查看收藏的任务', pattern: '/收藏' },
  { id: 'clear', icon: '🗑', name: '/清空', description: '清空搜索和筛选', pattern: '/清空' },
]

const filteredCommands = computed(() => {
  if (!commandSearch.value) return commands
  const q = commandSearch.value.toLowerCase()
  return commands.filter(c =>
    c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
  )
})

// Phase 2: Expanded task tracking
const expandedTasks = ref(new Set())

const statusFilters = [
  { label: '全部', value: 'all' },
  { label: '活跃', value: 'active' },
  { label: '离线', value: 'offline' },
]

function toggleTaskExpand(taskId) {
  if (expandedTasks.value.has(taskId)) {
    expandedTasks.value.delete(taskId)
  } else {
    expandedTasks.value.add(taskId)
  }
  expandedTasks.value = new Set(expandedTasks.value)
}

function isHistorical(msg) {
  const msgTime = new Date(msg.timestamp).getTime()
  const now = Date.now()
  return now - msgTime > 3600000 * 24 // older than 24h
}

// ─── Computed ────────────────────────────────────────────────────────────────
const filteredAgents = computed(() => {
  let list = agents.value
  if (statusFilter.value === 'active') {
    list = list.filter(a => a.status === 'running' || a.status === 'idle')
  } else if (statusFilter.value === 'offline') {
    list = list.filter(a => a.status === 'offline' || a.status === 'error')
  }
  if (agentSearch.value.trim()) {
    const q = agentSearch.value.toLowerCase()
    list = list.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q) ||
      a.role.toLowerCase().includes(q)
    )
  }
  return list
})

const filteredTopics = computed(() => {
  if (!agentSearch.value.trim()) return topics.value
  const q = agentSearch.value.toLowerCase()
  return topics.value.filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.creatorName.toLowerCase().includes(q)
  )
})

const filteredPickerAgents = computed(() => {
  if (!agentSearch.value.trim()) return agents.value
  const q = agentSearch.value.toLowerCase()
  return agents.value.filter(a =>
    a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)
  )
})

const canSend = computed(() => inputText.value.trim().length > 0 && !showCommandsPanel.value)

const displayedMessages = computed(() => {
  let msgs = messages.value
  if (viewMode.value === 'mine') {
    msgs = msgs.filter(m => m.senderId === currentUserId.value)
  } else if (viewMode.value === 'tasks') {
    msgs = msgs.filter(m => m.isTask)
  }
  return msgs
})

const groupedMessages = computed(() => {
  const groups = {}
  const now = new Date()
  const todayStr = now.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
  const yesterdayStr = new Date(now - 86400000).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })

  for (const msg of displayedMessages.value) {
    const d = new Date(msg.timestamp)
    const dateStr = d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
    let key = dateStr
    if (dateStr === todayStr) key = '📅 今天'
    else if (dateStr === yesterdayStr) key = '📅 昨天'
    else key = '📅 ' + dateStr

    if (!groups[key]) groups[key] = []
    groups[key].push(msg)
  }
  return groups
})

// ─── Helpers ─────────────────────────────────────────────────────────────────
function agentStatusLabel(s) {
  return { running: '执行中', idle: '空闲', offline: '离线', error: '异常' }[s] || s
}

function statusLabel(s) {
  return {
    pending: '待确认',
    accepted: '已接受',
    running: '执行中',
    completed: '已完成',
    failed: '失败',
    rejected: '已拒绝',
    locked: '锁定中',
    skipped: '已跳过',
  }[s] || s
}

function formatTime(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function renderContent(content) {
  return content.replace(/@([a-zA-Z0-9_-]+)/g, (match, id) => {
    const agent = agents.value.find(a => a.id === id.toLowerCase())
    if (agent) return `<span class="at-mention">@${agent.name}</span>`
    return `<span class="at-mention">@${id}</span>`
  })
}

function highlightSearch(text) {
  if (!searchQuery.value || !text) return text
  const escaped = searchQuery.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(escaped, 'gi'), match => `<mark class="search-highlight">${match}</mark>`)
}

function scrollToBottom() {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  })
}

function copyResult(text) {
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('已复制到剪贴板')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

// ─── Phase 3: Topics ────────────────────────────────────────────────────────
async function loadTopics() {
  try {
    const res = await fetch('/api/hall/topics')
    const data = await res.json()
    if (data.ok) topics.value = data.topics
  } catch (e) {
    console.error('Failed to load topics:', e)
  }
}

async function createTopic() {
  if (!newTopicName.value.trim()) {
    ElMessage.warning('请输入话题名称')
    return
  }
  try {
    const res = await fetch('/api/hall/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newTopicName.value,
        color: newTopicColor.value,
        creatorId: currentUserId.value,
        creatorName: currentUserName.value,
      })
    })
    const data = await res.json()
    if (data.ok) {
      topics.value.push(data.topic)
      showCreateTopic.value = false
      newTopicName.value = ''
      newTopicColor.value = '#6C8EEF'
      ElMessage.success('话题已创建：' + data.topic.name)
      // Auto-select the new topic
      selectTopic(data.topic.id)
    }
  } catch (e) {
    ElMessage.error('创建话题失败')
  }
}

function switchToTopics() {
  leftTab.value = 'topics'
  selectedTopicId.value = null
  selectedTopicName.value = ''
  loadTopics()
}

async function selectTopic(topicId) {
  selectedTopicId.value = topicId
  const topic = topics.value.find(t => t.id === topicId)
  if (topic) {
    selectedTopicName.value = topic.name
    selectedTopicColor.value = topic.color
  }
  currentPage.value = 1
  await loadTopicMessages(topicId)
}

function leaveTopic() {
  selectedTopicId.value = null
  selectedTopicName.value = ''
  messages.value = []
  loadMessages()
}

async function loadTopicMessages(topicId, page = 1) {
  try {
    const res = await fetch(`/api/hall/topics/${topicId}/messages?page=${page}&pageSize=${pageSize.value}`)
    const data = await res.json()
    if (data.ok) {
      if (page === 1) {
        messages.value = data.messages
      } else {
        messages.value = [...messages.value, ...data.messages]
      }
      hasMoreMessages.value = data.pagination.hasMore
      currentPage.value = page
    }
  } catch (e) {
    console.error('Failed to load topic messages:', e)
  }
}

// ─── Phase 3: Search ─────────────────────────────────────────────────────────
async function doSearch() {
  if (!searchQuery.value.trim() && !searchSenderId.value) {
    ElMessage.warning('请输入搜索关键词')
    return
  }
  try {
    const params = new URLSearchParams()
    if (searchQuery.value.trim()) params.set('q', searchQuery.value)
    if (searchSenderId.value) params.set('senderId', searchSenderId.value)
    if (searchStartDate.value) params.set('startDate', searchStartDate.value)
    if (searchEndDate.value) params.set('endDate', searchEndDate.value)
    params.set('page', '1')
    params.set('pageSize', '50')

    const res = await fetch(`/api/hall/messages/search?${params}`)
    const data = await res.json()
    if (data.ok) {
      searchResults.value = data.results
      isSearching.value = true
    }
  } catch (e) {
    ElMessage.error('搜索失败')
  }
}

function clearSearch() {
  searchQuery.value = ''
  searchResults.value = []
  isSearching.value = false
  searchSenderId.value = ''
  searchStartDate.value = ''
  searchEndDate.value = ''
}

function onSearchInput() {
  showSearchFilters.value = searchQuery.value.length > 0
}

function jumpToMessage(msg) {
  // Add to current view and scroll to it
  isSearching.value = false
  expandedTasks.value.add(msg.task?.id)
  expandedTasks.value = new Set(expandedTasks.value)
  scrollToBottom()
}

// ─── Phase 3: Pagination ─────────────────────────────────────────────────────
async function loadMoreMessages() {
  if (loadingMore.value || !hasMoreMessages.value) return
  loadingMore.value = true
  try {
    const nextPage = currentPage.value + 1
    if (selectedTopicId.value) {
      await loadTopicMessages(selectedTopicId.value, nextPage)
    } else {
      const params = new URLSearchParams({ page: nextPage, pageSize: pageSize.value })
      const res = await fetch(`/api/hall/messages?${params}`)
      const data = await res.json()
      if (data.ok) {
        messages.value = [...messages.value, ...data.messages]
        hasMoreMessages.value = data.pagination.hasMore
        currentPage.value = nextPage
      }
    }
  } catch (e) {
    ElMessage.error('加载更多失败')
  } finally {
    loadingMore.value = false
  }
}

// ─── Phase 3: Starred Tasks ─────────────────────────────────────────────────
async function loadStarredTasks() {
  try {
    const res = await fetch('/api/hall/tasks/starred')
    const data = await res.json()
    if (data.ok) starredTasksList.value = data.tasks
  } catch (e) {
    // Fallback to local storage
    starredTasksList.value = []
  }
}

function isStarred(taskId) {
  return starredSet.value.has(taskId)
}

async function toggleStar(task) {
  const taskId = task.id
  const wasStarred = starredSet.value.has(taskId)

  // Optimistic update
  if (wasStarred) {
    starredSet.value.delete(taskId)
  } else {
    starredSet.value.add(taskId)
  }
  starredSet.value = new Set(starredSet.value)
  localStorage.setItem('hall_starred', JSON.stringify([...starredSet.value]))

  try {
    if (wasStarred) {
      await fetch(`/api/hall/tasks/${taskId}/star`, { method: 'DELETE' })
      ElMessage.info('已取消收藏')
    } else {
      await fetch(`/api/hall/tasks/${taskId}/star`, { method: 'POST' })
      ElMessage.success('已收藏 ⭐')
    }
  } catch (e) {
    // Revert on error
    if (wasStarred) {
      starredSet.value.add(taskId)
    } else {
      starredSet.value.delete(taskId)
    }
    starredSet.value = new Set(starredSet.value)
    localStorage.setItem('hall_starred', JSON.stringify([...starredSet.value]))
  }
}

function goToStarredTask(task) {
  leftTab.value = 'agents'
  expandedTasks.value.add(task.id)
  expandedTasks.value = new Set(expandedTasks.value)
  scrollToBottom()
}

// ─── Phase 3: Quick Commands ────────────────────────────────────────────────
function onInputChange() {
  const cursorPos = inputRef.value?.selectionStart || inputText.value.length
  const textBefore = inputText.value.substring(0, cursorPos)
  const lastAtIndex = textBefore.lastIndexOf('@')
  const lastSlashIndex = textBefore.lastIndexOf('/')

  // Check for slash command trigger
  if (lastSlashIndex !== -1 && lastSlashIndex === cursorPos - 1) {
    // User just typed /
    const textAfterSlash = textBefore.substring(lastSlashIndex + 1)
    if (!textAfterSlash.includes(' ') && !textAfterSlash.includes('\n')) {
      commandSearch.value = textAfterSlash
      showCommandsPanel.value = true
      showAgentPicker.value = false
      return
    }
  }

  if (lastSlashIndex > lastAtIndex && !textBefore.substring(lastSlashIndex).includes('@')) {
    const textAfterSlash = textBefore.substring(lastSlashIndex + 1)
    if (!textAfterSlash.includes(' ') && !textAfterSlash.includes('\n')) {
      commandSearch.value = textAfterSlash
      showCommandsPanel.value = true
      showAgentPicker.value = false
      return
    }
  }

  if (lastAtIndex !== -1) {
    const textAfterAt = textBefore.substring(lastAtIndex + 1)
    if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
      agentSearch.value = textAfterAt
      showAgentPicker.value = true
      showCommandsPanel.value = false
      return
    }
  }

  showAgentPicker.value = false
  showCommandsPanel.value = false
  agentSearch.value = ''
}

function onKeyUp(e) {
  if (e.key === 'Escape') {
    showAgentPicker.value = false
    showCommandsPanel.value = false
  }
}

function executeCommand(cmd) {
  showCommandsPanel.value = false

  if (cmd.id === 'task-dev') {
    inputText.value = '@dev '
    mentionAgents.value = []
    const dev = agents.value.find(a => a.id === 'dev')
    if (dev) mentionAgents.value.push(dev)
    inputRef.value?.focus()
  } else if (cmd.id === 'topic-new') {
    showCreateTopic.value = true
  } else if (cmd.id === 'search') {
    showSearchFilters.value = true
    inputRef.value?.focus()
  } else if (cmd.id === 'my-tasks') {
    viewMode.value = 'mine'
    ElMessage.info('已切换到「我的消息」视图')
  } else if (cmd.id === 'starred') {
    leftTab.value = 'starred'
    loadStarredTasks()
  } else if (cmd.id === 'clear') {
    clearSearch()
    viewMode.value = 'all'
    selectedTopicId.value = null
    messages.value = []
    loadMessages()
  }
}

function insertAtMention(agent) {
  const cursorPos = inputRef.value?.selectionStart || inputText.value.length
  const textBefore = inputText.value.substring(0, cursorPos)
  const lastAtIndex = textBefore.lastIndexOf('@')

  if (lastAtIndex !== -1) {
    const before = inputText.value.substring(0, lastAtIndex)
    const after = inputText.value.substring(cursorPos)
    inputText.value = before + '@' + agent.id + ' ' + after
  } else {
    inputText.value += '@' + agent.id + ' '
  }

  mentionAgents.value = mentionAgents.value.filter(m => m.id !== agent.id)
  mentionAgents.value.push(agent)
  showAgentPicker.value = false
  agentSearch.value = ''
  inputRef.value?.focus()
}

function removeMention(agentId) {
  mentionAgents.value = mentionAgents.value.filter(m => m.id !== agentId)
  inputText.value = inputText.value.replace(new RegExp('@' + agentId + '\\s*', 'g'), '')
}

// ─── API Calls ──────────────────────────────────────────────────────────────
async function loadMessages(page = 1) {
  try {
    const params = new URLSearchParams({ page, pageSize: pageSize.value })
    if (selectedTopicId.value) params.set('topicId', selectedTopicId.value)
    const res = await fetch(`/api/hall/messages?${params}`)
    const data = await res.json()
    if (data.ok) {
      if (page === 1) {
        messages.value = data.messages
      } else {
        messages.value = [...messages.value, ...data.messages]
      }
      hasMoreMessages.value = data.pagination.hasMore
      currentPage.value = page
    }
  } catch (e) {
    console.error('Failed to load messages:', e)
  }
}

async function loadAgents() {
  try {
    const res = await fetch('/api/hall/agents')
    const data = await res.json()
    if (data.ok) agents.value = data.agents
  } catch (e) {
    console.error('Failed to load agents:', e)
  }
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text) return

  try {
    const res = await fetch('/api/hall/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: currentUserId.value,
        senderName: currentUserName.value,
        senderEmoji: currentUserEmoji.value,
        content: text,
        topicId: selectedTopicId.value,
      })
    })
    const data = await res.json()
    if (data.ok) {
      messages.value = [data.message, ...messages.value]
      mentionAgents.value = []
      inputText.value = ''
      scrollToBottom()
    }
  } catch (e) {
    ElMessage.error('发送失败：' + e.message)
  }
}

// Phase 2: Accept task
async function acceptTask(task) {
  try {
    const res = await fetch(`/api/hall/tasks/${task.id}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept' })
    })
    const data = await res.json()
    if (data.ok) {
      ElMessage.success(`已接受任务 ${task.id}`)
      await loadMessages()
      expandedTasks.value.add(task.id)
      expandedTasks.value = new Set(expandedTasks.value)
    } else {
      ElMessage.error(data.error || '操作失败')
    }
  } catch (e) {
    ElMessage.error('操作失败：' + e.message)
  }
}

async function rejectTask(task) {
  try {
    const res = await fetch(`/api/hall/tasks/${task.id}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' })
    })
    const data = await res.json()
    if (data.ok) {
      ElMessage.info(`已拒绝任务 ${task.id}`)
      await loadMessages()
    } else {
      ElMessage.error(data.error || '操作失败')
    }
  } catch (e) {
    ElMessage.error('操作失败：' + e.message)
  }
}

async function executeTask(task) {
  try {
    const res = await fetch(`/api/hall/tasks/${task.id}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'execute', timeout: 300 })
    })
    const data = await res.json()
    if (data.ok) {
      ElMessage.success(`任务 ${task.id} 已开始执行`)
      await loadMessages()
    } else {
      ElMessage.error(data.error || '操作失败')
    }
  } catch (e) {
    ElMessage.error('执行失败：' + e.message)
  }
}

async function completeTask(task) {
  const result = prompt('请输入执行结果（可选）：', task.result || '')
  if (result === null) return
  try {
    const res = await fetch(`/api/hall/tasks/${task.id}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'complete',
        result: result || `${task.assigneeName} 已完成任务：${task.title}`,
      })
    })
    const data = await res.json()
    if (data.ok) {
      ElMessage.success(`任务 ${task.id} 已完成`)
      await loadMessages()
    } else {
      ElMessage.error(data.error || '操作失败')
    }
  } catch (e) {
    ElMessage.error('操作失败：' + e.message)
  }
}

async function failTask(task) {
  const reason = prompt('请输入失败原因：')
  if (reason === null) return
  try {
    const res = await fetch(`/api/hall/tasks/${task.id}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'fail', reason: reason || '执行失败' })
    })
    const data = await res.json()
    if (data.ok) {
      ElMessage.error(`任务 ${task.id} 已标记失败`)
      await loadMessages()
    } else {
      ElMessage.error(data.error || '操作失败')
    }
  } catch (e) {
    ElMessage.error('操作失败：' + e.message)
  }
}

// ─── Lifecycle ─────────────────────────────────────────────────────────────
let pollTimer = null
let alertPollTimer = null
let seenCriticalAlertIds = new Set()

// ─── Keyboard Shortcuts ────────────────────────────────────────────────────
function handleKeyDown(e) {
  // Ctrl+K: open commands panel
  if (e.ctrlKey && e.key === 'k') {
    e.preventDefault()
    showCommandsPanel.value = !showCommandsPanel.value
    showAgentPicker.value = false
    return
  }

  // Esc: close all panels/modals
  if (e.key === 'Escape') {
    showCommandsPanel.value = false
    showAgentPicker.value = false
    showCreateTopic.value = false
    return
  }

  // 1-5: switch left sidebar tabs (only when no input focused)
  const tag = document.activeElement?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

  if (e.key === '1') leftTab.value = 'agents'
  else if (e.key === '2') leftTab.value = 'topics'
  else if (e.key === '3') leftTab.value = 'starred'
  else if (e.key === '4') { leftTab.value = 'agents'; /* 快捷指令提示 */ showCommandsPanel.value = true }
  else if (e.key === '5') { /* 帮助提示 */ ElMessage.info('按 Ctrl+K 打开快捷指令面板') }
}

// ─── Critical Alert Polling ────────────────────────────────────────────────
async function pollCriticalAlerts() {
  try {
    const res = await fetch('/api/alerts?severity=critical&status=active')
    if (!res.ok) return
    const data = await res.json()
    const alerts = data.alerts || data.data || []

    for (const alert of alerts) {
      if (!seenCriticalAlertIds.has(alert.id)) {
        seenCriticalAlertIds.add(alert.id)
        await broadcastAlert(alert)
      }
    }
  } catch (e) {
    // Silently ignore polling errors
  }
}

async function broadcastAlert(alert) {
  const alertName = alert.alert_name || alert.name || 'Unknown Alert'
  const alertMessage = alert.message || alert.description || 'Critical alert detected'
  const content = `🚨 [Critical Alert] ${alertName} - ${alertMessage}`

  try {
    await fetch('/api/hall/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: 'system',
        senderName: '🚨 System',
        senderEmoji: '🚨',
        content,
        topicId: selectedTopicId.value,
      })
    })
    // Refresh messages if we're in a topic
    if (selectedTopicId.value) {
      await loadTopicMessages(selectedTopicId.value)
    } else {
      await loadMessages()
    }
  } catch (e) {
    console.error('Failed to broadcast critical alert:', e)
  }
}

onMounted(async () => {
  await loadAgents()
  await loadTopics()
  await loadMessages()
  scrollToBottom()
  pollTimer = setInterval(loadMessages, 5000)
  alertPollTimer = setInterval(pollCriticalAlerts, 30000)
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  if (alertPollTimer) clearInterval(alertPollTimer)
  window.removeEventListener('keydown', handleKeyDown)
})

function handleOutsideClick(e) {
  if (agentPickerRef.value && !agentPickerRef.value.contains(e.target) &&
      inputRef.value && !inputRef.value.contains(e.target) &&
      !e.target.closest('.commands-panel')) {
    showAgentPicker.value = false
    showCommandsPanel.value = false
  }
}

import { onMounted as om2, onUnmounted as ou2 } from 'vue'
om2(() => document.addEventListener('click', handleOutsideClick))
ou2(() => document.removeEventListener('click', handleOutsideClick))

const truncate = (val, len) => {
  if (!val) return ''
  return val.length > len ? val.substring(0, len) + '…' : val
}
</script>

<style scoped>
/* ─── Hall Root ─────────────────────────────────────────────────────────── */
.hall-root {
  display: flex;
  height: calc(100vh - 120px);
  min-height: 500px;
  background: #0D1117;
  border: 1px solid #30363D;
  border-radius: 12px;
  overflow: hidden;
}

/* ─── Sidebar ──────────────────────────────────────────────────────────── */
.hall-sidebar {
  width: 240px;
  flex-shrink: 0;
  background: #161B22;
  border-right: 1px solid #30363D;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ─── Sidebar Tabs (Phase 3) ──────────────────────────────────────────── */
.sidebar-tabs {
  display: flex;
  border-bottom: 1px solid #30363D;
}

.sidebar-tab {
  flex: 1;
  background: none;
  border: none;
  color: #484F58;
  font-size: 11px;
  font-weight: 600;
  padding: 10px 4px;
  cursor: pointer;
  transition: all 0.15s;
  border-bottom: 2px solid transparent;
}

.sidebar-tab.active {
  color: #58A6FF;
  border-bottom-color: #58A6FF;
}

.hall-sidebar-header {
  padding: 12px 16px;
  border-bottom: 1px solid #30363D;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sidebar-title {
  font-size: 13px;
  font-weight: 700;
  color: #E6EDF3;
}

.agent-count-badge {
  background: rgba(88,166,255,0.2);
  color: #58A6FF;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 10px;
}

.agent-search-wrap {
  padding: 10px 12px;
  border-bottom: 1px solid #21262D;
}

.agent-search-input {
  --el-input-bg-color: #0D1117;
  --el-input-border-color: #30363D;
  --el-input-text-color: #E6EDF3;
  --el-input-placeholder-color: #484F58;
}

.agent-status-filter {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid #21262D;
}

.status-filter-btn {
  flex: 1;
  background: none;
  border: 1px solid #30363D;
  border-radius: 6px;
  color: #8B949E;
  font-size: 11px;
  padding: 3px 0;
  cursor: pointer;
  transition: all 0.15s;
}

.status-filter-btn.active {
  background: rgba(88,166,255,0.15);
  border-color: #58A6FF;
  color: #58A6FF;
}

.agent-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

/* ─── Topic List (Phase 3) ────────────────────────────────────────────── */
.topic-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.create-topic-btn {
  display: block;
  width: calc(100% - 24px);
  margin: 0 12px 8px;
  padding: 7px 0;
  background: rgba(88,166,255,0.1);
  border: 1px dashed #30363D;
  border-radius: 8px;
  color: #58A6FF;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.create-topic-btn:hover {
  background: rgba(88,166,255,0.2);
  border-color: #58A6FF;
}

.topic-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s;
  border-left: 3px solid transparent;
}

.topic-item:hover { background: #1C2128; }
.topic-item.selected { background: rgba(88,166,255,0.08); border-left-color: #58A6FF; }

.topic-color-bar {
  width: 4px;
  height: 32px;
  border-radius: 2px;
  flex-shrink: 0;
}

.topic-info { flex: 1; min-width: 0; }

.topic-name {
  font-size: 12px;
  font-weight: 600;
  color: #E6EDF3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.topic-creator { font-size: 10px; color: #484F58; }
.topic-count { font-size: 10px; color: #484F58; margin-left: auto; }

/* Starred Task Item */
.starred-task-item { border-left-color: #EAB308; }
.star-indicator { font-size: 14px; }

/* ─── Agent Item (reused) ─────────────────────────────────────────────── */
.agent-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s;
  border-left: 3px solid transparent;
}

.agent-item:hover { background: #1C2128; }
.agent-item.selected { background: rgba(88,166,255,0.08); border-left-color: #58A6FF; }

.agent-item-left { display: flex; align-items: center; gap: 8px; }

.agent-status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.agent-status-dot.small { width: 6px; height: 6px; }
.dot-running { background: #22C55E; }
.dot-idle { background: #EAB308; }
.dot-offline { background: #EF4444; }
.dot-error { background: #EF4444; }

.agent-item-info { display: flex; flex-direction: column; }
.agent-item-name { font-size: 12px; font-weight: 600; color: #E6EDF3; }
.agent-item-role { font-size: 10px; color: #484F58; }

.agent-item-status { font-size: 10px; font-weight: 600; }
.status-text-running { color: #22C55E; }
.status-text-idle { color: #EAB308; }
.status-text-offline { color: #EF4444; }
.status-text-error { color: #EF4444; }

.agent-list-empty { text-align: center; color: #484F58; font-size: 12px; padding: 24px 0; }

/* ─── Main ─────────────────────────────────────────────────────────────── */
.hall-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ─── Top Bar (Phase 3) ──────────────────────────────────────────────── */
.hall-topbar {
  border-bottom: 1px solid #30363D;
  padding: 10px 16px;
  background: #161B22;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.topbar-breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
}

.topic-color-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.topic-breadcrumb-name {
  font-size: 13px;
  font-weight: 700;
  color: #E6EDF3;
}

.leave-topic-btn {
  background: none;
  border: none;
  color: #484F58;
  font-size: 11px;
  cursor: pointer;
  margin-left: auto;
}

.leave-topic-btn:hover { color: #EF4444; }

/* Search Bar */
.hall-search-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.search-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #0D1117;
  border: 1px solid #30363D;
  border-radius: 8px;
  padding: 6px 12px;
  transition: border-color 0.15s;
}

.search-input-wrap:focus-within { border-color: #58A6FF; }

.search-icon { font-size: 13px; flex-shrink: 0; }

.hall-search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: #E6EDF3;
  font-size: 13px;
  font-family: inherit;
}

.hall-search-input::placeholder { color: #484F58; }

.search-clear {
  background: none;
  border: none;
  color: #484F58;
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
}

.search-clear:hover { color: #EF4444; }

/* Search Filters */
.search-filters {
  background: #1C2128;
  border: 1px solid #30363D;
  border-radius: 8px;
  padding: 10px 12px;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-label { font-size: 11px; color: #8B949E; white-space: nowrap; }

.filter-select {
  background: #0D1117;
  border: 1px solid #30363D;
  border-radius: 6px;
  color: #E6EDF3;
  font-size: 12px;
  padding: 3px 8px;
  outline: none;
}

.filter-date {
  background: #0D1117;
  border: 1px solid #30363D;
  border-radius: 6px;
  color: #E6EDF3;
  font-size: 12px;
  padding: 3px 8px;
  outline: none;
}

.filter-sep { color: #484F58; font-size: 12px; }

.filter-apply {
  background: #58A6FF;
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  cursor: pointer;
  margin-left: auto;
}

/* View Toggle */
.view-toggle {
  display: flex;
  gap: 4px;
}

.view-toggle-btn {
  background: none;
  border: 1px solid #30363D;
  border-radius: 6px;
  color: #8B949E;
  font-size: 11px;
  padding: 3px 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.view-toggle-btn.active {
  background: rgba(88,166,255,0.15);
  border-color: #58A6FF;
  color: #58A6FF;
}

/* ─── Search Results Panel (Phase 3) ───────────────────────────────────── */
.search-results-panel {
  border-bottom: 1px solid #30363D;
  background: #161B22;
  max-height: 300px;
  overflow-y: auto;
}

.search-results-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid #21262D;
  position: sticky;
  top: 0;
  background: #161B22;
}

.search-results-title { font-size: 12px; font-weight: 700; color: #E6EDF3; }
.search-results-count { font-size: 11px; color: #8B949E; background: #21262D; padding: 1px 6px; border-radius: 8px; }
.search-close { background: none; border: none; color: #484F58; cursor: pointer; font-size: 11px; margin-left: auto; }
.search-close:hover { color: #EF4444; }

.search-results-list { padding: 8px 16px; display: flex; flex-direction: column; gap: 4px; }

.search-result-item {
  padding: 8px 12px;
  background: #1C2128;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.search-result-item:hover { background: rgba(88,166,255,0.1); }

.result-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.result-sender { font-size: 11px; font-weight: 700; color: #8B949E; }
.result-time { font-size: 10px; color: #484F58; }
.result-topic-badge { font-size: 10px; margin-left: auto; }

.result-content { font-size: 12px; color: #8B949E; line-height: 1.5; }

.result-content :deep(.search-highlight) {
  background: rgba(234,179,8,0.3);
  color: #EAB308;
  border-radius: 2px;
  padding: 0 2px;
}

.search-empty { text-align: center; color: #484F58; font-size: 12px; padding: 16px 0; }

/* ─── Message List ─────────────────────────────────────────────────────── */
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Load More */
.load-more-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 0;
}

.load-more-btn {
  background: rgba(88,166,255,0.1);
  border: 1px solid #30363D;
  border-radius: 8px;
  color: #58A6FF;
  font-size: 12px;
  font-weight: 600;
  padding: 8px 20px;
  cursor: pointer;
  transition: all 0.15s;
}

.load-more-btn:hover:not(:disabled) { background: rgba(88,166,255,0.2); border-color: #58A6FF; }
.load-more-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.history-hint { font-size: 10px; color: #484F58; background: #21262D; padding: 1px 8px; border-radius: 8px; }

/* Time Divider */
.time-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 12px 0 8px;
}

.time-divider-label {
  font-size: 11px;
  color: #484F58;
  background: #0D1117;
  padding: 2px 10px;
  border-radius: 10px;
  border: 1px solid #21262D;
}

.message-row { display: flex; flex-direction: column; margin-bottom: 8px; }
.message-row.msg-own { align-items: flex-end; }

/* Historical messages (Phase 3) */
.message-row.msg-historical .message-bubble,
.message-row.msg-historical .task-card {
  opacity: 0.7;
}

.message-row.msg-historical .bubble-content,
.message-row.msg-historical .task-title-short {
  color: #8B949E;
}

/* ─── Bubble ───────────────────────────────────────────────────────────── */
.message-bubble-wrap { display: flex; max-width: 70%; }
.msg-own .message-bubble-wrap { margin-left: auto; }

.message-bubble {
  background: #1E1E1E;
  border: 1px solid #30363D;
  border-radius: 12px;
  padding: 8px 12px;
  max-width: 100%;
}

.message-bubble.own {
  background: rgba(88,166,255,0.15);
  border-color: rgba(88,166,255,0.3);
}

.bubble-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.bubble-sender-emoji { font-size: 14px; }
.bubble-sender-name { font-size: 11px; font-weight: 700; color: #8B949E; }
.bubble-time { font-size: 10px; color: #484F58; margin-left: auto; }

.bubble-content {
  font-size: 13px;
  color: #E6EDF3;
  line-height: 1.5;
  word-break: break-all;
}

.bubble-content :deep(.at-mention) {
  color: #58A6FF;
  background: rgba(88,166,255,0.15);
  padding: 0 4px;
  border-radius: 3px;
  font-weight: 600;
}

.msg-meta { display: flex; align-items: center; gap: 6px; margin-top: 3px; font-size: 10px; color: #484F58; }
.msg-topic-badge { font-size: 10px; }

/* ═══════════════════════════════════════════════════════════════════════════
   Task Card (Phase 2 + Phase 3 Star)
   ═══════════════════════════════════════════════════════════════════════════ */

.task-card-wrap { width: 100%; max-width: 540px; }

.task-card.phase2 {
  background: #161B22;
  border: 1px solid #30363D;
  border-radius: 12px;
  overflow: hidden;
  transition: border-color 0.3s ease;
}

.task-card.status-pending  { border-left: 3px solid #9CA3AF; }
.task-card.status-accepted { border-left: 3px solid #6C8EEF; }
.task-card.status-running   { border-left: 3px solid #EAB308; }
.task-card.status-completed { border-left: 3px solid #22C55E; }
.task-card.status-failed   { border-left: 3px solid #EF4444; }
.task-card.status-rejected { border-left: 3px solid #F59E0B; }

.card-header {
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
}

.card-header-left { display: flex; align-items: center; gap: 8px; min-width: 0; }

.task-icon { font-size: 16px; flex-shrink: 0; }

.task-title-short {
  font-size: 13px;
  font-weight: 700;
  color: #E6EDF3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-header-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

/* Star Button (Phase 3) */
.star-btn {
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: all 0.15s;
  line-height: 1;
}

.star-btn:hover { transform: scale(1.2); }
.star-btn.starred { color: #EAB308; }

/* Status Pill */
.status-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  line-height: 1.4;
}

.status-pill.small { font-size: 9px; padding: 1px 6px; }

.pill-pending   { background: #2D2D2D; color: #9CA3AF; }
.pill-accepted { background: #1a2d4d; color: #6C8EEF; }
.pill-running  { background: #3d2a10; color: #EAB308; }
.pill-completed { background: #1a3d2a; color: #22C55E; }
.pill-failed   { background: #3d1a1a; color: #EF4444; }
.pill-rejected { background: #3d2a1a; color: #F59E0B; }

.icon-running { animation: spin 1s linear infinite; }
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.expand-toggle { font-size: 10px; color: #484F58; }

/* Indeterminate progress bar */
.progress-wrapper {
  width: 60px;
  height: 4px;
  background: #2D2D2D;
  border-radius: 2px;
  overflow: hidden;
}

.progress-indeterminate {
  height: 100%;
  background: linear-gradient(90deg, #EAB308 0%, #F59E0B 50%, #EAB308 100%);
  animation: indeterminate 1.8s ease-in-out infinite;
  border-radius: 2px;
}

@keyframes indeterminate {
  0%   { width: 0%; margin-left: 0; }
  50%  { width: 60%; margin-left: 20%; }
  100% { width: 0%; margin-left: 100%; }
}

.card-body {
  border-top: 1px solid #21262D;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.info-section { display: flex; flex-direction: column; gap: 5px; }

.info-row {
  display: flex;
  gap: 8px;
  font-size: 12px;
  line-height: 1.5;
}

.info-label { color: #484F58; min-width: 64px; flex-shrink: 0; }
.info-value { color: #8B949E; }
.info-value.highlight { color: #6C8EEF; font-weight: 600; }

.section-title {
  font-size: 11px;
  font-weight: 700;
  color: #8B949E;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Execution Chain Bar */
.chain-bar {
  display: flex;
  align-items: center;
  gap: 0;
  overflow-x: auto;
  padding-bottom: 4px;
}

.chain-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 64px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 2px solid #30363D;
  background: #1C2128;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.chain-step.completed { border-color: #22C55E; background: #1a3d2a; }
.chain-step.running {
  border-color: #EAB308;
  background: #3d2a10;
  animation: pulse-border 1.5s ease-in-out infinite;
}

.chain-step.failed { border-color: #EF4444; background: #3d1a1a; }
.chain-step.skipped { border-color: #484F58; background: #21262D; opacity: 0.6; }
.chain-step.locked { border-color: #21262D; background: #161B22; opacity: 0.5; }

@keyframes pulse-border {
  0%, 100% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0.4); }
  50%       { box-shadow: 0 0 0 4px rgba(234, 179, 8, 0.1); }
}

.step-status-icon { font-size: 16px; margin-bottom: 2px; }
.exec-spinner { animation: spin 1s linear infinite; display: inline-block; }

.step-agent {
  font-size: 11px;
  font-weight: 700;
  color: #E6EDF3;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.step-time { font-size: 10px; color: #484F58; margin-top: 2px; }

.chain-arrow { flex-shrink: 0; padding: 0 4px; font-size: 14px; }
.arrow-active { color: #22C55E; }
.arrow-inactive { color: #30363D; }

/* Result Section */
.btn-ghost {
  background: none;
  border: none;
  color: #8B949E;
  font-size: 11px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.15s;
  margin-left: auto;
}

.btn-ghost:hover { background: rgba(88,166,255,0.1); color: #58A6FF; }

.result-code-block {
  background: #0D0D0D;
  border: 1px solid #3D3D3D;
  border-radius: 8px;
  padding: 12px 16px;
  font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: #E5EAF3;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 300px;
  overflow-y: auto;
  margin: 0;
}

.failure-reason {
  font-size: 12px;
  color: #EF4444;
  padding: 8px 12px;
  background: rgba(239,68,68,0.08);
  border-radius: 6px;
  border-left: 3px solid #EF4444;
}

.log-section {}
.log-list { font-size: 12px; line-height: 1.8; }
.log-entry { display: flex; gap: 8px; align-items: flex-start; }
.log-time { color: #484F58; min-width: 52px; flex-shrink: 0; font-size: 11px; }
.log-agent { font-weight: 600; min-width: 36px; flex-shrink: 0; }
.log-text { color: #8B949E; }

/* Card Footer */
.card-footer {
  padding: 10px 14px;
  border-top: 1px solid #21262D;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.task-btn {
  padding: 5px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid #30363D;
  cursor: pointer;
  transition: all 0.15s;
}

.task-btn:hover { transform: scale(0.97); }
.task-btn-accept { background: rgba(34,197,94,0.15); color: #22C55E; border-color: rgba(34,197,94,0.4); }
.task-btn-accept:hover { background: rgba(34,197,94,0.25); }
.task-btn-reject { background: rgba(239,68,68,0.08); color: #EF4444; border-color: rgba(239,68,68,0.3); }
.task-btn-reject:hover { background: rgba(239,68,68,0.15); }
.task-btn-execute { background: rgba(234,179,8,0.15); color: #EAB308; border-color: rgba(234,179,8,0.4); }
.task-btn-execute:hover { background: rgba(234,179,8,0.25); }
.task-btn-complete { background: rgba(34,197,94,0.15); color: #22C55E; border-color: rgba(34,197,94,0.4); }
.task-btn-complete:hover { background: rgba(34,197,94,0.25); }
.task-btn-fail { background: rgba(239,68,68,0.08); color: #EF4444; border-color: rgba(239,68,68,0.3); }
.task-btn-fail:hover { background: rgba(239,68,68,0.15); }

/* ─── Empty State ─────────────────────────────────────────────────────── */
.hall-empty { text-align: center; padding: 60px 0; color: #484F58; }
.hall-empty-icon { font-size: 48px; margin-bottom: 12px; }
.hall-empty-text { font-size: 15px; font-weight: 600; color: #8B949E; margin-bottom: 6px; }
.hall-empty-sub { font-size: 12px; color: #484F58; }

/* ─── Input Area ────────────────────────────────────────────────────────── */
.hall-input-area {
  border-top: 1px solid #30363D;
  padding: 12px 16px;
  background: #161B22;
  position: relative;
}

/* Agent Picker */
.agent-picker {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 16px;
  width: 280px;
  background: #1C2128;
  border: 1px solid #30363D;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  overflow: hidden;
  z-index: 100;
}

.agent-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  font-size: 11px;
  color: #8B949E;
  border-bottom: 1px solid #21262D;
}

.picker-close { background: none; border: none; color: #484F58; cursor: pointer; font-size: 12px; }

.picker-agent-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  cursor: pointer;
  transition: background 0.1s;
}

.picker-agent-item:hover { background: rgba(88,166,255,0.08); }

.picker-agent-name { font-size: 12px; font-weight: 600; color: #E6EDF3; }
.picker-agent-role { font-size: 10px; color: #484F58; margin-left: auto; }

/* ─── Quick Commands Panel (Phase 3) ───────────────────────────────────── */
.commands-panel {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 16px;
  width: 320px;
  background: #1C2128;
  border: 1px solid #30363D;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  overflow: hidden;
  z-index: 101;
}

.commands-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 700;
  color: #8B949E;
  border-bottom: 1px solid #21262D;
}

.commands-list { max-height: 300px; overflow-y: auto; }

.command-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.1s;
}

.command-item:hover { background: rgba(88,166,255,0.08); }

.cmd-icon { font-size: 18px; flex-shrink: 0; }
.cmd-info { display: flex; flex-direction: column; gap: 2px; }
.cmd-name { font-size: 13px; font-weight: 600; color: #E6EDF3; }
.cmd-desc { font-size: 11px; color: #484F58; }

/* ─── Create Topic Modal ───────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal-box {
  background: #1C2128;
  border: 1px solid #30363D;
  border-radius: 12px;
  padding: 24px;
  width: 360px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.5);
}

.modal-title { font-size: 15px; font-weight: 700; color: #E6EDF3; margin-bottom: 20px; }

.modal-field {
  margin-bottom: 16px;
}

.modal-field label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #8B949E;
  margin-bottom: 6px;
}

.modal-input {
  width: 100%;
  background: #0D1117;
  border: 1px solid #30363D;
  border-radius: 8px;
  color: #E6EDF3;
  font-size: 13px;
  padding: 8px 12px;
  outline: none;
  box-sizing: border-box;
  font-family: inherit;
}

.modal-input:focus { border-color: #58A6FF; }

.color-picker { display: flex; gap: 8px; flex-wrap: wrap; }

.color-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
}

.color-swatch.selected {
  border-color: #fff;
  transform: scale(1.15);
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}

.modal-cancel {
  background: none;
  border: 1px solid #30363D;
  border-radius: 8px;
  color: #8B949E;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 16px;
  cursor: pointer;
}

.modal-confirm {
  background: #58A6FF;
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 20px;
  cursor: pointer;
}

/* ─── Input Row ────────────────────────────────────────────────────────── */
.input-row { display: flex; align-items: flex-end; gap: 10px; }

.input-wrap {
  flex: 1;
  background: #0D1117;
  border: 1px solid #30363D;
  border-radius: 10px;
  padding: 8px 12px;
  transition: border-color 0.15s;
}

.input-wrap:focus-within { border-color: #58A6FF; }

.mention-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px; }

.mention-tag {
  display: flex;
  align-items: center;
  gap: 3px;
  background: rgba(88,166,255,0.15);
  color: #58A6FF;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}

.mention-tag-remove {
  background: none;
  border: none;
  color: #58A6FF;
  cursor: pointer;
  font-size: 13px;
  padding: 0;
  line-height: 1;
  opacity: 0.7;
}

.hall-input {
  width: 100%;
  background: none;
  border: none;
  outline: none;
  color: #E6EDF3;
  font-size: 13px;
  line-height: 1.5;
  resize: none;
  font-family: inherit;
}

.hall-input::placeholder { color: #484F58; }

.send-btn {
  background: #58A6FF;
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 16px;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) { background: #79b8ff; }
.send-btn:disabled { background: #21262D; color: #484F58; cursor: not-allowed; }
</style>
