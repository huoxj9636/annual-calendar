'use client';

import { useMigration } from './sync-provider';
import { Cloud, CheckCircle2, X, Loader2, Archive, Trash2 } from 'lucide-react';
import { useSkinSwatch } from '@/hooks/use-skin-swatch';

/**
 * 一键迁移提示 Toast
 *
 * 触发时机：用户登录成功后
 * 两种提示：
 *   A. localStorage 残留(已迁库 key)→ 弹 toast「立即迁移到云端」
 *   B. 数据库 legacy 数据(老访客) → 弹 toast「接管/清空」
 *   两者可以共存,垂直堆叠
 */
export function MigrationToast() {
  const {
    pendingCount,
    running,
    runMigration,
    dismiss,
    legacyCount,
    legacyLoading,
    legacyRunning,
    claimLegacy,
    clearLegacy,
    dismissLegacy,
  } = useMigration();
  const swatch = useSkinSwatch();

  const hasLocal = pendingCount > 0;
  const hasLegacy = legacyCount > 0;

  if (!hasLocal && !hasLegacy) return null;

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[min(420px,calc(100vw-2rem))] flex flex-col gap-2 animate-in slide-in-from-top-4 fade-in duration-300"
      role="region"
      aria-label="数据迁移提示"
    >
      {/* A. localStorage 残留迁移 */}
      {hasLocal && (
        <div
          className="rounded-2xl border-2 bg-card p-4 shadow-2xl"
          style={{ borderColor: swatch, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
          role="alertdialog"
          aria-label="本地数据迁移提示"
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${swatch}26`, color: swatch }}
            >
              {running ? <Loader2 className="h-5 w-5 animate-spin" /> : <Cloud className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {running ? '正在迁移本地数据…' : `检测到 ${pendingCount} 条本地数据`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {running
                  ? '正在把这些数据上传到云端，请稍候'
                  : '这些数据保存在本地浏览器，登录后未自动同步到云端，是否立即迁移？'}
              </p>
              {!running && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={runMigration}
                    className="rounded-full px-3 py-1.5 text-xs font-medium text-white transition-all hover:opacity-90 hover:scale-105"
                    style={{ backgroundColor: swatch }}
                  >
                    立即迁移
                  </button>
                  <button
                    onClick={dismiss}
                    className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:bg-muted"
                  >
                    暂不
                  </button>
                </div>
              )}
            </div>
            {!running && (
              <button
                onClick={dismiss}
                className="shrink-0 rounded-full p-1 text-muted-foreground transition-all hover:bg-muted"
                aria-label="关闭"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {running && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full animate-pulse" style={{ backgroundColor: swatch, width: '100%' }} />
            </div>
          )}
        </div>
      )}

      {/* B. 数据库 legacy 旧数据接管/清空 */}
      {hasLegacy && (
        <div
          className="rounded-2xl border-2 bg-card p-4 shadow-2xl"
          style={{ borderColor: '#f59e0b', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
          role="alertdialog"
          aria-label="历史数据归属提示"
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: '#f59e0b26', color: '#f59e0b' }}
            >
              {legacyRunning ? <Loader2 className="h-5 w-5 animate-spin" /> : <Archive className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {legacyRunning
                  ? legacyCount > 0 && legacyCount < 1000
                    ? '正在处理…'
                    : '正在处理…'
                  : `检测到 ${legacyCount} 条历史数据(无主)`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {legacyRunning
                  ? '请稍候'
                  : '这些是升级账号系统前未登录时的遗留数据，归到你名下或清空？'}
              </p>
              {!legacyRunning && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={claimLegacy}
                    className="rounded-full px-3 py-1.5 text-xs font-medium text-white transition-all hover:opacity-90 hover:scale-105"
                    style={{ backgroundColor: swatch }}
                  >
                    归我所有
                  </button>
                  <button
                    onClick={clearLegacy}
                    className="rounded-full px-3 py-1.5 text-xs font-medium text-white transition-all hover:opacity-90 hover:scale-105 flex items-center gap-1"
                    style={{ backgroundColor: '#f59e0b' }}
                  >
                    <Trash2 className="h-3 w-3" />
                    清空
                  </button>
                  <button
                    onClick={dismissLegacy}
                    className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:bg-muted"
                  >
                    暂不
                  </button>
                </div>
              )}
            </div>
            {!legacyRunning && (
              <button
                onClick={dismissLegacy}
                className="shrink-0 rounded-full p-1 text-muted-foreground transition-all hover:bg-muted"
                aria-label="关闭"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
