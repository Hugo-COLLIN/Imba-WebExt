# Minimal Imba WebExt

## Prerequisites
1. Install Bun: https://bun.com/
2. Install Imba and its Bun CLI: `bun install`

## Compilation
Base commands:
```sh
bun run build.imba                 # dev chrome
bun run build.imba --firefox       # dev firefox
bun run build.imba --prod          # prod chrome (minified)
bun run build.imba --watch         # dev avec watch
```
Flags:
- Target: `--chrome` or `--firefox` (default: chrome)
- Purpose: `--prod` (default: dev)
- Refresh: `--watch` (default: 1-time compilation)

## Tests

### Execution

```bash
# All tests
bun run build.imba --test

# Watch mode
bun run build.imba --test --watch
```

### Adding tests
1. Create `my-feature.test.imba`
2. Use `import { test, expect, describe } from 'bun:test'`
3. Standard Imba syntax
4. Run `bun run build.imba --test`

## Setup GitHub workflow

Prerequisite: Install `gh`, connect to your GitHub account.

### Browser Platform Publish

You need to compose `BPP_KEYS`, a unique JSON secret containing the credentials of the different stores, [based on this schema](https://raw.githubusercontent.com/PlasmoHQ/bpp/main/keys.schema.json):

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

#### Chrome (Chrome Web Store)
1. Google Cloud Console -> new project -> activate Chrome Web Store API
2. OAuth consent screen -> External, add your Google account as a user test (no need for validation)
3. Credentials -> OAuth client type ID Desktop app → note ClientID + clientSecret
4. Get `extId`: the 32-character ID of your item in the Developer Dashboard (the extension must already exist, so you need to manually upload it the first time)
5. Get `refreshToken`: the simplest is npx gcp-refresh-token (official Plasmo script) which opens the browser and writes the token to a local file. Never commit this file

#### Firefox (addons.mozilla.org)
Prerequisite: browser_specific_settings.gecko.id in the manifest (`app/metadata.json`), otherwise the AMO signature will reject.

1. addons.mozilla.org -> Developer Hub -> API Keys
2. Generates the JWT pair: `apiKey` and `apiSecret`

#### Edge (Partner Center)
1. Partner Center -> Publish browser extensions (developer registration if not done)
2. Create the extension the first time to get ProductID
3. Activate the Publish API -> generate `ClientID` and `apiKey`

#### Declare the secret
```sh
gh secret set BPP_KEYS --body '{"chrome":{...},"firefox":{...},"edge":{...}}'
```


### GitHub Discussions
1. Find Discussion IDs:
```sh
gh api graphql -f query='
query {
  repository(owner: "<your-name>", name: "<rep-name>") {
    id
    discussionCategories(first: 10) { nodes { id name } }
  }
}'
```

2. Declare secrets
```sh
gh secret set DISCUSSION_REPOSITORY_ID --body "R_kg..." # repository.id
gh secret set DISCUSSION_CATEGORY_ID --body "DIC_..."   # discussionCategories.nodes[*].id
```