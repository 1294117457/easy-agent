import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { chatApi, setupChatListeners } from '@/api/chat';

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  isCompressed?: boolean;
}

export interface Conversation {
  id: string;
  name: string;
  status: 'idle' | 'loading' | 'completed';
  summary?: string;
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
}

export const useChatStore = defineStore('chat', () => {
  // 状态
  const messages = ref<Message[]>([]);
  const conversations = ref<Conversation[]>([]);
  const currentConversationId = ref<string | null>(null);
  const isLoading = ref(false);
  const showHistory = ref(false);
  const messageCount = ref(0);

  // 计算属性
  const currentConversation = computed(() =>
    conversations.value.find((c) => c.id === currentConversationId.value)
  );

  const currentTitle = computed(() => {
    if (messages.value.length === 0) return '新对话';
    const firstUserMsg = messages.value.find((m) => m.role === 'user');
    if (firstUserMsg) {
      return firstUserMsg.content.substring(0, 20) + (firstUserMsg.content.length > 20 ? '...' : '');
    }
    return '新对话';
  });

  const listenersInitialized = ref(false);

  function createAssistantMessage(token: string, conversationId: string): Message {
    return {
      id: crypto.randomUUID(),
      conversationId,
      role: 'assistant',
      content: token,
      createdAt: new Date().toISOString(),
    };
  }

  function setupListeners() {
    if (listenersInitialized.value) return;
    listenersInitialized.value = true;

    setupChatListeners({
      onToken: (data: { conversationId: string; token: string }) => {
        const { conversationId, token } = data;
        if (conversationId !== currentConversationId.value) {
          return;
        }
        const lastMsg = messages.value[messages.value.length - 1];
        if (lastMsg?.role === 'assistant') {
          lastMsg.content += token;
        } else {
          messages.value.push(createAssistantMessage(token, conversationId));
        }
      },
      onToolCall: () => {},
      onDone: (data: { conversationId: string }) => {
        console.log('[ChatStore] onDone:', data.conversationId);
        // 更新对话状态
        const conv = conversations.value.find(c => c.id === data.conversationId);
        if (conv) {
          conv.status = 'idle';
        }
        // 仅当是当前对话时，才更新 messageCount 和检查压缩
        if (data.conversationId === currentConversationId.value) {
          isLoading.value = false;
          messageCount.value += 2;
          checkAndCompress();
        }
      },
      onError: (data: { conversationId: string; error: string }) => {
        console.log('[ChatStore] onError:', data.conversationId);
        // 更新对话状态
        const conv = conversations.value.find(c => c.id === data.conversationId);
        if (conv) {
          conv.status = 'idle';
        }
        // 仅当是当前对话时，才追加错误消息
        if (data.conversationId === currentConversationId.value) {
          isLoading.value = false;
          messages.value.push({
            id: crypto.randomUUID(),
            conversationId: currentConversationId.value || '',
            role: 'assistant',
            content: `错误：${data.error}`,
            createdAt: new Date().toISOString(),
          });
        }
      },
      onMessagesSynced: (data: { conversationId: string; newMessages: unknown[] }) => {
        if (data.conversationId !== currentConversationId.value) {
          return;
        }
        const currentIds = new Set(messages.value.map(m => m.id));
        (data.newMessages as Message[]).forEach(msg => {
          if (!currentIds.has(msg.id)) {
            messages.value.push(msg);
          }
        });
      },
    });
  }

  function resetListeners() {
    listenersInitialized.value = false;
  }

  async function sendMessage(content: string) {
    let convId = currentConversationId.value;

    if (!convId) {
      const conv = await chatApi.newConversation();
      convId = conv.id;
      currentConversationId.value = convId;
      conversations.value.unshift({
        ...conv,
        status: 'loading',
      });
      messages.value = [];
      messageCount.value = 0;
    } else {
      // 设置对话状态为 loading
      const conv = conversations.value.find(c => c.id === convId);
      if (conv) {
        conv.status = 'loading';
      }
    }

    const userMessage = {
      id: crypto.randomUUID(),
      conversationId: convId,
      role: 'user' as const,
      content,
      createdAt: new Date().toISOString(),
    };
    messages.value.push(userMessage);

    isLoading.value = true;

    try {
      await chatApi.send(convId, content);
      const syncId = convId;
      setTimeout(async () => {
        if (currentConversationId.value !== syncId) return;
        try {
          const history = await chatApi.getHistory(syncId);
          if (currentConversationId.value === syncId) {
            messages.value = history;
          }
        } catch (e) {
          // ignore
        }
      }, 500);
    } catch (e) {
      isLoading.value = false;
      // 发送失败，重置对话状态
      const conv = conversations.value.find(c => c.id === convId);
      if (conv) {
        conv.status = 'idle';
      }
      const idx = messages.value.findIndex((m) => m.id === userMessage.id);
      if (idx !== -1) {
        messages.value.splice(idx, 1);
      }
    }
  }

  async function newConversation() {
    const prevId = currentConversationId.value;

    if (prevId) {
      try {
        await chatApi.endConversation(prevId);
      } catch (e) {
        // ignore
      }
    }

    currentConversationId.value = null;
    messages.value = [];
    messageCount.value = 0;
    isLoading.value = false;

    if (prevId) {
      const conv = conversations.value.find(c => c.id === prevId);
      if (conv) {
        conv.endedAt = new Date().toISOString();
        conv.status = 'completed';
      }
    }
    await loadConversations();
  }

  async function loadConversations() {
    const data = await chatApi.getConversations();
    const filtered = data
      .filter((conv: any) => conv.endedAt)
      .map((conv: any) => ({
        id: conv.id || '',
        name: conv.name || '新对话',
        status: 'idle' as const,
        summary: conv.summary,
        createdAt: conv.createdAt || new Date().toISOString(),
        updatedAt: conv.updatedAt || new Date().toISOString(),
        endedAt: conv.endedAt || undefined,
      }))
      .sort((a: Conversation, b: Conversation) => {
        return new Date(b.endedAt || 0).getTime() - new Date(a.endedAt || 0).getTime();
      });
    conversations.value = filtered;
  }

  async function selectConversation(id: string) {
    // 切换前不关闭对话
    currentConversationId.value = id;
    messages.value = [];
    messageCount.value = 0;

    const history = await chatApi.getHistory(id);
    messages.value = history;
    messageCount.value = history.length;

    // 根据对话状态恢复加载状态
    const conv = conversations.value.find(c => c.id === id);
    if (conv) {
      conv.endedAt = undefined;
      isLoading.value = conv.status === 'loading';
    } else {
      isLoading.value = false;
    }
  }

  async function deleteConversation(id: string) {
    await chatApi.deleteConversation(id);
    await loadConversations();
    if (currentConversationId.value === id) {
      currentConversationId.value = null;
      messages.value = [];
      messageCount.value = 0;
      isLoading.value = false;
    }
  }

  function toggleHistory() {
    showHistory.value = !showHistory.value;
  }

  async function checkAndCompress() {
    if (!currentConversationId.value) return;
    if (messageCount.value > 0 && messageCount.value % 20 === 0) {
      try {
        const result = await chatApi.compressConversation(currentConversationId.value);
        if (result) {
          await loadConversations();
        }
      } catch (e) {
        // ignore
      }
    }
  }

  async function endCurrentConversation() {
    if (!currentConversationId.value) return;
    const prevId = currentConversationId.value;
    try {
      await chatApi.endConversation(currentConversationId.value);
      currentConversationId.value = null;
      messages.value = [];
      messageCount.value = 0;
      isLoading.value = false;
      const conv = conversations.value.find(c => c.id === prevId);
      if (conv) {
        conv.endedAt = new Date().toISOString();
        conv.status = 'completed';
      }
    } catch (e) {
      // ignore
    }
  }

  return {
    messages,
    conversations,
    currentConversationId,
    isLoading,
    showHistory,
    currentConversation,
    currentTitle,
    setupListeners,
    resetListeners,
    sendMessage,
    newConversation,
    loadConversations,
    selectConversation,
    deleteConversation,
    toggleHistory,
    checkAndCompress,
    endCurrentConversation,
  };
});
