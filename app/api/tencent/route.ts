import { getServerSideConfig } from "@/app/config/server";
import { TENCENT_BASE_URL, ModelProvider } from "@/app/constant";
import { prettyObject } from "@/app/utils/format";
import { liteRequest, liteResponse } from "lite/server";
import { auth } from "@/app/api/auth";
import { getHeader } from "@/app/utils/tencent";

const serverConfig = getServerSideConfig();

async function handle(
  req: liteRequest,
  { params }: { params: { path: string[] } },
) {


  if (req.method === "OPTIONS") {
    return liteResponse.json({ body: "OK" }, { status: 200 });
  }

  const authResult = auth(req, ModelProvider.Hunyuan);
  if (authResult.error) {
    return liteResponse.json(authResult, {
      status: 401,
    });
  }

  try {
    const response = await request(req);
    return response;
  } catch (e) {
    console.error("[Tencent] ", e);
    return liteResponse.json(prettyObject(e));
  }
}

export const GET = handle;
export const POST = handle;

export const runtime = "nodejs";
export const preferredRegion = [
  "arn1",
  "bom1",
  "cdg1",
  "cle1",
  "cpt1",
  "dub1",
  "fra1",
  "gru1",
  "hnd1",
  "iad1",
  "icn1",
  "kix1",
  "lhr1",
  "pdx1",
  "sfo1",
  "sin1",
  "syd1",
];

async function request(req: liteRequest) {
  const controller = new AbortController();

  let baseUrl = serverConfig.tencentUrl || TENCENT_BASE_URL;

  if (!baseUrl.startsWith("http")) {
    baseUrl = `https://${baseUrl}`;
  }

  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }



  const timeoutId = setTimeout(
    () => {
      controller.abort();
    },
    10 * 60 * 1000,
  );

  const fetchUrl = baseUrl;

  const body = await req.text();
  const headers = await getHeader(
    body,
    serverConfig.tencentSecretId as string,
    serverConfig.tencentSecretKey as string,
  );
  const fetchOptions: RequestInit = {
    headers,
    method: req.method,
    body,
    redirect: "manual",
    // @ts-ignore
    duplex: "half",
    signal: controller.signal,
  };

  try {
    const res = await fetch(fetchUrl, fetchOptions);

    // to prevent browser prompt for credentials
    const newHeaders = new Headers(res.headers);
    newHeaders.delete("www-authenticate");
    // to disable nginx buffering
    newHeaders.set("X-Accel-Buffering", "no");

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: newHeaders,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
