// ==========================================
// 工作流列表 API 路由
// 文件路径：/api/workflows
// 文件作用：处理工作流列表的 HTTP 请求
// 功能：获取所有工作流、创建新工作流
// ==========================================

// 导入 Next.js 的 HTTP 响应工具
import { NextResponse } from "next/server";
// 导入数据库客户端
import { prisma } from "@/lib/prisma";

/**
 * GET /api/workflows
 * 作用：获取所有工作流列表
 * 
 * @returns 工作流数组的 JSON 响应，包含节点和边信息
 * 
 * 查询逻辑：
 * 1. 查询所有工作流
 * 2. 包含（include）关联的节点和边
 * 3. 按更新时间倒序排列
 * 
 * 响应示例：
 * [
 *   {
 *     "id": "workflow123",
 *     "name": "文档分析流程",
 *     "description": "分析文学作品",
 *     "createdAt": "2025-01-01T00:00:00.000Z",
 *     "updatedAt": "2025-01-01T00:00:00.000Z",
 *     "nodes": [ ... ],  // 工作流包含的所有节点
 *     "edges": [ ... ]   // 节点之间的所有连接
 *   }
 * ]
 */
export async function GET() {
  // 从数据库查询所有工作流
  const data = await prisma.workflow.findMany({
    include: { 
      nodes: true,  // 包含关联的节点数据
      edges: true   // 包含关联的连接线数据
    },
    orderBy: { updatedAt: "desc" },  // 按更新时间降序排列（最新的在前）
  });
  
  // 返回 JSON 格式的工作流列表
  return NextResponse.json(data);
}

/**
 * POST /api/workflows
 * 作用：创建新的工作流
 * 
 * @param req - HTTP 请求对象，包含工作流数据
 * @returns 创建的工作流对象，HTTP 状态码 201
 * 
 * 请求体结构：
 * {
 *   "name": "工作流名称",              // 必需
 *   "description": "工作流描述",       // 可选
 *   "nodes": [                         // 初始节点列表（可选）
 *     {
 *       "type": "input",               // 节点类型
 *       "label": "输入节点",           // 显示名称
 *       "position": { "x": 0, "y": 0 }, // 画布位置
 *       "config": {}                   // 节点配置
 *     }
 *   ],
 *   "edges": []                        // 初始连接线列表（通常为空）
 * }
 * 
 * 处理流程：
 * 1. 解析请求体获取工作流数据
 * 2. 使用 Prisma 事务创建工作流、节点和边
 * 3. 返回完整的工作流对象
 * 
 * 响应示例：
 * {
 *   "id": "workflow456",
 *   "name": "新工作流",
 *   "description": "测试",
 *   "createdAt": "2025-01-01T00:00:00.000Z",
 *   "updatedAt": "2025-01-01T00:00:00.000Z",
 *   "nodes": [ { "id": "node789", ... } ],
 *   "edges": []
 * }
 */
export async function POST(req: Request) {
  // 解析请求体（JSON 格式）
  const body = await req.json();
  // 从请求体中提取字段，提供默认值
  const { 
    name,                    // 工作流名称（必需）
    description,             // 工作流描述（可选）
    nodes = [],              // 节点列表（默认为空数组）
    edges = []               // 连接线列表（默认为空数组）
  } = body ?? {};
  
  // 在数据库中创建工作流（使用嵌套创建）
  const created = await prisma.workflow.create({
    data: {
      name,           // 工作流名称
      description,    // 工作流描述
      // 创建关联的节点
      nodes: {
        create: nodes.map((n: any) => ({
          type: n.type,                                  // 节点类型
          label: n.label ?? null,                        // 节点标签（可选）
          positionX: Number(n.position?.x ?? 0),         // X坐标（默认0）
          positionY: Number(n.position?.y ?? 0),         // Y坐标（默认0）
          config: n.config ?? {},                        // 节点配置（默认空对象）
        })),
      },
      // 创建关联的连接线
      edges: {
        create: edges.map((e: any) => ({
          sourceNodeId: e.sourceNodeId,     // 起始节点ID
          targetNodeId: e.targetNodeId,     // 目标节点ID
          label: e.label ?? null,           // 连接线标签（可选）
          condition: e.condition ?? null,   // 条件表达式（可选）
        })),
      },
    },
    // 返回时包含节点和边的完整数据
    include: { nodes: true, edges: true },
  });
  
  // 返回创建的工作流，状态码 201 (Created)
  return NextResponse.json(created, { status: 201 });
}