"use client";

/**
 * TreeCloseup - 单棵知识树的成长图鉴视图
 *
 * 视觉：单棵参天大树特写 + 5 种知识类型作为"果实"分布在树上不同部位
 * 上方是大图区，下方是阶段进度 + 知识分组
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Plus,
  Share2,
  MoreHorizontal,
  Undo2,
  Redo2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Eraser,
  Link as LinkIcon,
  Trash2,
  FileText,
  File,
  Video,
  User,
  Sprout,
  TreePine,
  TreeDeciduous,
  Cherry,
  Trees,
  Leaf,
  Apple,
  GitBranch,
  Search,
  Target,
  Award,
} from "lucide-react";
import type { SkinTheme } from "@/lib/skins";
import type { KnowledgeNode, KnowledgeTree } from "../knowledge-panel";

export const TREE_NODE_TYPE_INFO = {
  root: { label: "树根", desc: "底层认知/核心原理", Icon: Sprout, pos: "土中" },
  trunk: { label: "树干", desc: "核心目标/方向", Icon: TreePine, pos: "主干" },
  branch: { label: "树枝", desc: "实现路径/方法", Icon: GitBranch, pos: "分枝" },
  leaf: { label: "树叶", desc: "具体执行/碎片知识", Icon: Leaf, pos: "叶簇" },
  fruit: { label: "果实", desc: "成果产出/价值变现", Icon: Apple, pos: "果实" },
} as const;

// 大树模型层级信息（用于知识库展示）
const TYPE_LABELS: Record<NodeType, { short: string; full: string; desc: string; Icon: React.ElementType }> = {
  root: { short: "根", full: "找到根源", desc: "问题是什么？", Icon: Search },
  trunk: { short: "干", full: "找到目标", desc: "想要实现什么？", Icon: Target },
  branch: { short: "枝", full: "如何实现", desc: "实现路径与方法", Icon: GitBranch },
  leaf: { short: "叶", full: "落地执行", desc: "具体执行步骤", Icon: Leaf },
  fruit: { short: "果", full: "开花结果", desc: "成果验收与复盘", Icon: Award },
};

export type NodeType = keyof typeof TREE_NODE_TYPE_INFO;

function getStage(count: number) {
  if (count === 0) return { tier: 0, label: "空地", nextAt: 1, Icon: Sprout };
  if (count <= 2) return { tier: 1, label: "幼苗", nextAt: 3, Icon: Sprout };
  if (count <= 7) return { tier: 2, label: "小树", nextAt: 8, Icon: TreePine };
  if (count <= 15) return { tier: 3, label: "成树", nextAt: 16, Icon: TreeDeciduous };
  if (count <= 30) return { tier: 4, label: "参天", nextAt: 31, Icon: Cherry };
  return { tier: 5, label: "古木", nextAt: 50, Icon: Trees };
}

const STAGE_LIST = [
  { tier: 1, label: "幼苗", at: 1, Icon: Sprout },
  { tier: 2, label: "小树", at: 3, Icon: TreePine },
  { tier: 3, label: "成树", at: 8, Icon: TreeDeciduous },
  { tier: 4, label: "参天", at: 16, Icon: Cherry },
  { tier: 5, label: "古木", at: 31, Icon: Trees },
];

/** 单棵树大图 - 把 5 种类型的知识以"果实"形式分布在树上 */
function TreeBigVisual({
  tree,
  nodesByType,
  skin,
}: {
  tree: KnowledgeTree;
  nodesByType: Record<string, KnowledgeNode[]>;
  skin: SkinTheme;
}) {
  const stage = getStage(tree.nodes.length);
  const sizes: Record<number, { h: number; crown: number; trunk: number }> = {
    0: { h: 80, crown: 0, trunk: 0 },
    1: { h: 120, crown: 80, trunk: 40 },
    2: { h: 200, crown: 140, trunk: 70 },
    3: { h: 280, crown: 200, trunk: 100 },
    4: { h: 340, crown: 240, trunk: 120 },
    5: { h: 380, crown: 270, trunk: 130 },
  };
  const s = sizes[stage.tier] || sizes[1];
  const Icon = stage.Icon;

  // 各类型在树上的位置（相对坐标）
  const positions: Record<NodeType, { top: string; left: string }> = {
    root: { top: "78%", left: "50%" },     // 树根 - 土壤中
    trunk: { top: "55%", left: "50%" },    // 树干 - 主干
    branch: { top: "40%", left: "22%" },   // 树枝 - 左侧
    leaf: { top: "30%", left: "78%" },     // 树叶 - 右侧
    fruit: { top: "22%", left: "48%" },    // 果实 - 树冠内
  };

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        height: 380,
        background: `linear-gradient(180deg, 
          oklch(0.97 0.02 85) 0%, 
          oklch(0.94 0.04 95) 40%, 
          ${skin.swatch}10 80%, 
          ${skin.swatch}30 100%)`,
        borderRadius: 16,
        boxShadow: "0 10px 30px -10px rgba(0,0,0,0.12)",
      }}
    >
      {/* 太阳光斑 */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          right: 60,
          top: 30,
          width: 80,
          height: 80,
          background: "radial-gradient(circle, rgba(255,235,180,0.6) 0%, transparent 70%)",
          filter: "blur(4px)",
        }}
      />

      {/* 远山 */}
      <svg
        className="absolute inset-x-0 bottom-0 w-full pointer-events-none"
        viewBox="0 0 1000 200"
        preserveAspectRatio="none"
        style={{ height: "45%" }}
      >
        <path
          d="M0,170 L100,140 L200,160 L320,120 L440,150 L560,110 L680,145 L800,115 L920,150 L1000,130 L1000,200 L0,200 Z"
          fill={skin.swatch}
          opacity={0.18}
        />
        <path
          d="M0,185 L80,170 L180,180 L280,160 L380,180 L480,155 L580,175 L680,160 L780,180 L880,165 L1000,180 L1000,200 L0,200 Z"
          fill={skin.swatch}
          opacity={0.28}
        />
      </svg>

      {/* 草地 */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: "20%",
          background: `linear-gradient(180deg, ${skin.swatch}30 0%, ${skin.swatch}55 100%)`,
        }}
      />

      {/* 单棵参天大树 */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          bottom: "12%",
          width: s.crown,
          height: s.h,
        }}
      >
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            bottom: 0,
            width: s.crown,
            height: s.h,
            animation: `treeSway2 5s ease-in-out infinite alternate`,
            transformOrigin: "bottom center",
          }}
        >
          {/* 树干 */}
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              bottom: 0,
              width: Math.max(10, s.trunk * 0.18),
              height: s.trunk,
              background: "linear-gradient(90deg, #4a2f1a 0%, #6B4423 45%, #4a2f1a 100%)",
              borderRadius: "4px 4px 2px 2px",
            }}
          />
          {/* 树冠 */}
          <div
            className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center"
            style={{
              bottom: s.trunk - s.crown * 0.06,
              width: s.crown,
              height: s.crown,
              background: `radial-gradient(circle at 35% 30%, ${skin.swatch}66 0%, ${skin.swatch}cc 40%, ${skin.swatch} 100%)`,
              borderRadius: "50%",
              boxShadow: `0 8px 24px ${skin.swatch}44, inset 0 -10px 20px ${skin.swatch}77`,
              border: `1px solid ${skin.swatch}66`,
            }}
          >
            <Icon
              size={s.crown * 0.4}
              strokeWidth={1.2}
              style={{ color: "rgba(255,255,255,0.85)" }}
            />
          </div>
        </div>
      </div>

      {/* 知识类型"果实"分布 */}
      {(Object.keys(TREE_NODE_TYPE_INFO) as NodeType[]).map((type) => {
        const info = TREE_NODE_TYPE_INFO[type];
        const nodes = nodesByType[type] || [];
        if (nodes.length === 0) return null;
        const pos = positions[type];
        return (
          <div
            key={type}
            className="absolute flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{
              top: pos.top,
              left: pos.left,
              transform: "translate(-50%, -50%)",
              background: "rgba(255,255,255,0.85)",
              backdropFilter: "blur(6px)",
              border: `1.5px solid ${skin.swatch}`,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
            title={`${info.label}: ${nodes.length} 个`}
          >
            <info.Icon size={12} style={{ color: skin.swatch }} />
            <span
              className="text-xs font-semibold"
              style={{ color: skin.textPrimary }}
            >
              {info.label}·{nodes.length}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** 阶段进度条 */
function StageProgress({ count, skin }: { count: number; skin: SkinTheme }) {
  const stage = getStage(count);
  const currentIdx = STAGE_LIST.findIndex((s) => s.tier === stage.tier);
  const nextStage = STAGE_LIST[currentIdx + 1];
  const prevThreshold = currentIdx >= 0 ? STAGE_LIST[currentIdx].at : 0;
  const nextThreshold = nextStage ? nextStage.at : prevThreshold + 30;
  const progress = nextStage
    ? Math.min(1, (count - prevThreshold) / (nextThreshold - prevThreshold))
    : 1;

  return (
    <div
      className="p-5 rounded-lg"
      style={{ background: skin.cardBg, border: `1px solid ${skin.divider}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <stage.Icon size={18} style={{ color: skin.swatch }} />
          <span className="font-semibold" style={{ color: skin.textPrimary }}>
            当前阶段：{stage.label}
          </span>
        </div>
        <span
          className="text-xs font-mono"
          style={{ color: skin.textSecondary }}
        >
          {count} 个知识
        </span>
      </div>

      {/* 阶段轨道 */}
      <div className="flex items-center justify-between mb-2">
        {STAGE_LIST.map((s) => {
          const reached = count >= s.at;
          const isCurrent = s.tier === stage.tier;
          return (
            <div key={s.tier} className="flex flex-col items-center gap-1 flex-1">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: reached ? skin.swatch : skin.cardBg,
                  color: reached ? "#fff" : skin.textMuted,
                  border: `2px solid ${reached ? skin.swatch : skin.divider}`,
                  transform: isCurrent ? "scale(1.15)" : "scale(1)",
                  boxShadow: isCurrent ? `0 4px 12px ${skin.swatch}55` : "none",
                }}
              >
                <s.Icon size={16} />
              </div>
              <span
                className="text-[10px] tracking-wider"
                style={{
                  color: isCurrent ? skin.textPrimary : skin.textMuted,
                  fontWeight: isCurrent ? 600 : 400,
                }}
              >
                {s.label}
              </span>
              <span
                className="text-[9px] font-mono"
                style={{ color: skin.textMuted }}
              >
                {s.at}+
              </span>
            </div>
          );
        })}
      </div>

      {/* 进度条 */}
      {nextStage && (
        <div className="mt-3">
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: skin.progressTrack }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progress * 100}%`,
                background: `linear-gradient(90deg, ${skin.swatch}, ${skin.swatch}cc)`,
              }}
            />
          </div>
          <div
            className="text-[11px] mt-1.5 text-right"
            style={{ color: skin.textSecondary }}
          >
            距「{nextStage.label}」还差 {nextThreshold - count} 个知识
          </div>
        </div>
      )}
      {!nextStage && (
        <div
          className="text-center text-xs mt-2 py-1.5 rounded"
          style={{ background: `${skin.swatch}15`, color: skin.swatch }}
        >
          🌳 已达最高阶段，知识的参天古木
        </div>
      )}
    </div>
  );
}

/** 知识分组卡片 */
function NodeGroupCard({
  type,
  nodes,
  skin,
  onDelete,
  onAdd,
}: {
  type: NodeType;
  nodes: KnowledgeNode[];
  skin: SkinTheme;
  onDelete: (id: string) => void;
  onAdd: (type: NodeType) => void;
}) {
  const info = TREE_NODE_TYPE_INFO[type];
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: skin.cardBg,
        border: `1px solid ${skin.divider}`,
      }}
    >
      <div
        className="px-4 py-2.5 flex items-center justify-between"
        style={{
          background: `linear-gradient(90deg, ${skin.swatch}10 0%, transparent 100%)`,
          borderBottom: `1px solid ${skin.divider}`,
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: `${skin.swatch}20`, color: skin.swatch }}
          >
            <info.Icon size={14} />
          </div>
          <div>
            <div
              className="text-sm font-semibold"
              style={{ color: skin.textPrimary }}
            >
              {info.label}
            </div>
            <div
              className="text-[10px]"
              style={{ color: skin.textSecondary }}
            >
              {info.desc}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-mono px-2 py-0.5 rounded-full"
            style={{ background: `${skin.swatch}15`, color: skin.swatch }}
          >
            {nodes.length}
          </span>
          <button
            onClick={() => onAdd(type)}
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{
              background: skin.swatch,
              color: "#fff",
            }}
            title={`添加${info.label}`}
          >
            <Plus size={12} />
          </button>
        </div>
      </div>
      <div className="p-3 space-y-1.5">
        {nodes.length === 0 ? (
          <div
            className="text-center text-xs py-4 opacity-50"
            style={{ color: skin.textSecondary }}
          >
            还没有{info.label}，添加一个吧
          </div>
        ) : (
          nodes.map((n) => (
            <div
              key={n.id}
              className="p-2.5 rounded flex items-start justify-between group transition-colors"
              style={{ background: `${skin.swatch}08` }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${skin.swatch}14`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `${skin.swatch}08`;
              }}
            >
              <div className="flex-1 min-w-0">
                <div
                  className="text-sm font-medium truncate"
                  style={{ color: skin.textPrimary }}
                >
                  {n.title}
                </div>
                {n.content && (
                  <div
                    className="text-xs mt-0.5 line-clamp-2"
                    style={{ color: skin.textSecondary }}
                  >
                    {n.content}
                  </div>
                )}
                {n.source && (
                  <div
                    className="text-[10px] mt-1 truncate"
                    style={{ color: skin.textMuted }}
                  >
                    📎 {n.source}
                  </div>
                )}
              </div>
              <button
                onClick={() => onDelete(n.id)}
                className="ml-2 text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  color: "#ef4444",
                  background: "rgba(239,68,68,0.1)",
                }}
              >
                删除
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ================== 知识库（左右分栏） ================== */

type KBNoteType = "note" | "file" | "live" | "blog";

type KBNote = {
  id: string;
  title: string;
  content: string; // HTML
  type: KBNoteType;
  createdAt: number;
  updatedAt: number;
};

type KBSlot = {
  notes: KBNote[];
  activeId: string | null;
  filter: "all" | KBNoteType;
};

function loadKBSlot(treeId: string): KBSlot {
  if (typeof window === "undefined") return { notes: [], activeId: null, filter: "all" };
  try {
    const raw = localStorage.getItem(`tree-knowledge-${treeId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.notes)) {
        return {
          notes: parsed.notes,
          activeId: typeof parsed.activeId === "string" ? parsed.activeId : null,
          filter: ["all", "note", "file", "live", "blog"].includes(parsed.filter) ? parsed.filter : "all",
        };
      }
    }
  } catch {}
  return { notes: [], activeId: null, filter: "all" };
}

function saveKBSlot(treeId: string, slot: KBSlot) {
  try {
    localStorage.setItem(`tree-knowledge-${treeId}`, JSON.stringify(slot));
  } catch {}
}

const KB_FILTER_TABS: { key: KBSlot["filter"]; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "note", label: "笔记" },
  { key: "file", label: "文件" },
  { key: "live", label: "直播" },
  { key: "blog", label: "博主" },
];

export default function TreeCloseup({
  tree,
  nodesByType: _nodesByType,
  onBack,
  onAddNode: _onAddNode,
  onDeleteNode: _onDeleteNode,
  onAddTypeNode: _onAddTypeNode,
  skin,
}: {
  tree: KnowledgeTree;
  nodesByType: Record<string, KnowledgeNode[]>;
  onBack: () => void;
  onAddNode: () => void;
  onDeleteNode: (id: string) => void;
  onAddTypeNode: (type: NodeType) => void;
  skin: SkinTheme;
}) {
  // 知识库本地存储
  const [slot, setSlot] = useState<KBSlot>({ notes: [], activeId: null, filter: "all" });
  const [mounted, setMounted] = useState(false);
  const [editorRef, setEditorRef] = useState<HTMLDivElement | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // 首次挂载后从 localStorage 读取
  useEffect(() => {
    const loaded = loadKBSlot(tree.id);
    setSlot(loaded);
    setMounted(true);
  }, [tree.id]);

  // active note
  const activeNote = useMemo(
    () => slot.notes.find((n) => n.id === slot.activeId) || null,
    [slot.notes, slot.activeId]
  );

  // 过滤后的列表
  const filteredNotes = useMemo(() => {
    if (slot.filter === "all") return slot.notes;
    return slot.notes.filter((n) => n.type === slot.filter);
  }, [slot.notes, slot.filter]);

  // 持久化
  const persist = useCallback(
    (next: KBSlot) => {
      setSlot(next);
      saveKBSlot(tree.id, next);
      setSavedAt(Date.now());
    },
    [tree.id]
  );

  // 切换标签
  const setFilter = (f: KBSlot["filter"]) => {
    setSlot((s) => ({ ...s, filter: f }));
  };

  // 新建笔记
  const createNote = (type: KBNoteType = "note") => {
    const now = Date.now();
    const newNote: KBNote = {
      id: `n_${now}_${Math.random().toString(36).slice(2, 7)}`,
      title: type === "note" ? "无标题笔记" : type === "file" ? "新文件" : type === "live" ? "新直播" : "新博主",
      content: "",
      type,
      createdAt: now,
      updatedAt: now,
    };
    persist({ notes: [newNote, ...slot.notes], activeId: newNote.id, filter: type === "note" ? slot.filter : type });
    // 选中后聚焦编辑器
    setTimeout(() => editorRef?.focus(), 50);
  };

  // 选中笔记
  const selectNote = (id: string) => {
    persist({ ...slot, activeId: id });
  };

  // 删除笔记
  const deleteNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextNotes = slot.notes.filter((n) => n.id !== id);
    const nextActive = slot.activeId === id ? nextNotes[0]?.id ?? null : slot.activeId;
    persist({ notes: nextNotes, activeId: nextActive, filter: slot.filter });
  };

  // 更新笔记标题
  const updateTitle = (id: string, title: string) => {
    const next = {
      ...slot,
      notes: slot.notes.map((n) =>
        n.id === id ? { ...n, title, updatedAt: Date.now() } : n
      ),
    };
    persist(next);
  };

  // 更新笔记内容（contenteditable 触发）
  const updateContent = (id: string, content: string) => {
    const next = {
      ...slot,
      notes: slot.notes.map((n) =>
        n.id === id ? { ...n, content, updatedAt: Date.now() } : n
      ),
    };
    // 持久化但不重置 savedAt 显示，由 debounce 决定
    setSlot(next);
  };

  // debounce 持久化 content
  useEffect(() => {
    if (!mounted) return;
    const t = setTimeout(() => {
      saveKBSlot(tree.id, slot);
      setSavedAt(Date.now());
    }, 400);
    return () => clearTimeout(t);
  }, [slot, tree.id, mounted]);

  // 切换 active 时把 content 同步到编辑器 DOM
  useEffect(() => {
    if (editorRef && activeNote) {
      if (editorRef.innerHTML !== activeNote.content) {
        editorRef.innerHTML = activeNote.content;
      }
    } else if (editorRef && !activeNote) {
      editorRef.innerHTML = "";
    }
  }, [activeNote?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 富文本命令
  const exec = (cmd: string, value?: string) => {
    if (!activeNote) return;
    editorRef?.focus();
    document.execCommand(cmd, false, value);
    if (editorRef) updateContent(activeNote.id, editorRef.innerHTML);
  };

  // 插入链接
  const insertLink = () => {
    if (!activeNote) return;
    const url = window.prompt("请输入链接 URL：");
    if (!url) return;
    exec("createLink", url);
  };

  // 列表快捷符号
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!activeNote) return;
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      // cmd+enter 切到下一行
      e.preventDefault();
      document.execCommand("insertLineBreak");
    }
  };

  // 统计字数（去除 HTML 标签）
  const wordCount = useMemo(() => {
    if (!activeNote) return 0;
    const text = activeNote.content.replace(/<[^>]+>/g, "").trim();
    if (!text) return 0;
    // 中文字符 + 英文单词
    const cnChars = (text.match(/[一-龥]/g) || []).length;
    const enWords = (text.replace(/[一-龥]/g, " ").trim().match(/\S+/g) || []).length;
    return cnChars + enWords;
  }, [activeNote]);

  // 显示名（未挂载时用占位）
  const displayName = mounted ? tree.name : tree.name;
  const noteCount = mounted ? slot.notes.length : 0;

  return (
    <div className="h-full flex" style={{ background: skin.panelBg }}>
      {/* 左侧栏 */}
      <div
        className="w-[280px] shrink-0 flex flex-col h-full"
        style={{ background: skin.cardBg, borderRight: `1px solid ${skin.divider}` }}
      >
        {/* 顶部标题区 */}
        <div
          className="px-4 py-3 shrink-0"
          style={{ borderBottom: `1px solid ${skin.divider}` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={onBack}
              className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
              style={{ background: "transparent", color: skin.textMuted }}
              onMouseEnter={(e) => { e.currentTarget.style.background = skin.cardHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              title="返回森林"
            >
              <ArrowLeft size={14} />
            </button>
            <button
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: "transparent", color: skin.textMuted }}
              title="锁定"
            >
              <LockIcon size={12} />
            </button>
            <div className="flex-1 min-w-0" />
            <button
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: "transparent", color: skin.textMuted }}
              title="分享"
            >
              <Share2 size={13} />
            </button>
            <button
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: "transparent", color: skin.textMuted }}
              title="更多"
            >
              <MoreHorizontal size={14} />
            </button>
            <button
              onClick={() => createNote("note")}
              className="ml-1 px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1"
              style={{ background: skin.textPrimary, color: skin.cardBg }}
              title="添加"
            >
              <Plus size={12} />
              添加
            </button>
          </div>
          <div className="flex items-center gap-1 mb-1">
            <h2
              className="text-base font-semibold truncate"
              style={{ color: skin.textPrimary }}
            >
              {displayName}
            </h2>
            <ChevronDown size={14} style={{ color: skin.textMuted }} />
          </div>
          <div
            className="flex items-center gap-1.5 text-xs"
            style={{ color: skin.textMuted }}
          >
            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-medium" style={{ background: skin.swatch + "30", color: skin.swatch }}>G</span>
            <span>个人</span>
          </div>
          <div
            className="text-[11px] mt-1.5"
            style={{ color: skin.textMuted }}
          >
            {noteCount} 个内容
          </div>
        </div>

        {/* 标签切换栏 */}
        <div
          className="px-3 py-2 shrink-0"
          style={{ borderBottom: `1px solid ${skin.divider}` }}
        >
          <div className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {KB_FILTER_TABS.map((tab) => {
              const isActive = slot.filter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className="text-xs px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-all"
                  style={{
                    background: isActive ? skin.swatch : "transparent",
                    color: isActive ? "#fff" : skin.textMuted,
                    boxShadow: isActive ? `0 1px 3px ${skin.swatch}40` : "none",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 内容列表 */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {!mounted ? null : filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <EmptyIllustration color={skin.textMuted} />
              <div
                className="text-xs mt-3"
                style={{ color: skin.textMuted }}
              >
                暂无内容
              </div>
              <button
                onClick={() => createNote("note")}
                className="mt-3 text-[11px] px-2.5 py-1 rounded-md"
                style={{ background: skin.swatch + "15", color: skin.swatch }}
              >
                + 新建笔记
              </button>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredNotes.map((n) => {
                const isActive = n.id === slot.activeId;
                const typeLabel = n.type === "note" ? "笔记" : n.type === "file" ? "文件" : n.type === "live" ? "直播" : "博主";
                const preview = n.content.replace(/<[^>]+>/g, "").trim().slice(0, 60) || "无内容";
                const time = new Date(n.updatedAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
                return (
                  <div
                    key={n.id}
                    onClick={() => selectNote(n.id)}
                    className="group px-2.5 py-2 rounded-md cursor-pointer transition-colors relative"
                    style={{
                      background: isActive ? `${skin.swatch}18` : "transparent",
                    }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = skin.cardHover; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div className="flex items-start gap-1.5">
                      <NoteTypeIcon type={n.type} color={isActive ? skin.swatch : skin.textMuted} />
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-xs font-medium truncate"
                          style={{ color: skin.textPrimary }}
                        >
                          {n.title || "无标题"}
                        </div>
                        <div
                          className="text-[10px] mt-0.5 truncate"
                          style={{ color: skin.textMuted }}
                        >
                          {preview}
                        </div>
                        <div
                          className="text-[10px] mt-0.5 flex items-center gap-1.5"
                          style={{ color: skin.textMuted }}
                        >
                          <span className="px-1 rounded" style={{ background: isActive ? skin.swatch + "30" : skin.cardHover, color: isActive ? skin.swatch : skin.textMuted }}>{typeLabel}</span>
                          <span>{time}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => deleteNote(n.id, e)}
                        className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center transition-opacity"
                        style={{ color: skin.textMuted }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = skin.textMuted; }}
                        title="删除"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 右侧编辑器 */}
      <div className="flex-1 flex flex-col h-full min-w-0" style={{ background: skin.panelBg }}>
        {activeNote ? (
          <>
            {/* 标题输入 */}
            <div
              className="px-8 pt-6 pb-2 shrink-0"
            >
              <input
                value={activeNote.title}
                onChange={(e) => updateTitle(activeNote.id, e.target.value)}
                placeholder="无标题"
                className="w-full text-2xl font-semibold outline-none bg-transparent"
                style={{ color: skin.textPrimary }}
              />
              <div
                className="text-[11px] mt-1 flex items-center gap-2"
                style={{ color: skin.textMuted }}
              >
                <span>{activeNote.type === "note" ? "笔记" : activeNote.type === "file" ? "文件" : activeNote.type === "live" ? "直播" : "博主"}</span>
                <span>·</span>
                <span>更新于 {new Date(activeNote.updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>

            {/* 工具栏 */}
            <div
              className="mx-8 mt-2 mb-2 flex items-center gap-0.5 px-1.5 py-1 rounded-md shrink-0"
              style={{ background: skin.cardBg, border: `1px solid ${skin.divider}` }}
            >
              <ToolBtn title="撤销 (Ctrl+Z)" onClick={() => exec("undo")}>
                <Undo2 size={14} />
              </ToolBtn>
              <ToolBtn title="重做 (Ctrl+Y)" onClick={() => exec("redo")}>
                <Redo2 size={14} />
              </ToolBtn>
              <Divider />
              <ToolBtn title="标题 1" onClick={() => exec("formatBlock", "H1")}>
                <Heading1 size={14} />
              </ToolBtn>
              <ToolBtn title="标题 2" onClick={() => exec("formatBlock", "H2")}>
                <Heading2 size={14} />
              </ToolBtn>
              <ToolBtn title="标题 3" onClick={() => exec("formatBlock", "H3")}>
                <Heading3 size={14} />
              </ToolBtn>
              <Divider />
              <ToolBtn title="加粗 (Ctrl+B)" onClick={() => exec("bold")} bold>
                <span className="text-xs font-bold">B</span>
              </ToolBtn>
              <ToolBtn title="斜体 (Ctrl+I)" onClick={() => exec("italic")}>
                <span className="text-xs italic font-serif">I</span>
              </ToolBtn>
              <ToolBtn title="下划线 (Ctrl+U)" onClick={() => exec("underline")}>
                <span className="text-xs underline">U</span>
              </ToolBtn>
              <ToolBtn title="删除线" onClick={() => exec("strikeThrough")}>
                <span className="text-xs line-through">S</span>
              </ToolBtn>
              <Divider />
              <ToolBtn title="无序列表" onClick={() => exec("insertUnorderedList")}>
                <List size={14} />
              </ToolBtn>
              <ToolBtn title="有序列表" onClick={() => exec("insertOrderedList")}>
                <ListOrdered size={14} />
              </ToolBtn>
              <ToolBtn title="任务列表" onClick={() => exec("insertHTML", "<ul><li><input type='checkbox' /> 待办</li></ul>")}>
                <CheckSquare size={14} />
              </ToolBtn>
              <ToolBtn title="引用" onClick={() => exec("formatBlock", "BLOCKQUOTE")}>
                <Quote size={14} />
              </ToolBtn>
              <ToolBtn title="代码" onClick={() => exec("formatBlock", "PRE")}>
                <Code size={14} />
              </ToolBtn>
              <Divider />
              <ToolBtn title="链接" onClick={insertLink}>
                <LinkIcon size={14} />
              </ToolBtn>
              <ToolBtn title="清除格式" onClick={() => exec("removeFormat")}>
                <Eraser size={14} />
              </ToolBtn>
            </div>

            {/* 编辑区 */}
            <div className="flex-1 overflow-y-auto px-8 py-4">
              <div
                ref={setEditorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => updateContent(activeNote.id, (e.currentTarget as HTMLDivElement).innerHTML)}
                onKeyDown={onKeyDown}
                onBlur={() => activeNote && saveKBSlot(tree.id, slot)}
                data-placeholder="从这里开始书写..."
                className="kb-editor min-h-[60vh] outline-none leading-relaxed"
                style={{ color: skin.textPrimary }}
              />
            </div>

            {/* 底部状态栏 */}
            <div
              className="px-8 py-2 flex items-center gap-3 text-[11px] shrink-0"
              style={{ color: skin.textMuted, borderTop: `1px solid ${skin.divider}` }}
            >
              <span>{wordCount} 字</span>
              <span>·</span>
              <span>{savedAt ? `已保存 ${new Date(savedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}` : "未保存"}</span>
              <div className="flex-1" />
              <span>共 {(activeNote.content.replace(/<[^>]+>/g, "")).length} 字符</span>
            </div>
          </>
        ) : (
          // 空状态
          <div className="flex-1 flex flex-col items-center justify-center">
            <EmptyIllustration color={skin.textMuted} size={120} />
            <div
              className="text-sm mt-4"
              style={{ color: skin.textMuted }}
            >
              从左侧选择内容查看
            </div>
            <button
              onClick={() => createNote("note")}
              className="mt-4 px-4 py-2 rounded-md text-sm font-medium"
              style={{ background: skin.swatch, color: "#fff" }}
            >
              <Plus size={14} className="inline mr-1" />
              新建笔记
            </button>
          </div>
        )}
      </div>

      <style>{`
        .kb-editor:empty::before {
          content: attr(data-placeholder);
          color: ${skin.textMuted};
          opacity: 0.6;
          pointer-events: none;
        }
        .kb-editor h1 { font-size: 1.6rem; font-weight: 600; margin: 0.8em 0 0.4em; }
        .kb-editor h2 { font-size: 1.3rem; font-weight: 600; margin: 0.7em 0 0.4em; }
        .kb-editor h3 { font-size: 1.1rem; font-weight: 600; margin: 0.6em 0 0.3em; }
        .kb-editor p { margin: 0.5em 0; }
        .kb-editor ul, .kb-editor ol { margin: 0.5em 0; padding-left: 1.5em; }
        .kb-editor li { margin: 0.2em 0; }
        .kb-editor blockquote {
          margin: 0.6em 0;
          padding: 0.3em 0.8em;
          border-left: 3px solid ${skin.swatch};
          background: ${skin.swatch}10;
          border-radius: 0 4px 4px 0;
          color: ${skin.textMuted};
        }
        .kb-editor pre {
          margin: 0.6em 0;
          padding: 0.6em 0.8em;
          background: ${skin.cardHover};
          border-radius: 6px;
          font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
          font-size: 0.9em;
          overflow-x: auto;
        }
        .kb-editor a {
          color: ${skin.swatch};
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .kb-editor code {
          background: ${skin.cardHover};
          padding: 0.1em 0.4em;
          border-radius: 3px;
          font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
          font-size: 0.9em;
        }
        .kb-editor input[type="checkbox"] {
          margin-right: 0.3em;
          accent-color: ${skin.swatch};
        }
        .kb-editor:focus { outline: none; }
      `}</style>
    </div>
  );
}

/* 工具栏按钮 */
function ToolBtn({ children, onClick, title, bold }: { children: React.ReactNode; onClick: () => void; title: string; bold?: boolean }) {
  return (
    <button
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()} // 防止编辑器失焦
      title={title}
      className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${bold ? "font-bold" : ""}`}
      style={{ color: "currentColor" }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-4 mx-0.5" style={{ background: "currentColor", opacity: 0.15 }} />;
}

/* 笔记类型图标 */
function NoteTypeIcon({ type, color }: { type: KBNoteType; color: string }) {
  const size = 12;
  if (type === "note") return <FileText size={size} style={{ color, marginTop: 1 }} />;
  if (type === "file") return <File size={size} style={{ color, marginTop: 1 }} />;
  if (type === "live") return <Video size={size} style={{ color, marginTop: 1 }} />;
  return <User size={size} style={{ color, marginTop: 1 }} />;
}

/* 空状态插画 */
function EmptyIllustration({ color, size = 80 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 气球 */}
      <ellipse cx="50" cy="32" rx="14" ry="17" stroke={color} strokeWidth="1.2" opacity="0.5" />
      <path d="M50 49 L50 60" stroke={color} strokeWidth="1.2" opacity="0.5" />
      <path d="M48 60 L50 64 L52 60 Z" fill={color} opacity="0.5" />
      {/* 文件框 */}
      <rect x="32" y="64" width="36" height="26" rx="2" stroke={color} strokeWidth="1.2" opacity="0.5" />
      <line x1="38" y1="72" x2="62" y2="72" stroke={color} strokeWidth="1.2" opacity="0.5" />
      <line x1="38" y1="78" x2="58" y2="78" stroke={color} strokeWidth="1.2" opacity="0.5" />
      <line x1="38" y1="84" x2="54" y2="84" stroke={color} strokeWidth="1.2" opacity="0.5" />
    </svg>
  );
}

/* 内联图标封装（避免外层 import 太多） */
function LockIcon(props: { size?: number }) {
  return (
    <svg width={props.size || 14} height={props.size || 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

