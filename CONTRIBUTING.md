# Contributing

Bug reports and fixes are welcome.

## Set up

Needs Node 22.12 or newer.

```
npm install
npm run dev
```

`npm run dev` opens a test page with a fake Spotify player at http://127.0.0.1:5173/dev.html. To try the app in real Spotify, run `npm run install-local`.

## Before you send a change

```
npm run typecheck
npm test
npm run build
```

CI runs the same three on every push.

## Pull requests

Keep each one to a single change, and say what it changes for the person using the app.
