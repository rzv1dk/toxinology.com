# Toxinology.com static catalogue

This repository is both the website source and the content database. Every
catalogue record is a Markdown file with YAML front matter, stored as:

```text
content/<topic>/<subject>/<record>/index.md
```

Each organism has its own self-contained folder. It contains `index.md`, an
exported `record.json`, and an `_images/` folder with a source manifest and space
for locally stored organism images. Every JPG, JPEG, PNG, GIF, WebP, AVIF, or SVG
placed in `_images/` is copied and displayed automatically on that organism's
page. `npm run placeholders:install` adds the appropriate generated category
placeholder icon to every organism folder. The current Australian migration is under
`content/organisms/`. Run `npm run export:bundles` after a bulk import to refresh
the per-organism JSON bundles. A dependency-free Node build converts the
Markdown into static HTML and a compact JSON search
index. The resulting `public/` folder can be served directly by Cloudflare Pages
and cached globally.

Editable website styling, browser behaviour, fonts, and icons live in `style/`.
The build copies those assets into the generated `public/` website. Do not edit
`public/` directly because the next build replaces it.

For the homepage card image, add one supported image named exactly `main` to the
organism's `_images/` folder, such as `main.jpg` or `main.webp`. Without a `main`
image, the organism's category placeholder is used automatically. A `main`
image is also shown first in the organism gallery.

## Local use

```bash
npm run check
npm run placeholders:install
npm run normalize:content
npm run tags:rebuild
npm run export:bundles
npm run build
npm run dev
npm run validate:complete
```

Then open <http://localhost:8788>.

`npm run tags:rebuild` is mainly for bulk imports. It refreshes country,
keyword, and diagnostic tags from the structured migrated content. For ordinary
GitHub contributions, contributors can edit the clearly documented `tags` array
in the individual organism Markdown file.

For a no-server preview, double-click the root-level `index.html`. Search,
filters, and links to the generated organism pages work directly from disk.

## Cloudflare Pages

Connect the GitHub repository in Cloudflare Pages with:

- Build command: `npm run build`
- Build output directory: `public`
- Node version: 20 or newer

Every generated organism page in `public/record/<organism>/` also keeps its own
HTML page, `record.json`, and `_images/` folder. Shared CSS and icons remain common
site assets so the architecture stays small and cache-friendly.

Every accepted GitHub pull request becomes content in the next deployment.
Cloudflare Pages supplies preview deployments for pull requests and publishes
the default branch to production.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the content format and review flow.

## Important

This is an information catalogue, not a clinical decision system. Medical
content should retain its source attribution and be reviewed by an appropriate
subject-matter expert before publication.
