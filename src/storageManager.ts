/**
 * Twitter Blocker Chrome Extension - Storage Manager
 * 
 * Chrome Storage APIの統一されたインターフェースを提供し、
 * エラーハンドリングとデフォルト値管理を標準化します。
 */

// ===== Storage Keys Constants =====
export const STORAGE_KEYS = {
  UNBLOCK_UNTIL: 'unblockUntil',
  USAGE_HISTORY: 'usageHistory',
  DEFAULT_MINUTES: 'defaultMinutes',
  REDIRECT_URL: 'redirectURL',
  START_TIME: 'startTime',
  END_TIME: 'endTime',
  DEBUG_LOGS: 'debugLogs',
  REDIRECT_TAB_MAP: 'redirectTabMap',
} as const;

// ===== Type Definitions =====
export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

export interface UsageHistory {
  [date: string]: number; // YYYY-MM-DD -> minutes
}

export interface DebugLog {
  time: string;
  event: string;
  details: Record<string, unknown>;
}

export interface RedirectTabMap {
  [url: string]: number;
}

export interface StorageData {
  unblockUntil: number;
  usageHistory: UsageHistory;
  defaultMinutes: number | null;
  redirectURL: string;
  startTime: string;
  endTime: string;
  debugLogs: DebugLog[];
  redirectTabMap: RedirectTabMap;
}

// ===== Default Values =====
const DEFAULT_VALUES: StorageData = {
  unblockUntil: 0,
  usageHistory: {},
  defaultMinutes: null,
  redirectURL: '',
  startTime: '',
  endTime: '',
  debugLogs: [],
  redirectTabMap: {},
};

// ===== Utility Types =====
export type StorageCallback<T = any> = (result: T) => void;

export interface StorageOptions {
  useDefaults?: boolean;
  callback?: StorageCallback;
}

// ===== Storage Area Type =====
type StorageArea = 'sync' | 'local';

/**
 * Chrome Storage API統合マネージャークラス
 *
 * 機能:
 * - sync/localストレージの統一インターフェース
 * - エラーハンドリングの標準化
 * - デフォルト値の自動設定
 * - Promise/callbackの両方に対応
 * - TypeScriptによる型安全性
 */
export class StorageManager {
  /**
   * Storage keys constants
   */
  static readonly KEYS = STORAGE_KEYS;

  /**
   * Default values for all storage keys
   */
  static readonly DEFAULTS = DEFAULT_VALUES;

  // ===== Private Helper Methods =====

  /**
   * ストレージエリアを取得
   */
  private static getStorageArea(area: StorageArea): chrome.storage.StorageArea {
    return area === 'sync' ? chrome.storage.sync : chrome.storage.local;
  }

  /**
   * 共通のget処理
   */
  private static async _get<K extends keyof StorageData>(
    area: StorageArea,
    keys: K | K[],
    options: StorageOptions = {}
  ): Promise<Pick<StorageData, K>> {
    const { useDefaults = true, callback } = options;
    const storage = this.getStorageArea(area);

    try {
      const result = await new Promise<{ [key: string]: unknown }>((resolve, reject) => {
        storage.get(keys, (data) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(data);
          }
        });
      });

      if (useDefaults) {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        keysArray.forEach((key) => {
          if (result[key] === undefined && DEFAULT_VALUES[key as keyof StorageData] !== undefined) {
            result[key] = DEFAULT_VALUES[key as keyof StorageData];
          }
        });
      }

      const typedResult = result as Pick<StorageData, K>;
      if (callback) callback(typedResult);
      return typedResult;
    } catch (error) {
      console.error(`StorageManager._get(${area}) error:`, error);
      const emptyResult = {} as Pick<StorageData, K>;
      if (callback) callback(emptyResult);
      throw error;
    }
  }

  /**
   * 共通のset処理
   */
  private static async _set<K extends keyof StorageData>(
    area: StorageArea,
    data: Pick<StorageData, K>,
    callback?: StorageCallback<void>
  ): Promise<void> {
    const storage = this.getStorageArea(area);

    try {
      await new Promise<void>((resolve, reject) => {
        storage.set(data, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });

      if (callback) callback();
    } catch (error) {
      console.error(`StorageManager._set(${area}) error:`, error);
      if (callback) callback();
      throw error;
    }
  }

  /**
   * 共通のremove処理
   */
  private static async _remove(
    area: StorageArea,
    keys: keyof StorageData | (keyof StorageData)[],
    callback?: StorageCallback<void>
  ): Promise<void> {
    const storage = this.getStorageArea(area);

    try {
      await new Promise<void>((resolve, reject) => {
        storage.remove(keys, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });

      if (callback) callback();
    } catch (error) {
      console.error(`StorageManager._remove(${area}) error:`, error);
      if (callback) callback();
      throw error;
    }
  }

  /**
   * 共通のclear処理
   */
  private static async _clear(area: StorageArea, callback?: StorageCallback<void>): Promise<void> {
    const storage = this.getStorageArea(area);

    try {
      await new Promise<void>((resolve, reject) => {
        storage.clear(() => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });

      if (callback) callback();
    } catch (error) {
      console.error(`StorageManager._clear(${area}) error:`, error);
      if (callback) callback();
      throw error;
    }
  }

  // ===== Public API Methods =====

  /**
   * Chrome Storage Sync APIから値を取得
   */
  static async getSync<K extends keyof StorageData>(
    keys: K | K[],
    options: StorageOptions = {}
  ): Promise<Pick<StorageData, K>> {
    return this._get('sync', keys, options);
  }

  /**
   * Chrome Storage Sync APIに値を保存
   */
  static async setSync<K extends keyof StorageData>(
    data: Pick<StorageData, K>,
    callback?: StorageCallback<void>
  ): Promise<void> {
    return this._set('sync', data, callback);
  }

  /**
   * Chrome Storage Local APIから値を取得
   */
  static async getLocal<K extends keyof StorageData>(
    keys: K | K[],
    options: StorageOptions = {}
  ): Promise<Pick<StorageData, K>> {
    return this._get('local', keys, options);
  }

  /**
   * Chrome Storage Local APIに値を保存
   */
  static async setLocal<K extends keyof StorageData>(
    data: Pick<StorageData, K>,
    callback?: StorageCallback<void>
  ): Promise<void> {
    return this._set('local', data, callback);
  }

  /**
   * Chrome Storage Sync APIから値を削除
   */
  static async removeSync(
    keys: keyof StorageData | (keyof StorageData)[],
    callback?: StorageCallback<void>
  ): Promise<void> {
    return this._remove('sync', keys, callback);
  }

  /**
   * Chrome Storage Local APIから値を削除
   */
  static async removeLocal(
    keys: keyof StorageData | (keyof StorageData)[],
    callback?: StorageCallback<void>
  ): Promise<void> {
    return this._remove('local', keys, callback);
  }

  // ===== 特化メソッド =====

  /**
   * 使用履歴を取得（特化メソッド）
   */
  static async getUsageHistory(callback?: StorageCallback<UsageHistory>): Promise<UsageHistory> {
    const result = await this.getSync('usageHistory', { callback });
    return result.usageHistory || {};
  }

  /**
   * 使用履歴を保存（特化メソッド）
   */
  static async setUsageHistory(
    history: UsageHistory, 
    callback?: StorageCallback<void>
  ): Promise<void> {
    return this.setSync({ usageHistory: history }, callback);
  }

  /**
   * ブロック解除時刻を取得（特化メソッド）
   */
  static async getUnblockUntil(callback?: StorageCallback<number>): Promise<number> {
    const result = await this.getSync('unblockUntil', { callback });
    return result.unblockUntil || 0;
  }

  /**
   * ブロック解除時刻を保存（特化メソッド）
   */
  static async setUnblockUntil(
    timestamp: number, 
    callback?: StorageCallback<void>
  ): Promise<void> {
    return this.setSync({ unblockUntil: timestamp }, callback);
  }

  /**
   * デフォルト分数を取得（特化メソッド）
   */
  static async getDefaultMinutes(callback?: StorageCallback<number | null>): Promise<number | null> {
    const result = await this.getSync('defaultMinutes', { callback });
    return result.defaultMinutes;
  }

  /**
   * デフォルト分数を保存（特化メソッド）
   */
  static async setDefaultMinutes(
    minutes: number, 
    callback?: StorageCallback<void>
  ): Promise<void> {
    return this.setSync({ defaultMinutes: minutes }, callback);
  }

  /**
   * リダイレクトURLを取得（特化メソッド）
   */
  static async getRedirectURL(callback?: StorageCallback<string>): Promise<string> {
    const result = await this.getSync('redirectURL', { callback });
    return result.redirectURL || '';
  }

  /**
   * リダイレクトURLを保存（特化メソッド）
   */
  static async setRedirectURL(
    url: string, 
    callback?: StorageCallback<void>
  ): Promise<void> {
    return this.setSync({ redirectURL: url }, callback);
  }

  /**
   * デバッグログを取得（特化メソッド）
   */
  static async getDebugLogs(callback?: StorageCallback<DebugLog[]>): Promise<DebugLog[]> {
    const result = await this.getLocal('debugLogs', { callback });
    return result.debugLogs || [];
  }

  /**
   * デバッグログを保存（特化メソッド）
   */
  static async setDebugLogs(
    logs: DebugLog[], 
    callback?: StorageCallback<void>
  ): Promise<void> {
    return this.setLocal({ debugLogs: logs }, callback);
  }

  /**
   * リダイレクトタブマップを取得（特化メソッド）
   */
  static async getRedirectTabMap(callback?: StorageCallback<RedirectTabMap>): Promise<RedirectTabMap> {
    const result = await this.getLocal('redirectTabMap', { callback });
    return result.redirectTabMap || {};
  }

  /**
   * リダイレクトタブマップを保存（特化メソッド）
   */
  static async setRedirectTabMap(
    tabMap: RedirectTabMap, 
    callback?: StorageCallback<void>
  ): Promise<void> {
    return this.setLocal({ redirectTabMap: tabMap }, callback);
  }

  /**
   * 全同期ストレージをクリア（開発・テスト用）
   */
  static async clearAllSync(callback?: StorageCallback<void>): Promise<void> {
    return this._clear('sync', callback);
  }

  /**
   * 全ローカルストレージをクリア（開発・テスト用）
   */
  static async clearAllLocal(callback?: StorageCallback<void>): Promise<void> {
    return this._clear('local', callback);
  }
}

