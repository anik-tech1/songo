import { Hono } from "hono";
import type { Env } from "./types";

const playlists = new Hono<{ Bindings: Env }>();

playlists.get("/api/playlists", async (c) => {
  const payload = c.get("jwtPayload") as { userId: number };
  const result = await c.env.DB.prepare("SELECT * FROM playlists WHERE user_id = ? ORDER BY created_at DESC")
    .bind(payload.userId)
    .all();
  return c.json({ playlists: result.results });
});

playlists.post("/api/playlists", async (c) => {
  const payload = c.get("jwtPayload") as { userId: number };
  const { name } = await c.req.json<{ name: string }>();

  const result = await c.env.DB.prepare("INSERT INTO playlists (user_id, name) VALUES (?, ?)")
    .bind(payload.userId, name)
    .run();

  const playlist = await c.env.DB.prepare("SELECT * FROM playlists WHERE id = ?")
    .bind(result.meta.last_row_id)
    .first();

  return c.json({ playlist });
});

playlists.delete("/api/playlists/:id", async (c) => {
  const payload = c.get("jwtPayload") as { userId: number };
  const id = Number(c.req.param("id"));

  const playlist = await c.env.DB.prepare("SELECT * FROM playlists WHERE id = ? AND user_id = ?")
    .bind(id, payload.userId)
    .first();
  if (!playlist) return c.json({ error: "Playlist not found" }, 404);

  await c.env.DB.prepare("DELETE FROM playlist_songs WHERE playlist_id = ?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM playlists WHERE id = ?").bind(id).run();

  return c.json({ success: true });
});

playlists.get("/api/playlists/:id/tracks", async (c) => {
  const payload = c.get("jwtPayload") as { userId: number };
  const id = Number(c.req.param("id"));

  const playlist = await c.env.DB.prepare("SELECT * FROM playlists WHERE id = ? AND user_id = ?")
    .bind(id, payload.userId)
    .first();
  if (!playlist) return c.json({ error: "Playlist not found" }, 404);

  const result = await c.env.DB.prepare(
    `SELECT ps.position, s.* FROM playlist_songs ps
     JOIN songs s ON ps.song_id = s.id
     WHERE ps.playlist_id = ?
     ORDER BY ps.position`
  ).bind(id).all();

  return c.json({ tracks: result.results });
});

playlists.post("/api/playlists/:id/add", async (c) => {
  const payload = c.get("jwtPayload") as { userId: number };
  const id = Number(c.req.param("id"));
  const { songId } = await c.req.json<{ songId: number }>();

  const playlist = await c.env.DB.prepare("SELECT * FROM playlists WHERE id = ? AND user_id = ?")
    .bind(id, payload.userId)
    .first();
  if (!playlist) return c.json({ error: "Playlist not found" }, 404);

  const maxResult = await c.env.DB.prepare("SELECT MAX(position) as maxPos FROM playlist_songs WHERE playlist_id = ?")
    .bind(id)
    .first<{ maxPos: number | null }>();

  const position = (maxResult?.maxPos ?? -1) + 1;

  await c.env.DB.prepare("INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)")
    .bind(id, songId, position)
    .run();

  return c.json({ success: true, position });
});

playlists.delete("/api/playlists/:id/remove/:songId", async (c) => {
  const payload = c.get("jwtPayload") as { userId: number };
  const id = Number(c.req.param("id"));
  const songId = Number(c.req.param("songId"));

  const playlist = await c.env.DB.prepare("SELECT * FROM playlists WHERE id = ? AND user_id = ?")
    .bind(id, payload.userId)
    .first();
  if (!playlist) return c.json({ error: "Playlist not found" }, 404);

  await c.env.DB.prepare("DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?")
    .bind(id, songId)
    .run();

  return c.json({ success: true });
});

export { playlists };
