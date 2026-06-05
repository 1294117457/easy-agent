import { v4 as uuidv4 } from 'uuid';
import type { Message as MessageEntity, MessageRole } from '../types.js';
import { Message } from './Message.js';

export interface ConversationProps {
  id?: string;
  name?: string;
  workflowId?: string;
  summary?: string;
  createdAt?: string;
  updatedAt?: string;
  endedAt?: string;
  messages?: Message[];
}

export enum ConversationStatus {
  Idle = 'idle',
  Loading = 'loading',
  Completed = 'completed',
}

export interface ConversationJSON {
  id: string;
  name: string;
  workflowId?: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
  status: ConversationStatus;
  messageCount: number;
}

export class Conversation {
  public readonly id: string;
  public name: string;
  public readonly workflowId?: string;
  public summary?: string;
  public readonly createdAt: string;
  public updatedAt: string;
  public endedAt?: string;
  public status: ConversationStatus;

  private _messages: Message[] = [];

  constructor(props: ConversationProps) {
    this.id = props.id || uuidv4();
    this.name = props.name || '新对话';
    this.workflowId = props.workflowId;
    this.summary = props.summary;
    this.createdAt = props.createdAt || new Date().toISOString();
    this.updatedAt = props.updatedAt || new Date().toISOString();
    this.endedAt = props.endedAt;
    this.status = props.endedAt ? ConversationStatus.Completed : ConversationStatus.Idle;
    this._messages = props.messages || [];
  }

  /**
   * 创建新对话
   */
  static create(name?: string, workflowId?: string): Conversation {
    return new Conversation({
      name: name || '新对话',
      workflowId,
    });
  }

  /**
   * 从数据库数据恢复对话
   */
  static fromStorage(data: {
    id: string;
    name: string;
    workflowId?: string;
    summary?: string;
    createdAt: string;
    updatedAt: string;
    endedAt?: string;
    messages?: MessageEntity[];
  }): Conversation {
    const messages = (data.messages || []).map((m) => new Message({
      id: m.id,
      conversationId: m.conversationId,
      role: m.role,
      content: m.content,
      model: m.model,
      createdAt: m.createdAt,
      isCompressed: m.isCompressed,
    }));

    return new Conversation({
      ...data,
      messages,
    });
  }

  /**
   * 从 JSON 创建
   */
  static fromJSON(json: ConversationJSON, messages?: Message[]): Conversation {
    const conv = new Conversation({
      id: json.id,
      name: json.name,
      workflowId: json.workflowId,
      summary: json.summary,
      createdAt: json.createdAt,
      updatedAt: json.updatedAt,
      endedAt: json.endedAt,
      messages,
    });
    if (json.status === ConversationStatus.Loading) {
      conv.status = ConversationStatus.Loading;
    }
    return conv;
  }

  /**
   * 添加用户消息
   */
  addUserMessage(content: string): Message {
    const message = Message.createUser(this.id, content);
    this._messages.push(message);
    this.touch();
    return message;
  }

  /**
   * 添加助手消息
   */
  addAssistantMessage(content: string, model?: string): Message {
    const message = Message.createAssistant(this.id, content, model);
    this._messages.push(message);
    this.touch();
    return message;
  }

  /**
   * 获取消息历史
   */
  getHistory(limit?: number): Message[] {
    const history = this._messages.filter((m) => !m.isSummary());
    if (limit) {
      return history.slice(-limit);
    }
    return [...history];
  }

  /**
   * 获取用户消息
   */
  getUserMessages(): Message[] {
    return this._messages.filter((m) => m.isUser());
  }

  /**
   * 获取助手消息
   */
  getAssistantMessages(): Message[] {
    return this._messages.filter((m) => m.isAssistant());
  }

  /**
   * 获取第一条用户消息（用于生成标题）
   */
  getFirstUserMessage(): Message | undefined {
    return this.getUserMessages()[0];
  }

  /**
   * 获取最后一条消息
   */
  getLastMessage(): Message | undefined {
    return this._messages[this._messages.length - 1];
  }

  /**
   * 获取消息数量
   */
  getMessageCount(): number {
    return this._messages.filter((m) => !m.isSummary()).length;
  }

  /**
   * 检查是否为空对话
   */
  isEmpty(): boolean {
    return this._messages.length === 0;
  }

  /**
   * 检查是否已结束
   */
  isEnded(): boolean {
    return !!this.endedAt;
  }

  /**
   * 检查是否正在加载
   */
  isLoading(): boolean {
    return this.status === ConversationStatus.Loading;
  }

  /**
   * 设置加载状态
   */
  startLoading(): void {
    this.status = ConversationStatus.Loading;
  }

  /**
   * 结束加载状态
   */
  stopLoading(): void {
    this.status = ConversationStatus.Idle;
  }

  /**
   * 结束对话
   */
  end(title?: string): void {
    this.endedAt = new Date().toISOString();
    this.status = ConversationStatus.Completed;
    this.updatedAt = this.endedAt;
    if (title) {
      this.name = title;
    }
  }

  /**
   * 压缩对话，生成摘要
   */
  compress(summary: string): void {
    // 保留第一条用户消息
    const firstUserMsg = this.getFirstUserMessage();
    this._messages = [];

    if (firstUserMsg) {
      // 将第一条用户消息压缩为摘要
      const summaryMessage = new Message({
        conversationId: this.id,
        role: 'user',
        content: `[对话摘要] ${summary}`,
      });
      summaryMessage.compress(summary);
      this._messages.push(summaryMessage);
    }

    this.summary = summary;
    this.touch();
  }

  /**
   * 更新标题
   */
  rename(name: string): void {
    this.name = name;
    this.touch();
  }

  /**
   * 刷新更新时间
   */
  touch(): void {
    this.updatedAt = new Date().toISOString();
  }

  /**
   * 设置消息列表
   */
  setMessages(messages: Message[]): void {
    this._messages = messages;
  }

  // ============ 序列化方法 ============

  toJSON(): ConversationJSON {
    return {
      id: this.id,
      name: this.name,
      workflowId: this.workflowId,
      summary: this.summary,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      endedAt: this.endedAt,
      status: this.status,
      messageCount: this.getMessageCount(),
    };
  }

  /**
   * 转换为纯对象
   */
  toPlainObject(): {
    id: string;
    name: string;
    workflowId?: string;
    summary?: string;
    createdAt: string;
    updatedAt: string;
    endedAt?: string;
    status: ConversationStatus;
    messageCount: number;
  } {
    return this.toJSON();
  }
}
