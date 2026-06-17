"use client";

/**
 * KnowledgePanel - 知识森林主入口
 *
 * 视觉：参考蚂蚁森林 - 全景森林 + 树木成长阶段 + 好友森林
 * 数据：保留所有 localStorage 字段（knowledge-trees / knowledge-bookmarks）
 *      5 种知识类型（root/trunk/branch/leaf/fruit）保持兼容
 */

import { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Trees,
  Users,
  X,
  Sparkles,
} from "lucide-react";
import type { SkinTheme } from "@/lib/skins";
import ForestScene, { type ForestItem } from "./forest/forest-scene";
import TreeCloseup, { TREE_NODE_TYPE_INFO, type NodeType } from "./forest/tree-closeup";
import FriendsForest from "./forest/friends-forest";

// === 数据类型（保持兼容）===

export interface KnowledgePanelProps {
  open: boolean;
  onClose: () => void;
  skin: SkinTheme;
}

export interface KnowledgeNode {
  id: string;
  type: "root" | "trunk" | "branch" | "leaf" | "fruit";
  title: string;
  content: string;
  source?: string;
  createdAt: number;
}

export interface KnowledgeTree {
  id: string;
  name: string;
  industry: string;
  description: string;
  nodes: KnowledgeNode[];
  createdAt: number;
}

export interface Bookmark {
  id: string;
  name: string;
  url: string;
  type: "bookmark";
}

// === 工具：聚合节点按类型 ===
function groupNodesByType(nodes: KnowledgeNode[]) {
  return nodes.reduce((acc, n) => {
    if (!acc[n.type]) acc[n.type] = [];
    acc[n.type].push(n);
    return acc;
  }, {} as Record<string, KnowledgeNode[]>);
}

// === 主组件 ===
export default function KnowledgePanel({ open, onClose, skin }: KnowledgePanelProps) {
  const [activeTab, setActiveTab] = useState<"my" | "friends">("my");
  const [trees, setTrees] = useState<KnowledgeTree[]>([]);
  const [selectedTree, setSelectedTree] = useState<KnowledgeTree | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  // 弹窗状态
  const [showAddTree, setShowAddTree] = useState(false);
  const [showAddNode, setShowAddNode] = useState<NodeType | null>(null);
  const [showAddBookmark, setShowAddBookmark] = useState(false);

  // 表单状态
  const [newTree, setNewTree] = useState({ name: "", industry: "", description: "" });
  const [newNode, setNewNode] = useState<{
    type: NodeType;
    title: string;
    content: string;
    source: string;
  }>({ type: "leaf", title: "", content: "", source: "" });
  const [newBookmark, setNewBookmark] = useState({ name: "", url: "" });

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 加载数据
  useEffect(() => {
    if (!mounted) return;
    try {
      const savedTrees = localStorage.getItem("knowledge-trees");
      if (savedTrees) {
        const parsed = JSON.parse(savedTrees);
        if (Array.isArray(parsed)) {
          setTrees(
            parsed.map((t: KnowledgeTree) => ({
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

  // 持久化
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

  // 当删除最后一棵树时，清理 localStorage 空数组
  useEffect(() => {
    if (mounted && trees.length === 0) {
      localStorage.removeItem("knowledge-trees");
    }
  }, [trees, mounted]);

  // === 操作函数 ===

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
    if (!confirm("确定移除这棵树吗？所有知识将一并消失。")) return;
    const next = trees.filter((t) => t.id !== id);
    setTrees(next);
    if (selectedTree?.id === id) {
      setSelectedTree(null);
    }
    if (next.length === 0) {
      localStorage.removeItem("knowledge-trees");
    }
  };

  const handleAddNode = () => {
    if (!selectedTree || !newNode.title.trim()) return;
    const node: KnowledgeNode = {
      id: `node-${Date.now()}`,
      type: newNode.type,
      title: newNode.title,
      content: newNode.content,
      source: newNode.source || undefined,
      createdAt: Date.now(),
    };
    const updatedTree: KnowledgeTree = {
      ...selectedTree,
      nodes: [...selectedTree.nodes, node],
    };
    setSelectedTree(updatedTree);
    setTrees(trees.map((t) => (t.id === selectedTree.id ? updatedTree : t)));
    setNewNode({ type: showAddNode || "leaf", title: "", content: "", source: "" });
    setShowAddNode(null);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!selectedTree) return;
    if (!confirm("确定删除这个知识吗？")) return;
    const updatedTree: KnowledgeTree = {
      ...selectedTree,
      nodes: selectedTree.nodes.filter((n) => n.id !== nodeId),
    };
    setSelectedTree(updatedTree);
    setTrees(trees.map((t) => (t.id === selectedTree.id ? updatedTree : t)));
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
    if (!confirm("确定移除这位朋友吗？")) return;
    const next = bookmarks.filter((b) => b.id !== id);
    setBookmarks(next);
    if (next.length === 0) {
      localStorage.removeItem("knowledge-bookmarks");
    }
  };

  // === 计算森林数据 ===
  const forestItems: ForestItem[] = useMemo(
    () =>
      trees.map((t) => ({
        id: t.id,
        name: t.name,
        count: t.nodes.length,
      })),
    [trees]
  );

  // 统计数据
  const stats = useMemo(() => {
    const totalNodes = trees.reduce((sum, t) => sum + t.nodes.length, 0);
    const tier = (c: number) =>
      c === 0 ? 0 : c <= 2 ? 1 : c <= 7 ? 2 : c <= 15 ? 3 : c <= 30 ? 4 : 5;
    const highestTier = trees.reduce((max, t) => Math.max(max, tier(t.nodes.length)), 0);
    const labels = ["空地", "幼苗", "小树", "成树", "参天", "古木"];
    // 本月新增
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    const newThisMonth = trees.filter((t) => {
      const d = new Date(t.createdAt);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length;
    return {
      totalTrees: trees.length,
      totalNodes,
      highestTier,
      highestLabel: labels[highestTier],
      newThisMonth,
    };
  }, [trees]);

  const selectedNodesByType = useMemo(
    () => (selectedTree ? groupNodesByType(selectedTree.nodes) : {}),
    [selectedTree]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      style={{ background: skin.panelBg }}
    >
      {/* 主容器 */}
      <div className="w-full h-full flex flex-col overflow-hidden">
        {/* 顶部标题栏 */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{
            borderColor: skin.divider,
            background: `linear-gradient(90deg, ${skin.swatch}08 0%, transparent 60%)`,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: `radial-gradient(circle at 30% 30%, ${skin.swatch}55, ${skin.swatch} 100%)`,
                boxShadow: `0 4px 12px ${skin.swatch}44`,
              }}
            >
              <Trees size={20} color="#fff" strokeWidth={2} />
            </div>
            <div>
              <h1
                className="text-xl font-semibold leading-tight"
                style={{
                  color: skin.textPrimary,
                  fontFamily: "var(--font-serif)",
                  letterSpacing: "0.02em",
                }}
              >
                知识森林
              </h1>
              <div
                className="text-[11px] tracking-widest uppercase"
                style={{ color: skin.textMuted }}
              >
                Knowledge Forest
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:rotate-90"
            style={{
              background: skin.cardBg,
              color: skin.textPrimary,
              border: `1px solid ${skin.divider}`,
            }}
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab 切换 */}
        <div
          className="flex border-b pr-4"
          style={{ borderColor: skin.divider }}
        >
          <TabButton
            active={activeTab === "my"}
            onClick={() => {
              setActiveTab("my");
              setSelectedTree(null);
            }}
            skin={skin}
            icon={<Trees size={14} />}
            label="我的森林"
            subLabel={`${stats.totalTrees} 棵`}
          />
          <TabButton
            active={activeTab === "friends"}
            onClick={() => {
              setActiveTab("friends");
              setSelectedTree(null);
            }}
            skin={skin}
            icon={<Users size={14} />}
            label="好友森林"
            subLabel={`${bookmarks.length} 位`}
          />
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "my" && !selectedTree && (
            <MyForestView
              trees={trees}
              forestItems={forestItems}
              stats={stats}
              onSelectTree={(id) => {
                const t = trees.find((x) => x.id === id);
                if (t) setSelectedTree(t);
              }}
              onAddTree={() => setShowAddTree(true)}
              onDeleteTree={handleDeleteTree}
              skin={skin}
            />
          )}

          {activeTab === "my" && selectedTree && (
            <TreeCloseup
              tree={selectedTree}
              nodesByType={selectedNodesByType}
              onBack={() => setSelectedTree(null)}
              onAddNode={() => setShowAddNode("leaf")}
              onAddTypeNode={(type) => setShowAddNode(type)}
              onDeleteNode={handleDeleteNode}
              skin={skin}
            />
          )}

          {activeTab === "friends" && (
            <FriendsForest
              bookmarks={bookmarks}
              onAdd={() => setShowAddBookmark(true)}
              onDelete={handleDeleteBookmark}
              skin={skin}
            />
          )}
        </div>
      </div>

      {/* === 弹窗 === */}

      {showAddTree && (
        <Modal title="种一棵新树" onClose={() => setShowAddTree(false)} skin={skin} icon={<Sparkles size={16} />}>
          <div className="space-y-3">
            <Input
              label="树的名称"
              value={newTree.name}
              onChange={(v) => setNewTree({ ...newTree, name: v })}
              placeholder="如：技术成长"
              skin={skin}
            />
            <Input
              label="领域/行业"
              value={newTree.industry}
              onChange={(v) => setNewTree({ ...newTree, industry: v })}
              placeholder="如：互联网、AI..."
              skin={skin}
            />
            <Textarea
              label="描述"
              value={newTree.description}
              onChange={(v) => setNewTree({ ...newTree, description: v })}
              placeholder="一句话描述这棵树要承载的方向"
              skin={skin}
            />
            <div className="flex gap-2 justify-end pt-2">
              <Button onClick={() => setShowAddTree(false)} variant="ghost" skin={skin}>
                取消
              </Button>
              <Button onClick={handleAddTree} skin={skin}>
                种下这棵树
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {showAddNode && selectedTree && (() => {
        const NodeIcon = TREE_NODE_TYPE_INFO[showAddNode].Icon;
        return (
        <Modal
          title={`添加${TREE_NODE_TYPE_INFO[showAddNode].label}`}
          onClose={() => setShowAddNode(null)}
          skin={skin}
          icon={<NodeIcon size={16} />}
        >
          <div className="space-y-3">
            <div>
              <label
                className="text-xs mb-1.5 block tracking-wider uppercase"
                style={{ color: skin.textMuted }}
              >
                知识类型
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {(Object.keys(TREE_NODE_TYPE_INFO) as NodeType[]).map((key) => {
                  const info = TREE_NODE_TYPE_INFO[key];
                  const isActive = showAddNode === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setNewNode({ ...newNode, type: key })}
                      className="p-2 rounded text-xs transition-all"
                      style={{
                        background: isActive ? skin.swatch : "transparent",
                        color: isActive ? "#fff" : skin.textPrimary,
                        border: `1px solid ${isActive ? skin.swatch : skin.divider}`,
                      }}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <info.Icon size={14} />
                        <span>{info.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <Input
              label="标题"
              value={newNode.title}
              onChange={(v) => setNewNode({ ...newNode, title: v })}
              placeholder="一句话标题"
              skin={skin}
            />
            <Textarea
              label="内容"
              value={newNode.content}
              onChange={(v) => setNewNode({ ...newNode, content: v })}
              placeholder="详细描述..."
              skin={skin}
            />
            <Input
              label="来源（可选）"
              value={newNode.source}
              onChange={(v) => setNewNode({ ...newNode, source: v })}
              placeholder="文章链接、书名等"
              skin={skin}
            />
            <div className="flex gap-2 justify-end pt-2">
              <Button onClick={() => setShowAddNode(null)} variant="ghost" skin={skin}>
                取消
              </Button>
              <Button onClick={handleAddNode} skin={skin}>
                添加
              </Button>
            </div>
          </div>
        </Modal>
        );
      })()}

      {showAddBookmark && (
        <Modal title="邀请一位朋友" onClose={() => setShowAddBookmark(false)} skin={skin} icon={<Users size={16} />}>
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
                邀请
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}

// === 子组件 ===

/** Tab 按钮 */
function TabButton({
  active,
  onClick,
  icon,
  label,
  subLabel,
  skin,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  subLabel: string;
  skin: SkinTheme;
}) {
  return (
    <button
      onClick={onClick}
      className="relative px-6 py-3 transition-colors flex items-center gap-2"
      style={{
        color: active ? skin.swatch : skin.textSecondary,
        borderBottom: active ? `2px solid ${skin.swatch}` : "2px solid transparent",
      }}
    >
      <span style={{ opacity: active ? 1 : 0.6 }}>{icon}</span>
      <span className="font-medium">{label}</span>
      <span
        className="text-[10px] px-1.5 py-0.5 rounded-full font-mono"
        style={{
          background: active ? `${skin.swatch}20` : `${skin.textMuted}20`,
          color: active ? skin.swatch : skin.textMuted,
        }}
      >
        {subLabel}
      </span>
    </button>
  );
}

/** 我的森林主视图（森林全景 + 统计 + 列表） */
function MyForestView({
  trees,
  forestItems,
  stats,
  onSelectTree,
  onAddTree,
  onDeleteTree,
  skin,
}: {
  trees: KnowledgeTree[];
  forestItems: ForestItem[];
  stats: { totalTrees: number; totalNodes: number; highestTier: number; highestLabel: string; newThisMonth: number };
  onSelectTree: (id: string) => void;
  onAddTree: () => void;
  onDeleteTree: (id: string) => void;
  skin: SkinTheme;
}) {
  return (
    <div className="space-y-5">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="树木" value={stats.totalTrees} unit="棵" skin={skin} icon={<Trees size={14} />} />
        <StatCard label="知识" value={stats.totalNodes} unit="个" skin={skin} icon={<Sparkles size={14} />} />
        <StatCard
          label="最高阶段"
          value={stats.highestLabel}
          unit=""
          skin={skin}
          mono={false}
        />
        <StatCard label="本月新种" value={stats.newThisMonth} unit="棵" skin={skin} icon={<Plus size={14} />} />
      </div>

      {/* 森林全景 */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <div
            className="text-xs tracking-widest uppercase flex items-center gap-1.5"
            style={{ color: skin.textMuted }}
          >
            <Trees size={12} />
            Forest Panorama
          </div>
          <div
            className="text-[10px]"
            style={{ color: skin.textMuted }}
          >
            点击树木查看图鉴
          </div>
        </div>
        <ForestScene
          items={forestItems}
          skin={skin}
          height={400}
          variant="my"
          onItemClick={onSelectTree}
        />
      </div>

      {/* 树木列表 */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div
            className="text-xs tracking-widest uppercase flex items-center gap-1.5"
            style={{ color: skin.textMuted }}
          >
            <Sparkles size={12} />
            My Trees
          </div>
          <button
            onClick={onAddTree}
            className="text-xs px-3 py-1.5 rounded-full flex items-center gap-1 transition-transform hover:scale-105"
            style={{
              background: skin.swatch,
              color: "#fff",
            }}
          >
            <Plus size={12} />
            种新树
          </button>
        </div>

        {trees.length === 0 ? (
          <div
            className="p-10 rounded-lg text-center"
            style={{
              background: `linear-gradient(135deg, ${skin.swatch}08, ${skin.swatch}04)`,
              border: `1px dashed ${skin.swatch}40`,
            }}
          >
            <div
              className="text-base font-medium mb-1"
              style={{
                color: skin.textPrimary,
                fontFamily: "var(--font-serif)",
              }}
            >
              森林还在等待第一位园丁
            </div>
            <div className="text-xs" style={{ color: skin.textSecondary }}>
              点一下「种新树」，把你想探索的方向变成一片小树
            </div>
            <button
              onClick={onAddTree}
              className="mt-4 px-4 py-2 rounded-full inline-flex items-center gap-1.5 text-sm font-medium"
              style={{ background: skin.swatch, color: "#fff" }}
            >
              <Plus size={14} />
              种下第一棵树
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {trees.map((tree) => (
              <TreeCard
                key={tree.id}
                tree={tree}
                onSelect={() => onSelectTree(tree.id)}
                onDelete={() => onDeleteTree(tree.id)}
                skin={skin}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** 统计卡片 */
function StatCard({
  label,
  value,
  unit,
  skin,
  icon,
  mono = true,
}: {
  label: string;
  value: string | number;
  unit: string;
  skin: SkinTheme;
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      className="p-3 rounded-lg relative overflow-hidden"
      style={{
        background: skin.cardBg,
        border: `1px solid ${skin.divider}`,
      }}
    >
      <div
        className="absolute top-2 right-2 opacity-20"
        style={{ color: skin.swatch }}
      >
        {icon}
      </div>
      <div
        className="text-[10px] tracking-widest uppercase mb-1"
        style={{ color: skin.textMuted }}
      >
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className="text-2xl font-semibold leading-none"
          style={{
            color: skin.textPrimary,
            fontFamily: mono ? "var(--font-mono)" : "var(--font-serif)",
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            className="text-xs"
            style={{ color: skin.textSecondary }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

/** 树木卡片（紧凑） */
function TreeCard({
  tree,
  onSelect,
  onDelete,
  skin,
}: {
  tree: KnowledgeTree;
  onSelect: () => void;
  onDelete: () => void;
  skin: SkinTheme;
}) {
  const count = tree.nodes.length;
  const stage =
    count === 0
      ? { label: "空地", size: 0 }
      : count <= 2
      ? { label: "幼苗", size: 1 }
      : count <= 7
      ? { label: "小树", size: 2 }
      : count <= 15
      ? { label: "成树", size: 3 }
      : count <= 30
      ? { label: "参天", size: 4 }
      : { label: "古木", size: 5 };

  const sizes = [40, 50, 60, 70, 78, 86];
  const treeH = sizes[stage.size];

  return (
    <div
      className="group relative p-3 rounded-lg cursor-pointer transition-all hover:scale-[1.03] flex flex-col"
      style={{
        background: skin.cardBg,
        border: `1px solid ${skin.divider}`,
      }}
      onClick={onSelect}
    >
      {/* 删除按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
        style={{
          background: "rgba(239,68,68,0.1)",
          color: "#ef4444",
        }}
        title="移除"
      >
        <X size={11} />
      </button>

      {/* 树形（居中） */}
      <div
        className="relative mx-auto mb-2 flex items-end justify-center"
        style={{ height: treeH, width: 70 }}
      >
        {/* 树干 */}
        {stage.size > 0 && (
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              bottom: 0,
              width: Math.max(3, stage.size * 1.2),
              height: treeH * 0.3,
              background: "linear-gradient(90deg, #4a2f1a 0%, #6B4423 50%, #4a2f1a 100%)",
              borderRadius: "1px 1px 0 0",
            }}
          />
        )}
        {/* 树冠 */}
        {stage.size > 0 ? (
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              bottom: treeH * 0.2,
              width: treeH * 0.7,
              height: treeH * 0.7,
              background: `radial-gradient(circle at 35% 30%, ${skin.swatch}55 0%, ${skin.swatch} 100%)`,
              borderRadius: "50%",
              boxShadow: `0 2px 6px ${skin.swatch}44`,
            }}
          />
        ) : (
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              bottom: 0,
              width: 16,
              height: 12,
              background: "#6B4423",
              borderRadius: "2px",
            }}
          />
        )}
        {/* 数量徽章 */}
        <div
          className="absolute -top-1 right-2 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold"
          style={{
            background: skin.swatch,
            color: "#fff",
          }}
        >
          {count}
        </div>
      </div>

      {/* 名称 */}
      <div
        className="text-sm font-medium truncate text-center"
        style={{ color: skin.textPrimary }}
      >
        {tree.name}
      </div>
      {/* 阶段标签 */}
      <div
        className="text-[10px] text-center mt-0.5 tracking-wider"
        style={{ color: skin.swatch }}
      >
        {stage.label}
      </div>
      {/* 行业 */}
      {tree.industry && (
        <div
          className="text-[10px] text-center mt-0.5 truncate"
          style={{ color: skin.textMuted }}
        >
          {tree.industry}
        </div>
      )}
    </div>
  );
}

/** 输入框 */
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
  skin: SkinTheme;
}) {
  return (
    <div>
      <label
        className="text-xs mb-1.5 block tracking-wider uppercase"
        style={{ color: skin.textMuted }}
      >
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full p-2.5 rounded text-sm outline-none transition-all"
        style={{
          background: skin.cardBg,
          color: skin.textPrimary,
          border: `1px solid ${skin.divider}`,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = skin.swatch;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = skin.divider;
        }}
      />
    </div>
  );
}

/** 多行输入 */
function Textarea({
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
  skin: SkinTheme;
}) {
  return (
    <div>
      <label
        className="text-xs mb-1.5 block tracking-wider uppercase"
        style={{ color: skin.textMuted }}
      >
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full p-2.5 rounded text-sm min-h-[88px] outline-none transition-all resize-y"
        style={{
          background: skin.cardBg,
          color: skin.textPrimary,
          border: `1px solid ${skin.divider}`,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = skin.swatch;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = skin.divider;
        }}
      />
    </div>
  );
}

/** 按钮 */
function Button({
  onClick,
  children,
  variant = "primary",
  skin,
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "primary" | "ghost";
  skin: SkinTheme;
}) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded text-sm transition-all hover:scale-105"
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

/** 模态框 */
function Modal({
  title,
  onClose,
  children,
  skin,
  icon,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  skin: SkinTheme;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md p-5 rounded-lg"
        style={{
          background: skin.panelBg,
          color: skin.textPrimary,
          boxShadow: "0 20px 50px -10px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3
            className="text-base font-semibold flex items-center gap-2"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {icon && (
              <span style={{ color: skin.swatch }}>{icon}</span>
            )}
            {title}
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: skin.cardBg, color: skin.textSecondary }}
          >
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
