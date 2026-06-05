import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { ILLMPort } from '../ports/llm.port.js';
import type { IStoragePort } from '../ports/storage.port.js';
import { Conversation, ConversationStatus } from '../domain/index.js';

export interface SendMessageCallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export class AgentService {
  constructor(
    private llmPort: ILLMPort,
    private storagePort: IStoragePort
  ) {}

  /**
   * 创建新对话
   */
  createConversation(name?: string): Conversation {
    const storageConv = this.storagePort.createConversation({ name });
    return Conversation.fromStorage(storageConv);
  }

  /**
   * 获取对话
   */
  getConversation(conversationId: string): Conversation | null {
    const storageConv = this.storagePort.listConversations().find((c) => c.id === conversationId);
    if (!storageConv) return null;

    const messages = this.storagePort.getMessages(conversationId);
    return Conversation.fromStorage({
      ...storageConv,
      messages,
    });
  }

  /**
   * 发送消息
   */
  async sendMessage(
    conversationId: string,
    userInput: string,
    callbacks: SendMessageCallbacks
  ) {
    console.log('[AgentService] sendMessage 被调用, conversationId:', conversationId);

    // 1. 获取当前对话
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      callbacks.onError(`对话不存在: ${conversationId}`);
      return;
    }

    // 2. 获取激活的 Prompt
    const activePrompt = this.storagePort.getActivePrompt();
    const systemPrompt = activePrompt?.systemPrompt || '';

    // 3. 构建消息历史
    const history = conversation.getHistory(10);
    const langchainMessages = this.buildLangChainMessages(history);
    
    // 4. 添加当前用户消息
    const userMessage = conversation.addUserMessage(userInput);
    langchainMessages.push(new HumanMessage(userInput));

    // 5. 构建完整消息列表
    const allMessages = [
      ...(systemPrompt ? [new SystemMessage(systemPrompt)] : []),
      ...langchainMessages,
    ];

    console.log('[AgentService] 发送给 LLM 的消息数:', allMessages.length);

    // 6. 持久化用户消息
    this.storagePort.appendMessage({
      conversationId,
      role: 'user',
      content: userInput,
    });

    // 7. 设置对话为加载状态
    conversation.startLoading();

    try {
      console.log('[AgentService] 调用 LLM...');
      const result = await this.llmPort.invokeStream(
        allMessages,
        (token) => {
          callbacks.onToken(token);
        }
      );

      console.log('[AgentService] LLM 返回完成');

      // 8. 添加助手消息
      conversation.addAssistantMessage(result.content, this.llmPort.model);

      // 9. 持久化助手消息
      this.storagePort.appendMessage({
        conversationId,
        role: 'assistant',
        content: result.content,
        model: this.llmPort.model,
      });

      // 10. 结束加载状态
      conversation.stopLoading();

      callbacks.onDone();
      console.log('[AgentService] 发送完成');
    } catch (err: unknown) {
      console.error('[AgentService] 错误:', err);
      conversation.stopLoading();
      const msg = err instanceof Error ? err.message : String(err);
      callbacks.onError(msg);
    }
  }

  /**
   * 构建 LangChain 消息
   */
  private buildLangChainMessages(messages: import('../domain/index.js').Message[]): BaseMessage[] {
    return messages.map((m) =>
      m.role === 'user'
        ? new HumanMessage(m.content)
        : new AIMessage(m.content)
    );
  }

  /**
   * 结束对话
   */
  endConversation(conversationId: string, title?: string): boolean {
    const conversation = this.getConversation(conversationId);
    if (!conversation) return false;

    conversation.end(title || conversation.getFirstUserMessage()?.content.substring(0, 20) || '新对话');

    // 更新存储
    return this.storagePort.endConversation(conversationId, conversation.name);
  }

  /**
   * 压缩对话
   */
  compressConversation(conversationId: string, summary: string): boolean {
    const conversation = this.getConversation(conversationId);
    if (!conversation) return false;

    conversation.compress(summary);

    // 更新存储
    return this.storagePort.compressConversation(conversationId, summary);
  }

  /**
   * 获取对话状态
   */
  getConversationStatus(conversationId: string): ConversationStatus {
    const conversation = this.getConversation(conversationId);
    return conversation?.status || ConversationStatus.Idle;
  }
}
