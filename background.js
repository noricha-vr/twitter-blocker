// Background Service Worker for Twitter Blocker

// Simple debug logging utilities
const LOG_KEY = 'debugLogs';
const MAX_LOGS = 2000;

function addLog(event, details = {}) {
  try {
    const entry = {
      time: new Date().toISOString(),
      event,
      details,
    };
    chrome.storage.local.get([LOG_KEY], (res) => {
      const logs = Array.isArray(res[LOG_KEY]) ? res[LOG_KEY] : [];
      logs.push(entry);
      const trimmed = logs.length > MAX_LOGS ? logs.slice(logs.length - MAX_LOGS) : logs;
      chrome.storage.local.set({ [LOG_KEY]: trimmed });
    });
  } catch (e) {
    // Best-effort; avoid throwing inside service worker
    console.warn('Logging failed:', e);
  }
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openRedirectURL') {
    const senderTab = sender.tab;

    addLog('openRedirectURL:received', {
      senderTabId: senderTab && senderTab.id,
      senderActive: senderTab && senderTab.active,
    });

    // If we cannot determine the sender tab, skip opening
    if (!senderTab) {
      addLog('openRedirectURL:noSenderTab');
      sendResponse({ success: true, message: 'No sender tab; skipping redirect' });
      return; // synchronous response
    }

    // Only proceed if the sender tab is the active tab in its window
    if (!senderTab.active) {
      addLog('openRedirectURL:senderNotActive', { senderTabId: senderTab.id });
      sendResponse({ success: true, message: 'Sender tab not active; skipping redirect' });
      return; // synchronous response
    }

    // Ensure the sender tab is also the active tab of the last-focused window
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
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
      chrome.storage.sync.get(['redirectURL'], (result) => {
        const redirectURL = result.redirectURL;

        if (redirectURL && redirectURL.trim() !== '') {
          // Validate URL
          try {
            // Throws if invalid
            new URL(redirectURL);

            addLog('openRedirectURL:validated', { redirectURL });

            // Try to reuse an existing tab for this URL to avoid tab clutter
            chrome.storage.local.get(['redirectTabMap'], (mapResult) => {
              const redirectTabMap = mapResult.redirectTabMap || {};
              const existingTabId = redirectTabMap[redirectURL];

              if (existingTabId !== undefined) {
                chrome.tabs.get(existingTabId, (existingTab) => {
                  if (chrome.runtime.lastError || !existingTab) {
                    addLog('openRedirectURL:storedTabMissing', {
                      existingTabId,
                      error: chrome.runtime.lastError && chrome.runtime.lastError.message,
                    });
                    // Before creating a new one, double-check if any tab already has the same URL (normalized)
                    findTabByUrlLoose(redirectURL, (foundTab) => {
                      if (foundTab) {
                        addLog('openRedirectURL:foundBySearch', { tabId: foundTab.id });
                        chrome.windows.update(foundTab.windowId, { focused: true }, () => {
                          chrome.tabs.update(foundTab.id, { active: true }, () => {
                            redirectTabMap[redirectURL] = foundTab.id;
                            chrome.storage.local.set({ redirectTabMap }, () => {
                              sendResponse({ success: true, reused: true, tabId: foundTab.id });
                            });
                          });
                        });
                      } else {
                        // Mark creating to prevent racing creators
                        redirectTabMap[redirectURL] = -1;
                        chrome.storage.local.set({ redirectTabMap }, () => {
                          addLog('openRedirectURL:creatingSentinelSet', {});
                          chrome.tabs.create({ url: redirectURL }, (tab) => {
                            if (chrome.runtime.lastError) {
                              addLog('openRedirectURL:createError', { error: chrome.runtime.lastError.message });
                              console.error('Error creating tab:', chrome.runtime.lastError);
                              sendResponse({ success: false, error: chrome.runtime.lastError.message });
                            } else {
                              addLog('openRedirectURL:createdNewTab', { newTabId: tab.id, redirectURL });
                              redirectTabMap[redirectURL] = tab.id;
                              chrome.storage.local.set({ redirectTabMap }, () => {
                                console.log('Redirect tab created:', tab.id);
                                sendResponse({ success: true, reused: false, tabId: tab.id });
                              });
                            }
                          });
                        });
                      }
                    });
                  } else {
                    // Reuse existing tab: activate and focus its window
                    chrome.windows.update(existingTab.windowId, { focused: true }, () => {
                      chrome.tabs.update(existingTab.id, { active: true }, () => {
                        if (chrome.runtime.lastError) {
                          addLog('openRedirectURL:focusExistingError', { error: chrome.runtime.lastError.message });
                          console.error('Error focusing existing tab:', chrome.runtime.lastError);
                          sendResponse({ success: false, error: chrome.runtime.lastError.message });
                        } else {
                          addLog('openRedirectURL:reusedExistingTab', { reusedTabId: existingTab.id, redirectURL });
                          sendResponse({ success: true, reused: true, tabId: existingTab.id });
                        }
                      });
                    });
                  }
                });
              } else {
                // Either there is no mapping or a previous creator wrote a sentinel (-1)
                if (redirectTabMap[redirectURL] === -1) {
                  // Wait briefly, then try to reuse whatever was created
                  addLog('openRedirectURL:waitingForCreator', {});
                  setTimeout(() => {
                    chrome.storage.local.get(['redirectTabMap'], (reget) => {
                      const map2 = reget.redirectTabMap || {};
                      const tabId2 = map2[redirectURL];
                      if (tabId2 && tabId2 !== -1) {
                        chrome.tabs.get(tabId2, (t2) => {
                          if (chrome.runtime.lastError || !t2) {
                            // Fallback to search
                            findTabByUrlLoose(redirectURL, (found) => {
                              if (found) {
                                chrome.windows.update(found.windowId, { focused: true }, () => {
                                  chrome.tabs.update(found.id, { active: true }, () => {
                                    map2[redirectURL] = found.id;
                                    chrome.storage.local.set({ redirectTabMap: map2 }, () => {
                                      sendResponse({ success: true, reused: true, tabId: found.id });
                                    });
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
                            chrome.windows.update(t2.windowId, { focused: true }, () => {
                              chrome.tabs.update(t2.id, { active: true }, () => {
                                sendResponse({ success: true, reused: true, tabId: t2.id });
                              });
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
                  redirectTabMap[redirectURL] = -1;
                  chrome.storage.local.set({ redirectTabMap }, () => {
                    addLog('openRedirectURL:creatingSentinelSet', {});
                    createAndStoreRedirectTab(redirectURL, sendResponse);
                  });
                }
              }
            });
          } catch (error) {
            addLog('openRedirectURL:invalidURL', { redirectURL, error: String(error && error.message) });
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

    // Return true to indicate that we will send a response asynchronously
    return true;
  }

  if (request.action === 'downloadLogs') {
    chrome.storage.local.get([LOG_KEY], (res) => {
      const logs = Array.isArray(res[LOG_KEY]) ? res[LOG_KEY] : [];
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

      chrome.downloads.download({ url: dataUrl, filename, saveAs: true }, (downloadId) => {
        if (chrome.runtime.lastError) {
          addLog('downloadLogs:error', { error: chrome.runtime.lastError.message });
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          addLog('downloadLogs:started', { downloadId, filename });
          sendResponse({ success: true, downloadId, filename });
        }
      });
    });
    return true;
  }

  if (request.action === 'clearLogs') {
    chrome.storage.local.set({ [LOG_KEY]: [] }, () => {
      addLog('clearLogs');
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'getLogs') {
    chrome.storage.local.get([LOG_KEY], (res) => {
      sendResponse({ success: true, logs: Array.isArray(res[LOG_KEY]) ? res[LOG_KEY] : [] });
    });
    return true;
  }
});

// Log when the service worker is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('Twitter Blocker service worker installed');
  addLog('serviceWorker:installed');
});

// Cleanup mapping when a stored redirect tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  addLog('tabRemoved', { tabId });
  chrome.storage.local.get(['redirectTabMap'], (mapResult) => {
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
function normalizeUrlForMatch(urlString) {
  try {
    const u = new URL(urlString);
    // Ignore query and hash, ignore trailing slash differences
    const pathname = u.pathname.replace(/\/$/, '');
    return `${u.origin}${pathname}`;
  } catch (_) {
    return urlString;
  }
}

function findTabByUrlLoose(urlString, cb) {
  const target = normalizeUrlForMatch(urlString);
  chrome.tabs.query({}, (tabs) => {
    const found = tabs.find((t) => {
      if (!t.url) return false;
      const cand = normalizeUrlForMatch(t.url);
      return cand === target;
    });
    cb(found);
  });
}

function createAndStoreRedirectTab(redirectURL, sendResponse) {
  chrome.tabs.create({ url: redirectURL }, (tab) => {
    if (chrome.runtime.lastError) {
      addLog('openRedirectURL:createError', { error: chrome.runtime.lastError.message });
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
    } else {
      chrome.storage.local.get(['redirectTabMap'], (res) => {
        const map = res.redirectTabMap || {};
        map[redirectURL] = tab.id;
        chrome.storage.local.set({ redirectTabMap: map }, () => {
          addLog('openRedirectURL:createdNewTab', { newTabId: tab.id, redirectURL });
          sendResponse({ success: true, reused: false, tabId: tab.id });
        });
      });
    }
  });
}