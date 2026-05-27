import { ChatAnthropic } from '@langchain/anthropic';
import type { BaseMessage } from '@langchain/core/messages';
import type { ILLMPort, LLMResponse } from '../../ports/llm.port.js';

export class ClaudeAdapter implements ILLMPort {
  readonly provider = 'anthropic';
  model: string;
  private llm: ChatAnthropic;

  constructor(model: string, apiKey: string) {
    this.model = model;
    this.llm = new ChatAnthropic({
      model: this.model,
      apiKey,
      temperature: 0,
      streaming: true,
    });
  }

  async invoke(messages: BaseMessage[]): Promise<LLMResponse> {
    const result = await this.llm.invoke(messages);
    return { content: result.content as string };
  }

  async invokeStream(
    messages: BaseMessage[],
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse> {
    const stream = await this.llm.stream(messages);
    let full = '';
    for await (const chunk of stream) {
      full += chunk.content;
      onChunk(chunk.content as string);
    }
    return { content: full };
  }
}
