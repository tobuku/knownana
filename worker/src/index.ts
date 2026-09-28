import { parseDnsQuery, base64urlToBuffer } from "./dns";
import { isSuppressed } from "./suppress";

export interface Env {
  LOG_ENDPOINT: string;
  API_SECRET: string;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const DOH_UPSTREAM = "https://cloudflare-dns.com/dns-query";

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // --- CORS preflight ---
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // --- Health check ---
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // --- DNS query route: /dns-query/{deviceId} ---
    const dnsMatch = url.pathname.match(/^\/dns-query\/([^/]+)$/);
    if (!dnsMatch) {
      return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
    }

    const deviceId = dnsMatch[1];

    try {
      let queryBuf: ArrayBuffer;

      if (request.method === "GET") {
        // RFC 8484 GET: dns param is base64url-encoded wire format
        const dnsParam = url.searchParams.get("dns");
        if (!dnsParam) {
          return new Response("Missing dns query parameter", {
            status: 400,
            headers: CORS_HEADERS,
          });
        }
        queryBuf = base64urlToBuffer(dnsParam);
      } else if (request.method === "POST") {
        // RFC 8484 POST: body is raw DNS wire format
        const ct = request.headers.get("Content-Type") || "";
        if (!ct.includes("application/dns-message")) {
          return new Response("Invalid Content-Type, expected application/dns-message", {
            status: 415,
            headers: CORS_HEADERS,
          });
        }
        queryBuf = await request.arrayBuffer();
      } else {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: CORS_HEADERS,
        });
      }

      // Parse DNS wire format to extract domain and query type
      const { domain, queryType } = parseDnsQuery(queryBuf);

      // Forward to upstream DoH (always POST with wire format - simpler)
      const upstreamResp = await fetch(DOH_UPSTREAM, {
        method: "POST",
        headers: {
          Accept: "application/dns-message",
          "Content-Type": "application/dns-message",
        },
        body: queryBuf,
      });

      const responseBody = await upstreamResp.arrayBuffer();

      // Async logging (does not block DNS response)
      if (!isSuppressed(domain) && env.LOG_ENDPOINT) {
        const logPayload = {
          domain,
          deviceId,
          timestamp: new Date().toISOString(),
          queryType,
        };

        ctx.waitUntil(
          fetch(env.LOG_ENDPOINT, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": env.API_SECRET,
            },
            body: JSON.stringify(logPayload),
          }).catch(() => {
            // Swallow log errors - never break DNS resolution
          })
        );
      }

      return new Response(responseBody, {
        status: 200,
        headers: {
          "Content-Type": "application/dns-message",
          ...CORS_HEADERS,
        },
      });
    } catch (err) {
      return new Response("Internal Server Error", {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  },
} satisfies ExportedHandler<Env>;
