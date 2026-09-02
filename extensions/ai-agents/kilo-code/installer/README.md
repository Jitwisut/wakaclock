# Kilo local-plugin installer

`install.sh` copies the bundled TypeScript server modules into Kilo's documented
global plugin directory (`~/.config/kilo/plugin/`). Kilo auto-discovers files
directly in that directory, so the installer places one top-level
`atoaxis-kilo-code.ts` entrypoint and keeps helper modules in the managed
`atoaxis-kilo-code/` directory. It never rewrites Kilo's JSON/JSONC config, and
`--uninstall` removes only those two managed paths. The VS Code setup command
performs the equivalent copy into the managed home directory.
