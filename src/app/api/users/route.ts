// ==========================================
// 用户 API 路由
// 文件路径：/api/users
// 文件作用：处理用户相关的 HTTP 请求
// 功能：获取用户列表、创建新用户
// ==========================================

// 导入 Next.js 的 HTTP 响应工具
import { NextResponse } from "next/server";
// 导入数据库客户端
import { prisma } from "@/lib/prisma";

/**
 * GET /api/users
 * 作用：获取所有用户列表
 * 
 * @returns 用户数组的 JSON 响应
 * 
 * 响应示例：
 * [
 *   {
 *     "id": "user123",
 *     "email": "user@example.com",
 *     "name": "张三",
 *     "createdAt": "2025-01-01T00:00:00.000Z",
 *     "updatedAt": "2025-01-01T00:00:00.000Z"
 *   }
 * ]
 */
export async function GET() {
  // 从数据库查询所有用户
  const users = await prisma.user.findMany();
  // 返回 JSON 格式的用户列表
  return NextResponse.json(users);
}

/**
 * POST /api/users
 * 作用：创建新用户
 * 
 * @param request - HTTP 请求对象，包含用户数据
 * @returns 创建的用户对象，HTTP 状态码 201
 * 
 * 请求体示例：
 * {
 *   "email": "newuser@example.com",
 *   "name": "李四"
 * }
 * 
 * 响应示例：
 * {
 *   "id": "user456",
 *   "email": "newuser@example.com",
 *   "name": "李四",
 *   "createdAt": "2025-01-01T00:00:00.000Z",
 *   "updatedAt": "2025-01-01T00:00:00.000Z"
 * }
 */
export async function POST(request: Request) {
  // 解析请求体（JSON 格式）
  const body = await request.json();
  // 在数据库中创建新用户
  const user = await prisma.user.create({ data: body });
  // 返回创建的用户对象，状态码 201（Created）
  return NextResponse.json(user, { status: 201 });
}
