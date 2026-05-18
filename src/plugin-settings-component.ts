/**
 * @file
 *
 * Settings component that manages plugin settings persistence.
 */

import { PluginSettingsComponentBase } from 'obsidian-dev-utils/obsidian/components/plugin-settings-component';

import { PluginSettings } from './plugin-settings.ts';

/**
 * Manages persistence and lifecycle for {@link PluginSettings}.
 */
export class PluginSettingsComponent extends PluginSettingsComponentBase<PluginSettings> {
  /**
   * Creates the default settings instance.
   *
   * @returns A new {@link PluginSettings} with default values.
   */
  protected override createDefaultSettings(): PluginSettings {
    return new PluginSettings();
  }
}
