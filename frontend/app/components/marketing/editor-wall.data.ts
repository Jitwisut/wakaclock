/**
 * Editors compatible via the WakaTime plugin protocol — an editor with a WakaTime plugin
 * can point its `api_url` at an AtoAxis server.
 *
 * Every name below was checked against WakaTime's official plugin directory
 * (wakatime.com/plugins) in August 2026. Entries that appeared in earlier drafts but are
 * NOT in that directory were removed: RStudio, Spyder, Qt Creator, Code::Blocks,
 * CodeLite, KDevelop, BlueJ and Helix.
 *
 * Deliberately excluded even though WakaTime lists them: AI coding agents are tracked by
 * the dedicated AtoAxis AI setup flow rather than by the editor-protocol compatibility
 * wall shown here.
 *
 * Names only, deliberately no logos: rendering third-party brand marks correctly (and
 * keeping them correct as they change) is a maintenance and legal-accuracy cost that a
 * text wall avoids.
 */
export const COMPATIBLE_EDITORS = [
  'VS Code',
  'Cursor',
  'Neovim',
  'Vim',
  'Emacs',
  'Sublime Text',
  'Zed',
  'IntelliJ IDEA',
  'PyCharm',
  'WebStorm',
  'PhpStorm',
  'RubyMine',
  'CLion',
  'GoLand',
  'DataGrip',
  'DataSpell',
  'Rider',
  'RustRover',
  'AppCode',
  'Android Studio',
  'Xcode',
  'Visual Studio',
  'Eclipse',
  'NetBeans',
  'Notepad++',
  'TextMate',
  'Kate',
  'Kakoune',
  'Micro',
  'Nova',
  'Brackets',
  'Komodo',
  'Cloud9',
  'Geany',
  'Gedit',
  'Pulsar',
  'Jupyter',
  'Azure Data Studio',
  'DBeaver',
  'SQL Server Studio',
  'Postman',
  'Unity',
  'Blender',
  'Figma',
  'Sketch',
  'Canva',
  'Obsidian',
  'Processing',
  'Arduino IDE',
  'TeXstudio',
  'Terminal',
];
