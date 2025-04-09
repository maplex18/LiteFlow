import { liteResponse } from "lite/server";

export const runtime = "nodejs";

// 重新定義全局類型
declare global {
  var notificationClients: Map<number, Set<{
    send: (data: string) => void;
    isActive: boolean;
    lastActivity?: number;
  }>>;
}

// 初始化全局 notification clients 管理
if (!global.notificationClients) {
  global.notificationClients = new Map();
}

// 允許的來源
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001'
];

// 清理非活動客戶端的函數
function cleanupInactiveClients() {
  const now = Date.now();
  const INACTIVE_THRESHOLD = 5 * 60 * 1000; // 5分鐘沒有活動視為非活動

  for (const [userId, clients] of global.notificationClients.entries()) {
    // 標記超時的客戶端為非活動
    clients.forEach(client => {
      // 確保 lastActivity 存在，如果不存在則設置為當前時間
      const lastActivity = client.lastActivity || now;
      if (now - lastActivity > INACTIVE_THRESHOLD) {
        client.isActive = false;
      }
    });
    
    // 過濾掉非活動客戶端
    const activeClients = new Set([...clients].filter(c => c.isActive));
    
    if (activeClients.size === 0) {
      global.notificationClients.delete(userId);
    } else {
      global.notificationClients.set(userId, activeClients);
    }
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const token = url.searchParams.get("token");
  const timestamp = url.searchParams.get("t") || Date.now().toString();

  // 定期清理非活動客戶端
  cleanupInactiveClients();

  // 處理 CORS 預檢請求
  const origin = request.headers.get('origin');
  
  // 如果是預檢請求或來源不在允許列表中，返回 CORS 錯誤
  if (!origin || !allowedOrigins.includes(origin)) {
    return new liteResponse("CORS error: Origin not allowed", { 
      status: 403,
      headers: {
        "Content-Type": "text/plain",
      }
    });
  }

  if (!userId || !token) {
    return new liteResponse("Missing credentials", { 
      status: 401,
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
      }
    });
  }

  // 這裡可以添加驗證 token 的邏輯
  // 簡單起見，這裡假設 token 是有效的

  const userIdNum = parseInt(userId);

  try {
    // Create a new TransformStream instead of ReadableStream
    const { readable, writable } = new TransformStream();
    const encoder = new TextEncoder();
    const writer = writable.getWriter();
    
    // 創建新的客戶端
    const client = {
      send: async (data: string) => {
        try { 
          await writer.write(encoder.encode(`data: ${data}\n\n`));
          client.lastActivity = Date.now();
        } catch (error) { 
          console.error("SSE 發送數據錯誤:", error);
          client.isActive = false;
        }
      },
      isActive: true,
      lastActivity: Date.now()
    };

    // 清理舊的客戶端連接
    if (global.notificationClients.has(userIdNum)) {
      const existingClients = global.notificationClients.get(userIdNum);
      if (existingClients) {
        // 標記所有現有客戶端為非活動狀態
        existingClients.forEach(existingClient => {
          existingClient.isActive = false;
        });
        
        // 清理非活動客戶端
        const activeClients = new Set([...existingClients].filter(c => c.isActive));
        global.notificationClients.set(userIdNum, activeClients);
      }
    }

    // 添加到全局管理
    if (!global.notificationClients.has(userIdNum)) {
      global.notificationClients.set(userIdNum, new Set());
    }
    global.notificationClients.get(userIdNum)?.add(client);

    // 發送初始連接消息
    try { 
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: "connected", timestamp })}\n\n`));
    } catch (error) { 
      console.error("SSE 初始連接消息發送錯誤:", error);
      client.isActive = false;
    }

    // Handle connection close
    request.signal.addEventListener('abort', () => {
      // 清理客戶端
      client.isActive = false;
      const clients = global.notificationClients.get(userIdNum);
      if (clients) {
        clients.delete(client);
        
        // 如果該用戶沒有活動客戶端，從全局映射中移除
        if (clients.size === 0) {
          global.notificationClients.delete(userIdNum);
        }
      }
    });

    return new liteResponse(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no", // 防止 Nginx 緩衝
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
      },
    });
  } catch (error) {
    console.error("SSE 連接創建錯誤:", error);
    return new liteResponse(JSON.stringify({ error: "SSE 連接創建失敗" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
      }
    });
  }
}

// 處理 OPTIONS 預檢請求
export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin');
  
  // 如果來源不在允許列表中，返回 CORS 錯誤
  if (!origin || !allowedOrigins.includes(origin)) {
    return new liteResponse(null, { 
      status: 204,
      headers: {
        "Content-Type": "text/plain",
      }
    });
  }
  
  // 返回 CORS 預檢響應
  return new liteResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400", // 24 小時
    },
  });
} 