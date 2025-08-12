// ===== Constants =====
const OVERLAY_ID = 'block-overlay';
const CHECK_INTERVAL_MS = 10 * 1000;
const STORAGE_KEYS = {
  unblockUntil: 'unblockUntil',
  usageHistory: 'usageHistory',
};

// ===== Mutable state =====
let overlay;
let lastBlockState = undefined;  // 前回のブロック状態（undefined: 初回, true: ブロック中, false: 解除中）
let lastUnblockUntil = 0;        // 前回チェック時のunblockUntil値
let pendingRedirect = false;     // 投稿中に抑止したリダイレクトを後で実行するためのフラグ
let lastComposerVisible = false; // 直近の投稿画面表示状態
let lastGrokVisible = false;     // 直近のGrok画面表示状態

function isActivePage() {
  try {
    // 【修正4】アクティブページ判定をより厳密に
    // document.visibilityState === 'visible': タブがアクティブ
    // document.hasFocus(): ウィンドウがフォーカスされている
    const isVisible = document.visibilityState === 'visible';
    const hasFocus = document.hasFocus();
    
    // デバッグログ（必要に応じて）
    console.log('[Twitter Blocker] Active page check:', { isVisible, hasFocus });
    
    return isVisible && hasFocus;
  } catch (error) {
    console.warn('[Twitter Blocker] Error checking active page:', error);
    // エラー時は保守的にtrueを返す（ブロックを優先）
    return true;
  }
}

function isElementVisible(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  if (!rect || rect.width === 0 || rect.height === 0) return false;
  const style = window.getComputedStyle(element);
  if (!style) return false;
  if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;
  return true;
}

function isComposerOpen() {
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

function isGrokOpen() {
  // Grok画面が開いているかを判定
  try {
    // URLベースの検出
    if (window.location.pathname.includes('/i/grok')) {
      return true;
    }
    
    // DOM要素ベースの検出（Grokチャット画面の特徴的な要素）
    // Grok固有のモーダルやチャット要素を探す
    const grokElements = document.querySelectorAll(
      '[aria-label*="Grok"], [data-testid*="grok"], .grok-chat, #grok-container'
    );
    
    for (const element of grokElements) {
      if (isElementVisible(element)) {
        return true;
      }
    }
    
    // Grok会話画面の特徴的な要素パターンも検出
    // 会話IDを含むURLパターン（例: /i/grok?conversation=xxxx）
    if (window.location.pathname === '/i/grok' && window.location.search.includes('conversation=')) {
      return true;
    }
    
    return false;
  } catch (_) {
    return false;
  }
}

function setupActivityObserver() {
  // 投稿画面とGrok画面の開閉を監視して、閉じたら即座に反映
  const observer = new MutationObserver(() => {
    const composing = isComposerOpen();
    const usingGrok = isGrokOpen();
    
    // 投稿画面の状態変化を検出
    if (composing !== lastComposerVisible) {
      lastComposerVisible = composing;
      if (!composing) {
        // 投稿完了（モーダル閉鎖）直後に反映
        updateOverlay();
      }
    }
    
    // Grok画面の状態変化を検出
    if (usingGrok !== lastGrokVisible) {
      lastGrokVisible = usingGrok;
      if (!usingGrok) {
        // Grok終了直後に反映
        updateOverlay();
      }
    }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: false });

  // タブの可視状態やフォーカス変化に応じて即時反映
  document.addEventListener('visibilitychange', updateOverlay);
  window.addEventListener('focus', updateOverlay);
  window.addEventListener('blur', updateOverlay);
  
  // URL変更を監視（Grokへのナビゲーションを検出）
  window.addEventListener('popstate', updateOverlay);
  // pushState/replaceStateのオーバーライドでURL変更を検出
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function() {
    originalPushState.apply(history, arguments);
    setTimeout(updateOverlay, 0);
  };
  
  history.replaceState = function() {
    originalReplaceState.apply(history, arguments);
    setTimeout(updateOverlay, 0);
  };
}

/**
 * オーバーレイのCSSスタイル定義を作成・適用する
 */
function createOverlayStyles() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from { 
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
}

/**
 * メインカード要素（メッセージと指示部分）を作成する
 * @returns {HTMLElement} 作成されたカード要素
 */
function createMainCard() {
  const card = document.createElement('div');
  card.style.cssText = `
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 24px;
    padding: 48px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    text-align: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  // 主要メッセージ（認知的に最も重要）
  const mainMessage = document.createElement('h1');
  mainMessage.style.cssText = `
    margin: 0 0 16px;
    font-size: 32px;
    font-weight: 700;
    color: #2c3e50;
    line-height: 1.2;
  `;
  mainMessage.textContent = 'Twitter はブロック中です';

  // 副次メッセージ
  const subMessage = document.createElement('p');
  subMessage.style.cssText = `
    margin: 0 0 32px;
    font-size: 18px;
    color: #7f8c8d;
    line-height: 1.5;
  `;
  subMessage.innerHTML = '集中力を保つため、現在アクセスが制限されています';

  // 解除方法（1行の説明）
  const instruction = document.createElement('p');
  instruction.style.cssText = `
    margin: -16px 0 28px; /* 直前の説明とやや近づける */
    font-size: 14px;
    color: #95a5a6;
  `;
  instruction.textContent = '一時的に解除するには、拡張機能アイコンをクリックして時間を設定してください。';

  card.appendChild(mainMessage);
  card.appendChild(subMessage);
  card.appendChild(instruction);

  return card;
}

/**
 * 使用統計セクション（タイトルとチャートコンテナ）を作成する
 * @returns {HTMLElement} 作成された使用統計セクション
 */
function createUsageSection() {
  const usageSection = document.createElement('div');
  usageSection.style.cssText = `
    margin-top: 32px;
  `;

  const usageTitle = document.createElement('h3');
  usageTitle.style.cssText = `
    margin: 0 0 16px;
    font-size: 14px;
    font-weight: 600;
    color: #7f8c8d;
    text-transform: uppercase;
    letter-spacing: 1px;
  `;
  usageTitle.textContent = '直近30日間の使用時間';

  const chartContainer = document.createElement('div');
  chartContainer.id = 'usage-chart';
  chartContainer.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  `;

  usageSection.appendChild(usageTitle);
  usageSection.appendChild(chartContainer);

  return usageSection;
}

/**
 * オーバーレイ要素をDOMに追加する
 * @param {HTMLElement} card - メインカード要素
 * @param {HTMLElement} usageSection - 使用統計セクション
 */
function appendOverlayToDOM(card, usageSection) {
  const container = document.createElement('div');
  container.style.cssText = `
    max-width: 680px; /* 説明文が1行に収まるよう少し拡張 */
    width: 90%;
    animation: slideUp 0.5s ease forwards;
  `;

  card.appendChild(usageSection);
  container.appendChild(card);
  overlay.appendChild(container);
  
  document.documentElement.appendChild(overlay);
}

/**
 * オーバーレイ全体を作成・表示する
 * Phase 1でリファクタリング済み：4つの責務に分解
 */
function createOverlay() {
  // 既存のオーバーレイが存在するかチェック（DOM内の要素も含む）
  if (overlay || document.getElementById(OVERLAY_ID)) {
    return;
  }

  // 1. オーバーレイベース要素を作成
  overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    background: #2f2f2f; /* 背景はカードより暗い灰色 */
    z-index: 999999;
    display: none; /* 初期状態では非表示 */
    justify-content: center;
    align-items: center;
    opacity: 0;
    animation: fadeIn 0.3s ease forwards;
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
 * @param {Object} usageHistory - 使用履歴のオブジェクト
 * @returns {Object} { days: Array, totalMinutes: number, max: number }
 */
function generateUsageData(usageHistory) {
  const history = usageHistory || {};
  const today = new Date();
  const days = [];
  let totalMinutes = 0;
  
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const key = d.toLocaleDateString('sv-SE');
    const minutes = history[key] || 0;
    days.push({ date: key, minutes, dayOfWeek: d.getDay() });
    totalMinutes += minutes;
  }

  const max = Math.max(...days.map((d) => d.minutes), 30); // 最小値を30分に設定
  
  return { days, totalMinutes, max };
}

/**
 * 統計情報セクション（合計・平均・今日）を作成する
 * @param {number} totalMinutes - 合計使用時間
 * @param {Object} history - 使用履歴
 * @returns {HTMLElement} 作成された統計情報要素
 */
function createStatsSection(totalMinutes, history) {
  const stats = document.createElement('div');
  stats.style.cssText = `
    display: flex;
    justify-content: space-around;
    margin-bottom: 20px;
    padding-bottom: 20px;
    border-bottom: 1px solid #ecf0f1;
  `;

  const avgMinutes = Math.round(totalMinutes / 30);
  const today = new Date();
  const statsData = [
    { label: '合計', value: `${totalMinutes}分`, color: '#3498db' },
    { label: '1日平均', value: `${avgMinutes}分`, color: '#2ecc71' },
    { label: '今日', value: `${history[today.toLocaleDateString('sv-SE')] || 0}分`, color: '#e74c3c' }
  ];

  statsData.forEach(stat => {
    const statDiv = document.createElement('div');
    statDiv.style.cssText = 'text-align: center;';
    statDiv.innerHTML = `
      <div style="font-size: 24px; font-weight: 700; color: ${stat.color};">${stat.value}</div>
      <div style="font-size: 12px; color: #95a5a6; margin-top: 4px;">${stat.label}</div>
    `;
    stats.appendChild(statDiv);
  });

  return stats;
}

/**
 * バーチャートとY軸を作成する
 * @param {Array} days - 日別データの配列
 * @param {number} max - 最大値
 * @returns {HTMLElement} 作成されたチャートラッパー要素
 */
function createChart(days, max) {
  const chartWrapper = document.createElement('div');
  chartWrapper.style.cssText = 'position: relative;';

  // Y軸ラベル
  const yAxisContainer = document.createElement('div');
  yAxisContainer.style.cssText = `
    position: absolute;
    left: -40px;
    top: 0;
    height: 120px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    font-size: 11px;
    color: #95a5a6;
  `;

  for (let i = 3; i >= 0; i--) {
    const tick = document.createElement('div');
    tick.style.cssText = 'text-align: right;';
    tick.textContent = `${Math.round((max / 3) * i)}`;
    yAxisContainer.appendChild(tick);
  }

  // グラフ本体
  const chart = document.createElement('div');
  chart.style.cssText = `
    display: flex;
    align-items: flex-end;
    height: 120px;
    gap: 3px;
    padding: 0 5px;
    background: linear-gradient(to bottom, 
      rgba(52, 152, 219, 0.05) 0%, 
      rgba(52, 152, 219, 0) 100%);
    border-radius: 8px;
  `;

  days.forEach((d, index) => {
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

    const bar = document.createElement('div');
    const height = d.minutes > 0 ? Math.max((d.minutes / max) * 100, 3) : 0;
    const isToday = index === days.length - 1;
    const isWeekend = d.dayOfWeek === 0 || d.dayOfWeek === 6;
    
    bar.style.cssText = `
      width: 100%;
      height: ${height}%;
      background: ${isToday ? 
        'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)' : 
        isWeekend ? 
        'linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)' :
        'linear-gradient(135deg, #3498db 0%, #2980b9 100%)'
      };
      border-radius: 4px 4px 0 0;
      transition: all 0.3s ease;
      position: relative;
    `;

    // ホバー時のツールチップ
    const tooltip = document.createElement('div');
    tooltip.style.cssText = `
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(44, 62, 80, 0.95);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
      margin-bottom: 8px;
      z-index: 10;
    `;
    
    const [y, m, day] = d.date.split('-').map(Number);
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    tooltip.innerHTML = `
      <div style="font-weight: 600;">${m}月${day}日 (${dayNames[d.dayOfWeek]})</div>
      <div style="margin-top: 4px;">${d.minutes}分</div>
    `;

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
    chart.appendChild(barContainer);
  });

  chartWrapper.appendChild(yAxisContainer);
  chartWrapper.appendChild(chart);
  
  return chartWrapper;
}

/**
 * X軸（日付ラベル）を作成する
 * @param {Array} days - 日別データの配列
 * @returns {HTMLElement} 作成されたX軸要素
 */
function createXAxis(days) {
  const xAxis = document.createElement('div');
  xAxis.style.cssText = `
    display: flex;
    margin-top: 8px;
    padding: 0 5px;
    font-size: 10px;
    color: #95a5a6;
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
function updateUsageChart() {
  if (!overlay) return;
  const container = overlay.querySelector('#usage-chart');
  if (!container) return;
  
  chrome.storage.sync.get([STORAGE_KEYS.usageHistory], ({ usageHistory }) => {
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
  });
}

function updateOverlay() {
  chrome.storage.sync.get([STORAGE_KEYS.unblockUntil], (result) => {
    const unblockUntil = result[STORAGE_KEYS.unblockUntil] || 0;
    const now = Date.now();
    const isBlocked = now > unblockUntil;
    const composing = isComposerOpen();
    const usingGrok = isGrokOpen();
    const active = isActivePage();
    
    // デバッグログ
    console.log('[Twitter Blocker Debug]', {
      now,
      unblockUntil,
      isBlocked,
      lastBlockState,
      lastUnblockUntil,
      composing,
      usingGrok,
      active,
      timeDiff: unblockUntil - now
    });
    
    // 時間切れ検出：解除状態→ブロック状態への遷移を検出
    const isTimeExpired = 
      lastBlockState === false &&      // 前回は解除されていた
      isBlocked &&                     // 今回はブロックされている
      lastUnblockUntil === unblockUntil;  // 同じ解除セッション内での時間切れ

    if (isBlocked) {
      // 【修正1】ブロック中でアクティブページかつ投稿/Grok中でない場合のみオーバーレイ表示
      if (active && !composing && !usingGrok) {
        // オーバーレイを作成してから表示
        createOverlay();
        showOverlay();
        
        if (isTimeExpired || pendingRedirect) {
          pendingRedirect = false;
          // Background service worker にリダイレクトリクエストを送信
          requestRedirect();
        }
        
        // チャート更新
        if (overlay) {
          updateUsageChart();
        }
      } else {
        // 【修正2】非アクティブ、投稿中、Grok中はオーバーレイを非表示
        hideOverlay();
        if (composing || usingGrok) {
          if (isTimeExpired) {
            // 投稿/Grok完了後に即時発火させる
            pendingRedirect = true;
          }
        }
      }
    } else {
      // ブロック解除中はオーバーレイを隠す
      hideOverlay();
      pendingRedirect = false;
    }
    
    // 状態を更新
    lastBlockState = isBlocked;
    lastUnblockUntil = unblockUntil;
  });
}

function showOverlay() {
  // グローバル変数が未定義の場合はDOMから取得を試みる
  if (!overlay) {
    overlay = document.getElementById(OVERLAY_ID);
  }
  if (overlay) {
    overlay.style.display = 'flex';
  }
}

function hideOverlay() {
  // グローバル変数が未定義の場合はDOMから取得を試みる
  if (!overlay) {
    overlay = document.getElementById(OVERLAY_ID);
  }
  if (overlay) {
    overlay.style.display = 'none';
  }
}

function requestRedirect() {
  chrome.runtime.sendMessage({ action: 'openRedirectURL' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error sending message:', chrome.runtime.lastError);
    } else if (response) {
      // For debug visibility in console
      try { console.debug('Redirect response:', response); } catch (_) {}
    }
  });
}

// 【修正3】初期化処理：ストレージ読み込み完了後に実行するよう改善
function initialize() {
  console.log('[Twitter Blocker] Initializing content script...');
  
  // まずストレージが利用可能かを確認してから初期化を進める
  chrome.storage.sync.get([STORAGE_KEYS.unblockUntil], (result) => {
    if (chrome.runtime.lastError) {
      console.error('[Twitter Blocker] Storage access error during initialization:', chrome.runtime.lastError);
      return;
    }
    
    console.log('[Twitter Blocker] Storage initialized, setting up observer and overlay...');
    setupActivityObserver();
    updateOverlay();
    setInterval(updateOverlay, CHECK_INTERVAL_MS);
  });
}

// DOM読み込み完了を確実に待ってから初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  // DOMが既に読み込み完了している場合も、非同期で初期化を実行
  setTimeout(initialize, 0);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'updateOverlay') {
    updateOverlay();
  }
});
