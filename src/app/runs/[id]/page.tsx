"use client";
import { useEffect, useState, use } from "react";

type Step = { 
  id: string; 
  status: string; 
  startedAt?: string; 
  finishedAt?: string; 
  input?: any; 
  output?: any; 
  error?: string | null; 
  nodeId: string 
};

type Run = { 
  id: string; 
  status: string; 
  startedAt?: string; 
  finishedAt?: string; 
  workflow: { name: string }; 
  steps: Step[] 
};

// 状态样式映射
const getStatusColor = (status: string) => {
  switch (status) {
    case 'SUCCEEDED': return 'text-green-600 bg-green-50 border-green-200';
    case 'FAILED': return 'text-red-600 bg-red-50 border-red-200';
    case 'RUNNING': return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'PENDING': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

// 状态图标
const getStatusIcon = (status: string) => {
  switch (status) {
    case 'SUCCEEDED': return '✅';
    case 'FAILED': return '❌';
    case 'RUNNING': return '🔄';
    case 'PENDING': return '⏳';
    default: return '⚪';
  }
};

// 格式化时间
const formatTime = (timestamp?: string) => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString('zh-CN');
};

// 计算执行时长
const getDuration = (start?: string, end?: string) => {
  if (!start || !end) return '';
  const duration = new Date(end).getTime() - new Date(start).getTime();
  return `${(duration / 1000).toFixed(1)}s`;
};

// JSON 格式化显示组件
const JsonDisplay = ({ data, title }: { data: any; title: string }) => {
  if (!data) return null;
  
  // 如果是字符串且看起来像JSON，尝试解析
  let displayData = data;
  if (typeof data === 'string') {
    try {
      displayData = JSON.parse(data);
    } catch {
      // 保持原字符串
    }
  }

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
        <span className="mr-2">{title === 'Input' ? '📥' : '📤'}</span>
        {title}
      </h4>
      <div className="bg-gray-50 rounded-lg p-4 border">
        {typeof displayData === 'string' ? (
          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {displayData}
          </div>
        ) : (
          <pre className="text-sm text-gray-800 overflow-auto max-h-96">
            {JSON.stringify(displayData, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
};

export default function RunDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRun = async () => {
      try {
        const response = await fetch(`/api/runs/${id}`);
        if (!response.ok) {
          console.error('API Error:', response.status, response.statusText);
          return;
        }
        const r = await response.json();
        setRun(r);
        setLoading(false);
        
        // 如果运行完成，停止轮询
        if (r?.status === "SUCCEEDED" || r?.status === "FAILED") {
          return;
        }
      } catch (error) {
        console.error('Fetch error:', error);
      }
    };

    fetchRun();
    
    // 如果还在运行中，设置轮询
    const interval = setInterval(fetchRun, 2000);
    
    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载运行详情...</p>
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">运行记录不存在</p>
          <a href="/workflows" className="text-blue-600 hover:text-blue-800 underline">
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
                <span>返回工作流</span>
              </a>
              <div className="h-6 border-l border-gray-300"></div>
              <h1 className="text-xl font-semibold text-gray-900">运行详情</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 运行概览卡片 */}
        <div className="bg-white rounded-lg shadow-sm border mb-8">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {run.workflow?.name || '未知工作流'}
                </h2>
                <p className="text-sm text-gray-600">运行ID: {run.id}</p>
              </div>
              <div className={`px-4 py-2 rounded-full border font-medium text-sm ${getStatusColor(run.status)}`}>
                <span className="mr-2">{getStatusIcon(run.status)}</span>
                {run.status === 'SUCCEEDED' ? '执行成功' : 
                 run.status === 'FAILED' ? '执行失败' : 
                 run.status === 'RUNNING' ? '正在执行' : '等待中'}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-600 mb-1">开始时间</div>
                <div className="text-lg font-semibold text-gray-900">
                  {formatTime(run.startedAt) || '未开始'}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-600 mb-1">结束时间</div>
                <div className="text-lg font-semibold text-gray-900">
                  {formatTime(run.finishedAt) || '未结束'}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-600 mb-1">执行时长</div>
                <div className="text-lg font-semibold text-gray-900">
                  {getDuration(run.startedAt, run.finishedAt) || '计算中...'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 步骤执行详情 */}
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">执行步骤</h3>
          
          {run.steps?.map((step, index) => (
            <div key={step.id} className="bg-white rounded-lg shadow-sm border overflow-hidden">
              {/* 步骤头部 */}
              <div className="bg-gray-50 px-6 py-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">步骤 {index + 1}</h4>
                        <p className="text-sm text-gray-600">节点ID: {step.nodeId}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className={`px-3 py-1 rounded-full border text-sm font-medium ${getStatusColor(step.status)}`}>
                      <span className="mr-1">{getStatusIcon(step.status)}</span>
                      {step.status === 'SUCCEEDED' ? '成功' : 
                       step.status === 'FAILED' ? '失败' : 
                       step.status === 'RUNNING' ? '运行中' : '等待'}
                    </div>
                    {step.startedAt && step.finishedAt && (
                      <div className="text-sm text-gray-600">
                        {getDuration(step.startedAt, step.finishedAt)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 步骤内容 */}
              <div className="p-6">
                {step.error ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <span className="text-red-500 mr-2">❌</span>
                      <h5 className="font-medium text-red-800">执行错误</h5>
                    </div>
                    <pre className="text-sm text-red-700 whitespace-pre-wrap">{step.error}</pre>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {step.input && <JsonDisplay data={step.input} title="输入数据" />}
                    {step.output && <JsonDisplay data={step.output} title="输出结果" />}
                  </div>
                )}

                {step.startedAt && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>开始: {formatTime(step.startedAt)}</span>
                      {step.finishedAt && <span>结束: {formatTime(step.finishedAt)}</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 如果没有步骤 */}
        {(!run.steps || run.steps.length === 0) && (
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
            <div className="text-gray-400 mb-2">📝</div>
            <p className="text-gray-600">暂无执行步骤</p>
          </div>
        )}
      </div>
    </div>
  );
}