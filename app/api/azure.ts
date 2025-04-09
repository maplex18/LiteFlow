import { ModelProvider } from "@/app/constant";
import { prettyObject } from "@/app/utils/format";
import { liteRequest, liteResponse } from "lite/server";
import { auth } from "./auth";
import { requestOpenai } from "./common";

export async function handle(
  req: liteRequest,
  { params }: { params: { path: string[] } },
) {
  console.log("[Azure Route] params ", params);

  if (req.method === "OPTIONS") {
    return liteResponse.json({ body: "OK" }, { status: 200 });
  }

  const subpath = params.path.join("/");

  const authResult = auth(req, ModelProvider.GPT);
  if (authResult.error) {
    return liteResponse.json(authResult, {
      status: 401,
    });
  }

  try {
    return await requestOpenai(req);
  } catch (e) {
    console.error("[Azure] ", e);
    return liteResponse.json(prettyObject(e));
  }
}
