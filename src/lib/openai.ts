// ==========================================
// OpenAI 客户端单例
// 文件作用：创建和管理 OpenAI API 客户端
// 关键点：支持自定义 API 地址，兼容国内 AI 厂商
// ==========================================

// 导入 OpenAI SDK
import OpenAI from "openai";

// 单例变量：存储 OpenAI 客户端实例
// 使用单例模式确保整个应用只创建一次客户端
let singleton: OpenAI | null = null;

/**
 * 获取 OpenAI 客户端实例（单例模式）
 * @returns OpenAI 客户端实例
 * @throws 如果未设置 OPENAI_API_KEY 环境变量则抛出错误
 * 
 * 支持的环境变量：
 * - OPENAI_API_KEY: OpenAI API 密钥（必需）
 * - OPENAI_BASE_URL: 自定义 API 地址（可选，用于兼容国内厂商）
 * 
 * 兼容的 AI 厂商示例：
 * - OpenAI: 不设置 OPENAI_BASE_URL
 * - 智谱 AI: https://open.bigmodel.cn/api/paas/v4/
 * - SiliconFlow: https://api.siliconflow.cn/v1
 * - 月之暗面 Kimi: https://api.moonshot.cn/v1
 */
export function getOpenAIClient(): OpenAI {
  // 如果已经创建过实例，直接返回（单例模式）
  if (singleton) return singleton;
  
  // 从环境变量读取 API 密钥
  const apiKey = process.env.OPENAI_API_KEY;
  // 如果未设置 API 密钥，抛出错误
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set in environment variables");
  }
  
  // 从环境变量读取自定义 API 地址（可选）
  // 作用：兼容国产/第三方 OpenAI 兼容 API 网关
  const baseURL = process.env.OPENAI_BASE_URL;
  
  // 创建 OpenAI 客户端实例
  singleton = new OpenAI({
    apiKey,              // API 密钥
    baseURL,             // 自定义 API 地址（如果为空，使用默认的 OpenAI 地址）
    timeout: 120000,     // 请求超时时间：120 秒（2分钟）
  });
  
  // 返回创建的实例
  return singleton;
}


