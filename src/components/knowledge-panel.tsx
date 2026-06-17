'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';

// 大树数据结构
interface KnowledgeTree {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  updatedAt: number;
  stats: {
    roots: number;
    trunk: number;
    branches: number;
    leaves: number;
    fruits: number;
  };
}

// 知识节点
interface KnowledgeNode {
  id: string;
  treeId: string;
  type: 'root' | 'trunk' | 'branch' | 'leaf' | 'fruit';
  parentId?: string;
  title: string;
  content: string;
  source?: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

// 网站书签
interface WebBookmark {
  id: string;
  name: string;
  url: string;
  icon?: string;
  category?: string;
}

// 引导问题配置
const GUIDE_QUESTIONS: Record<string, string> = {
  root: '这个认知对你的人生有什么根基意义？',
  trunk: '这个目标是你人生的什么方向？',
  branch: '这个方法是为了实现什么目标？',
  leaf: '在你的具体场景中怎么用？',
  fruit: '这个成果是怎么实现的？',
};

// 节点类型标签
const TYPE_LABELS: Record<string, { name: string; icon: string; color: string }> = {
  root: { name: '树根', icon: '🌱', color: '#5D4037' },
  trunk: { name: '树干', icon: '🪵', color: '#795548' },
  branch: { name: '树枝', icon: '🌿', color: '#4CAF50' },
  leaf: { name: '树叶', icon: '🍃', color: '#8BC34A' },
  fruit: { name: '果实', icon: '🍎', color: '#F44336' },
};

// 预设颜色
const TREE_COLORS = [
  '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336',
  '#00BCD4', '#795548', '#607D8B', '#E91E63', '#3F51B5',
];

const TREES_KEY = 'knowledge-trees';
const NODES_KEY_PREFIX = 'knowledge-tree-';
const BOOKMARKS_KEY = 'knowledge-bookmarks';

export default function KnowledgePanel({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [trees, setTrees] = useState<KnowledgeTree[]>([]);
  const [selectedTree, setSelectedTree] = useState<KnowledgeTree | null>(null);
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [bookmarks, setBookmarks] = useState<WebBookmark[]>([]);
  const [activeTab, setActiveTab] = useState<'trees' | 'bookmarks'>('trees');
  const [showAddTree, setShowAddTree] = useState(false);
  const [showAddNode, setShowAddNode] = useState(false);
  const [newTreeName, setNewTreeName] = useState('');
  const [newTreeColor, setNewTreeColor] = useState(TREE_COLORS[0]);
  const [newNodeType, setNewNodeType] = useState<KnowledgeNode['type']>('leaf');
  const [newNodeTitle, setNewNodeTitle] = useState('');
  const [newNodeContent, setNewNodeContent] = useState('');
  const [newNodeSource, setNewNodeSource] = useState('');
  const [showAddBookmark, setShowAddBookmark] = useState(false);
  const [newBookmarkName, setNewBookmarkName] = useState('');
  const [newBookmarkUrl, setNewBookmarkUrl] = useState('');
  const [expandedNode, setExpandedNode] = useState<KnowledgeNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 初始化
  useEffect(() => {
    setMounted(true);
    try {
      const savedTrees = localStorage.getItem(TREES_KEY);
      if (savedTrees) setTrees(JSON.parse(savedTrees));
      const savedBookmarks = localStorage.getItem(BOOKMARKS_KEY);
      if (savedBookmarks) setBookmarks(JSON.parse(savedBookmarks));
    } catch { /* ignore */ }
  }, []);

  // 保存trees
  useEffect(() => {
    if (mounted) localStorage.setItem(TREES_KEY, JSON.stringify(trees));
  }, [trees, mounted]);

  // 保存bookmarks
  useEffect(() => {
    if (mounted) localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  }, [bookmarks, mounted]);

  // 加载选中树的节点
  useEffect(() => {
    if (!selectedTree || !mounted) {
      setNodes([]);
      return;
    }
    try {
      const savedNodes = localStorage.getItem(NODES_KEY_PREFIX + selectedTree.id);
      if (savedNodes) setNodes(JSON.parse(savedNodes));
      else setNodes([]);
    } catch {
      setNodes([]);
    }
  }, [selectedTree, mounted]);

  // 保存节点并更新统计
  const saveNodes = useCallback(() => {
    if (!selectedTree || !mounted) return;
    localStorage.setItem(NODES_KEY_PREFIX + selectedTree.id, JSON.stringify(nodes));
    const stats = {
      roots: nodes.filter(n => n.type === 'root').length,
      trunk: nodes.filter(n => n.type === 'trunk').length,
      branches: nodes.filter(n => n.type === 'branch').length,
      leaves: nodes.filter(n => n.type === 'leaf').length,
      fruits: nodes.filter(n => n.type === 'fruit').length,
    };
    setTrees(prev => prev.map(t => t.id === selectedTree.id ? { ...t, stats, updatedAt: Date.now() } : t));
  }, [selectedTree, nodes, mounted]);

  useEffect(() => { if (mounted && selectedTree) saveNodes(); }, [nodes, mounted, selectedTree, saveNodes]);

  // 搜索过滤
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const q = searchQuery.toLowerCase();
    return nodes.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags?.some(t => t.toLowerCase().includes(q))
    );
  }, [nodes, searchQuery]);

  // 创建新树
  const handleCreateTree = () => {
    if (!newTreeName.trim()) return;
    const tree: KnowledgeTree = {
      id: `tree-${Date.now()}`,
      name: newTreeName.trim(),
      color: newTreeColor,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stats: { roots: 0, trunk: 0, branches: 0, leaves: 0, fruits: 0 },
    };
    setTrees(prev => [...prev, tree]);
    setNewTreeName('');
    setShowAddTree(false);
  };

  // 删除树
  const handleDeleteTree = (treeId: string) => {
    setTrees(prev => prev.filter(t => t.id !== treeId));
    localStorage.removeItem(NODES_KEY_PREFIX + treeId);
    if (selectedTree?.id === treeId) setSelectedTree(null);
  };

  // 创建新节点
  const handleCreateNode = () => {
    if (!selectedTree || !newNodeTitle.trim()) return;
    const node: KnowledgeNode = {
      id: `node-${Date.now()}`,
      treeId: selectedTree.id,
      type: newNodeType,
      title: newNodeTitle.trim(),
      content: newNodeContent.trim(),
      source: newNodeSource.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setNodes(prev => [...prev, node]);
    setNewNodeTitle('');
    setNewNodeContent('');
    setNewNodeSource('');
    setShowAddNode(false);
  };

  // 删除节点
  const handleDeleteNode = (nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    if (expandedNode?.id === nodeId) setExpandedNode(null);
  };

  // 创建书签
  const handleCreateBookmark = () => {
    if (!newBookmarkName.trim() || !newBookmarkUrl.trim()) return;
    const bookmark: WebBookmark = {
      id: `bm-${Date.now()}`,
      name: newBookmarkName.trim(),
      url: newBookmarkUrl.trim(),
    };
    setBookmarks(prev => [...prev, bookmark]);
    setNewBookmarkName('');
    setNewBookmarkUrl('');
    setShowAddBookmark(false);
  };

  // 删除书签
  const handleDeleteBookmark = (id: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== id));
  };

  // 获取树的生长状态
  const getTreeStatus = (tree: KnowledgeTree) => {
    const total = tree.stats.roots + tree.stats.trunk + tree.stats.branches + tree.stats.leaves + tree.stats.fruits;
    if (total === 0) return '待生长';
    if (tree.stats.fruits > 0) return '开花结果';
    if (tree.stats.leaves > 5) return '枝繁叶茂';
    if (tree.stats.leaves > 0) return '萌芽生长';
    if (tree.stats.branches > 0) return '伸展枝干';
    if (tree.stats.trunk > 0) return '扎根成长';
    return '播种阶段';
  };

  if (!visible || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999]"
      style={{
        background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
        animation: 'slideInFromRight 0.3s ease',
      }}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          {selectedTree && (
            <button
              onClick={() => setSelectedTree(null)}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-colors"
            >
              ←
            </button>
          )}
          <h1 className="text-xl font-bold text-white">
            {selectedTree ? (
              <span style={{ color: selectedTree.color }}>{selectedTree.name}</span>
            ) : (
              '知识库'
            )}
          </h1>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden flex">
        {selectedTree ? (
          // 大树详情页
          <div className="flex-1 flex flex-col">
            {/* 搜索框 */}
            <div className="px-6 py-4">
              <input
                type="text"
                placeholder="搜索知识..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 rounded-xl text-sm outline-none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                }}
              />
            </div>

            {/* 大树可视化 - AI生成图片背景 + 动态果实 */}
            <div className="flex-1 overflow-y-auto px-6">
              {/* 大树容器 */}
              <div className="relative flex flex-col items-center py-4 min-h-[400px]">
                {/* 大树背景图 */}
                <div className="relative w-full max-w-[500px] h-[400px] rounded-xl overflow-hidden shadow-lg">
                  <img
                    src="/tree-background.jpeg"
                    alt="知识大树"
                    className="w-full h-full object-cover"
                  />
                  
                  {/* 动态果实层 - 挂在树上的果实 */}
                  <div className="absolute inset-0">
                    {/* 果实位置预设 - 树枝末端的多个位置 */}
                    {[
                      { left: '15%', top: '25%' },   // 左下枝
                      { left: '8%', top: '35%' },    // 左下枝2
                      { left: '25%', top: '20%' },   // 左中枝
                      { left: '18%', top: '15%' },   // 左上枝
                      { left: '50%', top: '12%' },   // 顶枝
                      { left: '75%', top: '20%' },   // 右中枝
                      { left: '85%', top: '25%' },   // 右下枝
                      { left: '92%', top: '35%' },   // 右下枝2
                      { left: '68%', top: '15%' },   // 右上枝
                    ].map((pos, index) => {
                      const fruit = nodes.filter(n => n.type === 'fruit')[index];
                      return (
                        <div
                          key={`fruit-pos-${index}`}
                          className="absolute cursor-pointer hover:scale-120 transition-transform duration-200"
                          style={{
                            left: pos.left,
                            top: pos.top,
                            transform: 'translate(-50%, -50%)',
                          }}
                        >
                          {fruit ? (
                            // 有果实 - 显示果实图片和标题
                            <div
                              onClick={() => setExpandedNode(fruit)}
                              className="relative group"
                              title={fruit.title}
                            >
                              <img
                                src="/fruit-icon.jpeg"
                                alt="果实"
                                className="w-[36px] h-[36px] rounded-full object-cover shadow-lg border-2 border-white/30"
                              />
                              {/* 果实标题提示 */}
                              <div className="absolute -bottom-[20px] left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/60 rounded text-white text-xs truncate max-w-[60px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                {fruit.title.slice(0, 4)}
                              </div>
                            </div>
                          ) : (
                            // 空位 - 虚线圆圈
                            <div
                              onClick={() => setShowAddNode(true)}
                              className="w-[30px] h-[30px] rounded-full border-2 border-dashed border-white/40 flex items-center justify-center hover:border-white/60 hover:bg-white/10 transition-colors cursor-pointer"
                              title="点击添加果实"
                            >
                              <span className="text-white/40 text-xs">+</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {/* 其他知识类型标记 */}
                    {/* 树根标记 */}
                    {nodes.filter(n => n.type === 'root').map((root, i) => (
                      <div
                        key={root.id}
                        onClick={() => setExpandedNode(root)}
                        className="absolute cursor-pointer hover:scale-110 transition-transform"
                        style={{
                          left: `${20 + i * 15}%`,
                          bottom: '8%',
                          transform: 'translateX(-50%)',
                        }}
                        title={root.title}
                      >
                        <div className="w-[28px] h-[28px] rounded-full bg-gradient-to-br from-[#6b5344] to-[#3d2817] flex items-center justify-center shadow-md border border-white/20">
                          <span className="text-white text-xs">🪨</span>
                        </div>
                      </div>
                    ))}
                    
                    {/* 树干标记 - 核心目标 */}
                    {nodes.filter(n => n.type === 'trunk').slice(0, 1).map((trunk) => (
                      <div
                        key={trunk.id}
                        onClick={() => setExpandedNode(trunk)}
                        className="absolute cursor-pointer hover:scale-105 transition-transform"
                        style={{
                          left: '50%',
                          top: '60%',
                          transform: 'translate(-50%, -50%)',
                        }}
                        title={trunk.title}
                      >
                        <div className="px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur shadow-lg border border-white/30">
                          <span className="text-[#4a3728] text-sm font-medium truncate max-w-[80px] block">
                            {trunk.title.slice(0, 6)}
                          </span>
                        </div>
                      </div>
                    ))}
                    
                    {/* 树枝标记 */}
                    {nodes.filter(n => n.type === 'branch').slice(0, 4).map((branch, i) => (
                      <div
                        key={branch.id}
                        onClick={() => setExpandedNode(branch)}
                        className="absolute cursor-pointer hover:scale-110 transition-transform"
                        style={{
                          left: `${30 + i * 20}%`,
                          top: '45%',
                          transform: 'translateX(-50%)',
                        }}
                        title={branch.title}
                      >
                        <div className="w-[24px] h-[24px] rounded-full bg-gradient-to-br from-[#8b7355] to-[#5a4235] flex items-center justify-center shadow-md border border-white/20">
                          <span className="text-white/80 text-xs">🌿</span>
                        </div>
                      </div>
                    ))}
                    
                    {/* 树叶标记 */}
                    {nodes.filter(n => n.type === 'leaf').slice(0, 6).map((leaf, i) => {
                      const positions = [
                        { left: '12%', top: '30%' },
                        { left: '22%', top: '28%' },
                        { left: '35%', top: '25%' },
                        { left: '65%', top: '25%' },
                        { left: '78%', top: '28%' },
                        { left: '88%', top: '30%' },
                      ];
                      return (
                        <div
                          key={leaf.id}
                          onClick={() => setExpandedNode(leaf)}
                          className="absolute cursor-pointer hover:scale-110 transition-transform animate-sway"
                          style={{
                            left: positions[i]?.left || '50%',
                            top: positions[i]?.top || '30%',
                            transform: 'translate(-50%, -50%)',
                            animationDelay: `${i * 0.3}s`,
                          }}
                          title={leaf.title}
                        >
                          <div className="w-[22px] h-[28px] rounded-[50% 50% 50% 50% / 60% 60% 40% 40%] bg-gradient-to-br from-[#4ade80] to-[#16a34a] flex items-center justify-center shadow-md">
                            <span className="text-white/80 text-[8px] font-medium">
                              {leaf.title.slice(0, 2)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* 树名称标签 */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 backdrop-blur rounded-lg">
                    <span className="text-white font-medium">{selectedTree.name}</span>
                  </div>
                </div>
              </div>



              {/* 统计 */}
              <div className="grid grid-cols-5 gap-2 mb-6 pb-6 border-b border-white/10">
                {(['root', 'trunk', 'branch', 'leaf', 'fruit'] as const).map(type => (
                  <div key={type} className="text-center">
                    <div className="text-2xl mb-1">{TYPE_LABELS[type].icon}</div>
                    <div className="text-white/60 text-xs">{TYPE_LABELS[type].name}</div>
                    <div className="text-white font-bold text-lg">
                      {nodes.filter(n => n.type === type).length}
                    </div>
                  </div>
                ))}
              </div>

              {/* 知识列表 */}
              <div className="space-y-3 pb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-semibold">知识列表</h3>
                  <button
                    onClick={() => setShowAddNode(true)}
                    className="px-3 py-1.5 rounded-lg text-sm text-white bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    + 添加知识
                  </button>
                </div>
                {filteredNodes.length === 0 ? (
                  <div className="text-white/40 text-center py-8">
                    {searchQuery ? '未找到匹配的知识' : '点击上方添加知识，开始构建你的大树'}
                  </div>
                ) : (
                  filteredNodes.map(node => (
                    <div
                      key={node.id}
                      onClick={() => setExpandedNode(node)}
                      className="p-4 rounded-xl cursor-pointer hover:bg-white/10 transition-colors"
                      style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span>{TYPE_LABELS[node.type].icon}</span>
                        <span className="text-white/60 text-xs">{TYPE_LABELS[node.type].name}</span>
                      </div>
                      <div className="text-white font-medium truncate">{node.title}</div>
                      {node.content && (
                        <div className="text-white/50 text-sm truncate mt-1">{node.content}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          // 大树列表页
          <div className="flex-1 overflow-y-auto p-6">
            {/* Tab切换 */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setActiveTab('trees')}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === 'trees' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60'
                }`}
              >
                🌳 知识大树
              </button>
              <button
                onClick={() => setActiveTab('bookmarks')}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === 'bookmarks' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60'
                }`}
              >
                🔗 网站聚合
              </button>
            </div>

            {activeTab === 'trees' ? (
              <>
                {/* 添加大树按钮 */}
                <button
                  onClick={() => setShowAddTree(true)}
                  className="w-full mb-6 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                >
                  <span className="text-2xl">🌱</span>
                  <span className="text-white/60">创建新大树（新行业/领域）</span>
                </button>

                {/* 大树卡片列表 */}
                {trees.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-4">🌳</div>
                    <div className="text-white/40">
                      暂无知识大树<br />
                      创建一棵大树，开始构建你的知识体系
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {trees.map(tree => (
                      <div
                        key={tree.id}
                        onClick={() => setSelectedTree(tree)}
                        className="p-4 rounded-xl cursor-pointer hover:bg-white/10 transition-colors border border-white/10"
                        style={{ backgroundColor: `${tree.color}15` }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">🌳</span>
                            <span className="text-white font-medium">{tree.name}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTree(tree.id);
                            }}
                            className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-white/20 transition-colors"
                          >
                            ×
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <span style={{ color: tree.color }} className="text-sm">
                            {getTreeStatus(tree)}
                          </span>
                          <span className="text-white/40 text-sm">
                            · {tree.stats.leaves + tree.stats.fruits}个知识
                          </span>
                        </div>
                        {/* 迷你统计 */}
                        <div className="flex gap-3 mt-2 text-xs">
                          {(['root', 'trunk', 'branch', 'leaf', 'fruit'] as const).map(type => {
                            const statsKey = type === 'root' ? 'roots' : type === 'branch' ? 'branches' : type === 'leaf' ? 'leaves' : type === 'fruit' ? 'fruits' : 'trunk';
                            const count = tree.stats[statsKey];
                            return (
                              <span key={type} style={{ color: TYPE_LABELS[type].color }}>
                                {TYPE_LABELS[type].icon} {count}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* 网站聚合 */}
                <button
                  onClick={() => setShowAddBookmark(true)}
                  className="w-full mb-6 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                >
                  <span className="text-2xl">🔗</span>
                  <span className="text-white/60">添加书签</span>
                </button>

                {bookmarks.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-4">🔗</div>
                    <div className="text-white/40">
                      暂无书签<br />
                      添加常用网站，快速访问
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {bookmarks.map(bm => (
                      <div
                        key={bm.id}
                        className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                            <span className="text-blue-400 font-bold">
                              {bm.name[0]?.toUpperCase() || '🔗'}
                            </span>
                          </div>
                          <div>
                            <div className="text-white font-medium">{bm.name}</div>
                            <div className="text-white/40 text-xs truncate max-w-[200px]">
                              {bm.url}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <a
                            href={bm.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 hover:bg-blue-500/30 transition-colors"
                          >
                            →
                          </a>
                          <button
                            onClick={() => handleDeleteBookmark(bm.id)}
                            className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-white/20 transition-colors"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* 添加大树弹窗 */}
      {showAddTree && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShowAddTree(false)}
        >
          <div
            className="rounded-2xl p-6 w-[400px]"
            style={{ backgroundColor: '#1a1a2e' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">创建新大树</h2>
              <button
                onClick={() => setShowAddTree(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <div className="text-white/60 text-sm mb-2">行业/领域名称</div>
              <input
                type="text"
                value={newTreeName}
                onChange={(e) => setNewTreeName(e.target.value)}
                placeholder="如：互联网、金融、教育..."
                className="w-full px-4 py-2 rounded-xl text-sm outline-none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                }}
              />
            </div>

            <div className="mb-6">
              <div className="text-white/60 text-sm mb-2">选择颜色</div>
              <div className="flex gap-2 flex-wrap">
                {TREE_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setNewTreeColor(color)}
                    className={`w-8 h-8 rounded-full transition-all ${
                      newTreeColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1a1a2e]' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAddTree(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateTree}
                disabled={!newTreeName.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-green-500 text-white disabled:opacity-50 hover:bg-green-600 transition-colors"
              >
                创建
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 添加知识弹窗 */}
      {showAddNode && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShowAddNode(false)}
        >
          <div
            className="rounded-2xl p-6 w-[500px]"
            style={{ backgroundColor: '#1a1a2e' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">添加知识</h2>
              <button
                onClick={() => setShowAddNode(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* 选择类型 */}
            <div className="mb-4">
              <div className="text-white/60 text-sm mb-2">选择位置</div>
              <div className="flex gap-2">
                {(['root', 'trunk', 'branch', 'leaf', 'fruit'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setNewNodeType(type)}
                    className={`px-3 py-2 rounded-lg flex items-center gap-1 transition-all ${
                      newNodeType === type ? 'ring-2 ring-white/50' : ''
                    }`}
                    style={{ backgroundColor: TYPE_LABELS[type].color }}
                  >
                    <span>{TYPE_LABELS[type].icon}</span>
                    <span className="text-white text-xs">{TYPE_LABELS[type].name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 引导问题 */}
            <div className="mb-4 p-3 rounded-xl bg-white/5">
              <div className="text-yellow-400/80 text-sm">
                💡 {GUIDE_QUESTIONS[newNodeType]}
              </div>
            </div>

            {/* 标题 */}
            <div className="mb-4">
              <div className="text-white/60 text-sm mb-2">标题</div>
              <input
                type="text"
                value={newNodeTitle}
                onChange={(e) => setNewNodeTitle(e.target.value)}
                placeholder="简短概括..."
                className="w-full px-4 py-2 rounded-xl text-sm outline-none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                }}
              />
            </div>

            {/* 内容 */}
            <div className="mb-4">
              <div className="text-white/60 text-sm mb-2">内容</div>
              <textarea
                value={newNodeContent}
                onChange={(e) => setNewNodeContent(e.target.value)}
                placeholder="详细描述..."
                rows={4}
                className="w-full px-4 py-2 rounded-xl text-sm resize-none outline-none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                }}
              />
            </div>

            {/* 来源 */}
            <div className="mb-6">
              <div className="text-white/60 text-sm mb-2">来源链接（可选）</div>
              <input
                type="url"
                value={newNodeSource}
                onChange={(e) => setNewNodeSource(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-2 rounded-xl text-sm outline-none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                }}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAddNode(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateNode}
                disabled={!newNodeTitle.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-green-500 text-white disabled:opacity-50 hover:bg-green-600 transition-colors"
              >
                添加
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 添加书签弹窗 */}
      {showAddBookmark && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShowAddBookmark(false)}
        >
          <div
            className="rounded-2xl p-6 w-[400px]"
            style={{ backgroundColor: '#1a1a2e' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">添加书签</h2>
              <button
                onClick={() => setShowAddBookmark(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <div className="text-white/60 text-sm mb-2">书签名称</div>
              <input
                type="text"
                value={newBookmarkName}
                onChange={(e) => setNewBookmarkName(e.target.value)}
                placeholder="如：Flomo、豆瓣..."
                className="w-full px-4 py-2 rounded-xl text-sm outline-none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                }}
              />
            </div>

            <div className="mb-6">
              <div className="text-white/60 text-sm mb-2">网址</div>
              <input
                type="url"
                value={newBookmarkUrl}
                onChange={(e) => setNewBookmarkUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-2 rounded-xl text-sm outline-none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                }}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAddBookmark(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateBookmark}
                disabled={!newBookmarkName.trim() || !newBookmarkUrl.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-500 text-white disabled:opacity-50 hover:bg-blue-600 transition-colors"
              >
                添加
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 知识详情弹窗 */}
      {expandedNode && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={() => setExpandedNode(null)}
        >
          <div
            className="rounded-2xl p-6 w-[500px] max-h-[80vh] overflow-y-auto"
            style={{ backgroundColor: '#1a1a2e' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{TYPE_LABELS[expandedNode.type].icon}</span>
                <span className="text-white/60">{TYPE_LABELS[expandedNode.type].name}</span>
              </div>
              <button
                onClick={() => setExpandedNode(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <h3 className="text-xl font-bold text-white mb-4">{expandedNode.title}</h3>
            <div className="text-white/80 leading-relaxed mb-4 whitespace-pre-wrap">
              {expandedNode.content || '暂无内容'}
            </div>
            {expandedNode.source && (
              <div className="mb-4">
                <div className="text-white/40 text-xs mb-1">来源</div>
                <a
                  href={expandedNode.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline text-sm truncate block"
                >
                  {expandedNode.source}
                </a>
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  handleDeleteNode(expandedNode.id);
                  setExpandedNode(null);
                }}
                className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                删除
              </button>
              <button
                onClick={() => setExpandedNode(null)}
                className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 动画样式 */}
      <style>{`
        @keyframes slideInFromRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}