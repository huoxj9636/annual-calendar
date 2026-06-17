'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, ChevronLeft, ChevronRight, TreeDeciduous, Apple, FileText, Video, Headphones, BookOpen, Edit, Trash2 } from 'lucide-react';

// 知识节点类型
type NodeType = 'root' | 'trunk' | 'branch' | 'leaf' | 'fruit';

// 知识节点数据
interface KnowledgeNode {
  id: string;
  type: NodeType;
  title: string;
  content: string;
  source?: string;
  createdAt: number;
}

// 大树数据
interface KnowledgeTree {
  id: string;
  name: string;
  nodes: KnowledgeNode[];
  createdAt: number;
}

// localStorage key
const TREES_STORAGE_KEY = 'knowledge-trees';

// 获取默认大树
const getDefaultTrees = (): KnowledgeTree[] => {
  return [
    { id: 'default-1', name: '工作事业', nodes: [], createdAt: Date.now() },
    { id: 'default-2', name: '学习成长', nodes: [], createdAt: Date.now() },
  ];
};

// 主组件
export default function KnowledgePanel({ onClose }: { onClose: () => void }) {
  const [trees, setTrees] = useState<KnowledgeTree[]>([]);
  const [selectedTree, setSelectedTree] = useState<KnowledgeTree | null>(null);
  const [showAddTree, setShowAddTree] = useState(false);
  const [showAddNode, setShowAddNode] = useState(false);
  const [newTreeName, setNewTreeName] = useState('');
  const [newNode, setNewNode] = useState<{ type: NodeType; title: string; content: string; source: string }>({
    type: 'leaf',
    title: '',
    content: '',
    source: '',
  });
  const [activeTab, setActiveTab] = useState<'knowledge' | 'sites'>('knowledge');
  
  // 加载大树数据
  useEffect(() => {
    const stored = localStorage.getItem(TREES_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // 确保每个tree都有nodes字段
        const validTrees = parsed.map((t: KnowledgeTree) => ({
          ...t,
          nodes: t.nodes || []
        }));
        setTrees(validTrees);
      } catch {
        setTrees(getDefaultTrees());
      }
    } else {
      setTrees(getDefaultTrees());
    }
  }, []);
  
  // 保存大树数据
  const saveTrees = (newTrees: KnowledgeTree[]) => {
    setTrees(newTrees);
    localStorage.setItem(TREES_STORAGE_KEY, JSON.stringify(newTrees));
  };
  
  // 创建新大树
  const handleAddTree = () => {
    if (!newTreeName.trim()) return;
    const newTree: KnowledgeTree = {
      id: `tree-${Date.now()}`,
      name: newTreeName.trim(),
      nodes: [],
      createdAt: Date.now(),
    };
    saveTrees([...trees, newTree]);
    setNewTreeName('');
    setShowAddTree(false);
    setSelectedTree(newTree);
  };
  
  // 删除大树
  const handleDeleteTree = (treeId: string) => {
    const newTrees = trees.filter(t => t.id !== treeId);
    saveTrees(newTrees);
    if (selectedTree?.id === treeId) {
      setSelectedTree(null);
    }
  };
  
  // 添加知识节点
  const handleAddNode = () => {
    if (!selectedTree || !newNode.title.trim()) return;
    const node: KnowledgeNode = {
      id: `node-${Date.now()}`,
      type: newNode.type,
      title: newNode.title.trim(),
      content: newNode.content.trim(),
      source: newNode.source.trim(),
      createdAt: Date.now(),
    };
    const updatedTree = { ...selectedTree, nodes: [...selectedTree.nodes, node] };
    saveTrees(trees.map(t => t.id === selectedTree.id ? updatedTree : t));
    setSelectedTree(updatedTree);
    setNewNode({ type: 'leaf', title: '', content: '', source: '' });
    setShowAddNode(false);
  };
  
  // 删除知识节点
  const handleDeleteNode = (nodeId: string) => {
    if (!selectedTree) return;
    const updatedTree = { ...selectedTree, nodes: selectedTree.nodes.filter(n => n.id !== nodeId) };
    saveTrees(trees.map(t => t.id === selectedTree.id ? updatedTree : t));
    setSelectedTree(updatedTree);
  };
  
  // 统计各类型节点数量
  const getNodeStats = (tree: KnowledgeTree) => {
    const stats = { root: 0, trunk: 0, branch: 0, leaf: 0, fruit: 0 };
    (tree.nodes || []).forEach(n => stats[n.type]++);
    return stats;
  };
  
  const getTypeLabel = (type: NodeType) => {
    const labels = { root: '根源', trunk: '目标', branch: '路径', leaf: '执行', fruit: '成果' };
    return labels[type];
  };
  
  const getTypeIcon = (type: NodeType) => {
    switch (type) {
      case 'root': return <TreeDeciduous className="w-4 h-4" />;
      case 'trunk': return <TreeDeciduous className="w-4 h-4" />;
      case 'branch': return <TreeDeciduous className="w-4 h-4" />;
      case 'leaf': return <FileText className="w-4 h-4" />;
      case 'fruit': return <Apple className="w-4 h-4" />;
    }
  };

  // 大树列表页面
  const TreeListPage = () => (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">知识大树</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddTree(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            创建大树
          </button>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* 大树卡片列表 */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {trees.map(tree => {
            const stats = getNodeStats(tree);
            const total = tree.nodes.length;
            return (
              <div
                key={tree.id}
                onClick={() => setSelectedTree(tree)}
                className="group relative bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-primary hover:shadow-sm transition-all"
              >
                {/* 删除按钮 */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteTree(tree.id); }}
                  className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-destructive rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                
                {/* 大树图标 */}
                <div className="flex justify-center mb-3">
                  <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                    <TreeDeciduous className="w-8 h-8 text-primary" />
                  </div>
                </div>
                
                {/* 名称 */}
                <h3 className="text-center font-medium text-foreground mb-2">{tree.name}</h3>
                
                {/* 统计 */}
                <div className="text-center text-xs text-muted-foreground">
                  {total > 0 ? `${total} 个知识节点` : '暂无知识'}
                </div>
                
                {/* 进度条 */}
                {total > 0 && (
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(100, total * 10)}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
          
          {/* 空卡片提示 */}
          {trees.length === 0 && (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              <TreeDeciduous className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>还没有知识大树</p>
              <p className="text-sm">点击上方"创建大树"开始</p>
            </div>
          )}
        </div>
      </div>
      
      {/* 创建大树弹窗 */}
      {showAddTree && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-lg">
            <h3 className="text-lg font-semibold text-foreground mb-4">创建新的知识大树</h3>
            <input
              type="text"
              value={newTreeName}
              onChange={(e) => setNewTreeName(e.target.value)}
              placeholder="输入大树名称（如：工作事业、学习成长）"
              className="w-full px-4 py-2.5 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowAddTree(false)}
                className="flex-1 px-4 py-2 text-sm border border-border rounded-lg text-foreground hover:bg-muted transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddTree}
                className="flex-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // 大树详情页面
  const TreeDetailPage = () => {
    if (!selectedTree) return null;
    const stats = getNodeStats(selectedTree);
    const fruits = selectedTree.nodes.filter(n => n.type === 'fruit');
    
    return (
      <div className="flex flex-col h-full">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedTree(null)}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-foreground">{selectedTree.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddNode(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加知识
            </button>
            <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* 大树可视化区域 */}
        <div className="flex-1 overflow-auto p-4">
          <div className="relative bg-muted/50 rounded-xl overflow-hidden" style={{ minHeight: '400px' }}>
            {/* 大树图片 */}
            <img
              src="/tree-full.jpeg"
              alt="知识大树"
              className="w-full h-full object-cover opacity-90"
              style={{ minHeight: '400px' }}
            />
            
            {/* 果实标记层 - 根据实际果实数量显示 */}
            {fruits.length > 0 && (
              <div className="absolute inset-0 pointer-events-none">
                {/* 在树冠区域显示果实标记 */}
                {fruits.map((fruit, idx) => {
                  // 简单的分布逻辑：均匀分布在树冠区域
                  const positions = [
                    { top: '25%', left: '30%' },
                    { top: '25%', left: '50%' },
                    { top: '25%', left: '70%' },
                    { top: '35%', left: '20%' },
                    { top: '35%', left: '80%' },
                    { top: '45%', left: '35%' },
                    { top: '45%', left: '65%' },
                    { top: '55%', left: '25%' },
                    { top: '55%', left: '75%' },
                    { top: '65%', left: '40%' },
                    { top: '65%', left: '60%' },
                  ];
                  const pos = positions[idx % positions.length];
                  
                  return (
                    <div
                      key={fruit.id}
                      className="absolute pointer-events-auto cursor-pointer group"
                      style={pos}
                      onClick={() => {/* 查看果实详情 */}}
                    >
                      <div className="w-10 h-10 bg-destructive rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition-transform">
                        <Apple className="w-5 h-5 text-white" />
                      </div>
                      {/* hover显示标题 */}
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card border border-border rounded px-2 py-1 text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap max-w-[120px] truncate">
                        {fruit.title}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* 空状态提示 */}
            {selectedTree.nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
                <div className="text-center text-muted-foreground">
                  <Apple className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">点击"添加知识"开始种植</p>
                </div>
              </div>
            )}
          </div>
          
          {/* 知识分类列表 */}
          <div className="mt-4 grid grid-cols-5 gap-2">
            {(['root', 'trunk', 'branch', 'leaf', 'fruit'] as NodeType[]).map(type => {
              const count = stats[type];
              return (
                <div key={type} className="bg-card border border-border rounded-lg p-3 text-center">
                  <div className="flex justify-center mb-1">
                    {getTypeIcon(type)}
                  </div>
                  <div className="text-sm font-medium text-foreground">{getTypeLabel(type)}</div>
                  <div className="text-xs text-muted-foreground">{count} 个</div>
                </div>
              );
            })}
          </div>
          
          {/* 知识节点列表 */}
          <div className="mt-4">
            <h3 className="text-sm font-medium text-foreground mb-2">所有知识节点</h3>
            <div className="space-y-2">
              {selectedTree.nodes.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  暂无知识节点
                </div>
              ) : (
                selectedTree.nodes.map(node => (
                  <div
                    key={node.id}
                    className="bg-card border border-border rounded-lg p-3 flex items-start gap-3 group"
                  >
                    <div className="flex-shrink-0">
                      {getTypeIcon(node.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{node.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">{getTypeLabel(node.type)}</div>
                    </div>
                    <button
                      onClick={() => handleDeleteNode(node.id)}
                      className="flex-shrink-0 p-1 text-muted-foreground hover:text-destructive rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        {/* 添加知识弹窗 */}
        {showAddNode && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-lg">
              <h3 className="text-lg font-semibold text-foreground mb-4">添加知识节点</h3>
              
              {/* 类型选择 */}
              <div className="mb-4">
                <label className="text-sm text-muted-foreground mb-2 block">选择类型</label>
                <div className="grid grid-cols-5 gap-2">
                  {(['root', 'trunk', 'branch', 'leaf', 'fruit'] as NodeType[]).map(type => (
                    <button
                      key={type}
                      onClick={() => setNewNode({ ...newNode, type })}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        newNode.type === type 
                          ? 'border-primary bg-primary/10 text-primary' 
                          : 'border-border text-foreground hover:border-primary/50'
                      }`}
                    >
                      <div className="flex justify-center mb-1">{getTypeIcon(type)}</div>
                      <div className="text-xs">{getTypeLabel(type)}</div>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* 标题输入 */}
              <input
                type="text"
                value={newNode.title}
                onChange={(e) => setNewNode({ ...newNode, title: e.target.value })}
                placeholder="知识标题"
                className="w-full px-4 py-2.5 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 mb-3"
              />
              
              {/* 内容输入 */}
              <textarea
                value={newNode.content}
                onChange={(e) => setNewNode({ ...newNode, content: e.target.value })}
                placeholder="知识内容（可选）"
                rows={3}
                className="w-full px-4 py-2.5 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none mb-3"
              />
              
              {/* 来源输入 */}
              <input
                type="text"
                value={newNode.source}
                onChange={(e) => setNewNode({ ...newNode, source: e.target.value })}
                placeholder="来源链接（可选）"
                className="w-full px-4 py-2.5 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              
              {/* 按钮 */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowAddNode(false)}
                  className="flex-1 px-4 py-2 text-sm border border-border rounded-lg text-foreground hover:bg-muted transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleAddNode}
                  disabled={!newNode.title.trim()}
                  className="flex-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 网站聚合页面
  const SitesPage = () => (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">网站聚合</h2>
        <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      
      {/* 网站列表 */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* 常用网站 */}
          {[
            { name: 'Google', url: 'https://google.com', icon: '🔍' },
            { name: 'GitHub', url: 'https://github.com', icon: '🐙' },
            { name: '知乎', url: 'https://zhihu.com', icon: '📖' },
            { name: 'Bilibili', url: 'https://bilibili.com', icon: '📺' },
          ].map(site => (
            <a
              key={site.name}
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-card border border-border rounded-lg p-3 text-center hover:border-primary hover:shadow-sm transition-all"
            >
              <div className="text-2xl mb-1">{site.icon}</div>
              <div className="text-xs text-foreground truncate">{site.name}</div>
            </a>
          ))}
          
          {/* 添加更多 */}
          <div className="bg-muted border border-border rounded-lg p-3 text-center cursor-pointer hover:border-primary/50 transition-all">
            <Plus className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-xs text-muted-foreground">添加</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-background z-[100] animate-in slide-in-from-right duration-300">
      {/* Tab切换 */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('knowledge')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'knowledge'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          知识大树
        </button>
        <button
          onClick={() => setActiveTab('sites')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'sites'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          网站聚合
        </button>
      </div>
      
      {/* 内容区域 */}
      <div className="h-[calc(100vh-48px)] overflow-hidden">
        {activeTab === 'knowledge' && (
          selectedTree ? <TreeDetailPage /> : <TreeListPage />
        )}
        {activeTab === 'sites' && <SitesPage />}
      </div>
    </div>
  );
}