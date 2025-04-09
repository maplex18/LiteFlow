// import { getServerSideConfig } from "@/app/config/server";
// import {
//   MOONSHOT_BASE_URL,
//   ApiPath,
//   ModelProvider,
//   ServiceProvider,
// } from "@/app/constant";
// import { prettyObject } from "@/app/utils/format";
// import { liteRequest, liteResponse } from "lite/server";
// import { auth } from "@/app/api/auth";
// import { isModelAvailableInServer } from "@/app/utils/model";

// const serverConfig = getServerSideConfig();

// export async function handle(
//   req: liteRequest,
//   { params }: { params: { path: string[] } },
// ) {
//   console.log("[Moonshot Route] params ", params);

//   if (req.method === "OPTIONS") {
//     return liteResponse.json({ body: "OK" }, { status: 200 });
//   }

//   const authResult = auth(req, ModelProvider.Moonshot);
//   if (authResult.error) {
//     return liteResponse.json(authResult, {
//       status: 401,
//     });
//   }

//   try {
//     const response = await request(req);
//     return response;
//   } catch (e) {
//     console.error("[Moonshot] ", e);
//     return liteResponse.json(prettyObject(e));
//   }
// }

// async function request(req: liteRequest) {
//   const controller = new AbortController();

//   // alibaba use base url or just remove the path
//   let path = `${req.liteUrl.pathname}`.replaceAll(ApiPath.Moonshot, "");

//   let baseUrl = serverConfig.moonshotUrl || MOONSHOT_BASE_URL;

//   if (!baseUrl.startsWith("http")) {
//     baseUrl = `https://${baseUrl}`;
//   }

//   if (baseUrl.endsWith("/")) {
//     baseUrl = baseUrl.slice(0, -1);
//   }

//   console.log("[Proxy] ", path);
//   console.log("[Base Url]", baseUrl);

//   const timeoutId = setTimeout(
//     () => {
//       controller.abort();
//     },
//     10 * 60 * 1000,
//   );

//   const fetchUrl = `${baseUrl}${path}`;
//   const fetchOptions: RequestInit = {
//     headers: {
//       "Content-Type": "application/json",
//       Authorization: req.headers.get("Authorization") ?? "",
//     },
//     method: req.method,
//     body: req.body,
//     redirect: "manual",
//     // @ts-ignore
//     duplex: "half",
//     signal: controller.signal,
//   };

//   // #1815 try to refuse some request to some models
//   if (serverConfig.customModels && req.body) {
//     try {
//       const clonedBody = await req.text();
//       fetchOptions.body = clonedBody;

//       const jsonBody = JSON.parse(clonedBody) as { model?: string };

//       // not undefined and is false
//       if (
//         isModelAvailableInServer(
//           serverConfig.customModels,
//           jsonBody?.model as string,
//           ServiceProvider.Moonshot as string,
//         )
//       ) {
//         return liteResponse.json(
//           {
//             error: true,
//             message: `you are not allowed to use ${jsonBody?.model} model`,
//           },
//           {
//             status: 403,
//           },
//         );
//       }
//     } catch (e) {
//       console.error(`[Moonshot] filter`, e);
//     }
//   }
//   try {
//     const res = await fetch(fetchUrl, fetchOptions);

//     // to prevent browser prompt for credentials
//     const newHeaders = new Headers(res.headers);
//     newHeaders.delete("www-authenticate");
//     // to disable nginx buffering
//     newHeaders.set("X-Accel-Buffering", "no");

//     return new Response(res.body, {
//       status: res.status,
//       statusText: res.statusText,
//       headers: newHeaders,
//     });
//   } finally {
//     clearTimeout(timeoutId);
//   }
// }
