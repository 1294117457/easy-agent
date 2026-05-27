import { HumanMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { ILLMPort } from '../ports/llm.port.js';
import type { IStoragePort } from '../ports/storage.port.js';
import type { Message } from '../domain/types.js';

export interface CompressionResult {
  summary: string;
  title: string;
}

export class CompressionService {
  constructor(
    private storage: IStoragePort,
    private llm: ILLMPort
  ) {}

  /**
   * 检查是否需要压缩（每20轮压缩一次）
   */
  shouldCompress(conversationId: string): boolean {
    const count = this.storage.getMessageCount(conversationId);
    return count > 0 && count % 20 === 0;
  }

  /**
   * 压缩对话
   * 1. 获取所有消息
   * 2. 调用 LLM 生成摘要
   * 3. 保留最后10条消息，其余标记为已压缩
   */
  async compressConversation(conversationId: string): Promise<CompressionResult | null> {
    const messages = this.storage.getMessages(conversationId);
    if (messages.length < 12) return null;

    // 提取最近的消息（保留最后10条 = 最近5轮对话）
    const recentMessages = messages.slice(-10);
    const historicMessages = messages.slice(0, -10);

    // 构造压缩提示
    const summaryPrompt = this.buildSummaryPrompt(historicMessages);
    let summaryResult: string;
    try {
      const result = await this.llm.invoke([new HumanMessage(summaryPrompt)]);
      summaryResult = result.content;
    } catch (error) {
      console.error('[CompressionService] 生成摘要失败:', error);
      summaryResult = this.buildAutoSummary(historicMessages);
    }

    // 解析结果
    const result = this.parseSummaryResult(summaryResult);

    // 更新数据库
    this.storage.compressConversation(conversationId, result.summary);

    // 标记历史消息为已压缩
    for (const msg of historicMessages) {
      this.storage.updateMessageCompressed(msg.id, true);
    }

    console.log('[CompressionService] 压缩完成，摘要:', result.summary);
    return result;
  }

  /**
   * 生成对话标题
   */
  async generateTitle(conversationId: string): Promise<string> {
    const messages = this.storage.getMessages(conversationId);
    const firstUserMessage = messages.find((m) => m.role === 'user');

    if (firstUserMessage) {
      const title = firstUserMessage.content.substring(0, 20);
      return title + (firstUserMessage.content.length > 20 ? '...' : '');
    }

    return '未命名对话';
  }

  /**
   * 结束对话（压缩 + 生成标题）
   */
  async endConversation(conversationId: string): Promise<void> {
    const messages = this.storage.getMessages(conversationId);

    // 1. 如果消息数 >= 20，执行压缩
    if (this.shouldCompress(conversationId)) {
      await this.compressConversation(conversationId);
    } else if (messages.length > 0) {
      // 即使不压缩，也生成简单摘要
      const summary = this.buildAutoSummary(messages);
      this.storage.compressConversation(conversationId, summary);
    }

    // 2. 生成标题
    const title = await this.generateTitle(conversationId);

    // 3. 标记对话结束
    this.storage.endConversation(conversationId, title);

    console.log('[CompressionService] 对话结束，标题:', title);
  }

  /**
   * 构建摘要生成提示
   */
  private buildSummaryPrompt(messages: Message[]): string {
    const content = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    return `请为以下对话生成一个简洁的摘要（不超过200字）和一个简短标题（不超过10字）。

格式要求：
摘要：<200字的对话摘要>
标题：<10字以内的标题>

对话内容：
${content}

请按以下格式返回：
摘要：<你的摘要>
标题：<你的标题>`;
  }

  /**
   * 解析摘要结果
   */
  private parseSummaryResult(result: string): CompressionResult {
    const summaryMatch = result.match(/摘要[：:]\s*(.+?)(?=标题|$)/s);
    const titleMatch = result.match(/标题[：:]\s*(.+?)(?=$)/s);

    return {
      summary: summaryMatch?.[1]?.trim() || '对话摘要',
      title: titleMatch?.[1]?.trim() || '未命名对话',
    };
  }

  /**
   * 自动生成摘要（不调用 LLM）
   */
  private buildAutoSummary(messages: Message[]): string {
    const userMessages = messages.filter((m) => m.role === 'user');
    const assistantMessages = messages.filter((m) => m.role === 'assistant');

    const topics = new Set<string>();
    userMessages.forEach((m) => {
      const words = m.content.split(/[\s,.，。!！?？]+/).slice(0, 5);
      words.forEach((w) => {
        if (w.length > 2) topics.add(w);
      });
    });

    return `共 ${userMessages.length} 轮对话，涉及 ${assistantMessages.length} 次回复。关键词：${Array.from(topics).slice(0, 5).join('、')}`;
  }
}
