import { ApiPath, Google, REQUEST_TIMEOUT_MS } from "@/app/constant";
import {
  ChatOptions,
  getHeaders,
  LLMApi,
  LLMModel,
  LLMUsage,
  SpeechOptions,
} from "../api";
import {
  useAccessStore,
  useAppConfig,
  useChatStore,
  usePluginStore,
  ChatMessageTool,
} from "@/app/store";
import { stream } from "@/app/utils/chat";
import { getClientConfig, getClientConfigSync } from "@/app/config/client";
import { GEMINI_BASE_URL } from "@/app/constant";
import { ServiceProvider } from "@/app/constant";

import {
  getMessageTextContent,
  getMessageImages,
  isVisionModel,
} from "@/app/utils";
import { preProcessImageContent } from "@/app/utils/chat";
import { nanoid } from "nanoid";
import { RequestPayload } from "./openai";
import { fetch } from "@/app/utils/stream";

export class GeminiProApi implements LLMApi {
  path(path: string, shouldStream = false): string {
    const accessStore = useAccessStore.getState();

    let baseUrl = "";
    if (accessStore.useCustomConfig) {
      baseUrl = accessStore.googleUrl;
    }

    // If baseUrl is not set, determine it based on the app environment
    if (baseUrl.length === 0) {
      try {
        const isApp = getClientConfigSync("isApp", false);
        baseUrl = isApp ? GEMINI_BASE_URL : ApiPath.Google;
      } catch (error) {
        console.error("[Google] Failed to get client config:", error);
        baseUrl = ApiPath.Google; // Default to API path if config fetch fails
      }
    }
    
    if (baseUrl.endsWith("/")) {
      baseUrl = baseUrl.slice(0, baseUrl.length - 1);
    }
    if (!baseUrl.startsWith("http") && !baseUrl.startsWith(ApiPath.Google)) {
      baseUrl = "https://" + baseUrl;
    }

    console.log("[Google Proxy Endpoint] ", baseUrl, path);

    let chatPath = [baseUrl, path].join("/");
    if (shouldStream) {
      chatPath += chatPath.includes("?") ? "&alt=sse" : "?alt=sse";
    }

    // 嘗試獲取最新的 API key
    // 注意：這是一個同步方法，所以我們不能直接使用 async/await
    // 我們將在下一次請求時獲取最新的 API key
    this.refreshApiKey();

    // 重新獲取最新的 accessStore 狀態
    const latestAccessStore = useAccessStore.getState();
    
    // Add API key to URL for Google API
    const apiKey = latestAccessStore.getEffectiveGoogleKey();
    console.log("[Google] 使用的 API Key 長度:", apiKey ? apiKey.length : 0);
    console.log("[Google] API Key 來源:", apiKey === latestAccessStore.defaultGoogleApiKey ? "數據庫" : (latestAccessStore.useCustomConfig ? "用戶自定義" : "系統默認"));
    
    if (apiKey) {
      chatPath += chatPath.includes("?") ? "&key=" + apiKey : "?key=" + apiKey;
    }

    return chatPath;
  }

  // 添加一個方法來刷新 API key
  refreshApiKey() {
    // 使用 fetch 獲取最新的 API key
    fetch('/api/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    .then(response => {
      if (response.ok) {
        return response.json();
      }
      throw new Error('Failed to fetch API keys');
    })
    .then(data => {
      if (data.googleApiKey) {
        console.log("[Google] 從 API 獲取到新的 Google API key，長度:", data.googleApiKey.length);
        // 更新 accessStore 中的 defaultGoogleApiKey
        useAccessStore.getState().update((state) => {
          state.defaultGoogleApiKey = data.googleApiKey;
        });
      }
    })
    .catch(error => {
      console.error("[Google] 獲取 API key 失敗:", error);
    });
  }

  getHeaders() {
    const accessStore = useAccessStore.getState();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-requested-with": "XMLHttpRequest",
    };

    const apiKey = accessStore.getEffectiveGoogleKey();
    const isDbApiKey = apiKey === accessStore.defaultGoogleApiKey;
    console.log("[Google Headers] 使用的 API Key 長度:", apiKey ? apiKey.length : 0);
    console.log("[Google Headers] API Key 來源:", isDbApiKey ? "數據庫" : (accessStore.useCustomConfig ? "用戶自定義" : "系統默認"));
    
    if (!apiKey) {
      console.warn("[Google] No API key available");
    }

    if (apiKey) {
      headers["x-goog-api-key"] = apiKey;
    }

    return headers;
  }

  extractMessage(res: any) {
    console.log("[Response] gemini-pro response: ", res);

    return (
      res?.candidates?.at(0)?.content?.parts.at(0)?.text ||
      res?.at(0)?.candidates?.at(0)?.content?.parts.at(0)?.text ||
      res?.error?.message ||
      ""
    );
  }
  speech(options: SpeechOptions): Promise<ArrayBuffer> {
    throw new Error("Method not implemented.");
  }

  async chat(options: ChatOptions): Promise<void> {
    // 先刷新 API key，確保使用最新的 API key
    this.refreshApiKey();
    
    const apiClient = this;
    let multimodal = false;

    // try get base64image from local cache image_url
    const _messages: ChatOptions["messages"] = [];
    for (const v of options.messages) {
      const content = await preProcessImageContent(v.content);
      _messages.push({ role: v.role, content });
    }

    // Format messages for Gemini API
    const messages = _messages.map((v) => {
      let parts: any[] = [{ text: getMessageTextContent(v) }];
      if (isVisionModel(options.config.model)) {
        const images = getMessageImages(v);
        if (images.length > 0) {
          multimodal = true;
          parts = parts.concat(
            images.map((image) => {
              const imageType = image.split(";")[0].split(":")[1];
              const imageData = image.split(",")[1];
              return {
                inline_data: {
                  mime_type: imageType,
                  data: imageData,
                },
              };
            }),
          );
        }
      }
      return {
        role: v.role.replace("assistant", "model").replace("system", "user"),
        parts: parts,
      };
    });

    // google requires that role in neighboring messages must not be the same
    for (let i = 0; i < messages.length - 1; ) {
      if (messages[i].role === messages[i + 1].role) {
        messages[i].parts = messages[i].parts.concat(messages[i + 1].parts);
        messages.splice(i + 1, 1);
      } else {
        i++;
      }
    }

    const accessStore = useAccessStore.getState();
    const modelConfig = {
      ...useAppConfig.getState().modelConfig,
      ...useChatStore.getState().currentSession().mask.modelConfig,
      ...{
        model: options.config.model,
      },
    };

    // Update request payload format for Gemini API
    const requestPayload = {
      contents: messages,
      generationConfig: {
        temperature: modelConfig.temperature,
        topP: modelConfig.top_p,
        topK: modelConfig.max_tokens,
        maxOutputTokens: modelConfig.max_tokens,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: accessStore.googleSafetySettings,
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: accessStore.googleSafetySettings,
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: accessStore.googleSafetySettings,
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: accessStore.googleSafetySettings,
        },
      ],
    };

    let shouldStream = !!options.config.stream;
    const controller = new AbortController();
    options.onController?.(controller);

    try {
      const chatPath = this.path(
        Google.ChatPath(modelConfig.model),
        shouldStream,
      );

      const chatPayload = {
        method: "POST",
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
        headers: this.getHeaders(),
      };

      // make a fetch request
      const requestTimeoutId = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS,
      );

      if (shouldStream) {
        const [tools, funcs] = usePluginStore
          .getState()
          .getAsTools(
            useChatStore.getState().currentSession().mask?.plugin || [],
          );
        return stream(
          chatPath,
          requestPayload,
          this.getHeaders(),
          // @ts-ignore
          tools.length > 0
            ? // @ts-ignore
              [{ functionDeclarations: tools.map((tool) => tool.function) }]
            : [],
          funcs,
          controller,
          // parseSSE
          (text: string, runTools: ChatMessageTool[]) => {
            // console.log("parseSSE", text, runTools);
            const chunkJson = JSON.parse(text);

            const functionCall = chunkJson?.candidates
              ?.at(0)
              ?.content.parts.at(0)?.functionCall;
            if (functionCall) {
              const { name, args } = functionCall;
              runTools.push({
                id: nanoid(),
                type: "function",
                function: {
                  name,
                  arguments: JSON.stringify(args), // utils.chat call function, using JSON.parse
                },
              });
            }
            return chunkJson?.candidates?.at(0)?.content.parts.at(0)?.text;
          },
          // processToolMessage, include tool_calls message and tool call results
          (
            requestPayload: RequestPayload,
            toolCallMessage: any,
            toolCallResult: any[],
          ) => {
            // @ts-ignore
            requestPayload?.contents?.splice(
              // @ts-ignore
              requestPayload?.contents?.length,
              0,
              {
                role: "model",
                parts: toolCallMessage.tool_calls.map(
                  (tool: ChatMessageTool) => ({
                    functionCall: {
                      name: tool?.function?.name,
                      args: JSON.parse(tool?.function?.arguments as string),
                    },
                  }),
                ),
              },
              // @ts-ignore
              ...toolCallResult.map((result) => ({
                role: "function",
                parts: [
                  {
                    functionResponse: {
                      name: result.name,
                      response: {
                        name: result.name,
                        content: result.content, // TODO just text content...
                      },
                    },
                  },
                ],
              })),
            );
          },
          options,
        );
      } else {
        const res = await fetch(chatPath, chatPayload);
        clearTimeout(requestTimeoutId);
        const resJson = await res.json();
        if (resJson?.promptFeedback?.blockReason) {
          // being blocked
          options.onError?.(
            new Error(
              "Message is being blocked for reason: " +
                resJson.promptFeedback.blockReason,
            ),
          );
        }
        const message = apiClient.extractMessage(resJson);
        options.onFinish(message, res);
      }
    } catch (e) {
      console.log("[Request] failed to make a chat request", e);
      options.onError?.(e as Error);
    }
  }
  usage(): Promise<LLMUsage> {
    throw new Error("Method not implemented.");
  }
  async models(): Promise<LLMModel[]> {
    return [];
  }
}
