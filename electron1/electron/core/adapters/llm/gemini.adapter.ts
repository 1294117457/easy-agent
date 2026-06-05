import { ChatOpenAI } from '@langchain/openai';
import type { BaseMessage } from '@langchain/core/messages';
import type { ILLMPort, LLMResponse } from '../../ports/llm.port.js';

export class GeminiAdapter implements ILLMPort {
  readonly provider = 'gemini';
  model: string;
  private llm: ChatOpenAI;

  constructor(model: string, apiKey: string) {
    // Gemini API 使用 OpenAI 兼容格式
    this.model = model;
    this.llm = new ChatOpenAI({
      model: this.model,
      apiKey,
      temperature: 0,
      streaming: true,
      configuration: {
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      },
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
