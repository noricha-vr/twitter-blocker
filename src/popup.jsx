import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

function Popup() {
  const [minutes, setMinutes] = useState(5);

  useEffect(() => {
    chrome.storage.sync.get(["defaultMinutes"], (result) => {
      if (result.defaultMinutes) {
        setMinutes(result.defaultMinutes);
      }
    });
  }, []);

  const save = () => {
    const m = parseInt(minutes, 10);
    if (isNaN(m) || m <= 0) {
      alert("1以上の数値を入力してください。");
      return;
    }
    const now = Date.now();
    const unblockUntil = now + m * 60 * 1000;

    chrome.storage.sync.get(["usageHistory"], ({ usageHistory }) => {
      const history = usageHistory || {};
      const today = new Date().toISOString().slice(0, 10);
      history[today] = (history[today] || 0) + m;

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
          defaultMinutes: m,
          unblockUntil,
        },
        () => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, { action: "updateOverlay" });
            }
          });
          alert(`${m}分後に再度ブロックが有効になります。`);
          window.close();
        }
      );
    });
  };

  return (
    <div>
      <style>{`
        body {
          font-family: sans-serif;
          margin: 16px;
          width: 300px;
          min-height: 150px;
        }
        h1 {
          font-size: 18px;
          margin: 0 0 16px 0;
        }
        p {
          font-size: 14px;
          line-height: 1.5;
          margin: 0 0 16px 0;
        }
        .input-group {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }
        #minuteInput {
          width: 60px;
          padding: 4px 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        #saveButton {
          background: #1da1f2;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
        #saveButton:hover {
          background: #1a91da;
        }
      `}</style>
      <h1>一時解除時間設定</h1>
      <p>
        ツイッターを使いたい時間（分単位）を入力してください。<br />
        この時間を過ぎると自動的にブロックされます。
      </p>
      <div className="input-group">
        <input
          type="number"
          id="minuteInput"
          min="1"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
        />
        <span>分</span>
        <button id="saveButton" onClick={save}>
          保存
        </button>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<Popup />);
