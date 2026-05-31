import type { McpServer } from '../../domain/entities/McpServer.js';

export interface McpServerRepository {
  save(server: McpServer): Promise<void>;
  saveMany(servers: McpServer[]): Promise<void>;
  findById(id: string): Promise<McpServer | null>;
  findAll(): Promise<McpServer[]>;
  findConnected(): Promise<McpServer[]>;
  delete(id: string): Promise<void>;
}
