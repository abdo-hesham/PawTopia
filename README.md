# Pawtopia

An illustrated scroll story for a pet care brand, built as a single-page site with three routes: a seven-chapter journey, a shop, and a checkout. One continuous paw trail walks the whole page — a whisper inside a chapter, the protagonist in the space between them.

Built with vanilla JavaScript, Vite, GSAP + ScrollTrigger and Lenis. No framework.

## Quick start

```bash
npm install
npm run dev
```

The dev server prints a local URL (Vite's default is `http://localhost:5173`).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run optimize:images` | Re-encode source art to capped-size webp |
| `npm run share-card` | Regenerate `public/pawtopia-share.jpg` (the Open Graph card) |

Node 18 or newer.

## How it is put together

```
index.html      all three views in one document, plus critical CSS for the loader
src/main.js     scene motion, the paw journey, routing, cart, panels, the loader
src/motion.js   the shared motion vocabulary — eases, scrubs, reveal and exit helpers
src/shop.js     catalogue, filters, pagination, product dialog (loaded on demand)
src/checkout.js the four checkout steps and the order summary (loaded on demand)
src/calendar.js the booking calendar in the vet dialog
src/style.css   the story; imports shop.css and micro.css
assets/         source illustrations; the shipped art is the .webp next to each
scripts/        image pipeline and share-card generation
```

Routing is client-side over the History API — `/`, `/shop` and `/checkout` are three views in one document, swapped behind a cream wipe. The shop and checkout chunks are fetched on demand and pre-warmed once the story has painted.

Every chapter is one reversible GSAP timeline written in viewport-heights of scroll, so scrubbing back unwinds exactly what scrubbing forward played.

## Deploying to Vercel

The repo ships a `vercel.json`, so no dashboard configuration is needed:

- build command `npm run build`, output directory `dist`
- a rewrite that sends every non-asset path to `index.html`, which the client-side router needs so `/shop` and `/checkout` survive a hard refresh
- a one-year immutable cache header for the fingerprinted files in `/assets`

To deploy:

1. Push this repository to GitHub.
2. In Vercel, **Add New Project**, import the repository, and accept the detected settings.
3. Deploy. No environment variables are required.

Or from the CLI:

```bash
npx vercel
```

### The host is written down in four places

`index.html` (canonical + Open Graph), `public/robots.txt`, `public/sitemap.xml` and `public/llms.txt` all name `https://pawtopia-six.vercel.app`. Change all four together when the site moves to its own domain. Every route rewrites the document's own tags at runtime from `location.origin`, so a stale host there only reaches crawlers that do not run scripts — the three text files are served as written.

The four social links in both footers point at the platform home pages as placeholders. Swap the `href` values in `index.html` (`.footer-social`) for the real profiles before launch.

## Accessibility and motion

- `prefers-reduced-motion` is honoured throughout: the scroll story plays as a static page, the loader shows its trail already finished, and micro-interactions keep the colour change while dropping the movement.
- Drawers move focus into the panel, make the rest of the page `inert`, and return focus to whatever opened them.
- The vet booking calendar and the shop's sort control are built from real buttons with `listbox` and `grid` semantics, so both work from the keyboard.

## Credits

Illustrations and product photography are placeholders for a portfolio piece; prices and stock are fictional.
