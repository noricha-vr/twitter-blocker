let overlay;
let lastBlockState = undefined;  // 前回のブロック状態（undefined: 初回, true: ブロック中, false: 解除中）
let lastUnblockUntil = 0;       // 前回チェック時のunblockUntil値
let pendingRedirect = false;    // 投稿中に発火を抑止したリダイレクトを後で実行するためのフラグ
let lastComposerVisible = false; // 直近の投稿画面表示状態

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

function setupComposerObserver() {
  // 投稿画面の開閉を監視して、閉じたら即座に反映
  const observer = new MutationObserver(() => {
    const composing = isComposerOpen();
    if (composing !== lastComposerVisible) {
      lastComposerVisible = composing;
      if (!composing) {
        // 投稿完了（モーダル閉鎖）直後に反映
        updateOverlay();
      }
    }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: false });
}

function createOverlay() {
  if (overlay) return;

  overlay = document.createElement('div');
  overlay.id = 'block-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    background: #f8f9fa;
    z-index: 999999;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: opacity 0.3s;
  `;

  const message = document.createElement('div');
  message.style.cssText = `
    text-align: center;
    font-size: 20px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #333;
    padding: 20px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  `;
  message.innerHTML = `
    <h2 style="margin: 0 0 16px; font-size: 24px;">Twitter Blocker</h2>
    <p style="margin: 0 0 8px;">Twitter は現在ブロック中です。</p>
    <p style="margin: 0; font-size: 16px; color: #666;">
      拡張機能アイコンをクリックして<br>一時解除を設定してください。
    </p>
    <div id="usage-chart" style="margin-top:16px;"></div>
  `;

  overlay.appendChild(message);
  document.documentElement.appendChild(overlay);
}

function updateUsageChart() {
  if (!overlay) return;
  const container = overlay.querySelector('#usage-chart');
  if (!container) return;
  chrome.storage.sync.get(['usageHistory'], ({ usageHistory }) => {
    const history = usageHistory || {};
    const today = new Date();
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      // Use the user's local timezone when generating the date key
      const key = d.toLocaleDateString('sv-SE');
      days.push({ date: key, minutes: history[key] || 0 });
    }

    const max = Math.max(...days.map((d) => d.minutes), 1);
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;align-items:flex-end;height:100px;font-size:10px;';

    const yAxis = document.createElement('div');
    yAxis.style.cssText = 'display:flex;flex-direction:column;justify-content:space-between;height:100%;margin-right:4px;text-align:right;';
    for (let i = 4; i >= 0; i--) {
      const tick = document.createElement('div');
      tick.style.flex = '1';
      tick.textContent = Math.round((max / 4) * i);
      yAxis.appendChild(tick);
    }

    const chart = document.createElement('div');
    chart.style.cssText = 'display:flex;align-items:flex-end;height:100%;gap:2px;flex:1;';
    days.forEach((d) => {
      const bar = document.createElement('div');
      const h = (d.minutes / max) * 100;
      bar.style.cssText = `flex:1;background:#1da1f2;height:${h}%;`;
      bar.title = `${d.date}: ${d.minutes}分`;
      chart.appendChild(bar);
    });

    wrapper.appendChild(yAxis);
    wrapper.appendChild(chart);
    container.appendChild(wrapper);

    const xAxis = document.createElement('div');
    xAxis.style.cssText = 'display:flex;font-size:10px;margin-top:2px;gap:2px;';
    days.forEach((d) => {
      const label = document.createElement('div');
      label.style.cssText = 'flex:1;text-align:center;';
      const [y, m, day] = d.date.split('-').map(Number);
      label.textContent = new Date(y, m - 1, day).getDate();
      xAxis.appendChild(label);
    });
    container.appendChild(xAxis);
  });
}

function updateOverlay() {
  chrome.storage.sync.get(["unblockUntil"], (result) => {
    createOverlay();
    const unblockUntil = result.unblockUntil || 0;
    const now = Date.now();
    const isBlocked = now > unblockUntil;
    const composing = isComposerOpen();
    
    // 時間切れ検出：解除状態→ブロック状態への遷移を検出
    const isTimeExpired = 
      lastBlockState === false &&      // 前回は解除されていた
      isBlocked &&                     // 今回はブロックされている
      lastUnblockUntil === unblockUntil;  // 同じ解除セッション内での時間切れ

    if (isBlocked) {
      if (composing) {
        // 投稿中はオーバーレイもリダイレクトも抑止
        overlay.style.display = 'none';
        if (isTimeExpired) {
          // 投稿完了後に即時発火させる
          pendingRedirect = true;
        }
      } else {
        // 投稿していない場合は通常通り表示・リダイレクト
        overlay.style.display = 'flex';
        if (isTimeExpired || pendingRedirect) {
          pendingRedirect = false;
          // Background service worker にリダイレクトリクエストを送信
          chrome.runtime.sendMessage({ action: 'openRedirectURL' }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error sending message:', chrome.runtime.lastError);
            } else if (response) {
              console.log('Redirect response:', response);
            }
          });
        }
      }
    } else {
      overlay.style.display = 'none';
      pendingRedirect = false;
    }
    
    // 状態を更新
    lastBlockState = isBlocked;
    lastUnblockUntil = unblockUntil;
    
    updateUsageChart();
  });
}

updateOverlay();
setupComposerObserver();
setInterval(updateOverlay, 10 * 1000);

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'updateOverlay') {
    updateOverlay();
  }
});
