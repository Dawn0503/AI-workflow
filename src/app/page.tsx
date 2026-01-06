// ==========================================
// 首页组件
// 文件作用：自动重定向到工作流列表页
// ==========================================

import { redirect } from "next/navigation";

/**
 * 首页组件
 * 作用：当用户访问根路径 "/" 时，自动重定向到 "/workflows"
 * 
 * 使用 Next.js 15 的服务端重定向功能：
 * - redirect() 在服务端执行，直接返回 HTTP 302 重定向
 * - 不会加载页面内容，性能更好
 * - SEO 友好
 */
export default function Home() {
  // 服务端重定向到工作流列表页
  redirect("/workflows");
}
