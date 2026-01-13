# 设计文档：AI 圆桌深度对话模式 (Roundtable Mode)

**日期**: 2026-01-13
**状态**: 已验证 / 准备实施

## 1. 目标
实现一个“圆桌对话”模式，允许 3 个及以上的 AI 模型进行多轮（10轮+）深度交互对聊。用户作为观察者，可以实时看到 AI 之间的碰撞，并能在必要时进行人工干预引导。

## 2. 核心概念
- **Roundtable (圆桌)**: 一种新的对话模式，区别于现有的 3 阶段线性 Council 模式。
- **Turn (轮次)**: 单个 AI 角色的一次完整发言。
- **Moderator (主持人)**: 服务器端的调度逻辑，负责决定下一个发言者并注入各方身份信息。
- **Intervention (干预)**: 用户中断 AI 对话并插入指令的行为。

## 3. 架构设计

### 3.1 数据模型 (Types)
在 `app/types/modelConfig.ts` 和 `lib/storage.ts` 中扩展：
- `ConversationMode`: `'council' | 'roundtable'`
- `RoundtableTurn`:
  ```typescript
  {
    role: 'assistant',
    model_id: string,
    model_name: string,
    content: string,
    timestamp: string,
    is_intervention: boolean // 标记是否为用户干预产生的回复
  }
  ```

### 3.2 服务端逻辑 (Moderator)
在 `lib/roundtable.ts` (新文件) 中实现：
1. **身份注入**: 在每个模型请求的 System Prompt 中注入当前圆桌的所有参与者信息及各自的人设。
2. **上下文构造**: 拼接完整的对话流，每个片段通过 `[Model Name]: Content` 明确标识。
3. **调度策略**:
   - 默认采用**轮询 (Round-robin)** 模式。
   - 支持**动态调度**: 根据讨论热度或用户点名决定。
4. **Token 管理**: 当轮次过多时，自动触发由 Chairman 模型进行的“对话压缩”。

### 3.3 API 接口 (SSE)
扩展 `/api/conversations/[id]/message/stream`:
- `roundtable_turn_start`: 通知前端哪个模型开始发言。
- `roundtable_turn_delta`: 流式传输当前模型的文本内容。
- `roundtable_turn_end`: 当前模型发言结束，保存状态。
- `roundtable_complete`: 预设轮次结束或触发总结。

## 4. UI 交互设计 (Client)

### 4.1 流式群聊界面
- **RoundtableInterface**: 新的组件，采用类似 Slack/Discord 的单流布局。
- **角色标识**: 显眼的头像和模型标签。
- **状态感知**: 显示“AI-A 正在输入...”、“AI-B 正在思考...”等状态。

### 4.2 用户干预
- **即时暂停**: 提供悬浮的“暂停讨论/介入”按钮。
- **点名机制**: 支持 `@` 特定模型进行追问。

## 5. 实施计划 (Roadmap)
1. **Step 1**: 修改数据结构，支持模式切换存储。
2. **Step 2**: 开发 `lib/roundtable.ts` 核心调度器及身份注入逻辑。
3. **Step 3**: 创建前端 `RoundtableInterface` 及配套的消息气泡组件。
4. **Step 4**: 实现流式 SSE 协议扩展，联调多轮对聊。
5. **Step 5**: 加入 Token 自动压缩与 Chairman 最终总结。

## 6. 关键改进点
- **身份认知**: 明确告诉 AI “你是谁”以及“你在和谁聊”，显著提升回复的针对性。
- **动态性**: 从“一问一答”进化为“多方混战”，挖掘 AI 间的思维火花。
