import { StorageManager } from './storageManager';

interface OptionsElements {
  startInput: HTMLInputElement;
  endInput: HTMLInputElement;
  saveBtn: HTMLButtonElement;
}

interface StorageResult {
  [StorageManager.KEYS.START_TIME]?: string;
  [StorageManager.KEYS.END_TIME]?: string;
}

document.addEventListener("DOMContentLoaded", () => {
  const elements = getOptionsElements();
  if (!elements) {
    console.error('Required options elements not found');
    return;
  }

  // 設定値の読み込み
  loadSettings(elements);

  // 保存ボタンのイベントリスナー
  elements.saveBtn.addEventListener("click", () => {
    saveSettings(elements);
  });
});

function getOptionsElements(): OptionsElements | null {
  const startInput = document.getElementById("startTime") as HTMLInputElement;
  const endInput = document.getElementById("endTime") as HTMLInputElement;
  const saveBtn = document.getElementById("saveBtn") as HTMLButtonElement;

  if (!startInput || !endInput || !saveBtn) {
    return null;
  }

  return { startInput, endInput, saveBtn };
}

function loadSettings(elements: OptionsElements): void {
  StorageManager.getSync([StorageManager.KEYS.START_TIME, StorageManager.KEYS.END_TIME])
    .then((result: StorageResult) => {
      const startTime = result[StorageManager.KEYS.START_TIME];
      const endTime = result[StorageManager.KEYS.END_TIME];
      
      if (startTime !== undefined) {
        elements.startInput.value = startTime;
      }
      if (endTime !== undefined) {
        elements.endInput.value = endTime;
      }
    })
    .catch((error: Error) => {
      console.error('Failed to load settings:', error);
    });
}

function saveSettings(elements: OptionsElements): void {
  const startValue = elements.startInput.value;
  const endValue = elements.endInput.value;

  // 時間形式の簡単な検証
  if (!isValidTimeFormat(startValue) || !isValidTimeFormat(endValue)) {
    alert("有効な時間形式（HH:MM）で入力してください。");
    return;
  }

  StorageManager.setSync({
    [StorageManager.KEYS.START_TIME]: startValue,
    [StorageManager.KEYS.END_TIME]: endValue
  }).then(() => {
    alert("ブロック時間を保存しました。");
  }).catch((error: Error) => {
    console.error('Failed to save settings:', error);
    alert("保存に失敗しました。");
  });
}

function isValidTimeFormat(time: string): boolean {
  if (!time) return true; // 空値は許可
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}