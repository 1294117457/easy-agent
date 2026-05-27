import type { IpcMain } from 'electron';
import type { IStoragePort } from '../core/index.js';
import type { EasyAgentCore } from '../core/index.js';
import { OpenAIAdapter } from '../core/adapters/llm/openai.adapter.js';
import { ClaudeAdapter } from '../core/adapters/llm/claude.adapter.js';
import { QwenAdapter } from '../core/adapters/llm/qwen.adapter.js';
import { GroqAdapter } from '../core/adapters/llm/groq.adapter.js';
import { DeepSeekAdapter } from '../core/adapters/llm/deepseek.adapter.js';
import { GeminiAdapter } from '../core/adapters/llm/gemini.adapter.js';
import { XiaomiAdapter } from '../core/adapters/llm/xiaomi.adapter.js';
import type { BaseMessage } from '@langchain/core/messages';

export function registerConfigHandlers(
  ipcMain: IpcMain,
  storage: IStoragePort,
  core?: EasyAgentCore
) {
  // 获取配置
  ipcMain.handle('config:get', () => {
    return {
      apiKeys: storage.listApiKeys(),
      prompts: storage.listPrompts(),
      llmConfig: core?.getLLMManager().getActiveConfig() || null,
    };
  });

  // API Key CRUD
  ipcMain.handle('config:apiKey:create', (_, data) => {
    return storage.createApiKey(data);
  });

  ipcMain.handle('config:apiKey:delete', (_, id) => {
    return storage.deleteApiKey(id);
  });

  // Prompt CRUD
  ipcMain.handle('config:prompt:create', (_, data) => {
    return storage.createPrompt(data);
  });

  ipcMain.handle('config:prompt:delete', (_, id) => {
    return storage.deletePrompt(id);
  });

  // 设置/获取激活的 Prompt
  ipcMain.handle('config:prompt:setActive', (_, id: string) => {
    storage.setActivePrompt(id);
    return true;
  });

  ipcMain.handle('config:prompt:getActive', () => {
    return storage.getActivePrompt();
  });

  // ========== LLM 相关 handlers ==========

  // 设置当前使用的 API Key
  ipcMain.handle('config:llm:setActiveKey', (_, keyId: string) => {
    if (core) {
      core.reloadLLM(keyId);
    }
    return true;
  });

  // 获取 LLM 配置
  ipcMain.handle('config:llm:getActiveConfig', () => {
    if (core) {
      return core.getLLMManager().getActiveConfig();
    }
    return null;
  });

  // 获取支持的 Provider 列表
  ipcMain.handle('config:llm:listProviders', () => {
    return [
      {
        id: 'openai',
        name: 'OpenAI',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      },
      {
        id: 'anthropic',
        name: 'Claude',
        models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-3-20250714'],
      },
      {
        id: 'qwen',
        name: 'Qwen (千问)',
        models: [
          'qwen-turbo',
          'qwen-plus',
          'qwen-plus-latest',
          'qwen-max',
          'qwen-max-latest',
          'qwen2.5-72b-instruct',
          'qwen2.5-coder-32b-instruct',
        ],
      },
      {
        id: 'groq',
        name: 'Groq (免费)',
        models: [
          'llama-3.1-8b-instant',
          'llama-3.2-1b-preview',
          'llama-3.2-3b-preview',
          'mixtral-8x7b-32768',
          'gemma2-9b-it',
        ],
      },
      {
        id: 'deepseek',
        name: 'DeepSeek',
        models: ['deepseek-chat', 'deepseek-coder'],
      },
      {
        id: 'gemini',
        name: 'Gemini (Google)',
        models: [
          'gemini-1.5-pro',
          'gemini-1.5-flash',
          'gemini-1.5-flash-8b',
          'gemini-2.0-flash',
        ],
      },
      {
        id: 'xiaomi',
        name: 'Xiaomi (小爱)',
        models: [
          'mihoYO-sFT-70B',
          'mihoYO-sFT-7B',
        ],
      },
    ];
  });

  // 测试连接
  ipcMain.handle('config:llm:testConnection', async (_, data) => {
    try {
      let adapter: BaseMessage[];

      if (data.provider === 'openai') {
        adapter = new OpenAIAdapter(data.model, data.apiKey);
      } else if (data.provider === 'anthropic') {
        adapter = new ClaudeAdapter(data.model, data.apiKey);
      } else if (data.provider === 'qwen') {
        adapter = new QwenAdapter(data.model, data.apiKey, data.baseURL);
      } else if (data.provider === 'groq') {
        adapter = new GroqAdapter(data.model, data.apiKey);
      } else if (data.provider === 'deepseek') {
        adapter = new DeepSeekAdapter(data.model, data.apiKey);
      } else if (data.provider === 'gemini') {
        adapter = new GeminiAdapter(data.model, data.apiKey);
      } else if (data.provider === 'xiaomi') {
        adapter = new XiaomiAdapter(data.model, data.apiKey, data.baseURL);
      } else {
        return { success: false, error: `Unsupported provider: ${data.provider}` };
      }

      // 创建一个简单的测试消息
      const { HumanMessage } = await import('@langchain/core/messages');
      const testMessage = new HumanMessage('Hello');
      await (adapter as any).invoke([testMessage]);
      return { success: true };
    } catch (error: unknown) {
      // 提取错误信息
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String((error as { message: unknown }).message);
      }
      return { success: false, error: errorMessage };
    }
  });
}
