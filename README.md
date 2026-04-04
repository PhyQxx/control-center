# 控制台 - OpenClaw Agent 管理面板

轻量级 OpenClaw Agent 管理面板，基于 Vue3 + Element Plus 构建。

## 功能

- **员工总览** — Agent卡片网格，实时显示名称/角色/职责/状态
- **任务看板** — 待处理/进行中/已完成三列 Kanban
- **系统状态** — Gateway连接数/Agent统计/24h趋势图

## 技术栈

- 前端：Vue3 + Vite + Element Plus
- 后端：Node.js（服务端代理，调用 openclaw CLI）

## 启动

```bash
npm install
npm run build
node server.cjs
# 访问 http://localhost:4311
```

## 开发模式

```bash
npm install
npm run dev   # 访问 http://localhost:4312（代理到 :4311）
```

## 数据来源

- Agent 信息：`openclaw agents list`
- 会话状态：`openclaw sessions list`
