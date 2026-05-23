'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SkinTheme } from '@/lib/skins';

// ── OKR Data Types ──

interface KeyResult {
  id: string;
  text: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  updates: { value: number; date: string; note?: string }[];
}

interface Objective {
  id: string;
  title: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4' | '全年';
  confidence: number; // 1-10
  keyResults: KeyResult[];
  createdAt: number;
}

// ── Helper ──

const genId = () => Math.random().toString(36).slice(2, 10);
const STORAGE_KEY = 'okr-data';

function getProgress(o: Objective): number {
  if (o.keyResults.length === 0) return 0;
  const total = o.keyResults.reduce((s, kr) => {
    const pct = kr.targetValue > 0 ? Math.min(kr.currentValue / kr.targetValue, 1) : 0;
    return s + pct;
  }, 0);
  return Math.round((total / o.keyResults.length) * 100);
}

function getStatus(pct: number): { label: string; color: string; emoji: string } {
  if (pct >= 70) return { label: 'On Track', color: '#22c55e', emoji: '🟢' };
  if (pct >= 40) return { label: 'At Risk', color: '#eab308', emoji: '🟡' };
  return { label: 'Off Track', color: '#ef4444', emoji: '🔴' };
}

// ── Component ──

interface Props {
  skin: SkinTheme;
  onClose: () => void;
}

export default function OKRPanel({ skin, onClose }: Props) {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newQuarter, setNewQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4' | '全年'>('全年');
  const [generatingKR, setGeneratingKR] = useState(false);
  const [genKRText, setGenKRText] = useState('');
  const [editingKRId, setEditingKRId] = useState<string | null>(null);
  const [updateValue, setUpdateValue] = useState('');
  const [updateNote, setUpdateNote] = useState('');
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const recognitionRef = useRef<ReturnType<typeof createRecognition> | null>(null);

  const selectedObj = objectives.find(o => o.id === selectedId) ?? null;

  // ── Load / Save ──

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setObjectives(JSON.parse(saved));
    } catch { /* ignore */ }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(objectives));
  }, [objectives, mounted]);

  // ── CRUD ──

  const addObjective = useCallback((title: string, quarter: Objective['quarter'], krs?: KeyResult[]) => {
    const obj: Objective = {
      id: genId(),
      title: title.trim(),
      quarter,
      confidence: 7,
      keyResults: krs ?? [],
      createdAt: Date.now(),
    };
    setObjectives(prev => [obj, ...prev]);
    setSelectedId(obj.id);
    setCreating(false);
    setNewTitle('');
  }, []);

  const deleteObjective = useCallback((id: string) => {
    setObjectives(prev => prev.filter(o => o.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const updateObjective = useCallback((id: string, patch: Partial<Objective>) => {
    setObjectives(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o));
  }, []);

  const addKR = useCallback((objId: string) => {
    const kr: KeyResult = {
      id: genId(),
      text: '新关键结果',
      currentValue: 0,
      targetValue: 100,
      unit: '%',
      updates: [],
    };
    updateObjective(objId, { keyResults: [...(objectives.find(o => o.id === objId)?.keyResults ?? []), kr] });
  }, [objectives, updateObjective]);

  const updateKR = useCallback((objId: string, krId: string, patch: Partial<KeyResult>) => {
    const obj = objectives.find(o => o.id === objId);
    if (!obj) return;
    updateObjective(objId, {
      keyResults: obj.keyResults.map(kr => kr.id === krId ? { ...kr, ...patch } : kr),
    });
  }, [objectives, updateObjective]);

  const deleteKR = useCallback((objId: string, krId: string) => {
    const obj = objectives.find(o => o.id === objId);
    if (!obj) return;
    updateObjective(objId, {
      keyResults: obj.keyResults.filter(kr => kr.id !== krId),
    });
  }, [objectives, updateObjective]);

  const recordUpdate = useCallback((objId: string, krId: string, value: number, note?: string) => {
    const obj = objectives.find(o => o.id === objId);
    if (!obj) return;
    const kr = obj.keyResults.find(k => k.id === krId);
    if (!kr) return;
    const newUpdate = { value, date: new Date().toISOString().slice(0, 10), note };
    updateKR(objId, krId, {
      currentValue: value,
      updates: [...kr.updates, newUpdate],
    });
    setEditingKRId(null);
    setUpdateValue('');
    setUpdateNote('');
  }, [objectives, updateKR]);

  // ── AI Generate KR ──

  const generateKR = useCallback(async (title: string) => {
    setGeneratingKR(true);
    setGenKRText('');
    try {
      const res = await fetch('/api/okr-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objective: title }),
      });
      if (!res.ok || !res.body) throw new Error('Failed');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setGenKRText(text);
      }
      // Parse KR lines from AI response
      const lines = text.split('\n').filter(l => l.trim().startsWith('-') || l.trim().match(/^\d+\./));
      const krs: KeyResult[] = lines.slice(0, 5).map(line => {
        const cleanText = line.replace(/^[-\d.)\s]+/, '').trim();
        return {
          id: genId(),
          text: cleanText,
          currentValue: 0,
          targetValue: 100,
          unit: '%',
          updates: [],
        };
      });
      if (krs.length > 0) {
        // Add KRs to the just-created objective
        setObjectives(prev => prev.map(o =>
          o.title.trim() === title.trim() && o.keyResults.length === 0
            ? { ...o, keyResults: krs }
            : o
        ));
      }
    } catch {
      setGenKRText('生成失败，请手动添加KR');
    } finally {
      setGeneratingKR(false);
    }
  }, []);

  // ── Voice ──

  function createRecognition() {
    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SR) return null;
    const rec = new (SR as new () => { continuous: boolean; interimResults: boolean; lang: string; start(): void; stop(): void; onresult: ((e: unknown) => void) | null; onerror: ((e: unknown) => void) | null; onend: (() => void) | null })();
    return rec;
  }

  const startVoice = useCallback(() => {
    const rec = createRecognition();
    if (!rec) return;
    rec.lang = 'zh-CN';
    rec.continuous = true;
    rec.interimResults = true;
    recognitionRef.current = rec;
    setVoiceActive(true);
    setVoiceText('');

    rec.onresult = (ev: unknown) => {
      const e = ev as { results: { transcript: string }[][] };
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setVoiceText(t);
    };
    rec.onend = () => {
      setVoiceActive(false);
      recognitionRef.current = null;
    };
    rec.start();
  }, []);

  const stopVoice = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setVoiceActive(false);
    if (voiceText.trim()) {
      addObjective(voiceText.trim(), newQuarter);
      generateKR(voiceText.trim());
    }
  }, [voiceText, newQuarter, addObjective, generateKR]);

  // ── Year Stats ──

  const yearPct = objectives.length > 0
    ? Math.round(objectives.reduce((s, o) => s + getProgress(o), 0) / objectives.length)
    : 0;
  const yearStatus = getStatus(yearPct);

  if (!mounted) return null;

  // ── Render ──

  return (
    <div className="fixed inset-0 z-50 flex" style={{ backgroundColor: '#0f0f1a' }}>
      {/* LEFT: Objective List */}
      <div className="flex flex-col" style={{ width: 480, backgroundColor: skin.swatch + '08', borderRight: `1px solid ${skin.swatch}20` }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ height: 110, background: `linear-gradient(135deg, ${skin.headerFrom}, ${skin.headerTo})` }}>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              🎯 年度 OKR
            </h1>
            <p className="text-sm text-white/70 mt-1">目标与关键结果</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
          >✕</button>
        </div>

        {/* Create + Voice */}
        <div className="px-4 py-3 flex gap-2">
          <button
            onClick={() => { setCreating(true); setNewTitle(''); }}
            className="flex-1 h-10 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-1 transition-all hover:opacity-90"
            style={{ backgroundColor: skin.swatch }}
          >
            + 新建目标
          </button>
          <button
            onClick={voiceActive ? stopVoice : startVoice}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
            style={{
              backgroundColor: voiceActive ? '#ef4444' : skin.swatch + '20',
              color: voiceActive ? '#fff' : skin.swatch,
            }}
          >
            🎤
          </button>
        </div>

        {/* Voice feedback */}
        {voiceActive && (
          <div className="mx-4 mb-2 px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: skin.swatch + '15', color: skin.swatch }}>
            <span className="animate-pulse">🔴 正在聆听...</span>
            {voiceText && <p className="mt-1 text-xs opacity-80">{voiceText}</p>}
          </div>
        )}

        {/* Create form */}
        {creating && (
          <div className="mx-4 mb-3 p-4 rounded-xl" style={{ backgroundColor: skin.swatch + '10', border: `1px solid ${skin.swatch}30` }}>
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="输入目标，如：建立技术影响力"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border text-white text-sm placeholder:text-white/30 focus:outline-none"
              style={{ borderColor: skin.swatch + '40' }}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && newTitle.trim()) {
                  addObjective(newTitle.trim(), newQuarter);
                  generateKR(newTitle.trim());
                }
              }}
            />
            <div className="flex gap-1 mt-2">
              {(['Q1', 'Q2', 'Q3', 'Q4', '全年'] as const).map(q => (
                <button
                  key={q}
                  onClick={() => setNewQuarter(q)}
                  className="px-2 py-1 rounded text-xs font-medium transition-all"
                  style={{
                    backgroundColor: newQuarter === q ? skin.swatch : 'transparent',
                    color: newQuarter === q ? '#fff' : 'rgba(255,255,255,0.5)',
                  }}
                >{q}</button>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { if (newTitle.trim()) { addObjective(newTitle.trim(), newQuarter); generateKR(newTitle.trim()); } }}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: skin.swatch }}
              >创建</button>
              <button
                onClick={() => setCreating(false)}
                className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white/80 transition-colors"
              >取消</button>
            </div>
          </div>
        )}

        {/* AI generating feedback */}
        {generatingKR && (
          <div className="mx-4 mb-2 px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: skin.swatch + '10', color: skin.swatch }}>
            <span className="animate-pulse">🤖 AI 正在生成关键结果...</span>
            {genKRText && <pre className="mt-1 text-xs opacity-70 whitespace-pre-wrap max-h-32 overflow-y-auto">{genKRText}</pre>}
          </div>
        )}

        {/* Objective list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {objectives.length === 0 && !creating && (
            <div className="text-center mt-16 text-white/30">
              <div className="text-5xl mb-4">🎯</div>
              <p className="text-lg font-medium">创建你的第一个目标</p>
              <p className="text-sm mt-1">点击"新建目标"或使用语音创建</p>
            </div>
          )}

          {objectives.map(obj => {
            const pct = getProgress(obj);
            const status = getStatus(pct);
            const isSelected = selectedId === obj.id;
            return (
              <div
                key={obj.id}
                onClick={() => setSelectedId(isSelected ? null : obj.id)}
                className="mb-2 p-3 rounded-xl cursor-pointer transition-all"
                style={{
                  backgroundColor: isSelected ? skin.swatch + '20' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isSelected ? skin.swatch + '50' : 'transparent'}`,
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Progress ring */}
                  <div className="relative w-11 h-11 flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90">
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke={status.color} strokeWidth="3"
                        strokeDasharray={`${pct * 0.974} 97.4`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">{pct}%</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">{obj.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: skin.swatch + '20', color: skin.swatch }}>{obj.quarter}</span>
                      <span className="text-xs">{status.emoji} {status.label}</span>
                      <span className="text-xs text-white/30">{obj.keyResults.length} KR</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Year summary */}
        <div className="px-4 py-3 border-t" style={{ borderColor: skin.swatch + '15' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40">年度完成率</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold" style={{ color: yearStatus.color }}>{yearPct}%</span>
              <span className="text-xs">{yearStatus.emoji}</span>
            </div>
          </div>
          <div className="h-1.5 mt-2 rounded-full bg-white/5">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${yearPct}%`, backgroundColor: yearStatus.color }} />
          </div>
        </div>
      </div>

      {/* RIGHT: Objective Detail */}
      <div className="flex-1 overflow-y-auto">
        {!selectedObj ? (
          <div className="flex items-center justify-center h-full text-white/20">
            <div className="text-center">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-lg">选择一个目标查看详情</p>
              <p className="text-sm mt-1">或创建新目标开始规划</p>
            </div>
          </div>
        ) : (
          <div className="p-8 max-w-3xl mx-auto">
            {/* Objective header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: skin.swatch + '20', color: skin.swatch }}>{selectedObj.quarter}</span>
                  <span className="text-xs text-white/30">{new Date(selectedObj.createdAt).toLocaleDateString('zh-CN')}</span>
                </div>
                <input
                  type="text"
                  value={selectedObj.title}
                  onChange={e => updateObjective(selectedObj.id, { title: e.target.value })}
                  className="text-2xl font-bold text-white bg-transparent border-none focus:outline-none w-full"
                />
              </div>
              <button
                onClick={() => deleteObjective(selectedObj.id)}
                className="ml-4 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-400/10 transition-colors"
              >删除目标</button>
            </div>

            {/* Confidence */}
            <div className="mb-8 p-4 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white/60">信心指数</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold" style={{ color: skin.swatch }}>{selectedObj.confidence}</span>
                  <span className="text-sm text-white/30">/ 10</span>
                </div>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={selectedObj.confidence}
                onChange={e => updateObjective(selectedObj.id, { confidence: Number(e.target.value) })}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: skin.swatch }}
              />
              <div className="flex justify-between mt-1">
                <span className="text-xs text-white/20">❄️ 低</span>
                <span className="text-xs text-white/20">😐 中</span>
                <span className="text-xs text-white/20">🔥 高</span>
              </div>
              {selectedObj.confidence <= 4 && (
                <p className="mt-2 text-xs text-amber-400/80">⚠️ 信心较低，这个目标需要更多关注或调整</p>
              )}
            </div>

            {/* Key Results */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">关键结果 (Key Results)</h2>
                <button
                  onClick={() => addKR(selectedObj.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
                  style={{ backgroundColor: skin.swatch + '30' }}
                >+ 添加 KR</button>
              </div>

              {selectedObj.keyResults.length === 0 && (
                <div className="text-center py-8 text-white/20">
                  <p>暂无关键结果</p>
                  <button
                    onClick={() => generateKR(selectedObj.title)}
                    disabled={generatingKR}
                    className="mt-3 px-4 py-2 rounded-lg text-sm text-white transition-colors"
                    style={{ backgroundColor: skin.swatch }}
                  >🤖 AI 生成 KR</button>
                </div>
              )}

              {selectedObj.keyResults.map((kr, idx) => {
                const pct = kr.targetValue > 0 ? Math.min(Math.round((kr.currentValue / kr.targetValue) * 100), 100) : 0;
                const krStatus = getStatus(pct);
                return (
                  <div key={kr.id} className="mb-3 p-4 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderLeft: `3px solid ${krStatus.color}` }}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold" style={{ color: skin.swatch }}>KR{idx + 1}</span>
                          <span className="text-xs">{krStatus.emoji}</span>
                        </div>
                        <input
                          type="text"
                          value={kr.text}
                          onChange={e => updateKR(selectedObj.id, kr.id, { text: e.target.value })}
                          className="text-sm text-white bg-transparent border-none focus:outline-none w-full font-medium"
                        />
                      </div>
                      <button
                        onClick={() => deleteKR(selectedObj.id, kr.id)}
                        className="ml-2 text-white/20 hover:text-red-400 transition-colors text-xs"
                      >✕</button>
                    </div>

                    {/* Progress */}
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="h-2 rounded-full bg-white/5">
                          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: krStatus.color }} />
                        </div>
                      </div>
                      <span className="text-sm font-mono" style={{ color: krStatus.color }}>
                        {kr.currentValue} / {kr.targetValue} {kr.unit}
                      </span>
                    </div>

                    {/* Update button */}
                    {editingKRId === kr.id ? (
                      <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={updateValue}
                            onChange={e => setUpdateValue(e.target.value)}
                            placeholder="当前值"
                            className="flex-1 px-2 py-1.5 rounded-lg bg-white/5 border text-white text-sm focus:outline-none"
                            style={{ borderColor: skin.swatch + '30' }}
                          />
                          <input
                            type="text"
                            value={updateNote}
                            onChange={e => setUpdateNote(e.target.value)}
                            placeholder="备注(选填)"
                            className="flex-1 px-2 py-1.5 rounded-lg bg-white/5 border text-white text-sm focus:outline-none"
                            style={{ borderColor: skin.swatch + '30' }}
                          />
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => {
                              const v = parseFloat(updateValue);
                              if (!isNaN(v)) recordUpdate(selectedObj.id, kr.id, v, updateNote || undefined);
                            }}
                            className="px-3 py-1 rounded-lg text-xs text-white font-medium"
                            style={{ backgroundColor: skin.swatch }}
                          >确认</button>
                          <button
                            onClick={() => { setEditingKRId(null); setUpdateValue(''); setUpdateNote(''); }}
                            className="px-3 py-1 rounded-lg text-xs text-white/40 hover:text-white/60 transition-colors"
                          >取消</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingKRId(kr.id); setUpdateValue(String(kr.currentValue)); setUpdateNote(''); }}
                        className="mt-2 px-3 py-1 rounded-lg text-xs text-white/40 hover:text-white/60 transition-colors"
                        style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                      >📈 更新进度</button>
                    )}

                    {/* Update history */}
                    {kr.updates.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {kr.updates.slice(-3).reverse().map((u, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-white/30">
                            <span>{u.date}</span>
                            <span style={{ color: skin.swatch }}>{u.value} {kr.unit}</span>
                            {u.note && <span className="truncate">{u.note}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* AI Generate KR button (when some KRs exist) */}
              {selectedObj.keyResults.length > 0 && (
                <button
                  onClick={() => generateKR(selectedObj.title)}
                  disabled={generatingKR}
                  className="mt-2 w-full py-2.5 rounded-xl text-sm text-white/40 hover:text-white/60 transition-colors"
                  style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
                >🤖 重新生成 KR</button>
              )}
            </div>

            {/* Execution Tracking */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-4">执行追踪</h2>
              {(() => {
                const allUpdates: { date: string; krText: string; value: number; unit: string; note?: string }[] = [];
                selectedObj.keyResults.forEach(kr => {
                  kr.updates.forEach(u => {
                    allUpdates.push({ date: u.date, krText: kr.text, value: u.value, unit: kr.unit, note: u.note });
                  });
                });
                allUpdates.sort((a, b) => b.date.localeCompare(a.date));
                if (allUpdates.length === 0) {
                  return <p className="text-sm text-white/20">暂无更新记录</p>;
                }
                return (
                  <div className="space-y-2">
                    {allUpdates.slice(0, 10).map((u, i) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                        <span className="text-xs text-white/30 w-20 flex-shrink-0">{u.date}</span>
                        <span className="text-sm text-white/60 flex-1 truncate">{u.krText}</span>
                        <span className="text-sm font-mono" style={{ color: skin.swatch }}>{u.value} {u.unit}</span>
                        {u.note && <span className="text-xs text-white/30 truncate max-w-32">{u.note}</span>}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
