import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { ILLMPort } from '../ports/llm.port.js';
import type { IStoragePort } from '../ports/storage.port.js';

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

  async sendMessage(
    conversationId: string,
    userInput: string,
    callbacks: SendMessageCallbacks
  ) {
    console.log('[AgentService] sendMessage 被调用');
    console.log('[AgentService] conversationId:', conversationId);
    console.log('[AgentService] userInput:', userInput);

    // 获取当前激活的 Prompt
    const activePrompt = this.storagePort.getActivePrompt();
    console.log('[AgentService] activePrompt:', JSON.stringify(activePrompt));
    const systemPrompt = activePrompt?.systemPrompt || '';
    console.log('[AgentService] systemPrompt:', JSON.stringify(systemPrompt));
    console.log('[AgentService] systemPrompt.length:', systemPrompt.length);

    // 获取历史消息
    const history = this.storagePort.getMessages(conversationId);
    console.log('[AgentService] 历史消息数:', history.length);

    // 构建 langchain 消息（历史）
    const langchainMessages = history.slice(-10).map((m) =>
      m.role === 'user'
        ? new HumanMessage(m.content)
        : new AIMessage(m.content)
    );

    // 添加当前用户消息
    langchainMessages.push(new HumanMessage(userInput));

    // 构建最终消息列表
    const allMessages = [
      ...(systemPrompt ? [new SystemMessage(systemPrompt)] : []),
      ...langchainMessages,
    ];

    console.log('[AgentService] 发送给 LLM 的消息数:', allMessages.length);

    // 持久化用户消息
    this.storagePort.appendMessage({
      conversationId,
      role: 'user',
      content: userInput,
    });

    try {
      console.log('[AgentService] 调用 LLM...');
      const result = await this.llmPort.invokeStream(
        allMessages,
        (token) => {
          callbacks.onToken(token);
        }
      );

      console.log('[AgentService] LLM 返回完成');

      this.storagePort.appendMessage({
        conversationId,
        role: 'assistant',
        content: result.content,
        model: this.llmPort.model,
      });

      callbacks.onDone();
      console.log('[AgentService] 发送完成');
    } catch (err: unknown) {
      console.error('[AgentService] 错误:', err);
      const msg = err instanceof Error ? err.message : String(err);
      callbacks.onError(msg);
    }
  }
}
