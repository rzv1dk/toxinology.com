# Migration status

Source: `http://54.253.37.47/`, Australia selected, accessed 2026-08-29.

## Migrated

- 547 Australian catalogue records
- Common name
- Scientific/taxonomic display name
- Risk classification
- High-level category
- Australia location tag
- Legacy image URL retained as provenance metadata
- Source URL, access date, and review status
- A dedicated folder for every individual organism
- A per-organism `record.json` export and `_images/manifest.json`
- Multi-value family, genus, species, and subspecies tag arrays
- Summary facts and all populated expandable legacy sections
- Full image source lists and source captions

Category totals match the source application:

| Subject | Records |
| --- | ---: |
| Snakes | 175 |
| Scorpions | 43 |
| Spiders | 50 |
| Other land | 21 |
| Other aquatic | 258 |

## Still to migrate or review

- The image files themselves; URLs and captions have been preserved
- Diagnostic-questionnaire logic
- Medical and editorial review of legacy content

The frontend deliberately does not hot-link legacy HTTP images because those
requests would be blocked from an HTTPS Cloudflare deployment. `image_source`
is retained in each record so licensed media can be placed in that organism's
own `_images/` folder. Supported files there appear automatically after review.
