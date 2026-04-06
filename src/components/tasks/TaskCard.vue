<template>
  <div
    class="task-card"
    :class="['priority-border-' + task.priority, 'status-' + task.status]"
    @click="$emit('click', task)"
  >
    <!-- Header row -->
    <div class="tc-header">
      <span v-if="task.priority" class="tc-priority" :class="'prio-' + task.priority">
        {{ PRIORITY_LABELS[task.priority] || task.priority }}
      </span>
      <span v-if="task.deadline" class="tc-deadline">⏰ {{ task.deadline }}</span>
      <button class="tc-star" :class="{ starred: task.starred }" @click.stop="$emit('star', task)">
        {{ task.starred ? '⭐' : '☆' }}
      </button>
    </div>

    <!-- Title -->
    <div class="tc-title">{{ task.title }}</div>

    <!-- Description (if expanded) -->
    <div v-if="expanded && task.description" class="tc-desc">{{ task.description }}</div>

    <!-- Tags -->
    <div v-if="task.tags && task.tags.length" class="tc-tags">
      <span v-for="tag in task.tags" :key="tag" class="tc-tag">{{ tag }}</span>
    </div>

    <!-- Footer row -->
    <div class="tc-footer">
      <div class="tc-assignee" v-if="task.assigneeName">
        <el-avatar :size="18" :style="{ backgroundColor: assigneeColor }">
          {{ assigneeEmoji }}
        </el-avatar>
        <span class="tc-assignee-name">{{ task.assigneeName }}</span>
      </div>
      <div class="tc-right">
        <span v-if="task.agentName" class="tc-agent" :title="'关联Agent: ' + task.agentName">
          🤖
        </span>
        <span v-if="task.tokenInfo" class="tc-tokens">{{ task.tokenInfo }}</span>
      </div>
    </div>

    <!-- Execution chain bar (if running) -->
    <div v-if="task.status === 'running' && task.executionChain" class="tc-chain-bar">
      <div
        v-for="(step, i) in task.executionChain"
        :key="i"
        class="tc-chain-step"
        :class="'step-' + step.status"
        :title="(step.agentName || step.agentId) + ' - ' + step.status"
      ></div>
    </div>

    <!-- Action buttons -->
    <div class="tc-actions" @click.stop>
      <slot name="actions" :task="task" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  task: {
    type: Object,
    required: true,
  },
  expanded: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['click', 'star'])

const PRIORITY_LABELS = { P0: '🔴 P0', P1: '🟡 P1', P2: '🔵 P2' }

const assigneeEmoji = computed(() => {
  const map = { pd: '👔', pm: '📋', dev: '💻', 'dev-dq': '💻', des: '🎨', qa: '🧪', ops: '🚀', xiaoai: '🤵' }
  return map[props.task.assigneeId] || '🤖'
})

const assigneeColor = computed(() => {
  const map = { pd: '#DB61A2', pm: '#1F6FEB', dev: '#8957E5', 'dev-dq': '#DA3633', des: '#2EA043', qa: '#238636', ops: '#D29922', xiaoai: '#D29922' }
  return map[props.task.assigneeId] || '#6366f1'
})
</script>

<style scoped>
.task-card {
  background: #1a1a2e;
  border: 1px solid #2d2d45;
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
  position: relative;
  overflow: hidden;
}
.task-card:hover {
  border-color: #6366f1;
  box-shadow: 0 2px 12px rgba(99, 102, 241, 0.15);
  transform: translateY(-1px);
}
.task-card.status-running {
  border-left: 3px solid #eab308;
}
.task-card.status-completed {
  border-left: 3px solid #22c55e;
  opacity: 0.8;
}
.task-card.status-blocked {
  border-left: 3px solid #ef4444;
}
.task-card.status-pending {
  border-left: 3px solid #9ca3af;
}

.tc-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.tc-priority {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
}
.prio-P0 { color: #f87171; background: rgba(248,81,73,0.12); }
.prio-P1 { color: #fbbf24; background: rgba(251,191,36,0.12); }
.prio-P2 { color: #60a5fa; background: rgba(96,165,250,0.12); }

.tc-deadline {
  font-size: 10px;
  color: #6e7681;
  margin-left: auto;
}

.tc-star {
  background: none;
  border: none;
  font-size: 13px;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
  transition: transform 0.15s;
}
.tc-star:hover { transform: scale(1.2); }
.tc-star.starred { color: #eab308; }

.tc-title {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
  line-height: 1.4;
  margin-bottom: 6px;
}

.tc-desc {
  font-size: 12px;
  color: #8b949e;
  line-height: 1.5;
  margin-bottom: 6px;
}

.tc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}
.tc-tag {
  font-size: 10px;
  padding: 1px 6px;
  background: rgba(99,102,241,0.12);
  color: #818cf8;
  border-radius: 4px;
}

.tc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.tc-assignee {
  display: flex;
  align-items: center;
  gap: 5px;
}
.tc-assignee-name {
  font-size: 11px;
  color: #8b949e;
}
.tc-right {
  display: flex;
  align-items: center;
  gap: 6px;
}
.tc-agent {
  font-size: 12px;
  cursor: help;
}
.tc-tokens {
  font-size: 10px;
  color: #484f58;
}

/* Execution chain progress bar */
.tc-chain-bar {
  display: flex;
  gap: 3px;
  margin-top: 8px;
}
.tc-chain-step {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: #2d2d45;
}
.tc-chain-step.step-completed { background: #22c55e; }
.tc-chain-step.step-running { background: #eab308; animation: pulse-bar 1.2s ease-in-out infinite; }
.tc-chain-step.step-failed { background: #ef4444; }
@keyframes pulse-bar {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.tc-actions {
  margin-top: 8px;
  display: flex;
  gap: 6px;
}
</style>
