# Running a local web server

Two things in one place: the exact commands for **this** project, and the general idea
underneath so the same knowledge works on any other project.

---

## TL;DR for this project

```bash
cd ~/projects/availo/frontend   # the app lives in frontend/, not the repo root
docker compose up -d dev-db     # start the database FIRST
npm run dev                     # start the web server
```

Then open <http://localhost:3000>. Stop it with **Ctrl+C** in that terminal.

---

## What a "local web server" actually is

A web server is just a program that listens on a **port** on your machine and answers
HTTP requests. Nothing about it is special or remote:

| Piece | What it means |
|---|---|
| `localhost` | A name that always points back at your own computer (`127.0.0.1`). Traffic never leaves the machine. |
| `:3000` | The **port** — a numbered door. One program per port at a time. 3000 is a convention for Node dev servers, nothing more. |
| `http://localhost:3000` | "Talk HTTP to the program listening on door 3000 of this computer." |

So "starting a local web server" = "run a program that listens on a port". That's it.
The browser doesn't know or care that the server is on the same machine.

### Why `-H 0.0.0.0` shows up in our `dev` script

`package.json` runs `next dev -H 0.0.0.0`. The `-H` flag is which network interface to
listen on:

- `127.0.0.1` (the default) — only *this* machine can connect.
- `0.0.0.0` — listen on **every** interface, so other devices on your Wi-Fi can reach it too.

We use `0.0.0.0` because ~90% of this app's traffic is mobile and testing on a real
phone is routine. See [Testing on your phone](#testing-on-your-phone) below.

---

## This project, step by step

### 1. Be in the right directory

```bash
cd ~/projects/availo/frontend
```

There is **no `package.json` at the repo root** — the whole Next.js app is `frontend/`.
Running `npm run dev` one level up just errors.

### 2. Start the database

```bash
docker compose up -d dev-db
```

This is the step people skip. **`npm run dev` is only a web server** — it holds no data.
The data lives in whatever `DATABASE_URL` in `.env` points at:

```
DATABASE_URL="postgresql://availo:availo@localhost:55433/availo_dev"
ALLOWED_DB_HOSTS=localhost
```

`docker compose up -d dev-db` starts a Postgres 17 container on **port 55433** with a
persistent volume, which is what that URL names. `-d` means detached (runs in the
background); it's safe to run when it's already up — it just says `Running`.

> There is a second container, `test-db`, on port **55432**. That one is disposable and
> only used by `npm run test:integration`. Don't confuse the two ports.

Check it's healthy:

```bash
docker compose ps
```

### 3. Start the web server

```bash
npm run dev
```

You should see:

```
▲ Next.js 16.2.12 (Turbopack)
- Local:         http://localhost:3000
- Network:       http://0.0.0.0:3000
✓ Ready in 186ms
```

**Leave this terminal open.** The server runs until you stop it. It watches your files
and hot-reloads the browser as you edit.

### 4. Use it

Open <http://localhost:3000>.

Requests are logged in the same terminal as you browse — useful for spotting a 404 or a
slow page:

```
GET / 200 in 385ms
```

### 5. Stop it

**Ctrl+C** in that terminal. The database keeps running (it's detached); stop it
separately when you want to:

```bash
docker compose stop dev-db     # keeps the data
docker compose down            # stops and removes containers, data volume survives
```

---

## Running it in the background instead

If you'd rather keep the terminal:

```bash
npm run dev > /tmp/availo-dev.log 2>&1 &
```

- `> /tmp/availo-dev.log` sends output to a file
- `2>&1` sends errors to the same file
- `&` puts it in the background

Then watch it with `tail -f /tmp/availo-dev.log`, and stop it with:

```bash
pkill -f "next dev"
```

Trade-off: you no longer see errors scroll by, which is exactly when you most want them.
For day-to-day work the foreground terminal is better.

---

## Checking whether it's already running

```bash
curl -sI http://localhost:3000        # a response means something is there
ss -ltnp | grep :3000                 # which process holds the port (Linux)
```

---

## Testing on your phone

Because the server listens on `0.0.0.0`, any device on the same Wi-Fi can load it.

1. Find your machine's LAN IP:

   ```bash
   hostname -I | awk '{print $1}'      # e.g. 192.168.1.27
   ```

2. On the phone, open `http://192.168.1.27:3000`.

### The trap that will cost you an hour

Next.js **blocks cross-origin requests to dev-only endpoints by default**. If your subnet
isn't allowed, the `/_next/webpack-hmr` request is refused, the dev runtime never finishes
booting, and **React never hydrates**.

The failure is completely silent in the browser: pages render, links navigate, and **no
button responds**. It looks exactly like a broken app. Only the terminal says otherwise:

```
Blocked cross-origin request
```

`next.config.ts` already allows `192.168.1.*`. If your router hands out a different range
(`192.168.0.x`, `10.0.0.x`, …), add it:

```ts
allowedDevOrigins: ["192.168.1.*", "10.0.0.*"],
```

Dev-only — it has no effect on `next build` or production.

**So: before debugging "unresponsive buttons on mobile", read the dev server output.**

---

## Dev server vs. production server

Two different things, and `npm run dev` is not what runs on Vercel:

| | `npm run dev` | `npm run build` + `npm run start` |
|---|---|---|
| Speed | Instant start, hot reload | Slow build, then fast serving |
| Code | Unminified, dev warnings on | Optimised, minified |
| Use for | Writing code | Checking bundle size, catching build-only errors |

To run production mode locally:

```bash
npm run build
npm run start
```

> **Careful:** `npm run build` is not just a build here — the script is
> `preflight-db → prisma migrate deploy → next build`, so it **applies migrations** to
> whatever `DATABASE_URL` points at. That's fine against local Docker Postgres. It is the
> reason the production connection string should never exist on this machine.

---

## When it won't start

| Symptom | Cause | Fix |
|---|---|---|
| `EADDRINUSE: address already in use :::3000` | Another server already has the port | `pkill -f "next dev"`, or run on another port: `npm run dev -- -p 3001` |
| `Can't reach database server at localhost:55433` | Postgres isn't running | `docker compose up -d dev-db` |
| `@prisma/client did not initialize yet` | Generated client missing | `npx prisma generate` |
| Pages load but every button is dead **on a phone** | Cross-origin block → no hydration | Add your subnet to `allowedDevOrigins` (above) |
| App loads but there's no data | Empty database | `npx prisma migrate deploy && npm run db:seed` — rebuilds admin/admin1234, Settings, four services and the weekly schedule |
| `Missing script: "dev"` | Wrong directory | `cd frontend` |

---

## Doing this on any other project

The pattern is always: **install deps, then run the dev script.**

```bash
npm install     # or pnpm install / yarn
npm run dev     # check package.json "scripts" for the real name
```

If you don't know the script name, look:

```bash
cat package.json | python3 -c "import json,sys; print(json.load(sys.stdin)['scripts'])"
```

Common names: `dev`, `start`, `serve`.

### Serving a plain folder of files

If there's no framework at all — just `.html`, `.css`, `.js` on disk — you still often
want a server rather than double-clicking the file, because `file://` breaks `fetch`,
ES modules, and anything CORS-related.

```bash
python3 -m http.server 8000        # built into Python, nothing to install
npx serve                          # Node, nicer output, handles SPA routing
php -S localhost:8000              # if you happen to have PHP
```

Then open <http://localhost:8000>. `python3 -m http.server` serves the **current
directory**, so `cd` to the folder you want first.

### Why not just open the HTML file directly?

Opening `file:///home/you/index.html` works for pure static markup, but the browser
treats `file://` as a hostile origin: `fetch()` fails, `<script type="module">` fails,
and cookies/localStorage behave differently. One `python3 -m http.server` avoids all of it.

---

## Quick reference

```bash
cd ~/projects/availo/frontend

docker compose up -d dev-db     # database (port 55433)
npm run dev                     # web server (port 3000)   -> Ctrl+C to stop

npm run dev -- -p 3001          # different port
hostname -I | awk '{print $1}'  # LAN IP, for phone testing

npm run build && npm run start  # production mode locally
npm run db:seed                 # repopulate an empty database
docker compose stop dev-db      # stop the database
```
