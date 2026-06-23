"use client";

/**
 * KnowledgePanel - 知识森林主入口
 *
 * 视觉：参考蚂蚁森林 - 全景森林 + 树木成长阶段 + 好友森林
 * 数据：保留所有 localStorage 字段（knowledge-trees / knowledge-bookmarks）
 *      5 种知识类型（root/trunk/branch/leaf/fruit）保持兼容
 */

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Plus,
  Trees,
  X,
  Sparkles,
  Trash2,
  ChevronDown,
  ChevronRight,
  Crosshair,
  RefreshCw,
  TreePine,
  TreeDeciduous,
  Sprout,
  Folder,
  File,
  Leaf,
  Apple,
  GitBranch,
  Layers,
  Target,
  Search,
  Award,
  Link as LinkIcon,
  ExternalLink,
  Pencil,
} from "lucide-react";
import type { SkinTheme } from "@/lib/skins";
import ForestScene, { type ForestItem } from "./forest/forest-scene";
import TreeCloseup, { TREE_NODE_TYPE_INFO, type NodeType } from "./forest/tree-closeup";
import { TREE_SPECIES, SpeciesPreview, type TreeSpeciesId } from "./forest/tree-species";
import { IframeControls } from "./forest/iframe-controls";

// === 数据类型（保持兼容）===

/** 树阶段（与 forest-scene.tsx 中的 getStage 保持一致） */
function getStage(count: number) {
  if (count === 0) return { tier: 0, label: "空地", size: 0 };
  if (count <= 2) return { tier: 1, label: "幼苗", size: 1 };
  if (count <= 7) return { tier: 2, label: "小树", size: 2 };
  if (count <= 15) return { tier: 3, label: "成树", size: 3 };
  if (count <= 30) return { tier: 4, label: "参天", size: 4 };
  return { tier: 5, label: "古木", size: 5 };
}

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
  /** 可选：自定义缩放（滚轮放大缩小，默认 1） */
  scale?: number;
  /** 可选：自定义链接。设置后点击树直接打开此链接（不再进入知识库） */
  link?: string;
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
  const [trees, setTrees] = useState<KnowledgeTree[]>([]);
  const [selectedTree, setSelectedTree] = useState<KnowledgeTree | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  // 弹窗状态
  const [showAddTree, setShowAddTree] = useState(false);
  const [showAddNode, setShowAddNode] = useState<NodeType | null>(null);
  const [pendingDeleteTreeId, setPendingDeleteTreeId] = useState<string | null>(null);
  // 树编辑弹窗
  const [editingTree, setEditingTree] = useState<KnowledgeTree | null>(null);
  const [showEditTree, setShowEditTree] = useState(false);

  // 表单状态
  const [newTree, setNewTree] = useState<{ name: string; industry: string; description: string; species: TreeSpeciesId; link: string }>({ name: "", industry: "", description: "", species: "oak", link: "" });
  const [editForm, setEditForm] = useState<{ name: string; industry: string; description: string; species: TreeSpeciesId; link: string }>({ name: "", industry: "", description: "", species: "oak", link: "" });
  const [newNode, setNewNode] = useState<{
    type: NodeType;
    title: string;
    content: string;
    source: string;
  }>({ type: "leaf", title: "", content: "", source: "" });

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
      // 新树默认种在画布逻辑中心 (50, 50)，pan 复位时正好在可视区中央
      position: { x: 50, y: 50 },
      // 可选链接（如未填写则为 undefined，便于判断）
      ...(newTree.link.trim() ? { link: newTree.link.trim() } : {}),
    };
    setTrees([...trees, tree]);
    setNewTree({ name: "", industry: "", description: "", species: "oak", link: "" });
    setShowAddTree(false);
  };

  const handleDeleteTree = (id: string) => {
    // 触发 Modal 确认
    setPendingDeleteTreeId(id);
  };

  // 打开编辑弹窗，并把当前值填入表单
  const handleEditTree = (id: string) => {
    const t = trees.find((x) => x.id === id);
    if (!t) return;
    setEditingTree(t);
    setEditForm({
      name: t.name,
      industry: t.industry,
      description: t.description,
      species: t.species ?? "oak",
      link: t.link ?? "",
    });
    setShowEditTree(true);
  };

  // 保存编辑：保留 id / nodes / position / scale / createdAt 等结构字段，只更新可见字段
  const handleSaveEdit = () => {
    if (!editingTree) return;
    const name = editForm.name.trim();
    if (!name) return;
    setTrees((prev) =>
      prev.map((t) =>
        t.id === editingTree.id
          ? {
              ...t,
              name,
              industry: editForm.industry.trim() || name,
              description: editForm.description,
              species: editForm.species,
              ...(editForm.link.trim() ? { link: editForm.link.trim() } : { link: undefined }),
            }
          : t
      )
    );
    // 如果当前正选中这棵树，同步更新 selectedTree 引用，避免知识库视图渲染旧值
    if (selectedTree && selectedTree.id === editingTree.id) {
      setSelectedTree((prev) =>
        prev && prev.id === editingTree.id
          ? {
              ...prev,
              name,
              industry: editForm.industry.trim() || name,
              description: editForm.description,
              species: editForm.species,
              ...(editForm.link.trim() ? { link: editForm.link.trim() } : { link: undefined }),
            }
          : prev
      );
    }
    setShowEditTree(false);
    setEditingTree(null);
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

  // === 计算森林数据 ===
  const forestItems: ForestItem[] = useMemo(
    () =>
      trees.map((t) => ({
        id: t.id,
        name: t.name,
        count: t.nodes.length,
        species: t.species,
        position: t.position,
        scale: t.scale,
        nodes: t.nodes,
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

  const handleTreeScaleChange = useCallback(
    (id: string, scale: number) => {
      setTrees((prev) =>
        prev.map((t) => (t.id === id ? { ...t, scale } : t))
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
        {/* 顶部标题栏 - 进入详情页时隐藏 */}
        {!selectedTree && (
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
        )}

        {/* 内容区：直接渲染树视图（已去掉 OS / 好友森林 tab） */}
        <div className="flex-1" style={{ overflow: "visible" }}>
          {!selectedTree && (
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
              onEditTree={handleEditTree}
              onTreePositionChange={handleTreePositionChange}
              onTreeScaleChange={handleTreeScaleChange}
              skin={skin}
            />
          )}

          {selectedTree && !selectedTree.link && (
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

          {selectedTree && selectedTree.link && (
            <div className="h-full relative" style={{ background: skin.panelBg }}>
              {/* iframe 在当前页内打开链接（占满整个区域） */}
              <iframe
                src={selectedTree.link}
                className="absolute inset-0 w-full h-full border-0"
                title={selectedTree.name}
                referrerPolicy="no-referrer-when-downgrade"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              />
              {/* 可拖动悬浮按钮：返回 + 新窗口 */}
              <IframeControls
                treeName={selectedTree.name}
                treeLink={selectedTree.link}
                onBack={() => setSelectedTree(null)}
              />
            </div>
          )}
        </div>
      </div>

      {/* === 弹窗 === */}

      {showAddTree && (
        <Modal title="种一棵新树" onClose={() => setShowAddTree(false)} skin={skin} icon={<Sparkles size={16} />} maxWidth="max-w-2xl">
          <div className="space-y-3">
            {/* 第 1 行：名称 + 领域 */}
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            {/* 第 2 行：描述（跨整行） */}
            <Textarea
              label="描述"
              value={newTree.description}
              onChange={(v) => setNewTree({ ...newTree, description: v })}
              placeholder="一句话描述这棵树要承载的方向"
              skin={skin}
            />
            {/* 第 3 行：链接（跨整行） */}
            <div>
              <label
                className="text-xs mb-1.5 block tracking-wider uppercase flex items-center gap-1.5"
                style={{ color: skin.textMuted }}
              >
                <LinkIcon size={11} />
                链接（可选）
              </label>
              <input
                value={newTree.link}
                onChange={(e) => setNewTree({ ...newTree, link: e.target.value })}
                placeholder="https://...  填写后点击树直接打开此链接"
                className="w-full px-3 py-2 rounded-lg outline-none text-sm transition-all border"
                style={{
                  background: skin.cardBg,
                  color: skin.textPrimary,
                  borderColor: skin.divider,
                }}
              />
              <div className="text-[10px] mt-1" style={{ color: skin.textMuted }}>
                留空则进入知识库视图；填写后点击树会直接在当前页打开链接并支持返回。
              </div>
            </div>
            {/* 第 4 行：树种 */}
            <div>
              <label
                className="text-xs mb-1.5 block tracking-wider uppercase"
                style={{ color: skin.textMuted }}
              >
                树种
              </label>
              <div className="grid grid-cols-6 gap-2">
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

      {showEditTree && editingTree && (
        <Modal
          title="编辑这棵树"
          onClose={() => {
            setShowEditTree(false);
            setEditingTree(null);
          }}
          skin={skin}
          icon={<Pencil size={16} />}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-3">
            {/* 第 1 行：名称 + 领域 */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="树的名称"
                value={editForm.name}
                onChange={(v) => setEditForm({ ...editForm, name: v })}
                placeholder="如：技术成长"
                skin={skin}
              />
              <Input
                label="领域/行业"
                value={editForm.industry}
                onChange={(v) => setEditForm({ ...editForm, industry: v })}
                placeholder="如：互联网、AI..."
                skin={skin}
              />
            </div>
            {/* 第 2 行：描述 */}
            <Textarea
              label="描述"
              value={editForm.description}
              onChange={(v) => setEditForm({ ...editForm, description: v })}
              placeholder="一句话描述这棵树要承载的方向"
              skin={skin}
            />
            {/* 第 3 行：链接 */}
            <div>
              <label
                className="text-xs mb-1.5 block tracking-wider uppercase flex items-center gap-1.5"
                style={{ color: skin.textMuted }}
              >
                <LinkIcon size={11} />
                链接（可选）
              </label>
              <input
                value={editForm.link}
                onChange={(e) => setEditForm({ ...editForm, link: e.target.value })}
                placeholder="https://...  留空清空链接"
                className="w-full px-3 py-2 rounded-lg outline-none text-sm transition-all border"
                style={{
                  background: skin.cardBg,
                  color: skin.textPrimary,
                  borderColor: skin.divider,
                }}
              />
              <div className="text-[10px] mt-1" style={{ color: skin.textMuted }}>
                修改后点击树的跳转目标会同步更新；如想恢复纯知识库视图，把链接清空即可。
              </div>
            </div>
            {/* 第 4 行：树种 */}
            <div>
              <label
                className="text-xs mb-1.5 block tracking-wider uppercase"
                style={{ color: skin.textMuted }}
              >
                树种
              </label>
              <div className="grid grid-cols-6 gap-2">
                {(Object.keys(TREE_SPECIES) as TreeSpeciesId[]).map((key) => {
                  const info = TREE_SPECIES[key];
                  const isActive = editForm.species === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setEditForm({ ...editForm, species: key })}
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
              <Button
                onClick={() => {
                  setShowEditTree(false);
                  setEditingTree(null);
                }}
                variant="ghost"
                skin={skin}
              >
                取消
              </Button>
              <Button onClick={handleSaveEdit} skin={skin}>
                保存修改
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
function MyForestView({
  forestItems,
  totalNodes,
  totalTrees,
  onSelectTree,
  onAddTree,
  onDeleteTree,
  onEditTree,
  onTreePositionChange,
  onTreeScaleChange,
  skin,
}: {
  forestItems: ForestItem[];
  totalNodes: number;
  totalTrees: number;
  onSelectTree: (id: string) => void;
  onAddTree: () => void;
  onDeleteTree: (id: string) => void;
  onEditTree: (id: string) => void;
  onTreePositionChange: (id: string, position: { x: number; y: number }) => void;
  onTreeScaleChange: (id: string, scale: number) => void;
  skin: SkinTheme;
}) {
  // 新增树时自动重置画布到中心：pan=0 让 position (50,50) 的新树正好在可视区中央
  const [panResetKey, setPanResetKey] = useState(0);
  const prevCountRef = useRef(forestItems.length);
  useEffect(() => {
    if (forestItems.length > prevCountRef.current) {
      // 新树刚被种下 → 触发画布复位
      setPanResetKey((k) => k + 1);
    }
    prevCountRef.current = forestItems.length;
  }, [forestItems.length]);

  // 树列表折叠状态（默认展开）
  const [listOpen, setListOpen] = useState(true);
  // focus 树 id：点击列表项时设置，ForestScene 内部高亮该树（不 pan，树永远在屏幕内）
  const [focusTreeId, setFocusTreeId] = useState<string | null>(null);

  // 按节点数倒序排（参天古木在前）
  const sortedItems = useMemo(
    () => [...forestItems].sort((a, b) => b.count - a.count),
    [forestItems]
  );

  const handleFocusTree = useCallback((id: string) => {
    setFocusTreeId(id);
  }, []);

  return (
    <div className="relative h-full">
      {/* 森林全景：铺满整个详情页 */}
      <ForestScene
        items={forestItems}
        skin={skin}
        variant="my"
        onItemClick={onSelectTree}
        onItemDelete={onDeleteTree}
        onItemEdit={onEditTree}
        onItemPositionChange={onTreePositionChange}
        onItemScaleChange={onTreeScaleChange}
        fillHeight
        resetTrigger={panResetKey}
        focusTreeId={focusTreeId}
      />

      {/* 左侧树列表（可折叠）—— 点击树名 → 高亮该树 */}
      <div
        className="absolute top-4 left-4 z-10 w-56 rounded-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.86)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: `1px solid ${skin.divider}`,
          boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
        }}
      >
        {/* 列表标题（点击折叠/展开） */}
        <button
          type="button"
          onClick={() => setListOpen((o) => !o)}
          className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left"
          style={{ color: skin.textPrimary }}
        >
          {listOpen ? (
            <ChevronDown size={14} style={{ color: skin.textSecondary }} />
          ) : (
            <ChevronRight size={14} style={{ color: skin.textSecondary }} />
          )}
          <Trees size={14} style={{ color: skin.swatch }} />
          <span className="text-sm font-medium">我的树</span>
          <span
            className="ml-auto text-[11px] font-mono tabular-nums"
            style={{ color: skin.textMuted }}
          >
            {forestItems.length}
          </span>
        </button>

        {/* 列表项（折叠时隐藏） */}
        {listOpen && (
          <div
            className="border-t"
            style={{ borderColor: skin.divider, maxHeight: 320, overflowY: "auto" }}
          >
            {sortedItems.length === 0 ? (
              <div
                className="px-3.5 py-4 text-center text-[12px]"
                style={{ color: skin.textMuted }}
              >
                还没有树，去右下角种一棵吧
              </div>
            ) : (
              sortedItems.map((item) => {
                const stage = getStage(item.count);
                const StageIcon =
                  stage.size === 0
                    ? Sprout
                    : stage.size <= 2
                    ? TreePine
                    : TreeDeciduous;
                const accent = item.accentColor || skin.swatch;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleFocusTree(item.id)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left transition-colors"
                    style={{
                      color: skin.textPrimary,
                      borderBottom: `1px solid ${skin.divider}`,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        `${skin.swatch}10`;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "transparent";
                    }}
                    title={`点击定位到「${item.name}」`}
                  >
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: `${accent}22` }}
                    >
                      <StageIcon size={14} style={{ color: accent }} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate">
                        {item.name}
                      </div>
                      <div
                        className="text-[11px]"
                        style={{ color: skin.textMuted }}
                      >
                        {stage.label}
                      </div>
                    </div>
                    <Crosshair
                      size={13}
                      style={{ color: skin.textMuted }}
                      className="shrink-0"
                    />
                  </button>
                );
              })
            )}
          </div>
        )}
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
  maxWidth = "max-w-md",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  skin: SkinTheme;
  icon?: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} p-5 rounded-lg`}
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
