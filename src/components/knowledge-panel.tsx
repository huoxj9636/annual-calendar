import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, ExternalLink, Sprout } from 'lucide-react';
import type { SkinTheme } from '@/lib/skins';

type NodeType = 'root' | 'trunk' | 'branch' | 'leaf' | 'fruit';

interface KnowledgeNode {
  id: string;
  type: NodeType;
  title: string;
  content: string;
  url?: string;
  createdAt: number;
}

interface KnowledgeTree {
  id: string;
  name: string;
  industry: string;
  nodes: KnowledgeNode[];
  createdAt: number;
}

interface Bookmark {
  id: string;
  name: string;
  url: string;
  icon?: string;
}

const POSITION_CONFIG: Record<NodeType, { label: string; color: string; icon: string; question: string }> = {
  root: { label: '树根', color: '#8B5A2B', icon: '🌱', question: '这个认知对你的人生有什么根基意义？' },
  trunk: { label: '树干', color: '#A0522D', icon: '🌳', question: '这个目标是你人生的什么方向？' },
  branch: { label: '树枝', color: '#CD853F', icon: '🌿', question: '这个方法是为了实现什么目标？' },
  leaf: { label: '树叶', color: '#22C55E', icon: '🍃', question: '在你的具体场景中怎么用？' },
  fruit: { label: '果实', color: '#EF4444', icon: '🍎', question: '这个成果是怎么实现的？' },
};

const POSITION_LIST: NodeType[] = ['root', 'trunk', 'branch', 'leaf', 'fruit'];

interface Props {
  skin: SkinTheme;
  onClose: () => void;
}

export default function KnowledgePanel({ skin, onClose }: Props) {
  const [tab, setTab] = useState<'tree' | 'bookmarks'>('tree');
  const [trees, setTrees] = useState<KnowledgeTree[]>([]);
  const [selectedTree, setSelectedTree] = useState<KnowledgeTree | null>(null);
  const [showAddTree, setShowAddTree] = useState(false);
  const [showAddNode, setShowAddNode] = useState<NodeType | null>(null);
  const [editingNode, setEditingNode] = useState<KnowledgeNode | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  // 拖动调整宽度
  const [panelWidth, setPanelWidth] = useState(640);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  useEffect(() => {
    const savedTrees = localStorage.getItem('knowledge-trees');
    if (savedTrees) {
      try {
        const parsed = JSON.parse(savedTrees);
        if (Array.isArray(parsed)) {
          setTrees(parsed.map((t: any) => ({ ...t, nodes: t.nodes || [] })));
        }
      } catch (e) {
        console.error('解析知识树失败:', e);
      }
    }
    const savedBookmarks = localStorage.getItem('bookmarks');
    if (savedBookmarks) {
      try {
        setBookmarks(JSON.parse(savedBookmarks));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (trees.length > 0) {
      localStorage.setItem('knowledge-trees', JSON.stringify(trees));
    }
  }, [trees]);

  // 全局拖动事件
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = dragStartX.current - e.clientX;
      // 面板从右侧打开，向左拖动delta为正，宽度增加
      const newWidth = Math.max(320, Math.min(window.innerWidth - 50, dragStartWidth.current + delta));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;
  };

  const addTree = (name: string, industry: string) => {
    const newTree: KnowledgeTree = {
      id: 'tree-' + Date.now(),
      name,
      industry,
      nodes: [],
      createdAt: Date.now(),
    };
    setTrees([...trees, newTree]);
    setSelectedTree(newTree);
    setShowAddTree(false);
  };

  const deleteTree = (id: string) => {
    if (!confirm('确定要删除这棵知识树吗？')) return;
    setTrees(trees.filter(t => t.id !== id));
    if (selectedTree?.id === id) {
      setSelectedTree(null);
    }
  };

  const addNode = (type: NodeType, title: string, content: string, url?: string) => {
    if (!selectedTree) return;
    const newNode: KnowledgeNode = {
      id: 'node-' + Date.now(),
      type,
      title,
      content,
      url,
      createdAt: Date.now(),
    };
    const updatedTree = { ...selectedTree, nodes: [...selectedTree.nodes, newNode] };
    setTrees(trees.map(t => t.id === selectedTree.id ? updatedTree : t));
    setSelectedTree(updatedTree);
    setShowAddNode(null);
  };

  const updateNode = (id: string, title: string, content: string, url?: string) => {
    if (!selectedTree) return;
    const updatedNodes = selectedTree.nodes.map(n =>
      n.id === id ? { ...n, title, content, url } : n
    );
    const updatedTree = { ...selectedTree, nodes: updatedNodes };
    setTrees(trees.map(t => t.id === selectedTree.id ? updatedTree : t));
    setSelectedTree(updatedTree);
    setEditingNode(null);
  };

  const deleteNode = (id: string) => {
    if (!selectedTree) return;
    if (!confirm('确定要删除这个知识吗？')) return;
    const updatedTree = {
      ...selectedTree,
      nodes: selectedTree.nodes.filter(n => n.id !== id)
    };
    setTrees(trees.map(t => t.id === selectedTree.id ? updatedTree : t));
    setSelectedTree(updatedTree);
  };

  const getNodesByType = (type: NodeType) => {
    if (!selectedTree) return [];
    return selectedTree.nodes.filter(n => n.type === type);
  };

  const getStats = () => {
    if (!selectedTree) return { root: 0, trunk: 0, branch: 0, leaf: 0, fruit: 0 };
    return {
      root: selectedTree.nodes.filter(n => n.type === 'root').length,
      trunk: selectedTree.nodes.filter(n => n.type === 'trunk').length,
      branch: selectedTree.nodes.filter(n => n.type === 'branch').length,
      leaf: selectedTree.nodes.filter(n => n.type === 'leaf').length,
      fruit: selectedTree.nodes.filter(n => n.type === 'fruit').length,
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="h-full overflow-y-auto shadow-2xl relative flex flex-col"
        style={{
          backgroundColor: skin.panelBg,
          color: skin.textPrimary,
          width: panelWidth,
          minWidth: '320px',
          maxWidth: '90vw',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 拖拽手柄 */}
        <div
          className="absolute left-0 top-0 bottom-0 w-3 z-50 cursor-ew-resize flex items-center justify-center group"
          onMouseDown={handleDragStart}
        >
          <div
            className="w-0.5 h-12 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ backgroundColor: skin.swatch }}
          />
        </div>

        {/* 头部 */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b backdrop-blur"
          style={{ borderColor: skin.divider, backgroundColor: skin.panelBg + 'ee' }}
        >
          <div className="flex gap-2">
            <button
              onClick={() => { setTab('tree'); setSelectedTree(null); }}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: tab === 'tree' ? skin.swatch : 'transparent',
                color: tab === 'tree' ? 'white' : skin.textSecondary,
              }}
            >
              知识树
            </button>
            <button
              onClick={() => setTab('bookmarks')}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: tab === 'bookmarks' ? skin.swatch : 'transparent',
                color: tab === 'bookmarks' ? 'white' : skin.textSecondary,
              }}
            >
              朋友们
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:opacity-70 transition-opacity"
            style={{ backgroundColor: skin.cardBg }}
          >
            <X size={18} style={{ color: skin.textPrimary }} />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 p-6">
          {tab === 'tree' && (
            <>
              {!selectedTree && (
                <TreesList
                  trees={trees}
                  onSelect={setSelectedTree}
                  onAdd={() => setShowAddTree(true)}
                  onDelete={deleteTree}
                  skin={skin}
                />
              )}
              {selectedTree && (
                <TreeDetail
                  tree={selectedTree}
                  stats={getStats()}
                  nodesByType={getNodesByType}
                  onBack={() => setSelectedTree(null)}
                  onAddNode={(type: NodeType) => setShowAddNode(type)}
                  onEditNode={setEditingNode}
                  onDeleteNode={deleteNode}
                  onDeleteTree={() => deleteTree(selectedTree.id)}
                  skin={skin}
                />
              )}
            </>
          )}
          {tab === 'bookmarks' && (
            <BookmarksList bookmarks={bookmarks} skin={skin} />
          )}
        </div>

        {/* 弹窗 */}
        {showAddTree && (
          <AddTreeDialog
            onAdd={addTree}
            onClose={() => setShowAddTree(false)}
            skin={skin}
          />
        )}
        {showAddNode && (
          <AddNodeDialog
            type={showAddNode}
            onAdd={addNode}
            onClose={() => setShowAddNode(null)}
            skin={skin}
          />
        )}
        {editingNode && (
          <EditNodeDialog
            node={editingNode}
            onUpdate={updateNode}
            onClose={() => setEditingNode(null)}
            skin={skin}
          />
        )}
      </div>
    </div>
  );
}

// 大树列表
function TreesList({ trees, onSelect, onAdd, onDelete, skin }: any) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm" style={{ color: skin.textSecondary }}>
          {trees.length} 棵知识树
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
          style={{ backgroundColor: skin.swatch, color: 'white' }}
        >
          <Plus size={14} /> 新建知识树
        </button>
      </div>

      {trees.length === 0 ? (
        <div
          className="border-2 border-dashed rounded-2xl p-12 text-center"
          style={{ borderColor: skin.divider }}
        >
          <Sprout size={40} className="mx-auto mb-3" style={{ color: skin.textSecondary }} />
          <div className="text-sm mb-1" style={{ color: skin.textPrimary }}>还没有知识树</div>
          <div className="text-xs" style={{ color: skin.textSecondary }}>
            创建你的第一棵知识树，让碎片学习有体系
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {trees.map((tree: KnowledgeTree) => (
            <div
              key={tree.id}
              className="rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.01] group"
              style={{ backgroundColor: skin.cardBg, border: `1px solid ${skin.divider}` }}
              onClick={() => onSelect(tree)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                    style={{ backgroundColor: skin.swatch + '20', color: skin.swatch }}
                  >
                    🌳
                  </div>
                  <div>
                    <div className="font-medium text-sm" style={{ color: skin.textPrimary }}>{tree.name}</div>
                    <div className="text-xs" style={{ color: skin.textSecondary }}>{tree.industry}</div>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(tree.id); }}
                  className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full flex items-center justify-center hover:bg-red-50"
                  style={{ color: skin.textSecondary }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="mt-3 flex gap-2 text-xs" style={{ color: skin.textSecondary }}>
                <span>根 {tree.nodes.filter((n: any) => n.type === 'root').length}</span>
                <span>·</span>
                <span>干 {tree.nodes.filter((n: any) => n.type === 'trunk').length}</span>
                <span>·</span>
                <span>枝 {tree.nodes.filter((n: any) => n.type === 'branch').length}</span>
                <span>·</span>
                <span>叶 {tree.nodes.filter((n: any) => n.type === 'leaf').length}</span>
                <span>·</span>
                <span>果 {tree.nodes.filter((n: any) => n.type === 'fruit').length}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 大树详情
function TreeDetail({ tree, stats, nodesByType, onBack, onAddNode, onEditNode, onDeleteNode, onDeleteTree, skin }: any) {
  const fruits = nodesByType('fruit');

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="text-sm flex items-center gap-1 hover:opacity-70" style={{ color: skin.textSecondary }}>
          ← 返回
        </button>
        <button onClick={onDeleteTree} className="text-sm hover:opacity-70" style={{ color: skin.textSecondary }}>
          删除这棵树
        </button>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold" style={{ color: skin.textPrimary }}>{tree.name}</h2>
        <p className="text-xs" style={{ color: skin.textSecondary }}>{tree.industry}</p>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {POSITION_LIST.map(type => {
          const config = POSITION_CONFIG[type];
          return (
            <div
              key={type}
              className="rounded-lg p-2 text-center"
              style={{ backgroundColor: skin.cardBg, border: `1px solid ${skin.divider}` }}
            >
              <div className="text-base mb-0.5">{config.icon}</div>
              <div className="text-xs" style={{ color: skin.textSecondary }}>{config.label}</div>
              <div className="text-sm font-semibold" style={{ color: config.color }}>{stats[type]}</div>
            </div>
          );
        })}
      </div>

      {/* 大树展示 */}
      <div
        className="rounded-2xl p-4 mb-4 relative overflow-hidden"
        style={{
          backgroundColor: skin.cardBg,
          border: `1px solid ${skin.divider}`,
          minHeight: '240px',
        }}
      >
        <div className="relative flex justify-center items-end h-[240px]">
          <img src="/tree-empty.jpeg" alt="知识大树" className="h-full w-auto object-contain opacity-90" />
          {fruits.length > 0 && (
            <div className="absolute top-[15%] left-[35%] flex flex-wrap gap-1 justify-center max-w-[120px]">
              {fruits.slice(0, 8).map((node: KnowledgeNode) => (
                <div
                  key={node.id}
                  className="text-lg cursor-pointer hover:scale-125 transition-transform"
                  title={node.title}
                  onClick={() => onEditNode(node)}
                >
                  🍎
                </div>
              ))}
              {fruits.length > 8 && (
                <div className="text-xs" style={{ color: skin.textSecondary }}>+{fruits.length - 8}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 各部分知识卡片 */}
      <div className="space-y-3">
        {POSITION_LIST.map(type => {
          const config = POSITION_CONFIG[type];
          const nodes = nodesByType(type);
          return (
            <div
              key={type}
              className="rounded-xl p-4"
              style={{ backgroundColor: skin.cardBg, border: `1px solid ${skin.divider}` }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">{config.icon}</span>
                  <span className="font-medium text-sm" style={{ color: skin.textPrimary }}>{config.label}</span>
                  <span className="text-xs" style={{ color: skin.textSecondary }}>({nodes.length})</span>
                </div>
                <button
                  onClick={() => onAddNode(type)}
                  className="w-6 h-6 rounded-full flex items-center justify-center hover:opacity-80"
                  style={{ backgroundColor: skin.swatch + '20', color: skin.swatch }}
                >
                  <Plus size={12} />
                </button>
              </div>

              {nodes.length === 0 ? (
                <div className="text-xs text-center py-3" style={{ color: skin.textSecondary }}>
                  添加{config.label}知识，让知识树生长
                </div>
              ) : (
                <div className="space-y-2">
                  {nodes.map((node: KnowledgeNode) => (
                    <div
                      key={node.id}
                      className="p-2.5 rounded-lg cursor-pointer transition-colors group"
                      style={{ backgroundColor: skin.panelBg }}
                      onClick={() => onEditNode(node)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate" style={{ color: skin.textPrimary }}>
                            {node.title}
                          </div>
                          {node.content && (
                            <div className="text-xs mt-0.5 line-clamp-1" style={{ color: skin.textSecondary }}>
                              {node.content}
                            </div>
                          )}
                          {node.url && (
                            <a
                              href={node.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs flex items-center gap-1 mt-0.5 hover:opacity-80"
                              style={{ color: skin.swatch }}
                            >
                              <ExternalLink size={10} /> {node.url}
                            </a>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteNode(node.id); }}
                          className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ color: skin.textSecondary }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 添加树弹窗
function AddTreeDialog({ onAdd, onClose, skin }: any) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl shadow-2xl p-6 w-full max-w-md"
        style={{ backgroundColor: skin.panelBg }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold mb-4" style={{ color: skin.textPrimary }}>新建知识树</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: skin.textSecondary }}>树名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：产品设计"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ backgroundColor: skin.cardBg, color: skin.textPrimary, border: `1px solid ${skin.divider}` }}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: skin.textSecondary }}>行业/领域</label>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="例如：互联网"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ backgroundColor: skin.cardBg, color: skin.textPrimary, border: `1px solid ${skin.divider}` }}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm"
            style={{ backgroundColor: skin.cardBg, color: skin.textPrimary, border: `1px solid ${skin.divider}` }}
          >
            取消
          </button>
          <button
            onClick={() => name.trim() && onAdd(name.trim(), industry.trim() || '通用')}
            disabled={!name.trim()}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ backgroundColor: skin.swatch, color: 'white' }}
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}

// 添加知识弹窗
function AddNodeDialog({ type, onAdd, onClose, skin }: any) {
  const config = POSITION_CONFIG[type as NodeType];
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl shadow-2xl p-6 w-full max-w-md"
        style={{ backgroundColor: skin.panelBg }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{config.icon}</span>
          <h3 className="text-base font-semibold" style={{ color: skin.textPrimary }}>添加{config.label}</h3>
        </div>
        <p className="text-xs mb-4" style={{ color: skin.textSecondary }}>{config.question}</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: skin.textSecondary }}>标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="给这个知识起个名字"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ backgroundColor: skin.cardBg, color: skin.textPrimary, border: `1px solid ${skin.divider}` }}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: skin.textSecondary }}>内容/想法</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="写下你的思考..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
              style={{ backgroundColor: skin.cardBg, color: skin.textPrimary, border: `1px solid ${skin.divider}` }}
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: skin.textSecondary }}>来源链接（可选）</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ backgroundColor: skin.cardBg, color: skin.textPrimary, border: `1px solid ${skin.divider}` }}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm"
            style={{ backgroundColor: skin.cardBg, color: skin.textPrimary, border: `1px solid ${skin.divider}` }}
          >
            取消
          </button>
          <button
            onClick={() => title.trim() && onAdd(type, title.trim(), content.trim(), url.trim() || undefined)}
            disabled={!title.trim()}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ backgroundColor: skin.swatch, color: 'white' }}
          >
            添加
          </button>
        </div>
      </div>
    </div>
  );
}

// 编辑知识弹窗
function EditNodeDialog({ node, onUpdate, onClose, skin }: any) {
  const config = POSITION_CONFIG[node.type as NodeType];
  const [title, setTitle] = useState(node.title);
  const [content, setContent] = useState(node.content);
  const [url, setUrl] = useState(node.url || '');

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl shadow-2xl p-6 w-full max-w-md"
        style={{ backgroundColor: skin.panelBg }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">{config.icon}</span>
          <h3 className="text-base font-semibold" style={{ color: skin.textPrimary }}>编辑{config.label}</h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: skin.textSecondary }}>标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ backgroundColor: skin.cardBg, color: skin.textPrimary, border: `1px solid ${skin.divider}` }}
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: skin.textSecondary }}>内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
              style={{ backgroundColor: skin.cardBg, color: skin.textPrimary, border: `1px solid ${skin.divider}` }}
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: skin.textSecondary }}>来源链接</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ backgroundColor: skin.cardBg, color: skin.textPrimary, border: `1px solid ${skin.divider}` }}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm"
            style={{ backgroundColor: skin.cardBg, color: skin.textPrimary, border: `1px solid ${skin.divider}` }}
          >
            取消
          </button>
          <button
            onClick={() => title.trim() && onUpdate(node.id, title.trim(), content.trim(), url.trim() || undefined)}
            disabled={!title.trim()}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ backgroundColor: skin.swatch, color: 'white' }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

// 书签列表
function BookmarksList({ bookmarks, skin }: any) {
  return (
    <div>
      <div className="text-sm mb-4" style={{ color: skin.textSecondary }}>
        {bookmarks.length} 个朋友
      </div>

      {bookmarks.length === 0 ? (
        <div className="border-2 border-dashed rounded-2xl p-12 text-center" style={{ borderColor: skin.divider }}>
          <ExternalLink size={40} className="mx-auto mb-3" style={{ color: skin.textSecondary }} />
          <div className="text-sm" style={{ color: skin.textSecondary }}>还没有朋友链接</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {bookmarks.map((bookmark: Bookmark) => (
            <a
              key={bookmark.id}
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl p-4 transition-all hover:scale-[1.02]"
              style={{ backgroundColor: skin.cardBg, border: `1px solid ${skin.divider}` }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-base font-semibold"
                  style={{ backgroundColor: skin.swatch + '20', color: skin.swatch }}
                >
                  {bookmark.icon || bookmark.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: skin.textPrimary }}>
                    {bookmark.name}
                  </div>
                  <div className="text-xs truncate" style={{ color: skin.textSecondary }}>
                    {bookmark.url}
                  </div>
                </div>
                <ExternalLink size={12} style={{ color: skin.textSecondary }} />
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
