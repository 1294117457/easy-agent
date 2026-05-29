export function setupChatListeners(callbacks: {
  onToken: (token: string) => void;
      onToolCall: (data: { serverId: string; toolName: string; args: unknown }) => void;
      onDone: (data: { conversationId: string }) => void;
      onError: (data: { conversationId: string; error: string }) => void;
  onMessagesSynced?: (data: { conversationId: string; newMessages: unknown[] }) => void;  // ✅ 新增
}) {
  window.electronAPI.onToken(callbacks.onToken);
  window.electronAPI.onDone(callbacks.onDone);
  window.electronAPI.onError(callbacks.onError);

  // ✅ 新增：消息同步事件
  if (callbacks.onMessagesSynced) {
    window.electronAPI.onMessagesSynced(callbacks.onMessagesSynced);
  }
}

export const chatApi = {
  send: (conversationId: string, message: string) =>
    window.electronAPI.sendMessage(conversationId, message),
  getHistory: (conversationId: string) =>
    window.electronAPI.getHistory(conversationId),
  getConversations: () => window.electronAPI.getConversations(),
  newConversation: () => window.electronAPI.newConversation(),
  deleteConversation: (conversationId: string) =>
    window.electronAPI.deleteConversation(conversationId),
  compressConversation: (conversationId: string) =>
    window.electronAPI.compressConversation(conversationId),
  endConversation: (conversationId: string) =>
    window.electronAPI.endConversation(conversationId),
};
