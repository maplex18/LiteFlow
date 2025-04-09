import { NextRequest, NextResponse } from "next/server";
import { auth } from "./auth";
import { getServerSideConfig } from "@/app/config/server";
import { ApiPath, GEMINI_BASE_URL, ModelProvider } from "@/app/constant";
import { prettyObject } from "@/app/utils/format";

const serverConfig = getServerSideConfig();

export async function handle(
  req: NextRequest,
  { params }: { params: { provider: string; path: string[] } },
) {
  console.log("[Google Route] params ", params);

  if (req.method === "OPTIONS") {
    return NextResponse.json({ body: "OK" }, { status: 200 });
  }

  const authResult = auth(req, ModelProvider.GeminiPro);
  if (authResult.error) {
    return NextResponse.json(authResult, {
      status: 401,
    });
  }

  const bearToken =
    req.headers.get("x-goog-api-key") || req.headers.get("Authorization") || "";
  const token = bearToken.trim().replaceAll("Bearer ", "").trim();

  const apiKey = token ? token : serverConfig.googleApiKey;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: true,
        message: `missing GOOGLE_API_KEY in server env vars`,
      },
      {
        status: 401,
      },
    );
  }
  try {
    const response = await request(req, apiKey);
    return response;
  } catch (e) {
    console.error("[Google] ", e);
    return NextResponse.json(prettyObject(e));
  }
}

export const GET = handle;
export const POST = handle;

export const runtime = "edge";
export const preferredRegion = [
  "bom1",
  "cle1",
  "cpt1",
  "gru1",
  "hnd1",
  "iad1",
  "icn1",
  "kix1",
  "pdx1",
  "sfo1",
  "sin1",
  "syd1",
];

async function request(req: NextRequest, apiKey: string) {
  const controller = new AbortController();

  let baseUrl = serverConfig.googleUrl || GEMINI_BASE_URL;
  const apiVersion = serverConfig.googleApiVersion || "v1";

  let path = `${req.nextUrl.pathname}`.replaceAll(ApiPath.Google, "");
  
  if (!path.includes(apiVersion)) {
    path = `/${apiVersion}${path}`;
  }

  if (!baseUrl.startsWith("http")) {
    baseUrl = `https://${baseUrl}`;
  }

  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }

  console.log("[Google API Proxy] ", path);
  console.log("[Google API Base Url]", baseUrl);

  const timeoutId = setTimeout(
    () => {
      controller.abort();
    },
    10 * 60 * 1000,
  );

  const fetchUrl = `${baseUrl}${path}${path.includes("?") ? "&" : "?"}key=${apiKey}${
    req?.nextUrl?.searchParams?.get("alt") === "sse" ? "&alt=sse" : ""
  }`;

  console.log("[Google API Fetch Url] ", fetchUrl);

  let body = null;
  if (req.body) {
    const text = await req.text();
    try {
      const json = JSON.parse(text);
      if (json.contents) {
        body = text;
      } else {
        body = JSON.stringify({
          contents: [{
            parts: [{
              text: text
            }]
          }]
        });
      }
    } catch (e) {
      console.error("[Google API] Failed to parse request body", e);
      body = text;
    }
  }

  const fetchOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    method: req.method,
    body: body,
    redirect: "manual",
    signal: controller.signal,
  };

  try {
    const res = await fetch(fetchUrl, fetchOptions);
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error("[Google API Error]", {
        status: res.status,
        statusText: res.statusText,
        error: errorData,
        url: fetchUrl,
        body: body
      });
    }
    
    const newHeaders = new Headers(res.headers);
    newHeaders.delete("www-authenticate");
    newHeaders.set("X-Accel-Buffering", "no");

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: newHeaders,
    });
  } catch (e) {
    console.error("[Google API Request Error]", e);
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}
