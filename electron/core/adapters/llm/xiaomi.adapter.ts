import { ChatOpenAI } from '@langchain/openai';
import type { BaseMessage } from '@langchain/core/messages';
import type { ILLMPort, LLMResponse } from '../../ports/llm.port.js';

export class XiaomiAdapter implements ILLMPort {
  readonly provider = 'xiaomi';
  model: string;
  private llm: ChatOpenAI;

  constructor(model: string, apiKey: string, baseURL?: string) {
    this.model = model;
    this.llm = new ChatOpenAI({
      model: this.model,
      apiKey,
      temperature: 0,
      streaming: true,
      configuration: {
        // 小米使用阿里云百炼 API
        baseURL: baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
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
