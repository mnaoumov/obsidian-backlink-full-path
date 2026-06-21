import type { BacklinkPluginInstance } from '@obsidian-typings/obsidian-public-latest';
import type { Mock } from 'vitest';

import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { BacklinkFullPathComponent } from '../backlink-full-path-component.ts';

import { BacklinkPluginInstanceOnUserEnablePatchComponent } from './backlink-plugin-instance-on-user-enable-patch-component.ts';

interface BacklinkPluginInstanceProto {
  onUserEnable(): void;
}

describe('BacklinkPluginInstanceOnUserEnablePatchComponent', () => {
  let onBacklinksCorePluginEnable: Mock<() => void>;
  let backlinkFullPathComponent: BacklinkFullPathComponent;
  let originalOnUserEnable: Mock<() => void>;
  let instanceProto: BacklinkPluginInstanceProto;
  let backlinkPluginInstance: BacklinkPluginInstance;

  beforeEach(() => {
    onBacklinksCorePluginEnable = vi.fn<() => void>();
    backlinkFullPathComponent = strictProxy<BacklinkFullPathComponent>({
      onBacklinksCorePluginEnable
    });
    originalOnUserEnable = vi.fn<() => void>();
    instanceProto = { onUserEnable: originalOnUserEnable };
    backlinkPluginInstance = castTo<BacklinkPluginInstance>(Object.create(instanceProto));
  });

  function createComponent(): BacklinkPluginInstanceOnUserEnablePatchComponent {
    return new BacklinkPluginInstanceOnUserEnablePatchComponent({
      backlinkFullPathComponent,
      backlinkPluginInstance
    });
  }

  it('should register a single method patch on load', () => {
    const component = createComponent();
    const registerMethodPatchSpy = vi.spyOn(component, 'registerMethodPatch');

    component.load();

    expect(registerMethodPatchSpy).toHaveBeenCalledTimes(1);
  });

  it('should call the original onUserEnable and notify the component when the patched method runs', () => {
    const component = createComponent();
    component.load();

    instanceProto.onUserEnable.call(backlinkPluginInstance);

    expect(originalOnUserEnable).toHaveBeenCalled();
    expect(onBacklinksCorePluginEnable).toHaveBeenCalled();
  });

  it('should remove the patch on unload', () => {
    const component = createComponent();
    component.load();
    component.unload();

    instanceProto.onUserEnable.call(backlinkPluginInstance);

    expect(originalOnUserEnable).toHaveBeenCalled();
    expect(onBacklinksCorePluginEnable).not.toHaveBeenCalled();
  });
});
