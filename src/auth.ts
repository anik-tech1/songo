import { Hono } from "hono";
import { sign } from "hono/jwt";
import type { Env } from "./types";

const auth = new Hono<{ Bindings: Env }>();

auth.post("/api/auth/login", async (c) => {
  const { username, password } = await c.req.json<{ username: string; password: string }>();

  let user = await c.env.DB.prepare("SELECT * FROM users WHERE username = ?")
    .bind(username)
    .first<{ id: number; username: string; password_hash: string }>();

  if (!user) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  if (user.password_hash !== password) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const secret = c.env.JWT_SECRET || "fallback-secret";
  const token = await sign(
    { userId: user.id, username: user.username, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 },
    secret
  );

  return c.json({ token, username: user.username });
});

export { auth };
