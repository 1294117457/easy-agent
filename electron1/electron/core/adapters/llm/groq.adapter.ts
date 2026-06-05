import { ChatOpenAI } from '@langchain/openai';
import type { BaseMessage } from '@langchain/core/messages';
import type { ILLMPort, LLMResponse } from '../../ports/llm.port.js';

export class GroqAdapter implements ILLMPort {
  readonly provider = 'groq';
  model: string;
  private llm: ChatOpenAI;

  constructor(model: string, apiKey: string) {
    this.model = model;
    console.log('[GroqAdapter] 初始化, model:', model);
    this.llm = new ChatOpenAI({
      model: this.model,
      apiKey,
      temperature: 0,
      streaming: true,
      configuration: {
        baseURL: 'https://api.groq.com/openai/v1',
      },
    });
  }

  async invoke(messages: BaseMessage[]): Promise<LLMResponse> {
    console.log('[GroqAdapter] invoke 调用');
    const result = await this.llm.invoke(messages);
    console.log('[GroqAdapter] invoke 返回:', result.content.substring(0, 100));
    return { content: result.content as string };
  }

  async invokeStream(
    messages: BaseMessage[],
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse> {
    console.log('[GroqAdapter] invokeStream 开始, messages:', messages.length);
    const stream = await this.llm.stream(messages);
    let full = '';
    let chunkCount = 0;
    for await (const chunk of stream) {
      chunkCount++;
      const content = chunk.content as string;
      full += content;
      if (chunkCount <= 5) {
        console.log('[GroqAdapter] chunk', chunkCount, ':', JSON.stringify(content));
      }
      onChunk(content);
    }
    console.log('[GroqAdapter] invokeStream 完成, chunk数:', chunkCount, '总长度:', full.length);
    return { content: full };
  }
}
