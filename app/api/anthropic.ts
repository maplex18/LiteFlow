import { getServerSideConfig } from "@/app/config/server";
import {
  ANTHROPIC_BASE_URL,
  Anthropic,
  ApiPath,
  ServiceProvider,
  ModelProvider,
} from "@/app/constant";
import { prettyObject } from "@/app/utils/format";
import { liteRequest, liteResponse } from "lite/server";
import { auth } from "./auth";
import { isModelAvailableInServer } from "@/app/utils/model";
import { cloudflareAIGatewayUrl } from "@/app/utils/cloudflare";

const ALLOWD_PATH = new Set([Anthropic.ChatPath, Anthropic.ChatPath1]);

export async function handle(
  req: liteRequest,
  { params }: { params: { path: string[] } },
) {


  if (req.method === "OPTIONS") {
    return liteResponse.json({ body: "OK" }, { status: 200 });
  }

  const subpath = params.path.join("/");

  if (!ALLOWD_PATH.has(subpath)) {

    return liteResponse.json(
      {
        error: true,
        msg: "you are not allowed to request " + subpath,
      },
      {
        status: 403,
      },
    );
  }

  const authResult = auth(req, ModelProvider.Claude);
  if (authResult.error) {
    return liteResponse.json(authResult, {
      status: 401,
    });
  }

  try {
    const response = await request(req);
    return response;
  } catch (e) {
    console.error("[Anthropic] ", e);
    return liteResponse.json(prettyObject(e));
  }
}

const serverConfig = getServerSideConfig();

async function request(req: liteRequest) {
  const controller = new AbortController();

  let authHeaderName = "x-api-key";
  let authValue =
    req.headers.get(authHeaderName) ||
    req.headers.get("Authorization")?.replaceAll("Bearer ", "").trim() ||
    serverConfig.anthropicApiKey ||
    "";

  let path = `${req.liteUrl.pathname}`.replaceAll(ApiPath.Anthropic, "");

  let baseUrl =
    serverConfig.anthropicUrl || serverConfig.baseUrl || ANTHROPIC_BASE_URL;

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

  // try rebuild url, when using cloudflare ai gateway in server
  const fetchUrl = cloudflareAIGatewayUrl(`${baseUrl}${path}`);

  const fetchOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "anthropic-dangerous-direct-browser-access": "true",
      [authHeaderName]: authValue,
      "anthropic-version":
        req.headers.get("anthropic-version") ||
        serverConfig.anthropicApiVersion ||
        Anthropic.Vision,
    },
    method: req.method,
    body: req.body,
    redirect: "manual",
    // @ts-ignore
    duplex: "half",
    signal: controller.signal,
  };

  // #1815 try to refuse some request to some models
  if (serverConfig.customModels && req.body) {
    try {
      const clonedBody = await req.text();
      fetchOptions.body = clonedBody;

      const jsonBody = JSON.parse(clonedBody) as { model?: string };

      // not undefined and is false
      if (
        isModelAvailableInServer(
          serverConfig.customModels,
          jsonBody?.model as string,
          ServiceProvider.Anthropic as string,
        )
      ) {
        return liteResponse.json(
          {
            error: true,
            message: `you are not allowed to use ${jsonBody?.model} model`,
          },
          {
            status: 403,
          },
        );
      }
    } catch (e) {
      console.error(`[Anthropic] filter`, e);
    }
  }
  // console.log("[Anthropic request]", fetchOptions.headers, req.method);
  try {
    const res = await fetch(fetchUrl, fetchOptions);

    // console.log(
    //   "[Anthropic response]",
    //   res.status,
    //   "   ",
    //   res.headers,
    //   res.url,
    // );
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
