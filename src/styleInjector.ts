/**
 * Twitter Blocker Chrome Extension - Style Injector
 *
 * 定数値をCSS変数として注入し、popup.cssで使用できるようにするスクリプト
 */

import { COLORS, SIZES, TIMINGS, FONTS } from './constants';

type ConstantValue = string | number;

/**
 * CSS変数として定数値を注入する
 */
function injectCSSVariables(): void {
  const root = document.documentElement;
  
  // カラー変数を注入
  Object.entries(COLORS).forEach(([key, value]: [string, string]) => {
    const cssVarName = `--${key.toLowerCase().replace(/_/g, '-')}`;
    root.style.setProperty(cssVarName, value);
  });
  
  // サイズ変数を注入
  Object.entries(SIZES).forEach(([key, value]: [string, string]) => {
    const cssVarName = `--${key.toLowerCase().replace(/_/g, '-')}`;
    root.style.setProperty(cssVarName, value);
  });
  
  // タイミング変数を注入
  Object.entries(TIMINGS).forEach(([key, value]: [string, ConstantValue]) => {
    const cssVarName = `--${key.toLowerCase().replace(/_/g, '-')}`;
    // 数値の場合はmsを付加、文字列の場合はそのまま
    const cssValue = typeof value === 'number' ? `${value}ms` : value;
    root.style.setProperty(cssVarName, cssValue);
  });
  
  // フォント変数を注入
  Object.entries(FONTS).forEach(([key, value]: [string, string]) => {
    const cssVarName = `--font-${key.toLowerCase().replace(/_/g, '-')}`;
    root.style.setProperty(cssVarName, value);
  });
  
  // 便利なトランジション定数
  root.style.setProperty('--transition-all', `all ${TIMINGS.ANIMATION_FAST} ${TIMINGS.EASE_DEFAULT}`);
}

/**
 * スタイルシートを動的に読み込む
 */
function loadStylesheet(href: string): void {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

// エクスポート（ES6モジュール形式）
// 定数は constants.ts から直接 import すること
export { injectCSSVariables, loadStylesheet };