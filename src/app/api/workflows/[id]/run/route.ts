// ==========================================
// 工作流运行 API 路由
// 文件路径：/api/workflows/[id]/run
// 文件作用：触发工作流执行
// 功能：接收输入数据，运行指定的工作流
// ==========================================

// 导入 Next.js 的 HTTP 响应工具
import { NextResponse } from "next/server";
// 导入工作流执行引擎
import { executeWorkflow } from "@/lib/engine";

// 强制使用 Node.js 运行时（而不是 Edge Runtime）
// 原因：需要完整的 Node.js 功能，如文件系统、长超时、网络代理等
export const runtime = "nodejs";

/**
 * POST /api/workflows/:id/run
 * 作用：运行指定的工作流
 * 
 * @param req - HTTP 请求对象，包含输入数据
 * @param ctx - Next.js 路由上下文，包含动态路由参数
 * @returns 运行记录 ID，HTTP 状态码 202 (Accepted)
 * 
 * 请求体结构：
 * {
 *   "input": {                 // 初始输入数据
 *     "text": "要处理的文本",  // 示例字段
 *     "key": "value"           // 其他自定义字段
 *   }
 * }
 * 
 * 处理流程：
 * 1. 从路由参数中获取工作流 ID
 * 2. 从请求体中获取输入数据
 * 3. 调用执行引擎运行工作流
 * 4. 返回运行记录 ID（异步执行）
 * 
 * 响应示例（成功）：
 * {
 *   "runId": "run123"  // 运行记录的唯一标识符
 * }
 * 
 * 响应示例（失败）：
 * {
 *   "error": "错误信息"
 * }
 * 
 * HTTP 状态码：
 * - 202 Accepted: 工作流已接受并开始执行
 * - 500 Internal Server Error: 执行失败
 * 
 * 注意事项：
 * 1. 返回 202 表示"已接受"，工作流在后台异步执行
 * 2. 客户端需要轮询 GET /api/runs/:id 来获取执行状态和结果
 * 3. 执行时间可能较长（取决于节点数量和 AI 调用）
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    // 从路由上下文中获取工作流 ID（动态路由参数）
    // 注意：Next.js 15 中 params 是 Promise 类型，需要 await
    const { id } = await ctx.params;
    
    // 从请求体中获取输入数据
    // 使用 catch 处理 JSON 解析错误，提供默认空对象
    const body = (await req.json().catch(() => ({}))) as { input?: Record<string, unknown> };
    
    // 调用工作流执行引擎
    // executeWorkflow() 会：
    // 1. 加载工作流数据
    // 2. 创建 Run 记录
    // 3. 执行所有节点
    // 4. 更新 Run 和 Step 状态
    const { runId } = await executeWorkflow({ 
      workflowId: id,                   // 要执行的工作流 ID
      input: body?.input ?? {}          // 初始输入数据（默认空对象）
    });
    
    // 返回运行记录 ID，状态码 202 (Accepted)
    // 202 表示请求已被接受处理，但处理尚未完成
    return NextResponse.json({ runId }, { status: 202 });
    
  } catch (error: unknown) {
    // 捕获执行过程中的任何错误
    // 可能的错误：
    // - 工作流不存在
    // - 节点配置错误
    // - AI API 调用失败
    // - 数据库错误等
    
    // 返回错误信息，状态码 500 (Internal Server Error)
    return NextResponse.json(
      { error: String(error instanceof Error ? error.message : String(error)) },  // 提取错误消息
      { status: 500 }
    );
  }
}