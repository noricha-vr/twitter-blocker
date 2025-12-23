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

// Simple debug logging utilities
const LOG_KEY = StorageManager.KEYS.DEBUG_LOGS;
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
    handleOpenRedirectURL(request, sender, sendResponse);
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

function handleOpenRedirectURL(
  request: MessageRequest,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void
): void {
  const senderTab = sender.tab;

  addLog('openRedirectURL:received', {
    senderTabId: senderTab && senderTab.id,
    senderActive: senderTab && senderTab.active,
  });

  // If we cannot determine the sender tab, skip opening
  if (!senderTab) {
    addLog('openRedirectURL:noSenderTab');
    sendResponse({ success: true, message: 'No sender tab; skipping redirect' });
    return;
  }

  // Only proceed if the sender tab is the active tab in its window
  if (!senderTab.active) {
    addLog('openRedirectURL:senderNotActive', { senderTabId: senderTab.id });
    sendResponse({ success: true, message: 'Sender tab not active; skipping redirect' });
    return;
  }

  // Ensure the sender tab is also the active tab of the last-focused window
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs: chrome.tabs.Tab[]) => {
    if (chrome.runtime.lastError) {
      addLog('openRedirectURL:queryError', { error: chrome.runtime.lastError.message });
      console.error('Error querying tabs:', chrome.runtime.lastError);
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
      return;
    }

    const activeTabInFocusedWindow = tabs && tabs[0];
    if (!activeTabInFocusedWindow || activeTabInFocusedWindow.id !== senderTab.id) {
      addLog('openRedirectURL:senderNotInFocusedWindow', {
        senderTabId: senderTab.id,
        activeFocusedTabId: activeTabInFocusedWindow && activeTabInFocusedWindow.id,
      });
      sendResponse({ success: true, message: 'Sender tab not in focused window; skipping redirect' });
      return;
    }

    // Get the redirect URL from storage
    StorageManager.getRedirectURL().then((redirectURL: string | null) => {
      if (redirectURL && redirectURL.trim() !== '') {
        // Validate URL
        try {
          new URL(redirectURL); // Throws if invalid

          addLog('openRedirectURL:validated', { redirectURL });

          // Try to reuse an existing tab for this URL to avoid tab clutter
          StorageManager.getRedirectTabMap().then((redirectTabMap: RedirectTabMap) => {
            const existingTabId = redirectTabMap[redirectURL];

            if (existingTabId !== undefined) {
              handleExistingTab(redirectURL, existingTabId, redirectTabMap, sendResponse);
            } else {
              handleNewTab(redirectURL, redirectTabMap, sendResponse);
            }
          });
        } catch (error) {
          addLog('openRedirectURL:invalidURL', { 
            redirectURL, 
            error: error instanceof Error ? error.message : String(error)
          });
          console.error('Invalid URL:', redirectURL);
          sendResponse({ success: false, error: 'Invalid URL format' });
        }
      } else {
        // No redirect URL set, just respond
        addLog('openRedirectURL:noURLConfigured');
        sendResponse({ success: true, message: 'No redirect URL configured' });
      }
    });
  });
}

function handleExistingTab(
  redirectURL: string,
  existingTabId: number,
  redirectTabMap: RedirectTabMap,
  sendResponse: (response: MessageResponse) => void
): void {
  chrome.tabs.get(existingTabId, (existingTab: chrome.tabs.Tab) => {
    if (chrome.runtime.lastError || !existingTab) {
      addLog('openRedirectURL:storedTabMissing', {
        existingTabId,
        error: chrome.runtime.lastError && chrome.runtime.lastError.message,
      });
      
      // Before creating a new one, double-check if any tab already has the same URL (normalized)
      findTabByUrlLoose(redirectURL, (foundTab: chrome.tabs.Tab | undefined) => {
        if (foundTab && foundTab.id) {
          focusTab(foundTab, () => {
            addLog('openRedirectURL:foundBySearch', { tabId: foundTab.id });
            redirectTabMap[redirectURL] = foundTab.id!;
            chrome.storage.local.set({ redirectTabMap }, () => {
              sendResponse({ success: true, reused: true, tabId: foundTab.id });
            });
          });
        } else {
          createNewTabWithSentinel(redirectURL, redirectTabMap, sendResponse);
        }
      });
    } else {
      // Reuse existing tab: activate and focus its window
      focusTab(existingTab, () => {
        addLog('openRedirectURL:reusedExistingTab', { reusedTabId: existingTab.id, redirectURL });
        sendResponse({ success: true, reused: true, tabId: existingTab.id });
      }, sendResponse);
    }
  });
}

function handleNewTab(
  redirectURL: string,
  redirectTabMap: RedirectTabMap,
  sendResponse: (response: MessageResponse) => void
): void {
  // Either there is no mapping or a previous creator wrote a sentinel (-1)
  if (redirectTabMap[redirectURL] === -1) {
    // Wait briefly, then try to reuse whatever was created
    addLog('openRedirectURL:waitingForCreator', {});
    setTimeout(() => {
      chrome.storage.local.get(['redirectTabMap'], (reget: { redirectTabMap?: RedirectTabMap }) => {
        const map2 = reget.redirectTabMap || {};
        const tabId2 = map2[redirectURL];
        
        if (tabId2 && tabId2 !== -1) {
          chrome.tabs.get(tabId2, (t2: chrome.tabs.Tab) => {
            if (chrome.runtime.lastError || !t2) {
              // Fallback to search
              findTabByUrlLoose(redirectURL, (found: chrome.tabs.Tab | undefined) => {
                if (found && found.id) {
                  focusTab(found, () => {
                    map2[redirectURL] = found.id!;
                    chrome.storage.local.set({ redirectTabMap: map2 }, () => {
                      sendResponse({ success: true, reused: true, tabId: found.id });
                    });
                  });
                } else {
                  // Creator failed; clear sentinel and create ourselves
                  delete map2[redirectURL];
                  chrome.storage.local.set({ redirectTabMap: map2 }, () => {
                    createAndStoreRedirectTab(redirectURL, sendResponse);
                  });
                }
              });
            } else {
              focusTab(t2, () => {
                sendResponse({ success: true, reused: true, tabId: t2.id });
              });
            }
          });
        } else {
          // No tab yet, create now
          createAndStoreRedirectTab(redirectURL, sendResponse);
        }
      });
    }, 300);
  } else {
    // No stored tab; create a new one and remember it, with sentinel to avoid races
    createNewTabWithSentinel(redirectURL, redirectTabMap, sendResponse);
  }
}

function createNewTabWithSentinel(
  redirectURL: string,
  redirectTabMap: RedirectTabMap,
  sendResponse: (response: MessageResponse) => void
): void {
  redirectTabMap[redirectURL] = -1; // Sentinel value
  chrome.storage.local.set({ redirectTabMap }, () => {
    addLog('openRedirectURL:creatingSentinelSet', {});
    createAndStoreRedirectTab(redirectURL, sendResponse);
  });
}

function focusTab(
  tab: chrome.tabs.Tab,
  onSuccess: () => void,
  onError?: (response: MessageResponse) => void
): void {
  if (!tab.windowId || tab.id === undefined) {
    if (onError) {
      onError({ success: false, error: 'Invalid tab data' });
    }
    return;
  }

  chrome.windows.update(tab.windowId, { focused: true }, () => {
    if (chrome.runtime.lastError) {
      addLog('openRedirectURL:focusExistingError', { error: chrome.runtime.lastError.message });
      console.error('Error focusing existing tab:', chrome.runtime.lastError);
      if (onError) {
        onError({ success: false, error: chrome.runtime.lastError.message });
      }
      return;
    }

    chrome.tabs.update(tab.id!, { active: true }, () => {
      if (chrome.runtime.lastError) {
        addLog('openRedirectURL:focusExistingError', { error: chrome.runtime.lastError.message });
        console.error('Error focusing existing tab:', chrome.runtime.lastError);
        if (onError) {
          onError({ success: false, error: chrome.runtime.lastError.message });
        }
      } else {
        onSuccess();
      }
    });
  });
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

function findTabByUrlLoose(
  urlString: string, 
  cb: (found?: chrome.tabs.Tab) => void
): void {
  const target = normalizeUrlForMatch(urlString);
  chrome.tabs.query({}, (tabs: chrome.tabs.Tab[]) => {
    const found = tabs.find((t) => {
      if (!t.url) return false;
      const cand = normalizeUrlForMatch(t.url);
      return cand === target;
    });
    cb(found);
  });
}

function createAndStoreRedirectTab(
  redirectURL: string, 
  sendResponse: (response: MessageResponse) => void
): void {
  chrome.tabs.create({ url: redirectURL }, (tab: chrome.tabs.Tab) => {
    if (chrome.runtime.lastError || !tab.id) {
      addLog('openRedirectURL:createError', { error: chrome.runtime.lastError?.message });
      sendResponse({ success: false, error: chrome.runtime.lastError?.message });
    } else {
      chrome.storage.local.get(['redirectTabMap'], (res: { redirectTabMap?: RedirectTabMap }) => {
        const map = res.redirectTabMap || {};
        map[redirectURL] = tab.id!;
        chrome.storage.local.set({ redirectTabMap: map }, () => {
          addLog('openRedirectURL:createdNewTab', { newTabId: tab.id, redirectURL });
          sendResponse({ success: true, reused: false, tabId: tab.id });
        });
      });
    }
  });
}