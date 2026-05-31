import { v4 as uuidv4 } from 'uuid';

export interface ApiKeyProps {
  id?: string;
  provider: string;
  model: string;
  baseURL?: string;
  enabled?: boolean;
  createdAt?: string;
}

export interface ApiKeyJSON {
  id: string;
  provider: string;
  model: string;
  baseURL?: string;
  enabled: boolean;
  createdAt: string;
}

export class ApiKey {
  public readonly id: string;
  public readonly provider: string;
  public readonly model: string;
  public readonly baseURL?: string;
  public enabled: boolean;
  public readonly createdAt: string;

  constructor(props: ApiKeyProps) {
    this.id = props.id || uuidv4();
    this.provider = props.provider;
    this.model = props.model;
    this.baseURL = props.baseURL;
    this.enabled = props.enabled ?? true;
    this.createdAt = props.createdAt || new Date().toISOString();
  }

  // ============ 静态工厂方法 ============

  static create(provider: string, model: string, baseURL?: string): ApiKey {
    return new ApiKey({ provider, model, baseURL, enabled: true });
  }

  static fromJSON(json: ApiKeyJSON): ApiKey {
    return new ApiKey({
      id: json.id,
      provider: json.provider,
      model: json.model,
      baseURL: json.baseURL,
      enabled: json.enabled,
      createdAt: json.createdAt,
    });
  }

  // ============ 业务方法 ============

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // ============ 序列化 ============

  toJSON(): ApiKeyJSON {
    return {
      id: this.id,
      provider: this.provider,
      model: this.model,
      baseURL: this.baseURL,
      enabled: this.enabled,
      createdAt: this.createdAt,
    };
  }
}
