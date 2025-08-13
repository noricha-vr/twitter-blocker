/**
 * Chrome Storage APIで管理するデータ構造の型定義
 */

export interface StorageData {
  /** ブロック解除終了時刻のタイムスタンプ */
  unblockUntil?: number;
  
  /** デフォルトの解除時間（分） */
  defaultMinutes?: number;
  
  /** 使用履歴: 日付(YYYY-MM-DD) → 使用時間(分) のマッピング */
  usageHistory?: Record<string, number>;
  
  /** 開始時刻（時間ベース制御用、未実装） */
  startTime?: string;
  
  /** 終了時刻（時間ベース制御用、未実装） */
  endTime?: string;
  
  /** ブロック時にリダイレクトするURL */
  redirectURL?: string;
}

export type StorageKey = keyof StorageData;