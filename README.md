# Ember

A personal workout tracker that runs as a web app. Tap a muscle on the body map to log sets, track PBs, and watch the red recovery fill fade. It's self-hosted with Docker and only reachable from your own devices over Tailscale.

## Features

- **Body map:** a shaded 2.5D front/back figure. Tap a muscle to log a workout; swipe or press the turn button to see the other side. Three views:
  - **Recovery:** trained muscles fill red and fade over their rest period.
  - **Volume:** weekly sets against a 10–20 target.
  - **Neglected:** muscles with no direct work in 10+ days pulse amber.
- **Logging and PBs:** every exercise shows its PB. Exercises are weighted (reps × kg), bodyweight (reps, optional added kg) or timed (with a stopwatch). The logger suggests your next target and has a plate calculator.
- **Plyometrics and mobility:** jumps, bounds and throws are logged as ground contacts and add leg fatigue by intensity; stretching and activation work (dead bugs, couch stretch, balance…) is logged without adding fatigue. Both are in the + menu and on each muscle.
- **Injuries:** log an injury by area and side; it's outlined on the body map and kept out of your daily plan until you mark it recovered. History shows days out and severity (FIFA consensus). Weekly prevention targets (Nordic curls, Copenhagen adductor, jumping and landing, balance) come from trials in footballers, are scheduled around match days, and are flagged as a priority where you've been injured before.
- **Workouts:** start a session to get a rest timer between sets and a finish summary (duration, volume, PBs, effort).
- **Routines:** save routines, start one as a guided workout, or quick-log the whole thing in one tap.
- **Football:** log matches and training (minutes × effort). Football loads your legs on the body map, and the daily plan works around your match and training days (set in Settings).
- **Daily plan:** learns your weekly routine and suggests exercises, skipping recovering or sore muscles. Use the soreness check-in when something aches.
- **Training load:** your acute:chronic workload ratio across gym and football, with a warning when load spikes.
- **Tracker:** a contribution graph, a calendar with day detail, and your weekly rhythm.
- **Progress:** per-exercise history with estimated 1RM, Personal Bests, Bodyweight trend and Year in Review.
- **Evidence-based estimates:** effort per set is inferred as reps in reserve from your estimated 1RM (Wathen), fatigue decays exponentially per muscle, weekly volume counts hard sets, and training load uses session-RPE with an EWMA acute:chronic ratio. Settings → How the numbers work lists the sources.
- **Works offline:** changes save on the device and sync when you're back online.
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
