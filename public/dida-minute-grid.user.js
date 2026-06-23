// ==UserScript==
// @name         滴答清单 - 24h 页面变大
// @namespace    https://github.com/local/year-calendar
// @version      1.1.0
// @description  仅在 /webapp/#c/all/calendar/d 页面把 24h 视图的每个小时行高度变大为 120px，并画 5 分钟细分线
// @author       You
// @match        https://dida365.com/webapp/*
// @match        https://www.dida365.com/webapp/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ============ 配置区 ============
  const CONFIG = {
    // 目标页面 hash（只有这个页面生效）
    targetHash: '#c/all/calendar/d',

    // 强制行高（像素）。每小时 120px = 整体 24×120 = 2880px
    // 60 = 紧凑；120 = 平衡；180 = 宽松
    rowHeight: 120,

    // 每多少分钟画一条细分线
    // 5  = 12 条/小时（5 分钟一条，清晰）
    // 10 = 6  条/小时
    // 15 = 4  条/小时
    // 30 = 2  条/小时
    minutesPerLine: 5,

    // 细分线颜色
    lineColor: 'rgba(0, 0, 0, 0.10)',

    // 24h 视图小时行选择器
    rowSelector: '.tgc-over-wrapper .so > *',
  };
  // =================================

  const BODY_CLASS = 'dida-min-grid-active';
  const STYLE_ID = 'dida-min-grid-style';

  function buildCSS() {
    const linesPerHour = 60 / CONFIG.minutesPerLine;
    const step = CONFIG.rowHeight / linesPerHour;
    const lineWidth = 1; // px

    return `
      body.${BODY_CLASS} .tgc-over-wrapper {
        min-height: ${CONFIG.rowHeight * 24}px !important;
        margin-bottom: ${CONFIG.rowHeight * 17}px !important;
      }

      body.${BODY_CLASS} ${CONFIG.rowSelector} {
        min-height: ${CONFIG.rowHeight}px !important;
        height: ${CONFIG.rowHeight}px !important;
        background-image: repeating-linear-gradient(
          to bottom,
          transparent 0px,
          transparent ${(step - lineWidth).toFixed(2)}px,
          ${CONFIG.lineColor} ${(step - lineWidth).toFixed(2)}px,
          ${CONFIG.lineColor} ${step.toFixed(2)}px
        ) !important;
        background-size: 100% ${CONFIG.rowHeight}px !important;
        background-repeat: repeat-y !important;
        background-position: top left !important;
      }
    `;
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) {
      document.getElementById(STYLE_ID).textContent = buildCSS();
      return;
    }
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = buildCSS();
    document.head.appendChild(style);
  }

  function checkAndActivate() {
    if (location.hash === CONFIG.targetHash) {
      document.body.classList.add(BODY_CLASS);
    } else {
      document.body.classList.remove(BODY_CLASS);
    }
  }

  function init() {
    injectStyle();
    checkAndActivate();

    // SPA 路由切换
    window.addEventListener('hashchange', checkAndActivate);

    // 滴答初次加载可能修改 hash
    setInterval(checkAndActivate, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
