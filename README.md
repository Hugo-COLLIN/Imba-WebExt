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
Base command:
```sh
bun run build.imba
```
Flags:
- Target: `--chrome` or `--firefox`
