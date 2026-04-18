"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Node = { 
  id: string; 
  type: string; 
  label?: string | null; 
  positionX: number; 
  positionY: number; 
  config: any 
};

type Edge = { 
  id: string; 
  sourceNodeId: string; 
  targetNodeId: string; 
  label?: string | null 
};

type Workflow = { 
  id: string; 
  name: string; 
  description?: string | null; 
  nodes: Node[]; 
  edges: Edge[];
  createdAt?: string;
  updatedAt?: string;
};

// 节点类型映射
const nodeTypeMap: Record<string, { label: string; icon: string; color: string }> = {
  'input': { label: '输入节点', icon: '📥', color: 'bg-green-100 text-green-800 border-green-200' },
  'openai.chat': { label: 'AI对话', icon: '🤖', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  'langchain.chain': { label: 'LangChain链', icon: '🔗', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  'langchain.agent': { label: 'LangChain代理', icon: '🧠', color: 'bg-teal-100 text-teal-800 border-teal-200' },
  'langchain.memory': { label: 'LangChain记忆', icon: '💾', color: 'bg-brown-100 text-brown-800 border-brown-200' },
  'map.set': { label: '设置变量', icon: '📝', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  'http.request': { label: 'HTTP请求', icon: '🌐', color: 'bg-purple-100 text-purple-800 border-purple-200' },
};

export default function WorkflowDetail() {
  const { id } = useParams<{ id: string }>();
  const [wf, setWf] = useState<Workflow | null>(null);
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    
    const fetchWorkflow = async () => {
      try {
        const response = await fetch(`/api/workflows/${id}`);
        if (response.ok) {
          const data = await response.json();
          setWf(data);
        } else {
          console.error('Failed to fetch workflow');
        }
      } catch (error) {
        console.error('Error fetching workflow:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchWorkflow();
  }, [id]);

  // 检查是否包含任何 AI 节点（包括 OpenAI 和 LangChain 节点）
  const hasAINodes = useMemo(() => {
    if (!wf) return false;
    const aiNodeTypes = ["openai.chat", "langchain.chain", "langchain.agent"];
    return wf.nodes.some(n => aiNodeTypes.includes(n.type));
  }, [wf]);

  const nodeTypeCounts = useMemo(() => {
    if (!wf) return {};
    const counts: Record<string, number> = {};
    wf.nodes.forEach(node => {
      counts[node.type] = (counts[node.type] || 0) + 1;
    });
    return counts;
  }, [wf]);

  async function run() {
    if (!text.trim() && hasAINodes) {
      alert('请输入文本内容');
      return;
    }
    
    setRunning(true);
    try {
      const res = await fetch(`/api/workflows/${id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { text: text.trim() } }),
      });
      
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        alert(`运行失败: ${res.status} ${errText}`);
        return;
      }
      
      const data = await res.json().catch(() => null);
      if (!data?.runId) {
        alert("运行失败：服务端未返回 runId");
        return;
      }
      
      window.location.href = `/runs/${data.runId}`;
    } catch (error) {
      console.error('Run failed:', error);
      alert('运行失败，请稍后重试');
    } finally {
      setRunning(false);
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('zh-CN');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载工作流详情...</p>
        </div>
      </div>
    );
  }

  if (!wf) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-4xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">工作流不存在</h2>
          <p className="text-gray-600 mb-6">请检查链接是否正确</p>
          <a 
            href="/workflows" 
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            返回工作流列表
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部导航 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <a 
                href="/workflows" 
                className="text-blue-600 hover:text-blue-800 flex items-center space-x-2 transition-colors"
              >
                <span>←</span>
                <span>返回工作流列表</span>
              </a>
              <div className="h-6 border-l border-gray-300"></div>
              <h1 className="text-xl font-semibold text-gray-900">工作流详情</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 工作流基本信息 */}
        <div className="bg-white rounded-lg shadow-sm border mb-8">
          <div className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-gray-900 mb-3">{wf.name}</h2>
                {wf.description && (
                  <p className="text-lg text-gray-600 mb-4">{wf.description}</p>
                )}
                <div className="flex items-center space-x-6 text-sm text-gray-500">
                  {wf.createdAt && (
                    <div className="flex items-center">
                      <span className="mr-2">📅</span>
                      创建于 {formatDate(wf.createdAt)}
                    </div>
                  )}
                  {wf.updatedAt && wf.updatedAt !== wf.createdAt && (
                    <div className="flex items-center">
                      <span className="mr-2">✏️</span>
                      更新于 {formatDate(wf.updatedAt)}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <a
                  href={`/workflows/${id}/editor`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <span>🎨</span>
                  <span>可视化编辑器</span>
                </a>
              </div>
            </div>

            {/* 工作流统计 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-600 mb-1">节点数量</div>
                <div className="text-2xl font-bold text-gray-900">{wf.nodes.length}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-600 mb-1">连接数量</div>
                <div className="text-2xl font-bold text-gray-900">{wf.edges.length}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-600 mb-1">工作流状态</div>
                <div className="text-lg font-semibold text-green-600">
                  {wf.nodes.length > 0 ? '已配置' : '未配置'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 节点组成 */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <span className="mr-2">🔗</span>
                节点组成
              </h3>
            </div>
            <div className="p-6">
              {Object.keys(nodeTypeCounts).length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-2xl mb-2">📝</div>
                  <p className="text-gray-600">暂无节点</p>
                  <p className="text-sm text-gray-500 mt-1">请使用可视化编辑器添加节点</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(nodeTypeCounts).map(([type, count]) => {
                    const nodeInfo = nodeTypeMap[type] || { label: type, icon: '⚪', color: 'bg-gray-100 text-gray-800 border-gray-200' };
                    return (
                      <div key={type} className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                        <div className="flex items-center space-x-3">
                          <span className="text-xl">{nodeInfo.icon}</span>
                          <div>
                            <div className="font-medium text-gray-900">{nodeInfo.label}</div>
                            <div className="text-sm text-gray-600">类型: {type}</div>
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full border font-medium text-sm ${nodeInfo.color}`}>
                          {count} 个
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 运行工作流 */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <span className="mr-2">🚀</span>
                运行工作流
              </h3>
            </div>
            <div className="p-6">
              {!hasAINodes ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-2xl mb-2">🤖</div>
                  <p className="text-gray-600 mb-2">此工作流不包含AI节点</p>
                  <p className="text-sm text-gray-500">添加AI对话节点或LangChain节点后即可运行</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      输入文本 *
                    </label>
                    <textarea
                      placeholder="请输入要处理的文本内容..."
                      value={text}
                      onChange={e => setText(e.target.value)}
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      disabled={running}
                    />
                    <div className="mt-1 text-xs text-gray-500">
                      字数: {text.length}
                    </div>
                  </div>
                  
                  <button
                    onClick={run}
                    disabled={running || !text.trim()}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {running ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        正在运行...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center">
                        <span className="mr-2">▶️</span>
                        运行工作流
                      </span>
                    )}
                  </button>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-sm text-blue-800">
                      <div className="font-medium mb-1">💡 运行说明</div>
                      <ul className="text-xs space-y-1 text-blue-700">
                        <li>• 输入的文本将作为工作流的初始数据</li>
                        <li>• 运行完成后将跳转到结果页面</li>
                        <li>• 可以查看每个节点的执行详情</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 工作流结构预览 */}
        {wf.nodes.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <span className="mr-2">🗺️</span>
                工作流结构
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {wf.nodes.map((node, index) => {
                  const nodeInfo = nodeTypeMap[node.type] || { label: node.type, icon: '⚪', color: 'bg-gray-100 text-gray-800 border-gray-200' };
                  return (
                    <div key={node.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-lg">{nodeInfo.icon}</span>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {node.label || nodeInfo.label}
                          </div>
                          <div className="text-xs text-gray-500">节点 #{index + 1}</div>
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-medium ${nodeInfo.color}`}>
                        {nodeInfo.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}