/**
 * @file
 *
 * Settings component that manages plugin settings persistence.
 */

import type { PluginSettingsComponentParams } from 'obsidian-dev-utils/obsidian/plugin/components/plugin-settings-component';

import { PluginSettingsComponentBase } from 'obsidian-dev-utils/obsidian/plugin/components/plugin-settings-component';

import { PluginSettings } from './plugin-settings.ts';

/**
 * Manages persistence and lifecycle for {@link PluginSettings}.
 */
export class PluginSettingsComponent extends PluginSettingsComponentBase<PluginSettings> {
  /**
   * Creates a new settings component.
   *
   * @param params - Load/save data callbacks.
   */
  public constructor(params: PluginSettingsComponentParams) {
    super(params);
  }

  /**
   * Creates the default settings instance.
   *
   * @returns A new {@link PluginSettings} with default values.
   */
  protected override createDefaultSettings(): PluginSettings {
    return new PluginSettings();
  }
}
