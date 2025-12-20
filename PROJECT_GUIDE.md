# 🎓 AI工作流系统 - 完整教程

## 📖 项目简介

这是一个基于 Next.js + Prisma + ReactFlow 构建的AI工作流自动化系统，类似于 Coze.cn 的工作流功能。

**核心功能：**
- 🎨 可视化工作流编辑器
- 🤖 AI节点支持（兼容OpenAI API）
- 📊 实时执行监控
- 💾 完整的数据持久化

---

## 🗂️ 数据库模型详解

### 1. **Workflow（工作流）**
存储工作流的基本信息

```prisma
model Workflow {
  id          String         @id @default(cuid())  // 唯一ID
  name        String                                // 工作流名称
  description String?                               // 描述（可选）
  createdAt   DateTime       @default(now())        // 创建时间
  updatedAt   DateTime       @updatedAt             // 更新时间

  // 关联关系
  nodes       WorkflowNode[]  // 包含的节点
  edges       WorkflowEdge[]  // 节点之间的连接
  runs        Run[]           // 执行记录
}
```

**数据示例：**
```json
{
  "id": "cmg0domog0000nkt47qw8easa",
  "name": "文档分析流程",
  "description": "分析文学作品的主题和风格",
  "createdAt": "2025-09-30T10:00:00.000Z",
  "updatedAt": "2025-09-30T12:00:00.000Z"
}
```

---

### 2. **WorkflowNode（节点）**
工作流中的每个处理单元

```prisma
model WorkflowNode {
  id          String    @id @default(cuid())  // 节点ID
  workflowId  String                           // 所属工作流ID
  type        String                           // 节点类型："input", "openai.chat", "map.set", "http.request"
  label       String?                          // 显示名称
  positionX   Float     @default(0)           // 在画布上的X坐标
  positionY   Float     @default(0)           // 在画布上的Y坐标
  config      Json                             // 节点配置（不同类型节点配置不同）
  
  workflow    Workflow  @relation(...)         // 所属工作流
  incoming    WorkflowEdge[] @relation(...)    // 输入连接
  outgoing    WorkflowEdge[] @relation(...)    // 输出连接
  steps       Step[]                           // 执行步骤
}
```

**节点类型与配置示例：**

#### Input节点（输入节点）
```json
{
  "type": "input",
  "label": "输入节点",
  "config": {}  // 输入节点通常无需配置
}
```

#### OpenAI Chat节点（AI对话）
```json
{
  "type": "openai.chat",
  "label": "文档分析",
  "config": {
    "model": "THUDM/glm-4-9b-chat",           // AI模型名称
    "system": "你是专业的文学分析师",          // 系统提示词
    "promptTemplate": "请分析：{{text}}",      // 提示模板（支持变量插值）
    "outputKey": "analysis"                    // 输出结果保存的键名
  }
}
```

#### Map Set节点（设置变量）
```json
{
  "type": "map.set",
  "label": "保存结果",
  "config": {
    "key": "final_result",                    // 变量名
    "valueTemplate": "{{analysis}}"           // 值模板（支持插值）
  }
}
```

#### HTTP Request节点（HTTP请求）
```json
{
  "type": "http.request",
  "label": "调用API",
  "config": {
    "urlTemplate": "https://api.example.com?q={{text}}",  // URL模板
    "method": "POST",                                      // HTTP方法
    "bodyTemplate": "{\"data\": \"{{text}}\"}"            // 请求体模板
  }
}
```

---

### 3. **WorkflowEdge（连接线）**
连接两个节点，定义数据流向

```prisma
model WorkflowEdge {
  id           String       @id @default(cuid())
  workflowId   String                            // 所属工作流
  sourceNodeId String                            // 起始节点ID
  targetNodeId String                            // 目标节点ID
  label        String?                           // 连接线标签
  condition    Json?                             // 条件判断（未来功能）
}
```

**数据示例：**
```json
{
  "id": "edge_abc123",
  "sourceNodeId": "node_input",
  "targetNodeId": "node_ai",
  "label": null
}
```

---

### 4. **Run（运行记录）**
工作流的每次执行记录

```prisma
model Run {
  id          String     @id @default(cuid())
  workflowId  String                             // 执行的工作流ID
  status      RunStatus  @default(PENDING)       // 状态：PENDING/RUNNING/SUCCEEDED/FAILED
  startedAt   DateTime?                          // 开始时间
  finishedAt  DateTime?                          // 结束时间
  input       Json?                              // 输入数据
  context     Json?                              // 执行上下文（累积的数据）
  error       String?                            // 错误信息
  
  workflow    Workflow   @relation(...)
  steps       Step[]                             // 执行步骤列表
}
```

**执行流程：**
```
1. 创建Run记录 (status: PENDING)
   ↓
2. 开始执行 (status: RUNNING, startedAt: now)
   ↓
3. 按顺序执行每个节点
   ↓
4. 执行完成 (status: SUCCEEDED/FAILED, finishedAt: now)
```

---

### 5. **Step（执行步骤）**
每个节点的执行详情

```prisma
model Step {
  id        String       @id @default(cuid())
  runId     String                              // 所属运行记录
  nodeId    String                              // 执行的节点
  status    StepStatus   @default(PENDING)      // 状态
  startedAt DateTime?                           // 开始时间
  finishedAt DateTime?                          // 结束时间
  input     Json?                               // 输入数据
  output    Json?                               // 输出结果
  error     String?                             // 错误信息
}
```

---

## 🔄 数据流向图

### 整体数据流

```
用户输入
   ↓
【工作流列表页】
   ↓ 创建工作流
【可视化编辑器】
   ↓ 添加节点、配置、连接
保存到数据库 (Workflow + Nodes + Edges)
   ↓
【工作流详情页】
   ↓ 点击运行，输入数据
【执行引擎】
   ↓
1. 创建 Run 记录
2. 拓扑排序节点（确定执行顺序）
3. 逐个执行节点
   - 创建 Step 记录
   - 执行节点逻辑
   - 更新 Step 状态
   - 更新上下文 (context)
4. 更新 Run 状态
   ↓
【运行结果页】
   ↓
显示每个步骤的输入输出
```

---

## 🏗️ 核心代码详解

### 1. 数据库客户端 - `src/lib/prisma.ts`

```typescript
import { PrismaClient } from "@prisma/client";

// 声明全局变量（防止开发模式下重复创建客户端）
declare global {
  var prisma: PrismaClient | undefined;
}

// 单例模式：确保整个应用只有一个Prisma客户端实例
export const prisma = global.prisma || new PrismaClient();

// 开发环境下保存到全局变量，避免热重载时重复创建
if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
```

**为什么需要单例模式？**
- Prisma客户端会创建数据库连接池
- 多次创建会浪费资源
- 开发模式下Next.js会热重载，不使用全局变量会导致连接泄漏

---

### 2. AI客户端 - `src/lib/openai.ts`

```typescript
import OpenAI from "openai";

let singleton: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  // 单例模式：只创建一次客户端
  if (singleton) return singleton;
  
  // 从环境变量读取API密钥
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY未配置");
  }
  
  // 支持自定义API地址（兼容国内AI厂商）
  const baseURL = process.env.OPENAI_BASE_URL;
  
  singleton = new OpenAI({
    apiKey,
    baseURL,        // 如果为空，使用默认OpenAI地址
    timeout: 120000 // 超时时间：2分钟
  });
  
  return singleton;
}
```

**支持的AI厂商配置：**
```env
# 智谱AI
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4/

# SiliconFlow
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://api.siliconflow.cn/v1

# 月之暗面 Kimi
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://api.moonshot.cn/v1
```

---

### 3. 工作流执行引擎 - `src/lib/engine.ts`

这是系统的核心，负责执行工作流。

#### 3.1 节点操作器接口

```typescript
// 节点操作器的参数
export interface NodeOperatorArgs {
  node: {
    id: string;
    type: string;
    label?: string | null;
    config: any;  // 节点配置
  };
  context: ExecutionContext;  // 当前执行上下文（累积的数据）
}

// 节点操作器的返回值
export interface NodeOperatorResult {
  output?: unknown;           // 节点的输出
  contextPatch?: ExecutionContext;  // 要合并到上下文的新数据
}

// 节点操作器类型
export type NodeOperator = (args: NodeOperatorArgs) => Promise<NodeOperatorResult>;
```

#### 3.2 OpenAI Chat 节点实现

```typescript
// 调用AI模型的函数
async function runOpenAIChat(args: {
  model: string;    // 模型名称
  system?: string;  // 系统提示词
  user: string;     // 用户消息
}): Promise<string> {
  const client = getOpenAIClient();
  
  // 调用OpenAI兼容API
  const res = await client.chat.completions.create({
    model: args.model,
    messages: [
      // 如果有系统提示词，先添加系统消息
      ...(args.system ? [{ role: "system" as const, content: args.system }] : []),
      // 用户消息
      { role: "user" as const, content: args.user },
    ],
    temperature: 0.2,  // 温度：控制随机性，越低越确定
  });
  
  // 返回AI的回复
  return res.choices?.[0]?.message?.content ?? "";
}

// 注册OpenAI Chat节点操作器
operatorRegistry.register("openai.chat", async ({ node, context }) => {
  // 从节点配置中获取参数
  const { 
    model = "gpt-4o-mini",     // 默认模型
    system = "",                // 系统提示词
    promptTemplate = "",        // 提示模板
    outputKey = "ai_output"     // 输出键名
  } = node.config || {};
  
  // 模板插值：将 {{变量名}} 替换为上下文中的实际值
  // 例如：{{text}} -> context.text的值
  const prompt = interpolateTemplate(String(promptTemplate ?? ""), context);
  
  // 调用AI模型
  const content = await runOpenAIChat({ model, system, user: prompt });
  
  // 将AI输出保存到上下文
  // 例如：outputKey="analysis"，则保存到context.analysis
  const patched = setByPath(context, String(outputKey), content);
  
  return { 
    output: content,      // 节点输出
    contextPatch: patched // 更新后的上下文
  };
});
```

**执行示例：**
```
输入：
  context = { text: "Hello" }
  node.config = {
    model: "THUDM/glm-4-9b-chat",
    system: "你是助手",
    promptTemplate: "请回复：{{text}}",
    outputKey: "response"
  }

处理过程：
  1. 插值：promptTemplate -> "请回复：Hello"
  2. 调用AI：system + user -> 得到回复 "你好！"
  3. 保存到上下文：context.response = "你好！"

输出：
  output = "你好！"
  contextPatch = { text: "Hello", response: "你好！" }
```

#### 3.3 Map Set 节点实现

```typescript
// 设置变量节点：将值保存到上下文
operatorRegistry.register("map.set", async ({ node, context }) => {
  const { key, valueTemplate } = node.config || {};
  
  // 模板插值
  const value = interpolateTemplate(String(valueTemplate ?? ""), context);
  
  // 保存到上下文
  const patched = setByPath(context, String(key ?? "result"), value);
  
  return { output: value, contextPatch: patched };
});
```

#### 3.4 HTTP Request 节点实现

```typescript
// HTTP请求节点：调用外部API
operatorRegistry.register("http.request", async ({ node, context }) => {
  const { 
    urlTemplate,         // URL模板
    method = "GET",      // HTTP方法
    headers = {}, 
    bodyTemplate 
  } = node.config || {};
  
  // 插值URL
  const url = interpolateTemplate(String(urlTemplate ?? ""), context);
  
  // 构建请求选项
  const init: RequestInit = { method };
  if (headers && Object.keys(headers).length) {
    init.headers = headers;
  }
  if (bodyTemplate && method !== "GET") {
    init.body = interpolateTemplate(String(bodyTemplate ?? ""), context);
  }
  
  // 发送HTTP请求
  const res = await fetch(url, init);
  const text = await res.text();
  
  return { output: { status: res.status, text } };
});
```

#### 3.5 拓扑排序算法

```typescript
// 拓扑排序：确定节点的执行顺序
function topoSort(
  nodes: { id: string }[], 
  edges: { sourceNodeId: string; targetNodeId: string }[]
): string[] {
  // 入度表：记录每个节点有多少条输入边
  const inDegree = new Map<string, number>();
  // 邻接表：记录每个节点的输出节点
  const adj = new Map<string, string[]>();
  
  // 初始化
  for (const n of nodes) {
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
  }
  
  // 构建图结构
  for (const e of edges) {
    // 目标节点入度+1
    inDegree.set(e.targetNodeId, (inDegree.get(e.targetNodeId) || 0) + 1);
    // 添加邻接关系
    adj.get(e.sourceNodeId)?.push(e.targetNodeId);
  }
  
  // Kahn算法：从入度为0的节点开始
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);  // 入度为0的节点可以先执行
  }
  
  const order: string[] = [];
  while (queue.length) {
    const u = queue.shift()!;
    order.push(u);
    
    // 处理当前节点的所有输出节点
    for (const v of adj.get(u) || []) {
      // 入度-1（因为当前节点已执行）
      inDegree.set(v, (inDegree.get(v) || 0) - 1);
      // 如果入度变为0，可以执行了
      if ((inDegree.get(v) || 0) === 0) queue.push(v);
    }
  }
  
  // 检查是否有环
  if (order.length !== nodes.length) {
    throw new Error("工作流存在循环依赖");
  }
  
  return order;
}
```

**拓扑排序示例：**
```
节点：A, B, C, D
连接：A->B, A->C, B->D, C->D

执行顺序：A -> B -> C -> D (或 A -> C -> B -> D)
```

#### 3.6 工作流执行主函数

```typescript
export async function executeWorkflow(params: {
  workflowId: string;
  input?: ExecutionInput;
}): Promise<{ runId: string }> {
  // 1. 获取工作流数据
  const workflow = await prisma.workflow.findUnique({
    where: { id: params.workflowId },
    include: { nodes: true, edges: true },
  });
  
  if (!workflow) throw new Error("工作流不存在");
  
  // 2. 创建运行记录
  const run = await prisma.run.create({
    data: {
      workflowId: workflow.id,
      status: "RUNNING",
      startedAt: new Date(),
      input: params.input ?? {},
      context: params.input ?? {},  // 初始上下文就是输入数据
    },
  });
  
  // 初始化执行上下文
  let context: ExecutionContext = (params.input ?? {}) as ExecutionContext;
  
  try {
    // 3. 拓扑排序：确定执行顺序
    const order = topoSort(
      workflow.nodes.map(n => ({ id: n.id })),
      workflow.edges.map(e => ({ 
        sourceNodeId: e.sourceNodeId, 
        targetNodeId: e.targetNodeId 
      })),
    );
    
    // 4. 按顺序执行每个节点
    const nodeById = new Map(workflow.nodes.map(n => [n.id, n]));
    
    for (const nodeId of order) {
      const node = nodeById.get(nodeId)!;
      const operator = operatorRegistry.get(node.type);
      
      // 4.1 创建步骤记录
      const step = await prisma.step.create({
        data: {
          runId: run.id,
          nodeId: node.id,
          status: "RUNNING",
          startedAt: new Date(),
          input: context,  // 当前上下文作为输入
        },
      });
      
      try {
        // 4.2 检查节点操作器是否存在
        if (!operator) {
          throw new Error(`未找到节点类型 ${node.type} 的操作器`);
        }
        
        // 4.3 执行节点
        const { output, contextPatch } = await operator({ 
          node: { 
            id: node.id, 
            type: node.type, 
            label: node.label, 
            config: node.config 
          }, 
          context 
        });
        
        // 4.4 合并上下文
        if (contextPatch) {
          context = { ...context, ...contextPatch };
        }
        
        // 4.5 更新步骤状态为成功
        await prisma.step.update({
          where: { id: step.id },
          data: { 
            status: "SUCCEEDED", 
            finishedAt: new Date(), 
            output: output ?? null 
          },
        });
      } catch (err: any) {
        // 4.6 节点执行失败
        await prisma.step.update({
          where: { id: step.id },
          data: { 
            status: "FAILED", 
            finishedAt: new Date(), 
            error: String(err?.message ?? err) 
          },
        });
        throw err;  // 抛出错误，终止整个工作流
      }
      
      // 4.7 更新运行记录的上下文
      await prisma.run.update({ 
        where: { id: run.id }, 
        data: { context } 
      });
    }
    
    // 5. 所有节点执行成功
    await prisma.run.update({
      where: { id: run.id },
      data: { 
        status: "SUCCEEDED", 
        finishedAt: new Date(), 
        context 
      },
    });
    
    return { runId: run.id };
    
  } catch (error: any) {
    // 6. 工作流执行失败
    await prisma.run.update({
      where: { id: run.id },
      data: { 
        status: "FAILED", 
        finishedAt: new Date(), 
        error: String(error?.message ?? error) 
      },
    });
    throw error;
  }
}
```

---

## 🎨 前端页面详解

### 1. 工作流列表页 - `src/app/workflows/page.tsx`

**功能：**
- 展示所有工作流
- 创建新工作流
- 跳转到编辑器或详情页

**关键代码：**
```typescript
// 获取工作流列表
useEffect(() => {
  fetch("/api/workflows")
    .then(r => r.json())
    .then(setItems);
}, []);

// 创建工作流
async function create() {
  const res = await fetch("/api/workflows", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      name, 
      description, 
      nodes: [{ type: "input", label: "Input" }],  // 默认有一个输入节点
      edges: [] 
    }),
  });
  const wf = await res.json();
  setItems([wf, ...items]);  // 添加到列表
}
```

---

### 2. 可视化编辑器 - `src/app/workflows/[id]/editor/page.tsx`

**功能：**
- 可视化编辑工作流
- 添加/删除/配置节点
- 连接节点
- 保存工作流

**关键技术：ReactFlow**
```typescript
import { 
  ReactFlow,      // 核心组件
  Background,     // 背景网格
  Controls,       // 控制按钮（放大缩小等）
  MiniMap,        // 缩略图
  addEdge,        // 添加连接
  applyNodeChanges,  // 应用节点变化
  applyEdgeChanges,  // 应用连接变化
} from '@xyflow/react';

// 节点变化处理
const onNodesChange = useCallback(
  (changes) => setNodes(nds => applyNodeChanges(changes, nds)),
  []
);

// 连接处理
const onConnect = useCallback(
  (connection) => setEdges(eds => addEdge(connection, eds)),
  []
);

// 渲染
<ReactFlow
  nodes={nodes}
  edges={edges}
  onNodesChange={onNodesChange}
  onEdgesChange={onEdgesChange}
  onConnect={onConnect}
  onNodeClick={onNodeClick}
  nodeTypes={nodeTypes}  // 自定义节点类型
  fitView
>
  <Background />
  <Controls />
  <MiniMap />
</ReactFlow>
```

**保存工作流：**
```typescript
async function save() {
  const payload = {
    name: wf.name,
    description: wf.description,
    nodes: nodes.map(n => ({
      id: n.id,
      type: n.data.type,
      label: n.data.label,
      position: { x: n.position.x, y: n.position.y },
      config: n.data.config,
    })),
    edges: edges.map(e => ({
      sourceNodeId: e.source,
      targetNodeId: e.target,
      label: e.label || null,
    })),
  };
  
  await fetch(`/api/workflows/${wf.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
```

---

### 3. 工作流详情页 - `src/app/workflows/[id]/page.tsx`

**功能：**
- 显示工作流信息
- 输入数据并运行
- 跳转到结果页

**运行工作流：**
```typescript
async function run() {
  // 调用运行API
  const res = await fetch(`/api/workflows/${id}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: { text } }),  // 输入数据
  });
  
  const data = await res.json();
  
  // 跳转到结果页
  window.location.href = `/runs/${data.runId}`;
}
```

---

### 4. 运行结果页 - `src/app/runs/[id]/page.tsx`

**功能：**
- 展示运行状态
- 显示每个步骤的输入输出
- 实时轮询更新

**实时轮询：**
```typescript
useEffect(() => {
  const fetchRun = async () => {
    const response = await fetch(`/api/runs/${id}`);
    const r = await response.json();
    setRun(r);
    
    // 如果运行完成，停止轮询
    if (r?.status === "SUCCEEDED" || r?.status === "FAILED") {
      return;
    }
  };
  
  fetchRun();
  
  // 每2秒轮询一次
  const interval = setInterval(fetchRun, 2000);
  
  return () => clearInterval(interval);
}, [id]);
```

---

## 🔌 API路由详解

### 1. 获取工作流列表 - `GET /api/workflows`

```typescript
// src/app/api/workflows/route.ts
export async function GET() {
  const workflows = await prisma.workflow.findMany({
    include: { 
      nodes: true,  // 包含节点信息
      edges: true   // 包含连接信息
    },
    orderBy: { createdAt: 'desc' }  // 按创建时间倒序
  });
  return NextResponse.json(workflows);
}
```

---

### 2. 创建工作流 - `POST /api/workflows`

```typescript
export async function POST(req: Request) {
  const body = await req.json();
  const { name, description, nodes, edges } = body;
  
  // 使用事务确保数据一致性
  const workflow = await prisma.workflow.create({
    data: {
      name,
      description,
      nodes: {
        create: nodes.map(n => ({
          type: n.type,
          label: n.label || null,
          positionX: n.position?.x || 0,
          positionY: n.position?.y || 0,
          config: n.config || {},
        })),
      },
      edges: {
        create: edges.map(e => ({
          sourceNodeId: e.sourceNodeId,
          targetNodeId: e.targetNodeId,
          label: e.label || null,
        })),
      },
    },
    include: { nodes: true, edges: true },
  });
  
  return NextResponse.json(workflow);
}
```

---

### 3. 运行工作流 - `POST /api/workflows/[id]/run`

```typescript
// src/app/api/workflows/[id]/run/route.ts
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  
  // 调用执行引擎
  const { runId } = await executeWorkflow({ 
    workflowId: id, 
    input: body?.input ?? {} 
  });
  
  return NextResponse.json({ runId }, { status: 202 });  // 202: Accepted
}
```

---

### 4. 获取运行结果 - `GET /api/runs/[id]`

```typescript
// src/app/api/runs/[id]/route.ts
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  
  const run = await prisma.run.findUnique({
    where: { id },
    include: { 
      steps: { orderBy: { startedAt: "asc" } },  // 步骤按开始时间排序
      workflow: true 
    },
  });
  
  if (!run) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  
  return NextResponse.json(run);
}
```

---

## 🎯 完整执行流程示例

让我们用一个具体的例子来演示整个系统的运作：

### 场景：文学作品分析

**1. 创建工作流**
```
用户在列表页点击"创建工作流"
输入名称："文学分析"
输入描述："分析文学作品的主题和风格"
→ POST /api/workflows
→ 创建Workflow记录
```

**2. 配置节点**
```
在编辑器中添加3个节点：

节点1：输入节点
  type: "input"
  label: "输入文本"
  
节点2：AI分析节点
  type: "openai.chat"
  label: "文学分析"
  config: {
    model: "THUDM/glm-4-9b-chat",
    system: "你是专业的文学分析师",
    promptTemplate: "请分析：{{text}}",
    outputKey: "analysis"
  }
  
节点3：结果整理节点
  type: "map.set"
  label: "保存结果"
  config: {
    key: "final_result",
    valueTemplate: "{{analysis}}"
  }

连接：节点1 → 节点2 → 节点3

点击保存
→ PUT /api/workflows/[id]
→ 更新Workflow, Nodes, Edges
```

**3. 运行工作流**
```
在详情页输入文本："雨巷中的回声..."
点击"运行"
→ POST /api/workflows/[id]/run
  body: { input: { text: "雨巷中的回声..." } }

执行引擎开始工作：

Step 1: 执行输入节点
  input: { text: "雨巷中的回声..." }
  output: null
  context: { text: "雨巷中的回声..." }

Step 2: 执行AI分析节点
  input: { text: "雨巷中的回声..." }
  1. 插值：promptTemplate -> "请分析：雨巷中的回声..."
  2. 调用AI：得到分析结果
  3. 保存到context.analysis
  output: "文章主题是..."
  context: { text: "...", analysis: "..." }

Step 3: 执行结果整理节点
  input: { text: "...", analysis: "..." }
  1. 插值：valueTemplate -> analysis的值
  2. 保存到context.final_result
  output: "文章主题是..."
  context: { text: "...", analysis: "...", final_result: "..." }

所有节点执行完成
→ Run状态: SUCCEEDED
→ 返回: { runId: "xxx" }
```

**4. 查看结果**
```
跳转到 /runs/xxx
每2秒轮询 GET /api/runs/xxx
显示：
  - Run状态：成功
  - Step 1：输入文本
  - Step 2：AI分析结果
  - Step 3：最终输出
```

---

## 📚 学习路径建议

### 第1天：理解数据结构
1. 阅读 `prisma/schema.prisma`
2. 理解各个模型之间的关系
3. 使用 Prisma Studio 查看数据：`npx prisma studio`

### 第2天：掌握执行引擎
1. 阅读 `src/lib/engine.ts`
2. 理解拓扑排序算法
3. 理解节点操作器模式
4. 尝试添加新的节点类型

### 第3天：熟悉API路由
1. 阅读 `src/app/api/` 下的所有路由
2. 理解 Next.js App Router 的API Routes
3. 使用 Postman 测试API

### 第4天：学习前端交互
1. 阅读页面组件
2. 理解 ReactFlow 的使用
3. 学习 Tailwind CSS 样式

### 第5天：实践项目
1. 添加新的节点类型（如：文件读写、数据库操作）
2. 优化UI界面
3. 添加用户认证功能

---

## 🔧 常见问题

### Q1: 如何添加新的节点类型？

**步骤：**
1. 在 `src/lib/engine.ts` 中注册新的操作器
2. 在 `src/app/workflows/[id]/editor/page.tsx` 中添加到节点库
3. 在属性面板中添加对应的配置UI

**示例：添加延时节点**
```typescript
// 1. 注册操作器
operatorRegistry.register("delay", async ({ node, context }) => {
  const { seconds = 1 } = node.config || {};
  await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  return { output: `延时${seconds}秒`, contextPatch: context };
});

// 2. 添加到节点库
const nodeTemplates = [
  // ...existing nodes
  { type: 'delay', label: '延时节点', description: '延时指定秒数' },
];

// 3. 添加配置UI
{selectedNode.data.type === 'delay' && (
  <div>
    <label>延时秒数</label>
    <input
      type="number"
      value={selectedNode.data.config.seconds || 1}
      onChange={(e) => updateNodeConfig('seconds', Number(e.target.value))}
    />
  </div>
)}
```

### Q2: 如何支持条件分支？

需要修改执行引擎，支持根据条件选择执行路径。

### Q3: 如何支持循环？

需要在执行引擎中添加循环控制逻辑。

---

## 🎓 推荐资源

- **Next.js 文档**: https://nextjs.org/docs
- **Prisma 文档**: https://www.prisma.io/docs
- **ReactFlow 文档**: https://reactflow.dev/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **TypeScript**: https://www.typescriptlang.org/docs

---

## 🎉 总结

这个项目展示了如何构建一个完整的AI工作流系统，涵盖了：
- ✅ 数据库设计（Prisma）
- ✅ 后端API（Next.js API Routes）
- ✅ 前端UI（React + Tailwind CSS）
- ✅ 可视化编辑（ReactFlow）
- ✅ AI集成（OpenAI API）
- ✅ 工作流引擎（拓扑排序 + 节点操作器模式）

通过学习这个项目，您可以掌握现代全栈开发的核心技能！

---

**作者建议：**
从简单的功能开始，逐步理解每个部分的作用，然后尝试添加新功能。编程最好的学习方式就是动手实践！💪


