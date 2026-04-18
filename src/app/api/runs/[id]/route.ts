// ==========================================
// 运行记录详情 API 路由
// 文件路径：/api/runs/[id]
// 文件作用：获取工作流运行的详细信息
// 功能：查询运行状态、步骤详情、输入输出数据
// ==========================================

// 导入 Next.js 的 HTTP 响应工具
import { NextResponse } from "next/server";
// 导入数据库客户端
import { prisma } from "@/lib/prisma";

// 定义路由参数类型（Next.js 15 中 params 是 Promise）
type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/runs/:id
 * 作用：获取指定运行记录的详细信息
 * 
 * @param _req - HTTP 请求对象（未使用，用下划线标记）
 * @param ctx - 路由上下文，包含运行记录 ID（Promise）
 * @returns 运行记录的完整信息，包含步骤和工作流数据
 * 
 * 查询逻辑：
 * 1. 根据 ID 查询运行记录
 * 2. 包含所有执行步骤（按开始时间升序）
 * 3. 包含关联的工作流信息
 * 
 * 响应结构：
 * {
 *   "id": "run123",                        // 运行记录ID
 *   "workflowId": "workflow456",           // 工作流ID
 *   "status": "SUCCEEDED",                 // 状态：PENDING/RUNNING/SUCCEEDED/FAILED
 *   "startedAt": "2025-01-01T00:00:00Z",   // 开始时间
 *   "finishedAt": "2025-01-01T00:01:00Z",  // 结束时间
 *   "input": { "text": "Hello" },          // 输入数据
 *   "context": { "text": "Hello", ... },   // 最终上下文
 *   "error": null,                         // 错误信息（如果失败）
 *   "workflow": {                          // 关联的工作流
 *     "id": "workflow456",
 *     "name": "文档分析流程",
 *     ...
 *   },
 *   "steps": [                             // 所有执行步骤
 *     {
 *       "id": "step789",
 *       "nodeId": "node001",
 *       "status": "SUCCEEDED",
 *       "startedAt": "2025-01-01T00:00:00Z",
 *       "finishedAt": "2025-01-01T00:00:05Z",
 *       "input": { ... },                  // 步骤输入
 *       "output": { ... },                 // 步骤输出
 *       "error": null
 *     },
 *     ...
 *   ]
 * }
 * 
 * 用途：
 * 1. 前端轮询此接口查看执行进度
 * 2. 显示详细的执行日志
 * 3. 调试工作流问题
 * 
 * HTTP 状态码：
 * - 200 OK: 成功返回运行记录
 * - 404 Not Found: 运行记录不存在
 */
export async function GET(_req: Request, ctx: Params) {
  // Next.js 15 中 params 是 Promise，需要 await
  const { id } = await ctx.params;
  
  // 从数据库查询运行记录
  const run = await prisma.run.findUnique({
    where: { id },  // 根据 ID 查询
    include: { 
      // 包含所有执行步骤
      steps: { 
        orderBy: { startedAt: "asc" }  // 按开始时间升序排列（执行顺序）
      },
      // 包含关联的工作流信息
      workflow: true 
    },
  });
  
  // 如果运行记录不存在，返回 404 错误
  if (!run) {
    return NextResponse.json(
      { message: "Not found" },  // 错误消息
      { status: 404 }            // HTTP 状态码 404
    );
  }
  
  // 返回完整的运行记录数据
  return NextResponse.json(run);
}