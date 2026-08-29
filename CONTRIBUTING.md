# Contributing

Contributions are made with normal GitHub pull requests. To add an entry, copy
`content/_template.md` into a new lowercase, hyphenated organism directory as
`index.md`, and complete the YAML fields.

The required hierarchy is:

```text
content/<topic>/<subject>/<record>/index.md
```

For example:

```text
content/organisms/snakes/eastern-brown-snake/index.md
```

Before opening a pull request, run:

```bash
npm run check
npm run build
```

The checker rejects duplicate IDs, invalid directory placement, missing fields,
and unsupported risk values. Search uses the title, scientific name, aliases,
taxonomy, countries, keywords, risk, topic, subject, and Markdown body.

`family`, `genus`, `species`, `subspecies`, and `tags` are always JSON-style
YAML arrays, including when only one value is present. This keeps taxonomy
multi-value and consistently searchable.

The website controls are built from namespaced values in `tags`:

- `category:snakes` adds the organism to a top-level organism menu.
- `country:Australia` adds it to the Location list.
- `keyword:tiger snake` makes that phrase available to keyword search.
- `diagnostic:Paralytic Neurotoxicity` adds it to the diagnostic questionnaire.

Each organism Markdown file contains the same short guide immediately above its
`tags` field. Multiple category, country, keyword, and diagnostic tags are valid.

To provide the organism's homepage card image, place a JPG, PNG, WebP, GIF,
AVIF, or SVG named exactly `main` in its `_images/` folder—for example,
`main.jpg`. The category placeholder remains the fallback, and `main` is shown
first in the organism gallery.

Do not remove attribution or silently alter clinical guidance. Explain medical
changes in the pull request and cite the authoritative source used.
