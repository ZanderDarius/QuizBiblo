/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) return buzzApi(request, env, url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const bad = (message: string, status = 400) => json({ error: message }, status);
async function ensure(db: D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, host_session TEXT NOT NULL, started INTEGER NOT NULL DEFAULT 0, started_at INTEGER, winner_session TEXT, winner_name TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS players (room_code TEXT NOT NULL, session TEXT PRIMARY KEY, name TEXT NOT NULL, joined_at INTEGER NOT NULL)"),
  ]);
}
async function roomState(db: D1Database, code: string) {
  const room = await db.prepare("SELECT code, host_session as hostSession, started, started_at as startedAt, winner_session as winnerSession, winner_name as winnerName FROM rooms WHERE code = ?").bind(code).first<Record<string, unknown>>();
  if (!room) return null;
  const players = await db.prepare("SELECT session, name FROM players WHERE room_code = ? ORDER BY joined_at ASC").bind(code).all();
  return { room: code, hostSession: room.hostSession, started: Boolean(room.started), startedAt: room.startedAt, winnerSession: room.winnerSession, winnerName: room.winnerName, players: players.results };
}
async function buzzApi(request: Request, env: Env, url: URL) {
  if (!env.DB) return bad("The room service is unavailable.", 503);
  await ensure(env.DB);
  const action = url.pathname.split("/").pop();
  if (action === "state") { const code = (url.searchParams.get("room") || "").toUpperCase(); const state = await roomState(env.DB, code); return state ? json(state) : bad("Room not found.", 404); }
  if (request.method !== "POST") return bad("Method not allowed.", 405);
  const input = await request.json<{ room?: string; session?: string; name?: string }>();
  const code = (input.room || "").toUpperCase().replace(/[^A-Z0-9-]/g, ""); const session = input.session || "";
  if (code.length < 3 || !session) return bad("Invalid room request.");
  if (action === "join") { const name = (input.name || "").trim().slice(0, 24); if (!name) return bad("A display name is required."); const existing = await roomState(env.DB, code); if (existing && !existing.players.some((p: any) => p.session === session) && existing.players.length >= 2) return bad("This room already has two players."); await env.DB.prepare("INSERT OR IGNORE INTO rooms (code, host_session) VALUES (?, ?)").bind(code, session).run(); await env.DB.prepare("INSERT OR REPLACE INTO players (room_code, session, name, joined_at) VALUES (?, ?, ?, ?)").bind(code, session, name, Date.now()).run(); return json(await roomState(env.DB, code)); }
  const current = await roomState(env.DB, code); if (!current || !(current.players as any[]).some(p => p.session === session)) return bad("Join this room first.", 403);
  if (action === "start") { if (current.hostSession !== session) return bad("Only the host can start the question.", 403); await env.DB.prepare("UPDATE rooms SET started = 1, started_at = ?, winner_session = NULL, winner_name = NULL WHERE code = ?").bind(Date.now(), code).run(); return json(await roomState(env.DB, code)); }
  if (action === "buzz") { const player = (current.players as any[]).find(p => p.session === session); const result = await env.DB.prepare("UPDATE rooms SET winner_session = ?, winner_name = ? WHERE code = ? AND started = 1 AND winner_session IS NULL").bind(session, player.name, code).run(); if (!result.meta.changes) return bad("Someone else already buzzed first.", 409); return json(await roomState(env.DB, code)); }
  return bad("Unknown room action.", 404);
}
