// Background Service Worker for Twitter Blocker

import { StorageManager, DebugLog, RedirectTabMap } from './storageManager';

interface MessageRequest {
  action: string;
  [key: string]: unknown;
}

interface MessageResponse {
  success: boolean;
  message?: string;
  error?: string;
  reused?: boolean;
  tabId?: number;
  downloadId?: number;
  filename?: string;
  logs?: DebugLog[];
}

// ===== Chrome API Promise Wrappers =====

function queryTabs(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
  return new Promise((resolve) => {
    chrome.tabs.query(queryInfo, (tabs) => resolve(tabs ?? []));
  });
}

function getTab(tabId: number): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        resolve(null);
      } else {
        resolve(tab);
      }
    });
  });
}

function createTab(url: string): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve) => {
    chrome.tabs.create({ url }, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        resolve(null);
      } else {
        resolve(tab);
      }
    });
  });
}

function updateTab(tabId: number, props: chrome.tabs.UpdateProperties): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.tabs.update(tabId, props, () => {
      resolve(!chrome.runtime.lastError);
    });
  });
}

function focusWindow(windowId: number): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.windows.update(windowId, { focused: true }, () => {
      resolve(!chrome.runtime.lastError);
    });
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ===== Constants =====
const MAX_LOGS = 2000;

function addLog(event: string, details: Record<string, any> = {}): void {
  try {
    const entry: DebugLog = {
      time: new Date().toISOString(),
      event,
      details,
    };
    StorageManager.getDebugLogs().then((logs: DebugLog[]) => {
      logs.push(entry);
      const trimmed = logs.length > MAX_LOGS ? logs.slice(logs.length - MAX_LOGS) : logs;
      return StorageManager.setDebugLogs(trimmed);
    }).catch((error: Error) => {
      console.warn('Logging failed:', error);
    });
  } catch (e) {
    // Best-effort; avoid throwing inside service worker
    console.warn('Logging failed:', e);
  }
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((
  request: MessageRequest,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void
): boolean | void => {
  if (request.action === 'openRedirectURL') {
    handleOpenRedirectURL(sender)
      .then(sendResponse)
      .catch((error: Error) => {
        addLog('openRedirectURL:unhandledError', { error: error.message });
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicates async response
  }

  if (request.action === 'downloadLogs') {
    handleDownloadLogs(sendResponse);
    return true;
  }

  if (request.action === 'clearLogs') {
    handleClearLogs(sendResponse);
    return true;
  }

  if (request.action === 'getLogs') {
    handleGetLogs(sendResponse);
    return true;
  }
});

async function handleOpenRedirectURL(
  sender: chrome.runtime.MessageSender
): Promise<MessageResponse> {
  const senderTab = sender.tab;

  addLog('openRedirectURL:received', {
    senderTabId: senderTab?.id,
    senderActive: senderTab?.active,
  });

  // If we cannot determine the sender tab, skip opening
  if (!senderTab) {
    addLog('openRedirectURL:noSenderTab');
    return { success: true, message: 'No sender tab; skipping redirect' };
  }

  // Only proceed if the sender tab is the active tab in its window
  if (!senderTab.active) {
    addLog('openRedirectURL:senderNotActive', { senderTabId: senderTab.id });
    return { success: true, message: 'Sender tab not active; skipping redirect' };
  }

  // Ensure the sender tab is also the active tab of the last-focused window
  const tabs = await queryTabs({ active: true, lastFocusedWindow: true });
  const activeTabInFocusedWindow = tabs[0];

  if (!activeTabInFocusedWindow || activeTabInFocusedWindow.id !== senderTab.id) {
    addLog('openRedirectURL:senderNotInFocusedWindow', {
      senderTabId: senderTab.id,
      activeFocusedTabId: activeTabInFocusedWindow?.id,
    });
    return { success: true, message: 'Sender tab not in focused window; skipping redirect' };
  }

  // Get the redirect URL from storage
  const redirectURL = await StorageManager.getRedirectURL();

  if (!redirectURL || redirectURL.trim() === '') {
    addLog('openRedirectURL:noURLConfigured');
    return { success: true, message: 'No redirect URL configured' };
  }

  // Validate URL
  try {
    new URL(redirectURL);
  } catch (error) {
    addLog('openRedirectURL:invalidURL', {
      redirectURL,
      error: error instanceof Error ? error.message : String(error)
    });
    console.error('Invalid URL:', redirectURL);
    return { success: false, error: 'Invalid URL format' };
  }

  addLog('openRedirectURL:validated', { redirectURL });

  // Try to reuse an existing tab for this URL to avoid tab clutter
  const redirectTabMap = await StorageManager.getRedirectTabMap();
  const existingTabId = redirectTabMap[redirectURL];

  if (existingTabId !== undefined) {
    return handleExistingTab(redirectURL, existingTabId, redirectTabMap);
  }
  return handleNewTab(redirectURL, redirectTabMap);
}

async function handleExistingTab(
  redirectURL: string,
  existingTabId: number,
  redirectTabMap: RedirectTabMap
): Promise<MessageResponse> {
  const existingTab = await getTab(existingTabId);

  if (!existingTab) {
    addLog('openRedirectURL:storedTabMissing', { existingTabId });

    // Before creating a new one, double-check if any tab already has the same URL (normalized)
    const foundTab = await findTabByUrlLoose(redirectURL);

    if (foundTab?.id) {
      const focused = await focusTabAsync(foundTab);
      if (focused) {
        addLog('openRedirectURL:foundBySearch', { tabId: foundTab.id });
        redirectTabMap[redirectURL] = foundTab.id;
        await StorageManager.setRedirectTabMap(redirectTabMap);
        return { success: true, reused: true, tabId: foundTab.id };
      }
    }

    return createNewTabWithSentinel(redirectURL, redirectTabMap);
  }

  // Reuse existing tab: activate and focus its window
  const focused = await focusTabAsync(existingTab);
  if (focused) {
    addLog('openRedirectURL:reusedExistingTab', { reusedTabId: existingTab.id, redirectURL });
    return { success: true, reused: true, tabId: existingTab.id };
  }

  return { success: false, error: 'Failed to focus existing tab' };
}

async function handleNewTab(
  redirectURL: string,
  redirectTabMap: RedirectTabMap
): Promise<MessageResponse> {
  // Either there is no mapping or a previous creator wrote a sentinel (-1)
  if (redirectTabMap[redirectURL] === -1) {
    // Wait briefly, then try to reuse whatever was created
    addLog('openRedirectURL:waitingForCreator', {});
    await delay(300);

    const map2 = await StorageManager.getRedirectTabMap();
    const tabId2 = map2[redirectURL];

    if (tabId2 && tabId2 !== -1) {
      const t2 = await getTab(tabId2);

      if (t2) {
        const focused = await focusTabAsync(t2);
        if (focused) {
          return { success: true, reused: true, tabId: t2.id };
        }
      }

      // Fallback to search
      const found = await findTabByUrlLoose(redirectURL);
      if (found?.id) {
        const focused = await focusTabAsync(found);
        if (focused) {
          map2[redirectURL] = found.id;
          await StorageManager.setRedirectTabMap(map2);
          return { success: true, reused: true, tabId: found.id };
        }
      }

      // Creator failed; clear sentinel and create ourselves
      delete map2[redirectURL];
      await StorageManager.setRedirectTabMap(map2);
      return createAndStoreRedirectTab(redirectURL);
    }

    // No tab yet, create now
    return createAndStoreRedirectTab(redirectURL);
  }

  // No stored tab; create a new one and remember it, with sentinel to avoid races
  return createNewTabWithSentinel(redirectURL, redirectTabMap);
}

async function createNewTabWithSentinel(
  redirectURL: string,
  redirectTabMap: RedirectTabMap
): Promise<MessageResponse> {
  redirectTabMap[redirectURL] = -1; // Sentinel value
  await StorageManager.setRedirectTabMap(redirectTabMap);
  addLog('openRedirectURL:creatingSentinelSet', {});
  return createAndStoreRedirectTab(redirectURL);
}

async function focusTabAsync(tab: chrome.tabs.Tab): Promise<boolean> {
  if (!tab.windowId || tab.id === undefined) {
    return false;
  }

  const windowFocused = await focusWindow(tab.windowId);
  if (!windowFocused) {
    addLog('openRedirectURL:focusExistingError', { error: 'Failed to focus window' });
    return false;
  }

  const tabActivated = await updateTab(tab.id, { active: true });
  if (!tabActivated) {
    addLog('openRedirectURL:focusExistingError', { error: 'Failed to activate tab' });
    return false;
  }

  return true;
}

function handleDownloadLogs(sendResponse: (response: MessageResponse) => void): void {
  StorageManager.getDebugLogs().then((logs: DebugLog[]) => {
    const content = logs.map((l) => {
      try {
        return `${l.time}\t${l.event}\t${JSON.stringify(l.details)}`;
      } catch (_) {
        return `${l.time}\t${l.event}`;
      }
    }).join('\n');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dataUrl = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
    const filename = `twitter-blocker-logs-${timestamp}.txt`;

    chrome.downloads.download({ url: dataUrl, filename, saveAs: true }, (downloadId?: number) => {
      if (chrome.runtime.lastError) {
        addLog('downloadLogs:error', { error: chrome.runtime.lastError.message });
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        addLog('downloadLogs:started', { downloadId, filename });
        sendResponse({ success: true, downloadId, filename });
      }
    });
  }).catch((error: Error) => {
    addLog('downloadLogs:storageError', { error: error.message });
    sendResponse({ success: false, error: error.message });
  });
}

function handleClearLogs(sendResponse: (response: MessageResponse) => void): void {
  StorageManager.setDebugLogs([]).then(() => {
    addLog('clearLogs');
    sendResponse({ success: true });
  }).catch((error: Error) => {
    addLog('clearLogs:error', { error: error.message });
    sendResponse({ success: false, error: error.message });
  });
}

function handleGetLogs(sendResponse: (response: MessageResponse) => void): void {
  StorageManager.getDebugLogs().then((logs: DebugLog[]) => {
    sendResponse({ success: true, logs });
  }).catch((error: Error) => {
    addLog('getLogs:error', { error: error.message });
    sendResponse({ success: false, error: error.message, logs: [] });
  });
}

// Log when the service worker is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('Twitter Blocker service worker installed');
  addLog('serviceWorker:installed');
});

// Cleanup mapping when a stored redirect tab is closed
chrome.tabs.onRemoved.addListener((tabId: number) => {
  addLog('tabRemoved', { tabId });
  chrome.storage.local.get(['redirectTabMap'], (mapResult: { redirectTabMap?: RedirectTabMap }) => {
    const redirectTabMap = mapResult.redirectTabMap || {};
    let changed = false;
    
    for (const [url, storedId] of Object.entries(redirectTabMap)) {
      if (storedId === tabId) {
        delete redirectTabMap[url];
        changed = true;
      }
    }
    
    if (changed) {
      chrome.storage.local.set({ redirectTabMap });
      addLog('redirectTabMap:cleaned', { tabId });
    }
  });
});

// Helpers
function normalizeUrlForMatch(urlString: string): string {
  try {
    const u = new URL(urlString);
    // Ignore query and hash, ignore trailing slash differences
    const pathname = u.pathname.replace(/\/$/, '');
    return `${u.origin}${pathname}`;
  } catch (_) {
    return urlString;
  }
}

async function findTabByUrlLoose(urlString: string): Promise<chrome.tabs.Tab | undefined> {
  const target = normalizeUrlForMatch(urlString);
  const tabs = await queryTabs({});
  return tabs.find((t) => {
    if (!t.url) return false;
    const cand = normalizeUrlForMatch(t.url);
    return cand === target;
  });
}

async function createAndStoreRedirectTab(redirectURL: string): Promise<MessageResponse> {
  const tab = await createTab(redirectURL);

  if (!tab?.id) {
    addLog('openRedirectURL:createError', { error: 'Failed to create tab' });
    return { success: false, error: 'Failed to create tab' };
  }

  const map = await StorageManager.getRedirectTabMap();
  map[redirectURL] = tab.id;
  await StorageManager.setRedirectTabMap(map);
  addLog('openRedirectURL:createdNewTab', { newTabId: tab.id, redirectURL });
  return { success: true, reused: false, tabId: tab.id };
}