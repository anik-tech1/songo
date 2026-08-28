import { Hono } from "hono";
import { getB2FileStream } from "./storage";
import type { Env } from "./types";

const songs = new Hono<{ Bindings: Env }>();

songs.get("/api/songs", async (c) => {
  const result = await c.env.DB.prepare("SELECT * FROM songs ORDER BY created_at DESC").all();
  return c.json({ songs: result.results });
});

songs.get("/api/songs/:id", async (c) => {
  const song = await c.env.DB.prepare("SELECT * FROM songs WHERE id = ?").bind(c.req.param("id")).first();
  if (!song) return c.json({ error: "Song not found" }, 404);
  return c.json({ song });
});

songs.get("/api/stream/:id", async (c) => {
  const song = await c.env.DB.prepare("SELECT * FROM songs WHERE id = ?")
    .bind(c.req.param("id"))
    .first<{ r2_key: string }>();
  if (!song) return c.json({ error: "Song not found" }, 404);

  try {
    const rangeHeader = c.req.header("range");
    const b2Res = await getB2FileStream(c.env, song.r2_key, rangeHeader);

    const headers = new Headers();
    headers.set("Content-Type", "audio/mpeg");
    headers.set("Accept-Ranges", "bytes");

    if (rangeHeader && b2Res.status === 206) {
      headers.set("Content-Range", b2Res.headers.get("Content-Range") || "");
      headers.set("Content-Length", b2Res.headers.get("Content-Length") || "0");
      return new Response(b2Res.body, { status: 206, headers });
    }

    headers.set("Content-Length", b2Res.headers.get("Content-Length") || "0");
    return new Response(b2Res.body, { status: 200, headers });
  } catch (err: any) {
    return c.json({ error: err.message || "Stream error" }, 500);
  }
});

songs.get("/api/download/:id", async (c) => {
  const song = await c.env.DB.prepare("SELECT * FROM songs WHERE id = ?")
    .bind(c.req.param("id"))
    .first<{ title: string; r2_key: string }>();
  if (!song) return c.json({ error: "Song not found" }, 404);

  try {
    const b2Res = await getB2FileStream(c.env, song.r2_key);
    const safeTitle = song.title.replace(/[^a-zA-Z0-9_\- ]/g, "_");
    const headers = new Headers();
    headers.set("Content-Disposition", `attachment; filename="${safeTitle}.mp3"`);
    headers.set("Content-Type", "audio/mpeg");
    headers.set("Content-Length", b2Res.headers.get("Content-Length") || "0");
    return new Response(b2Res.body, { status: 200, headers });
  } catch {
    return c.json({ error: "File not found" }, 404);
  }
});

export { songs };
