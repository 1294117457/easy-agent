import { v4 as uuidv4 } from 'uuid';

export interface PromptProps {
  id?: string;
  name: string;
  description?: string;
  systemPrompt: string;
  isBuiltin?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PromptJSON {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  isBuiltin: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export class Prompt {
  public readonly id: string;
  public name: string;
  public description?: string;
  public systemPrompt: string;
  public readonly isBuiltin: boolean;
  public isActive: boolean;
  public readonly createdAt: string;
  public updatedAt: string;

  constructor(props: PromptProps) {
    this.id = props.id || uuidv4();
    this.name = props.name;
    this.description = props.description;
    this.systemPrompt = props.systemPrompt;
    this.isBuiltin = props.isBuiltin ?? false;
    this.isActive = props.isActive ?? false;
    this.createdAt = props.createdAt || new Date().toISOString();
    this.updatedAt = props.updatedAt || new Date().toISOString();
  }

  // ============ 静态工厂方法 ============

  static create(name: string, systemPrompt: string, description?: string): Prompt {
    return new Prompt({ name, systemPrompt, description });
  }

  static builtin(name: string, systemPrompt: string, description?: string): Prompt {
    return new Prompt({ name, systemPrompt, description, isBuiltin: true });
  }

  static fromJSON(json: PromptJSON): Prompt {
    return new Prompt({
      id: json.id,
      name: json.name,
      description: json.description,
      systemPrompt: json.systemPrompt,
      isBuiltin: json.isBuiltin,
      isActive: json.isActive,
      createdAt: json.createdAt,
      updatedAt: json.updatedAt,
    });
  }

  // ============ 业务方法 ============

  activate(): void {
    this.isActive = true;
    this.touch();
  }

  deactivate(): void {
    this.isActive = false;
    this.touch();
  }

  updateContent(systemPrompt: string): void {
    this.systemPrompt = systemPrompt;
    this.touch();
  }

  rename(newName: string): void {
    this.name = newName;
    this.touch();
  }

  setDescription(description: string): void {
    this.description = description;
    this.touch();
  }

  private touch(): void {
    this.updatedAt = new Date().toISOString();
  }

  // ============ 序列化 ============

  toJSON(): PromptJSON {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      systemPrompt: this.systemPrompt,
      isBuiltin: this.isBuiltin,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
