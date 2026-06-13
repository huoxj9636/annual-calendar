'use client';

import { useState, useEffect } from 'react';
import type { SkinTheme } from '@/lib/skins';

interface AchievementPanelProps {
  year: number;
  month: number;
  day: number;
  skin: SkinTheme;
  onClose: () => void;
}

interface Achievement {
  id: string;
  type: 'document' | 'video' | 'podcast' | 'other';
  title: string;
  description: string;
  url?: string;
  createdAt: string;
}

interface DailyReview {
  completed: string;
  goodThings: string;
  problems: string;
  mood: string;
  reflections: string;
  tomorrowTodo: string;
  moodScore: number;
  energy: number;
}

const TYPE_CONFIG = {
  document: { icon: '📄', label: '文档', color: '#3b82f6' },
  video: { icon: '🎬', label: '视频', color: '#ef4444' },
  podcast: { icon: '🎙', label: '播客', color: '#10b981' },
  other: { icon: '📦', label: '其他', color: '#f59e0b' },
};

export default function AchievementPanel({ year, month, day, skin, onClose }: AchievementPanelProps) {
  const [review, setReview] = useState<DailyReview | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<Achievement['type']>('document');
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [loading, setLoading] = useState(true);

  const dateStr = `${year}-${month}-${day}`;
  const storageKey = `achievements-${dateStr}`;

  // Load data on mount
  useEffect(() => {
    setLoading(true);
    // Load review from API
    fetch(`/api/daily-review?year=${year}&month=${month}&day=${day}`)
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) {
          setReview({
            completed: data.completed || '',
            goodThings: data.goodThings || '',
            problems: data.problems || '',
            mood: data.mood || '',
            reflections: data.reflections || '',
            tomorrowTodo: data.tomorrowTodo || '',
            moodScore: data.moodScore ?? 3,
            energy: data.energy ?? 3,
          });
        }
      })
      .catch(() => {});
    // Load achievements from localStorage
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setAchievements(JSON.parse(stored));
    } catch {}
    setLoading(false);
  }, [year, month, day, storageKey]);

  // Save achievements to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(achievements));
  }, [achievements, storageKey]);

  const handleAdd = () => {
    if (!formTitle.trim()) return;
    const newAch: Achievement = {
      id: `ach_${Date.now()}`,
      type: formType,
      title: formTitle.trim(),
      description: formDesc.trim(),
      url: formUrl.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    setAchievements(prev => [...prev, newAch]);
    setShowForm(false);
    setFormTitle('');
    setFormDesc('');
    setFormUrl('');
  };

  const handleDelete = (id: string) => {
    setAchievements(prev => prev.filter(a => a.id !== id));
  };

  const typeOptions: Achievement['type'][] = ['document', 'video', 'podcast', 'other'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="w-[640px] max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ backgroundColor: skin.panelBg }}>
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b" style={{ borderColor: skin.divider }}>
          <div>
            <div className="text-lg font-bold" style={{ color: skin.textPrimary }}>成果 · {month}月{day}日</div>
            <div className="text-xs mt-0.5" style={{ color: skin.textMuted }}>今日复盘 · 输出成果</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors cursor-pointer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={skin.textMuted} strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${skin.swatch}40`, borderTopColor: skin.swatch }} />
            </div>
          )}

          {/* 今日复盘 */}
          <section className="mb-6">
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2" style={{ color: skin.textPrimary }}>
              <span>📝</span>
              <span>今日复盘</span>
              {!review && <span className="text-xs opacity-50" style={{ color: skin.textMuted }}>（未录入）</span>}
            </h2>
            {review && (
              <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: skin.cardBg }}>
                {review.completed && (
                  <div>
                    <div className="text-xs font-medium mb-1" style={{ color: skin.swatch }}>✓ 完成了什么</div>
                    <div className="text-sm whitespace-pre-wrap" style={{ color: skin.textPrimary }}>{review.completed}</div>
                  </div>
                )}
                {review.goodThings && (
                  <div>
                    <div className="text-xs font-medium mb-1" style={{ color: skin.swatch }}>✨ 美好/值得关注的事</div>
                    <div className="text-sm whitespace-pre-wrap" style={{ color: skin.textPrimary }}>{review.goodThings}</div>
                  </div>
                )}
                {review.problems && (
                  <div>
                    <div className="text-xs font-medium mb-1" style={{ color: '#ef4444' }}>⚠ 突发问题</div>
                    <div className="text-sm whitespace-pre-wrap" style={{ color: skin.textPrimary }}>{review.problems}</div>
                  </div>
                )}
                {review.mood && (
                  <div>
                    <div className="text-xs font-medium mb-1" style={{ color: skin.swatch }}>💭 心情</div>
                    <div className="text-sm whitespace-pre-wrap" style={{ color: skin.textPrimary }}>{review.mood}</div>
                  </div>
                )}
                {review.reflections && (
                  <div>
                    <div className="text-xs font-medium mb-1" style={{ color: skin.swatch }}>💡 感想/总结</div>
                    <div className="text-sm whitespace-pre-wrap" style={{ color: skin.textPrimary }}>{review.reflections}</div>
                  </div>
                )}
                {review.tomorrowTodo && (
                  <div>
                    <div className="text-xs font-medium mb-1" style={{ color: skin.swatch }}>📌 明日待办</div>
                    <div className="text-sm whitespace-pre-wrap" style={{ color: skin.textPrimary }}>{review.tomorrowTodo}</div>
                  </div>
                )}
                {/* Mood & Energy */}
                <div className="flex gap-4 pt-2 border-t" style={{ borderColor: skin.divider }}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs" style={{ color: skin.textMuted }}>心情</span>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(i => (
                        <span key={i} className={`w-3 h-3 rounded-full ${review.moodScore >= i ? '' : 'opacity-30'}`} style={{ backgroundColor: review.moodScore >= i ? skin.swatch : skin.textMuted }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs" style={{ color: skin.textMuted }}>精力</span>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(i => (
                        <span key={i} className={`w-3 h-3 rounded-full ${review.energy >= i ? '' : 'opacity-30'}`} style={{ backgroundColor: review.energy >= i ? '#10b981' : skin.textMuted }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* 输出成果 */}
          <section>
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2" style={{ color: skin.textPrimary }}>
              <span>🏆</span>
              <span>输出成果</span>
              <span className="text-xs opacity-50" style={{ color: skin.textMuted }}>（{achievements.length}项）</span>
            </h2>

            {/* Achievement list */}
            {achievements.length > 0 && (
              <div className="space-y-2 mb-3">
                {achievements.map(ach => {
                  const cfg = TYPE_CONFIG[ach.type];
                  return (
                    <div key={ach.id} className="rounded-xl p-3 flex items-start gap-3 group" style={{ backgroundColor: skin.cardBg }}>
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}>
                        {cfg.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: skin.textPrimary }}>{ach.title}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${cfg.color}15`, color: cfg.color }}>{cfg.label}</span>
                        </div>
                        {ach.description && (
                          <div className="text-xs mt-0.5" style={{ color: skin.textMuted }}>{ach.description}</div>
                        )}
                        {ach.url && (
                          <a href={ach.url} target="_blank" rel="noopener noreferrer" className="text-xs mt-0.5 underline opacity-70 hover:opacity-100" style={{ color: skin.swatch }}>
                            {ach.url}
                          </a>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(ach.id)}
                        className="w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/10 hover:bg-red-500/20 text-red-500 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add button */}
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="w-full py-2.5 rounded-xl border-2 border-dashed text-sm font-medium transition-all hover:opacity-80 cursor-pointer"
                style={{ borderColor: skin.divider, color: skin.textMuted }}
              >
                + 添加成果
              </button>
            )}

            {/* Add form */}
            {showForm && (
              <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: skin.cardBg }}>
                {/* Type selector */}
                <div className="flex gap-2">
                  {typeOptions.map(t => {
                    const cfg = TYPE_CONFIG[t];
                    return (
                      <button
                        key={t}
                        onClick={() => setFormType(t)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${formType === t ? '' : 'opacity-60'}`}
                        style={{ backgroundColor: formType === t ? `${cfg.color}20` : 'transparent', color: formType === t ? cfg.color : skin.textMuted }}
                      >
                        <span>{cfg.icon}</span>
                        <span>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
                {/* Title */}
                <input
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
                  style={{ backgroundColor: skin.panelBg, borderColor: skin.divider, color: skin.textPrimary }}
                  placeholder="成果标题"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  autoFocus
                />
                {/* Description */}
                <input
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
                  style={{ backgroundColor: skin.panelBg, borderColor: skin.divider, color: skin.textPrimary }}
                  placeholder="简要描述（可选）"
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                />
                {/* URL */}
                <input
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
                  style={{ backgroundColor: skin.panelBg, borderColor: skin.divider, color: skin.textPrimary }}
                  placeholder="链接地址（可选）"
                  value={formUrl}
                  onChange={e => setFormUrl(e.target.value)}
                />
                {/* Actions */}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setShowForm(false); setFormTitle(''); setFormDesc(''); setFormUrl(''); }}
                    className="px-4 py-1.5 rounded-lg text-sm cursor-pointer"
                    style={{ backgroundColor: skin.divider, color: skin.textPrimary }}
                  >取消</button>
                  <button
                    onClick={handleAdd}
                    disabled={!formTitle.trim()}
                    className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 cursor-pointer"
                    style={{ backgroundColor: skin.swatch }}
                  >添加</button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}