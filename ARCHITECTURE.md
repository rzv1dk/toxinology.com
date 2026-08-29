# Toxinology Architecture and Contribution Workflow

## Overview

Toxinology is a public, read-heavy reference catalogue. Its information changes relatively infrequently, so the website is built as a collection of static files rather than generating every page from a live database.

GitHub stores and reviews the source material. Cloudflare builds the source and distributes the completed website worldwide.

```text
Contributor
    ↓
Creates a branch and edits Markdown, YAML or images
    ↓
Opens a pull request in GitHub
    ↓
Automated validation checks the complete catalogue
    ↓
An authorised maintainer reviews and approves the change
    ↓
The pull request is merged into the main branch
    ↓
Cloudflare detects the Git change and runs npm run build
    ↓
The generated public website is deployed and cached worldwide
```

Visitors do not contact GitHub or a database when they use the website. They receive completed files from Cloudflare.

## Source structure

Each organism is self-contained in its own folder:

```text
content/
└── organisms/
    └── <subject>/
        └── <individual-organism>/
            ├── index.md
            ├── record.json
            └── _images/
                ├── main.jpg
                └── other-images.jpg
```

- `index.md` is the primary editable record.
- YAML at the beginning of `index.md` provides structured metadata for menus, searching and filtering.
- The Markdown body contains the complete organism information, including first aid, diagnosis, clinical effects, treatment and references.
- `_images/` contains every image belonging to that organism.
- An image whose base filename is `main` is used on the catalogue page.
- `record.json` is a portable structured representation of the record.

The important YAML fields include:

- Common name and aliases
- Family, genus, species and subspecies
- Countries and locations
- Keywords
- Diagnostic effects
- Risk classification
- Source and review information

Metadata fields may contain multiple values where appropriate.

## What contributors edit

Contributors normally edit files in:

- `content/` for organism records and images
- `style/` for presentation and browser behaviour
- `scripts/` for validation and site generation
- `wrangler.jsonc` for Cloudflare deployment configuration

The `public/` directory is generated output. It should not be edited manually or committed to GitHub. Cloudflare recreates it during every build.

## Contribution and approval process

### 1. Create a branch

Contributors should create a branch from the latest `main` branch. Suggested names include:

```text
content/update-mainland-tiger-snake
content/add-new-organism
fix/country-filter
style/mobile-layout
```

Direct changes to `main` should be reserved for authorised maintainers and exceptional administrative work.

### 2. Make the change

For an organism update, edit its `index.md` file and place associated images in that organism's `_images` folder. Keep the YAML field names and value formats consistent with `content/_template.md`.

Do not edit generated files in `public/`.

### 3. Validate locally

Run the complete validation before requesting review:

```bash
npm install
npm run validate:complete
```

This validates all Markdown records, rebuilds the website and checks the generated pages, search data, image folders and record bundles.

For a local preview, run:

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:8788/index.html
```

### 4. Open a pull request

Push the branch to GitHub and open a pull request into `main`. The pull request should explain:

- What changed
- Which organisms or website areas are affected
- Where factual information came from
- Whether images were added or replaced
- How the change was checked

### 5. Automated validation

GitHub runs the validation workflow in `.github/workflows/validate.yml`. A pull request should not be merged when validation fails.

### 6. Review and approval

An authorised maintainer reviews the factual content, metadata, formatting, image placement and generated result. Requested corrections are made on the contributor's branch.

Once the change is satisfactory, the maintainer approves the pull request.

### 7. Merge into `main`

The approved pull request is merged into `main`. The merge provides a permanent record of:

- Who proposed the change
- Who reviewed and approved it
- Which files changed
- Why the change was made
- When it was published

### 8. Cloudflare rebuild and deployment

Cloudflare monitors `main`. A successful merge or direct push triggers:

```text
npm run build
npx wrangler deploy
```

The build reads all organism records and creates the deployable `public/` directory. Cloudflare then uploads the static assets and publishes a new Worker version.

The deployment log should include messages similar to:

```text
Built 547 records into public/.
Read 3317 files from the assets directory
```

If a build or deployment fails, the existing production version remains available while the failure is corrected.

## Recommended GitHub protection for `main`

The repository owner should configure a branch protection ruleset for `main` with:

- Pull requests required before merging
- At least one approval required
- The validation workflow required to pass
- Conversations required to be resolved
- Force pushes disabled
- Branch deletion disabled

These controls ensure that community contributions are reviewed before publication.

## Runtime architecture

```text
GitHub source repository
        ↓ change to main
Cloudflare build environment
        ↓ npm run build
Generated HTML, JSON, CSS, JavaScript and images
        ↓ deployment
Cloudflare global network
        ↓ cached response
Website visitor
```

GitHub acts as the source-control-backed content management system. Cloudflare acts as the build platform, web host and global content delivery network.

There is no runtime application server and no runtime database dependency.

## Advantages

### Performance

Pages are generated before visitors request them. Cloudflare can return the completed files from a nearby location without waiting for application code or a database query.

### Global caching

HTML, JSON, CSS, JavaScript, fonts and images are static assets. They are well suited to caching across Cloudflare's global network.

### Reliability

The public website does not depend on GitHub being available after deployment. It also has no database connection pool, query service or application server that can fail during a visitor request.

### Security

The public site contains no database credentials. Its small runtime surface reduces patching, attack paths and operational complexity.

### Auditability

Git records every change. Pull requests provide discussion, review, approval and source attribution before publication.

### Cost and scalability

Static files are inexpensive to serve. Large traffic increases are absorbed by Cloudflare's cache rather than increasing database and application-server load.

### Portability

Each organism is readable without specialised database software. The Markdown, YAML, JSON and image files can be copied, reviewed, archived or rebuilt using standard tools.

## Disadvantages and limitations

- Every published change requires a build and deployment.
- Git and pull requests may be unfamiliar to occasional contributors.
- Large collections of images can increase repository size.
- Simultaneous edits to the same record can create merge conflicts.
- Browser-side catalogue searching is appropriate for the current collection but may need a dedicated search service at a much larger scale.
- This architecture is not intended for high-frequency visitor submissions, private user data or transactional operations.

## Why a traditional database adds little for this catalogue

This catalogue is public, changes infrequently and is read far more often than it is written. It does not currently require transactions, live inventory, user accounts, personalised results or continuously changing records.

A traditional database-backed request often follows this path:

```text
Visitor
    ↓
Application server
    ↓
Database connection and query
    ↓
Server-side page generation
    ↓
Response
```

That path can introduce:

- Additional network round trips
- Database connection and query time
- Server-side processing
- More infrastructure and failure points
- Database backups, upgrades and security maintenance
- Extra scaling and monitoring requirements

The current static path is shorter:

```text
Visitor
    ↓
Nearby Cloudflare cache
    ↓
Completed file
```

For this workload, adding a live database would not make the public pages more current or more searchable. It would reproduce work at request time that the build system can perform once in advance.

## Important caching clarification

A database-backed website can be cached. However, the database query itself is not automatically distributed to Cloudflare locations.

An application must first query the database, generate a response and then apply caching rules. It must also manage cache keys, expiry, invalidation and the behaviour of uncached requests. The database and application server remain necessary even when most responses are cached.

In the current architecture, the generated files are already the final cacheable result. There is no runtime query that needs to be accelerated or invalidated.

## When a database would become useful

A database would provide meaningful advantages if Toxinology later required:

- Frequent or real-time updates
- Visitor accounts and authentication
- Private or permission-controlled records
- Online editing outside the GitHub workflow
- Comments, submissions or saved preferences
- Transactions or workflow state
- Continuously changing measurements or availability
- Complex reporting over millions of records

If those requirements emerge, a database or specialised service can be added for those features without discarding the static public catalogue.

## Summary

For the current Toxinology workload, GitHub-managed Markdown and Cloudflare static delivery provide a faster, simpler and more resilient system than a runtime database-backed website.

Contributors can propose changes without gaining production access. Maintainers review and approve those changes before merging them into `main`. Cloudflare then builds and distributes the approved version globally.
