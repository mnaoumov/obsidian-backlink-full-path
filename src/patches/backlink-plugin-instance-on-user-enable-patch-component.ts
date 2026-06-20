import type { BacklinkPluginInstance } from '@obsidian-typings/obsidian-public-latest';

import { getPrototypeOf } from 'obsidian-dev-utils/object-utils';
import { MonkeyAroundComponent } from 'obsidian-dev-utils/obsidian/components/monkey-around-component';

import type { BacklinkFullPathComponent } from '../backlink-full-path-component.ts';

interface BacklinkPluginInstanceOnUserEnablePatchComponentConstructorParams {
  readonly backlinkFullPathComponent: BacklinkFullPathComponent;
  readonly backlinkPluginInstance: BacklinkPluginInstance;
}

export class BacklinkPluginInstanceOnUserEnablePatchComponent extends MonkeyAroundComponent {
  private readonly backlinkFullPathComponent: BacklinkFullPathComponent;
  private readonly backlinkPluginInstance: BacklinkPluginInstance;

  public constructor(params: BacklinkPluginInstanceOnUserEnablePatchComponentConstructorParams) {
    super();
    this.backlinkPluginInstance = params.backlinkPluginInstance;
    this.backlinkFullPathComponent = params.backlinkFullPathComponent;
  }

  public override onload(): void {
    this.registerMethodPatch({
      methodName: 'onUserEnable',
      obj: getPrototypeOf(this.backlinkPluginInstance),
      patchHandler: ({
        fallback
      }) => {
        fallback();
        this.backlinkFullPathComponent.onBacklinksCorePluginEnable();
      }
    });
  }
}
