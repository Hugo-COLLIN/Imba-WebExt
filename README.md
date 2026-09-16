# Minimal WebExt

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
