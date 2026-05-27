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
    console.log('[AgentService] sendMessage 开始, conversationId:', conversationId);
    console.log('[AgentService] userInput:', userInput);
    console.log('[AgentService] 当前模型:', this.llmPort.provider, this.llmPort.model);

    // 获取当前激活的 Prompt
    const activePrompt = this.storagePort.getActivePrompt();
    const systemPrompt = activePrompt?.systemPrompt || '';

    if (!systemPrompt) {
      console.warn('[AgentService] 警告：没有配置 System Prompt');
    }

    // 获取历史消息
    const history = this.storagePort.getMessages(conversationId);
    const historyWithoutCurrent = history.slice(0, -1);
    const recentHistory = historyWithoutCurrent.slice(-10);

    console.log('[AgentService] 历史消息数量:', historyWithoutCurrent.length, '，使用:', recentHistory.length);

    // 构建 langchain 消息（历史）
    const langchainMessages: BaseMessage[] = recentHistory.map((m) =>
      m.role === 'user'
        ? new HumanMessage(m.content)
        : new AIMessage(m.content)
    );

    // 关键：添加当前用户消息
    langchainMessages.push(new HumanMessage(userInput));

    // 构建最终消息列表
    const allMessages: BaseMessage[] = [
      ...(systemPrompt ? [new SystemMessage(systemPrompt)] : []),
      ...langchainMessages,
    ];

    console.log('[AgentService] 发送给 LLM 的消息数:', allMessages.length);
    console.log('[AgentService] 消息内容:', JSON.stringify(allMessages.map(m => ({
      role: m.getType(),
      content: (m.content as string).substring(0, 50)
    }))));

    // 持久化用户消息
    this.storagePort.appendMessage({
      conversationId,
      role: 'user',
      content: userInput,
    });

    try {
      let tokenCount = 0;
      const result = await this.llmPort.invokeStream(
        allMessages,
        (token) => {
          tokenCount++;
          if (tokenCount <= 3) {
            console.log('[AgentService] token', tokenCount, ':', JSON.stringify(token));
          }
          callbacks.onToken(token);
        }
      );

      console.log('[AgentService] LLM 返回完成，总 token 数:', tokenCount);

      this.storagePort.appendMessage({
        conversationId,
        role: 'assistant',
        content: result.content,
        model: this.llmPort.model,
      });

      callbacks.onDone();
    } catch (err: unknown) {
      console.error('[AgentService] 错误:', err);
      const msg = err instanceof Error ? err.message : String(err);
      callbacks.onError(msg);
    }
  }
}
