import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req: Request) => {
  const url = new URL(req.url);
  const body = await req.text();
  
  console.log("=== DEBUG WEBHOOK ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  console.log("Query params:", url.search);
  console.log("Headers:", JSON.stringify(Object.fromEntries(req.headers.entries()), null, 2));
  console.log("Body (raw):", body);
  
  try {
    const parsed = JSON.parse(body);
    console.log("Body (parsed):", JSON.stringify(parsed, null, 2));
    console.log("Top-level keys:", Object.keys(parsed));
    
    if (parsed.data) {
      console.log("parsed.data keys:", Object.keys(parsed.data));
    }
    if (parsed.current) {
      console.log("parsed.current keys:", Object.keys(parsed.current));
    }
    if (parsed.previous) {
      console.log("parsed.previous keys:", Object.keys(parsed.previous));
    }
  } catch {
    console.log("Body is not valid JSON");
  }
  
  console.log("=== END DEBUG ===");
  
  return new Response(JSON.stringify({ ok: true, received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
