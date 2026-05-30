import { v4 as uuidv4 } from 'uuid';
import type { MessageRole } from '../types.js';

export interface MessageProps {
  id?: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  model?: string;
  createdAt?: string;
  isCompressed?: boolean;
}

export class Message {
  public readonly id: string;
  public readonly conversationId: string;
  public readonly role: MessageRole;
  public readonly content: string;
  public readonly model?: string;
  public readonly createdAt: string;
  public isCompressed: boolean;

  constructor(props: MessageProps) {
    this.id = props.id || uuidv4();
    this.conversationId = props.conversationId;
    this.role = props.role;
    this.content = props.content;
    this.model = props.model;
    this.createdAt = props.createdAt || new Date().toISOString();
    this.isCompressed = props.isCompressed || false;
  }

  /**
   * 创建用户消息
   */
  static createUser(conversationId: string, content: string): Message {
    return new Message({
      conversationId,
      role: 'user',
      content,
    });
  }

  /**
   * 创建助手消息
   */
  static createAssistant(conversationId: string, content: string, model?: string): Message {
    return new Message({
      conversationId,
      role: 'assistant',
      content,
      model,
    });
  }

  /**
   * 标记消息为已压缩
   */
  compress(summary: string): void {
    this.content = summary;
    this.isCompressed = true;
  }

  /**
   * 判断是否为用户消息
   */
  isUser(): boolean {
    return this.role === 'user';
  }

  /**
   * 判断是否为助手消息
   */
  isAssistant(): boolean {
    return this.role === 'assistant';
  }

  /**
   * 判断是否为压缩消息
   */
  isSummary(): boolean {
    return this.isCompressed;
  }

  /**
   * 转换为纯对象
   */
  toPlainObject(): MessageProps {
    return {
      id: this.id,
      conversationId: this.conversationId,
      role: this.role,
      content: this.content,
      model: this.model,
      createdAt: this.createdAt,
      isCompressed: this.isCompressed,
    };
  }
}
