import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { ILLMPort } from '../../ports/llm.port.js';
import type { IStoragePort } from '../../ports/storage.port.js';

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
    this.storagePort.appendMessage({
      conversationId,
      role: 'user',
      content: userInput,
    });

    const history = this.storagePort.getMessages(conversationId);
    const langchainMessages: BaseMessage[] = history.map((m) =>
      m.role === 'user'
        ? new HumanMessage(m.content)
        : new AIMessage(m.content)
    );

    const prompts = this.storagePort.listPrompts();
    const systemPrompt =
      prompts[0]?.systemPrompt || '你是 EasyAgent，智能助手。';
    const allMessages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      ...langchainMessages,
      new HumanMessage(userInput),
    ];

    try {
      const result = await this.llmPort.invokeStream(
        allMessages,
        callbacks.onToken
      );

      this.storagePort.appendMessage({
        conversationId,
        role: 'assistant',
        content: result.content,
        model: this.llmPort.model,
      });

      callbacks.onDone();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      callbacks.onError(msg);
    }
  }
}
