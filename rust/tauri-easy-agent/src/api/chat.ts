// ============ Tauri Chat API ============
// 迁移自 Electron IPC API，使用 @tauri-apps/api/core 的 invoke 和事件监听

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  TokenPayload,
  DonePayload,
  ErrorPayload,
  MessagesSyncedPayload,
  MessageRecord,
  ConversationRecord,
  CompressResult,
} from '@/types/electron.d.ts';

// 事件监听清理函数集合
const unlisteners: UnlistenFn[] = [];

/**
 * 设置聊天事件监听器。
 * 返回清理函数，可在组件卸载时调用以移除监听器。
 */
export function setupChatListeners(callbacks: {
  onToken: (data: TokenPayload) => void;
  onToolCall: (data: { serverId: string; toolName: string; args: unknown }) => void;
  onDone: (data: DonePayload) => void;
  onError: (data: ErrorPayload) => void;
  onMessagesSynced?: (data: MessagesSyncedPayload) => void;
}): () => void {
  // 清理旧的监听器（防止重复注册）
  unlisteners.forEach((fn) => fn());
  unlisteners.length = 0;

  listen<TokenPayload>('token', (event) => {
    callbacks.onToken(event.payload);
  }).then((fn) => unlisteners.push(fn));

  listen<DonePayload>('done', (event) => {
    callbacks.onDone(event.payload);
  }).then((fn) => unlisteners.push(fn));

  listen<ErrorPayload>('error', (event) => {
    callbacks.onError(event.payload);
  }).then((fn) => unlisteners.push(fn));

  if (callbacks.onMessagesSynced) {
    listen<MessagesSyncedPayload>('messages-synced', (event) => {
      callbacks.onMessagesSynced!(event.payload);
    }).then((fn) => unlisteners.push(fn));
  }

  // 返回清理函数
  return () => {
    unlisteners.forEach((fn) => fn());
    unlisteners.length = 0;
  };
}

export const chatApi = {
  /**
   * 发送消息到当前对话
   */
  send: (conversationId: string, message: string): Promise<void> =>
    invoke('send_message', { conversationId, message }),

  /**
   * 获取对话历史记录
   */
  getHistory: (conversationId: string): Promise<MessageRecord[]> =>
    invoke('get_history', { conversationId }),

  /**
   * 获取所有已结束的对话列表
   */
  getConversations: (): Promise<ConversationRecord[]> =>
    invoke('get_conversations'),

  /**
   * 创建新对话
   */
  newConversation: (): Promise<{ id: string; name: string }> =>
    invoke('new_conversation'),

  /**
   * 删除对话
   */
  deleteConversation: (conversationId: string): Promise<boolean> =>
    invoke('delete_conversation', { conversationId }),

  /**
   * 压缩对话历史（减少 token 消耗）
   */
  compressConversation: (conversationId: string): Promise<CompressResult | null> =>
    invoke('compress_conversation', { conversationId }),

  /**
   * 结束对话
   */
  endConversation: (conversationId: string): Promise<void> =>
    invoke('end_conversation', { conversationId }),
};
