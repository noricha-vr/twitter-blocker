document.addEventListener("DOMContentLoaded", () => {
  const minuteInput = document.getElementById("minuteInput");
  const saveButton = document.getElementById("saveButton");

  saveButton.addEventListener("click", () => {
    const minutes = parseInt(minuteInput.value, 10);
    if (isNaN(minutes) || minutes <= 0) {
      alert("1以上の数値を入力してください。");
      return;
    }

    // いまの日時 + 指定分数をミリ秒で足して「解除期限」を生成
    const now = Date.now();
    const unblockUntil = now + minutes * 60 * 1000;

    // chrome.storage.sync に保存
    chrome.storage.sync.set({ unblockUntil }, () => {
      alert(`${minutes}分後に再度ブロックが有効になります。`);
      window.close();
    });
  });
}); 
