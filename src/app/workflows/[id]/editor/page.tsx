"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Node,
  Edge,
  Connection,
  NodeChange,
  EdgeChange,
  NodeTypes,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// 自定义节点类型
const CustomNode = ({ data, selected }: any) => {
  const getNodeColor = (type: string) => {
    switch (type) {
      case 'input': return '#4CAF50';
      case 'openai.chat': return '#2196F3';
      case 'langchain.chain': return '#00BCD4'; // 青色 - LangChain Chain
      case 'langchain.agent': return '#009688'; // 青绿色 - LangChain Agent
      case 'langchain.memory': return '#795548'; // 棕色 - LangChain Memory
      case 'map.set': return '#FF9800';
      case 'http.request': return '#9C27B0';
      default: return '#757575';
    }
  };

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        border: selected ? '2px solid #2196F3' : '1px solid #ddd',
        background: 'white',
        boxShadow: selected ? '0 4px 12px rgba(33, 150, 243, 0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
        minWidth: '120px',
        transition: 'all 0.2s',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: getNodeColor(data.type) }}
      />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: getNodeColor(data.type),
          }}
        />
        <div>
          <div style={{ fontWeight: 600, fontSize: '14px' }}>
            {data.label || data.type}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {data.type}
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: getNodeColor(data.type) }}
      />
    </div>
  );
};

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

// 节点工具板配置
const nodeTemplates = [
  { type: 'input', label: '输入节点', description: '工作流的起始点' },
  { type: 'openai.chat', label: 'AI对话', description: 'OpenAI GPT模型' },
  { type: 'langchain.chain', label: 'LangChain链', description: 'LangChain顺序链' },
  { type: 'langchain.agent', label: 'LangChain代理', description: 'LangChain智能代理' },
  { type: 'langchain.memory', label: 'LangChain记忆', description: '对话历史管理' },
  { type: 'map.set', label: '设置变量', description: '存储上下文数据' },
  { type: 'http.request', label: 'HTTP请求', description: '调用外部API' },
];

type WorkflowData = {
  id: string;
  name: string;
  description?: string;
  nodes: Array<{
    id: string;
    type: string;
    label?: string;
    positionX: number;
    positionY: number;
    config: any;
  }>;
  edges: Array<{
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    label?: string;
  }>;
};

export default function WorkflowEditor() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.id as string;

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载工作流数据
  useEffect(() => {
    const loadWorkflow = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/workflows/${workflowId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to load workflow: ${response.status}`);
        }

        const data: WorkflowData = await response.json();
        setWorkflow(data);

        // 转换节点数据
        const flowNodes: Node[] = data.nodes.map(node => ({
          id: node.id,
          type: 'custom',
          position: { x: node.positionX, y: node.positionY },
          data: {
            type: node.type,
            label: node.label || node.type,
            config: node.config || {},
          },
        }));

        // 转换边数据
        const flowEdges: Edge[] = data.edges.map(edge => ({
          id: edge.id,
          source: edge.sourceNodeId,
          target: edge.targetNodeId,
          label: edge.label,
          type: 'smoothstep',
        }));

        setNodes(flowNodes);
        setEdges(flowEdges);
        setError(null);
      } catch (err) {
        console.error('Failed to load workflow:', err);
        setError(err instanceof Error ? err.message : '加载工作流失败');
      } finally {
        setLoading(false);
      }
    };

    if (workflowId) {
      loadWorkflow();
    }
  }, [workflowId]);

  // 节点变化处理
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  // 边变化处理
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  // 连接处理
  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge = {
        ...connection,
        id: `edge_${Date.now()}`,
        type: 'smoothstep',
      };
      setEdges((eds: Edge[]) => addEdge(newEdge as Edge, eds));
    },
    []
  );

  // 节点点击处理
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  // 添加节点
  const addNode = (template: typeof nodeTemplates[0]) => {
    const newNode: Node = {
      id: `node_${Date.now()}`,
      type: 'custom',
      position: {
        x: Math.random() * 300 + 100,
        y: Math.random() * 300 + 100,
      },
      data: {
        type: template.type,
        label: template.label,
        config: {},
      },
    };

    setNodes((nds) => [...nds, newNode]);
  };

  // 更新节点配置
  const updateNodeConfig = (path: string, value: any) => {
    if (!selectedNode) return;

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id !== selectedNode.id) return node;

        const updatedData = { ...node.data };
        if (path === 'label') {
          updatedData.label = value;
        } else {
          updatedData.config = { ...updatedData.config, [path]: value };
        }

        return { ...node, data: updatedData };
      })
    );

    // 更新选中的节点
    setSelectedNode((prev) => {
      if (!prev) return null;
      const updatedData = { ...prev.data };
      if (path === 'label') {
        updatedData.label = value;
      } else {
        updatedData.config = { ...updatedData.config, [path]: value };
      }
      return { ...prev, data: updatedData };
    });
  };

  // 保存工作流
  const saveWorkflow = async () => {
    if (!workflow) return;

    try {
      setSaving(true);
      
      const payload = {
        name: workflow.name,
        description: workflow.description,
        nodes: nodes.map((node) => ({
          id: node.id,
          type: node.data.type,
          label: node.data.label,
          position: {
            x: Math.round(node.position.x),
            y: Math.round(node.position.y),
          },
          config: node.data.config,
        })),
        edges: edges.map((edge) => ({
          sourceNodeId: edge.source,
          targetNodeId: edge.target,
          label: edge.label || null,
        })),
      };

      const response = await fetch(`/api/workflows/${workflowId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`保存失败: ${response.status}`);
      }

      alert('保存成功！');
    } catch (err) {
      console.error('Save failed:', err);
      alert(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 删除选中节点
  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">正在加载编辑器...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-4">加载失败</div>
          <div className="text-gray-600 mb-4">{error}</div>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex">
      {/* 左侧工具栏 */}
      <div className="w-64 bg-gray-50 border-r border-gray-200 p-4">
        <div className="mb-4">
          <button
            onClick={() => router.push(`/workflows/${workflowId}`)}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            ← 返回工作流详情
          </button>
        </div>

        <h2 className="text-lg font-semibold mb-4">{workflow?.name || '工作流编辑器'}</h2>

        <div className="mb-6">
          <button
            onClick={saveWorkflow}
            disabled={saving}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存工作流'}
          </button>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3 text-gray-700">节点类型</h3>
          <div className="space-y-2">
            {nodeTemplates.map((template) => (
              <button
                key={template.type}
                onClick={() => addNode(template)}
                className="w-full p-3 text-left bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-sm">{template.label}</div>
                <div className="text-xs text-gray-500">{template.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-gray-500">
          <div>• 拖拽节点移动位置</div>
          <div>• 连接节点创建流程</div>
          <div>• 点击节点编辑配置</div>
        </div>
      </div>

      {/* 中间画布区域 */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-gray-100"
        >
          <Background color="#aaa" gap={16} />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      {/* 右侧属性面板 */}
      <div className="w-80 bg-white border-l border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">节点属性</h3>
          {selectedNode && (
            <button
              onClick={deleteSelectedNode}
              className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
            >
              删除
            </button>
          )}
        </div>

        {!selectedNode ? (
          <div className="text-gray-500 text-sm">
            <p>点击画布中的节点来编辑其属性。</p>
            <p className="mt-2">建议从添加&quot;输入节点&quot;开始构建您的工作流。</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                节点名称
              </label>
              <input
                type="text"
                value={selectedNode.data.label || ''}
                onChange={(e) => updateNodeConfig('label', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                节点类型
              </label>
              <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded">
                {selectedNode.data.type}
              </div>
            </div>

            {/* OpenAI Chat 节点配置 */}
            {selectedNode.data.type === 'openai.chat' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    模型名称
                  </label>
                  <input
                    type="text"
                    placeholder="如: gpt-3.5-turbo"
                    value={selectedNode.data.config.model || ''}
                    onChange={(e) => updateNodeConfig('model', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    系统提示词
                  </label>
                  <textarea
                    rows={3}
                    value={selectedNode.data.config.system || ''}
                    onChange={(e) => updateNodeConfig('system', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    提示模板
                  </label>
                  <textarea
                    rows={4}
                    placeholder="例如: 请总结以下内容: {{input}}"
                    value={selectedNode.data.config.promptTemplate || ''}
                    onChange={(e) => updateNodeConfig('promptTemplate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    输出键名
                  </label>
                  <input
                    type="text"
                    placeholder="如: summary"
                    value={selectedNode.data.config.outputKey || ''}
                    onChange={(e) => updateNodeConfig('outputKey', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            {/* Map Set 节点配置 */}
            {selectedNode.data.type === 'map.set' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    键名
                  </label>
                  <input
                    type="text"
                    placeholder="如: result.data"
                    value={selectedNode.data.config.key || ''}
                    onChange={(e) => updateNodeConfig('key', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    值模板
                  </label>
                  <textarea
                    rows={3}
                    placeholder="支持 {{variable}} 插值"
                    value={selectedNode.data.config.valueTemplate || ''}
                    onChange={(e) => updateNodeConfig('valueTemplate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            {/* LangChain Chain 节点配置 */}
            {selectedNode.data.type === 'langchain.chain' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    模型名称
                  </label>
                  <input
                    type="text"
                    placeholder="如: gpt-4o-mini"
                    value={selectedNode.data.config.model || ''}
                    onChange={(e) => updateNodeConfig('model', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    系统提示词模板
                  </label>
                  <textarea
                    rows={3}
                    placeholder="可选，定义AI的角色"
                    value={selectedNode.data.config.systemTemplate || ''}
                    onChange={(e) => updateNodeConfig('systemTemplate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    提示词模板
                  </label>
                  <textarea
                    rows={4}
                    placeholder="支持 {{variable}} 插值，例如: 请总结：{{text}}"
                    value={selectedNode.data.config.promptTemplate || ''}
                    onChange={(e) => updateNodeConfig('promptTemplate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    温度参数
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    placeholder="0.2"
                    value={selectedNode.data.config.temperature || ''}
                    onChange={(e) => updateNodeConfig('temperature', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    输出键名
                  </label>
                  <input
                    type="text"
                    placeholder="如: chain_output"
                    value={selectedNode.data.config.outputKey || ''}
                    onChange={(e) => updateNodeConfig('outputKey', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            {/* LangChain Agent 节点配置 */}
            {selectedNode.data.type === 'langchain.agent' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    模型名称
                  </label>
                  <input
                    type="text"
                    placeholder="如: gpt-4o-mini"
                    value={selectedNode.data.config.model || ''}
                    onChange={(e) => updateNodeConfig('model', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    提示词模板
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Agent的任务描述，支持 {{variable}} 插值"
                    value={selectedNode.data.config.promptTemplate || ''}
                    onChange={(e) => updateNodeConfig('promptTemplate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    输出键名
                  </label>
                  <input
                    type="text"
                    placeholder="如: agent_output"
                    value={selectedNode.data.config.outputKey || ''}
                    onChange={(e) => updateNodeConfig('outputKey', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            {/* LangChain Memory 节点配置 */}
            {selectedNode.data.type === 'langchain.memory' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    操作类型
                  </label>
                  <select
                    value={selectedNode.data.config.action || 'save'}
                    onChange={(e) => updateNodeConfig('action', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="save">保存对话</option>
                    <option value="load">加载历史</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    记忆键名
                  </label>
                  <input
                    type="text"
                    placeholder="如: chat_history"
                    value={selectedNode.data.config.memoryKey || ''}
                    onChange={(e) => updateNodeConfig('memoryKey', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {selectedNode.data.config.action === 'save' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        输入键名
                      </label>
                      <input
                        type="text"
                        placeholder="如: input 或 user_message"
                        value={selectedNode.data.config.inputKey || ''}
                        onChange={(e) => updateNodeConfig('inputKey', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        输出键名
                      </label>
                      <input
                        type="text"
                        placeholder="如: output 或 ai_response"
                        value={selectedNode.data.config.outputKey || ''}
                        onChange={(e) => updateNodeConfig('outputKey', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {/* HTTP Request 节点配置 */}
            {selectedNode.data.type === 'http.request' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    请求方法
                  </label>
                  <select
                    value={selectedNode.data.config.method || 'GET'}
                    onChange={(e) => updateNodeConfig('method', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL模板
                  </label>
                  <input
                    type="text"
                    placeholder="https://api.example.com/data?q={{query}}"
                    value={selectedNode.data.config.urlTemplate || ''}
                    onChange={(e) => updateNodeConfig('urlTemplate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    请求体模板
                  </label>
                  <textarea
                    rows={3}
                    placeholder="JSON格式，支持 {{variable}} 插值"
                    value={selectedNode.data.config.bodyTemplate || ''}
                    onChange={(e) => updateNodeConfig('bodyTemplate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}