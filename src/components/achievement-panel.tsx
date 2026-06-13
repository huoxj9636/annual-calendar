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
  const [panelLeft, setPanelLeft] = useState(() => {
    if (typeof window === 'undefined') return 400;
    const saved = localStorage.getItem('panel-left-achievement');
    return saved ? parseInt(saved, 10) : 400;
  });

  const dateStr = `${year}-${month}-${day}`;
  const storageKey = `achievements-${dateStr}`;

  // Load data on mount
  useEffect(() => {
    setLoading(true);
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
      .catch(() => {})
      .finally(() => setLoading(false));
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setAchievements(JSON.parse(stored));
    } catch {}
  }, [year, month, day, storageKey]);

  // Save achievements to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(achievements));
  }, [achievements, storageKey]);

  const addAchievement = () => {
    if (!formTitle.trim()) return;
    const newAchievement: Achievement = {
      id: Date.now().toString(),
      type: formType,
      title: formTitle,
      description: formDesc,
      url: formUrl || undefined,
      createdAt: new Date().toISOString(),
    };
    setAchievements(prev => [...prev, newAchievement]);
    setFormTitle('');
    setFormDesc('');
    setFormUrl('');
    setShowForm(false);
  };

  const deleteAchievement = (id: string) => {
    setAchievements(prev => prev.filter(a => a.id !== id));
  };

  const renderStars = (score: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} style={{ color: i < score ? skin.swatch : '#ccc', fontSize: '14px' }}>★</span>
    ));
  };

  const s = skin;

  return (
    <div className="absolute top-0 bottom-0 z-40 flex overflow-hidden"
      style={{ backgroundColor: s.panelBg, left: `${panelLeft}px`, right: '-6px' }}>
      {/* 左侧拖拽手柄 */}
      <div
        className="absolute top-0 bottom-0 left-0 w-2 cursor-col-resize z-50 hover:bg-black/10 transition-colors group"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const startX = e.clientX;
          const startLeft = panelLeft;
          let finalLeft = startLeft;
          document.body.style.userSelect = 'none';
          document.body.style.cursor = 'col-resize';
          const onMove = (ev: MouseEvent) => {
            ev.preventDefault();
            const newLeft = Math.max(0, Math.min(startLeft + (ev.clientX - startX), 500));
            finalLeft = newLeft;
            setPanelLeft(newLeft);
          };
          const onUp = () => {
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            localStorage.setItem('panel-left-achievement', String(finalLeft));
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
          };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-10 rounded-full bg-black/15 group-hover:bg-black/40 transition-colors" />
      </div>

      {/* 左侧栏 - 日期信息 */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r"
        style={{ borderColor: s.divider, backgroundColor: `${s.sidebarFrom}10` }}>
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b" style={{ borderColor: s.divider }}>
          <div className="text-lg font-bold" style={{ color: s.textPrimary }}>{month}月{day}日</div>
          <div className="text-xs font-medium tracking-wider mt-0.5" style={{ color: s.swatch }}>DAILY OUTPUT</div>
        </div>

        {/* 成果统计 */}
        <div className="py-4 px-5 border-b" style={{ borderColor: s.divider }}>
          <div className="text-sm font-medium mb-3" style={{ color: s.textPrimary }}>成果统计</div>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
              const count = achievements.filter(a => a.type === key).length;
              return (
                <div key={key} className="text-center">
                  <div className="text-xl">{cfg.icon}</div>
                  <div className="text-xs mt-1 font-bold" style={{ color: cfg.color }}>{count}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 添加成果按钮 - 左下角 */}
        <div className="flex-1 flex flex-col justify-end p-4">
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
            style={{ backgroundColor: s.swatch, color: '#fff' }}
          >
            <span>+</span> 添加成果
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 标题栏 - 带关闭按钮 */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: s.divider }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <div className="text-xl font-bold" style={{ color: s.textPrimary }}>今日成果</div>
              <div className="text-xs" style={{ color: s.textMuted }}>{year}年{month}月{day}日</div>
            </div>
          </div>
          {/* 关闭按钮 - 右上角 */}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={s.textMuted} strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容滚动区 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {loading ? (
            <div className="text-center py-8" style={{ color: s.textMuted }}>加载中...</div>
          ) : (
            <>
              {/* 今日复盘 */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">📝</span>
                  <h2 className="text-lg font-bold" style={{ color: s.textPrimary }}>今日复盘</h2>
                </div>
                {review ? (
                  <div className="space-y-4">
                    {review.completed && (
                      <div className="p-4 rounded-lg border" style={{ borderColor: s.divider, backgroundColor: `${s.sidebarFrom}08` }}>
                        <div className="text-xs font-medium mb-2" style={{ color: s.swatch }}>完成事项</div>
                        <div className="text-sm" style={{ color: s.textPrimary }}>{review.completed}</div>
                      </div>
                    )}
                    {review.goodThings && (
                      <div className="p-4 rounded-lg border" style={{ borderColor: s.divider, backgroundColor: `${s.sidebarFrom}08` }}>
                        <div className="text-xs font-medium mb-2" style={{ color: '#10b981' }}>美好事件</div>
                        <div className="text-sm" style={{ color: s.textPrimary }}>{review.goodThings}</div>
                      </div>
                    )}
                    {review.problems && (
                      <div className="p-4 rounded-lg border" style={{ borderColor: s.divider, backgroundColor: `${s.sidebarFrom}08` }}>
                        <div className="text-xs font-medium mb-2" style={{ color: '#ef4444' }}>突发问题</div>
                        <div className="text-sm" style={{ color: s.textPrimary }}>{review.problems}</div>
                      </div>
                    )}
                    {review.mood && (
                      <div className="p-4 rounded-lg border" style={{ borderColor: s.divider, backgroundColor: `${s.sidebarFrom}08` }}>
                        <div className="text-xs font-medium mb-2" style={{ color: '#f59e0b' }}>心情</div>
                        <div className="text-sm" style={{ color: s.textPrimary }}>{review.mood}</div>
                      </div>
                    )}
                    {review.reflections && (
                      <div className="p-4 rounded-lg border" style={{ borderColor: s.divider, backgroundColor: `${s.sidebarFrom}08` }}>
                        <div className="text-xs font-medium mb-2" style={{ color: '#8b5cf6' }}>感想总结</div>
                        <div className="text-sm" style={{ color: s.textPrimary }}>{review.reflections}</div>
                      </div>
                    )}
                    {review.tomorrowTodo && (
                      <div className="p-4 rounded-lg border" style={{ borderColor: s.divider, backgroundColor: `${s.sidebarFrom}08` }}>
                        <div className="text-xs font-medium mb-2" style={{ color: '#3b82f6' }}>明日待办</div>
                        <div className="text-sm" style={{ color: s.textPrimary }}>{review.tomorrowTodo}</div>
                      </div>
                    )}
                    {/* 心情和精力分数 */}
                    <div className="flex gap-4">
                      <div className="flex-1 p-3 rounded-lg border" style={{ borderColor: s.divider }}>
                        <div className="text-xs font-medium mb-1" style={{ color: s.textMuted }}>心情分数</div>
                        <div className="flex items-center gap-1">{renderStars(review.moodScore)}</div>
                      </div>
                      <div className="flex-1 p-3 rounded-lg border" style={{ borderColor: s.divider }}>
                        <div className="text-xs font-medium mb-1" style={{ color: s.textMuted }}>精力分数</div>
                        <div className="flex items-center gap-1">{renderStars(review.energy)}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border text-center" style={{ borderColor: s.divider, color: s.textMuted }}>
                    今日尚未录入复盘
                  </div>
                )}
              </section>

              {/* 输出成果 */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">💡</span>
                  <h2 className="text-lg font-bold" style={{ color: s.textPrimary }}>输出成果</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: s.swatch, color: '#fff' }}>
                    {achievements.length}
                  </span>
                </div>
                {achievements.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {achievements.map(a => {
                      const cfg = TYPE_CONFIG[a.type];
                      return (
                        <div
                          key={a.id}
                          className="p-4 rounded-lg border group relative transition-colors hover:shadow-md"
                          style={{ borderColor: s.divider }}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">{cfg.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate" style={{ color: s.textPrimary }}>{a.title}</div>
                              {a.description && (
                                <div className="text-xs mt-1 line-clamp-2" style={{ color: s.textMuted }}>{a.description}</div>
                              )}
                              {a.url && (
                                <a
                                  href={a.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs mt-2 inline-flex items-center gap-1 hover:underline"
                                  style={{ color: cfg.color }}
                                >
                                  🔗 查看链接
                                </a>
                              )}
                            </div>
                          </div>
                          {/* 删除按钮 */}
                          <button
                            onClick={() => deleteAchievement(a.id)}
                            className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ backgroundColor: '#fee2e2', color: '#ef4444' }}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 rounded-lg border text-center" style={{ borderColor: s.divider, color: s.textMuted }}>
                    今日暂无成果记录，点击右上角"添加成果"按钮添加
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {/* 添加成果弹窗 */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
          <div className="w-[400px] rounded-xl p-6 shadow-xl" style={{ backgroundColor: s.panelBg }}>
            <h3 className="text-lg font-bold mb-4" style={{ color: s.textPrimary }}>添加成果</h3>
            
            {/* 类型选择 */}
            <div className="mb-4">
              <label className="text-xs font-medium mb-2 block" style={{ color: s.textMuted }}>成果类型</label>
              <div className="flex gap-2">
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setFormType(key as Achievement['type'])}
                    className={`flex-1 py-2 rounded-lg text-center transition-colors ${formType === key ? 'ring-2 ring-offset-1' : ''}`}
                    style={{
                      backgroundColor: formType === key ? `${cfg.color}20` : `${s.sidebarFrom}10`,
                      borderColor: formType === key ? cfg.color : 'transparent',
                      borderWidth: formType === key ? 2 : 0,
                      color: formType === key ? cfg.color : s.textMuted,
                    }}
                  >
                    <span className="text-lg">{cfg.icon}</span>
                    <span className="text-xs ml-1">{cfg.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 标题 */}
            <div className="mb-4">
              <label className="text-xs font-medium mb-2 block" style={{ color: s.textMuted }}>标题 *</label>
              <input
                type="text"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: s.divider, backgroundColor: s.panelBg, color: s.textPrimary }}
                placeholder="成果名称"
              />
            </div>

            {/* 描述 */}
            <div className="mb-4">
              <label className="text-xs font-medium mb-2 block" style={{ color: s.textMuted }}>描述</label>
              <textarea
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                style={{ borderColor: s.divider, backgroundColor: s.panelBg, color: s.textPrimary }}
                rows={3}
                placeholder="成果内容描述..."
              />
            </div>

            {/* 链接 */}
            <div className="mb-4">
              <label className="text-xs font-medium mb-2 block" style={{ color: s.textMuted }}>链接</label>
              <input
                type="url"
                value={formUrl}
                onChange={e => setFormUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: s.divider, backgroundColor: s.panelBg, color: s.textPrimary }}
                placeholder="https://..."
              />
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: s.divider, color: s.textMuted }}
              >
                取消
              </button>
              <button
                onClick={addAchievement}
                disabled={!formTitle.trim()}
                className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: s.swatch, color: '#fff' }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}