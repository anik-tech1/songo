# Deploy SonGO — Cloudflare Workers

## Cost: $0/month (all free tier)

| Service | What | Free Tier |
|---|---|---|
| Cloudflare Workers | API + Frontend | 100K requests/day |
| Cloudflare D1 | Database | 5GB storage |
| Backblaze B2 | MP3 Storage | 10GB, zero egress fees |

---

## Step 1: Create Accounts

1. **Cloudflare** — [dash.cloudflare.com](https://dash.cloudflare.com) (free, no card)
2. **Backblaze B2** — [backblaze.com](https://backblaze.com) (free, no card)

---

## Step 2: Get Cloudflare API Token

1. Go to [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
2. **Create Token** → Use **"Edit Cloudflare Workers"** template
3. Copy the token

```bash
export CLOUDFLARE_API_TOKEN="your-token"
```

---

## Step 3: Create D1 Database

```bash
npx wrangler d1 create songo-db
```

Copy the `database_id` and update `wrangler.jsonc`:

```jsonc
"database_id": "paste-here"
```

---

## Step 4: Set Backblaze B2 Secrets

```bash
echo "your-b2-key-id" | npx wrangler secret put B2_KEY_ID
echo "your-b2-app-key" | npx wrangler secret put B2_APP_KEY
echo "your-jwt-secret" | npx wrangler secret put JWT_SECRET
```

---

## Step 5: Deploy

```bash
npx wrangler deploy
```

You'll get a URL like `songo.WORKERS.dev`.

---

## Step 6: Upload Music

On your local machine:

```bash
# Create B2 account + bucket "songo-music" (Private)

export B2_KEY_ID="your-key-id"
export B2_APP_KEY="your-app-key"
export B2_BUCKET="songo-music"

# Add MP3s
mkdir -p tracks
cp ~/Music/*.mp3 tracks/

# Upload to B2
node scripts/upload-tracks.mjs
```

---

## Step 7: Visit Your Site

Open the URL from Step 5. Login with **admin** / **password**.

The server auto-seeds: creates the admin user and imports all tracks from B2 on first request.

---

## Updating

```bash
npx wrangler deploy
```

## Useful Commands

```bash
npx wrangler tail                # view live logs
npx wrangler d1 execute songo-db --command="SELECT * FROM songs"  # query DB
npx wrangler secret list          # list secrets
```
