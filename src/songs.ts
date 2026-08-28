import { Hono } from "hono";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getB2Object, headB2Object } from "./storage";
import { getDb } from "./db";

const songs = new Hono();

songs.get("/api/songs", async (c) => {
  const db = getDb();
  const result = db.prepare("SELECT * FROM songs ORDER BY created_at DESC").all();
  return c.json({ songs: result });
});

songs.get("/api/songs/:id", async (c) => {
  const id = c.req.param("id");
  const db = getDb();
  const song = db.prepare("SELECT * FROM songs WHERE id = ?").get(id);
  if (!song) return c.json({ error: "Song not found" }, 404);
  return c.json({ song });
});

songs.get("/api/stream/:id", async (c) => {
  const id = c.req.param("id");
  const db = getDb();
  const song = db.prepare("SELECT * FROM songs WHERE id = ?").get(id) as
    | { r2_key: string; title: string }
    | undefined;
  if (!song) return c.json({ error: "Song not found" }, 404);

  const rangeHeader = c.req.header("range");

  try {
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : undefined;

      const rangeStr = end !== undefined ? `bytes=${start}-${end}` : `bytes=${start}-`;

      const command = new GetObjectCommand({
        Bucket: process.env.B2_BUCKET || "songo-music",
        Key: song.r2_key,
        Range: rangeStr,
      });

      const response = await getB2Object(song.r2_key);
      const contentRange = response.ContentRange;
      const contentLength = response.ContentLength;

      if (!response.Body) return c.json({ error: "No body" }, 500);

      const webStream = response.Body.transformToWebStream();

      return new Response(webStream, {
        status: 206,
        headers: {
          "Content-Range": contentRange || `bytes ${start}-${end || "*"}/0`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(contentLength || 0),
          "Content-Type": response.ContentType || "audio/mpeg",
        },
      });
    }

    const response = await getB2Object(song.r2_key);
    if (!response.Body) return c.json({ error: "No body" }, 500);

    const webStream = response.Body.transformToWebStream();

    return new Response(webStream, {
      status: 200,
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Length": String(response.ContentLength || 0),
        "Content-Type": response.ContentType || "audio/mpeg",
      },
    });
  } catch (err: any) {
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      return c.json({ error: "Audio file not found in B2" }, 404);
    }
    return c.json({ error: err.message || "Stream error" }, 500);
  }
});

songs.get("/api/download/:id", async (c) => {
  const id = c.req.param("id");
  const db = getDb();
  const song = db.prepare("SELECT * FROM songs WHERE id = ?").get(id) as
    | { title: string; r2_key: string }
    | undefined;
  if (!song) return c.json({ error: "Song not found" }, 404);

  try {
    const response = await getB2Object(song.r2_key);
    if (!response.Body) return c.json({ error: "No body" }, 500);

    const webStream = response.Body.transformToWebStream();
    const safeTitle = song.title.replace(/[^a-zA-Z0-9_\- ]/g, "_");

    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${safeTitle}.mp3"`,
        "Content-Type": "audio/mpeg",
        "Content-Length": String(response.ContentLength || 0),
      },
    });
  } catch (err: any) {
    return c.json({ error: "File not found" }, 404);
  }
});

export { songs };
