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

app.get("/api/health", (c) => c.json({ status: "ok" }));

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
    const payload = await verify(token, c.env.JWT_SECRET, "HS256");
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

async function initialize(env: Env) {
  await ensureSchema(env);
  await seedDefaultUser(env);
  await seedFromB2(env);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      await initialize(env);
      return app.fetch(request, env, ctx);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
};
