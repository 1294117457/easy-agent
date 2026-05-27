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
    if (!currentConversation.value) return '新对话';
    // 如果是默认名称，显示第一句话
    if (currentConversation.value.name === '新对话' && messages.value.length > 0) {
      const firstUserMsg = messages.value.find((m) => m.role === 'user');
      if (firstUserMsg) {
        return firstUserMsg.content.substring(0, 20) + (firstUserMsg.content.length > 20 ? '...' : '');
      }
    }
    return currentConversation.value.name;
  });

  // 防止重复初始化
  let listenersInitialized = false;

  // 创建助手消息
  function createAssistantMessage(token: string): Message {
    return {
      id: crypto.randomUUID(),
      conversationId: currentConversationId.value || '',
      role: 'assistant',
      content: token,
      createdAt: new Date().toISOString(),
    };
  }

  // 初始化监听器
  function setupListeners() {
    if (listenersInitialized) {
      console.log('[ChatStore] 监听器已初始化，跳过');
      return;
    }
    listenersInitialized = true;

    console.log('[ChatStore] 初始化监听器');
    setupChatListeners({
      onToken: (token: string) => {
        const lastMsg = messages.value[messages.value.length - 1];
        if (lastMsg?.role === 'assistant') {
          lastMsg.content += token;
        } else {
          messages.value.push(createAssistantMessage(token));
        }
      },
      onToolCall: () => {},
      onDone: () => {
        console.log('[ChatStore] 完成');
        isLoading.value = false;
        // 完成消息后检查是否需要压缩
        messageCount.value += 2; // user + assistant
        checkAndCompress();
      },
      onError: (msg: string) => {
        console.error('[ChatStore] 错误:', msg);
        isLoading.value = false;
        messages.value.push({
          id: crypto.randomUUID(),
          conversationId: currentConversationId.value || '',
          role: 'assistant',
          content: `错误：${msg}`,
          createdAt: new Date().toISOString(),
        });
      },
    });
  }

  // 发送消息
  async function sendMessage(content: string) {
    // 验证有选中的对话
    if (!currentConversationId.value) {
      console.log('[ChatStore] 没有选中的对话，创建新对话');
      await newConversation();
    }

    // 捕获当前的 conversationId，避免异步问题
    const conversationId = currentConversationId.value!;
    const myMessages = messages.value;

    // 添加用户消息
    myMessages.push({
      id: crypto.randomUUID(),
      conversationId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    });

    isLoading.value = true;

    try {
      await chatApi.send(conversationId, content);
    } catch (e) {
      console.error('[ChatStore] 发送失败:', e);
      isLoading.value = false;
      // 发送失败时移除用户消息
      const idx = myMessages.findIndex((m) => m.id === myMessages[myMessages.length - 1].id && m.role === 'user');
      if (idx !== -1) {
        myMessages.splice(idx, 1);
      }
    }
  }

  // 创建新对话
  async function newConversation() {
    console.log('[ChatStore] 创建新对话');
    const conv = await chatApi.newConversation();
    currentConversationId.value = conv.id;
    messages.value = [];
    await loadConversations();
    return conv;
  }

  // 加载对话列表
  async function loadConversations() {
    const data = await chatApi.getConversations();
    console.log('[ChatStore] 加载对话列表，原始数据:', JSON.stringify(data));
    // 验证并转换数据，确保 createdAt 是有效的
    conversations.value = data.map((conv: any) => ({
      id: conv.id || '',
      name: conv.name || '新对话',
      summary: conv.summary,
      createdAt: conv.createdAt || new Date().toISOString(),
      updatedAt: conv.updatedAt || new Date().toISOString(),
      endedAt: conv.endedAt || undefined,
    }));
    console.log('[ChatStore] 转换后数据:', JSON.stringify(conversations.value));
  }

  // 选择对话
  async function selectConversation(id: string) {
    console.log('[ChatStore] 选择对话:', id);

    // 先更新 ID
    currentConversationId.value = id;

    // 清空当前消息，防止闪烁
    messages.value = [];

    // 等待消息加载完成
    const history = await chatApi.getHistory(id);
    messages.value = history;
    messageCount.value = history.length;

    console.log('[ChatStore] 加载消息数:', messages.value.length);
  }

  // 删除对话
  async function deleteConversation(id: string) {
    await chatApi.deleteConversation(id);
    await loadConversations();
    // 如果删除的是当前对话，切换到第一个或创建新的
    if (currentConversationId.value === id) {
      if (conversations.value.length > 0) {
        await selectConversation(conversations.value[0].id);
      } else {
        await newConversation();
      }
    }
  }

  // 切换历史侧边栏
  function toggleHistory() {
    showHistory.value = !showHistory.value;
  }

  // 检查并压缩对话
  async function checkAndCompress() {
    if (!currentConversationId.value) return;
    if (messageCount.value > 0 && messageCount.value % 20 === 0) {
      console.log('[ChatStore] 触发自动压缩，消息数:', messageCount.value);
      try {
        const result = await chatApi.compressConversation(currentConversationId.value);
        if (result) {
          console.log('[ChatStore] 压缩完成，摘要:', result.summary);
        }
      } catch (e) {
        console.error('[ChatStore] 压缩失败:', e);
      }
    }
  }

  // 结束当前对话
  async function endCurrentConversation() {
    if (!currentConversationId.value) return;
    try {
      await chatApi.endConversation(currentConversationId.value);
      await loadConversations();
    } catch (e) {
      console.error('[ChatStore] 结束对话失败:', e);
    }
  }

  return {
    // 状态
    messages,
    conversations,
    currentConversationId,
    isLoading,
    showHistory,
    // 计算属性
    currentConversation,
    currentTitle,
    // 方法
    setupListeners,
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
