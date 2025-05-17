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

    const now = Date.now();
    const unblockUntil = now + minutes * 60 * 1000;

    chrome.storage.sync.get(["usageHistory"], ({ usageHistory }) => {
      const history = usageHistory || {};
      const today = new Date().toISOString().slice(0, 10);
      history[today] = (history[today] || 0) + minutes;

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 29);
      Object.keys(history).forEach((key) => {
        if (new Date(key) < cutoff) {
          delete history[key];
        }
      });

      chrome.storage.sync.set(
        {
          usageHistory: history,
          defaultMinutes: minutes,
          unblockUntil,
        },
        () => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, { action: "updateOverlay" });
            }
          });

          alert(`${minutes}分後に再度ブロックが有効になります。`);
          window.close();
        }
      );
    });
  });
}); 
