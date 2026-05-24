/* eslint-disable import/no-extraneous-dependencies */
import { setupWorker } from 'msw/browser';

import { handlers } from './handlers';

/**
 * MSW Worker for Browser (Development/Storybook)
 * @see https://mswjs.io/docs/integrations/browser
 *
 * To use in development:
 * 1. Run: npx msw init public/ --save
 * 2. In your app entry point:
 *    if (process.env.NODE_ENV === 'development') {
 *      const { worker } = await import('@/mocks/browser');
 *      await worker.start({ onUnhandledRequest: 'bypass' });
 *    }
 */
export const worker = setupWorker(...handlers);
