# afterglow-viz
Audio-reactive visualizer and ambient backdrop for Spotify, built as a Spicetify custom app

For now it only opens a diagnostics page that checks what audio data Spotify gives it. The visualizer is next.

## Install

Needs [Spicetify](https://spicetify.app) and Node 22.12+.

```
npm install
npm run install-local
```

Then open afterglow-viz from the Spotify sidebar.

## Dev

```
npm run dev
```

Opens http://127.0.0.1:5173/dev.html with a fake Spotify player, so you can work on it in a normal browser.
