// This file is deprecated as Baidu functionality has been removed
export const runtime = "edge";

export async function handle() {
  return new Response("Baidu API is no longer supported", { status: 410 });
}
