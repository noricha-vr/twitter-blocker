/**
 * Twitter Blocker Chrome Extension - Design System Constants
 * 
 * このファイルには、Twitter Blocker拡張機能で使用される
 * すべての定数値（カラー、サイズ、タイミング等）を定義しています。
 * デザインの一貫性を保ち、メンテナンスを容易にするためのものです。
 */

// ===== Color Palette =====
export const COLORS = {
  // Primary Colors
  PRIMARY_BLUE: '#1da1f2',
  PRIMARY_BLUE_HOVER: '#1a91da',
  PRIMARY_BLUE_LIGHT: '#e8f5fe',
  
  // Status Colors
  SUCCESS_GREEN: '#28a745',
  SUCCESS_GREEN_LIGHT: '#2ecc71',
  ERROR_RED: '#e74c3c',
  ERROR_RED_DARK: '#c0392b',
  WARNING_ORANGE: '#f39c12',
  INFO_BLUE: '#3498db',
  INFO_BLUE_DARK: '#2980b9',
  
  // Text Colors
  TEXT_PRIMARY: '#1a1a1a',
  TEXT_SECONDARY: '#666',
  TEXT_MUTED: '#95a5a6',
  TEXT_DARK: '#2c3e50',
  TEXT_LIGHT: '#7f8c8d',
  TEXT_WHITE: '#ffffff',
  
  // Background Colors
  BACKGROUND_PRIMARY: '#f8f9fa',
  BACKGROUND_WHITE: '#ffffff',
  BACKGROUND_OVERLAY: '#2f2f2f',
  BACKGROUND_CARD: 'rgba(255, 255, 255, 0.95)',
  BACKGROUND_INPUT: '#f0f3f5',
  BACKGROUND_INPUT_HOVER: '#e1e8ed',
  
  // Border Colors
  BORDER_DEFAULT: '#e1e8ed',
  BORDER_FOCUS: '#1da1f2',
  BORDER_ERROR: '#e74c3c',
  BORDER_LIGHT: '#ecf0f1',
  
  // Chart Colors
  CHART_TODAY: '#e74c3c',
  CHART_TODAY_DARK: '#c0392b',
  CHART_WEEKEND: '#95a5a6',
  CHART_WEEKEND_DARK: '#7f8c8d',
  CHART_WEEKDAY: '#3498db',
  CHART_WEEKDAY_DARK: '#2980b9',
  CHART_BACKGROUND: 'rgba(52, 152, 219, 0.05)',
  
  // Tooltip Colors
  TOOLTIP_BACKGROUND: 'rgba(44, 62, 80, 0.95)',
  TOOLTIP_TEXT: '#ffffff',
  
  // Shadow Colors
  SHADOW_LIGHT: 'rgba(0,0,0,0.05)',
  SHADOW_MEDIUM: 'rgba(0,0,0,0.1)',
  SHADOW_HEAVY: 'rgba(0,0,0,0.2)',
  
  // Transparent Colors
  TRANSPARENT: 'transparent',
  BLACK_10: 'rgba(0,0,0,0.1)',
  BLACK_20: 'rgba(0,0,0,0.2)',
  WHITE_95: 'rgba(255, 255, 255, 0.95)',
} as const;

// ===== Size Constants =====
export const SIZES = {
  // Font Sizes
  FONT_XS: '10px',
  FONT_SM: '11px',
  FONT_BASE: '12px',
  FONT_MD: '14px',
  FONT_LG: '16px',
  FONT_XL: '18px',
  FONT_XXL: '20px',
  FONT_HUGE: '24px',
  FONT_MASSIVE: '32px',
  
  // Spacing
  SPACE_XS: '4px',
  SPACE_SM: '8px',
  SPACE_MD: '12px',
  SPACE_LG: '16px',
  SPACE_XL: '20px',
  SPACE_XXL: '24px',
  SPACE_HUGE: '28px',
  SPACE_MASSIVE: '32px',
  SPACE_GIANT: '48px',
  SPACE_ENORMOUS: '56px',
  
  // Border Radius
  RADIUS_XS: '4px',
  RADIUS_SM: '6px',
  RADIUS_MD: '8px',
  RADIUS_LG: '12px',
  RADIUS_XL: '24px',
  
  // Dimensions
  WIDTH_POPUP: '320px',
  WIDTH_OVERLAY_MAX: '680px',
  WIDTH_OVERLAY_PERCENT: '90%',
  WIDTH_FULL: '100%',
  
  HEIGHT_CHART: '120px',
  HEIGHT_FULL: '100%',
  HEIGHT_VIEWPORT: '100vh',
  
  // Grid and Layout
  GRID_GAP_SM: '8px',
  GRID_GAP_MD: '12px',
  GRID_GAP_LG: '16px',
  
  // Input Specific
  INPUT_PADDING_SM: '10px 12px',
  INPUT_PADDING_MD: '12px 16px',
  INPUT_PADDING_LG: '14px 24px',
  INPUT_RIGHT_PADDING: '56px',
  
  // Chart Specific
  CHART_BAR_GAP: '3px',
  CHART_PADDING: '0 5px',
  CHART_Y_AXIS_OFFSET: '-40px',
  CHART_MIN_BAR_HEIGHT: '3px',
  
  // Box Shadow
  SHADOW_SM: '0 1px 3px rgba(0,0,0,0.1)',
  SHADOW_MD: '0 2px 8px rgba(0,0,0,0.05)',
  SHADOW_LG: '0 20px 60px rgba(0,0,0,0.2)',
  
  // Line Height
  LINE_HEIGHT_TIGHT: '1.2',
  LINE_HEIGHT_NORMAL: '1.5',
  
  // Letter Spacing
  LETTER_SPACING_WIDE: '0.5px',
  LETTER_SPACING_WIDER: '1px',
  
  // Z-Index Values
  Z_INDEX_OVERLAY: '999999',
  Z_INDEX_TOOLTIP: '10',
  Z_INDEX_INPUT: '1',
  Z_INDEX_DEFAULT: '0',
} as const;

// ===== Timing Constants =====
export const TIMINGS = {
  // Animation Durations
  ANIMATION_FAST: '0.2s',
  ANIMATION_NORMAL: '0.3s',
  ANIMATION_SLOW: '0.5s',
  
  // Delays
  DELAY_SHORT: '3000',  // 3 seconds
  DELAY_MEDIUM: '2000', // 2 seconds
  
  // Intervals
  CHECK_INTERVAL_MS: 10 * 1000, // 10 seconds
  
  // Timeouts
  TOOLTIP_FADE_MS: 200,
  INPUT_ERROR_RESET_MS: 2000,
  STATUS_HIDE_MS: 3000,
  
  // Animation Timing Functions
  EASE_DEFAULT: 'ease',
  EASE_OUT: 'ease-out',
  EASE_IN_OUT: 'ease-in-out',
  EASE_FORWARDS: 'ease forwards',
} as const;

// ===== Text Content =====
export const TEXT = {
  // Main Messages
  MAIN_TITLE: 'Twitter はブロック中です',
  SUB_MESSAGE: '集中力を保つため、現在アクセスが制限されています',
  INSTRUCTION: '一時的に解除するには、拡張機能アイコンをクリックして時間を設定してください。',
  
  // Status Messages
  STATUS_BLOCKED: '🔒 現在ブロック中',
  STATUS_UNBLOCKED: '🟢 解除中（残り{minutes}分）',
  
  // Chart Labels
  CHART_TITLE: '直近30日間の使用時間',
  CHART_TOTAL: '合計',
  CHART_AVERAGE: '1日平均',
  CHART_TODAY: '今日',
  
  // Units
  UNIT_MINUTES: '分',
  UNIT_MINUTES_SHORT: '分',
  
  // Day Names
  DAY_NAMES: ['日', '月', '火', '水', '木', '金', '土'] as const,
  
  // Success/Error Messages
  URL_SAVED: '✓ 保存しました',
  URL_CLEARED: '✓ URLをクリアしました',
  URL_INVALID: '✗ 有効なURLを入力してください',
} as const;

// ===== Breakpoints =====
export const BREAKPOINTS = {
  MOBILE_MAX: '480px',
  TABLET_MAX: '768px',
  DESKTOP_MIN: '769px',
} as const;

// ===== Form Validation =====
export const VALIDATION = {
  MIN_MINUTES: 1,
  MAX_MINUTES: 120,
  HISTORY_RETENTION_DAYS: 30,
} as const;

// ===== CSS Property Collections =====
export const CSS_PROPERTIES = {
  // Flex Center
  FLEX_CENTER: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Flex Column
  FLEX_COLUMN: {
    display: 'flex',
    flexDirection: 'column',
  },
  
  // Absolute Positioning
  ABSOLUTE_FULL: {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
  },
  
  // Fixed Positioning
  FIXED_FULL: {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100vh',
  },
  
  // Text Styles
  TEXT_CENTER: {
    textAlign: 'center',
  },
  
  TEXT_ELLIPSIS: {
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
  
  // Box Model
  BOX_SIZING_BORDER: {
    boxSizing: 'border-box',
  },
  
  // Transform
  TRANSFORM_CENTER: {
    transform: 'translate(-50%, -50%)',
  },
  
  // Transitions
  TRANSITION_ALL: {
    transition: 'all 0.2s ease',
  },
} as const;

// ===== Animation Keyframes =====
export const ANIMATIONS = {
  FADE_IN: {
    name: 'fadeIn',
    keyframes: {
      from: { opacity: 0 },
      to: { opacity: 1 },
    },
  },
  
  SLIDE_UP: {
    name: 'slideUp',
    keyframes: {
      from: { 
        opacity: 0,
        transform: 'translateY(20px)',
      },
      to: {
        opacity: 1,
        transform: 'translateY(0)',
      },
    },
  },
  
  PULSE: {
    name: 'pulse',
    keyframes: {
      '0%': { transform: 'scale(1)' },
      '50%': { transform: 'scale(1.05)' },
      '100%': { transform: 'scale(1)' },
    },
  },
} as const;

// ===== Chart Configuration =====
export const CHART_CONFIG = {
  BAR_MIN_HEIGHT_PERCENT: 3,
  Y_AXIS_TICKS: 4,
  DEFAULT_MAX_MINUTES: 30,
  DAYS_TO_SHOW: 30,
} as const;

// ===== Storage Keys =====
export const STORAGE_KEYS = {
  UNBLOCK_UNTIL: 'unblockUntil',
  USAGE_HISTORY: 'usageHistory',
  DEFAULT_MINUTES: 'defaultMinutes',
  REDIRECT_URL: 'redirectURL',
  START_TIME: 'startTime',
  END_TIME: 'endTime',
} as const;

// ===== DOM Selectors =====
export const SELECTORS = {
  OVERLAY_ID: 'block-overlay',
  USAGE_CHART_ID: 'usage-chart',
  MINUTE_INPUT_ID: 'minuteInput',
  SAVE_BUTTON_ID: 'saveButton',
  REDIRECT_URL_INPUT_ID: 'redirectUrlInput',
  SAVE_URL_BUTTON_ID: 'saveUrlButton',
  URL_STATUS_ID: 'urlStatus',
  STATUS_CLASS: '.status',
  QUICK_BUTTON_CLASS: '.quick-button',
  SECTION_CLASS: '.section',
  HEADER_CLASS: '.header',
  PRIMARY_BUTTON_CLASS: '.primary-button',
} as const;

// ===== Font Families =====
export const FONTS = {
  SYSTEM: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
} as const;

// ===== Utility Functions for CSS =====
export const CSS_UTILS = {
  /**
   * Create a CSS style string from an object
   */
  createStyleString: (styles: Record<string, string | number>): string => {
    return Object.entries(styles)
      .map(([key, value]) => `${key}: ${value};`)
      .join(' ');
  },
  
  /**
   * Create a linear gradient string
   */
  linearGradient: (direction: string, colors: readonly string[]): string => {
    return `linear-gradient(${direction}, ${colors.join(', ')})`;
  },
  
  /**
   * Create an rgba color string
   */
  rgba: (color: string, alpha: number): string => {
    // Simple implementation - could be enhanced for full color parsing
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  },
} as const;

// ===== Type Definitions =====
export type ColorKey = keyof typeof COLORS;
export type SizeKey = keyof typeof SIZES;
export type TimingKey = keyof typeof TIMINGS;
export type TextKey = keyof typeof TEXT;
export type BreakpointKey = keyof typeof BREAKPOINTS;
export type ValidationKey = keyof typeof VALIDATION;
export type CSSPropertyKey = keyof typeof CSS_PROPERTIES;
export type AnimationKey = keyof typeof ANIMATIONS;
export type ChartConfigKey = keyof typeof CHART_CONFIG;
export type StorageKey = keyof typeof STORAGE_KEYS;
export type SelectorKey = keyof typeof SELECTORS;
export type FontKey = keyof typeof FONTS;