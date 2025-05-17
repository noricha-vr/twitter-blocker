import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

function Options() {
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  useEffect(() => {
    chrome.storage.sync.get(["startTime", "endTime"], ({ startTime, endTime }) => {
      if (startTime !== undefined) {
        setStartTime(startTime);
      }
      if (endTime !== undefined) {
        setEndTime(endTime);
      }
    });
  }, []);

  const save = () => {
    chrome.storage.sync.set(
      {
        startTime,
        endTime,
      },
      () => {
        alert("ブロック時間を保存しました。");
      }
    );
  };

  return (
    <div>
      <h1>Twitter ブロック時間設定</h1>
      <p>
        開始時刻 (0～23):
        <input
          type="number"
          min="0"
          max="23"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
        />
      </p>
      <p>
        終了時刻 (0～23):
        <input
          type="number"
          min="0"
          max="23"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
        />
      </p>
      <button id="saveBtn" onClick={save}>保存</button>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Options />);
