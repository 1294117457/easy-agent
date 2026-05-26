import { defineStore } from 'pinia';
import { ref } from 'vue';
import { chatApi, setupChatListeners } from '@/api/chat';

export const useAgentStore = defineStore('agent', () => {
  const messages = ref<any[]>([]);
  const isLoading = ref(false);
  const currentConversationId = ref<string | null>(null);
  const conversations = ref<any[]>([]);

  function setupListeners() {
    setupChatListeners({
      onToken: (token: string) => {
        const lastMsg = messages.value[messages.value.length - 1];
        if (lastMsg?.role === 'assistant') {
          lastMsg.content += token;
        } else {
          messages.value.push({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: token,
            createdAt: new Date().toISOString(),
          });
        }
      },
      onToolCall: () => {},
      onDone: () => {
        isLoading.value = false;
      },
      onError: (msg: string) => {
        isLoading.value = false;
        messages.value.push({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `错误：${msg}`,
          createdAt: new Date().toISOString(),
        });
      },
    });
  }

  async function sendMessage(content: string) {
    if (!currentConversationId.value) {
      await newConversation();
    }

    messages.value.push({
      id: crypto.randomUUID(),
      conversationId: currentConversationId.value,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    });

    isLoading.value = true;

    try {
      await chatApi.send(currentConversationId.value!, content);
    } catch {
      isLoading.value = false;
    }
  }

  async function newConversation() {
    const conv = await chatApi.newConversation();
    currentConversationId.value = conv.id;
    messages.value = [];
    await loadConversations();
    return conv;
  }

  async function loadConversations() {
    conversations.value = await chatApi.getConversations();
  }

  async function selectConversation(id: string) {
    currentConversationId.value = id;
    messages.value = await chatApi.getHistory(id);
  }

  return {
    messages,
    isLoading,
    currentConversationId,
    conversations,
    setupListeners,
    sendMessage,
    newConversation,
    loadConversations,
    selectConversation,
  };
});
