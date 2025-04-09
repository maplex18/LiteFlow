// This file is deprecated as Baidu functionality has been removed
import { LLMApi, LLMUsage, LLMModel, ChatOptions } from "../api";

export class ErnieApi implements LLMApi {
  async chat(options: ChatOptions): Promise<void> {
    throw new Error("Baidu API is no longer supported");
  }

  async speech(): Promise<ArrayBuffer> {
    throw new Error("Baidu API is no longer supported");
  }

  async usage(): Promise<LLMUsage> {
    return {
      used: 0,
      total: 0,
    };
  }

  async models(): Promise<LLMModel[]> {
    return [];
  }
}
