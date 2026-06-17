"use client";

import { useState, useEffect, useMemo } from "react";

interface KnowledgePanelProps {
  open: boolean;
  onClose: () => void;
  skin: any;
}

interface KnowledgeNode {
  id: string;
  type: "root" | "trunk" | "branch" | "leaf" | "fruit";
  title: string;
  content: string;
  source?: string;
  createdAt: number;
}

interface KnowledgeTree {
  id: string;
  name: string;
  industry: string;
  description: string;
  nodes: KnowledgeNode[];
  createdAt: number;
}

interface Bookmark {
  id: string;
  name: string;
  url: string;
  type: "bookmark";
}

const TREE_NODE_TYPE_INFO = {
  root: { label: "树根", desc: "底层认知/核心原理", color: "#8B4513" },
  trunk: { label: "树干", desc: "核心目标/方向", color: "#A0522D" },
  branch: { label: "树枝", desc: "实现路径/方法", color: "#228B22" },
  leaf: { label: "树叶", desc: "具体执行/碎片知识", color: "#90EE90" },
  fruit: { label: "果实", desc: "成果产出/价值变现", color: "#FF6347" },
};

export default function KnowledgePanel({ open, onClose, skin }: KnowledgePanelProps) {
  const [activeTab, setActiveTab] = useState<"tree" | "friends">("tree");
  const [trees, setTrees] = useState<KnowledgeTree[]>([]);
  const [selectedTree, setSelectedTree] = useState<KnowledgeTree | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [showAddTree, setShowAddTree] = useState(false);
  const [showAddNode, setShowAddNode] = useState(false);
  const [showAddBookmark, setShowAddBookmark] = useState(false);
  const [newTree, setNewTree] = useState({ name: "", industry: "", description: "" });
  const [newNode, setNewNode] = useState<{
    type: "root" | "trunk" | "branch" | "leaf" | "fruit";
    title: string;
    content: string;
    source: string;
  }>({ type: "leaf", title: "", content: "", source: "" });
  const [newBookmark, setNewBookmark] = useState({ name: "", url: "" });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      const savedTrees = localStorage.getItem("knowledge-trees");
      if (savedTrees) {
        const parsed = JSON.parse(savedTrees);
        if (Array.isArray(parsed)) {
          setTrees(
            parsed.map((t: any) => ({
              ...t,
              nodes: Array.isArray(t.nodes) ? t.nodes : [],
            }))
          );
        }
      }
      const savedBookmarks = localStorage.getItem("knowledge-bookmarks");
      if (savedBookmarks) {
        const parsed = JSON.parse(savedBookmarks);
        if (Array.isArray(parsed)) {
          setBookmarks(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load knowledge data", e);
    }
  }, [mounted]);

  useEffect(() => {
    if (mounted && trees.length > 0) {
      localStorage.setItem("knowledge-trees", JSON.stringify(trees));
    }
  }, [trees, mounted]);

  useEffect(() => {
    if (mounted && bookmarks.length > 0) {
      localStorage.setItem("knowledge-bookmarks", JSON.stringify(bookmarks));
    }
  }, [bookmarks, mounted]);

  const handleAddTree = () => {
    if (!newTree.name.trim()) return;
    const tree: KnowledgeTree = {
      id: `tree-${Date.now()}`,
      name: newTree.name,
      industry: newTree.industry || newTree.name,
      description: newTree.description,
      nodes: [],
      createdAt: Date.now(),
    };
    setTrees([...trees, tree]);
    setNewTree({ name: "", industry: "", description: "" });
    setShowAddTree(false);
  };

  const handleDeleteTree = (id: string) => {
    if (confirm("确定删除这棵知识树吗？")) {
      setTrees(trees.filter((t) => t.id !== id));
      if (selectedTree?.id === id) {
        setSelectedTree(null);
      }
    }
  };

  const handleSelectTree = (tree: KnowledgeTree) => {
    setSelectedTree(tree);
    setShowAddNode(false);
  };

  const handleAddNode = () => {
    if (!selectedTree || !newNode.title.trim()) return;
    const node: KnowledgeNode = {
      id: `node-${Date.now()}`,
      type: newNode.type,
      title: newNode.title,
      content: newNode.content,
      source: newNode.source,
      createdAt: Date.now(),
    };
    const updatedTree = {
      ...selectedTree,
      nodes: [...selectedTree.nodes, node],
    };
    setSelectedTree(updatedTree);
    setTrees(trees.map((t) => (t.id === selectedTree.id ? updatedTree : t)));
    setNewNode({ type: "leaf", title: "", content: "", source: "" });
    setShowAddNode(false);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!selectedTree) return;
    if (confirm("确定删除这个知识吗？")) {
      const updatedTree = {
        ...selectedTree,
        nodes: selectedTree.nodes.filter((n) => n.id !== nodeId),
      };
      setSelectedTree(updatedTree);
      setTrees(trees.map((t) => (t.id === selectedTree.id ? updatedTree : t)));
    }
  };

  const handleAddBookmark = () => {
    if (!newBookmark.name.trim() || !newBookmark.url.trim()) return;
    const bookmark: Bookmark = {
      id: `bookmark-${Date.now()}`,
      name: newBookmark.name,
      url: newBookmark.url,
      type: "bookmark",
    };
    setBookmarks([...bookmarks, bookmark]);
    setNewBookmark({ name: "", url: "" });
    setShowAddBookmark(false);
  };

  const handleDeleteBookmark = (id: string) => {
    if (confirm("确定删除这个朋友吗？")) {
      setBookmarks(bookmarks.filter((b) => b.id !== id));
    }
  };

  const nodesByType = useMemo(() => {
    if (!selectedTree) return {} as Record<string, KnowledgeNode[]>;
    return selectedTree.nodes.reduce((acc, node) => {
      if (!acc[node.type]) acc[node.type] = [];
      acc[node.type].push(node);
      return acc;
    }, {} as Record<string, KnowledgeNode[]>);
  }, [selectedTree]);

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .knowledge-panel-slide {
          animation: slideInRight 0.3s ease-out forwards;
        }
        .knowledge-panel-fade {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
      {open && (
        <div
          className="fixed inset-0 z-50 flex knowledge-panel-slide"
          style={{ background: skin.panelBg }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-2xl z-20"
            style={{ background: skin.swatch, color: "#fff" }}
            aria-label="关闭"
          >
            ×
          </button>

          <div className="w-full h-full flex flex-col overflow-hidden">
            {/* Tab 切换 */}
            <div
              className="flex border-b pr-16"
              style={{ borderColor: skin.divider }}
            >
              <button
                onClick={() => {
                  setActiveTab("tree");
                  setSelectedTree(null);
                  setShowAddNode(false);
                }}
                className="px-6 py-3 text-lg font-bold transition-colors"
                style={{
                  color: activeTab === "tree" ? skin.swatch : skin.textSecondary,
                  borderBottom: activeTab === "tree" ? `2px solid ${skin.swatch}` : "2px solid transparent",
                }}
              >
                知识树
              </button>
              <button
                onClick={() => setActiveTab("friends")}
                className="px-6 py-3 text-lg font-bold transition-colors"
                style={{
                  color: activeTab === "friends" ? skin.swatch : skin.textSecondary,
                  borderBottom: activeTab === "friends" ? `2px solid ${skin.swatch}` : "2px solid transparent",
                }}
              >
                朋友们
              </button>
            </div>

            {/* 内容区 */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === "tree" && !selectedTree && (
                <TreesList
                  trees={trees}
                  onSelect={handleSelectTree}
                  onAdd={() => setShowAddTree(true)}
                  onDelete={handleDeleteTree}
                  skin={skin}
                />
              )}

              {activeTab === "tree" && selectedTree && (
                <TreeDetail
                  tree={selectedTree}
                  nodesByType={nodesByType}
                  onBack={() => setSelectedTree(null)}
                  onAddNode={() => setShowAddNode(true)}
                  onDeleteNode={handleDeleteNode}
                  skin={skin}
                />
              )}

              {activeTab === "friends" && (
                <FriendsList
                  bookmarks={bookmarks}
                  onAdd={() => setShowAddBookmark(true)}
                  onDelete={handleDeleteBookmark}
                  skin={skin}
                />
              )}
            </div>
          </div>

          {/* 添加知识树弹窗 */}
          {showAddTree && (
            <Modal title="新建知识树" onClose={() => setShowAddTree(false)} skin={skin}>
              <div className="space-y-3">
                <Input
                  label="名称"
                  value={newTree.name}
                  onChange={(v) => setNewTree({ ...newTree, name: v })}
                  placeholder="如：技术成长"
                  skin={skin}
                />
                <Input
                  label="行业/领域"
                  value={newTree.industry}
                  onChange={(v) => setNewTree({ ...newTree, industry: v })}
                  placeholder="如：互联网、AI..."
                  skin={skin}
                />
                <Input
                  label="描述"
                  value={newTree.description}
                  onChange={(v) => setNewTree({ ...newTree, description: v })}
                  placeholder="一句话描述"
                  skin={skin}
                />
                <div className="flex gap-2 justify-end pt-2">
                  <Button onClick={() => setShowAddTree(false)} variant="ghost" skin={skin}>
                    取消
                  </Button>
                  <Button onClick={handleAddTree} skin={skin}>
                    创建
                  </Button>
                </div>
              </div>
            </Modal>
          )}

          {/* 添加知识弹窗 */}
          {showAddNode && selectedTree && (
            <Modal title="添加知识" onClose={() => setShowAddNode(false)} skin={skin}>
              <div className="space-y-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: skin.textSecondary }}>
                    知识类型
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {Object.entries(TREE_NODE_TYPE_INFO).map(([key, info]) => (
                      <button
                        key={key}
                        onClick={() => setNewNode({ ...newNode, type: key as any })}
                        className="p-2 rounded text-xs transition-all"
                        style={{
                          background: newNode.type === key ? info.color : "transparent",
                          color: newNode.type === key ? "#fff" : skin.textPrimary,
                          border: `1px solid ${newNode.type === key ? info.color : skin.divider}`,
                        }}
                      >
                        {info.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Input
                  label="标题"
                  value={newNode.title}
                  onChange={(v) => setNewNode({ ...newNode, title: v })}
                  placeholder="一句话标题"
                  skin={skin}
                />
                <div>
                  <label className="text-xs mb-1 block" style={{ color: skin.textSecondary }}>
                    内容
                  </label>
                  <textarea
                    value={newNode.content}
                    onChange={(e) => setNewNode({ ...newNode, content: e.target.value })}
                    placeholder="详细描述..."
                    className="w-full p-2 rounded text-sm min-h-[100px] outline-none"
                    style={{
                      background: skin.cardBg,
                      color: skin.textPrimary,
                      border: `1px solid ${skin.divider}`,
                    }}
                  />
                </div>
                <Input
                  label="来源（可选）"
                  value={newNode.source}
                  onChange={(v) => setNewNode({ ...newNode, source: v })}
                  placeholder="文章链接、书名等"
                  skin={skin}
                />
                <div className="flex gap-2 justify-end pt-2">
                  <Button onClick={() => setShowAddNode(false)} variant="ghost" skin={skin}>
                    取消
                  </Button>
                  <Button onClick={handleAddNode} skin={skin}>
                    添加
                  </Button>
                </div>
              </div>
            </Modal>
          )}

          {/* 添加朋友弹窗 */}
          {showAddBookmark && (
            <Modal title="添加朋友" onClose={() => setShowAddBookmark(false)} skin={skin}>
              <div className="space-y-3">
                <Input
                  label="名字"
                  value={newBookmark.name}
                  onChange={(v) => setNewBookmark({ ...newBookmark, name: v })}
                  placeholder="朋友的名字"
                  skin={skin}
                />
                <Input
                  label="链接"
                  value={newBookmark.url}
                  onChange={(v) => setNewBookmark({ ...newBookmark, url: v })}
                  placeholder="https://..."
                  skin={skin}
                />
                <div className="flex gap-2 justify-end pt-2">
                  <Button onClick={() => setShowAddBookmark(false)} variant="ghost" skin={skin}>
                    取消
                  </Button>
                  <Button onClick={handleAddBookmark} skin={skin}>
                    添加
                  </Button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}
    </>
  );
}

// === 子组件 ===

function TreesList({
  trees,
  onSelect,
  onAdd,
  onDelete,
  skin,
}: {
  trees: KnowledgeTree[];
  onSelect: (t: KnowledgeTree) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  skin: any;
}) {
  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <Button onClick={onAdd} skin={skin}>
          + 新建
        </Button>
      </div>
      {trees.length === 0 ? (
        <div
          className="p-12 rounded-lg text-center"
          style={{ background: skin.cardBg, color: skin.textSecondary }}
        >
          还没有知识树，点击右上角创建第一棵吧
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {trees.map((tree) => (
            <div
              key={tree.id}
              className="p-4 rounded-lg cursor-pointer relative group transition-all hover:scale-105 flex flex-col items-center justify-center min-h-[160px]"
              style={{ background: skin.cardBg }}
              onClick={() => onSelect(tree)}
            >
              <div
                className="w-12 h-12 rounded-full mb-2 flex items-center justify-center text-xl"
                style={{ background: skin.swatch, color: "#fff" }}
              >
                🌳
              </div>
              <div className="text-center">
                <div className="font-medium text-sm" style={{ color: skin.textPrimary }}>
                  {tree.name}
                </div>
                <div className="text-xs mt-1" style={{ color: skin.textSecondary }}>
                  {tree.nodes.length} 个知识
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(tree.id);
                }}
                className="absolute top-2 right-2 w-6 h-6 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "rgba(255,0,0,0.2)", color: "#ff4444" }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TreeDetail({
  tree,
  nodesByType,
  onBack,
  onAddNode,
  onDeleteNode,
  skin,
}: {
  tree: KnowledgeTree;
  nodesByType: Record<string, KnowledgeNode[]>;
  onBack: () => void;
  onAddNode: () => void;
  onDeleteNode: (id: string) => void;
  skin: any;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-sm px-2 py-1 rounded"
            style={{ color: skin.textSecondary }}
          >
            ← 返回
          </button>
          <h2 className="text-lg font-semibold" style={{ color: skin.textPrimary }}>
            {tree.name}
          </h2>
        </div>
        <Button onClick={onAddNode} skin={skin}>
          + 添加知识
        </Button>
      </div>

      {/* 知识树可视化 */}
      <div
        className="p-4 rounded-lg mb-4"
        style={{ background: skin.cardBg }}
      >
        <div className="text-center mb-2 text-sm" style={{ color: skin.textSecondary }}>
          点击图片放大查看 →
        </div>
        <div className="flex justify-center">
          <img
            src="/tree-empty.jpeg"
            alt="知识树"
            className="rounded max-h-48 object-contain"
            style={{ background: "transparent" }}
          />
        </div>
      </div>

      {/* 各类型知识列表 */}
      <div className="space-y-4">
        {Object.entries(TREE_NODE_TYPE_INFO).map(([type, info]) => {
          const nodes = nodesByType[type] || [];
          return (
            <div
              key={type}
              className="rounded-lg overflow-hidden"
              style={{ background: skin.cardBg }}
            >
              <div
                className="px-4 py-2 flex items-center justify-between"
                style={{ background: info.color, color: "#fff" }}
              >
                <span className="font-medium">{info.label}</span>
                <span className="text-xs opacity-80">
                  {nodes.length} 个
                </span>
              </div>
              <div className="p-3 space-y-2">
                {nodes.length === 0 ? (
                  <div
                    className="text-center text-sm py-3"
                    style={{ color: skin.textSecondary }}
                  >
                    还没有
                  </div>
                ) : (
                  nodes.map((node) => (
                    <div
                      key={node.id}
                      className="p-2 rounded flex items-start justify-between group"
                      style={{ background: "rgba(0,0,0,0.03)" }}
                    >
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-sm font-medium truncate"
                          style={{ color: skin.textPrimary }}
                        >
                          {node.title}
                        </div>
                        {node.content && (
                          <div
                            className="text-xs mt-1 line-clamp-2"
                            style={{ color: skin.textSecondary }}
                          >
                            {node.content}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => onDeleteNode(node.id)}
                        className="ml-2 text-xs opacity-0 group-hover:opacity-100"
                        style={{ color: "#ff4444" }}
                      >
                        删除
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FriendsList({
  bookmarks,
  onAdd,
  onDelete,
  skin,
}: {
  bookmarks: Bookmark[];
  onAdd: () => void;
  onDelete: (id: string) => void;
  skin: any;
}) {
  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <Button onClick={onAdd} skin={skin}>
          + 添加
        </Button>
      </div>
      {bookmarks.length === 0 ? (
        <div
          className="p-12 rounded-lg text-center"
          style={{ background: skin.cardBg, color: skin.textSecondary }}
        >
          还没有朋友链接，点击右上角添加吧
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {bookmarks.map((b) => (
            <div
              key={b.id}
              className="p-4 rounded-lg relative group cursor-pointer transition-all hover:scale-105 flex flex-col items-center justify-center min-h-[160px]"
              style={{ background: skin.cardBg }}
              onClick={() => window.open(b.url, "_blank")}
            >
              <div
                className="w-12 h-12 rounded-full mb-2 flex items-center justify-center text-lg font-medium"
                style={{ background: skin.swatch, color: "#fff" }}
              >
                {b.name.charAt(0).toUpperCase()}
              </div>
              <div
                className="text-center text-sm truncate w-full px-1"
                style={{ color: skin.textPrimary }}
              >
                {b.name}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(b.id);
                }}
                className="absolute top-2 right-2 w-6 h-6 rounded opacity-0 group-hover:opacity-100"
                style={{ background: "rgba(255,0,0,0.2)", color: "#ff4444" }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  skin,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  skin: any;
}) {
  return (
    <div>
      <label className="text-xs mb-1 block" style={{ color: skin.textSecondary }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full p-2 rounded text-sm outline-none"
        style={{
          background: skin.cardBg,
          color: skin.textPrimary,
          border: `1px solid ${skin.divider}`,
        }}
      />
    </div>
  );
}

function Button({
  onClick,
  children,
  variant = "primary",
  skin,
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "primary" | "ghost";
  skin: any;
}) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-1.5 rounded text-sm transition-all"
      style={{
        background: variant === "primary" ? skin.swatch : "transparent",
        color: variant === "primary" ? "#fff" : skin.textPrimary,
        border: variant === "primary" ? "none" : `1px solid ${skin.divider}`,
      }}
    >
      {children}
    </button>
  );
}

function Modal({
  title,
  onClose,
  children,
  skin,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  skin: any;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md p-5 rounded-lg"
        style={{ background: skin.panelBg, color: skin.textPrimary }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: skin.cardBg, color: skin.textSecondary }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
