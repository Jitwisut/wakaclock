// Kilo auto-discovers only modules directly inside its plugin directory. Keep
// implementation modules in a private subdirectory and expose one stable,
// top-level entrypoint so helpers are not loaded as independent plugins.
export { default } from "./atoaxis-kilo-code/plugin.ts";
