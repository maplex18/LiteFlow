import { liteRequest, liteResponse } from "lite/server";

export const runtime = "nodejs";

export async function GET(
  req: liteRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    console.log("[Upstash Path Route] 收到 GET 請求:", {
      path: params.path,
      url: req.url
    });

    const endpoint = req.liteUrl.searchParams.get("endpoint");
    if (!endpoint) {
      console.error("[Upstash Path Route] Missing endpoint");
      return liteResponse.json({ error: "Missing endpoint" }, { status: 400 });
    }

    // 構建目標 URL，確保沒有多餘的斜線
    const path = params.path.join("/");
    let url = `${endpoint}/${path}`;
    
    // 規範化 URL，避免雙斜線
    url = url.replace(/(https?:\/\/)|(\/)+/g, (match) => {
      if (match === "http://" || match === "https://") return match;
      return "/";
    });

    console.log("[Upstash Path Route] 轉發請求到:", { url });

    const headers = new Headers(req.headers);
    headers.delete("host");
    headers.set("Content-Type", "application/json");

    try {
      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        console.error("[Upstash Path Route] 請求失敗:", {
          status: response.status,
          statusText: response.statusText,
          url
        });
        return liteResponse.json(
          { error: `Request failed with status: ${response.status}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      console.log("[Upstash Path Route] 請求成功:", {
        status: response.status,
        hasData: !!data
      });

      return liteResponse.json(data);
    } catch (fetchError) {
      console.error("[Upstash Path Route] 請求出錯:", fetchError);
      return liteResponse.json(
        { 
          error: "Failed to fetch from Upstash",
          details: fetchError instanceof Error ? fetchError.message : String(fetchError)
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Upstash Path Route] 處理請求出錯:", error);
    return liteResponse.json(
      { 
        error: "Failed to fetch from Upstash",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function POST(
  req: liteRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    console.log("[Upstash Path Route] 收到 POST 請求:", {
      path: params.path,
      url: req.url
    });

    const endpoint = req.liteUrl.searchParams.get("endpoint");
    if (!endpoint) {
      console.error("[Upstash Path Route] Missing endpoint");
      return liteResponse.json({ error: "Missing endpoint" }, { status: 400 });
    }

    // 構建目標 URL，確保沒有多餘的斜線
    const path = params.path.join("/");
    let url = `${endpoint}/${path}`;
    
    // 規範化 URL，避免雙斜線
    url = url.replace(/(https?:\/\/)|(\/)+/g, (match) => {
      if (match === "http://" || match === "https://") return match;
      return "/";
    });

    console.log("[Upstash Path Route] 轉發請求到:", { url });

    const body = await req.text();
    const headers = new Headers(req.headers);
    headers.delete("host");
    headers.set("Content-Type", "application/json");

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
      });

      if (!response.ok) {
        console.error("[Upstash Path Route] 請求失敗:", {
          status: response.status,
          statusText: response.statusText,
          url
        });
        return liteResponse.json(
          { error: `Request failed with status: ${response.status}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      console.log("[Upstash Path Route] 請求成功:", {
        status: response.status,
        hasData: !!data
      });

      return liteResponse.json(data);
    } catch (fetchError) {
      console.error("[Upstash Path Route] 請求出錯:", fetchError);
      return liteResponse.json(
        { 
          error: "Failed to fetch from Upstash",
          details: fetchError instanceof Error ? fetchError.message : String(fetchError)
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Upstash Path Route] 處理請求出錯:", error);
    return liteResponse.json(
      { 
        error: "Failed to fetch from Upstash",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 