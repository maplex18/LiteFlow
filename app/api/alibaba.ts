export const runtime = "edge";

export default async function handler() {
  return new Response("Alibaba API is no longer supported", {
    status: 410,
  });
}
