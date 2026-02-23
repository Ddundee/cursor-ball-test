# Deploy on Render

You need **two** services: the WebSocket server (relay + physics in one process) and the Next.js app.

## Option A: Blueprint (one click)

1. Push this repo to GitHub.
2. Go to [Render Dashboard](https://dashboard.render.com) → **Blueprints** → **New Blueprint Instance**.
3. Connect the repo and use the existing `render.yaml`.
4. After the first deploy, open the **cursor-bounce-app** service → **Environment**.
5. Add (or edit) **NEXT_PUBLIC_WS_URL** and set it to your WebSocket URL:
   - **Value:** `wss://cursor-bounce-ws.onrender.com`  
   - (Use the real URL Render gave the `cursor-bounce-ws` service; it might be `cursor-bounce-ws-xxxx.onrender.com`.)
6. Save. Render will redeploy the app; the client will then connect to the same WebSocket server.

## Option B: Two separate Web Services

### 1. WebSocket server

1. **New** → **Web Service**.
2. Connect the repo, set **Root Directory** to `ws-server`.
3. **Build command:** `npm install`
4. **Start command:** `npm start`
5. **Environment:** add `HOST` = `0.0.0.0` (optional; start script already sets it).
6. Deploy. Copy the service URL (e.g. `https://your-ws-name.onrender.com`).

### 2. Next.js app

1. **New** → **Web Service**.
2. Connect the same repo, set **Root Directory** to `client`.
3. **Build command:** `npm install && npm run build`
4. **Start command:** `npm start`
5. **Environment:** add `NEXT_PUBLIC_WS_URL` = `wss://your-ws-name.onrender.com` (use **wss://** and your real WS service host).
6. Deploy.

## Local development

- **Terminal 1:** `cd ws-server && npm install && npm start` (runs WebSocket relay + physics in one process)
- **Terminal 2:** `cd client && npm run dev`
- The app uses `ws://localhost:1234` when `NEXT_PUBLIC_WS_URL` is not set.

## Notes

- Free tier services spin down after inactivity; the first open after a while may be slow.
- Use **wss://** (not **ws://**) for `NEXT_PUBLIC_WS_URL` in production so the browser allows the connection from an HTTPS site.
