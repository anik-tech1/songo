import { Hono } from "hono";
import { cors } from "hono/cors";
import { verify } from "hono/jwt";
import { auth } from "./auth";
import { songs } from "./songs";
import { playlists } from "./playlists";
import { ensureSchema, seedDefaultUser, seedFromB2 } from "./db";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors());

app.get("/api/health", async (c) => {
  try {
    const result = await c.env.DB.prepare("SELECT count(*) as c FROM users").first<{ c: number }>();
    return c.json({ status: "ok", users: result?.c ?? 0 });
  } catch (err: any) {
    return c.json({ status: "error", error: err.message }, 500);
  }
});

app.route("/", auth);

app.use("/api/*", async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (path === "/api/auth/login" || path === "/api/health") return next();

  let token: string | undefined;
  const authHeader = c.req.header("Authorization");
  if (authHeader) {
    const parts = authHeader.split(/\s+/);
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") token = parts[1];
  }
  if (!token) token = c.req.query("token");
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  try {
    const payload = await verify(token, c.env.JWT_SECRET || "fallback-secret", "HS256");
    c.set("jwtPayload", payload);
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
  await next();
});

app.get("/api/auth/me", async (c) => {
  const payload = c.get("jwtPayload") as { userId: number; username: string };
  return c.json({ userId: payload.userId, username: payload.username });
});

app.route("/", songs);
app.route("/", playlists);

let initDone = false;

async function initialize(env: Env) {
  if (initDone) return;
  await ensureSchema(env);
  await seedDefaultUser(env);
  initDone = true;
  seedFromB2(env).catch((e) => console.error("B2 seed error:", e));
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      try {
        await initialize(env);
      } catch (err) {
        console.error("Init error:", err);
      }
      return app.fetch(request, env, ctx);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
};
