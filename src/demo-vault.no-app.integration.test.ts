import process from 'node:process';
import { registerDemoVaultCoverageSuite } from 'obsidian-dev-utils/script-utils/demo-vault-coverage';
import { getRootFolder } from 'obsidian-dev-utils/script-utils/root';

// Keeps the in-repo `demo-vault/` in sync with the plugin's public surface WITHOUT
// Launching Obsidian: it reflects the real config from source and asserts every
// Setting is documented in a note, and that the guard note/member still exist
// (rename drift). Backlink Full Path enhances the core Backlinks pane and exposes
// No public API interface, so only the PluginSettings config class is reflected;
// The plugin's runtime behavior is covered by the other integration tests.
registerDemoVaultCoverageSuite({
  configInterfaces: [{ interfaceName: 'PluginSettings', sourcePath: 'src/plugin-settings.ts' }],
  interfaces: [],
  nonTrivialGuard: {
    expectDemoNote: '02 Settings.md',
    expectMember: 'pathDepth',
    interfaceName: 'PluginSettings',
    sourcePath: 'src/plugin-settings.ts'
  },
  rootFolder: getRootFolder() ?? process.cwd()
});
