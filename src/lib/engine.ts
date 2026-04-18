// ==========================================
// 工作流执行引擎
// 文件作用：实现工作流的执行逻辑，包括拓扑排序、节点操作器和上下文管理
// 核心功能：
// 1. 拓扑排序（确定节点执行顺序）
// 2. 节点操作器注册和执行
// 3. 上下文管理和传递
// 4. AI 模型调用集成
// ==========================================

// 导入依赖
import { prisma } from "@/lib/prisma";  // 数据库客户端
import { getOpenAIClient } from "@/lib/openai";  // OpenAI 客户端
import { ExecutionContext, interpolateTemplate, setByPath } from "@/lib/utils/interpolate";  // 模板插值工具
import { Prisma } from "@prisma/client";  // Prisma 类型
// LangChain 集成
import { 
  langchainChainOperator, 
  langchainAgentOperator, 
  langchainMemoryOperator 
} from "@/lib/langchain";  // LangChain 节点操作器

// ==========================================
// 类型定义
// ==========================================

/**
 * 执行输入类型
 * 用于传递给工作流的初始输入数据
 */
export type ExecutionInput = Record<string, unknown>;

/**
 * 节点操作器参数接口
 * 定义每个节点操作器接收的参数
 */
export interface NodeOperatorArgs {
  node: { 
    id: string;              // 节点唯一标识符
    type: string;            // 节点类型（如 "input", "openai.chat" 等）
    label?: string | null;   // 节点显示标签
    config: Record<string, unknown>; // 节点配置（不同类型节点配置不同）
  };
  context: ExecutionContext;  // 当前执行上下文（包含所有累积的数据）
}

/**
 * 节点操作器返回值接口
 * 定义每个节点操作器的返回结果
 */
export interface NodeOperatorResult {
  output?: unknown;                  // 节点的输出结果（可选）
  contextPatch?: ExecutionContext;   // 需要合并到上下文的新数据（可选）
}

/**
 * 节点操作器类型
 * 每个节点类型对应一个操作器函数
 */
export type NodeOperator = (args: NodeOperatorArgs) => Promise<NodeOperatorResult>;

// ==========================================
// OpenAI Chat 调用函数
// ==========================================

/**
 * 调用 OpenAI Chat Completions API
 * 
 * @param args - 调用参数
 * @param args.model - AI 模型名称（如 "gpt-4", "gpt-3.5-turbo"）
 * @param args.system - 系统提示词（可选，定义 AI 的角色和行为）
 * @param args.user - 用户消息（必需）
 * @returns AI 的回复文本
 * 
 * 作用：统一封装 OpenAI API 调用逻辑
 */
async function runOpenAIChat(args: {
  model: string;     // AI 模型名称
  system?: string;   // 系统提示词（可选）
  user: string;      // 用户消息
}): Promise<string> {
  // 获取 OpenAI 客户端实例
  const client = getOpenAIClient();
  
  // 调用 Chat Completions API
  const res = await client.chat.completions.create({
    model: args.model,  // 指定使用的模型
    messages: [
      // 展开运算符 ...：如果 args.system 有值，则生成一个只含 system 消息的数组，否则是空数组
      // (三元运算符返回数组，... 展开其元素)
      ...(args.system 
        ? [
            {
              role: "system" as const, // as const 断言，这里的 role 是常量类型 "system"
              content: args.system
            }
          ] 
        : [] // 没有 system 时，展开的是空数组（不插入 system 消息）
      ),
      // 用户消息对象，role 用 "user" as const 保证类型推断为字面量 "user"
      {
        role: "user" as const, // as const：让 role 类型不会宽化成 string，而是字面量 "user"
        content: args.user
      },
    ],
    temperature: 0.2, // 温度参数，数值越低，AI 回复越稳定、可控
  });
  
  // 提取并返回 AI 的回复内容
  // 使用可选链和空值合并，确保即使 API 返回异常也不会崩溃
  return res.choices?.[0]?.message?.content ?? "";
}

// ==========================================
// 节点操作器注册表
// ==========================================

/**
 * 节点操作器注册表类
 * 作用：管理所有节点类型对应的操作器函数
 */
class OperatorRegistry {
  // 私有属性：存储节点类型 -> 操作器函数的映射
  private readonly handlers = new Map<string, NodeOperator>();

  /**
   * 注册节点操作器
   * @param type - 节点类型名称
   * @param op - 操作器函数
   */
  register(type: string, op: NodeOperator) {
    this.handlers.set(type, op);
  }

  /**
   * 获取节点操作器
   * @param type - 节点类型名称
   * @returns 对应的操作器函数，如果不存在则返回 undefined
   */
  get(type: string): NodeOperator | undefined {
    return this.handlers.get(type);
  }
}

// 创建全局操作器注册表实例
export const operatorRegistry = new OperatorRegistry();

// ==========================================
// 内置节点操作器注册
// ==========================================

/**
 * 输入节点 (input)
 * 作用：工作流的起始节点，将初始输入数据设置为上下文
 * 配置：无需配置
 * 输入：工作流的初始输入
 * 输出：原样返回上下文
 */
operatorRegistry.register("input", async ({ context }) => ({ 
  contextPatch: context  // 将当前上下文原样返回
}));

/**
 * OpenAI Chat 节点 (openai.chat)
 * 作用：调用 OpenAI API 进行文本生成
 * 
 * 配置项：
 * - model: AI 模型名称（默认 "gpt-4o-mini"）
 * - system: 系统提示词（可选）
 * - promptTemplate: 提示模板，支持 {{variable}} 插值
 * - outputKey: 输出结果保存的键名（默认 "ai_output"）
 * 
 * 示例配置：
 * {
 *   "model": "gpt-4",
 *   "system": "你是专业的文学分析师",
 *   "promptTemplate": "请分析以下文本：{{text}}",
 *   "outputKey": "analysis"
 * }
 */
operatorRegistry.register("openai.chat", async ({ node, context }) => {
  // 从节点配置中提取参数，使用默认值
  const config = node.config || {};
  const model = String(config.model ?? "gpt-4o-mini");           // AI 模型名称
  const system = config.system ? String(config.system) : "";     // 系统提示词
  const promptTemplate = config.promptTemplate ?? "";            // 提示模板
  const outputKey = String(config.outputKey ?? "ai_output");     // 输出键名
  
  // 步骤1：模板插值 - 将 promptTemplate 中的 {{variable}} 替换为上下文中的实际值
  // 例如：promptTemplate = "分析：{{text}}", context = { text: "Hello" }
  //      结果：prompt = "分析：Hello"
  const prompt = interpolateTemplate(String(promptTemplate ?? ""), context);
  
  // 步骤2：调用 OpenAI API
  const content = await runOpenAIChat({ model, system, user: prompt });
  
  // 步骤3：将 AI 的输出保存到上下文中
  // 例如：outputKey = "analysis", content = "这是一个问候语"
  //      结果：context.analysis = "这是一个问候语"
  const patched = setByPath(context, String(outputKey), content);
  
  // 返回结果
  return { 
    output: content,       // 节点的直接输出
    contextPatch: patched  // 更新后的上下文
  };
});

/**
 * 设置变量节点 (map.set)
 * 作用：将值保存到上下文中的指定路径
 * 
 * 配置项：
 * - key: 要设置的键名，支持嵌套路径（如 "result.data"）
 * - valueTemplate: 值模板，支持 {{variable}} 插值
 * 
 * 示例配置：
 * {
 *   "key": "final_result",
 *   "valueTemplate": "处理结果：{{analysis}}"
 * }
 */
operatorRegistry.register("map.set", async ({ node, context }) => {
  // 从节点配置中提取参数
  const { key, valueTemplate } = node.config || {};
  
  // 步骤1：模板插值 - 将 valueTemplate 中的变量替换为实际值
  const value = interpolateTemplate(String(valueTemplate ?? ""), context);
  
  // 步骤2：按路径设置值到上下文
  // 例如：key = "result", value = "Success"
  //      结果：context.result = "Success"
  const patched = setByPath(context, String(key ?? "result"), value);
  
  // 返回结果
  return { 
    output: value,         // 节点的直接输出
    contextPatch: patched  // 更新后的上下文
  };
});

/**
 * HTTP 请求节点 (http.request)
 * 作用：发送 HTTP 请求到外部 API
 * 
 * 配置项：
 * - urlTemplate: URL 模板，支持 {{variable}} 插值
 * - method: HTTP 方法（默认 "GET"）
 * - headers: 请求头（可选）
 * - bodyTemplate: 请求体模板，支持插值（仅用于非 GET 请求）
 * 
 * 示例配置：
 * {
 *   "urlTemplate": "https://api.example.com/data?q={{query}}",
 *   "method": "POST",
 *   "headers": { "Content-Type": "application/json" },
 *   "bodyTemplate": "{\"text\": \"{{text}}\"}"
 * }
 */
operatorRegistry.register("http.request", async ({ node, context }) => {
  // 从节点配置中提取参数
  const config = node.config || {};
  const urlTemplate = config.urlTemplate;           // URL 模板
  const method = String(config.method ?? "GET");    // HTTP 方法
  const headers = config.headers;                   // 请求头
  const bodyTemplate = config.bodyTemplate;         // 请求体模板
  
  // 步骤1：模板插值 - 替换 URL 中的变量
  const url = interpolateTemplate(String(urlTemplate ?? ""), context);
  
  // 步骤2：构建请求选项
  const init: RequestInit = { method: method as RequestInit["method"] };  // 设置 HTTP 方法
  
  // 如果有请求头，添加到请求选项
  if (headers && typeof headers === "object" && headers !== null && !Array.isArray(headers)) {
    init.headers = headers as HeadersInit;
  }
  
  // 如果有请求体且不是 GET 请求，添加请求体
  if (bodyTemplate && method !== "GET") {
    init.body = interpolateTemplate(String(bodyTemplate ?? ""), context);
  }
  
  // 步骤3：发送 HTTP 请求
  const res = await fetch(url, init);
  
  // 步骤4：读取响应文本
  const text = await res.text();
  
  // 返回结果：包含状态码和响应文本
  return { 
    output: { 
      status: res.status,  // HTTP 状态码
      text                 // 响应文本
    } 
  };
});

// ==========================================
// LangChain 节点操作器注册
// ==========================================

/**
 * LangChain Chain 节点 (langchain.chain)
 * 作用：使用 LangChain 的顺序链执行 AI 任务
 * 
 * 配置项：
 * - model: 模型名称（默认 "gpt-4o-mini"）
 * - temperature: 温度参数（默认 0.2）
 * - promptTemplate: 提示词模板，支持 {{variable}} 插值
 * - systemTemplate: 系统提示词模板（可选）
 * - outputKey: 输出结果保存的键名（默认 "chain_output"）
 * 
 * 示例配置：
 * {
 *   "model": "gpt-4o-mini",
 *   "promptTemplate": "请总结以下文本：{{text}}",
 *   "outputKey": "summary"
 * }
 */
operatorRegistry.register("langchain.chain", langchainChainOperator);

/**
 * LangChain Agent 节点 (langchain.agent)
 * 作用：使用 LangChain Agent 进行推理和工具调用
 * 
 * 配置项：
 * - model: 模型名称（默认 "gpt-4o-mini"）
 * - temperature: 温度参数（默认 0.2）
 * - promptTemplate: Agent 的提示词模板
 * - maxIterations: 最大迭代次数（默认 5）
 * - outputKey: 输出结果保存的键名（默认 "agent_output"）
 * 
 * 示例配置：
 * {
 *   "model": "gpt-4o-mini",
 *   "promptTemplate": "使用工具回答：{{question}}",
 *   "outputKey": "answer"
 * }
 */
operatorRegistry.register("langchain.agent", langchainAgentOperator);

/**
 * LangChain Memory 节点 (langchain.memory)
 * 作用：保存和恢复对话历史
 * 
 * 配置项：
 * - action: 操作类型（"save" 或 "load"）
 * - memoryKey: 记忆键名（默认 "chat_history"）
 * - inputKey: 输入键名（默认 "input"）
 * - outputKey: 输出键名（默认 "output"）
 * 
 * 示例配置：
 * {
 *   "action": "save",
 *   "memoryKey": "history",
 *   "inputKey": "user_message",
 *   "outputKey": "ai_response"
 * }
 */
operatorRegistry.register("langchain.memory", langchainMemoryOperator);

// ==========================================
// 拓扑排序算法
// ==========================================

/**
 * 拓扑排序函数（Kahn 算法）
 * 作用：根据节点之间的依赖关系，确定正确的执行顺序
 * 
 * @param nodes - 所有节点的列表
 * @param edges - 所有连接线的列表
 * @returns 排序后的节点 ID 数组
 * @throws 如果图中存在环（循环依赖），抛出错误
 * 
 * 算法说明：
 * 1. 计算每个节点的入度（有多少条边指向它）
 * 2. 将入度为 0 的节点加入队列（没有依赖的节点可以先执行）
 * 3. 逐个取出队列中的节点，将其加入结果列表
 * 4. 对于每个取出的节点，将其指向的节点入度减 1
 * 5. 如果某个节点入度变为 0，将其加入队列
 * 6. 重复步骤 3-5，直到队列为空
 * 7. 如果结果列表长度不等于节点总数，说明存在环
 * 
 * 示例：
 * 节点：A, B, C, D
 * 连接：A->B, A->C, B->D, C->D
 * 结果：[A, B, C, D] 或 [A, C, B, D]（两种顺序都正确）
 */
function topoSort(
  nodes: { id: string }[],  // 节点列表
  edges: { sourceNodeId: string; targetNodeId: string }[]  // 边列表
): string[] {
  // 入度表：记录每个节点有多少条输入边
  const inDegree = new Map<string, number>();
  // 邻接表：记录每个节点指向哪些节点
  const adj = new Map<string, string[]>();
  
  // 初始化：为每个节点设置入度为 0，邻接列表为空数组
  for (const n of nodes) {
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
  }
  
  // 构建图：遍历所有边，更新入度和邻接表
  for (const e of edges) {
    // 目标节点的入度加 1（因为有一条边指向它）
    inDegree.set(e.targetNodeId, (inDegree.get(e.targetNodeId) || 0) + 1);
    // 在邻接表中记录：源节点指向目标节点
    adj.get(e.sourceNodeId)?.push(e.targetNodeId);
  }
  
  // 队列：存储入度为 0 的节点（可以立即执行的节点）
  const q: string[] = [];
  // 查找所有入度为 0 的节点，加入队列
  for (const [id, deg] of inDegree) {
    if (deg === 0) q.push(id);
  }
  
  // 结果列表：存储排序后的节点顺序
  const order: string[] = [];
  
  // Kahn 算法主循环
  while (q.length) {
    // 取出队列中的第一个节点
    const u = q.shift()!;
    // 将其加入结果列表（表示这个节点已经可以执行了）
    order.push(u);
    
    // 处理当前节点指向的所有节点
    for (const v of adj.get(u) || []) {
      // 将目标节点的入度减 1（因为当前节点已经执行完了）
      inDegree.set(v, (inDegree.get(v) || 0) - 1);
      // 如果目标节点的入度变为 0，说明它的所有依赖都已执行完毕
      // 将其加入队列，等待执行
      if ((inDegree.get(v) || 0) === 0) q.push(v);
    }
  }
  
  // 检查是否所有节点都已排序
  // 如果结果列表长度小于节点总数，说明存在环（循环依赖）
  if (order.length !== nodes.length) {
    throw new Error("Workflow graph has cycles; ensure DAG");
  }
  
  // 返回排序后的节点 ID 列表
  return order;
}

// ==========================================
// 工作流执行主函数
// ==========================================

/**
 * 执行工作流
 * 作用：运行指定的工作流，按拓扑顺序执行所有节点
 * 
 * @param params - 执行参数
 * @param params.workflowId - 要执行的工作流 ID
 * @param params.input - 初始输入数据（可选）
 * @returns 包含运行记录 ID 的对象
 * @throws 如果工作流不存在或执行失败，抛出错误
 * 
 * 执行流程：
 * 1. 从数据库加载工作流数据（包括节点和边）
 * 2. 创建运行记录（Run）
 * 3. 使用拓扑排序确定节点执行顺序
 * 4. 按顺序执行每个节点：
 *    a. 创建步骤记录（Step）
 *    b. 调用节点操作器执行节点逻辑
 *    c. 更新步骤状态和输出
 *    d. 更新执行上下文
 * 5. 更新运行记录状态（成功或失败）
 * 6. 返回运行记录 ID
 */
export async function executeWorkflow(params: {
  workflowId: string;        // 工作流 ID
  input?: ExecutionInput;    // 初始输入数据
}): Promise<{ runId: string }> {
  
  // ========== 步骤1：加载工作流数据 ==========
  const workflow = await prisma.workflow.findUnique({
    where: { id: params.workflowId },  // 按 ID 查询
    include: { 
      nodes: true,  // 包含所有节点
      edges: true   // 包含所有连接线
    },
  });
  
  // 如果工作流不存在，抛出错误
  if (!workflow) throw new Error("Workflow not found");

  // ========== 步骤2：创建运行记录 ==========
  const inputData = (params.input ?? {}) as Prisma.InputJsonValue;
  const run = await prisma.run.create({
    data: {
      workflowId: workflow.id,           // 关联工作流
      status: "RUNNING",                 // 初始状态：运行中
      startedAt: new Date(),             // 记录开始时间
      input: inputData,                  // 保存输入数据
      context: inputData,                // 初始上下文就是输入数据
    },
  });

  // 初始化执行上下文
  let context: ExecutionContext = (params.input ?? {}) as ExecutionContext;
  
  try {
    // ========== 步骤3：拓扑排序 ==========
    // 确定节点的执行顺序，确保依赖关系正确
    const order = topoSort(
      workflow.nodes.map(n => ({ id: n.id })),  // 提取节点 ID 列表
      workflow.edges.map(e => ({ 
        sourceNodeId: e.sourceNodeId, 
        targetNodeId: e.targetNodeId 
      })),  // 提取边的连接关系
    );

    // 创建节点 ID -> 节点数据的映射，方便快速查找
    const nodeById = new Map(workflow.nodes.map(n => [n.id, n] as const));
    
    // ========== 步骤4：按顺序执行每个节点 ==========
    for (const nodeId of order) {
      // 获取当前节点的数据
      const node = nodeById.get(nodeId)!;
      // 获取该节点类型对应的操作器
      const operator = operatorRegistry.get(node.type);
      
      // 创建步骤记录（记录节点执行详情）
      const step = await prisma.step.create({
        data: {
          runId: run.id,              // 关联运行记录
          nodeId: node.id,            // 关联节点
          status: "RUNNING",          // 初始状态：运行中
          startedAt: new Date(),      // 记录开始时间
          input: context as Prisma.InputJsonValue,  // 当前上下文作为输入
        },
      });
      
      try {
        // 检查节点操作器是否存在
        if (!operator) {
          throw new Error(`No operator for node type: ${node.type}`);
        }
        
        // 执行节点操作器
        // 将 Prisma 的 JsonValue 转换为 Record<string, unknown>
        const nodeConfig = node.config && typeof node.config === "object" && !Array.isArray(node.config)
          ? (node.config as Record<string, unknown>)
          : {};
        const { output, contextPatch } = await operator({ 
          node: { 
            id: node.id, 
            type: node.type, 
            label: node.label, 
            config: nodeConfig
          }, 
          context  // 传入当前上下文
        });
        
        // 如果节点返回了新的上下文数据，合并到当前上下文
        if (contextPatch) {
          context = { ...context, ...contextPatch };
        }
        
        // 更新步骤状态：执行成功
        await prisma.step.update({
          where: { id: step.id },
          data: { 
            status: "SUCCEEDED",        // 状态：成功
            finishedAt: new Date(),     // 记录结束时间
            output: output !== undefined ? (output as Prisma.InputJsonValue) : undefined  // 保存输出结果
          },
        });
      } catch (err: unknown) {
        // 节点执行失败：更新步骤状态
        // 提取错误信息：如果是 Error 对象则使用 message，否则转换为字符串
        const errorMessage = err instanceof Error ? err.message : String(err);
        await prisma.step.update({
          where: { id: step.id },
          data: { 
            status: "FAILED",                        // 状态：失败
            finishedAt: new Date(),                  // 记录结束时间
            error: errorMessage                      // 保存错误信息
          },
        });
        // 抛出错误，终止整个工作流
        throw err;
      }
      
      // 更新运行记录的上下文（保存当前累积的所有数据）
      await prisma.run.update({ 
        where: { id: run.id }, 
        data: { context: context as Prisma.InputJsonValue } 
      });
    }

    // ========== 步骤5：所有节点执行成功 ==========
    await prisma.run.update({
      where: { id: run.id },
      data: { 
        status: "SUCCEEDED",         // 状态：执行成功
        finishedAt: new Date(),      // 记录结束时间
        context: context as Prisma.InputJsonValue  // 保存最终上下文
      },
    });
    
    // 返回运行记录 ID
    return { runId: run.id };
    
  } catch (error: unknown) {
    // ========== 步骤6：工作流执行失败 ==========
    // 提取错误信息：如果是 Error 对象则使用 message，否则转换为字符串
    const errorMessage = error instanceof Error ? error.message : String(error);
    await prisma.run.update({
      where: { id: run.id },
      data: { 
        status: "FAILED",                      // 状态：执行失败
        finishedAt: new Date(),                // 记录结束时间
        error: errorMessage                    // 保存错误信息
      },
    });
    // 继续抛出错误，让调用者知道执行失败
    throw error;
  }
}