# Minimal Imba WebExt

A minimal, dependency-light browser extension starter using Imba and Bun. No bundler, no framework boilerplate: a single build script compiles, packages, tests and prepares store-ready archives for Chrome and Firefox.

## Project structure

- `app/` contains extension sources
- `build.imba` contains the whole local pipeline: build, watch, test, pack.
- `test-build/` contains the tests for `build.imba`
- `imba-plugin.js` is the plugin so Bun recognizes Imba files.
- `.github/workflows/` contains a publishing workflow (tag, GitHub Release, store publish)
- `out/` contains generated outputs (development and tests)
- `releases/` contains generated zip archives ready to be published

## Usage

### Prerequisites
1. Install Bun: https://bun.com/
2. After cloning, install project dependencies: `bun install`.
3. You need to [configure workflows](#setup-github-workflows) before using them.

### Commands

`bun run <command-below>`:
- `dev[:firefox]`: build and watch
- `build[:firefox]`: single build
- `pack[:firefox]`: production build and release zips
- `release` pack for both chrome and firefox
- `test[:watch]`: lauch (and watch) tests
- `build.imba [--flag]`: The previous commands are shortcuts for this program. Flags:
    - Goal: `--test` (defaut: build)
    - Refresh: `--watch` mode rebuilds everything on any change (default: one-time compilation)
    - Build target: `--chrome` or `--firefox` (default: chrome)
    - Build type: `--prod`, `--pack` (default: development)

### Development

In the `app/` folder, you can create and organize your project files:

- When creating an entrypoint (`background.imba`, `popup/popup.imba`...), specify it in `metadata.json`. It is the single source of truth for the manifest: shared keys at the root, browser-specific overrides in `chrome` / `firefox` blocks, fallbacks to `package.json` (name, version, description). 

    Keys referencing `.imba` files are entrypoints compiled to `.js` (background, content scripts), plus a minimal generated `.html` wrapper for pages.

- `assets/` are static files copied as-is (icons, css...).

When you build the extension:
- The compiled output always lands in `out/app/` (ready-to-load unpacked extension), and generated archives in `releases/`.
- **Firefox builds are never minified**, even with `--prod` (AMO reviewers reject minified code)
- Firefox builds warn if `browser_specific_settings.gecko.id` is missing (required for AMO signing)

### Testing
Place tests in the repository, named `<your-test-name>.test.imba`.

```imba
import { test, expect, describe } from 'bun:test'
import { hello } from './hello-file'
import { walkManifest } from '../build'
```

Note: The test runner also compiles `build.imba` to `out/test/build.js`, so unit tests can import the real pipeline helpers. The `../build.js` path works because tests sit one folder deep; keep that convention. The same way, you can import your compiled project files for integration tests using `../app/<path-to>/<entrypoint-name>.js`.

### Releasing

1. Bump `version` in `app/metadata.json`
2. Merge to `main` branch, then push to (or fast-forward) the `publish` branch, to trigger the workflows:
    - Push to a `publish` branch to trigger: tests => pack => git tag => GitHub release (auto-generated changelog with assets) => Discussion (optional, skipped if secrets are missing) => store submissions with [BPP](https://github.com/PlasmoHQ/bpp) => branch cleanup.
    - Push to a `bpp` branch to only trigger store submissions with [BPP](https://github.com/PlasmoHQ/bpp).
3. The workflow does the rest; check the Release page and store dashboards

A failed `git push origin v<version>` in CI almost always means workflow permissions (see configuration below). A bpp failure at the Chrome step usually means an expired `refreshToken` or a `clientId` whose project lacks the Chrome Web Store API.

## Configuration
### Setup GitHub workflows
Prerequisite:
- Enable **Settings => Actions => General => Workflow permissions => Read and write permissions** (if the repository is in an organization, the org policy may enforce read-only and must be adjusted there).
- To create secrets via CLI: install `gh`locally and authenticate (or use the web interface: Settings => Secrets and variables => Actions)

#### Browser Platform Publish

You need to compose `BPP_KEYS`, a unique JSON secret containing the credentials of the different stores, [based on this schema](https://raw.githubusercontent.com/PlasmoHQ/bpp/main/keys.schema.json). Required fields for each store:

```json
{
	"chrome": {
		"clientId": "...",
		"clientSecret": "...",
		"refreshToken": "...",
		"extId": "..."
	},
	"firefox": {
		"apiKey": "...",
		"apiSecret": "..."
	},
	"edge": {
		"productId": "...",
		"clientId": "...",
		"clientSecret": "...",
        "accessTokenUrl": "..."
	},
    "opera": {
        "packageId": "..."
    }
}
```

Here are the guides to get the required tokens for:
- [Chrome Web Store](https://github.com/PlasmoHQ/chrome-webstore-api/blob/main/token.md)
    - In Google Cloud Console, create a new project and enable the Chrome Web Store API
    - Add your Google account as test user (OAuth consent screen => External)
    - Get `clientId` and `clientSecret` (Credentials => OAuth client ID => Desktop app)
    - `extId`: the 32-character ID from the Chrome Developer Dashboard. The extension must already exist, so the very first upload is manual.
    - `refreshToken`: `npx gcp-refresh-token` opens the browser and writes it to a local file. **Never commit this file**
    - Tip: `"uploadOnly": true` uploads without publishing (good for testing the pipeline).
- [AMO (addons.mozilla.org)](<TODO find a link>)
    - Prerequisite: `browser_specific_settings.gecko.id` in `app/metadata.json` (otherwise AMO will reject the package)
    - addons.mozilla.org => Developer Hub => **API Keys**
    - Generate the JWT pair => `apiKey` + `apiSecret`
    - `extId` can be **omitted** since the ID is embedded in the manifest
    - Optional: `"channel": "unlisted"` for off-store distribution, `"license"` (defaults to all-rights-reserved).
- [Edge Add-ons Store (Partner Center)](https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/using-addons-api)
    - Register as a developer, create the add-on once => `productId`
    - Enable the Publish API => `clientId` and `clientSecret` (**shown only once**, copy immediately)
    - `accessTokenUrl` = your tenant's OAuth endpoint: `https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/token`
- [Opera Add-ons Store](<TODO find a link>)

##### Declare the secret

```sh
gh secret set BPP_KEYS --body '{"chrome":{...},"firefox":{...},"edge":{...}}'
```

#### GitHub Discussions (optional)

Requires:
- Discussions enabled (Settings => General => Features) 
- Two `DISCUSSION_*` secrets:
    - `DISCUSSION_REPOSITORY_ID`: GraphQL node ID of the repo
    - `DISCUSSION_CATEGORY_ID`: GraphQL node ID of the discussion category

1. Get the IDs:

```sh
gh api graphql -f query='
query {
  repository(owner: "<your-name>", name: "<repo-name>") {
    id
    discussionCategories(first: 10) { nodes { id name } }
  }
}'
```

2. Set the secrets:

```sh
gh secret set DISCUSSION_REPOSITORY_ID --body "R_kg..." # repository.id
gh secret set DISCUSSION_CATEGORY_ID --body "DIC_..."   # discussionCategories.nodes[*].id
```

## Tips
Useful patterns for Imba and Bun:
- `do(...)` callbacks instead of arrow functions in Imba style
- `expect(value).toBe(...)` / `.toEqual(...)` / `.toBeUndefined()`