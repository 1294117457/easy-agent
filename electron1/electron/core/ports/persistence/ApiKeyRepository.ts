import type { ApiKey } from '../../domain/entities/ApiKey.js';

export interface ApiKeyRepository {
  save(apiKey: ApiKey, encryptedKey: string): Promise<void>;
  findById(id: string): Promise<ApiKey | null>;
  findAll(): Promise<ApiKey[]>;
  findEnabled(): Promise<ApiKey[]>;
  findByProvider(provider: string): Promise<ApiKey[]>;
  delete(id: string): Promise<boolean>;
  getDecryptedKey(id: string): Promise<string | null>;
}
