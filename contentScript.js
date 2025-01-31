// ページをブロックするための処理
function blockPage() {
  // すでにブロック済みなら何もしないようにする
  if (document.getElementById("block-overlay")) {
    return;
  }

  // 既存のコンテンツを非表示に
  document.body.style.display = 'none';

  // オーバーレイを追加
  const overlay = document.createElement('div');
  overlay.id = 'block-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: white;
    z-index: 999999;
    display: flex;
    justify-content: center;
    align-items: center;
  `;

  const message = document.createElement('div');
  message.style.cssText = `
    text-align: center;
    font-size: 20px;
    font-family: sans-serif;
  `;
  message.innerHTML = `
    <p>Twitter は現在ブロック中です。</p>
    <p>拡張機能アイコンをクリックして一時解除を設定してください。</p>
  `;

  overlay.appendChild(message);
  document.body.parentNode.appendChild(overlay);
}

// 解除されているかどうかをチェックするための関数
function checkBlockStatus() {
  chrome.storage.sync.get(["unblockUntil"], (result) => {
    const unblockUntil = result.unblockUntil || 0;
    const now = Date.now();

    if (now > unblockUntil) {
      blockPage();
    }
  });
}

// ページ読み込み時にまずチェック
checkBlockStatus();

// ページ表示中も10秒ごとにチェックし続けて、解除期限を過ぎたら即ブロック
const intervalId = setInterval(() => {
  checkBlockStatus();
}, 10 * 1000); 
