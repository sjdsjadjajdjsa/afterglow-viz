# afterglow-viz
Audio-reactive visualizer and ambient backdrop for Spotify, built as a Spicetify custom app

Rings, a mirrored spectrum, particles and the album art, moving with Spotify's own analysis of the track. The sliders button at the bottom right opens the settings, where you can also save presets.

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
