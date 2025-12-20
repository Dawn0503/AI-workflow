// ==========================================
// Prisma 数据库客户端单例
// 文件作用：创建和导出 Prisma 数据库客户端实例
// 关键点：使用单例模式避免创建多个连接
// ==========================================

// 从 Prisma 生成的客户端中导入 PrismaClient 类
import { PrismaClient } from "@prisma/client";

// 声明全局变量类型，用于在开发模式下存储 Prisma 实例
// 作用：避免 Next.js 热重载时创建多个数据库连接
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

// 创建或获取 Prisma 客户端实例（单例模式）
// 如果全局变量中已有实例，则复用；否则创建新实例
export const prisma =
  globalForPrisma.prisma ??  // 使用空值合并运算符，如果全局变量为 null/undefined 则创建新实例
  new PrismaClient({
    log: ["query", "error", "warn"],  // 配置日志级别：记录查询、错误和警告
  });

// 在非生产环境下，将 Prisma 实例保存到全局变量
// 原因：Next.js 开发模式下会频繁热重载，保存到全局可以复用连接
// 生产环境不需要这样做，因为代码不会重新加载
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
