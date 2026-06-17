"use client";

import { useState, useEffect, useMemo } from "react";
import { SKINS, NO_SKIN } from "@/lib/skins";

// 类型定义
interface KnowledgeNode {
  id: string;
  type: "root" | "trunk" | "branch" | "leaf" | "fruit";
  title: string;
  content: string;
  createdAt: string;
}

interface KnowledgeTree {
  id: string;
  name: string;
  nodes: KnowledgeNode[];
  createdAt: string;
}

interface Bookmark {
  id: string;
  name: string;
  url: string;
}

const TREES_STORAGE_KEY = "knowledge-trees";
const BOOKMARKS_STORAGE_KEY = "knowledge-bookmarks";

// 获取默认知识树
function getDefaultTrees(): KnowledgeTree[] {
  return [
    { id: "tree-1", name: "工作事业", nodes: [], createdAt: new Date().toISOString() },
    { id: "tree-2", name: "个人成长", nodes: [], createdAt: new Date().toISOString() },
  ];
}

// 获取默认书签
function getDefaultBookmarks(): Bookmark[] {
  return [
    { id: "bm-1", name: "Flomo", url: "https://flomoapp.com" },
  ];
}

export default function KnowledgePanel({ onClose }: { onClose: () => void }) {
  const [trees, setTrees] = useState<KnowledgeTree[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [selectedTree, setSelectedTree] = useState<KnowledgeTree | null>(null);
  const [activeTab, setActiveTab] = useState<"trees" | "friends">("trees");
  const [showAddTree, setShowAddTree] = useState(false);
  const [showAddNode, setShowAddNode] = useState(false);
  const [showAddBookmark, setShowAddBookmark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [skinKey, setSkinKey] = useState<string>("");
  const [panelWidth, setPanelWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // 拖拽调整宽度
  const handleDragStart = () => setIsDragging(true);
  const handleDrag = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newWidth = window.innerWidth - e.clientX;
    setPanelWidth(Math.max(320, Math.min(800, newWidth)));
  };
  const handleDragEnd = () => setIsDragging(false);

  // 获取当前主题
  const skin = useMemo(() => {
    if (!mounted) return NO_SKIN;
    return skinKey ? (SKINS.find(s => s.key === skinKey) ?? NO_SKIN) : NO_SKIN;
  }, [skinKey, mounted]);

  // 初始化
  useEffect(() => {
    setMounted(true);
    // 读取主题
    const savedSkin = localStorage.getItem("life-calendar-skin");
    if (savedSkin && SKINS.find(s => s.key === savedSkin)) {
      setSkinKey(savedSkin);
    }
    // 读取知识树
    const storedTrees = localStorage.getItem(TREES_STORAGE_KEY);
    if (storedTrees) {
      try {
        const parsed = JSON.parse(storedTrees);
        const validTrees = parsed.map((t: KnowledgeTree) => ({
          ...t,
          nodes: t.nodes || [],
        }));
        setTrees(validTrees);
      } catch {
        setTrees(getDefaultTrees());
      }
    } else {
      setTrees(getDefaultTrees());
    }
    // 读取书签
    const storedBookmarks = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (storedBookmarks) {
      try {
        setBookmarks(JSON.parse(storedBookmarks));
      } catch {
        setBookmarks(getDefaultBookmarks());
      }
    } else {
      setBookmarks(getDefaultBookmarks());
    }
  }, []);

  // 监听主题变化
  useEffect(() => {
    const checkSkin = () => {
      const savedSkin = localStorage.getItem("life-calendar-skin");
      if (savedSkin !== skinKey) {
        setSkinKey(savedSkin || "");
      }
    };
    window.addEventListener("storage", checkSkin);
    const interval = setInterval(checkSkin, 1000);
    return () => {
      window.removeEventListener("storage", checkSkin);
      clearInterval(interval);
    };
  }, [skinKey]);

  // 保存知识树
  const saveTrees = (newTrees: KnowledgeTree[]) => {
    setTrees(newTrees);
    localStorage.setItem(TREES_STORAGE_KEY, JSON.stringify(newTrees));
  };

  // 保存书签
  const saveBookmarks = (newBookmarks: Bookmark[]) => {
    setBookmarks(newBookmarks);
    localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(newBookmarks));
  };

  // 添加知识树
  const handleAddTree = (name: string) => {
    const newTree: KnowledgeTree = {
      id: `tree-${Date.now()}`,
      name,
      nodes: [],
      createdAt: new Date().toISOString(),
    };
    saveTrees([...trees, newTree]);
    setShowAddTree(false);
  };

  // 添加知识节点（果实）
  const handleAddNode = (type: KnowledgeNode["type"], title: string, content: string) => {
    if (!selectedTree) return;
    const newNode: KnowledgeNode = {
      id: `node-${Date.now()}`,
      type,
      title,
      content,
      createdAt: new Date().toISOString(),
    };
    const updatedTree = {
      ...selectedTree,
      nodes: [...selectedTree.nodes, newNode],
    };
    saveTrees(trees.map(t => t.id === selectedTree.id ? updatedTree : t));
    setSelectedTree(updatedTree);
    setShowAddNode(false);
  };

  // 添加书签
  const handleAddBookmark = (name: string, url: string) => {
    const newBookmark: Bookmark = {
      id: `bm-${Date.now()}`,
      name,
      url,
    };
    saveBookmarks([...bookmarks, newBookmark]);
    setShowAddBookmark(false);
  };

  // 获取果实数量
  const fruitCount = selectedTree?.nodes.filter(n => n.type === "fruit").length || 0;

  if (!mounted) return null;

  const { swatch, panelBg, cardBg, textPrimary, textSecondary, textMuted, divider, cardHover } = skin;

  return (
    <div
      className="fixed inset-0 z-[99999] flex justify-end"
      style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
      onClick={onClose}
    >
      <div
        className="h-full overflow-y-auto shadow-2xl animate-slide-in-right relative"
        style={{ 
          backgroundColor: panelBg,
          width: panelWidth > 0 ? panelWidth : '100%',
          maxWidth: '800px',
          minWidth: '320px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 拖拽手柄 */}
        <div
          className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize z-50 hover:bg-black/5 transition-colors"
          onMouseDown={handleDragStart}
          onMouseMove={handleDrag}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
        />
        
        {/* 头部 */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${divider}` }}
        >
          <h2 className="text-xl font-bold" style={{ color: textPrimary }}>
            知识库
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
            style={{ color: textMuted, backgroundColor: divider + "40" }}
          >
            ×
          </button>
        </div>

        {/* Tab切换 */}
        <div className="flex px-6 pt-4 gap-4">
          <button
            onClick={() => setActiveTab("trees")}
            className="px-4 py-2 rounded-lg font-medium transition-colors"
            style={{
              backgroundColor: activeTab === "trees" ? swatch + "20" : "transparent",
              color: activeTab === "trees" ? swatch : textSecondary,
              border: activeTab === "trees" ? `1px solid ${swatch}40` : "1px solid transparent",
            }}
          >
            知识树
          </button>
          <button
            onClick={() => setActiveTab("friends")}
            className="px-4 py-2 rounded-lg font-medium transition-colors"
            style={{
              backgroundColor: activeTab === "friends" ? swatch + "20" : "transparent",
              color: activeTab === "friends" ? swatch : textSecondary,
              border: activeTab === "friends" ? `1px solid ${swatch}40` : "1px solid transparent",
            }}
          >
            朋友们
          </button>
        </div>

        {/* 内容区 */}
        <div className="px-6 py-4">
          {activeTab === "trees" && !selectedTree && (
            <>
              {/* 知识树卡片列表 */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                {trees.map((tree) => (
                  <div
                    key={tree.id}
                    onClick={() => setSelectedTree(tree)}
                    className="rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg"
                    style={{
                      backgroundColor: cardBg,
                      border: `1px solid ${divider}`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = cardHover;
                      e.currentTarget.style.borderColor = swatch + "40";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = cardBg;
                      e.currentTarget.style.borderColor = divider;
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center text-xl"
                        style={{ backgroundColor: swatch + "20", color: swatch }}
                      >
                        🌳
                      </div>
                      <div>
                        <h3 className="font-semibold" style={{ color: textPrimary }}>
                          {tree.name}
                        </h3>
                        <p className="text-sm" style={{ color: textMuted }}>
                          {tree.nodes.length} 条知识
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 添加按钮 */}
              <button
                onClick={() => setShowAddTree(true)}
                className="w-full py-3 rounded-xl font-medium transition-colors"
                style={{
                  backgroundColor: swatch + "10",
                  color: swatch,
                  border: `1px solid ${swatch}30`,
                }}
              >
                + 新建知识树
              </button>
            </>
          )}

          {activeTab === "trees" && selectedTree && (
            <>
              {/* 返回按钮 */}
              <button
                onClick={() => setSelectedTree(null)}
                className="mb-4 px-3 py-1.5 rounded-lg text-sm"
                style={{ color: textSecondary, backgroundColor: divider + "40" }}
              >
                ← 返回
              </button>

              {/* 树标题 */}
              <h3 className="text-lg font-bold mb-4" style={{ color: textPrimary }}>
                {selectedTree.name}
              </h3>

              {/* 大树可视化区域 */}
              <div
                className="relative rounded-xl overflow-hidden mb-4"
                style={{
                  height: "280px",
                  backgroundColor: "#f8fafc",
                  border: `1px solid ${divider}`,
                }}
              >
                {/* 大树背景图 */}
                <img
                  src="/tree-empty.jpeg"
                  alt="知识树"
                  className="w-full h-full object-contain"
                />

                {/* 动态果实标记 */}
                {selectedTree.nodes
                  .filter((n) => n.type === "fruit")
                  .map((fruit, idx) => {
                    // 根据果实数量分布位置
                    const positions = [
                      { left: "25%", top: "35%" },
                      { left: "40%", top: "25%" },
                      { left: "55%", top: "30%" },
                      { left: "70%", top: "35%" },
                      { left: "30%", top: "45%" },
                      { left: "50%", top: "40%" },
                      { left: "65%", top: "45%" },
                      { left: "35%", top: "55%" },
                      { left: "60%", top: "55%" },
                      { left: "45%", top: "60%" },
                    ];
                    const pos = positions[idx % positions.length];
                    return (
                      <div
                        key={fruit.id}
                        className="absolute cursor-pointer transition-transform hover:scale-110"
                        style={{
                          left: pos.left,
                          top: pos.top,
                          transform: "translate(-50%, -50%)",
                        }}
                        title={fruit.title}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center shadow-md"
                          style={{
                            backgroundColor: swatch,
                            color: "#fff",
                            fontSize: "14px",
                          }}
                        >
                          🍎
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* 果实统计 */}
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                  style={{ backgroundColor: swatch + "10" }}
                >
                  <span style={{ color: swatch }}>🍎</span>
                  <span style={{ color: textSecondary }}>{fruitCount} 个果实</span>
                </div>
              </div>

              {/* 知识列表 */}
              <div className="space-y-3 mb-4">
                {selectedTree.nodes.map((node) => (
                  <div
                    key={node.id}
                    className="rounded-lg p-3"
                    style={{
                      backgroundColor: cardBg,
                      border: `1px solid ${divider}`,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="px-2 py-1 rounded text-xs"
                        style={{
                          backgroundColor:
                            node.type === "fruit"
                              ? swatch + "20"
                              : node.type === "leaf"
                              ? "#22c55e20"
                              : divider,
                          color:
                            node.type === "fruit"
                              ? swatch
                              : node.type === "leaf"
                              ? "#22c55e"
                              : textSecondary,
                        }}
                      >
                        {node.type === "fruit" ? "果实" : node.type === "leaf" ? "树叶" : node.type}
                      </span>
                      <div className="flex-1">
                        <h4 className="font-medium" style={{ color: textPrimary }}>
                          {node.title}
                        </h4>
                        <p className="text-sm mt-1" style={{ color: textMuted }}>
                          {node.content}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {selectedTree.nodes.length === 0 && (
                  <p className="text-center py-8" style={{ color: textMuted }}>
                    还没有知识，点击下方按钮添加
                  </p>
                )}
              </div>

              {/* 添加知识按钮 */}
              <button
                onClick={() => setShowAddNode(true)}
                className="w-full py-3 rounded-xl font-medium transition-colors"
                style={{
                  backgroundColor: swatch,
                  color: "#fff",
                }}
              >
                + 添加知识
              </button>
            </>
          )}

          {activeTab === "friends" && (
            <>
              {/* 朋友们（书签）卡片列表 */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                {bookmarks.map((bm) => (
                  <a
                    key={bm.id}
                    href={bm.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg"
                    style={{
                      backgroundColor: cardBg,
                      border: `1px solid ${divider}`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = cardHover;
                      e.currentTarget.style.borderColor = swatch + "40";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = cardBg;
                      e.currentTarget.style.borderColor = divider;
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold"
                        style={{ backgroundColor: swatch + "20", color: swatch }}
                      >
                        {bm.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold" style={{ color: textPrimary }}>
                          {bm.name}
                        </h3>
                      </div>
                    </div>
                  </a>
                ))}
              </div>

              {/* 添加按钮 */}
              <button
                onClick={() => setShowAddBookmark(true)}
                className="w-full py-3 rounded-xl font-medium transition-colors"
                style={{
                  backgroundColor: swatch + "10",
                  color: swatch,
                  border: `1px solid ${swatch}30`,
                }}
              >
                + 添加朋友
              </button>
            </>
          )}
        </div>

        {/* 添加知识树弹窗 */}
        {showAddTree && (
          <AddTreeModal
            skin={skin}
            onClose={() => setShowAddTree(false)}
            onSubmit={handleAddTree}
          />
        )}

        {/* 添加知识节点弹窗 */}
        {showAddNode && (
          <AddNodeModal
            skin={skin}
            onClose={() => setShowAddNode(false)}
            onSubmit={handleAddNode}
          />
        )}

        {/* 添加书签弹窗 */}
        {showAddBookmark && (
          <AddBookmarkModal
            skin={skin}
            onClose={() => setShowAddBookmark(false)}
            onSubmit={handleAddBookmark}
          />
        )}
      </div>
    </div>
  );
}

// 添加知识树弹窗
function AddTreeModal({
  skin,
  onClose,
  onSubmit,
}: {
  skin: typeof NO_SKIN;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState("");

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-6 w-80"
        style={{ backgroundColor: skin.panelBg, border: `1px solid ${skin.divider}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-4" style={{ color: skin.textPrimary }}>
          新建知识树
        </h3>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="知识树名称"
          className="w-full px-3 py-2 rounded-lg mb-4"
          style={{
            backgroundColor: skin.cardBg,
            color: skin.textPrimary,
            border: `1px solid ${skin.divider}`,
          }}
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg"
            style={{ color: skin.textSecondary, backgroundColor: skin.divider + "40" }}
          >
            取消
          </button>
          <button
            onClick={() => name && onSubmit(name)}
            className="flex-1 py-2 rounded-lg"
            style={{ backgroundColor: skin.swatch, color: "#fff" }}
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}

// 添加知识节点弹窗
function AddNodeModal({
  skin,
  onClose,
  onSubmit,
}: {
  skin: typeof NO_SKIN;
  onClose: () => void;
  onSubmit: (type: KnowledgeNode["type"], title: string, content: string) => void;
}) {
  const [type, setType] = useState<KnowledgeNode["type"]>("fruit");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const typeLabels = [
    { key: "fruit", label: "果实", desc: "成果收获" },
    { key: "leaf", label: "树叶", desc: "具体执行" },
    { key: "branch", label: "树枝", desc: "实现路径" },
    { key: "trunk", label: "树干", desc: "核心目标" },
    { key: "root", label: "树根", desc: "底层认知" },
  ];

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-6 w-96"
        style={{ backgroundColor: skin.panelBg, border: `1px solid ${skin.divider}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-4" style={{ color: skin.textPrimary }}>
          添加知识
        </h3>

        {/* 类型选择 */}
        <div className="flex flex-wrap gap-2 mb-4">
          {typeLabels.map((t) => (
            <button
              key={t.key}
              onClick={() => setType(t.key as KnowledgeNode["type"])}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{
                backgroundColor: type === t.key ? skin.swatch + "20" : skin.divider + "40",
                color: type === t.key ? skin.swatch : skin.textSecondary,
                border: type === t.key ? `1px solid ${skin.swatch}40` : "1px solid transparent",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题"
          className="w-full px-3 py-2 rounded-lg mb-3"
          style={{
            backgroundColor: skin.cardBg,
            color: skin.textPrimary,
            border: `1px solid ${skin.divider}`,
          }}
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="内容描述"
          className="w-full px-3 py-2 rounded-lg mb-4 resize-none"
          rows={3}
          style={{
            backgroundColor: skin.cardBg,
            color: skin.textPrimary,
            border: `1px solid ${skin.divider}`,
          }}
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg"
            style={{ color: skin.textSecondary, backgroundColor: skin.divider + "40" }}
          >
            取消
          </button>
          <button
            onClick={() => title && onSubmit(type, title, content)}
            className="flex-1 py-2 rounded-lg"
            style={{ backgroundColor: skin.swatch, color: "#fff" }}
          >
            添加
          </button>
        </div>
      </div>
    </div>
  );
}

// 添加书签弹窗
function AddBookmarkModal({
  skin,
  onClose,
  onSubmit,
}: {
  skin: typeof NO_SKIN;
  onClose: () => void;
  onSubmit: (name: string, url: string) => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-6 w-80"
        style={{ backgroundColor: skin.panelBg, border: `1px solid ${skin.divider}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-4" style={{ color: skin.textPrimary }}>
          添加朋友
        </h3>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="名称"
          className="w-full px-3 py-2 rounded-lg mb-3"
          style={{
            backgroundColor: skin.cardBg,
            color: skin.textPrimary,
            border: `1px solid ${skin.divider}`,
          }}
        />
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="网址"
          className="w-full px-3 py-2 rounded-lg mb-4"
          style={{
            backgroundColor: skin.cardBg,
            color: skin.textPrimary,
            border: `1px solid ${skin.divider}`,
          }}
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg"
            style={{ color: skin.textSecondary, backgroundColor: skin.divider + "40" }}
          >
            取消
          </button>
          <button
            onClick={() => name && url && onSubmit(name, url)}
            className="flex-1 py-2 rounded-lg"
            style={{ backgroundColor: skin.swatch, color: "#fff" }}
          >
            添加
          </button>
        </div>
      </div>
    </div>
  );
}