# Sean-Bailey Mkhabela – portfolio (first draft)

Plain HTML/CSS/JS, no framework. `src/` is the source; `npm run build` copies it to `dist/` and fills in the site URL.

- Build: `SITE_URL=https://your-domain npm run build` (canonical, Open Graph, sitemap and robots use it; defaults to https://seanmkhabela.github.io)
- Preview: `npm run preview` → http://localhost:4321
- Screenshots: `npm run screenshots` (needs the preview running; uses system Chrome via playwright-core)
- OG image: `node scripts/screenshots.mjs --og` regenerates `src/assets/og-image.png` from `scripts/og.html`
- Hosting: GitHub Pages at https://seanmkhabela.github.io (the built site is committed at the repo root on `main`).

Fonts: EB Garamond (body) and Gochi Hand (name and chapter numbers) from Google Fonts. The six crayon doodles are original canvas drawings in `src/main.js` (boiling-line jitter at 8 fps, redrawn at 12 fps, paused off-screen and under prefers-reduced-motion).

## Repo layout
The repo root is the published site (GitHub Pages, deploy from branch `main`, folder `/`). It holds the built output of `npm run build` (index.html, main.js, styles.css, assets/, robots.txt, sitemap.xml) plus `.nojekyll`. Source lives in `src/` and `scripts/`. To update: edit `src/`, run `npm run build`, copy `dist/` over the root, commit and push.
