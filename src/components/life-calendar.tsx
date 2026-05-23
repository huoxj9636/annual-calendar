'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { SKINS } from '@/lib/skins';
import ParticleEffect from '@/components/particle-effect';

interface LifeCalendarProps {
  birthYear: number;
  setBirthYear: (year: number) => void;
  onClose: () => void;
  skinKey?: string;
}

// ── Tree data: every node is a Goal ──
interface GoalNode {
  id: string;
  title: string;
  status: 'not_started' | 'in_progress' | 'completed';
  children: GoalNode[];
  reviews: { id: string; date: string; content: string }[];
  createdAt: number;
  period?: string;
}

type PeriodType = 'annual' | 'Q1' | 'Q2' | 'Q3' | 'Q4';

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Recursively count leaf nodes & completed leaves
function countNodes(n: GoalNode): { total: number; done: number } {
  if (n.children.length === 0) return { total: 1, done: n.status === 'completed' ? 1 : 0 };
  let total = 0, done = 0;
  for (const c of n.children) { const s = countNodes(c); total += s.total; done += s.done; }
  return { total, done };
}

// Progress = completed leaf ratio
function nodeProgress(n: GoalNode): number {
  if (n.children.length === 0) return n.status === 'completed' ? 1 : 0;
  return n.children.reduce((s, c) => s + nodeProgress(c), 0) / n.children.length;
}

// Find node by id
function findNode(root: GoalNode, id: string): GoalNode | null {
  if (root.id === id) return root;
  for (const c of root.children) { const f = findNode(c, id); if (f) return f; }
  return null;
}

// Update node immutably
function updateNode(root: GoalNode, id: string, fn: (n: GoalNode) => GoalNode): GoalNode {
  if (root.id === id) return fn(root);
  return { ...root, children: root.children.map(c => updateNode(c, id, fn)) };
}

// Remove node immutably (returns roots filtered)
function removeNode(roots: GoalNode[], id: string): GoalNode[] {
  return roots.filter(r => r.id !== id).map(r => ({
    ...r, children: removeNode(r.children, id),
  }));
}

// Get path labels from root to target
function getPathLabels(roots: GoalNode[], targetId: string): string[] {
  for (const r of roots) {
    if (r.id === targetId) return [r.title];
    const sub = getPathLabels(r.children, targetId);
    if (sub.length > 0) return [r.title, ...sub];
  }
  return [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateGoals(raw: any[]): GoalNode[] {
  return raw.map((o: any) => ({
    id: o.id || genId(),
    title: o.objective || o.title || '',
    status: ['not_started', 'in_progress', 'completed'].includes(o.status) ? o.status : 'not_started',
    createdAt: o.createdAt || Date.now(),
    children: (o.keyResults || o.children || []).map((kr: any) => ({
      id: kr.id || genId(),
      title: kr.description || kr.title || '',
      status: ['not_started', 'in_progress', 'completed'].includes(kr.status) ? kr.status : 'not_started',
      createdAt: kr.createdAt || Date.now(),
      children: (kr.tasks || kr.children || []).map((t: any) => ({
        id: t.id || genId(),
        title: t.title || '',
        status: 'not_started' as const,
        createdAt: t.createdAt || Date.now(),
        children: (t.tomatoes || t.children || []).map((tm: any) => ({
          id: tm.id || genId(),
          title: tm.title || '',
          status: (tm.completed ? 'completed' : 'not_started') as GoalNode['status'],
          createdAt: tm.completedAt || Date.now(),
          children: [] as GoalNode[],
          reviews: [],
        })),
        reviews: [],
      })),
      reviews: (kr.reviews || []),
    })),
    reviews: (o.reviews || []),
  })) as GoalNode[];
}

// ── Voice Recognition Hook ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SRInstance = any;
type VoicePhase = 'idle' | 'listening' | 'recognized' | 'polishing' | 'done';

function useVoiceRecognition(onResult: (text: string) => void, context?: string) {
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [rawText, setRawText] = useState('');
  const [polishedText, setPolishedText] = useState('');
  const recRef = useRef<SRInstance>(null);

  const start = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'zh-CN';
    rec.continuous = false;
    rec.interimResults = true;
    setRawText('');
    setPolishedText('');
    setPhase('listening');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = async (e: any) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      const display = final || interim;
      if (display) setRawText(display);
      // When we have a final result, move to recognized phase
      if (final) {
        setPhase('recognized');
        // Polish via LLM
        setPhase('polishing');
        try {
          const res = await fetch('/api/polish-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: final, context }),
          });
          const data = await res.json();
          setPolishedText(data.result || final);
          onResult(data.result || final);
        } catch {
          setPolishedText(final);
          onResult(final);
        }
        setPhase('done');
        setTimeout(() => setPhase('idle'), 1200);
      }
    };
    rec.onerror = () => { setPhase('idle'); };
    rec.onend = () => { /* phase managed by onresult */ };
    recRef.current = rec;
    rec.start();
  }, [onResult, context]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setPhase('idle');
  }, []);

  return { phase, rawText, polishedText, start, stop };
}

// ── Component ──
export default function LifeCalendar({ birthYear, setBirthYear, onClose, skinKey }: LifeCalendarProps) {
  const skin = SKINS.find(s => s.key === skinKey) || SKINS[0];
  const swatch = skin.swatch || '#6558c1';
  const currentYear = new Date().getFullYear();

  const [goals, setGoals] = useState<GoalNode[]>([]);
  const [period, setPeriod] = useState<PeriodType>(() => { const m = new Date().getMonth(); if (m < 3) return 'Q1'; if (m < 6) return 'Q2'; if (m < 9) return 'Q3'; return 'Q4'; });
  const [mounted, setMounted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Inline inputs
  const [newTitle, setNewTitle] = useState('');
  const [newChild, setNewChild] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [addInputParentId, setAddInputParentId] = useState<string | null>(null);

  const addInputRef = useRef<HTMLInputElement>(null);

  const year = new Date().getFullYear();
  const periodKey = period === 'annual' ? `${year}` : `${year}-${period}`;
  const periodLabel = period === 'annual' ? `${year}年度` : `${year} ${period}`;

  // Load
  useEffect(() => {
    const saved = localStorage.getItem('okr-data');
    if (saved) { try { setGoals(migrateGoals(JSON.parse(saved))); } catch { /* ignore */ } }
    setMounted(true);
  }, []);

  // Save
  useEffect(() => { if (mounted) localStorage.setItem('okr-data', JSON.stringify(goals)); }, [goals, mounted]);

  // Voice for top input
  const voiceTop = useVoiceRecognition((text) => { setNewTitle(text); });

  // Voice for child input — pass parent title as context for better polish
  // Derived
  const filteredGoals = useMemo(() => goals.filter(o => o.period === periodKey || !o.period), [goals, periodKey]);
  const selectedGoal = useMemo(() => {
    if (!selectedId) return null;
    for (const r of filteredGoals) { const f = findNode(r, selectedId); if (f) return f; }
    return null;
  }, [filteredGoals, selectedId]);
  // Also find the root OKR that contains the selected goal
  const selectedRoot = useMemo(() => {
    if (!selectedId) return null;
    return filteredGoals.find(r => findNode(r, selectedId)) || null;
  }, [filteredGoals, selectedId]);

  // Voice for child input — pass parent title as context for better polish
  const voiceChild = useVoiceRecognition((text) => { setNewChild(text); }, selectedGoal?.title);

  const globalStats = useMemo(() => {
    let total = 0, done = 0;
    for (const g of filteredGoals) { const s = countNodes(g); total += s.total; done += s.done; }
    const avg = filteredGoals.length > 0
      ? Math.round(filteredGoals.reduce((s, o) => s + nodeProgress(o), 0) / filteredGoals.length * 100)
      : 0;
    return { totalOKRs: filteredGoals.length, totalNodes: total, doneNodes: done, avgProgress: avg };
  }, [filteredGoals]);

  // Actions
  const addGoal = useCallback(() => {
    if (!newTitle.trim()) return;
    const node: GoalNode = { id: genId(), title: newTitle.trim(), status: 'in_progress', children: [], reviews: [], createdAt: Date.now(), period: periodKey };
    setGoals(prev => [...prev, node]);
    setNewTitle('');
    setSelectedId(node.id);
  }, [newTitle, periodKey]);

  const addChild = useCallback((parentId: string) => {
    if (!newChild.trim()) return;
    const child: GoalNode = { id: genId(), title: newChild.trim(), status: 'not_started', children: [], reviews: [], createdAt: Date.now() };
    setGoals(prev => prev.map(r => updateNode(r, parentId, n => ({ ...n, children: [...n.children, child] }))));
    setNewChild('');
  }, [newChild]);

  const toggleLeaf = useCallback((id: string) => {
    setGoals(prev => prev.map(r => updateNode(r, id, n => {
      if (n.children.length > 0) return n; // only leaf nodes
      return { ...n, status: n.status === 'completed' ? 'not_started' : 'completed' };
    })));
  }, []);

  const deleteGoal = useCallback((id: string) => {
    setGoals(prev => removeNode(prev, id));
    setSelectedId(prev => prev === id ? null : prev);
  }, []);

  const saveTitle = useCallback((id: string) => {
    if (!editText.trim()) { setEditingId(null); return; }
    setGoals(prev => prev.map(r => updateNode(r, id, n => ({ ...n, title: editText.trim() }))));
    setEditingId(null);
  }, [editText]);

  const addReview = useCallback((rootId: string) => {
    if (!reviewText.trim()) return;
    setGoals(prev => prev.map(r => updateNode(r, rootId, n => ({
      ...n, reviews: [...n.reviews, { id: genId(), date: new Date().toISOString().slice(0, 10), content: reviewText.trim() }],
    }))));
    setReviewText('');
  }, [reviewText]);

  if (!mounted) return null;

  const s = {
    bg: skin.bodyBg, panelBg: skin.panelBg, cardBg: skin.cardBg, cardHover: skin.cardHover,
    text1: skin.textPrimary, text2: skin.textSecondary, textMuted: skin.textMuted,
    divider: skin.divider, progressTrack: skin.progressTrack, progressFill: skin.progressFill,
  };

  const pb = (pct: number, h: number = 6, color?: string) => (
    <div className="w-full rounded-full" style={{ height: h, backgroundColor: s.progressTrack }}>
      <div className="rounded-full transition-all duration-500" style={{
        width: `${Math.min(pct, 100)}%`, height: '100%',
        backgroundColor: color || (pct >= 100 ? '#22c55e' : pct >= 60 ? s.progressFill : pct >= 30 ? '#f97316' : s.textMuted),
      }} />
    </div>
  );

  // Render tree node in left list (recursive, indented)
  // Left panel: flat list of top-level goals only (no tree, no checkboxes)
  const renderLeftItem = (node: GoalNode): React.ReactNode => {
    const pct = Math.round(nodeProgress(node) * 100);
    const isSelected = selectedId === node.id;
    return (
      <div key={node.id}
        onClick={() => setSelectedId(node.id)}
        className="py-2 cursor-pointer transition-all border-l-[3px] flex items-center gap-2"
        style={{
          paddingLeft: '16px',
          paddingRight: '16px',
          backgroundColor: isSelected ? s.cardHover : 'transparent',
          borderLeftColor: isSelected ? swatch : 'transparent',
        }}
      >
        <span className="flex-1 text-sm truncate" style={{ color: s.text1 }}>{node.title}</span>
        <span className="text-xs font-bold flex-shrink-0" style={{ color: pct > 0 ? swatch : s.textMuted }}>{pct}%</span>
      </div>
    );
  };

  // Render right detail: tree view of selected node's children
  const renderDetailTree = (node: GoalNode, depth: number = 0): React.ReactNode => {
    const isLeaf = node.children.length === 0;
    const pct = Math.round(nodeProgress(node) * 100);
    const isExpanded = expandedIds.has(node.id);
    return (
      <div key={node.id} className={depth > 0 ? 'ml-3' : ''} style={{ borderLeft: depth > 0 ? `1px dashed ${s.divider}` : 'none', paddingLeft: depth > 0 ? 8 : 0 }}>
        <div className="flex items-center gap-1.5 py-1.5 group cursor-pointer"
             onClick={() => { if (!isLeaf) toggleExpand(node.id); }}>
          {/* Expand/collapse toggle or spacer */}
          {!isLeaf ? (
            <span className="text-[10px] flex-shrink-0 transition-transform duration-200" style={{ color: s.textMuted, transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
          ) : (
            <span className="w-[10px] flex-shrink-0" />
          )}
          {/* Title: click to edit */}
          {editingId === node.id ? (
            <input autoFocus value={editText} onChange={e => setEditText(e.target.value)}
                   onBlur={() => saveTitle(node.id)}
                   onKeyDown={e => { if (e.key === 'Enter') saveTitle(node.id); if (e.key === 'Escape') setEditingId(null); }}
                   className="flex-1 text-sm outline-none rounded px-1.5 py-0.5"
                   style={{ backgroundColor: s.panelBg, color: s.text1, border: `1px solid ${s.divider}` }} />
          ) : (
            <span className="flex-1 text-sm truncate"
                  style={{ color: s.text1 }}
                  onClick={e => { e.stopPropagation(); setEditingId(node.id); setEditText(node.title); }}>
              {node.title}
            </span>
          )}
          {/* Progress */}
          <span className="text-[10px] font-bold flex-shrink-0" style={{ color: pct > 0 ? swatch : s.textMuted }}>{pct}%</span>
          {/* Delete */}
          <button onClick={e => { e.stopPropagation(); deleteGoal(node.id); }}
                  className="text-[10px] opacity-0 group-hover:opacity-60 hover:!opacity-100 flex-shrink-0 transition-opacity" style={{ color: '#ef4444' }}>✕</button>
        </div>
        {/* Expanded children */}
        {isExpanded && !isLeaf && (
          <div>
            {node.children.map(c => renderDetailTree(c, depth + 1))}
            {/* Add child inline */}
            <div className="flex items-center gap-1.5 py-1 ml-3" style={{ paddingLeft: 8, borderLeft: `1px dashed ${s.divider}` }}>
              <span className="text-[10px] flex-shrink-0" style={{ color: swatch }}>+</span>
              <input type="text" value={addInputParentId === node.id ? newChild : ''}
                     onChange={e => { setAddInputParentId(node.id); setNewChild(e.target.value); }}
                     onFocus={() => setAddInputParentId(node.id)}
                     onKeyDown={e => { if (e.key === 'Enter' && newChild.trim()) { addChild(node.id); } }}
                     placeholder="添加子项..."
                     className="flex-1 text-xs outline-none bg-transparent py-0.5"
                     style={{ color: s.text1 }} />
              {addInputParentId === node.id && newChild.trim() && (
                <button onClick={() => addChild(node.id)} className="text-[10px] font-bold flex-shrink-0" style={{ color: swatch }}>添加</button>
              )}
              <button onClick={e => { e.stopPropagation(); voiceChild.start(); }}
                      className={`text-xs flex-shrink-0 transition-colors ${voiceChild.phase !== 'idle' ? 'animate-pulse' : ''}`}
                      style={{ color: voiceChild.phase !== 'idle' ? swatch : s.textMuted }}>🎤</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex" style={{ backgroundColor: s.bg }}>

      {/* ══════════ LEFT PANEL ══════════ */}
      <div className="w-[480px] flex-shrink-0 flex flex-col border-r" style={{ backgroundColor: s.panelBg, borderColor: s.divider }}>

        {/* Header banner */}
        <div className="flex-shrink-0 px-5 pb-5 relative overflow-hidden" style={{ paddingTop: '1.2rem', ...(skin.headerBgImage ? { backgroundImage: `url(${skin.headerBgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: `linear-gradient(135deg, ${skin.headerFrom} 0%, ${skin.headerTo} 100%)` }) }}>
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${skin.sidebarFrom}cc, ${skin.sidebarTo}bb)` }} />
          <ParticleEffect color={skin.swatch} count={30} />
          <div className="relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-wide text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>人生旅途</h2>
                <div className="flex items-center gap-2 mt-2 text-xs text-white/70">
                  <span>出生年份</span>
                  <input type="number" value={birthYear} onChange={e => setBirthYear(Number(e.target.value))}
                    className="w-16 px-1.5 py-0.5 rounded text-center text-xs border focus:outline-none bg-white/20 text-white border-white/20" />
                  <span className="text-white/40">|</span>
                  <span>当前 {currentYear - birthYear} 岁</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1 rounded-full overflow-hidden bg-white/15">
                    <div className="h-full rounded-full transition-all bg-white/40" style={{ width: `${Math.min(((currentYear - birthYear) / 80) * 100, 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-white/60">{currentYear - birthYear}/80</span>
                </div>
              </div>
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 text-white/50 hover:text-white transition-colors"
                style={{ background: 'rgba(0,0,0,0.2)' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Period selector row */}
        <div className="flex-shrink-0 px-5 py-2 flex items-center gap-2 border-b" style={{ borderColor: s.divider, backgroundColor: s.cardBg }}>
          {(['annual', 'Q1', 'Q2', 'Q3', 'Q4'] as PeriodType[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
                    className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                    style={{ backgroundColor: period === p ? swatch : s.panelBg, color: period === p ? '#fff' : s.text2, border: `1px solid ${period === p ? swatch : s.divider}` }}>
              {p === 'annual' ? '年度' : p}
            </button>
          ))}
        </div>

        {/* Stats row */}
        <div className="flex-shrink-0 px-5 py-2 flex items-center gap-4 text-xs border-b" style={{ borderColor: s.divider, backgroundColor: s.cardBg }}>
          <span style={{ color: s.textMuted }}>目标 <b style={{ color: s.text1 }}>{globalStats.totalOKRs}</b></span>
          <span style={{ color: s.textMuted }}>子项 <b style={{ color: s.text1 }}>{globalStats.totalNodes}</b></span>
          <span style={{ color: s.textMuted }}>已完成 <b style={{ color: '#22c55e' }}>{globalStats.doneNodes}</b></span>
          <span style={{ color: s.textMuted }}>完成率 <b style={{ color: swatch }}>{globalStats.avgProgress}%</b></span>
        </div>

        {/* Add goal inline */}
        <div className="flex-shrink-0 px-5 py-2 flex items-center gap-2 border-b" style={{ borderColor: s.divider }}>
          <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && addGoal()}
                 placeholder="输入目标，回车创建" className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
                 style={{ backgroundColor: s.cardBg, color: s.text1, border: `1px solid ${s.divider}` }} />
          {/* Voice button */}
          <button onClick={voiceTop.phase !== 'idle' ? undefined : voiceTop.start}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
                  style={{ backgroundColor: voiceTop.phase === 'listening' ? '#ef4444' : voiceTop.phase !== 'idle' ? swatch : s.cardBg, border: `1px solid ${s.divider}`, color: voiceTop.phase !== 'idle' ? '#fff' : s.textMuted }}
                  disabled={voiceTop.phase !== 'idle'}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>
          <button onClick={addGoal} disabled={!newTitle.trim()} className="px-3 py-1.5 rounded-lg text-white text-xs font-bold disabled:opacity-40"
                  style={{ backgroundColor: swatch }}>+ 目标</button>
        </div>

        {/* Goal tree list */}
        <div className="flex-1 overflow-y-auto">
          {filteredGoals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: s.textMuted }}>
              <span className="text-4xl mb-2">🎯</span>
              <p className="text-sm">输入目标开始吧</p>
            </div>
          ) : filteredGoals.map(g => renderLeftItem(g))}
        </div>
      </div>

      {/* ══════════ RIGHT PANEL: DETAIL ══════════ */}
      <div className="flex-1 overflow-y-auto">
        {!selectedGoal ? (
          <div className="flex flex-col items-center justify-center h-full" style={{ color: s.textMuted }}>
            <span className="text-5xl mb-3">👈</span>
            <p>选择左侧目标查看详情</p>
          </div>
        ) : (() => {
          const node = selectedGoal;
          const pct = Math.round(nodeProgress(node) * 100);
          const root = selectedRoot;
          const labels = root ? getPathLabels([root], node.id) : [node.title];
          return (
            <div className="p-6 space-y-5">
              {/* Breadcrumb */}
              <div className="text-xs flex items-center gap-1 flex-wrap" style={{ color: s.textMuted }}>
                {labels.map((l, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span>→</span>}
                    <span className={i === labels.length - 1 ? 'font-bold' : ''} style={{ color: i === labels.length - 1 ? s.text1 : s.textMuted }}>{l}</span>
                  </span>
                ))}
              </div>

              {/* Node header */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  {editingId === node.id ? (
                    <input autoFocus value={editText} onChange={e => setEditText(e.target.value)}
                           onBlur={() => saveTitle(node.id)}
                           onKeyDown={e => { if (e.key === 'Enter') saveTitle(node.id); if (e.key === 'Escape') setEditingId(null); }}
                           className="flex-1 text-lg font-bold outline-none rounded-lg px-2 py-1"
                           style={{ backgroundColor: s.cardBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                  ) : (
                    <h2 className="flex-1 text-lg font-bold cursor-pointer hover:opacity-80" style={{ color: s.text1 }}
                        onClick={() => { setEditingId(node.id); setEditText(node.title); }}>
                      {node.title}
                    </h2>
                  )}
                  <span className="text-2xl font-bold flex-shrink-0" style={{ color: pct > 0 ? swatch : s.textMuted }}>{pct}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">{pb(pct, 8, swatch)}</div>
                  <span className="text-sm whitespace-nowrap" style={{ color: s.textMuted }}>{node.children.length}个子项</span>
                  <button onClick={() => setShowReview(!showReview)}
                          className="text-xs px-2 py-1 rounded hover:opacity-70" style={{ color: s.textMuted }}>复盘</button>
                  <button onClick={() => deleteGoal(node.id)}
                          className="text-xs px-2 py-1 rounded hover:opacity-70" style={{ color: '#ef4444' }}>删除</button>
                </div>
              </div>

              {/* Add child - simple inline */}
              <div className="flex items-center gap-2 py-2" style={{ borderBottom: `1px solid ${s.divider}` }}>
                <span className="text-sm flex-shrink-0 font-bold" style={{ color: swatch }}>+</span>
                <input ref={addInputRef} type="text" value={addInputParentId === node.id ? newChild : ''}
                       onChange={e => { setAddInputParentId(node.id); setNewChild(e.target.value); }}
                       onFocus={() => setAddInputParentId(node.id)}
                       onKeyDown={e => e.key === 'Enter' && addChild(node.id)}
                       placeholder="添加子目标 / 执行步骤..."
                       className="flex-1 text-sm outline-none bg-transparent"
                       style={{ color: s.text1 }} />
                {/* Voice for child */}
                <button onClick={voiceChild.phase !== 'idle' ? undefined : voiceChild.start}
                        className="w-7 h-7 flex items-center justify-center rounded transition-all flex-shrink-0"
                        style={{ backgroundColor: voiceChild.phase === 'listening' ? '#ef4444' : voiceChild.phase !== 'idle' ? swatch : 'transparent', color: voiceChild.phase !== 'idle' ? '#fff' : s.textMuted }}
                        disabled={voiceChild.phase !== 'idle'}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </button>
                {addInputParentId === node.id && newChild.trim() && (
                  <button onClick={() => addChild(node.id)} className="text-xs font-bold flex-shrink-0" style={{ color: swatch }}>添加</button>
                )}
              </div>

              {/* Children tree */}
              {renderDetailTree(node)}

              {/* Review */}
              {showReview && (
                <div className="rounded-xl p-4" style={{ backgroundColor: s.cardBg, border: `1px solid ${s.divider}` }}>
                  <div className="text-sm font-medium mb-2" style={{ color: s.text1 }}>复盘记录</div>
                  {node.reviews.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {node.reviews.map(r => (
                        <div key={r.id} className="text-sm px-3 py-1.5 rounded-lg" style={{ backgroundColor: s.panelBg }}>
                          <span className="text-[11px]" style={{ color: s.textMuted }}>{r.date}</span>
                          <span className="ml-2" style={{ color: s.text2 }}>{r.content}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input type="text" value={reviewText} onChange={e => setReviewText(e.target.value)}
                           onKeyDown={e => e.key === 'Enter' && addReview(node.id)}
                           placeholder="复盘记录..." className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
                           style={{ backgroundColor: s.panelBg, color: s.text1, border: `1px solid ${s.divider}` }} />
                    <button onClick={() => addReview(node.id)} disabled={!reviewText.trim()}
                            className="text-sm font-bold disabled:opacity-30" style={{ color: swatch }}>↵</button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Voice recognition modal */}
      {(voiceTop.phase !== 'idle' || voiceChild.phase !== 'idle') && (() => {
        const v = voiceTop.phase !== 'idle' ? voiceTop : voiceChild;
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="rounded-2xl p-6 w-[360px] shadow-2xl" style={{ backgroundColor: s.panelBg }}>
              {/* Listening phase */}
              {v.phase === 'listening' && (
                <div className="text-center">
                  {/* Sound wave animation */}
                  <div className="flex items-center justify-center gap-1 h-12 mb-4">
                    {[0,1,2,3,4,5,6,7,8].map(i => (
                      <div key={i} className="w-1.5 rounded-full animate-pulse" style={{
                        backgroundColor: '#ef4444',
                        height: `${16 + Math.random() * 24}px`,
                        animationDelay: `${i * 0.1}s`,
                        animationDuration: '0.6s',
                      }} />
                    ))}
                  </div>
                  <div className="text-sm font-medium mb-2" style={{ color: s.text1 }}>正在聆听...</div>
                  <div className="text-xs" style={{ color: s.textMuted }}>请说出您的目标</div>
                  {v.rawText && (
                    <div className="mt-4 rounded-lg px-3 py-2 text-sm text-left" style={{ backgroundColor: s.cardBg, color: s.text2 }}>
                      {v.rawText}<span className="animate-pulse">|</span>
                    </div>
                  )}
                  <button onClick={v.stop} className="mt-4 px-4 py-1.5 rounded-lg text-xs" style={{ backgroundColor: s.cardBg, color: s.text2, border: `1px solid ${s.divider}` }}>取消</button>
                </div>
              )}
              {/* Recognized → Polishing transition */}
              {(v.phase === 'recognized' || v.phase === 'polishing') && (
                <div>
                  <div className="text-xs mb-2" style={{ color: s.textMuted }}>语音识别结果</div>
                  <div className="rounded-lg px-3 py-2 text-sm mb-4" style={{ backgroundColor: s.cardBg, color: s.text2 }}>
                    {v.rawText}
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-px flex-1" style={{ backgroundColor: s.divider }} />
                    <span className="text-xs animate-pulse" style={{ color: swatch }}>AI 润色中...</span>
                    <div className="h-px flex-1" style={{ backgroundColor: s.divider }} />
                  </div>
                  <div className="rounded-lg px-3 py-2 text-sm min-h-[40px]" style={{ backgroundColor: s.cardBg, border: `1px dashed ${swatch}`, color: s.textMuted }}>
                    {v.polishedText || '...'}
                  </div>
                </div>
              )}
              {/* Done */}
              {v.phase === 'done' && (
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: '#10b981' }}>
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="text-xs mb-1" style={{ color: s.textMuted }}>原文</div>
                  <div className="rounded-lg px-3 py-1.5 text-sm mb-2 line-through" style={{ backgroundColor: s.cardBg, color: s.textMuted }}>
                    {v.rawText}
                  </div>
                  <div className="text-xs mb-1" style={{ color: swatch }}>润色结果</div>
                  <div className="rounded-lg px-3 py-1.5 text-sm font-medium" style={{ backgroundColor: s.cardBg, color: s.text1, border: `1px solid ${swatch}` }}>
                    {v.polishedText}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
