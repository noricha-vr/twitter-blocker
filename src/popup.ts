import { COLORS, TIMINGS, SELECTORS, TEXT, VALIDATION } from './constants';
import { StorageManager } from './storageManager';

interface PopupState {
  minuteInput: HTMLInputElement;
  saveButton: HTMLButtonElement;
  redirectUrlInput: HTMLInputElement;
  saveUrlButton: HTMLButtonElement;
  urlStatus: HTMLDivElement;
  statusDiv: HTMLElement;
  quickButtons: NodeListOf<HTMLButtonElement>;
}

interface QuickButtonData {
  minutes: string;
}

// StorageManager を使用するため、ローカル定数は削除

document.addEventListener("DOMContentLoaded", () => {
  const state = getPopupElements();
  if (!state) {
    console.error('Required popup elements not found');
    return;
  }

  // ステータスを更新する関数
  function updateStatus(): void {
    if (!state) return;
    
    StorageManager.getUnblockUntil().then((unblockUntil: number) => {
      if (!state) return;
      
      const now = Date.now();
      
      if (now < unblockUntil) {
        const remainingMinutes = Math.ceil((unblockUntil - now) / 60000);
        state.statusDiv.innerHTML = TEXT.STATUS_UNBLOCKED.replace('{minutes}', remainingMinutes.toString());
        state.statusDiv.style.color = COLORS.SUCCESS_GREEN;
      } else {
        state.statusDiv.innerHTML = TEXT.STATUS_BLOCKED;
        state.statusDiv.style.color = COLORS.ERROR_RED;
      }
    }).catch((error: Error) => {
      if (!state) return;
      console.error('Failed to get unblock until time:', error);
      state.statusDiv.innerHTML = TEXT.STATUS_BLOCKED;
      state.statusDiv.style.color = COLORS.ERROR_RED;
    });
  }

  // 初期状態を確認
  updateStatus();
  
  // 保存されている前回の設定時間とURLを読み込む
  Promise.all([
    StorageManager.getDefaultMinutes(),
    StorageManager.getRedirectURL()
  ]).then(([defaultMinutes, redirectURL]: [number | null, string | null]) => {
    if (defaultMinutes && state) {
      state.minuteInput.value = defaultMinutes.toString();
    }
    if (redirectURL && state) {
      state.redirectUrlInput.value = redirectURL;
    }
  }).catch((error: Error) => {
    console.error('Failed to load saved settings:', error);
  });

  // クイックアクセスボタンの処理
  state.quickButtons.forEach((button: HTMLButtonElement) => {
    button.addEventListener("click", () => {
      const minutesStr = button.dataset.minutes;
      if (!minutesStr || !state) return;
      
      const minutes = parseInt(minutesStr);
      state.minuteInput.value = minutes.toString();
      
      // アクティブ状態の表示
      state.quickButtons.forEach(b => b.classList.remove("active"));
      button.classList.add("active");
    });
  });

  // 入力値が変更されたらクイックボタンのアクティブ状態を更新
  state.minuteInput.addEventListener("input", () => {
    if (!state) return;
    const value = state.minuteInput.value;
    state.quickButtons.forEach((button: HTMLButtonElement) => {
      if (button.dataset.minutes === value) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    });
  });

  // 解除ボタンの処理
  state.saveButton.addEventListener("click", () => {
    if (state) handleSaveUnblock(state);
  });

  // URL保存ボタンのイベントリスナー
  state.saveUrlButton.addEventListener("click", () => {
    if (state) handleSaveRedirectURL(state);
  });

  // デバッグ: ログのダウンロード/クリア用のキーボードショートカット
  // Mac: Cmd+D でログダウンロード、Cmd+Backspace でクリア
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
      chrome.runtime.sendMessage({ action: "downloadLogs" });
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === "Backspace" || e.key.toLowerCase() === "delete")) {
      chrome.runtime.sendMessage({ action: "clearLogs" });
    }
  });

  // Enterキーでの送信サポート
  state.minuteInput.addEventListener("keypress", (e: KeyboardEvent) => {
    if (e.key === "Enter" && state) {
      state.saveButton.click();
    }
  });

  state.redirectUrlInput.addEventListener("keypress", (e: KeyboardEvent) => {
    if (e.key === "Enter" && state) {
      state.saveUrlButton.click();
    }
  });
});

function getPopupElements(): PopupState | null {
  const minuteInput = document.getElementById(SELECTORS.MINUTE_INPUT_ID) as HTMLInputElement;
  const saveButton = document.getElementById(SELECTORS.SAVE_BUTTON_ID) as HTMLButtonElement;
  const redirectUrlInput = document.getElementById(SELECTORS.REDIRECT_URL_INPUT_ID) as HTMLInputElement;
  const saveUrlButton = document.getElementById(SELECTORS.SAVE_URL_BUTTON_ID) as HTMLButtonElement;
  const urlStatus = document.getElementById(SELECTORS.URL_STATUS_ID) as HTMLDivElement;
  const statusDiv = document.querySelector(SELECTORS.STATUS_CLASS) as HTMLElement;
  const quickButtons = document.querySelectorAll(SELECTORS.QUICK_BUTTON_CLASS) as NodeListOf<HTMLButtonElement>;

  if (!minuteInput || !saveButton || !redirectUrlInput || !saveUrlButton || !urlStatus || !statusDiv || !quickButtons) {
    return null;
  }

  return {
    minuteInput,
    saveButton,
    redirectUrlInput,
    saveUrlButton,
    urlStatus,
    statusDiv,
    quickButtons
  };
}

function handleSaveUnblock(state: PopupState): void {
  const minutes = parseInt(state.minuteInput.value, 10);
  if (isNaN(minutes) || minutes < VALIDATION.MIN_MINUTES || minutes > VALIDATION.MAX_MINUTES) {
    setInputError(state.minuteInput);
    return;
  }

  const now = Date.now();
  const unblockUntil = now + minutes * 60 * 1000;

  StorageManager.getUsageHistory().then((usageHistory: Record<string, number> | null) => {
    const history = usageHistory || {};
    const today = new Date().toLocaleDateString('sv-SE');
    history[today] = (history[today] || 0) + minutes;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (VALIDATION.HISTORY_RETENTION_DAYS - 1));
    Object.keys(history).forEach((key) => {
      if (new Date(key) < cutoff) {
        delete history[key];
      }
    });

    return StorageManager.setSync({
      [StorageManager.KEYS.USAGE_HISTORY]: history,
      [StorageManager.KEYS.DEFAULT_MINUTES]: minutes,
      [StorageManager.KEYS.UNBLOCK_UNTIL]: unblockUntil,
    });
  }).then(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "updateOverlay" });
      }
    });

    // ウィンドウを閉じる
    window.close();
  }).catch((error: Error) => {
    console.error('Failed to save settings:', error);
    setInputError(state.minuteInput);
  });
}

function handleSaveRedirectURL(state: PopupState): void {
  const url = state.redirectUrlInput.value.trim();
  
  // URLのバリデーション
  if (url && url !== '') {
    try {
      new URL(url);
      // URLが有効な場合、保存
      StorageManager.setRedirectURL(url).then(() => {
        showURLStatus(state.urlStatus, TEXT.URL_SAVED, COLORS.SUCCESS_GREEN);
        
        // 現在アクティブなタブに設定更新を通知
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
          if (tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "updateRedirectURL" });
          }
        });
      }).catch((error: Error) => {
        console.error('Failed to save redirect URL:', error);
        showURLStatus(state.urlStatus, TEXT.URL_INVALID, COLORS.ERROR_RED);
      });
    } catch (error) {
      // エラーメッセージを表示
      showURLStatus(state.urlStatus, TEXT.URL_INVALID, COLORS.ERROR_RED);
      setInputError(state.redirectUrlInput);
    }
  } else {
    // 空の場合はURLをクリア
    StorageManager.setRedirectURL('').then(() => {
      showURLStatus(state.urlStatus, TEXT.URL_CLEARED, COLORS.TEXT_SECONDARY);
    }).catch((error: Error) => {
      console.error('Failed to clear redirect URL:', error);
    });
  }
}

function setInputError(inputElement: HTMLInputElement): void {
  inputElement.style.borderColor = COLORS.ERROR_RED;
  setTimeout(() => {
    inputElement.style.borderColor = COLORS.BORDER_DEFAULT;
  }, TIMINGS.INPUT_ERROR_RESET_MS);
}

function showURLStatus(urlStatusElement: HTMLDivElement, message: string, color: string): void {
  urlStatusElement.style.display = "block";
  urlStatusElement.innerHTML = message;
  urlStatusElement.style.color = color;
  
  setTimeout(() => {
    urlStatusElement.style.display = "none";
  }, TIMINGS.STATUS_HIDE_MS);
}