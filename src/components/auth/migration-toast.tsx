'use client';

import { useMigration } from './sync-provider';
import { Cloud, CheckCircle2, X, Loader2 } from 'lucide-react';
import { useSkinSwatch } from '@/hooks/use-skin-swatch';

/**
 * 一键迁移提示 Toast
 *
 * 触发时机：用户登录成功后
 * 逻辑：检测 localStorage 是否有已迁库 key 残留数据
 *       → 弹 toast 提示"立即迁移到云端"
 *       → 点按钮：批量调用各 API 迁移，完成后清 localStorage
 */
export function MigrationToast() {
  const { pendingCount, running, runMigration, dismiss } = useMigration();
  const swatch = useSkinSwatch();

  if (pendingCount === 0) return null;

  return (
    <div
      className="fixed bottom-20 left-4 z-50 max-w-sm rounded-2xl border-2 bg-card p-4 shadow-2xl"
      style={{ borderColor: swatch, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
      role="alertdialog"
      aria-label="本地数据迁移提示"
    >
      <div className="flex items-start gap-3">
        {/* 图标 */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${swatch}26`, color: swatch }}
        >
          {running ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Cloud className="h-5 w-5" />
          )}
        </div>

        {/* 文案 */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {running ? '正在迁移本地数据…' : `检测到 ${pendingCount} 条本地数据`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {running
              ? '正在把这些数据上传到云端，请稍候'
              : '这些数据保存在本地浏览器，登录后未自动同步到云端，是否立即迁移？'}
          </p>

          {/* 按钮区 */}
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

        {/* 关闭按钮 */}
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
          <div
            className="h-full animate-pulse"
            style={{ backgroundColor: swatch, width: '100%' }}
          />
        </div>
      )}
    </div>
  );
}
