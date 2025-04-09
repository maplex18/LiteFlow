import { liteResponse } from "lite/server";
import { getServerSideConfig } from "../../config/server";
import { withDbConnection, getApiKeyFromDb } from "../../utils/db";

export const runtime = "nodejs";

const serverConfig = getServerSideConfig();

async function getUserUpstashConfig(username: string) {
  try {
    const config = await withDbConnection(async (connection) => {
      const [rows] = await connection.execute(
        'SELECT upstashName FROM Account WHERE username = ?',
        [username]
      );
      return (rows as any)[0] as { upstashName: string };
    });

    return {
      upstashName: config?.upstashName || '',
      endpoint: process.env.UPSTASH_REDIS_REST_URL || '',
      apiKey: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    };
  } catch (error) {
    console.error('Error fetching upstash config:', error);
    return {
      upstashName: '',
      endpoint: '',
      apiKey: '',
    };
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const username = url.searchParams.get('username');

  if (!username) {
    return liteResponse.json({ error: 'Username is required' }, { status: 400 });
  }

  const upstashConfig = await getUserUpstashConfig(username);
  
  return liteResponse.json({
    ...serverConfig,
    upstash: upstashConfig
  });
}

export async function POST(request: Request) {
  try {
    // 從數據庫獲取 API keys
    const openaiApiKey = await getApiKeyFromDb("OPENAI_API_KEY");
    const googleApiKey = await getApiKeyFromDb("GOOGLE_API_KEY");
    const anthropicApiKey = await getApiKeyFromDb("ANTHROPIC_API_KEY");
    
    // 從數據庫獲取 API URLs 和版本
    const openaiUrl = await getApiKeyFromDb("OPENAI_URL");
    const openaiOrgId = await getApiKeyFromDb("OPENAI_ORG_ID");
    const googleUrl = await getApiKeyFromDb("GOOGLE_URL");
    const googleApiVersion = await getApiKeyFromDb("GOOGLE_API_VERSION");
    const anthropicUrl = await getApiKeyFromDb("ANTHROPIC_URL");
    const anthropicApiVersion = await getApiKeyFromDb("ANTHROPIC_API_VERSION");
    
    return liteResponse.json({
      ...serverConfig,
      // OpenAI 配置
      apiKey: openaiApiKey,
      openaiUrl: openaiUrl || "https://api.openai.com",
      openaiOrgId: openaiOrgId || "",
      
      // Google 配置
      googleApiKey: googleApiKey,
      googleUrl: googleUrl || "https://generativelanguage.googleapis.com/",
      googleApiVersion: googleApiVersion || "v1beta",
      
      // Anthropic 配置
      anthropicApiKey: anthropicApiKey,
      anthropicUrl: anthropicUrl || "https://api.anthropic.com",
      anthropicApiVersion: anthropicApiVersion || "2023-06-01"
    });
  } catch (error) {
    console.error('Error fetching API configurations:', error);
    return liteResponse.json({ 
      ...serverConfig,
      error: 'Failed to fetch API configurations' 
    });
  }
}
