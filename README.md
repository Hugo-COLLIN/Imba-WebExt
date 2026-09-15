# Minimal WebExt

## Prerequisites
1. Install Bun: https://bun.com/
2. Install Imba and its Bun CLI: `bun add -g imba bimba-cli`
3. Open your shell configuration (`~/.bashrc`, `~/.zshrc` or equivalent), then add the content below, then `source ~/.bashrc`:
```sh
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
```

## Compilation
Base commands:
```sh
bun run build.imba                 # dev chrome
bun run build.imba --firefox       # dev firefox
bun run build.imba --prod          # prod chrome (minifié)
bun run build.imba --watch         # dev avec watch
```
Flags:
- Target: `--chrome` or `--firefox` (default: chrome)
- Purpose: `--prod` (default: dev)
- Refresh: `--watch` (default: 1-time compilation)


