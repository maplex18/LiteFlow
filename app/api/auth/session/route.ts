import { NextResponse } from "next/server";
import { headers } from "next/headers";

export const runtime = "nodejs";

// 定義全局類型
declare global {
  var sessionClients: Map<number, Set<{
    send: (data: string) => void;
  }>>;
}

// 初始化全局 session clients 管理
if (!global.sessionClients) {
  global.sessionClients = new Map();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const sessionToken = url.searchParams.get("sessionToken");

  if (!userId || !sessionToken) {
    return new NextResponse("Missing credentials", { status: 401 });
  }

  const userIdNum = parseInt(userId);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // 創建新的客戶端
      const client = {
        send: (data: string) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: data })}\n\n`));
        }
      };

      // 添加到全局管理
      if (!global.sessionClients.has(userIdNum)) {
        global.sessionClients.set(userIdNum, new Set());
      }
      global.sessionClients.get(userIdNum)?.add(client);

      // 發送初始連接消息
      controller.enqueue(encoder.encode("event: connected\ndata: {}\n\n"));

      return () => {
        // 清理客戶端
        global.sessionClients.get(userIdNum)?.delete(client);
        if (global.sessionClients.get(userIdNum)?.size === 0) {
          global.sessionClients.delete(userIdNum);
        }
      };
    }
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
} 