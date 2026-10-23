# Ember

A personal workout tracker that runs as a web app. Tap a muscle on the body map to log sets, track PBs, and watch the red recovery fill fade. It's self-hosted with Docker and only reachable from your own devices over Tailscale.

## Features

- **Body map:** a shaded 2.5D front/back figure. Tap a muscle to log a workout, swipe or press the turn button to see the other side. Trained muscles get a red fill that fades over that muscle's recommended rest period (36–72h). Exercises also fade their secondary muscles at half strength.
- **Logging and PBs:** each exercise shows its PB (for example `PB 25 kg × 8`). Expand it to log sets (reps × kg). The form prefills from your last session and tells you when you're about to beat your PB.
- **Daily plan:** learns which muscles you train on each weekday over the last 12 weeks ("Mondays are usually lower body days") and suggests exercises, skipping muscles that are still recovering. It opens once a day until you log something.
- **Tracker:** a contribution graph, a month calendar (tap a day to see or delete entries), and your weekly rhythm.
- **Personal Bests:** every PB, searchable.
- **Export backup:** in the drawer, downloads all your data as JSON.

## Run locally (development)

Requires Node 24+.

```sh
npm install
npm run dev        # API on :3000, app on http://localhost:5173
```

The SQLite database is written to `./data/fitness.db`.

## Deploy with Docker + Tailscale

1. In the [Tailscale admin console](https://login.tailscale.com/admin/dns), enable **MagicDNS** and **HTTPS certificates**.
2. Create an auth key under **Settings → Keys**.
3. Copy `.env.example` to `.env` and paste in the key.
4. Run:

   ```sh
   docker compose up -d --build
   ```

5. Open `https://ember.<your-tailnet>.ts.net` on any device that has Tailscale installed. On the host machine itself, `http://localhost:3000` also works.

**Install on iPhone:** open the URL in Safari, then **Share → Add to Home Screen**. It launches full-screen like a native app.

Data lives in the `app-data` Docker volume. To update after changing code, run `docker compose up -d --build`.

If Tailscale is already installed on the host, you can skip the sidecar. Run the `app` service with `ports: ["127.0.0.1:3000:3000"]` instead of `network_mode`, then run `tailscale serve --bg 3000`.
