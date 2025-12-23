import { COLORS, SIZES, TIMINGS, TEXT, SELECTORS, FONTS, ANIMATIONS, CHART_CONFIG, CSS_UTILS } from './constants';
import { StorageManager } from './storageManager';

// ===== TypeScript型定義 =====
interface UsageData {
  days: DayData[];
  totalMinutes: number;
  max: number;
}

interface DayData {
  date: string;
  minutes: number;
  dayOfWeek: number;
}

interface StatData {
  label: string;
  value: string;
  color: string;
}

// ===== Blocker State Interface =====
interface BlockerState {
  overlay: HTMLElement | null;
  lastBlockState: boolean | undefined;
  lastUnblockUntil: number;
  pendingRedirect: boolean;
  lastComposerVisible: boolean;
  lastGrokVisible: boolean;
}

// ===== Mutable state (集約) =====
const state: BlockerState = {
  overlay: null,
  lastBlockState: undefined,  // 前回のブロック状態（undefined: 初回, true: ブロック中, false: 解除中）
  lastUnblockUntil: 0,        // 前回チェック時のunblockUntil値
  pendingRedirect: false,     // 投稿中に抑止したリダイレクトを後で実行するためのフラグ
  lastComposerVisible: false, // 直近の投稿画面表示状態
  lastGrokVisible: false,     // 直近のGrok画面表示状態
};

// ===== Constants =====
const OVERLAY_ID = SELECTORS.OVERLAY_ID;
const CHECK_INTERVAL_MS = TIMINGS.CHECK_INTERVAL_MS;

function isActivePage(): boolean {
  try {
    // タブが表示されているかどうかのみをチェック
    // document.hasFocus()は削除（ポップアップ開くとフォーカスが移りブロックが消えるため）
    return document.visibilityState === 'visible';
  } catch (error) {
    console.warn('[Twitter Blocker] Error checking active page:', error);
    // エラー時は保守的にtrueを返す（ブロックを優先）
    return true;
  }
}

function isElementVisible(element: Element | null): boolean {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  if (!rect || rect.width === 0 || rect.height === 0) return false;
  const style = window.getComputedStyle(element);
  if (!style) return false;
  if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;
  return true;
}

function isComposerOpen(): boolean {
  // X(Twitter)の投稿モーダルが開いているかのみを厳密に判定（インラインは無視）
  try {
    const modals = Array.from(document.querySelectorAll('div[role="dialog"][aria-modal="true"]'));
    const visibleModal = modals.find(isElementVisible);
    if (!visibleModal) return false;

    // モーダル内の投稿本文エディタ（contenteditable=true）が可視である場合のみ、投稿画面とみなす
    const editor = visibleModal.querySelector('[data-testid="tweetTextarea_0"], [aria-label="ポスト本文"], [role="textbox"][contenteditable="true"]');
    return Boolean(editor && isElementVisible(editor));
  } catch (_) {
    return false;
  }
}

function isGrokOpen(): boolean {
  // Grok画面が開いているかを判定（URLベースの検出のみ）
  // 注意: DOM要素ベースの検出は誤検出が多いため削除
  // （ナビゲーションメニューの「Grok」要素などを誤検出していた）
  try {
    const pathname = window.location.pathname;
    const isGrok = pathname.startsWith('/i/grok');

    // デバッグログ（Grok検出時のみ出力）
    if (isGrok) {
      console.log('[Twitter Blocker] Grok detected via URL:', pathname);
    }

    return isGrok;
  } catch (error) {
    console.warn('[Twitter Blocker] Error in isGrokOpen:', error);
    return false;
  }
}

function setupActivityObserver(): void {
  // 投稿画面とGrok画面の開閉を監視して、閉じたら即座に反映
  const observer = new MutationObserver(() => {
    const composing = isComposerOpen();
    const usingGrok = isGrokOpen();

    // 投稿画面の状態変化を検出
    if (composing !== state.lastComposerVisible) {
      state.lastComposerVisible = composing;
      if (!composing) {
        // 投稿完了（モーダル閉鎖）直後に反映
        updateOverlay();
      }
    }

    // Grok画面の状態変化を検出
    if (usingGrok !== state.lastGrokVisible) {
      state.lastGrokVisible = usingGrok;
      if (!usingGrok) {
        // Grok終了直後に反映
        updateOverlay();
      }
    }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: false });

  // タブの可視状態変化に応じて即時反映
  // 注意: blurイベントは削除（ポップアップを開くとblurが発火し、
  //       タイミング問題でオーバーレイが消える可能性があるため）
  document.addEventListener('visibilitychange', updateOverlay);
  window.addEventListener('focus', updateOverlay);
  
  // URL変更を監視（Grokへのナビゲーションを検出）
  window.addEventListener('popstate', updateOverlay);
  // pushState/replaceStateのオーバーライドでURL変更を検出
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(this: History, ...args: Parameters<typeof originalPushState>) {
    originalPushState.apply(history, args);
    setTimeout(updateOverlay, 0);
  };
  
  history.replaceState = function(this: History, ...args: Parameters<typeof originalReplaceState>) {
    originalReplaceState.apply(history, args);
    setTimeout(updateOverlay, 0);
  };
}

/**
 * オーバーレイのCSSスタイル定義を作成・適用する
 */
function createOverlayStyles(): void {
  // 既にスタイルが追加されている場合はスキップ
  if (document.getElementById('twitter-blocker-styles')) return;

  const style = document.createElement('style');
  style.id = 'twitter-blocker-styles';
  style.textContent = `
    @keyframes ${ANIMATIONS.FADE_IN.name} {
      from { opacity: ${ANIMATIONS.FADE_IN.keyframes.from.opacity}; }
      to { opacity: ${ANIMATIONS.FADE_IN.keyframes.to.opacity}; }
    }
    @keyframes ${ANIMATIONS.SLIDE_UP.name} {
      from {
        opacity: ${ANIMATIONS.SLIDE_UP.keyframes.from.opacity};
        transform: ${ANIMATIONS.SLIDE_UP.keyframes.from.transform};
      }
      to {
        opacity: ${ANIMATIONS.SLIDE_UP.keyframes.to.opacity};
        transform: ${ANIMATIONS.SLIDE_UP.keyframes.to.transform};
      }
    }
    @keyframes ${ANIMATIONS.PULSE.name} {
      0% { transform: ${ANIMATIONS.PULSE.keyframes['0%'].transform}; }
      50% { transform: ${ANIMATIONS.PULSE.keyframes['50%'].transform}; }
      100% { transform: ${ANIMATIONS.PULSE.keyframes['100%'].transform}; }
    }
  `;
  document.head.appendChild(style);
}

/**
 * メインカード要素（メッセージと指示部分）を作成する
 */
function createMainCard(): HTMLElement {
  const card = document.createElement('div');
  card.style.cssText = `
    background: ${COLORS.BACKGROUND_CARD};
    backdrop-filter: blur(${SIZES.SPACE_SM});
    border-radius: ${SIZES.RADIUS_XL};
    padding: ${SIZES.SPACE_GIANT};
    box-shadow: ${SIZES.SHADOW_LG};
    text-align: center;
    font-family: ${FONTS.SYSTEM};
  `;

  // 主要メッセージ（認知的に最も重要）
  const mainMessage = document.createElement('h1');
  mainMessage.style.cssText = `
    margin: 0 0 ${SIZES.SPACE_LG};
    font-size: ${SIZES.FONT_MASSIVE};
    font-weight: 700;
    color: ${COLORS.TEXT_DARK};
    line-height: ${SIZES.LINE_HEIGHT_TIGHT};
  `;
  mainMessage.textContent = TEXT.MAIN_TITLE;

  // 副次メッセージ
  const subMessage = document.createElement('p');
  subMessage.style.cssText = `
    margin: 0 0 ${SIZES.SPACE_MASSIVE};
    font-size: ${SIZES.FONT_XL};
    color: ${COLORS.TEXT_LIGHT};
    line-height: ${SIZES.LINE_HEIGHT_NORMAL};
  `;
  subMessage.innerHTML = TEXT.SUB_MESSAGE;

  // 解除方法（1行の説明）
  const instruction = document.createElement('p');
  instruction.style.cssText = `
    margin: -${SIZES.SPACE_LG} 0 ${SIZES.SPACE_HUGE}; /* 直前の説明とやや近づける */
    font-size: ${SIZES.FONT_MD};
    color: ${COLORS.TEXT_MUTED};
  `;
  instruction.textContent = TEXT.INSTRUCTION;

  card.appendChild(mainMessage);
  card.appendChild(subMessage);
  card.appendChild(instruction);

  return card;
}

/**
 * 使用統計セクション（タイトルとチャートコンテナ）を作成する
 */
function createUsageSection(): HTMLElement {
  const usageSection = document.createElement('div');
  usageSection.style.cssText = `
    margin-top: ${SIZES.SPACE_MASSIVE};
  `;

  const usageTitle = document.createElement('h3');
  usageTitle.style.cssText = `
    margin: 0 0 ${SIZES.SPACE_LG};
    font-size: ${SIZES.FONT_MD};
    font-weight: 600;
    color: ${COLORS.TEXT_LIGHT};
    text-transform: uppercase;
    letter-spacing: ${SIZES.LETTER_SPACING_WIDER};
  `;
  usageTitle.textContent = TEXT.CHART_TITLE;

  const chartContainer = document.createElement('div');
  chartContainer.id = SELECTORS.USAGE_CHART_ID;
  chartContainer.style.cssText = `
    background: ${COLORS.BACKGROUND_WHITE};
    border-radius: ${SIZES.RADIUS_LG};
    padding: ${SIZES.SPACE_XL};
    box-shadow: ${SIZES.SHADOW_MD};
  `;

  usageSection.appendChild(usageTitle);
  usageSection.appendChild(chartContainer);

  return usageSection;
}

/**
 * オーバーレイ要素をDOMに追加する
 */
function appendOverlayToDOM(card: HTMLElement, usageSection: HTMLElement): void {
  if (!state.overlay) return;

  const container = document.createElement('div');
  container.style.cssText = `
    max-width: ${SIZES.WIDTH_OVERLAY_MAX}; /* 説明文が1行に収まるよう少し拡張 */
    width: ${SIZES.WIDTH_OVERLAY_PERCENT};
    animation: ${ANIMATIONS.SLIDE_UP.name} ${TIMINGS.ANIMATION_SLOW} ${TIMINGS.EASE_FORWARDS};
  `;

  card.appendChild(usageSection);
  container.appendChild(card);
  state.overlay.appendChild(container);

  document.documentElement.appendChild(state.overlay);
}

/**
 * オーバーレイ全体を作成・表示する
 * Phase 1でリファクタリング済み：4つの責務に分解
 */
function createOverlay(): void {
  // 既存のオーバーレイが存在するかチェック（DOM内の要素も含む）
  if (state.overlay || document.getElementById(OVERLAY_ID)) {
    return;
  }

  // 1. オーバーレイベース要素を作成
  state.overlay = document.createElement('div');
  state.overlay.id = OVERLAY_ID;
  state.overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: ${SIZES.WIDTH_FULL};
    height: ${SIZES.HEIGHT_VIEWPORT};
    background: ${COLORS.BACKGROUND_OVERLAY}; /* 背景はカードより暗い灰色 */
    z-index: ${SIZES.Z_INDEX_OVERLAY};
    display: none; /* 初期状態では非表示 */
    justify-content: center;
    align-items: center;
    opacity: 0;
    animation: ${ANIMATIONS.FADE_IN.name} ${TIMINGS.ANIMATION_NORMAL} ${TIMINGS.EASE_FORWARDS};
  `;

  // 2. スタイル定義を作成・適用
  createOverlayStyles();

  // 3. メインカード要素を作成
  const card = createMainCard();

  // 4. 使用統計セクションを作成
  const usageSection = createUsageSection();

  // 5. DOMに追加
  appendOverlayToDOM(card, usageSection);
}

/**
 * 30日間の使用データを生成・集計する
 */
function generateUsageData(usageHistory: Record<string, number> | null): UsageData {
  const history = usageHistory || {};
  const today = new Date();
  const days: DayData[] = [];
  let totalMinutes = 0;
  
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const key = d.toLocaleDateString('sv-SE');
    const minutes = history[key] || 0;
    days.push({ date: key, minutes, dayOfWeek: d.getDay() });
    totalMinutes += minutes;
  }

  const max = Math.max(...days.map((d) => d.minutes), CHART_CONFIG.DEFAULT_MAX_MINUTES); // 最小値を30分に設定
  
  return { days, totalMinutes, max };
}

/**
 * 統計情報セクション（合計・平均・今日）を作成する
 */
function createStatsSection(totalMinutes: number, history: Record<string, number>): HTMLElement {
  const stats = document.createElement('div');
  stats.style.cssText = `
    display: flex;
    justify-content: space-around;
    margin-bottom: ${SIZES.SPACE_XL};
    padding-bottom: ${SIZES.SPACE_XL};
    border-bottom: 1px solid ${COLORS.BORDER_LIGHT};
  `;

  const avgMinutes = Math.round(totalMinutes / CHART_CONFIG.DAYS_TO_SHOW);
  const today = new Date();
  const statsData: StatData[] = [
    { label: TEXT.CHART_TOTAL, value: `${totalMinutes}${TEXT.UNIT_MINUTES}`, color: COLORS.INFO_BLUE },
    { label: TEXT.CHART_AVERAGE, value: `${avgMinutes}${TEXT.UNIT_MINUTES}`, color: COLORS.SUCCESS_GREEN_LIGHT },
    { label: TEXT.CHART_TODAY, value: `${history[today.toLocaleDateString('sv-SE')] || 0}${TEXT.UNIT_MINUTES}`, color: COLORS.ERROR_RED }
  ];

  statsData.forEach(stat => {
    const statDiv = document.createElement('div');
    statDiv.style.cssText = 'text-align: center;';
    statDiv.innerHTML = `
      <div style="font-size: ${SIZES.FONT_HUGE}; font-weight: 700; color: ${stat.color};">${stat.value}</div>
      <div style="font-size: ${SIZES.FONT_BASE}; color: ${COLORS.TEXT_MUTED}; margin-top: ${SIZES.SPACE_XS};">${stat.label}</div>
    `;
    stats.appendChild(statDiv);
  });

  return stats;
}

/**
 * Y軸ラベルを作成する
 */
function createYAxis(max: number): HTMLElement {
  const yAxisContainer = document.createElement('div');
  yAxisContainer.style.cssText = `
    position: absolute;
    left: ${SIZES.CHART_Y_AXIS_OFFSET};
    top: 0;
    height: ${SIZES.HEIGHT_CHART};
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    font-size: ${SIZES.FONT_SM};
    color: ${COLORS.TEXT_MUTED};
  `;

  for (let i = CHART_CONFIG.Y_AXIS_TICKS - 1; i >= 0; i--) {
    const tick = document.createElement('div');
    tick.style.cssText = 'text-align: right;';
    tick.textContent = `${Math.round((max / (CHART_CONFIG.Y_AXIS_TICKS - 1)) * i)}`;
    yAxisContainer.appendChild(tick);
  }

  return yAxisContainer;
}

/**
 * バーの背景色を決定する
 */
function getBarBackground(isToday: boolean, isWeekend: boolean): string {
  if (isToday) {
    return CSS_UTILS.linearGradient('135deg', [COLORS.CHART_TODAY + ' 0%', COLORS.CHART_TODAY_DARK + ' 100%']);
  }
  if (isWeekend) {
    return CSS_UTILS.linearGradient('135deg', [COLORS.CHART_WEEKEND + ' 0%', COLORS.CHART_WEEKEND_DARK + ' 100%']);
  }
  return CSS_UTILS.linearGradient('135deg', [COLORS.CHART_WEEKDAY + ' 0%', COLORS.CHART_WEEKDAY_DARK + ' 100%']);
}

/**
 * ツールチップ要素を作成する
 */
function createTooltip(d: DayData): HTMLElement {
  const tooltip = document.createElement('div');
  tooltip.style.cssText = `
    position: absolute;
    bottom: ${SIZES.WIDTH_FULL};
    left: 50%;
    transform: translateX(-50%);
    background: ${COLORS.TOOLTIP_BACKGROUND};
    color: ${COLORS.TOOLTIP_TEXT};
    padding: ${SIZES.SPACE_SM} ${SIZES.SPACE_MD};
    border-radius: ${SIZES.RADIUS_SM};
    font-size: ${SIZES.FONT_BASE};
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity ${TIMINGS.TOOLTIP_FADE_MS}ms ${TIMINGS.EASE_DEFAULT};
    margin-bottom: ${SIZES.SPACE_SM};
    z-index: ${SIZES.Z_INDEX_TOOLTIP};
  `;

  const [, m, day] = d.date.split('-').map(Number);
  tooltip.innerHTML = `
    <div style="font-weight: 600;">${m}月${day}日 (${TEXT.DAY_NAMES[d.dayOfWeek]})</div>
    <div style="margin-top: ${SIZES.SPACE_XS};">${d.minutes}${TEXT.UNIT_MINUTES}</div>
  `;

  return tooltip;
}

/**
 * 単一のバー要素を作成する
 */
function createBar(d: DayData, max: number, isToday: boolean): HTMLElement {
  const barContainer = document.createElement('div');
  barContainer.style.cssText = `
    flex: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    position: relative;
    cursor: pointer;
  `;

  const height = d.minutes > 0 ? Math.max((d.minutes / max) * 100, CHART_CONFIG.BAR_MIN_HEIGHT_PERCENT) : 0;
  const isWeekend = d.dayOfWeek === 0 || d.dayOfWeek === 6;

  const bar = document.createElement('div');
  bar.style.cssText = `
    width: ${SIZES.WIDTH_FULL};
    height: ${height}%;
    background: ${getBarBackground(isToday, isWeekend)};
    border-radius: ${SIZES.RADIUS_XS} ${SIZES.RADIUS_XS} 0 0;
    transition: all ${TIMINGS.ANIMATION_NORMAL} ${TIMINGS.EASE_DEFAULT};
    position: relative;
  `;

  const tooltip = createTooltip(d);

  // ホバーイベント登録
  barContainer.addEventListener('mouseenter', () => {
    bar.style.transform = 'scaleY(1.05)';
    bar.style.filter = 'brightness(1.1)';
    tooltip.style.opacity = '1';
  });

  barContainer.addEventListener('mouseleave', () => {
    bar.style.transform = 'scaleY(1)';
    bar.style.filter = 'brightness(1)';
    tooltip.style.opacity = '0';
  });

  barContainer.appendChild(bar);
  barContainer.appendChild(tooltip);

  return barContainer;
}

/**
 * グラフ本体コンテナを作成する
 */
function createChartContainer(): HTMLElement {
  const chart = document.createElement('div');
  chart.style.cssText = `
    display: flex;
    align-items: flex-end;
    height: ${SIZES.HEIGHT_CHART};
    gap: ${SIZES.CHART_BAR_GAP};
    padding: ${SIZES.CHART_PADDING};
    background: ${CSS_UTILS.linearGradient('to bottom', [
      COLORS.CHART_BACKGROUND + ' 0%',
      COLORS.TRANSPARENT + ' 100%'
    ])};
    border-radius: ${SIZES.RADIUS_MD};
  `;
  return chart;
}

/**
 * バーチャートとY軸を作成する
 */
function createChart(days: DayData[], max: number): HTMLElement {
  const chartWrapper = document.createElement('div');
  chartWrapper.style.cssText = 'position: relative;';

  const yAxis = createYAxis(max);
  const chart = createChartContainer();

  days.forEach((d, index) => {
    const isToday = index === days.length - 1;
    const barElement = createBar(d, max, isToday);
    chart.appendChild(barElement);
  });

  chartWrapper.appendChild(yAxis);
  chartWrapper.appendChild(chart);

  return chartWrapper;
}

/**
 * X軸（日付ラベル）を作成する
 */
function createXAxis(days: DayData[]): HTMLElement {
  const xAxis = document.createElement('div');
  xAxis.style.cssText = `
    display: flex;
    margin-top: ${SIZES.SPACE_SM};
    padding: ${SIZES.CHART_PADDING};
    font-size: ${SIZES.FONT_XS};
    color: ${COLORS.TEXT_MUTED};
  `;
  
  // 週ごとに日付を表示
  days.forEach((d, index) => {
    const label = document.createElement('div');
    label.style.cssText = 'flex: 1; text-align: center;';
    
    // 週の始まり（月曜日）または最初と最後の日付を表示
    if (d.dayOfWeek === 1 || index === 0 || index === days.length - 1) {
      const [y, m, day] = d.date.split('-').map(Number);
      label.textContent = `${m}/${day}`;
    }
    
    xAxis.appendChild(label);
  });
  
  return xAxis;
}

/**
 * 使用履歴チャートを更新・表示する
 * Phase 2でリファクタリング済み：4つの責務に分解
 */
function updateUsageChart(): void {
  if (!state.overlay) return;
  const container = state.overlay.querySelector(`#${SELECTORS.USAGE_CHART_ID}`) as HTMLElement;
  if (!container) return;
  
  StorageManager.getUsageHistory().then((usageHistory: Record<string, number> | null) => {
    // 1. データ生成・集計
    const { days, totalMinutes, max } = generateUsageData(usageHistory);
    
    container.innerHTML = '';
    
    // 2. 統計情報セクション作成
    const stats = createStatsSection(totalMinutes, usageHistory || {});
    container.appendChild(stats);
    
    // 3. チャート本体作成
    const chartWrapper = createChart(days, max);
    container.appendChild(chartWrapper);
    
    // 4. X軸作成
    const xAxis = createXAxis(days);
    container.appendChild(xAxis);
  }).catch((error: Error) => {
    console.error('Failed to load usage history:', error);
  });
}

// ===== updateOverlay Helper Types =====
interface OverlayContext {
  now: number;
  unblockUntil: number;
  isBlocked: boolean;
  composing: boolean;
  usingGrok: boolean;
  active: boolean;
  isTimeExpired: boolean;
}

/**
 * 時間切れかどうかを判定する
 */
function checkTimeExpired(isBlocked: boolean, unblockUntil: number): boolean {
  return (
    state.lastBlockState === false && // 前回は解除されていた
    isBlocked && // 今回はブロックされている
    state.lastUnblockUntil === unblockUntil // 同じ解除セッション内での時間切れ
  );
}

/**
 * オーバーレイを表示すべきかどうかを判定する
 */
function shouldShowOverlay(ctx: OverlayContext): boolean {
  return ctx.isBlocked && ctx.active && !ctx.composing && !ctx.usingGrok;
}

/**
 * ブロック中の処理を行う
 */
function handleBlockedState(ctx: OverlayContext): void {
  if (shouldShowOverlay(ctx)) {
    console.log('[Twitter Blocker] Action: showOverlay (blocked, active, not composing, not Grok)');
    createOverlay();
    showOverlay();

    if (ctx.isTimeExpired || state.pendingRedirect) {
      console.log('[Twitter Blocker] Action: requestRedirect (timeExpired:', ctx.isTimeExpired, 'pendingRedirect:', state.pendingRedirect, ')');
      state.pendingRedirect = false;
      requestRedirect();
    }

    if (state.overlay) {
      updateUsageChart();
    }
  } else {
    const reason = !ctx.active ? 'inactive' : ctx.composing ? 'composing' : ctx.usingGrok ? 'using Grok' : 'unknown';
    console.log('[Twitter Blocker] Action: hideOverlay (blocked but', reason, ')');
    hideOverlay();

    if ((ctx.composing || ctx.usingGrok) && ctx.isTimeExpired) {
      console.log('[Twitter Blocker] Setting pendingRedirect=true for later');
      state.pendingRedirect = true;
    }
  }
}

/**
 * ブロック解除中の処理を行う
 */
function handleUnblockedState(): void {
  console.log('[Twitter Blocker] Action: hideOverlay (unblocked)');
  hideOverlay();
  state.pendingRedirect = false;
}

/**
 * デバッグログを出力する
 */
function logDebugInfo(ctx: OverlayContext): void {
  console.log('[Twitter Blocker Debug]', {
    timestamp: new Date().toISOString(),
    now: ctx.now,
    unblockUntil: ctx.unblockUntil,
    isBlocked: ctx.isBlocked,
    timeDiff: ctx.unblockUntil - ctx.now,
    active: ctx.active,
    composing: ctx.composing,
    usingGrok: ctx.usingGrok,
    lastBlockState: state.lastBlockState,
    isTimeExpired: ctx.isTimeExpired,
    pendingRedirect: state.pendingRedirect,
    pathname: window.location.pathname
  });

  if (state.lastBlockState !== undefined && state.lastBlockState !== ctx.isBlocked) {
    console.log('[Twitter Blocker] State transition:', state.lastBlockState ? 'BLOCKED → UNBLOCKED' : 'UNBLOCKED → BLOCKED');
  }
}

function updateOverlay(): void {
  StorageManager.getUnblockUntil().then((unblockUntil: number) => {
    const now = Date.now();
    const isBlocked = now > unblockUntil;

    const ctx: OverlayContext = {
      now,
      unblockUntil,
      isBlocked,
      composing: isComposerOpen(),
      usingGrok: isGrokOpen(),
      active: isActivePage(),
      isTimeExpired: checkTimeExpired(isBlocked, unblockUntil),
    };

    logDebugInfo(ctx);

    if (ctx.isBlocked) {
      handleBlockedState(ctx);
    } else {
      handleUnblockedState();
    }

    // 状態を更新
    state.lastBlockState = ctx.isBlocked;
    state.lastUnblockUntil = ctx.unblockUntil;
  }).catch((error: Error) => {
    console.error('Failed to get unblock until time:', error);
  });
}

function showOverlay(): void {
  // state.overlay が未定義の場合はDOMから取得を試みる
  if (!state.overlay) {
    state.overlay = document.getElementById(OVERLAY_ID);
  }
  if (state.overlay) {
    state.overlay.style.display = 'flex';
  }
}

function hideOverlay(): void {
  // state.overlay が未定義の場合はDOMから取得を試みる
  if (!state.overlay) {
    state.overlay = document.getElementById(OVERLAY_ID);
  }
  if (state.overlay) {
    state.overlay.style.display = 'none';
  }
}

function requestRedirect(): void {
  chrome.runtime.sendMessage({ action: 'openRedirectURL' }, (response?: any) => {
    if (chrome.runtime.lastError) {
      console.error('Error sending message:', chrome.runtime.lastError);
    } else if (response) {
      // For debug visibility in console
      try { console.debug('Redirect response:', response); } catch (_) {}
    }
  });
}

// 【修正3】初期化処理：ストレージ読み込み完了後に実行するよう改善
function initialize(): void {
  console.log('[Twitter Blocker] Initializing content script...');
  
  // まずストレージが利用可能かを確認してから初期化を進める
  StorageManager.getUnblockUntil().then(() => {
    console.log('[Twitter Blocker] Storage initialized, setting up observer and overlay...');
    setupActivityObserver();
    updateOverlay();
    setInterval(updateOverlay, CHECK_INTERVAL_MS);
  }).catch((error: Error) => {
    console.error('[Twitter Blocker] Storage access error during initialization:', error);
  });
}

// DOM読み込み完了を確実に待ってから初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  // DOMが既に読み込み完了している場合も、非同期で初期化を実行
  setTimeout(initialize, 0);
}

chrome.runtime.onMessage.addListener((message: { action: string }) => {
  if (message.action === 'updateOverlay') {
    updateOverlay();
  }
});