import { BuildConfig, getBuildConfig } from "./build";

export async function getClientConfig(): Promise<BuildConfig> {
  if (typeof document !== "undefined") {
    // client side
    return JSON.parse(queryMeta("config") || "{}") as BuildConfig;
  }

  if (typeof process !== "undefined") {
    // server side
    const config = getBuildConfig();
    // If config is a Promise, await it
    if (config instanceof Promise) {
      return await config;
    }
    return config;
  }

  // Default fallback
  return {} as BuildConfig;
}

// Cache for the client config
let clientConfigCache: BuildConfig | null = null;

// Function to get a specific property with a default value
export function getClientConfigSync<K extends keyof BuildConfig>(
  key: K,
  defaultValue: BuildConfig[K]
): BuildConfig[K] {
  if (clientConfigCache && key in clientConfigCache) {
    return clientConfigCache[key];
  }
  
  // Start loading the config if not already cached
  if (!clientConfigCache) {
    getClientConfig().then(config => {
      clientConfigCache = config;
    }).catch(err => {
      console.error("[Config] Failed to load client config:", err);
    });
  }
  
  return defaultValue;
}

function queryMeta(key: string, defaultValue?: string): string {
  let ret: string;
  if (document) {
    const meta = document.head.querySelector(
      `meta[name='${key}']`,
    ) as HTMLMetaElement;
    ret = meta?.content ?? "";
  } else {
    ret = defaultValue ?? "";
  }

  return ret;
}
