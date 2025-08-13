/**
 * Twitter Blocker Chrome Extension - Style Injector
 * 
 * 定数値をCSS変数として注入し、popup.cssで使用できるようにするスクリプト
 */

// 定数を直接定義（Chrome拡張機能ではES6モジュールの制限があるため）
const COLORS = {
  PRIMARY_BLUE: '#1da1f2',
  PRIMARY_BLUE_HOVER: '#1a91da',
  PRIMARY_BLUE_LIGHT: '#e8f5fe',
  SUCCESS_GREEN: '#28a745',
  ERROR_RED: '#e74c3c',
  TEXT_PRIMARY: '#1a1a1a',
  TEXT_SECONDARY: '#666',
  TEXT_WHITE: '#ffffff',
  BACKGROUND_PRIMARY: '#f8f9fa',
  BACKGROUND_WHITE: '#ffffff',
  BACKGROUND_INPUT: '#f0f3f5',
  BACKGROUND_INPUT_HOVER: '#e1e8ed',
  BORDER_DEFAULT: '#e1e8ed',
  BORDER_FOCUS: '#1da1f2',
} as const;

const SIZES = {
  FONT_BASE: '12px',
  FONT_MD: '14px',
  FONT_LG: '16px',
  FONT_XXL: '20px',
  FONT_HUGE: '24px',
  SPACE_XS: '4px',
  SPACE_SM: '8px',
  SPACE_MD: '12px',
  SPACE_LG: '16px',
  SPACE_XL: '20px',
  SPACE_XXL: '24px',
  RADIUS_SM: '6px',
  RADIUS_MD: '8px',
  RADIUS_LG: '12px',
  WIDTH_POPUP: '320px',
  WIDTH_FULL: '100%',
  HEIGHT_FULL: '100%',
  INPUT_RIGHT_PADDING: '56px',
  INPUT_PADDING_SM: '10px 12px',
  INPUT_PADDING_LG: '14px 24px',
  SHADOW_SM: '0 1px 3px rgba(0,0,0,0.1)',
  LETTER_SPACING_WIDE: '0.5px',
  Z_INDEX_DEFAULT: '0',
  Z_INDEX_INPUT: '1',
} as const;

const TIMINGS = {
  ANIMATION_FAST: '0.2s',
  EASE_DEFAULT: 'ease',
} as const;

const FONTS = {
  SYSTEM: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
} as const;

type ConstantObjects = typeof COLORS | typeof SIZES | typeof TIMINGS | typeof FONTS;
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
export {
  injectCSSVariables,
  loadStylesheet,
  COLORS,
  SIZES,
  TIMINGS,
  FONTS
};