import { LLMModel } from "../client/api";
import { DalleSize, DalleQuality, DalleStyle } from "../typing";
import { getClientConfig } from "../config/client";
import {
  DEFAULT_INPUT_TEMPLATE,
  DEFAULT_MODELS,
  DEFAULT_SIDEBAR_WIDTH,
  DEFAULT_TTS_ENGINE,
  DEFAULT_TTS_ENGINES,
  DEFAULT_TTS_MODEL,
  DEFAULT_TTS_MODELS,
  DEFAULT_TTS_VOICE,
  DEFAULT_TTS_VOICES,
  StoreKey,
  ServiceProvider,
} from "../constant";
import { createPersistStore } from "../utils/store";
import type { Voice } from "rt-client";

export type ModelType = (typeof DEFAULT_MODELS)[number]["name"];
export type TTSModelType = (typeof DEFAULT_TTS_MODELS)[number];
export type TTSVoiceType = (typeof DEFAULT_TTS_VOICES)[number];
export type TTSEngineType = (typeof DEFAULT_TTS_ENGINES)[number];

export enum SubmitKey {
  Enter = "Enter",
  CtrlEnter = "Ctrl + Enter",
  ShiftEnter = "Shift + Enter",
  AltEnter = "Alt + Enter",
  MetaEnter = "Meta + Enter",
}

export enum Theme {
  Auto = "auto",
  Dark = "dark",
  Light = "light",
}

// Initialize with default values
let isApp = false;

export const DEFAULT_CONFIG = {
  lastUpdate: Date.now(), // timestamp, to merge state

  submitKey: SubmitKey.Enter,
  avatar: "1f603",
  fontSize: 14,
  fontFamily: "",
  theme: Theme.Auto as Theme,
  tightBorder: isApp,
  sendPreviewBubble: true,
  enableAutoGenerateTitle: true,
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,

  enableArtifacts: true, // show artifacts config

  enableCodeFold: true, // code fold config

  disablePromptHint: false,

  dontShowMaskSplashScreen: false, // dont show splash screen when create chat
  hideBuiltinMasks: false, // dont add builtin masks

  customModels: "",
  models: DEFAULT_MODELS as any as LLMModel[],

  modelConfig: {
    model: "gpt-4o-mini" as ModelType,
    providerName: "OpenAI" as ServiceProvider,
    temperature: 0.5,
    top_p: 1,
    max_tokens: 4000,
    presence_penalty: 0,
    frequency_penalty: 0,
    sendMemory: true,
    historyMessageCount: 4,
    compressMessageLengthThreshold: 1000,
    compressModel: "",
    compressProviderName: "",
    enableInjectSystemPrompts: true,
    template: DEFAULT_INPUT_TEMPLATE,
    size: "1024x1024" as DalleSize,
    quality: "standard" as DalleQuality,
    style: "vivid" as DalleStyle,
  },

  ttsConfig: {
    enable: false,
    autoplay: false,
    engine: DEFAULT_TTS_ENGINE,
    model: DEFAULT_TTS_MODEL,
    voice: DEFAULT_TTS_VOICE,
    speed: 1.0,
  },

  realtimeConfig: {
    enable: false,
    provider: "OpenAI" as ServiceProvider,
    model: "gpt-4o-realtime-preview-2024-10-01",
    apiKey: "",
    azure: {
      endpoint: "",
      deployment: "",
    },
    temperature: 0.9,
    voice: "alloy" as Voice,
  },
};

// Fetch client config asynchronously
(async () => {
  try {
    const clientConfig = await getClientConfig();
    isApp = !!clientConfig?.isApp;
    // Update the DEFAULT_CONFIG with the new isApp value
    DEFAULT_CONFIG.tightBorder = isApp;
    // Update template if available
    if (clientConfig?.template) {
      DEFAULT_CONFIG.modelConfig.template = clientConfig.template;
    }
  } catch (error) {
    console.error("Failed to load client config:", error);
  }
})();

export type ChatConfig = typeof DEFAULT_CONFIG;

export type ModelConfig = ChatConfig["modelConfig"];
export type TTSConfig = ChatConfig["ttsConfig"];
export type RealtimeConfig = ChatConfig["realtimeConfig"];

export function limitNumber(
  x: number,
  min: number,
  max: number,
  defaultValue: number,
) {
  if (isNaN(x)) {
    return defaultValue;
  }

  return Math.min(max, Math.max(min, x));
}

export const TTSConfigValidator = {
  engine(x: string) {
    return x as TTSEngineType;
  },
  model(x: string) {
    return x as TTSModelType;
  },
  voice(x: string) {
    return x as TTSVoiceType;
  },
  speed(x: number) {
    return limitNumber(x, 0.25, 4.0, 1.0);
  },
};

export const ModalConfigValidator = {
  model(x: string) {
    return x as ModelType;
  },
  max_tokens(x: number) {
    return limitNumber(x, 0, 512000, 1024);
  },
  presence_penalty(x: number) {
    return limitNumber(x, -2, 2, 0);
  },
  frequency_penalty(x: number) {
    return limitNumber(x, -2, 2, 0);
  },
  temperature(x: number) {
    return limitNumber(x, 0, 2, 1);
  },
  top_p(x: number) {
    return limitNumber(x, 0, 1, 1);
  },
};

export const useAppConfig = createPersistStore(
  { ...DEFAULT_CONFIG },
  (set, get) => ({
    async reset() {
      set(() => ({ ...DEFAULT_CONFIG }));
      try {
        const syncStore = (await import("./sync")).useSyncStore.getState();
        const client = syncStore.getClient();
        const username = syncStore[syncStore.provider].username;
        
        // Get current remote state
        const remoteState = await client.get(username);
        let stateToUpdate: Record<string, any> = {};
        
        if (remoteState) {
          try {
            stateToUpdate = JSON.parse(remoteState);
          } catch (e) {
            console.error("[Config] Failed to parse remote state:", e);
          }
        }
        
        // Update with default config
        stateToUpdate = {
          ...stateToUpdate,
          "app-config": {
            ...DEFAULT_CONFIG,
            lastUpdate: Date.now()
          }
        };
        
        // Save to Upstash
        await client.set(username, JSON.stringify(stateToUpdate));
      } catch (e) {
        console.error("[Config] Failed to sync after reset:", e);
      }
    },

    async mergeModels(newModels: LLMModel[]) {
      if (!newModels || newModels.length === 0) {
        return;
      }

      const oldModels = get().models;
      const modelMap: Record<string, LLMModel> = {};

      for (const model of oldModels) {
        model.available = false;
        modelMap[`${model.name}@${model?.provider?.id}`] = model;
      }

      for (const model of newModels) {
        model.available = true;
        modelMap[`${model.name}@${model?.provider?.id}`] = model;
      }

      set(() => ({
        models: Object.values(modelMap),
      }));

      try {
        const syncStore = (await import("./sync")).useSyncStore.getState();
        const client = syncStore.getClient();
        const username = syncStore[syncStore.provider].username;
        
        // Get current remote state
        const remoteState = await client.get(username);
        let stateToUpdate: Record<string, any> = {};
        
        if (remoteState) {
          try {
            stateToUpdate = JSON.parse(remoteState);
          } catch (e) {
            console.error("[Config] Failed to parse remote state:", e);
          }
        }
        
        // Update models in config
        const config = get();
        stateToUpdate = {
          ...stateToUpdate,
          "app-config": {
            ...config,
            models: Object.values(modelMap),
            lastUpdate: Date.now()
          }
        };
        
        // Save to Upstash
        await client.set(username, JSON.stringify(stateToUpdate));
      } catch (e) {
        console.error("[Config] Failed to sync after model changes:", e);
      }
    },

    async update(updater: (config: ChatConfig) => void) {
      const config = get();
      updater(config);
      set(() => ({ ...config }));

      // Sync to Upstash after any config update
      try {
        const syncStore = (await import("./sync")).useSyncStore.getState();
        const client = syncStore.getClient();
        const username = syncStore[syncStore.provider].username;
        
        // Get current remote state
        const remoteState = await client.get(username);
        let stateToUpdate: Record<string, any> = {};
        
        if (remoteState) {
          try {
            stateToUpdate = JSON.parse(remoteState);
          } catch (e) {
            console.error("[Config] Failed to parse remote state:", e);
          }
        }
        
        // Log current state
        console.log("[Config] Current remote state:", stateToUpdate);
        
        // Update config in state
        stateToUpdate = {
          ...stateToUpdate,
          "app-config": {
            ...config,
            lastUpdate: Date.now()
          }
        };
        
        console.log("[Config] Updating remote state with new config:", {
          fontSize: config.fontSize,
          theme: config.theme,
          fullConfig: stateToUpdate["app-config"]
        });
        
        // Save updated state back to Upstash
        await client.set(username, JSON.stringify(stateToUpdate));
      } catch (e) {
        console.error("[Config] Failed to sync after update:", e);
      }
    },

    allModels() {},
  }),
  {
    name: StoreKey.Config,
    version: 4.1,

    merge(persistedState, currentState) {
      const state = persistedState as ChatConfig | undefined;
      if (!state) return { ...currentState };

      return {
        ...state,
        reset: currentState.reset,
        mergeModels: currentState.mergeModels,
        update: currentState.update,
        allModels: currentState.allModels,
        lastUpdateTime: currentState.lastUpdateTime,
        _hasHydrated: currentState._hasHydrated,
        markUpdate: currentState.markUpdate,
        setHasHydrated: currentState.setHasHydrated
      };
    },

    migrate(persistedState, version) {
      const state = persistedState as ChatConfig;

      if (version < 3.4) {
        state.modelConfig.sendMemory = true;
        state.modelConfig.historyMessageCount = 4;
        state.modelConfig.compressMessageLengthThreshold = 1000;
        state.modelConfig.frequency_penalty = 0;
        state.modelConfig.top_p = 1;
        state.modelConfig.template = DEFAULT_INPUT_TEMPLATE;
        state.dontShowMaskSplashScreen = false;
        state.hideBuiltinMasks = false;
      }

      if (version < 3.5) {
        state.customModels = "claude,claude-100k";
      }

      if (version < 3.6) {
        state.modelConfig.enableInjectSystemPrompts = true;
      }

      if (version < 3.7) {
        state.enableAutoGenerateTitle = true;
      }

      if (version < 3.8) {
        state.lastUpdate = Date.now();
      }

      if (version < 3.9) {
        state.modelConfig.template =
          state.modelConfig.template !== DEFAULT_INPUT_TEMPLATE
            ? state.modelConfig.template
            : DEFAULT_INPUT_TEMPLATE;
      }

      if (version < 4.1) {
        state.modelConfig.compressModel =
          DEFAULT_CONFIG.modelConfig.compressModel;
        state.modelConfig.compressProviderName =
          DEFAULT_CONFIG.modelConfig.compressProviderName;
      }

      return state as any;
    },
  },
);
