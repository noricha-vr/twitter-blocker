// ページをブロックするための処理
function blockPage() {
  // すでにブロック済みなら何もしないようにする
  if (document.getElementById("block-overlay")) {
    return;
  }

  document.documentElement.innerHTML = `
    <head>
      <meta charset="UTF-8" />
      <title>Blocked</title>
      <style>
        body {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          background-color: #fff;
          font-family: sans-serif;
        }
        .blocked-message {
          text-align: center;
          font-size: 20px;
        }
      </style>
    </head>
    <body>
      <div class="blocked-message" id="block-overlay">
        <p>Twitter は現在ブロック中です。</p>
        <p>拡張機能アイコンをクリックして一時解除を設定してください。</p>
      </div>
    </body>
  `;
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
