# Watchlog

A personal TV and movie tracker that runs in the browser. It imports a TV Time data export,
tracks episodes and films, and shows where to stream each title in Saudi Arabia, Egypt or UAE.
All data stays on the device (IndexedDB); export a backup from Settings.

## Files

```
index.html            page shell; loads the stylesheet and scripts
css/styles.css        all styles
js/store.js           IndexedDB wrapper and app state (S)
js/util.js            helpers: escaping, toasts, local-time dates, show/episode state
js/api.js             TVmaze + TMDB: matching, episodes, trailers, providers, cast, movie details
js/watch.js           "Where to watch" links, My services, region switch
js/library.js         library lookups by TMDB id, adding titles
js/import.js          TV Time zip / JSON backup import and export, backup reminder
js/install.js         installable app: offline support and the Settings "Install app" section
js/update.js          update checks, "Update available" banner, pull-to-refresh on Home
js/views/*.js         one file per screen (home, list, show, movie, search, person, settings, stats)
                      plus common.js for shared cards and rows
js/router.js          hash router and render loop
js/main.js            startup: load data, migrations, background jobs
sw.js                 service worker: keeps the app's files so it opens offline
manifest.webmanifest  app name, colours and icons for "Add to Home Screen"
icons/                app icons
```

The scripts are plain `<script>` files (not ES modules) loaded in the order listed in
`index.html`; later files use functions defined by earlier ones, and only `main.js` starts the app.

## Running locally

Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
```

## Installing on a phone

Open the GitHub Pages address, then:

- **iPhone (Safari):** Share → Add to Home Screen
- **Android (Chrome):** ⋮ menu → Install app

On iPhone the installed app keeps its own data, separate from Safari. Export a backup in
Safari and import it in the installed app.

## Releasing

GitHub Pages serves the repository root. When releasing, bump the version in three places so
phones pick up the new files instead of cached ones:

1. `APP_VERSION` in `index.html`
2. the `?v=` on every stylesheet/script link in `index.html`
3. `VERSION` at the top of `sw.js`
