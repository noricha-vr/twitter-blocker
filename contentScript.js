let overlay;

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

    if (now > unblockUntil) {
      overlay.style.display = 'flex';
    } else {
      overlay.style.display = 'none';
    }
    updateUsageChart();
  });
}

updateOverlay();
setInterval(updateOverlay, 10 * 1000);

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'updateOverlay') {
    updateOverlay();
  }
});
