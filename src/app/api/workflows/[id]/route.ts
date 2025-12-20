// ==========================================
// 单个工作流 API 路由
// 文件路径：/api/workflows/[id]
// 文件作用：处理单个工作流的增删改查操作
// 功能：获取、更新、删除指定的工作流
// ==========================================

// 导入 Next.js 的 HTTP 响应工具
import { NextResponse } from "next/server";
// 导入数据库客户端
import { prisma } from "@/lib/prisma";

/**
 * GET /api/workflows/:id
 * 作用：获取指定工作流的详细信息
 * 
 * @param _req - HTTP 请求对象（未使用）
 * @param ctx - Next.js 路由上下文，包含动态路由参数
 * @returns 工作流的完整信息，包含节点和边
 * 
 * 响应示例：
 * {
 *   "id": "workflow123",
 *   "name": "文档分析流程",
 *   "description": "分析文学作品",
 *   "createdAt": "2025-01-01T00:00:00.000Z",
 *   "updatedAt": "2025-01-01T00:00:00.000Z",
 *   "nodes": [ ... ],
 *   "edges": [ ... ]
 * }
 * 
 * HTTP 状态码：
 * - 200 OK: 成功返回工作流
 * - 404 Not Found: 工作流不存在
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  // 从路由参数中获取工作流 ID
  const { id } = await ctx.params;
  
  // 从数据库查询工作流
  const wf = await prisma.workflow.findUnique({
    where: { id },                           // 根据 ID 查询
    include: { nodes: true, edges: true },   // 包含节点和边
  });
  
  // 如果工作流不存在，返回 404
  if (!wf) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  
  // 返回工作流数据
  return NextResponse.json(wf);
}

/**
 * PUT /api/workflows/:id
 * 作用：更新指定工作流的所有数据（包括节点和边）
 * 
 * @param req - HTTP 请求对象，包含更新数据
 * @param ctx - Next.js 路由上下文，包含工作流 ID
 * @returns 更新后的工作流对象
 * 
 * 请求体结构：
 * {
 *   "name": "更新的名称",
 *   "description": "更新的描述",
 *   "nodes": [
 *     {
 *       "id": "temp_node_1",    // 前端临时ID（可能不是数据库ID）
 *       "type": "input",
 *       "label": "输入节点",
 *       "position": { "x": 100, "y": 100 },
 *       "config": {}
 *     },
 *     ...
 *   ],
 *   "edges": [
 *     {
 *       "sourceNodeId": "temp_node_1",  // 引用节点的临时ID
 *       "targetNodeId": "temp_node_2"
 *     },
 *     ...
 *   ]
 * }
 * 
 * 更新策略（重要！）：
 * 1. 删除工作流的所有现有节点和边
 * 2. 重新创建所有节点，建立临时ID到数据库ID的映射
 * 3. 使用映射关系创建边（将临时ID转换为数据库ID）
 * 
 * 这种策略的原因：
 * - 简化更新逻辑（避免复杂的增量更新）
 * - 确保数据一致性（不会留下孤立的节点或边）
 * - 前端可以使用临时ID而不必跟踪数据库ID
 * 
 * HTTP 状态码：
 * - 200 OK: 成功更新
 * - 404 Not Found: 工作流不存在
 */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // 从路由参数中获取工作流 ID
  const { id } = await ctx.params;
  
  // 解析请求体
  const body = await req.json();
  const { 
    name,              // 工作流名称
    description,       // 工作流描述
    nodes = [],        // 节点列表
    edges = []         // 连接线列表
  } = body ?? {};

  // 检查工作流是否存在
  const current = await prisma.workflow.findUnique({ 
    where: { id }, 
    include: { nodes: true, edges: true } 
  });
  
  if (!current) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  // 步骤1：删除所有现有的节点和边
  // 使用事务确保原子性（要么全部成功，要么全部失败）
  await prisma.$transaction([
    prisma.workflowNode.deleteMany({ where: { workflowId: id } }),  // 删除所有节点
    prisma.workflowEdge.deleteMany({ where: { workflowId: id } }),  // 删除所有边
  ]);

  // 步骤2：重新创建节点，建立 ID 映射
  // 原因：前端使用的是临时ID（如 "temp_node_1"），数据库会生成新的ID
  const createdNodes: { clientId: string; dbId: string }[] = [];
  
  for (const n of nodes) {
    // 在数据库中创建节点
    const created = await prisma.workflowNode.create({
      data: {
        workflowId: id,                               // 关联工作流
        type: n.type,                                 // 节点类型
        label: n.label ?? null,                       // 节点标签
        positionX: Number(n.position?.x ?? 0),        // X坐标
        positionY: Number(n.position?.y ?? 0),        // Y坐标
        config: n.config ?? {},                       // 节点配置
      },
    });
    
    // 如果前端提供了ID，建立映射关系
    // 映射：clientId（前端临时ID）-> dbId（数据库真实ID）
    if (n.id) {
      createdNodes.push({ 
        clientId: String(n.id),   // 前端的临时ID
        dbId: created.id          // 数据库生成的真实ID
      });
    }
  }

  /**
   * ID 映射函数
   * 作用：将前端的临时ID转换为数据库的真实ID
   * 
   * @param nodeId - 节点ID（可能是临时ID或数据库ID）
   * @returns 数据库的真实ID
   * 
   * 逻辑：
   * 1. 如果能在映射表中找到，返回对应的数据库ID
   * 2. 如果找不到，说明传来的本来就是数据库ID，直接返回
   */
  function mapToDb(nodeId: string) {
    const hit = createdNodes.find(x => x.clientId === nodeId);
    return hit?.dbId ?? nodeId;  // 找到映射就用映射的ID，否则直接用原ID
  }

  // 步骤3：创建边（连接线）
  for (const e of edges) {
    await prisma.workflowEdge.create({
      data: {
        workflowId: id,                                  // 关联工作流
        sourceNodeId: mapToDb(String(e.sourceNodeId)),   // 转换起始节点ID
        targetNodeId: mapToDb(String(e.targetNodeId)),   // 转换目标节点ID
        label: e.label ?? null,                          // 连接线标签
        condition: e.condition ?? null,                  // 条件表达式
      },
    });
  }

  // 步骤4：查询并返回更新后的完整工作流数据
  const updated = await prisma.workflow.findUnique({
    where: { id },
    include: { nodes: true, edges: true },  // 包含新创建的节点和边
  });
  
  // 返回更新后的工作流
  return NextResponse.json(updated);
}

/**
 * DELETE /api/workflows/:id
 * 作用：删除指定的工作流
 * 
 * @param _req - HTTP 请求对象（未使用）
 * @param ctx - Next.js 路由上下文，包含工作流 ID
 * @returns 成功响应
 * 
 * 删除逻辑：
 * 1. 数据库中定义了级联删除（onDelete: Cascade）
 * 2. 删除工作流时，会自动删除：
 *    - 所有关联的节点（WorkflowNode）
 *    - 所有关联的边（WorkflowEdge）
 *    - 所有关联的运行记录（Run）
 *    - 所有关联的执行步骤（Step）
 * 
 * 响应示例：
 * {
 *   "ok": true
 * }
 * 
 * HTTP 状态码：
 * - 200 OK: 删除成功
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  // 从路由参数中获取工作流 ID
  const { id } = await ctx.params;
  
  // 删除工作流（级联删除所有关联数据）
  await prisma.workflow.delete({ where: { id } });
  
  // 返回成功响应
  return NextResponse.json({ ok: true });
}