import { NextRequest, NextResponse } from "next/server";

async function handle(
  req: NextRequest,
  { params }: { params: { action: string; key: string[] } },
) {
  try {
    // 詳細記錄請求信息
    console.log("[Upstash Action Route] 收到請求:", {
      method: req.method,
      url: req.url,
      action: params.action,
      key: params.key,
      headers: Object.fromEntries(req.headers.entries()),
      searchParams: Object.fromEntries(new URL(req.url).searchParams.entries())
    });
    
    const requestUrl = new URL(req.url);
    const endpoint = requestUrl.searchParams.get("endpoint");

    if (req.method === "OPTIONS") {
      return NextResponse.json({ body: "OK" }, { status: 200 });
    }
    const [...key] = params.key;

    // Validate endpoint
    if (!endpoint) {
      console.error("[Upstash Action Route] Missing endpoint");
      return NextResponse.json(
        {
          error: true,
          msg: "Missing endpoint parameter",
        },
        { status: 400 },
      );
    }

    // Safely validate URL
    let endpointUrl;
    try {
      endpointUrl = new URL(endpoint);
      console.log("[Upstash Action Route] 解析的 endpoint URL:", {
        protocol: endpointUrl.protocol,
        hostname: endpointUrl.hostname,
        pathname: endpointUrl.pathname
      });
    } catch (e) {
      console.error("[Upstash Action Route] Invalid endpoint URL:", endpoint, e);
      return NextResponse.json(
        {
          error: true,
          msg: "Invalid endpoint URL",
          details: e instanceof Error ? e.message : String(e)
        },
        { status: 400 },
      );
    }

    // only allow to request to *.upstash.io
    if (!endpointUrl.hostname.endsWith(".upstash.io")) {
      console.error("[Upstash Action Route] Invalid hostname:", endpointUrl.hostname);
      return NextResponse.json(
        {
          error: true,
          msg: "Only upstash.io endpoints are allowed",
        },
        { status: 403 },
      );
    }

    // only allow upstash get and set method
    if (params.action !== "get" && params.action !== "set") {
      console.error("[Upstash Action Route] forbidden action:", params.action);
      return NextResponse.json(
        {
          error: true,
          msg: "Only get and set actions are allowed",
        },
        { status: 403 },
      );
    }

    // 構建目標 URL，確保沒有多餘的斜線
    let targetUrl = `${endpoint}/${params.action}/${params.key.join("/")}`;
    
    // 記錄原始 URL
    console.log("[Upstash Action Route] 原始目標 URL:", targetUrl);
    
    // 規範化 URL，避免雙斜線
    const originalUrl = targetUrl;
    targetUrl = targetUrl.replace(/(https?:\/\/)|(\/)+/g, (match) => {
      if (match === "http://" || match === "https://") return match;
      return "/";
    });
    
    // 如果 URL 被修改，記錄變化
    if (originalUrl !== targetUrl) {
      console.log("[Upstash Action Route] URL 規範化:", {
        before: originalUrl,
        after: targetUrl
      });
    }

    console.log("[Upstash Action Route] 轉發請求到:", targetUrl);

    const method = req.method;
    const shouldNotHaveBody = ["get", "head"].includes(
      method?.toLowerCase() ?? "",
    );

    // 構建請求頭
    const headersObj = {
      "authorization": req.headers.get("authorization") ?? "",
      "Content-Type": "application/json"
    };
    
    console.log("[Upstash Action Route] 請求頭:", {
      authorization: headersObj.authorization ? "已設置" : "未設置",
      contentType: headersObj["Content-Type"]
    });

    const fetchOptions: RequestInit = {
      headers: headersObj as HeadersInit,
      body: shouldNotHaveBody ? null : req.body,
      method,
      // @ts-ignore
      duplex: "half",
    };

    try {
      console.log("[Upstash Action Route] 發送請求...");
      const fetchResult = await fetch(targetUrl, fetchOptions);
      
      // 詳細記錄響應信息
      console.log("[Upstash Action Route] 收到響應:", {
        status: fetchResult.status,
        statusText: fetchResult.statusText,
        headers: Object.fromEntries(fetchResult.headers.entries())
      });
      
      if (!fetchResult.ok) {
        // 嘗試讀取錯誤響應體
        let errorBody = "";
        try {
          errorBody = await fetchResult.text();
        } catch (e) {
          console.error("[Upstash Action Route] 無法讀取錯誤響應體:", e);
        }
        
        console.error("[Upstash Action Route] 請求失敗:", {
          status: fetchResult.status,
          statusText: fetchResult.statusText,
          url: targetUrl,
          errorBody: errorBody || "無法讀取"
        });
        
        // 對於 400 錯誤，返回更詳細的信息
        if (fetchResult.status === 400) {
          return NextResponse.json(
            {
              error: true,
              msg: "Bad Request to Upstash",
              details: errorBody || fetchResult.statusText,
              url: targetUrl
            },
            { status: 400 },
          );
        }
      } else {
        console.log("[Upstash Action Route] 請求成功:", {
          status: fetchResult.status,
          url: targetUrl
        });
      }

      return fetchResult;
    } catch (fetchError) {
      console.error("[Upstash Action Route] 請求出錯:", {
        error: fetchError instanceof Error ? fetchError.message : String(fetchError),
        stack: fetchError instanceof Error ? fetchError.stack : undefined,
        url: targetUrl
      });
      return NextResponse.json(
        {
          error: true,
          msg: "Failed to fetch from Upstash",
          details: fetchError instanceof Error ? fetchError.message : String(fetchError),
          url: targetUrl
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("[Upstash Action Route] Unexpected error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      {
        error: true,
        msg: "Internal server error",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 },
    );
  }
}

export const POST = handle;
export const GET = handle;
export const OPTIONS = handle;

export const runtime = "edge";
