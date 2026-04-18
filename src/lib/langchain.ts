// ==========================================
// LangChain 集成模块
// 文件作用：提供 LangChain 相关的节点操作器
// 核心功能：
// 1. LangChain Chains 支持（顺序链、路由链等）
// 2. LangChain Agents 支持（ReAct、工具调用等）
// 3. LangChain Memory 支持（对话记忆）
// 4. LangChain Tools 支持（自定义工具）
// ==========================================

import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { interpolateTemplate } from "@/lib/utils/interpolate";
import { NodeOperatorArgs, NodeOperatorResult } from "@/lib/engine";

/**
 * 获取 LangChain ChatOpenAI 实例
 * 注意：每次调用都创建新实例，因为模型名称或温度可能不同
 * 实际应用中可以考虑根据 model+temperature 的组合进行缓存
 */
function getChatModel(model?: string, temperature?: number): ChatOpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set in environment variables");
  }

  // 每次都创建新实例，因为模型名称或温度可能不同
  // 实际应用中可以考虑缓存策略
  // 注意：LangChain ChatOpenAI 使用 model 而不是 modelName，使用 apiKey 而不是 openAIApiKey
  const config: {
    model?: string;
    temperature?: number;
    apiKey: string;
    baseURL?: string;
  } = {
    model: model || "gpt-4o-mini",
    temperature: temperature ?? 0.2,
    apiKey: apiKey,
  };

  if (process.env.OPENAI_BASE_URL) {
    config.baseURL = process.env.OPENAI_BASE_URL;
  }

  return new ChatOpenAI(config);
}

// ==========================================
// LangChain Chain 节点操作器
// ==========================================

/**
 * LangChain Chain 节点
 * 支持顺序链（Sequential Chain）、路由链等
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
export async function langchainChainOperator(
  args: NodeOperatorArgs
): Promise<NodeOperatorResult> {
  const { node, context } = args;
  const config = node.config || {};
  
  const model = String(config.model ?? "gpt-4o-mini");
  const temperature = config.temperature ? Number(config.temperature) : 0.2;
  const promptTemplate = config.promptTemplate ?? "";
  const systemTemplate = config.systemTemplate ?? "";
  const outputKey = String(config.outputKey ?? "chain_output");
  
  // 获取 LangChain 模型实例
  const chatModel = getChatModel(model, temperature);
  
  // 插值提示词模板
  const interpolatedPrompt = interpolateTemplate(String(promptTemplate), context);
  const interpolatedSystem = systemTemplate 
    ? interpolateTemplate(String(systemTemplate), context) 
    : null;
  
  // 验证提示词不为空
  if (!interpolatedPrompt || interpolatedPrompt.trim() === "") {
    throw new Error("提示词模板插值后为空，请检查 promptTemplate 配置");
  }
  
  // 直接调用模型，不使用 ChatPromptTemplate（因为我们已经插值了）
  // ChatPromptTemplate 用于模板变量，我们已经手动插值了，所以直接调用模型
  const messages = [];
  if (interpolatedSystem && interpolatedSystem.trim()) {
    messages.push(new SystemMessage(interpolatedSystem));
  }
  messages.push(new HumanMessage(interpolatedPrompt));
  
  // 直接调用模型
  const response = await chatModel.invoke(messages);
  
  // 提取响应内容
  let content: string;
  if (typeof response === "string") {
    content = response;
  } else if (response && typeof response === "object" && "content" in response) {
    content = typeof response.content === "string" 
      ? response.content 
      : JSON.stringify(response.content);
  } else {
    content = JSON.stringify(response);
  }
  
  // 保存结果到上下文
  const patched = { ...context, [outputKey]: content };
  
  return {
    output: content,
    contextPatch: patched,
  };
}

// ==========================================
// LangChain Agent 节点操作器
// ==========================================

/**
 * LangChain Agent 节点
 * 支持 ReAct Agent 等，可以调用工具进行推理和行动
 * 
 * 配置项：
 * - model: 模型名称（默认 "gpt-4o-mini"）
 * - temperature: 温度参数（默认 0.2）
 * - promptTemplate: Agent 的提示词模板
 * - tools: 工具列表（可选，当前版本暂不支持自定义工具）
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
/**
 * LangChain Agent 节点操作器（简化版本）
 * 注意：完整 Agent 功能需要额外的依赖和配置
 * 当前版本降级为 Chain 调用，后续可以扩展为完整 Agent
 */
export async function langchainAgentOperator(
  args: NodeOperatorArgs
): Promise<NodeOperatorResult> {
  const { node } = args;
  const config = node.config || {};
  
  // 当前版本：Agent 节点降级为 Chain 调用
  // 原因：完整 Agent 实现需要 @langchain/community 和其他工具包
  // 后续可以扩展为：
  // 1. 安装 @langchain/community 包
  // 2. 实现工具定义
  // 3. 使用 createReactAgent 和 AgentExecutor
  
  // 添加提示信息到配置中
  const agentPrompt = `You are a helpful AI agent. Please answer the following question thoughtfully: ${config.promptTemplate || ""}`;
  
  // 使用 Chain 操作器作为降级方案
  const chainConfig = {
    ...config,
    promptTemplate: agentPrompt || config.promptTemplate,
    outputKey: config.outputKey || "agent_output",
  };
  
  const chainArgs = {
    ...args,
    node: {
      ...node,
      config: chainConfig,
    },
  };
  
  return await langchainChainOperator(chainArgs);
}

// ==========================================
// LangChain Memory 节点操作器（对话记忆）
// ==========================================

/**
 * LangChain Memory 节点
 * 用于保存和恢复对话历史
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
export async function langchainMemoryOperator(
  args: NodeOperatorArgs
): Promise<NodeOperatorResult> {
  const { node, context: ctx } = args;
  const config = node.config || {};
  
  const action = String(config.action ?? "save");
  const memoryKey = String(config.memoryKey ?? "chat_history");
  const inputKey = String(config.inputKey ?? "input");
  const outputKey = String(config.outputKey ?? "output");
  
  // 获取或初始化记忆
  let memory = (ctx[memoryKey] as Array<{ role: string; content: string }>) || [];
  
  if (action === "save") {
    // 保存对话记录
    const input = ctx[inputKey] ? String(ctx[inputKey]) : "";
    const output = ctx[outputKey] ? String(ctx[outputKey]) : "";
    
    if (input) {
      memory.push({ role: "user", content: input });
    }
    if (output) {
      memory.push({ role: "assistant", content: output });
    }
    
    // 限制记忆长度（保留最近 20 轮对话）
    if (memory.length > 40) {
      memory = memory.slice(-40);
    }
    
    const patched = { ...ctx, [memoryKey]: memory };
    return {
      output: { message: "Memory saved", historyLength: memory.length },
      contextPatch: patched,
    };
  } else if (action === "load") {
    // 加载对话记录
    const patched = { ...ctx, [memoryKey]: memory };
    return {
      output: { history: memory, historyLength: memory.length },
      contextPatch: patched,
    };
  } else {
    throw new Error(`Unknown memory action: ${action}`);
  }
}

