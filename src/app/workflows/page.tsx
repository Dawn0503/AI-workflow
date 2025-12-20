// ==========================================
// 🟢 前端页面：工作流列表页
// 文件路径：/workflows
// 文件作用：展示所有工作流，创建新工作流
// 关键功能：
// 1. 显示工作流列表
// 2. 创建新工作流表单
// 3. 跳转到编辑器或详情页
// ==========================================

"use client";  // Next.js 客户端组件标记（必需，因为使用了 useState 等 Hooks）

// 导入 React Hooks
import { useEffect, useState } from "react";

// ==========================================
// 类型定义
// ==========================================

/**
 * 工作流类型定义
 * 定义从后端API获取的工作流数据结构
 */
type Workflow = {
  id: string;                     // 工作流唯一标识符
  name: string;                   // 工作流名称
  description?: string | null;    // 工作流描述（可选）
  createdAt?: string;             // 创建时间（ISO 8601 格式字符串）
  updatedAt?: string;             // 更新时间（ISO 8601 格式字符串）
  nodes?: any[];                  // 工作流包含的节点列表
  edges?: any[];                  // 工作流包含的连接线列表
};

// ==========================================
// 工作流列表页组件
// ==========================================

/**
 * 工作流列表页面组件
 * 作用：展示所有工作流，提供创建和管理入口
 * 
 * 功能列表：
 * 1. 从后端加载工作流列表
 * 2. 显示每个工作流的基本信息
 * 3. 提供创建新工作流的表单
 * 4. 提供跳转到编辑器和详情页的链接
 * 
 * 与后端交互：
 * - GET /api/workflows - 获取工作流列表
 * - POST /api/workflows - 创建新工作流
 */
export default function WorkflowsPage() {
  // ========== 状态管理 ==========
  
  // 工作流列表数据
  const [items, setItems] = useState<Workflow[]>([]);
  
  // 创建表单的状态
  const [name, setName] = useState("");           // 工作流名称
  const [desc, setDesc] = useState("");           // 工作流描述
  
  // 加载和创建状态
  const [loading, setLoading] = useState(false);    // 列表加载中
  const [creating, setCreating] = useState(false);  // 正在创建工作流

  // ========== 数据加载 ==========
  
  /**
   * 组件挂载时加载工作流列表
   * useEffect：在组件首次渲染后执行
   * 依赖数组为空[]：只在挂载时执行一次
   */
  useEffect(() => {
    /**
     * 异步函数：从后端获取工作流列表
     * API: GET /api/workflows
     */
    const fetchWorkflows = async () => {
      setLoading(true);  // 设置加载状态为true
      try {
        // 调用后端API获取工作流列表
        const response = await fetch("/api/workflows");
        // 解析JSON响应
        const data = await response.json();
        // 更新状态：保存工作流列表
        setItems(data);
      } catch (error) {
        // 捕获网络错误或解析错误
        console.error('Failed to fetch workflows:', error);
      } finally {
        // 无论成功失败，都结束加载状态
        setLoading(false);
      }
    };
    
    // 执行加载函数
    fetchWorkflows();
  }, []);  // 空依赖数组：只在组件挂载时执行一次

  // ========== 创建工作流 ==========
  
  /**
   * 创建新工作流的函数
   * 流程：
   * 1. 验证输入
   * 2. 发送 POST 请求到后端
   * 3. 更新列表
   * 4. 清空表单
   */
  async function create() {
    // 验证：工作流名称不能为空
    if (!name.trim()) return;
    
    setCreating(true);  // 设置创建状态为true（禁用按钮，显示加载动画）
    try {
      // 发送 POST 请求创建工作流
      const res = await fetch("/api/workflows", {
        method: "POST",                                  // HTTP 方法：POST
        headers: { "Content-Type": "application/json" }, // 请求头：指定JSON格式
        body: JSON.stringify({                           // 请求体：转换为JSON字符串
          name: name.trim(),                             // 工作流名称（去除首尾空格）
          description: desc.trim() || null,              // 描述（空字符串转为null）
          nodes: [{ type: "input", label: "Input" }],    // 默认创建一个输入节点
          edges: []                                      // 初始无连接线
        }),
      });
      
      // 检查响应状态
      if (res.ok) {
        // 创建成功：解析返回的工作流对象
        const wf = await res.json();
        // 更新列表：将新工作流添加到列表开头
        setItems([wf, ...items]);
        // 清空表单
        setName("");
        setDesc("");
      } else {
        // 创建失败：提示用户
        alert('创建工作流失败');
      }
    } catch (error) {
      // 捕获网络错误
      console.error('Failed to create workflow:', error);
      alert('创建工作流失败');
    } finally {
      // 无论成功失败，都结束创建状态
      setCreating(false);
    }
  }

  // ========== 工具函数 ==========
  
  /**
   * 格式化日期字符串
   * @param dateString - ISO 8601 格式的日期字符串
   * @returns 本地化的日期字符串（如："2025年1月1日"）
   */
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';  // 如果没有日期，返回空字符串
    // 使用 Intl.DateTimeFormat 格式化日期（中文格式）
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',   // 显示年份（如：2025）
      month: 'short',    // 显示月份（如：1月）
      day: 'numeric'     // 显示日期（如：1日）
    });
  };

  // ========== UI 渲染 ==========
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ==========================================
          头部导航栏
          显示标题和工作流数量
          ========================================== */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              {/* 页面标题 */}
              <h1 className="text-2xl font-bold text-gray-900">AI 工作流</h1>
              {/* 工作流数量徽章 */}
              <div className="ml-4 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                {items.length} 个工作流
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ==========================================
            创建新工作流卡片
            包含表单：名称、描述、创建按钮
            ========================================== */}
        <div className="bg-white rounded-lg shadow-sm border mb-8">
          <div className="p-6">
            {/* 卡片标题 */}
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">✨</span>
              创建新工作流
            </h2>
            
            {/* 表单：使用响应式网格布局 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* 工作流名称输入框 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  工作流名称 *
                </label>
                <input
                  type="text"
                  placeholder="例如：文档分析流程"
                  value={name}                              // 绑定状态
                  onChange={e => setName(e.target.value)}   // 更新状态
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={creating}                       // 创建中禁用输入
                />
              </div>
              
              {/* 工作流描述输入框（可选） */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  描述（可选）
                </label>
                <input
                  type="text"
                  placeholder="简单描述这个工作流的用途"
                  value={desc}                              // 绑定状态
                  onChange={e => setDesc(e.target.value)}   // 更新状态
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={creating}                       // 创建中禁用输入
                />
              </div>
            </div>
            
            {/* 创建按钮 */}
            <button
              onClick={create}                                 // 点击触发创建函数
              disabled={creating || !name.trim()}             // 创建中或名称为空时禁用
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? (
                /* 创建中：显示加载动画 */
                <span className="flex items-center">
                  {/* SVG 加载动画（旋转的圆圈） */}
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  创建中...
                </span>
              ) : (
                /* 正常状态：显示创建按钮 */
                <span className="flex items-center">
                  <span className="mr-2">+</span>
                  创建工作流
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ==========================================
            工作流列表卡片
            显示所有工作流或空状态
            ========================================== */}
        <div className="bg-white rounded-lg shadow-sm border">
          {/* 列表标题 */}
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <span className="mr-2">📋</span>
              我的工作流
            </h2>
          </div>

          {/* 根据加载状态显示不同内容 */}
          {loading ? (
            /* 加载中：显示加载动画 */
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">加载中...</p>
            </div>
          ) : items.length === 0 ? (
            /* 空状态：提示用户创建第一个工作流 */
            <div className="p-12 text-center">
              <div className="text-gray-400 text-4xl mb-4">🤖</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">还没有工作流</h3>
              <p className="text-gray-600 mb-6">创建您的第一个AI工作流，开始自动化处理任务</p>
            </div>
          ) : (
            /* 工作流列表：遍历显示每个工作流 */
            <div className="divide-y divide-gray-200">
              {items.map((workflow, index) => (
                /* 单个工作流卡片 */
                <div key={workflow.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    {/* 左侧：工作流信息 */}
                    <div className="flex-1">
                      {/* 工作流名称和序号 */}
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          {/* 点击名称跳转到详情页 */}
                          <a 
                            href={`/workflows/${workflow.id}`}
                            className="hover:text-blue-600 transition-colors"
                          >
                            {workflow.name}
                          </a>
                        </h3>
                        {/* 序号徽章 */}
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                          #{index + 1}
                        </span>
                      </div>
                      
                      {/* 工作流描述（如果有） */}
                      {workflow.description && (
                        <p className="text-gray-600 mb-3">{workflow.description}</p>
                      )}
                      
                      {/* 元数据：创建时间、节点数、更新时间 */}
                      <div className="flex items-center space-x-6 text-sm text-gray-500">
                        {/* 创建时间 */}
                        <div className="flex items-center">
                          <span className="mr-1">📅</span>
                          创建于 {formatDate(workflow.createdAt)}
                        </div>
                        {/* 节点数量 */}
                        {workflow.nodes && (
                          <div className="flex items-center">
                            <span className="mr-1">🔗</span>
                            {workflow.nodes.length} 个节点
                          </div>
                        )}
                        {/* 更新时间（如果与创建时间不同） */}
                        {workflow.updatedAt && workflow.updatedAt !== workflow.createdAt && (
                          <div className="flex items-center">
                            <span className="mr-1">✏️</span>
                            更新于 {formatDate(workflow.updatedAt)}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* 右侧：操作按钮 */}
                    <div className="flex items-center space-x-3 ml-6">
                      {/* 编辑按钮：跳转到可视化编辑器 */}
                      <a
                        href={`/workflows/${workflow.id}/editor`}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        编辑
                      </a>
                      {/* 查看按钮：跳转到详情页 */}
                      <a
                        href={`/workflows/${workflow.id}`}
                        className="px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        查看
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ==========================================
            底部提示
            只在有工作流时显示
            ========================================== */}
        {items.length > 0 && (
          <div className="mt-8 text-center text-gray-500 text-sm">
            <p>💡 提示：点击工作流名称查看详情，点击"编辑"进入可视化编辑器</p>
          </div>
        )}
      </div>
    </div>
  );
}