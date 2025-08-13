/**
 * Chrome拡張機能内でのメッセージング用型定義
 */

export type MessageType = 
  | 'UNBLOCK_UPDATED'
  | 'REDIRECT_REQUESTED'
  | 'GET_BLOCKING_STATE'
  | 'UPDATE_OVERLAY';

export interface BaseMessage {
  type: MessageType;
}

export interface UnblockUpdatedMessage extends BaseMessage {
  type: 'UNBLOCK_UPDATED';
  unblockUntil: number;
}

export interface RedirectRequestedMessage extends BaseMessage {
  type: 'REDIRECT_REQUESTED';
  url?: string;
}

export interface GetBlockingStateMessage extends BaseMessage {
  type: 'GET_BLOCKING_STATE';
}

export interface UpdateOverlayMessage extends BaseMessage {
  type: 'UPDATE_OVERLAY';
}

export type ExtensionMessage = 
  | UnblockUpdatedMessage
  | RedirectRequestedMessage
  | GetBlockingStateMessage
  | UpdateOverlayMessage;

export interface MessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}