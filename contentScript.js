let overlay;
let lastBlockState = undefined;  // 前回のブロック状態（undefined: 初回, true: ブロック中, false: 解除中）
let lastUnblockUntil = 0;       // 前回チェック時のunblockUntil値

function createOverlay() {
  if (overlay) return;

  overlay = document.createElement('div');
  overlay.id = 'block-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    z-index: 999999;
    display: flex;
    justify-content: center;
    align-items: center;
    opacity: 0;
    animation: fadeIn 0.3s ease forwards;
  `;

  // CSSアニメーションを追加
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from { 
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
  `;
  document.head.appendChild(style);

  const container = document.createElement('div');
  container.style.cssText = `
    max-width: 600px;
    width: 90%;
    animation: slideUp 0.5s ease forwards;
  `;

  // メインカード
  const card = document.createElement('div');
  card.style.cssText = `
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 24px;
    padding: 48px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    text-align: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  // アイコン
  const icon = document.createElement('div');
  icon.style.cssText = `
    width: 80px;
    height: 80px;
    margin: 0 auto 24px;
    background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40px;
    color: white;
    animation: pulse 2s ease-in-out infinite;
  `;
  icon.innerHTML = '🚫';

  // 主要メッセージ（認知的に最も重要）
  const mainMessage = document.createElement('h1');
  mainMessage.style.cssText = `
    margin: 0 0 16px;
    font-size: 32px;
    font-weight: 700;
    color: #2c3e50;
    line-height: 1.2;
  `;
  mainMessage.textContent = 'Twitter はブロック中です';

  // 副次メッセージ
  const subMessage = document.createElement('p');
  subMessage.style.cssText = `
    margin: 0 0 32px;
    font-size: 18px;
    color: #7f8c8d;
    line-height: 1.5;
  `;
  subMessage.innerHTML = '集中力を保つため、現在アクセスが制限されています';

  // アクションセクション
  const actionSection = document.createElement('div');
  actionSection.style.cssText = `
    background: #f8f9fa;
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 32px;
  `;

  const actionTitle = document.createElement('h3');
  actionTitle.style.cssText = `
    margin: 0 0 12px;
    font-size: 16px;
    font-weight: 600;
    color: #34495e;
  `;
  actionTitle.textContent = '一時的に解除するには';

  const actionSteps = document.createElement('div');
  actionSteps.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-top: 16px;
  `;

  // ステップインジケーター
  const steps = [
    { icon: '🧩', text: '拡張機能アイコン' },
    { icon: '➡️', text: '' },
    { icon: '⏱️', text: '時間を設定' },
    { icon: '➡️', text: '' },
    { icon: '✅', text: '解除' }
  ];

  steps.forEach((step, index) => {
    const stepDiv = document.createElement('div');
    if (step.text) {
      stepDiv.style.cssText = `
        text-align: center;
        ${index === 0 || index === 2 || index === 4 ? `
          background: white;
          padding: 12px 16px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        ` : ''}
      `;
      const stepIcon = document.createElement('div');
      stepIcon.style.cssText = 'font-size: 24px; margin-bottom: 4px;';
      stepIcon.textContent = step.icon;
      
      if (step.text !== '') {
        const stepText = document.createElement('div');
        stepText.style.cssText = 'font-size: 12px; color: #7f8c8d;';
        stepText.textContent = step.text;
        stepDiv.appendChild(stepIcon);
        stepDiv.appendChild(stepText);
      } else {
        stepDiv.appendChild(stepIcon);
      }
    } else {
      stepDiv.style.cssText = 'font-size: 20px; color: #bdc3c7;';
      stepDiv.textContent = step.icon;
    }
    actionSteps.appendChild(stepDiv);
  });

  actionSection.appendChild(actionTitle);
  actionSection.appendChild(actionSteps);

  // 使用履歴セクション
  const usageSection = document.createElement('div');
  usageSection.style.cssText = `
    margin-top: 32px;
  `;

  const usageTitle = document.createElement('h3');
  usageTitle.style.cssText = `
    margin: 0 0 16px;
    font-size: 14px;
    font-weight: 600;
    color: #7f8c8d;
    text-transform: uppercase;
    letter-spacing: 1px;
  `;
  usageTitle.textContent = '直近30日間の使用時間';

  const chartContainer = document.createElement('div');
  chartContainer.id = 'usage-chart';
  chartContainer.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  `;

  usageSection.appendChild(usageTitle);
  usageSection.appendChild(chartContainer);

  // 要素を組み立て
  card.appendChild(icon);
  card.appendChild(mainMessage);
  card.appendChild(subMessage);
  card.appendChild(actionSection);
  card.appendChild(usageSection);
  container.appendChild(card);
  overlay.appendChild(container);
  
  document.documentElement.appendChild(overlay);
}

function updateUsageChart() {
  if (!overlay) return;
  const container = overlay.querySelector('#usage-chart');
  if (!container) return;
  chrome.storage.sync.get(['usageHistory'], ({ usageHistory }) => {
    const history = usageHistory || {};
    const today = new Date();
    const days = [];
    let totalMinutes = 0;
    
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const key = d.toLocaleDateString('sv-SE');
      const minutes = history[key] || 0;
      days.push({ date: key, minutes, dayOfWeek: d.getDay() });
      totalMinutes += minutes;
    }

    const max = Math.max(...days.map((d) => d.minutes), 30); // 最小値を30分に設定
    container.innerHTML = '';

    // 統計情報
    const stats = document.createElement('div');
    stats.style.cssText = `
      display: flex;
      justify-content: space-around;
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid #ecf0f1;
    `;

    const avgMinutes = Math.round(totalMinutes / 30);
    const statsData = [
      { label: '合計', value: `${totalMinutes}分`, color: '#3498db' },
      { label: '1日平均', value: `${avgMinutes}分`, color: '#2ecc71' },
      { label: '今日', value: `${history[today.toLocaleDateString('sv-SE')] || 0}分`, color: '#e74c3c' }
    ];

    statsData.forEach(stat => {
      const statDiv = document.createElement('div');
      statDiv.style.cssText = 'text-align: center;';
      statDiv.innerHTML = `
        <div style="font-size: 24px; font-weight: 700; color: ${stat.color};">${stat.value}</div>
        <div style="font-size: 12px; color: #95a5a6; margin-top: 4px;">${stat.label}</div>
      `;
      stats.appendChild(statDiv);
    });

    container.appendChild(stats);

    // グラフコンテナ
    const chartWrapper = document.createElement('div');
    chartWrapper.style.cssText = 'position: relative;';

    // Y軸ラベル
    const yAxisContainer = document.createElement('div');
    yAxisContainer.style.cssText = `
      position: absolute;
      left: -40px;
      top: 0;
      height: 120px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-size: 11px;
      color: #95a5a6;
    `;

    for (let i = 3; i >= 0; i--) {
      const tick = document.createElement('div');
      tick.style.cssText = 'text-align: right;';
      tick.textContent = `${Math.round((max / 3) * i)}`;
      yAxisContainer.appendChild(tick);
    }

    // グラフ本体
    const chart = document.createElement('div');
    chart.style.cssText = `
      display: flex;
      align-items: flex-end;
      height: 120px;
      gap: 3px;
      padding: 0 5px;
      background: linear-gradient(to bottom, 
        rgba(52, 152, 219, 0.05) 0%, 
        rgba(52, 152, 219, 0) 100%);
      border-radius: 8px;
    `;

    days.forEach((d, index) => {
      const barContainer = document.createElement('div');
      barContainer.style.cssText = `
        flex: 1;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        position: relative;
        cursor: pointer;
      `;

      const bar = document.createElement('div');
      const height = d.minutes > 0 ? Math.max((d.minutes / max) * 100, 3) : 0;
      const isToday = index === days.length - 1;
      const isWeekend = d.dayOfWeek === 0 || d.dayOfWeek === 6;
      
      bar.style.cssText = `
        width: 100%;
        height: ${height}%;
        background: ${isToday ? 
          'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)' : 
          isWeekend ? 
          'linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)' :
          'linear-gradient(135deg, #3498db 0%, #2980b9 100%)'
        };
        border-radius: 4px 4px 0 0;
        transition: all 0.3s ease;
        position: relative;
      `;

      // ホバー時のツールチップ
      const tooltip = document.createElement('div');
      tooltip.style.cssText = `
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(44, 62, 80, 0.95);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
        margin-bottom: 8px;
        z-index: 10;
      `;
      
      const [y, m, day] = d.date.split('-').map(Number);
      const dateObj = new Date(y, m - 1, day);
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      tooltip.innerHTML = `
        <div style="font-weight: 600;">${m}月${day}日 (${dayNames[d.dayOfWeek]})</div>
        <div style="margin-top: 4px;">${d.minutes}分</div>
      `;

      barContainer.addEventListener('mouseenter', () => {
        bar.style.transform = 'scaleY(1.05)';
        bar.style.filter = 'brightness(1.1)';
        tooltip.style.opacity = '1';
      });

      barContainer.addEventListener('mouseleave', () => {
        bar.style.transform = 'scaleY(1)';
        bar.style.filter = 'brightness(1)';
        tooltip.style.opacity = '0';
      });

      barContainer.appendChild(bar);
      barContainer.appendChild(tooltip);
      chart.appendChild(barContainer);
    });

    chartWrapper.appendChild(yAxisContainer);
    chartWrapper.appendChild(chart);
    container.appendChild(chartWrapper);

    // X軸（日付）
    const xAxis = document.createElement('div');
    xAxis.style.cssText = `
      display: flex;
      margin-top: 8px;
      padding: 0 5px;
      font-size: 10px;
      color: #95a5a6;
    `;
    
    // 週ごとに日付を表示
    days.forEach((d, index) => {
      const label = document.createElement('div');
      label.style.cssText = 'flex: 1; text-align: center;';
      
      // 週の始まり（月曜日）または最初と最後の日付を表示
      if (d.dayOfWeek === 1 || index === 0 || index === days.length - 1) {
        const [y, m, day] = d.date.split('-').map(Number);
        label.textContent = `${m}/${day}`;
      }
      
      xAxis.appendChild(label);
    });
    
    container.appendChild(xAxis);
  });
}

function updateOverlay() {
  chrome.storage.sync.get(["unblockUntil"], (result) => {
    createOverlay();
    const unblockUntil = result.unblockUntil || 0;
    const now = Date.now();
    const isBlocked = now > unblockUntil;
    
    // デバッグログ
    console.log('[Twitter Blocker Debug]', {
      now,
      unblockUntil,
      isBlocked,
      lastBlockState,
      lastUnblockUntil,
      timeDiff: unblockUntil - now
    });
    
    // 時間切れ検出：解除状態→ブロック状態への遷移を検出
    const isTimeExpired = 
      lastBlockState === false &&      // 前回は解除されていた
      isBlocked &&                     // 今回はブロックされている
      lastUnblockUntil === unblockUntil;  // 同じ解除セッション内での時間切れ

    if (isBlocked) {
      overlay.style.display = 'flex';
      
      // 時間切れの場合のみリダイレクト（初回ロード時は除外）
      if (isTimeExpired && lastBlockState !== undefined) {
        // Background service worker にリダイレクトリクエストを送信
        chrome.runtime.sendMessage({ action: 'openRedirectURL' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error sending message:', chrome.runtime.lastError);
          } else if (response) {
            console.log('Redirect response:', response);
          }
        });
      }
    } else {
      overlay.style.display = 'none';
    }
    
    // 状態を更新
    lastBlockState = isBlocked;
    lastUnblockUntil = unblockUntil;
    
    updateUsageChart();
  });
}

updateOverlay();
setInterval(updateOverlay, 10 * 1000);

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'updateOverlay') {
    updateOverlay();
  }
});
