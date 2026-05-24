import { addons, types } from 'storybook/manager-api';
import { create } from 'storybook/theming';
import { TOOL_ID } from 'storybook/viewport';

import {
  STORYBOOK_BRAND,
  STORYBOOK_MANAGER_LAYOUT_CUSTOMISATIONS,
  STORYBOOK_MANAGER_SIDEBAR,
  STORYBOOK_MANAGER_TOOLBAR,
  STORYBOOK_VIEWPORT_TOOL_MATCH,
} from './ssot';

addons.setConfig({
  theme: create({
    base: 'light',
    brandTitle: STORYBOOK_BRAND.title,
    brandUrl: STORYBOOK_BRAND.url,
    brandTarget: STORYBOOK_BRAND.target,
  }),
  layoutCustomisations: STORYBOOK_MANAGER_LAYOUT_CUSTOMISATIONS,
  toolbar: STORYBOOK_MANAGER_TOOLBAR,
  sidebar: STORYBOOK_MANAGER_SIDEBAR,
});

// Storybook 10 integrated Viewport tool only shows in Canvas by default.
// For “Chrome DevTools”-style device testing, keep it available in Docs too.
addons.register('viewport-tool-docs', () => {
  let didOverride = false;

  const overrideViewportMatch = () => {
    const tools = addons.getElements(types.TOOL);
    const toolExtras = addons.getElements(types.TOOLEXTRA);

    const current = tools[TOOL_ID] ?? toolExtras[TOOL_ID];

    if (!current || didOverride) return !!current;

    addons.add(TOOL_ID, {
      ...current,
      hidden: false,
      // Storybook's integrated viewport tool is hidden when an addon panel is active.
      // Keep it available everywhere you can view a story (Canvas + Docs + panels).
      match: STORYBOOK_VIEWPORT_TOOL_MATCH,
    });

    didOverride = true;
    return true;
  };

  if (overrideViewportMatch()) return;

  // Core registers tools via presets; if this runs first, retry briefly.
  let attempts = 0;
  const maxAttempts = 20;
  const handle = setInterval(() => {
    attempts += 1;
    if (overrideViewportMatch() || attempts >= maxAttempts) {
      clearInterval(handle);
    }
  }, 50);
});
