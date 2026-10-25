# afterglow-viz
Audio-reactive visualizer and ambient backdrop for Spotify, built as a Spicetify custom app

![afterglow-viz](docs/demo.gif)

Rings, bars, particles and the album art, all moving with the song. It uses Spotify's own analysis of each track, so the beats and loudness actually line up.

## Install

You need [Spicetify](https://spicetify.app) set up first.

1. Download `afterglow-viz.zip` from the [latest release](https://github.com/sjdsjadjajdjsa/afterglow-viz/releases/latest).
2. Unzip it into your Spicetify `CustomApps` folder, so you end up with `CustomApps/afterglow-viz/index.js`.
   - Windows: `%appdata%\spicetify\CustomApps`
   - Mac and Linux: `~/.config/spicetify/CustomApps`
   - Not sure? Run `spicetify -c`. It prints the config file's path, and `CustomApps` sits in the same folder.
3. Run these two commands:
   ```
   spicetify config custom_apps afterglow-viz
   spicetify apply
   ```
4. Open afterglow-viz from Spotify's sidebar.

## Using it

- Move your mouse near the bottom for play controls, settings and full view.
- In settings, pick a look, or mix your own and save it.
- Full view fills the Spotify window. Esc goes back.

## Build it yourself

Needs Node 22.12 or newer.

```
npm install
npm run install-local
```

`npm run dev` opens a test page with a fake Spotify player at http://127.0.0.1:5173/dev.html.
