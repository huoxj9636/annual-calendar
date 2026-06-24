// ==UserScript==
// @name         外部站点 - 返回年度日历
// @namespace    https://github.com/local/year-calendar
// @version      1.3.0
// @description  在滴答清单 / 浮墨笔记 / 哔哩哔哩等外部网站注入可拖动的「返回」按钮，按钮自动回到出发的 origin（开发/生产环境不会跳错）
// @author       You
// @match        https://dida365.com/*
// @match        https://www.dida365.com/*
// @match        https://*.flomoapp.com/*
// @match        https://*.bilibili.com/*
// @match        https://*.b23.tv/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // ====== 配置：默认返回地址 ======
  // 用户首次从年度日历点"滴答/B站"时，中转页会把当前 origin 写进
  // localStorage['ext-back-calendar-url']，这里优先读这个 key 动态返回，
  // 保证开发/生产环境各自回到出发的位置。
  // localStorage 为空时 fallback 到下面的默认值。
  const DEFAULT_CALENDAR_URL = 'https://zdy5dkdm93.coze.site/';
  const CALENDAR_URL_KEY = 'ext-back-calendar-url';

  function getCalendarUrl() {
    try {
      const stored = localStorage.getItem(CALENDAR_URL_KEY);
      if (stored && /^https?:\/\/[^/]+$/.test(stored)) {
        return stored;
      }
    } catch {}
    return DEFAULT_CALENDAR_URL;
  }

  // ====== 常量 ======
  const BTN_ID = 'ext-back-to-calendar-btn';
  const STORAGE_KEY = 'ext-back-btn-pos-v1';
  const BTN_SIZE = 40;
  const SAFE_MARGIN = 8;
  const DRAG_THRESHOLD = 4;
  const Z_INDEX = 2147483647;

  // ====== 工具 ======
  function loadPos() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (typeof p?.x !== 'number' || typeof p?.y !== 'number') return null;
      return p;
    } catch {
      return null;
    }
  }

  function savePos(pos) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    } catch {
      // ignore
    }
  }

  function clamp(v, min, max) {
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  // ====== 主流程 ======
  function init() {
    if (document.getElementById(BTN_ID)) return;

    const stored = loadPos();
    const initial = stored || {
      x: window.innerWidth - BTN_SIZE - SAFE_MARGIN,
      y: SAFE_MARGIN,
    };

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.setAttribute('aria-label', '返回年度日历');
    btn.title = '返回年度日历';
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none">
        <path d="M19 12H5"/>
        <path d="M12 19l-7-7 7-7"/>
      </svg>
    `;
    btn.style.cssText = `
      position: fixed;
      top: ${initial.y}px;
      left: ${initial.x}px;
      width: ${BTN_SIZE}px;
      height: ${BTN_SIZE}px;
      border-radius: 50%;
      background: #1e293b;
      color: #ffffff;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      z-index: ${Z_INDEX};
      box-shadow: 0 4px 12px rgba(0,0,0,0.18);
      user-select: none;
      touch-action: none;
      -webkit-user-select: none;
      padding: 0;
      margin: 0;
      font: inherit;
      transition: transform 150ms ease-out, box-shadow 150ms ease-out;
    `;

    document.documentElement.appendChild(btn);

    let pointerId = null;
    let startX = 0, startY = 0, origX = 0, origY = 0;
    let moved = false, wasDragging = false;

    function onPointerDown(e) {
      if (e.button !== 0) return;
      e.preventDefault();
      pointerId = e.pointerId;
      try { btn.setPointerCapture(pointerId); } catch {}
      startX = e.clientX;
      startY = e.clientY;
      origX = parseInt(btn.style.left, 10) || 0;
      origY = parseInt(btn.style.top, 10) || 0;
      moved = false;
    }

    function onPointerMove(e) {
      if (pointerId !== e.pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      moved = true;
      wasDragging = true;
      btn.style.cursor = 'grabbing';
      btn.style.transform = 'scale(1.1)';
      btn.style.boxShadow = '0 6px 16px rgba(0,0,0,0.28), 0 0 0 2px rgba(30,41,59,0.4)';
      const maxX = Math.max(SAFE_MARGIN, window.innerWidth - BTN_SIZE - SAFE_MARGIN);
      const maxY = Math.max(SAFE_MARGIN, window.innerHeight - BTN_SIZE - SAFE_MARGIN);
      const nextX = clamp(origX + dx, SAFE_MARGIN, maxX);
      const nextY = clamp(origY + dy, SAFE_MARGIN, maxY);
      btn.style.left = nextX + 'px';
      btn.style.top = nextY + 'px';
    }

    function finishPointer(e) {
      if (pointerId !== e.pointerId) return;
      try { btn.releasePointerCapture(pointerId); } catch {}
      pointerId = null;
      btn.style.cursor = 'grab';
      btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.18)';
      if (moved) {
        savePos({
          x: parseInt(btn.style.left, 10) || 0,
          y: parseInt(btn.style.top, 10) || 0,
        });
        setTimeout(() => {
          btn.style.transform = 'scale(1)';
          wasDragging = false;
        }, 0);
      }
    }

    function onClick(e) {
      if (wasDragging) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
      window.location.href = getCalendarUrl();
    }

    btn.addEventListener('pointerdown', onPointerDown);
    btn.addEventListener('pointermove', onPointerMove);
    btn.addEventListener('pointerup', finishPointer);
    btn.addEventListener('pointercancel', finishPointer);
    btn.addEventListener('click', onClick, true);

    btn.addEventListener('mouseenter', () => {
      if (!pointerId) btn.style.transform = 'scale(1.1)';
    });
    btn.addEventListener('mouseleave', () => {
      if (!pointerId) btn.style.transform = 'scale(1)';
    });

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const currentX = parseInt(btn.style.left, 10) || 0;
        const currentY = parseInt(btn.style.top, 10) || 0;
        const maxX = Math.max(SAFE_MARGIN, window.innerWidth - BTN_SIZE - SAFE_MARGIN);
        const maxY = Math.max(SAFE_MARGIN, window.innerHeight - BTN_SIZE - SAFE_MARGIN);
        const nextX = clamp(currentX, SAFE_MARGIN, maxX);
        const nextY = clamp(currentY, SAFE_MARGIN, maxY);
        if (nextX !== currentX) btn.style.left = nextX + 'px';
        if (nextY !== currentY) btn.style.top = nextY + 'px';
      }, 100);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
