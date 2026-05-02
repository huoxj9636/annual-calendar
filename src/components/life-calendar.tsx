'use client';

import { getDaysInMonth } from '@/lib/calendar-utils';

interface LifeCalendarProps {
  birthYear: number;
  setBirthYear: (year: number) => void;
  onClose: () => void;
  selectedYear: number | null;
  setSelectedYear: (year: number | null) => void;
}

// Life stage definitions with reference activities
const LIFE_STAGES = [
  { label: '童年', range: '0-5岁', emoji: '🎈', color: 'from-pink-50 to-rose-50 border-pink-200', accent: 'text-pink-600', gridBg: 'bg-pink-50/50', start: 0, end: 5,
    items: ['学会走路说话', '感受爱与安全', '培养好奇心', '建立基本习惯', '享受无忧时光'] },
  { label: '少年', range: '6-11岁', emoji: '📚', color: 'from-orange-50 to-amber-50 border-orange-200', accent: 'text-orange-600', gridBg: 'bg-orange-50/50', start: 6, end: 11,
    items: ['养成阅读习惯', '发展一门兴趣', '学会与人相处', '培养自理能力', '探索自然世界'] },
  { label: '青春', range: '12-17岁', emoji: '💫', color: 'from-yellow-50 to-lime-50 border-yellow-200', accent: 'text-yellow-700', gridBg: 'bg-yellow-50/50', start: 12, end: 17,
    items: ['建立价值观念', '找到热爱方向', '锻炼强健体魄', '学会独立思考', '珍惜纯真友谊'] },
  { label: '青年', range: '18-29岁', emoji: '🔥', color: 'from-green-50 to-emerald-50 border-green-200', accent: 'text-green-600', gridBg: 'bg-green-50/50', start: 18, end: 29,
    items: ['完成学业深造', '开启职业生涯', '建立亲密关系', '探索世界广度', '积累第一桶金', '养成健康习惯'] },
  { label: '而立', range: '30-39岁', emoji: '🏔️', color: 'from-teal-50 to-cyan-50 border-teal-200', accent: 'text-teal-600', gridBg: 'bg-teal-50/50', start: 30, end: 39,
    items: ['深耕专业领域', '承担家庭责任', '培养下一代', '建立人脉网络', '关注身心健康', '规划财务自由'] },
  { label: '不惑', range: '40-49岁', emoji: '🌊', color: 'from-cyan-50 to-sky-50 border-cyan-200', accent: 'text-cyan-600', gridBg: 'bg-cyan-50/50', start: 40, end: 49,
    items: ['传承经验智慧', '平衡事业家庭', '关注身体信号', '培养精神世界', '回馈社会他人'] },
  { label: '知天命', range: '50-59岁', emoji: '🌅', color: 'from-blue-50 to-indigo-50 border-blue-200', accent: 'text-blue-600', gridBg: 'bg-blue-50/50', start: 50, end: 59,
    items: ['放下执念得失', '享受成熟智慧', '培养新兴趣', '维护亲密关系', '准备退休生活'] },
  { label: '耳顺', range: '60-69岁', emoji: '🍂', color: 'from-violet-50 to-purple-50 border-violet-200', accent: 'text-violet-600', gridBg: 'bg-violet-50/50', start: 60, end: 69,
    items: ['享受天伦之乐', '保持身心活力', '环游旅行世界', '分享人生故事', '简化物质需求'] },
  { label: '古稀', range: '70-79岁', emoji: '🌿', color: 'from-purple-50 to-fuchsia-50 border-purple-200', accent: 'text-purple-600', gridBg: 'bg-purple-50/50', start: 70, end: 79,
    items: ['保持乐观心态', '每天适量运动', '与老友常联系', '留下人生记录', '从容面对变化'] },
];

const MILESTONES = [
  { age: 6, label: '入学', desc: '开始求学之路', icon: '📖' },
  { age: 12, label: '青春期', desc: '身心成长蜕变', icon: '🌱' },
  { age: 18, label: '成年', desc: '法律意义上的独立', icon: '🔑' },
  { age: 22, label: '毕业', desc: '踏入社会职场', icon: '🎓' },
  { age: 25, label: '四分之一', desc: '人生第一个节点', icon: '⏱️' },
  { age: 30, label: '而立', desc: '立业立家立身', icon: '🏔️' },
  { age: 35, label: '中场', desc: '人生中场休整', icon: '⚖️' },
  { age: 40, label: '不惑', desc: '不再困惑迷茫', icon: '🎯' },
  { age: 50, label: '知天命', desc: '懂得命运与选择', icon: '🌅' },
  { age: 60, label: '耳顺', desc: '退休新篇章', icon: '🍂' },
  { age: 70, label: '古稀', desc: '从心所欲不逾矩', icon: '🌿' },
];

export default function LifeCalendar({ birthYear, setBirthYear, onClose, selectedYear, setSelectedYear }: LifeCalendarProps) {

  const now = new Date();
  const currentYear = now.getFullYear();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const birthDate = new Date(birthYear, 0, 1);
  const weeksLived = Math.max(0, Math.floor((now.getTime() - birthDate.getTime()) / msPerWeek));
  const totalWeeks = 80 * 52;
  const weeksLeft = Math.max(0, totalWeeks - weeksLived);
  const pct = Math.min(100, (weeksLived / totalWeeks * 100)).toFixed(1);
  const currentAge = weeksLived / 52;

  return (
    <div className="fixed inset-0 z-50 flex justify-start">
      <div className="absolute inset-0 bg-black/20" onClick={() => { onClose(); setSelectedYear(null); }} />
      <div
        className="relative h-full bg-white shadow-2xl overflow-hidden flex flex-col animate-slide-in-left"
        style={{ width: Math.min(580, window.innerWidth * 0.92), maxWidth: '92vw' }}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-br from-slate-800 via-slate-700 to-indigo-900 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-wide">人生 4000 周</h2>
            <button
              onClick={() => { onClose(); setSelectedYear(null); }}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M1 1l12 12M13 1L1 13" />
              </svg>
            </button>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <label className="text-white/50 text-xs">出生年份</label>
            <input
              type="number"
              value={birthYear}
              min={1930}
              max={currentYear}
              onChange={(e) => setBirthYear(Number(e.target.value))}
              className="w-20 px-2 py-1 bg-white/10 border border-white/20 rounded text-sm text-white text-center focus:outline-none focus:border-white/40"
            />
            <div className="flex-1 text-right">
              <div className="text-white/70 text-xs">
                已过 <span className="text-amber-300 font-bold text-sm">{weeksLived.toLocaleString()}</span> 周
                <span className="mx-1.5 text-white/30">|</span>
                剩余 <span className="text-emerald-300 font-bold text-sm">{weeksLeft.toLocaleString()}</span> 周
              </div>
              <div className="mt-1.5 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-white/40 text-[10px] mt-0.5 text-right">{pct}%</div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!selectedYear ? (
            <>
              {/* Legend */}
              <div className="flex items-center gap-4 mb-3 px-1 text-[10px] text-gray-400">
                <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-indigo-400" />已度过</div>
                <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-amber-400" />当前年</div>
                <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-gray-200" />未到达</div>
              </div>

              {/* 80 years x 52 weeks grid */}
              <div className="space-y-0.5">
                {Array.from({ length: 80 }, (_, yearIdx) => {
                  const yr = birthYear + yearIdx;
                  const isCurrentYear = yr === currentYear;
                  const isFuture = yr > currentYear;
                  const yearStartWeek = yearIdx * 52;
                  const stage = LIFE_STAGES.find(s => yearIdx >= s.start && yearIdx <= s.end);
                  return (
                    <div key={yearIdx} className={`flex items-center gap-1.5 group ${stage?.gridBg || ''} ${stage && yearIdx === stage.start ? 'rounded-t-md' : ''} ${stage && yearIdx === stage.end ? 'rounded-b-md' : ''}`}>
                      <div className="w-[60px] flex-shrink-0 flex items-center gap-0.5">
                        <button
                          onClick={() => { if (!isFuture) setSelectedYear(yr); }}
                          disabled={isFuture}
                          className={`text-[9px] font-mono w-[26px] text-right transition-colors ${
                            isCurrentYear ? 'text-amber-500 font-bold' :
                            isFuture ? 'text-gray-200' :
                            'text-gray-400 group-hover:text-gray-700'
                          }`}
                        >
                          {String(yr).slice(2)}
                        </button>
                        {stage && yearIdx === stage.start && (
                          <span className={`text-[8px] ${stage.accent} font-bold whitespace-nowrap`}>{stage.label}</span>
                        )}
                      </div>
                      <div className="flex gap-[1px]">
                        {Array.from({ length: 52 }, (_, w) => {
                          const weekNum = yearStartWeek + w;
                          const isPast = weekNum < weeksLived;
                          const isCurrentWeek = weekNum === weeksLived;
                          return (
                            <div
                              key={w}
                              className={`w-[6px] h-[6px] rounded-[1px] transition-all ${
                                isCurrentWeek
                                  ? 'bg-amber-400 ring-1 ring-amber-200'
                                  : isPast
                                    ? 'bg-indigo-400/60'
                                    : 'bg-gray-100'
                              }`}
                              title={`${yr}年 第${w + 1}周`}
                            />
                          );
                        })}
                      </div>
                      {[18, 22, 25, 30, 35, 40, 50, 60, 70].includes(yearIdx) && (
                        <span className="text-[7px] text-gray-300 ml-0.5 font-medium">{yearIdx}岁</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Life Stage Templates */}
              <div className="mt-5 mb-2">
                <div className="text-xs text-gray-500 font-semibold mb-3 flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-400"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                  人生阶段参考
                </div>
                <div className="space-y-2">
                  {LIFE_STAGES.map(s => {
                    const isActive = currentAge >= s.start && currentAge <= s.end;
                    const isPast = currentAge > s.end;
                    const stagePct = isPast ? 100 : isActive ? Math.min(100, ((currentAge - s.start) / (s.end - s.start + 1) * 100)).toFixed(0) : 0;
                    return (
                      <div key={s.label} className={`rounded-xl border p-3 bg-gradient-to-r ${s.color} ${isActive ? 'ring-2 ring-offset-1 ring-indigo-300 shadow-sm' : ''} ${isPast ? 'opacity-50' : ''}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{s.emoji}</span>
                            <span className={`text-xs font-bold ${s.accent}`}>{s.label}</span>
                            <span className="text-[10px] text-gray-400">{s.range}</span>
                            {isActive && <span className="text-[9px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-full font-medium">当前</span>}
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-12 h-1 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${stagePct}%` }} />
                            </div>
                            <span className="text-[9px] text-gray-400 w-6 text-right">{stagePct}%</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {s.items.map((item, i) => (
                            <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded-md ${isActive ? 'bg-white/80 text-gray-700' : 'bg-white/50 text-gray-500'}`}>
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Milestone Timeline */}
              <div className="mt-5 mb-2">
                <div className="text-xs text-gray-500 font-semibold mb-3 flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  关键里程碑
                </div>
                <div className="relative pl-4 border-l-2 border-gray-100 space-y-3">
                  {MILESTONES.map(m => {
                    const reached = currentAge >= m.age;
                    const isCurrent = Math.abs(currentAge - m.age) < 1;
                    return (
                      <div key={m.age} className={`relative flex items-start gap-2 ${!reached ? 'opacity-40' : ''}`}>
                        <div className={`absolute -left-[21px] w-3 h-3 rounded-full border-2 ${isCurrent ? 'bg-amber-400 border-amber-300 ring-2 ring-amber-100' : reached ? 'bg-indigo-400 border-indigo-300' : 'bg-gray-200 border-gray-100'}`} />
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm">{m.icon}</span>
                          <span className={`text-[11px] font-bold ${reached ? 'text-gray-700' : 'text-gray-300'}`}>{m.age}岁</span>
                          <span className={`text-[11px] font-medium ${reached ? 'text-gray-600' : 'text-gray-300'}`}>{m.label}</span>
                          <span className="text-[10px] text-gray-400">{m.desc}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quote */}
              <div className="mt-5 p-4 bg-gradient-to-br from-slate-50 to-indigo-50 rounded-xl border border-indigo-100">
                <div className="text-center text-xs text-gray-500 italic leading-relaxed">
                  &ldquo;人生不是等待暴风雨过去，<br />而是学会在雨中跳舞。&rdquo;<br />
                  <span className="text-[10px] text-gray-400 not-italic">—— 生命的意义在于体验每一周</span>
                </div>
              </div>
            </>
          ) : (
            /* Year detail view */
            <div>
              <button
                onClick={() => setSelectedYear(null)}
                className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-sm mb-4 transition-colors"
              >
                <span>‹</span> 返回人生日历
              </button>
              <h3 className="text-lg font-bold text-gray-800 mb-4">{selectedYear}年 日程总览</h3>
              <div className="space-y-3">
                {Array.from({ length: 12 }, (_, m) => {
                  const month = m + 1;
                  const daysInMonth = getDaysInMonth(selectedYear, month);
                  let eventCount = 0;
                  let todoCount = 0;
                  try {
                    for (let d = 1; d <= daysInMonth; d++) {
                      const evKey = `dayview-events-${selectedYear}-${month}-${d}`;
                      const tdKey = `dayview-todos-${selectedYear}-${month}-${d}`;
                      const evRaw = localStorage.getItem(evKey);
                      const tdRaw = localStorage.getItem(tdKey);
                      if (evRaw) { const arr = JSON.parse(evRaw); if (Array.isArray(arr)) eventCount += arr.length; }
                      if (tdRaw) { const arr = JSON.parse(tdRaw); if (Array.isArray(arr)) todoCount += arr.length; }
                    }
                  } catch { /* empty */ }

                  return (
                    <div key={m} className="p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-700">{month}月</span>
                        <div className="flex gap-2 text-xs text-gray-400">
                          <span>{eventCount}项日程</span>
                          <span>{todoCount}项待办</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-[2px]">
                        {Array.from({ length: daysInMonth }, (_, d) => {
                          const day = d + 1;
                          let hasEvent = false;
                          let hasTodo = false;
                          try {
                            const evKey = `dayview-events-${selectedYear}-${month}-${day}`;
                            const tdKey = `dayview-todos-${selectedYear}-${month}-${day}`;
                            const evRaw = localStorage.getItem(evKey);
                            const tdRaw = localStorage.getItem(tdKey);
                            if (evRaw) { try { const arr = JSON.parse(evRaw); hasEvent = Array.isArray(arr) && arr.length > 0; } catch { hasEvent = false; } }
                            if (tdRaw) { try { const arr = JSON.parse(tdRaw); hasTodo = Array.isArray(arr) && arr.length > 0; } catch { hasTodo = false; } }
                          } catch { /* empty */ }
                          return (
                            <div
                              key={d}
                              className={`w-[10px] h-[10px] rounded-[2px] ${
                                hasEvent ? 'bg-blue-400' :
                                hasTodo ? 'bg-amber-400' :
                                'bg-gray-200'
                              }`}
                              title={`${month}月${day}日`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
