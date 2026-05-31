export interface Plugin {
  id: string;
  name: string;
  description: string;
  serverId: string;
  toolNames: string[];
  createdAt: string;
  updatedAt: string;
}

export type CreatePluginDTO = Omit<Plugin, 'id' | 'createdAt' | 'updatedAt'>;

export interface StandardSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description?: string;
    required?: boolean;
    default?: unknown;
  }>;
  required?: string[];
}
