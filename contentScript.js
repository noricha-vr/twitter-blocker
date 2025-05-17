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
  `;

  overlay.appendChild(message);
  document.documentElement.appendChild(overlay);
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
  });
}

updateOverlay();
setInterval(updateOverlay, 10 * 1000);

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'updateOverlay') {
    updateOverlay();
  }
});
