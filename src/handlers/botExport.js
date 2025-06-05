export async function handleExport(request, env) {
  try {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/export") {
      const secret = url.searchParams.get("secret");
      if (secret !== env.EXPORT_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }

      const listResponse = await env.DAWN_LOG.list();
      const allKeys = listResponse.keys.map(k => k.name);

      const result = {};
      for (const key of allKeys) {
        const data = await env.DAWN_LOG.get(key);
        if (data) {
          result[key] = JSON.parse(data);
        }
      }

      return new Response(JSON.stringify(result, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return null;
  } catch (error) {
    console.error('Error in export handler:', error);
    return new Response("Internal Server Error", { status: 500 });
  }
}