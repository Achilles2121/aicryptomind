export const config = { runtime: "edge" };

export default async function handler() {
  return new Response(
    JSON.stringify({ status: "ok", generatedAt: new Date().toISOString() }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    }
  );
}
