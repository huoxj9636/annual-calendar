// ==UserScript==
// @name         滴答清单 - 24h 分钟细分网格
// @namespace    https://github.com/local/year-calendar
// @version      1.0.0
// @description  给滴答 24h 视图的每个小时格子里画 5/10/15 分钟细分线（CSS 视觉改造，不破坏原生交互）
// @author       You
// @match        https://dida365.com/*
// @match        https://www.dida365.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ============ 配置区（按需修改）============
  const CONFIG = {
    // 24h 视图小时行的 CSS 选择器
    // 基于截图：.tgc-over-wrapper > .so > *（24 个直接子元素，每行 1 小时）
    // 如果不匹配，改这里。最准确的检测：rows.length === 24
    rowSelector: '.tgc-over-wrapper .so > *',

    // 每多少分钟画一条线
    // 5  = 12 条/小时（5 分钟一条，推荐）
    // 10 = 6  条/小时（10 分钟一条）
    // 15 = 4  条/小时（15 分钟一条）
    // 30 = 2  条/小时（半小时一条）
    // 60 = 1  条/小时（每小时一条）
    minutesPerLine: 5,

    // 细分线颜色（rgba，alpha 控制透明度）
    lineColor: 'rgba(0, 0, 0, 0.10)',

    // 强制改行高（像素）。null = 不改（保持原 47.5px）
    // 60 = 每小时 60px（每分钟 1px，可读性 OK，整体 1440px）
    // 90 = 每小时 90px（更清晰，整体 2160px）
    // 120 = 每小时 120px（最清晰，整体 2880px，需要更多滚动）
    forceRowHeight: null,
  };
  // ============================================

  function applyMinuteGrid() {
    const rows = document.querySelectorAll(CONFIG.rowSelector);
    if (rows.length !== 24) return false; // 只在 24h 视图（正好 24 行）时应用

    rows.forEach((row, index) => {
      if (row.dataset.didaMinGridApplied === CONFIG.minutesPerLine + '') return;

      const originalHeight = row.getBoundingClientRect().height;
      const height = CONFIG.forceRowHeight || originalHeight;
      if (height < 10) return;

      const linesPerHour = 60 / CONFIG.minutesPerLine;
      const step = height / linesPerHour;

      // repeating-linear-gradient: 透明 step-1px, 线 1px, 重复
      const bg = `repeating-linear-gradient(
        to bottom,
        transparent 0px,
        transparent ${(step - 1).toFixed(2)}px,
        ${CONFIG.lineColor} ${(step - 1).toFixed(2)}px,
        ${CONFIG.lineColor} ${step.toFixed(2)}px
      )`;

      row.style.backgroundImage = bg;
      row.style.backgroundSize = `100% ${height.toFixed(2)}px`;
      row.style.backgroundRepeat = 'repeat-y';
      row.style.backgroundPosition = 'top left';

      if (CONFIG.forceRowHeight && originalHeight < height) {
        row.style.minHeight = height + 'px';
      }

      row.dataset.didaMinGridApplied = String(CONFIG.minutesPerLine);
    });

    return true;
  }

  function init() {
    // 立即尝试一次
    if (applyMinuteGrid()) return;

    // MutationObserver 监听 DOM 变化（滴答是 SPA，视图动态渲染）
    let timer = null;
    const observer = new MutationObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(applyMinuteGrid, 150);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 路由变化时强制重置（dataset 标记清除，重新应用）
    setInterval(() => {
      const marked = document.querySelectorAll('[data-dida-min-grid-applied]');
      marked.forEach((el) => {
        delete el.dataset.didaMinGridApplied;
      });
      applyMinuteGrid();
    }, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
