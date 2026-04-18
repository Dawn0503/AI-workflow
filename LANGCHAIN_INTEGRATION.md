# LangChain 和 LangGraph 集成方案

本文档说明如何将 LangChain 和 LangGraph 集成到 AI 工作流项目中。

## 📋 目录

1. [概述](#概述)
2. [已实现功能](#已实现功能)
3. [LangChain 节点类型](#langchain-节点类型)
4. [LangGraph 集成方案](#langgraph-集成方案)
5. [使用示例](#使用示例)
6. [扩展指南](#扩展指南)

---

## 概述

### LangChain vs LangGraph

- **LangChain**：模块化 LLM 应用框架，提供 Chains、Agents、Memory、Tools 等组件，适合线性、顺序执行的任务。
- **LangGraph**：在 LangChain 基础上引入图结构来编排工作流，支持状态管理、条件分支、循环、重试逻辑等，适用于复杂控制流。

### 集成策略

本项目采用**渐进式集成**策略：

1. **第一阶段（已完成）**：集成 LangChain 核心功能
   - LangChain Chains（顺序链）
   - LangChain Memory（对话记忆）
   - LangChain Agent（简化版，可扩展）

2. **第二阶段（计划中）**：集成 LangGraph
   - 支持复杂状态机工作流
   - 支持条件分支和循环
   - 支持人工干预（Human-in-the-loop）

---

## 已实现功能

### 1. LangChain Chain 节点 (`langchain.chain`)

使用 LangChain 的顺序链执行 AI 任务。

**配置项：**
- `model`: 模型名称（默认 `"gpt-4o-mini"`）
- `temperature`: 温度参数（默认 `0.2`）
- `promptTemplate`: 提示词模板，支持 `{{variable}}` 插值
- `systemTemplate`: 系统提示词模板（可选）
- `outputKey`: 输出结果保存的键名（默认 `"chain_output"`）

**示例配置：**
```json
{
  "model": "gpt-4o-mini",
  "temperature": 0.2,
  "systemTemplate": "你是一个专业的文本分析师",
  "promptTemplate": "请总结以下文本：{{text}}",
  "outputKey": "summary"
}
```

### 2. LangChain Memory 节点 (`langchain.memory`)

用于保存和恢复对话历史。

**配置项：**
- `action`: 操作类型（`"save"` 或 `"load"`）
- `memoryKey`: 记忆键名（默认 `"chat_history"`）
- `inputKey`: 输入键名（默认 `"input"`）
- `outputKey`: 输出键名（默认 `"output"`）

**示例配置：**
```json
{
  "action": "save",
  "memoryKey": "history",
  "inputKey": "user_message",
  "outputKey": "ai_response"
}
```

### 3. LangChain Agent 节点 (`langchain.agent`)

**注意**：当前版本为简化实现，降级为 Chain 调用。完整 Agent 功能需要额外配置。

**配置项：**
- `model`: 模型名称（默认 `"gpt-4o-mini"`）
- `temperature`: 温度参数（默认 `0.2`）
- `promptTemplate`: Agent 的提示词模板
- `outputKey`: 输出结果保存的键名（默认 `"agent_output"`）

**扩展方向：**
- 安装 `@langchain/community` 包
- 定义自定义工具（Tools）
- 使用 `createReactAgent` 和 `AgentExecutor`

---

## LangGraph 集成方案

### 方案一：TypeScript/JavaScript 集成（推荐用于简单场景）

当前 LangGraph 的 JavaScript/TypeScript 版本功能有限。可以使用以下方案：

1. **使用 LangChain 的状态机模式**
   - 通过条件节点实现分支逻辑
   - 通过循环节点实现迭代逻辑
   - 使用 Memory 节点保存状态

2. **Python 微服务集成**（适用于复杂场景）
   - 创建独立的 Python 服务运行 LangGraph
   - 通过 HTTP API 调用 Python 服务
   - 在 Node.js 中通过 `http.request` 节点调用

### 方案二：Python 微服务集成（完整方案）

#### 架构设计

```
┌─────────────────┐
│  Next.js 应用   │
│  (工作流引擎)   │
└────────┬────────┘
         │ HTTP API
         ▼
┌─────────────────┐
│  Python 服务    │
│  (LangGraph)    │
│  - FastAPI      │
│  - LangGraph    │
│  - LangChain    │
└─────────────────┘
```

#### 实现步骤

1. **创建 Python 服务**

```python
# langgraph_service/main.py
from fastapi import FastAPI
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, List

app = FastAPI()

class WorkflowState(TypedDict):
    input: str
    output: str
    steps: List[str]

# 定义 LangGraph 工作流
graph = StateGraph(WorkflowState)

def node_process(state: WorkflowState) -> WorkflowState:
    # 处理逻辑
    state["output"] = f"Processed: {state['input']}"
    state["steps"].append("processed")
    return state

graph.add_node("process", node_process)
graph.add_edge(START, "process")
graph.add_edge("process", END)

app_graph = graph.compile()

@app.post("/run")
async def run_workflow(input_data: dict):
    result = app_graph.invoke({"input": input_data["input"], "output": "", "steps": []})
    return result
```

2. **在工作流中使用 HTTP 节点调用**

```json
{
  "type": "http.request",
  "label": "LangGraph 工作流",
  "config": {
    "urlTemplate": "http://localhost:8000/run",
    "method": "POST",
    "headers": {
      "Content-Type": "application/json"
    },
    "bodyTemplate": "{\"input\": \"{{text}}\"}"
  }
}
```

### 方案三：混合模式（当前推荐）

结合 LangChain 和现有工作流引擎的优势：

1. **简单流程**：使用现有的 `openai.chat` 或 `langchain.chain` 节点
2. **需要记忆**：使用 `langchain.memory` 节点
3. **复杂流程**：通过多个节点和条件逻辑实现
4. **超复杂流程**：调用 Python LangGraph 服务

---

## 使用示例

### 示例 1：文档摘要流程（使用 LangChain Chain）

**工作流结构：**
```
Input → LangChain Chain → Output
```

**节点配置：**

1. **Input 节点**
```json
{
  "type": "input",
  "label": "输入文档"
}
```

2. **LangChain Chain 节点**
```json
{
  "type": "langchain.chain",
  "label": "文档摘要",
  "config": {
    "model": "gpt-4o-mini",
    "systemTemplate": "你是一个专业的文档分析师",
    "promptTemplate": "请总结以下文档的主要内容（不超过200字）：{{text}}",
    "outputKey": "summary"
  }
}
```

3. **Map Set 节点（可选）**
```json
{
  "type": "map.set",
  "label": "保存结果",
  "config": {
    "key": "final_summary",
    "valueTemplate": "{{summary}}"
  }
}
```

### 示例 2：对话系统（使用 Memory）

**工作流结构：**
```
Input → Load Memory → LangChain Chain → Save Memory → Output
```

**节点配置：**

1. **Load Memory 节点**
```json
{
  "type": "langchain.memory",
  "label": "加载历史",
  "config": {
    "action": "load",
    "memoryKey": "chat_history"
  }
}
```

2. **LangChain Chain 节点（使用历史）**
```json
{
  "type": "langchain.chain",
  "label": "AI 回复",
  "config": {
    "model": "gpt-4o-mini",
    "promptTemplate": "基于以下对话历史回答：{{chat_history}}\n\n用户问题：{{question}}",
    "outputKey": "response"
  }
}
```

3. **Save Memory 节点**
```json
{
  "type": "langchain.memory",
  "label": "保存对话",
  "config": {
    "action": "save",
    "memoryKey": "chat_history",
    "inputKey": "question",
    "outputKey": "response"
  }
}
```

### 示例 3：复杂工作流（条件分支）

**工作流结构：**
```
Input → LangChain Chain → 条件判断 → [分支A: 处理] → [分支B: 跳过] → Output
```

**实现方式：**
1. 使用多个 Chain 节点处理不同情况
2. 使用 `map.set` 节点设置标志
3. 通过连接线控制流程（需要在引擎中支持条件边）

---

## 扩展指南

### 添加新的 LangChain 功能

#### 1. 添加自定义工具（Tools）

```typescript
// src/lib/langchain/tools.ts
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

export const customTool = new DynamicStructuredTool({
  name: "custom_tool",
  description: "自定义工具描述",
  schema: z.object({
    input: z.string().describe("输入参数"),
  }),
  func: async ({ input }) => {
    // 工具逻辑
    return `处理结果: ${input}`;
  },
});
```

#### 2. 添加 RAG（检索增强生成）

```typescript
// src/lib/langchain/rag.ts
import { ChatOpenAI } from "@langchain/openai";
import { VectorStoreRetriever } from "langchain/vectorstores/base";

export async function ragChainOperator(
  args: NodeOperatorArgs
): Promise<NodeOperatorResult> {
  // 1. 初始化向量存储
  // 2. 检索相关文档
  // 3. 构建包含上下文的提示词
  // 4. 调用 LLM
  // 5. 返回结果
}
```

#### 3. 添加多 Agent 协作

```typescript
// src/lib/langchain/multi-agent.ts
// 定义多个 Agent，每个负责不同任务
// 使用 LangGraph 或自定义协调逻辑
```

### 集成 LangGraph（Python 服务）

1. **创建 Python 项目**
```bash
mkdir langgraph-service
cd langgraph-service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install fastapi uvicorn langchain langgraph
```

2. **实现 LangGraph 工作流**
```python
# langgraph-service/main.py
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

# 定义状态
class MyState(TypedDict):
    input: str
    output: str

# 创建图
graph = StateGraph(MyState)

# 添加节点
def process_node(state: MyState) -> MyState:
    state["output"] = f"Processed: {state['input']}"
    return state

graph.add_node("process", process_node)
graph.add_edge(START, "process")
graph.add_edge("process", END)

app_graph = graph.compile()

# 导出为 FastAPI 服务
from fastapi import FastAPI
app = FastAPI()

@app.post("/run")
async def run(input_data: dict):
    result = app_graph.invoke({"input": input_data["input"], "output": ""})
    return result
```

3. **在 Node.js 中调用**
使用 `http.request` 节点调用 Python 服务。

---

## 最佳实践

1. **选择合适的技术**
   - 简单线性流程 → LangChain Chain
   - 需要记忆 → LangChain Memory
   - 复杂控制流 → LangGraph（Python 服务）

2. **性能优化**
   - 缓存 LLM 客户端实例
   - 合理设置 temperature 参数
   - 使用流式响应（Streaming）处理长文本

3. **错误处理**
   - 为每个节点添加错误处理
   - 使用降级策略（如 Agent 降级为 Chain）
   - 记录详细日志

4. **可扩展性**
   - 模块化设计
   - 支持自定义工具和节点
   - 提供清晰的配置接口

---

## 参考资料

- [LangChain 官方文档](https://js.langchain.com/)
- [LangGraph 官方文档](https://langchain-ai.github.io/langgraph/)
- [LangChain Python 文档](https://python.langchain.com/)
- [LangGraph Python 文档](https://langchain-ai.github.io/langgraph/tutorials/)

---

## 更新日志

- **2025-01-16**: 初始版本，集成 LangChain Chains 和 Memory
- **计划中**: 添加完整的 Agent 支持和 LangGraph 集成

