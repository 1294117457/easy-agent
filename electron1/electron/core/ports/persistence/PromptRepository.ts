import type { Prompt } from '../../domain/entities/Prompt.js';

export interface PromptRepository {
  save(prompt: Prompt): Promise<void>;
  findById(id: string): Promise<Prompt | null>;
  findAll(): Promise<Prompt[]>;
  findActive(): Promise<Prompt | null>;
  delete(id: string): Promise<boolean>;
  deactivateAll(): Promise<void>;
  setActive(id: string): Promise<void>;
}
