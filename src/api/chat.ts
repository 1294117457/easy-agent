export function setupChatListeners(callbacks: {
  onToken: (token: string) => void;
  onToolCall: (data: { serverId: string; toolName: string; args: unknown }) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  window.electronAPI.onToken(callbacks.onToken);
  window.electronAPI.onDone(callbacks.onDone);
  window.electronAPI.onError(callbacks.onError);
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
