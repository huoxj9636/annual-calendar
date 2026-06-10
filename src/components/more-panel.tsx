'use client';

import { useState, useEffect, useCallback } from 'react';

interface Skin {
  panelBg: string;
  cardBg: string;
  cardHover: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  swatch: string;
  cellBorder: string;
  divider: string;
}

interface CustomLink {
  id: string;
  title: string;
  url: string;
  sort_order: number;
}

interface MorePanelProps {
  visible: boolean;
  onClose: () => void;
  skin: Skin;
}

export default function MorePanel({ visible, onClose, skin }: MorePanelProps) {
  const [customLinks, setCustomLinks] = useState<CustomLink[]>([]);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  const loadCustomLinks = useCallback(async () => {
    try {
      const res = await fetch('/api/custom-links');
      if (res.ok) {
        const data = await res.json();
        setCustomLinks(data.links || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (visible) loadCustomLinks();
  }, [visible, loadCustomLinks]);

  const handleAdd = async () => {
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;
    let url = newLinkUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    const res = await fetch('/api/custom-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newLinkTitle.trim(), url, sort_order: customLinks.length }),
    });
    if (res.ok) {
      setNewLinkTitle('');
      setNewLinkUrl('');
      loadCustomLinks();
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch('/api/custom-links', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) loadCustomLinks();
  };

  const getHostname = (url: string) => {
    try { return new URL(url).hostname; } catch { return url; }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className="absolute left-[72px] top-1/2 -translate-y-1/2 w-72 rounded-2xl shadow-2xl p-4 max-h-[70vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: skin.panelBg,
          border: `1px solid ${skin.cellBorder}`,
          boxShadow: `0 25px 60px -12px rgba(0,0,0,0.25), 0 0 0 1px ${skin.cellBorder}`,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold" style={{ color: skin.textPrimary }}>快捷链接</h3>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-black/10 cursor-pointer"
            style={{ color: skin.textSecondary }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Add new link */}
        <div className="mb-3 p-3 rounded-xl" style={{ backgroundColor: `${skin.swatch}08`, border: `1px solid ${skin.swatch}20` }}>
          <div className="flex gap-2 mb-2">
            <input
              value={newLinkTitle}
              onChange={(e) => setNewLinkTitle(e.target.value)}
              placeholder="名称"
              className="flex-1 text-sm px-2 py-1.5 rounded-lg outline-none"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: skin.textPrimary, border: `1px solid ${skin.swatch}20` }}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') handleAdd(); }}
            />
            <input
              value={newLinkUrl}
              onChange={(e) => setNewLinkUrl(e.target.value)}
              placeholder="网址 https://..."
              className="flex-[2] text-sm px-2 py-1.5 rounded-lg outline-none"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: skin.textPrimary, border: `1px solid ${skin.swatch}20` }}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') handleAdd(); }}
            />
          </div>
          <button
            onClick={handleAdd}
            className="w-full text-sm py-1.5 rounded-lg font-medium cursor-pointer transition-all hover:opacity-90"
            style={{ backgroundColor: skin.swatch, color: '#fff' }}
          >
            添加链接
          </button>
        </div>

        {/* Link list */}
        {customLinks.length === 0 ? (
          <div className="text-center py-6 text-sm" style={{ color: skin.textSecondary }}>
            暂无链接，添加常用网址快速访问
          </div>
        ) : (
          <div className="space-y-1.5">
            {customLinks.map((link) => (
              <div
                key={link.id}
                className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all group"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
              >
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-sm font-medium truncate cursor-pointer hover:underline"
                  style={{ color: skin.textPrimary }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {link.title}
                </a>
                <span className="text-xs truncate max-w-[100px]" style={{ color: skin.textSecondary }}>
                  {getHostname(link.url)}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(link.id); }}
                  className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center hover:bg-red-500/20 cursor-pointer transition-all"
                  style={{ color: skin.textSecondary }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
