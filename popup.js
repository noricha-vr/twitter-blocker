document.addEventListener("DOMContentLoaded", () => {
  const minuteInput = document.getElementById("minuteInput");
  const saveButton = document.getElementById("saveButton");

  // 保存されている前回の設定時間を読み込む
  chrome.storage.sync.get(["defaultMinutes"], (result) => {
    if (result.defaultMinutes) {
      minuteInput.value = result.defaultMinutes;
    }
  });

  saveButton.addEventListener("click", () => {
    const minutes = parseInt(minuteInput.value, 10);
    if (isNaN(minutes) || minutes <= 0) {
      alert("1以上の数値を入力してください。");
      return;
    }

    // 入力された分数を次回のデフォルト値として保存
    chrome.storage.sync.set({ defaultMinutes: minutes });

    // いまの日時 + 指定分数をミリ秒で足して「解除期限」を生成
    const now = Date.now();
    const unblockUntil = now + minutes * 60 * 1000;

    // chrome.storage.sync に保存
    chrome.storage.sync.set({ unblockUntil }, () => {
      // 現在のタブにオーバーレイ更新を通知
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: "updateOverlay" });
        }
      });

      alert(`${minutes}分後に再度ブロックが有効になります。`);
      window.close();
    });
  });
}); 
