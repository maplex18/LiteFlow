import { getClientConfig, getClientConfigSync } from "../config/client";
import {
  ACCESS_CODE_PREFIX,
  ModelProvider,
  ServiceProvider,
} from "../constant";
import {
  ChatMessageTool,
  ChatMessage,
  ModelType,
  useAccessStore,
  useChatStore,
} from "../store";
import { ChatGPTApi, DalleRequestPayload } from "./platforms/openai";
import { GeminiProApi } from "./platforms/google";
import { ClaudeApi } from "./platforms/anthropic";
// import { ErnieApi } from "./platforms/baidu";
import { DoubaoApi } from "./platforms/bytedance";
import { HunyuanApi } from "./platforms/tencent";
import { MoonshotApi } from "./platforms/moonshot";
import { SparkApi } from "./platforms/iflytek";
import { XAIApi } from "./platforms/xai";
import { ChatGLMApi } from "./platforms/glm";
import { fetch as tauriStreamFetch } from "../utils/stream";
import { VISION_MODEL_REGEXES, EXCLUDE_VISION_MODEL_REGEXES } from "../constant";
import { safeLocalStorage } from "../utils";

export const ROLES = ["system", "user", "assistant"] as const;
export type MessageRole = (typeof ROLES)[number];

export const Models = ["gpt-3.5-turbo", "gpt-4"] as const;
export const TTSModels = ["tts-1", "tts-1-hd"] as const;
export type ChatModel = ModelType;

export interface MultimodalContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string;
  };
}

export interface RequestMessage {
  role: MessageRole;
  content: string | MultimodalContent[];
}

export interface LLMConfig {
  model: string;
  providerName?: string;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  presence_penalty?: number;
  frequency_penalty?: number;
  size?: DalleRequestPayload["size"];
  quality?: DalleRequestPayload["quality"];
  style?: DalleRequestPayload["style"];
}

export interface SpeechOptions {
  model: string;
  input: string;
  voice: string;
  response_format?: string;
  speed?: number;
  onController?: (controller: AbortController) => void;
}

export interface ChatOptions {
  messages: RequestMessage[];
  config: LLMConfig;

  onUpdate?: (message: string, chunk: string) => void;
  onFinish: (message: string, responseRes: Response) => void;
  onError?: (err: Error) => void;
  onController?: (controller: AbortController) => void;
  onBeforeTool?: (tool: ChatMessageTool) => void;
  onAfterTool?: (tool: ChatMessageTool) => void;
}

export interface LLMUsage {
  used: number;
  total: number;
}

export interface LLMModel {
  name: string;
  displayName?: string;
  available: boolean;
  provider: LLMModelProvider;
  sorted: number;
}

export interface LLMModelProvider {
  id: string;
  providerName: string;
  providerType: string;
  sorted: number;
}

export abstract class LLMApi {
  abstract chat(options: ChatOptions): Promise<void>;
  abstract speech(options: SpeechOptions): Promise<ArrayBuffer>;
  abstract usage(): Promise<LLMUsage>;
  abstract models(): Promise<LLMModel[]>;
}

type ProviderName = "openai" | "azure" | "claude" | "palm";

interface Model {
  name: string;
  provider: ProviderName;
  ctxlen: number;
}

interface ChatProvider {
  name: ProviderName;
  apiConfig: {
    baseUrl: string;
    apiKey: string;
    summaryModel: Model;
  };
  models: Model[];

  chat: () => void;
  usage: () => void;
}

export class ClientApi {
  public llm: LLMApi;

  constructor(provider: ModelProvider = ModelProvider.GPT) {
    switch (provider) {
      case ModelProvider.GeminiPro:
        this.llm = new GeminiProApi();
        break;
      case ModelProvider.Claude:
        this.llm = new ClaudeApi();
        break;
      case ModelProvider.Doubao:
        this.llm = new DoubaoApi();
        break;
      case ModelProvider.Hunyuan:
        this.llm = new HunyuanApi();
        break;
      case ModelProvider.Moonshot:
        this.llm = new MoonshotApi();
        break;
      case ModelProvider.Iflytek:
        this.llm = new SparkApi();
        break;
      case ModelProvider.XAI:
        this.llm = new XAIApi();
        break;
      case ModelProvider.ChatGLM:
        this.llm = new ChatGLMApi();
        break;
      default:
        this.llm = new ChatGPTApi();
    }
  }

  config() {}

  prompts() {}

  masks() {}

  async share(messages: ChatMessage[], avatarUrl: string | null = null) {
    const msgs = messages
      .map((m) => ({
        from: m.role === "user" ? "human" : "gpt",
        value: m.content,
      }))
      .concat([
        {
          from: "human",
          value:
            "Share from [NextChat]: https://github.com/Yidadaa/ChatGPT-Next-Web",
        },
      ]);
    // 敬告二开开发者们，为了开源大模型的发展，请不要修改上述消息，此消息用于后续数据清洗使用
    // Please do not modify this message

    console.log("[Share]", messages, msgs);
    try {
      const isApp = getClientConfigSync("isApp", false);
      const proxyUrl = "/sharegpt";
      const rawUrl = "https://sharegpt.com/api/conversations";
      const shareUrl = isApp ? rawUrl : proxyUrl;
      const res = await fetch(shareUrl, {
        body: JSON.stringify({
          avatarUrl,
          items: msgs,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const resJson = await res.json();
      console.log("[Share]", resJson);
      if (resJson.id) {
        return `https://shareg.pt/${resJson.id}`;
      }
    } catch (error) {
      console.error("[Share] Failed:", error);
    }
  }
}

export function getBearerToken(
  apiKey: string,
  noBearer: boolean = false,
): string {
  return validString(apiKey)
    ? `${noBearer ? "" : "Bearer "}${apiKey.trim()}`
    : "";
}

export function validString(x: string): boolean {
  return x?.length > 0;
}

export function getHeaders(ignoreHeaders: boolean = false) {
  const accessStore = useAccessStore.getState();
  const chatStore = useChatStore.getState();
  let headers: Record<string, string> = {};
  if (!ignoreHeaders) {
    headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  // Use synchronous client config instead of async
  try {
    // We don't need any specific config value here, just checking if we can access it
    getClientConfigSync("isApp", false);
  } catch (error) {
    console.error("[Headers] Failed to get client config:", error);
  }

  function getConfig() {
    const modelConfig = chatStore.currentSession().mask.modelConfig;
    const isGoogle = modelConfig.providerName === ServiceProvider.Google;
    const isAzure = modelConfig.providerName === ServiceProvider.Azure;
    const isAnthropic = modelConfig.providerName === ServiceProvider.Anthropic;
    // const isBaidu = modelConfig.providerName == ServiceProvider.Baidu;
    // const isByteDance = modelConfig.providerName === ServiceProvider.ByteDance;
    // const isMoonshot = modelConfig.providerName === ServiceProvider.Moonshot;
    // const isIflytek = modelConfig.providerName === ServiceProvider.Iflytek;
    // const isXAI = modelConfig.providerName === ServiceProvider.XAI;
    // const isChatGLM = modelConfig.providerName === ServiceProvider.ChatGLM;
    const isEnabledAccessControl = accessStore.enabledAccessControl();
    const apiKey = isGoogle
      ? accessStore.googleApiKey
      : isAzure
      ? accessStore.azureApiKey
      : isAnthropic
      ? accessStore.anthropicApiKey
      // : isByteDance
      // ? accessStore.bytedanceApiKey
      // : isMoonshot
      // ? accessStore.moonshotApiKey
      // : isXAI
      // ? accessStore.xaiApiKey
      // : isChatGLM
      // ? accessStore.chatglmApiKey
      // : isIflytek
      // ? accessStore.iflytekApiKey && accessStore.iflytekApiSecret
      //   ? accessStore.iflytekApiKey + ":" + accessStore.iflytekApiSecret
        // : ""
      : accessStore.openaiApiKey;
    return {
      isGoogle,
      isAzure,
      isAnthropic,
      // isBaidu,
      // isByteDance,
      // isMoonshot,
      // isIflytek,
      // isXAI,
      // isChatGLM,
      apiKey,
      isEnabledAccessControl,
    };
  }

  function getAuthHeader(): string {
    return isAzure
      ? "api-key"
      : isAnthropic
      ? "x-api-key"
      : isGoogle
      ? "x-goog-api-key"
      : "Authorization";
  }

  const {
    isGoogle,
    isAzure,
    isAnthropic,
    // isBaidu,
    apiKey,
    isEnabledAccessControl,
  } = getConfig();
  // when using baidu api in app, not set auth header
  // if (isBaidu && clientConfig?.isApp) return headers;

  const authHeader = getAuthHeader();

  const bearerToken = getBearerToken(
    apiKey,
    isAzure || isAnthropic || isGoogle,
  );

  if (bearerToken) {
    headers[authHeader] = bearerToken;
  } else if (isEnabledAccessControl && validString(accessStore.accessCode)) {
    headers["Authorization"] = getBearerToken(
      ACCESS_CODE_PREFIX + accessStore.accessCode,
    );
  }

  return headers;
}

export function getClientApi(provider: ServiceProvider): ClientApi {
  switch (provider) {
    case ServiceProvider.Google:
      return new ClientApi(ModelProvider.GeminiPro);
    case ServiceProvider.Anthropic:
      return new ClientApi(ModelProvider.Claude);
    // case ServiceProvider.ByteDance:
    //   return new ClientApi(ModelProvider.Doubao);
    // case ServiceProvider.Tencent:
    //   return new ClientApi(ModelProvider.Hunyuan);
    // case ServiceProvider.Moonshot:
    //   return new ClientApi(ModelProvider.Moonshot);
    // case ServiceProvider.Iflytek:
    //   return new ClientApi(ModelProvider.Iflytek);
    // case ServiceProvider.XAI:
    //   return new ClientApi(ModelProvider.XAI);
    // case ServiceProvider.ChatGLM:
    //   return new ClientApi(ModelProvider.ChatGLM);
    default:
      return new ClientApi(ModelProvider.GPT);
  }
}

// Admin API Functions
export async function fetchOpenAiUsage(timestamp?: number, startDate?: string, endDate?: string) {
  try {
    const storage = safeLocalStorage();
    const token = storage.getItem('token');
    
    if (!token) {
      console.error('[API] fetchOpenAiUsage - No auth token found');
      return Response.json({ error: 'No auth token found' }, { status: 401 });
    }
    
    let cacheParam = timestamp ? `?t=${timestamp}` : '?t=' + Date.now();
    if (startDate && endDate) {
      cacheParam += `&start_date=${startDate}&end_date=${endDate}`;
    }
    
    console.log(`[API] Fetching OpenAI usage with dates: ${startDate} to ${endDate}`);
    
    const response = await fetch(`/api/admin/openai-usage${cacheParam}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      console.error(`[API] Failed to fetch OpenAI usage: ${response.status} ${response.statusText}`);
      if (response.status === 401) {
        console.error('[API] Unauthorized - token may be invalid or expired');
        // 可以在這裡觸發重定向到登錄頁面
      }
    }
    
    return response;
  } catch (error) {
    console.error('[API] Error fetching OpenAI usage:', error);
    return Response.json({ error: 'Failed to fetch OpenAI usage' }, { status: 500 });
  }
}

export async function getOpenAiCost(timestamp?: number, startDate?: string, endDate?: string) {
  try {
    const storage = safeLocalStorage();
    const token = storage.getItem('token');
    
    if (!token) {
      console.error('[API] getOpenAiCost - No auth token found');
      return Response.json({ error: 'No auth token found' }, { status: 401 });
    }
    
    let cacheParam = timestamp ? `?t=${timestamp}` : '?t=' + Date.now();
    if (startDate && endDate) {
      cacheParam += `&start_date=${startDate}&end_date=${endDate}`;
    }
    
    console.log(`[API] Fetching OpenAI costs with dates: ${startDate} to ${endDate}`);
    
    const response = await fetch(`/api/admin/openai-costs${cacheParam}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      console.error(`[API] Failed to fetch OpenAI costs: ${response.status} ${response.statusText}`);
      if (response.status === 401) {
        console.error('[API] Unauthorized - token may be invalid or expired');
      }
    }
    
    return response;
  } catch (error) {
    console.error('[API] Error fetching OpenAI cost:', error);
    return Response.json({ error: 'Failed to fetch OpenAI cost' }, { status: 500 });
  }
}

export async function getUserList(timestamp?: number) {
  try {
    const storage = safeLocalStorage();
    const token = storage.getItem('token');
    
    if (!token) {
      console.error('[API] getUserList - No auth token found');
      return Response.json({ error: 'No auth token found' }, { status: 401 });
    }
    
    const cacheParam = timestamp ? `?t=${timestamp}` : '';
    
    console.log('[API] Fetching user list');
    
    const response = await fetch(`/api/admin/users${cacheParam}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      console.error(`[API] Failed to fetch user list: ${response.status} ${response.statusText}`);
      if (response.status === 401) {
        console.error('[API] Unauthorized - token may be invalid or expired');
      }
    }
    
    return response;
  } catch (error) {
    console.error('[API] Error fetching user list:', error);
    return Response.json({ error: 'Failed to fetch user list' }, { status: 500 });
  }
}

export async function deleteUser(userId: number) {
  try {
    const storage = safeLocalStorage();
    const token = storage.getItem('token');
    
    if (!token) {
      console.error('[API] deleteUser - No auth token found');
      throw new Error('No auth token found');
    }
    
    console.log(`[API] Deleting user: ${userId}`);
    
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      console.error(`[API] Failed to delete user: ${response.status} ${response.statusText}`);
      if (response.status === 401) {
        console.error('[API] Unauthorized - token may be invalid or expired');
      }
    }
    
    return response;
  } catch (error) {
    console.error('[API] Error deleting user:', error);
    throw error;
  }
}

export async function changeUserPassword(userId: number, newPassword: string) {
  try {
    const storage = safeLocalStorage();
    const token = storage.getItem('token');
    
    if (!token) {
      console.error('[API] changeUserPassword - No auth token found');
      throw new Error('No auth token found');
    }
    
    console.log(`[API] Changing password for user: ${userId}`);
    
    const response = await fetch(`/api/admin/users/${userId}/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ newPassword })
    });
    
    if (!response.ok) {
      console.error(`[API] Failed to change user password: ${response.status} ${response.statusText}`);
      if (response.status === 401) {
        console.error('[API] Unauthorized - token may be invalid or expired');
      }
    }
    
    return response;
  } catch (error) {
    console.error('[API] Error changing user password:', error);
    throw error;
  }
}

