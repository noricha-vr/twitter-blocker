document.addEventListener("DOMContentLoaded", () => {
  const minuteInput = document.getElementById("minuteInput");
  const saveButton = document.getElementById("saveButton");
  const redirectUrlInput = document.getElementById("redirectUrlInput");
  const saveUrlButton = document.getElementById("saveUrlButton");
  const urlStatus = document.getElementById("urlStatus");
  const statusDiv = document.querySelector(".status");
  const quickButtons = document.querySelectorAll(".quick-button");

  // ステータスを更新する関数
  function updateStatus() {
    chrome.storage.sync.get(["unblockUntil"], (result) => {
      const unblockUntil = result.unblockUntil || 0;
      const now = Date.now();
      
      if (now < unblockUntil) {
        const remainingMinutes = Math.ceil((unblockUntil - now) / 60000);
        statusDiv.innerHTML = `🟢 解除中（残り${remainingMinutes}分）`;
        statusDiv.style.color = "#28a745";
      } else {
        statusDiv.innerHTML = "🔒 現在ブロック中";
        statusDiv.style.color = "#e74c3c";
      }
    });
  }

  // 初期状態を確認
  updateStatus();
  
  // 保存されている前回の設定時間とURLを読み込む
  chrome.storage.sync.get(["defaultMinutes", "redirectURL"], (result) => {
    if (result.defaultMinutes) {
      minuteInput.value = result.defaultMinutes;
    }
    if (result.redirectURL) {
      redirectUrlInput.value = result.redirectURL;
    }
  });

  // クイックアクセスボタンの処理
  quickButtons.forEach(button => {
    button.addEventListener("click", () => {
      const minutes = parseInt(button.dataset.minutes);
      minuteInput.value = minutes;
      
      // アクティブ状態の表示
      quickButtons.forEach(b => b.classList.remove("active"));
      button.classList.add("active");
    });
  });

  // 入力値が変更されたらクイックボタンのアクティブ状態を更新
  minuteInput.addEventListener("input", () => {
    const value = minuteInput.value;
    quickButtons.forEach(button => {
      if (button.dataset.minutes === value) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    });
  });

  // 解除ボタンの処理
  saveButton.addEventListener("click", () => {
    const minutes = parseInt(minuteInput.value, 10);
    if (isNaN(minutes) || minutes <= 0 || minutes > 120) {
      minuteInput.style.borderColor = "#e74c3c";
      setTimeout(() => {
        minuteInput.style.borderColor = "#e1e8ed";
      }, 2000);
      return;
    }

    const now = Date.now();
    const unblockUntil = now + minutes * 60 * 1000;

    chrome.storage.sync.get(["usageHistory"], ({ usageHistory }) => {
      const history = usageHistory || {};
      const today = new Date().toLocaleDateString('sv-SE');
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

          // ウィンドウを閉じる
          window.close();
        }
      );
    });
  });

  // URL保存ボタンのイベントリスナー
  saveUrlButton.addEventListener("click", () => {
    const url = redirectUrlInput.value.trim();
    
    // URLのバリデーション
    if (url && url !== '') {
      try {
        new URL(url);
        // URLが有効な場合、保存
        chrome.storage.sync.set({ redirectURL: url }, () => {
          // 成功メッセージを表示
          urlStatus.style.display = "block";
          urlStatus.innerHTML = "✓ 保存しました";
          urlStatus.style.color = "#28a745";
          
          // 3秒後に非表示
          setTimeout(() => {
            urlStatus.style.display = "none";
          }, 3000);
          
          // 現在アクティブなタブに設定更新を通知
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, { action: "updateRedirectURL" });
            }
          });
        });
      } catch (error) {
        // エラーメッセージを表示
        urlStatus.style.display = "block";
        urlStatus.innerHTML = "✗ 有効なURLを入力してください";
        urlStatus.style.color = "#e74c3c";
        
        redirectUrlInput.style.borderColor = "#e74c3c";
        setTimeout(() => {
          redirectUrlInput.style.borderColor = "#e1e8ed";
          urlStatus.style.display = "none";
        }, 3000);
      }
    } else {
      // 空の場合はURLをクリア
      chrome.storage.sync.set({ redirectURL: '' }, () => {
        urlStatus.style.display = "block";
        urlStatus.innerHTML = "✓ URLをクリアしました";
        urlStatus.style.color = "#666";
        
        setTimeout(() => {
          urlStatus.style.display = "none";
        }, 3000);
      });
    }
  });

  // Enterキーでの送信サポート
  minuteInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      saveButton.click();
    }
  });

  redirectUrlInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      saveUrlButton.click();
    }
  });
});