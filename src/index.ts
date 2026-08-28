import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { jwt } from "hono/jwt";

import { auth } from "./auth";
import { songs } from "./songs";
import { playlists } from "./playlists";

const app = new Hono();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

app.use("*", logger());
app.use("*", cors());

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.route("/", auth);

const protectedRoutes = new Hono();
protectedRoutes.use("*", jwt({ secret: JWT_SECRET, alg: "HS256" }));

protectedRoutes.get("/api/auth/me", async (c) => {
  const payload = c.get("jwtPayload") as { userId: number; username: string };
  return c.json({ userId: payload.userId, username: payload.username });
});

protectedRoutes.route("/", songs);
protectedRoutes.route("/", playlists);

app.route("/", protectedRoutes);

export default app;
