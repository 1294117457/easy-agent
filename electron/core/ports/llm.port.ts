import type { BaseMessage } from '@langchain/core/messages';

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ILLMPort {
  readonly provider: string;
  readonly model: string;
  invoke(messages: BaseMessage[]): Promise<LLMResponse>;
  invokeStream(
    messages: BaseMessage[],
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse>;
}
