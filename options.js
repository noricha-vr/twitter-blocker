document.addEventListener("DOMContentLoaded", () => {
  const startInput = document.getElementById("startTime");
  const endInput = document.getElementById("endTime");
  const saveBtn = document.getElementById("saveBtn");

  chrome.storage.sync.get(["startTime", "endTime"], ({ startTime, endTime }) => {
    if (startTime !== undefined) {
      startInput.value = startTime;
    }
    if (endTime !== undefined) {
      endInput.value = endTime;
    }
  });

  saveBtn.addEventListener("click", () => {
    const startValue = startInput.value;
    const endValue = endInput.value;

    chrome.storage.sync.set(
      {
        startTime: startValue,
        endTime: endValue
      },
      () => {
        alert("ブロック時間を保存しました。");
      }
    );
  });
}); 
