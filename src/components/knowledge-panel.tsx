"use client";

/**
 * KnowledgePanel - 知识森林主入口
 *
 * 视觉：参考蚂蚁森林 - 全景森林 + 树木成长阶段 + 好友森林
 * 数据：保留所有 localStorage 字段（knowledge-trees / knowledge-bookmarks）
 *      5 种知识类型（root/trunk/branch/leaf/fruit）保持兼容
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus,
  Trees,
  Users,
  X,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { SkinTheme } from "@/lib/skins";
import ForestScene, { type ForestItem } from "./forest/forest-scene";
import TreeCloseup, { TREE_NODE_TYPE_INFO, type NodeType } from "./forest/tree-closeup";
import FriendsForest from "./forest/friends-forest";
import { TREE_SPECIES, SpeciesPreview, type TreeSpeciesId } from "./forest/tree-species";

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
  species?: TreeSpeciesId;
  nodes: KnowledgeNode[];
  createdAt: number;
  /** 可选：自定义画布位置（拖拽后的位置，百分比 0-100） */
  position?: { x: number; y: number };
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
  const [pendingDeleteTreeId, setPendingDeleteTreeId] = useState<string | null>(null);

  // 表单状态
  const [newTree, setNewTree] = useState<{ name: string; industry: string; description: string; species: TreeSpeciesId }>({ name: "", industry: "", description: "", species: "oak" });
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
    const now = Date.now();
    const treeId = `tree-${now}`;
    // 每棵新树都先种下 5 个"地基"节点（根/干/枝/叶/果 各一），让树一落地便茁壮
    const baseNodes: KnowledgeNode[] = [
      { id: `${treeId}-root`, type: "root", title: `${newTree.name} · 根`, content: "底层认知与核心原理", createdAt: now },
      { id: `${treeId}-trunk`, type: "trunk", title: `${newTree.name} · 干`, content: "核心目标与方向", createdAt: now + 1 },
      { id: `${treeId}-branch`, type: "branch", title: `${newTree.name} · 枝`, content: "实现路径与方法", createdAt: now + 2 },
      { id: `${treeId}-leaf`, type: "leaf", title: `${newTree.name} · 叶`, content: "具体执行与碎片知识", createdAt: now + 3 },
      { id: `${treeId}-fruit`, type: "fruit", title: `${newTree.name} · 果`, content: "成果产出与价值兑现", createdAt: now + 4 },
    ];
    const tree: KnowledgeTree = {
      id: treeId,
      name: newTree.name,
      industry: newTree.industry || newTree.name,
      description: newTree.description,
      species: newTree.species,
      nodes: baseNodes,
      createdAt: now,
    };
    setTrees([...trees, tree]);
    setNewTree({ name: "", industry: "", description: "", species: "oak" });
    setShowAddTree(false);
  };

  const handleDeleteTree = (id: string) => {
    // 触发 Modal 确认
    setPendingDeleteTreeId(id);
  };

  const confirmDeleteTree = () => {
    if (!pendingDeleteTreeId) return;
    const id = pendingDeleteTreeId;
    const next = trees.filter((t) => t.id !== id);
    setTrees(next);
    if (selectedTree?.id === id) {
      setSelectedTree(null);
    }
    if (next.length === 0) {
      localStorage.removeItem("knowledge-trees");
    }
    setPendingDeleteTreeId(null);
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
        species: t.species,
        position: t.position,
      })),
    [trees]
  );

  // 拖拽结束：更新单棵树位置并持久化
  const handleTreePositionChange = useCallback(
    (id: string, position: { x: number; y: number }) => {
      setTrees((prev) =>
        prev.map((t) => (t.id === id ? { ...t, position } : t))
      );
    },
    []
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
        <div className="flex-1 overflow-hidden">
          {activeTab === "my" && !selectedTree && (
            <MyForestView
              forestItems={forestItems}
              totalNodes={stats.totalNodes}
              totalTrees={stats.totalTrees}
              onSelectTree={(id) => {
                const t = trees.find((x) => x.id === id);
                if (t) setSelectedTree(t);
              }}
              onAddTree={() => setShowAddTree(true)}
              onDeleteTree={setPendingDeleteTreeId}
              onTreePositionChange={handleTreePositionChange}
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
            <div>
              <label
                className="text-xs mb-1.5 block tracking-wider uppercase"
                style={{ color: skin.textMuted }}
              >
                树种
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(TREE_SPECIES) as TreeSpeciesId[]).map((key) => {
                  const info = TREE_SPECIES[key];
                  const isActive = newTree.species === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setNewTree({ ...newTree, species: key })}
                      className="rounded-lg p-2.5 flex flex-col items-center gap-1 transition-all hover:scale-[1.02]"
                      style={{
                        background: isActive ? skin.swatch + "20" : skin.cardBg,
                        border: isActive ? `1.5px solid ${skin.swatch}` : `1px solid ${skin.divider}`,
                      }}
                    >
                      <SpeciesPreview species={key} />
                      <div className="text-xs font-medium" style={{ color: skin.textPrimary }}>
                        {info.name}
                      </div>
                      <div className="text-[10px] leading-tight text-center opacity-70" style={{ color: skin.textMuted }}>
                        {info.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
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

      {/* 删除树确认 */}
      {pendingDeleteTreeId && (
        <Modal
          title="拔除这棵树"
          onClose={() => setPendingDeleteTreeId(null)}
          skin={skin}
          icon={<Trash2 size={16} />}
        >
          <div className="space-y-4">
            <p className="text-sm leading-relaxed" style={{ color: skin.textPrimary }}>
              确定要拔除「
              <span style={{ color: skin.swatch, fontWeight: 600 }}>
                {trees.find((t) => t.id === pendingDeleteTreeId)?.name ?? ""}
              </span>
              」吗？此操作不可恢复，树上所有的知识节点会一并消失。
            </p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setPendingDeleteTreeId(null)} variant="ghost" skin={skin}>
                取消
              </Button>
              <Button onClick={confirmDeleteTree} variant="danger" skin={skin}>
                拔除
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

/** 我的森林主视图：森林全景铺满整个内容区 + 统计 chip + 种新树入口 */
function MyForestView({
  forestItems,
  totalNodes,
  totalTrees,
  onSelectTree,
  onAddTree,
  onDeleteTree,
  onTreePositionChange,
  skin,
}: {
  forestItems: ForestItem[];
  totalNodes: number;
  totalTrees: number;
  onSelectTree: (id: string) => void;
  onAddTree: () => void;
  onDeleteTree: (id: string) => void;
  onTreePositionChange: (id: string, position: { x: number; y: number }) => void;
  skin: SkinTheme;
}) {
  return (
    <div className="relative h-full">
      {/* 森林全景：铺满整个详情页 */}
      <ForestScene
        items={forestItems}
        skin={skin}
        variant="my"
        onItemClick={onSelectTree}
        onItemDelete={onDeleteTree}
        onItemPositionChange={onTreePositionChange}
        fillHeight
      />

      {/* 左上角统计 chip（玻璃拟态） */}
      <div
        className="absolute top-4 left-4 z-10 flex items-center gap-3 px-3.5 py-2 rounded-full"
        style={{
          background: "rgba(255,255,255,0.78)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: `1px solid ${skin.divider}`,
          boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
        }}
      >
        <div className="flex items-center gap-1.5">
          <Trees size={14} style={{ color: skin.swatch }} />
          <span
            className="font-mono font-semibold text-sm tabular-nums"
            style={{ color: skin.textPrimary }}
          >
            {totalTrees}
          </span>
          <span
            className="text-[11px] tracking-wide"
            style={{ color: skin.textMuted }}
          >
            棵
          </span>
        </div>
        <div className="w-px h-3.5" style={{ background: skin.divider }} />
        <div className="flex items-center gap-1.5">
          <Sparkles size={14} style={{ color: skin.swatch }} />
          <span
            className="font-mono font-semibold text-sm tabular-nums"
            style={{ color: skin.textPrimary }}
          >
            {totalNodes}
          </span>
          <span
            className="text-[11px] tracking-wide"
            style={{ color: skin.textMuted }}
          >
            个
          </span>
        </div>
      </div>

      {/* 右下角"种新树"按钮 */}
      <button
        onClick={onAddTree}
        className="absolute bottom-6 right-6 z-10 flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-medium transition-all hover:scale-105 active:scale-95"
        style={{
          background: skin.swatch,
          color: "#fff",
          boxShadow: `0 8px 24px ${skin.swatch}55`,
        }}
      >
        <Plus size={14} />
        种新树
      </button>
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
  variant?: "primary" | "ghost" | "danger";
  skin: SkinTheme;
}) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded text-sm transition-all hover:scale-105"
      style={{
        background: isPrimary
          ? skin.swatch
          : isDanger
            ? "#dc2626"
            : "transparent",
        color: isPrimary || isDanger ? "#fff" : skin.textPrimary,
        border: isPrimary || isDanger ? "none" : `1px solid ${skin.divider}`,
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
