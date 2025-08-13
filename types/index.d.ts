/**
 * アプリケーション全体で使用する共通型定義
 */

export * from './storage';
export * from './messages';

/**
 * 使用履歴チャート用のデータ構造
 */
export interface ChartData {
  /** 日付（YYYY-MM-DD形式） */
  date: string;
  /** 使用時間（分） */
  minutes: number;
}

/**
 * ブロック状態の情報
 */
export interface BlockingState {
  /** 現在ブロックされているかどうか */
  isBlocked: boolean;
  /** ブロック解除終了時刻のタイムスタンプ（ブロック中の場合はundefined） */
  unblockUntil?: number;
  /** 残り時間（分、ブロック中の場合はundefined） */
  remainingMinutes?: number;
}

/**
 * URLバリデーション結果
 */
export interface URLValidationResult {
  /** URLが有効かどうか */
  isValid: boolean;
  /** エラーメッセージ（無効な場合） */
  error?: string;
  /** 正規化されたURL（有効な場合） */
  normalizedUrl?: string;
}

/**
 * ユーティリティ型
 */
export type DateString = string; // YYYY-MM-DD format
export type Timestamp = number;
export type Minutes = number;