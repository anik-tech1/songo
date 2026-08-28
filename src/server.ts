import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { jwt } from "hono/jwt";

import { auth } from "./auth";
import { songs } from "./songs";
import { playlists } from "./playlists";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const PORT = parseInt(process.env.PORT || "3000", 10);

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.route("/", auth);

app.use("/api/*", jwt({ secret: JWT_SECRET, alg: "HS256" }));

app.get("/api/auth/me", async (c) => {
  const payload = c.get("jwtPayload") as { userId: number; username: string };
  return c.json({ userId: payload.userId, username: payload.username });
});

app.route("/", songs);
app.route("/", playlists);

app.use("/*", serveStatic({ root: "./public" }));

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`SonGO running at http://localhost:${info.port}`);
});
