# Deploy SonGO — Railway + Backblaze B2

## Cost: $0/month
- **Railway:** $5 free credit/month (enough for a small server)
- **Backblaze B2:** 10GB free storage

---

## Step 1: Create Backblaze B2 Account

1. Go to [backblaze.com](https://backblaze.com) → **Sign Up**
2. No credit card needed
3. Once logged in, go to **B2 Cloud Storage** → **Buckets**
4. Click **Create a Bucket**
   - Bucket Name: `songo-music`
   - Files in Bucket: **Private**
   - Default Encryption: **Disable**
5. Go to **App Keys** (left sidebar) → **Add a New Application Key**
   - Name: `songo`
   - Bucket: `songo-music`
   - Permissions: **Read and Write**
6. **Copy the keyID and applicationKey** — you won't see them again

---

## Step 2: Create Railway Account

1. Go to [railway.app](https://railway.app) → **Login with GitHub**
2. No credit card needed
3. You get **$5 free credit/month**

---

## Step 3: Push Code to GitHub

```bash
cd ~/Documents/Ml/SOnGO

# Initialize git
git init
git add .
git commit -m "initial commit"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/songo.git
git push -u origin main
```

---

## Step 4: Deploy on Railway

1. Go to [railway.app/dashboard](https://railway.app/dashboard)
2. Click **New Project** → **Deploy from GitHub Repo**
3. Select your `songo` repo
4. Once deployed, click the service → **Settings**
5. Go to **Variables** tab and add:

| Variable | Value |
|---|---|
| `B2_KEY_ID` | Your Backblaze keyID |
| `B2_APP_KEY` | Your Backblaze applicationKey |
| `B2_BUCKET` | `songo-music` |
| `JWT_SECRET` | Any random string (e.g. `my-super-secret-123`) |

6. Railway auto-detects Node.js and deploys
7. Click **Deploy** → wait for it to build
8. Go to **Settings** → **Networking** → **Generate Domain** to get a public URL

---

## Step 5: Set Up Database + Upload Music

On your local machine:

```bash
# Install dependencies
npm install

# Create admin user (in local SQLite for now — we'll fix this)
node scripts/create-user.mjs admin your-password
```

For the remote database on Railway, you have two options:

### Option A: Use Railway's PostgreSQL (Recommended)
Railway offers free PostgreSQL. In Railway dashboard:
1. Click **New** → **Database** → **PostgreSQL**
2. Copy the `DATABASE_URL` variable
3. Add it to your service's variables

Then I'll update the code to use PostgreSQL instead of SQLite.

### Option B: Use SQLite on Railway (simpler)
Railway's filesystem persists between deploys for the service itself. Just set the `HOME` env var and SQLite will work. But this is less reliable.

---

## Step 6: Upload Music to B2

```bash
# Set your B2 credentials
export B2_KEY_ID="your-key-id"
export B2_APP_KEY="your-app-key"
export B2_BUCKET="songo-music"

# Create tracks folder and add MP3s
mkdir -p tracks
cp ~/Music/*.mp3 tracks/

# Upload to B2 + insert into DB
node scripts/upload-tracks.mjs
```

---

## Step 7: Open B2 Bucket for Streaming

By default, B2 buckets are private. For streaming, you need to either:

### Option A: Make files public (easiest)
In B2 dashboard → **Buckets** → `songo-music` → **Bucket Info**:
- Change **Files in Bucket** from Private to **Public**

### Option B: Keep private + use signed URLs (more secure)
The app already generates signed URLs — no changes needed.

---

## Quick Reference

| What | Where |
|---|---|
| Server | [railway.app](https://railway.app) |
| MP3 Storage | [backblaze.com/b2](https://backblaze.com) |
| Music Files | B2 bucket `songo-music` |
| URL | Railway generates one for you |

## Useful Commands

```bash
# Railway CLI
npm install -g @railway/cli
railway login
railway logs          # view logs
railway variables     # list env vars
railway up            # manual deploy
```
