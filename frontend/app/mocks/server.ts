/* eslint-disable import/no-extraneous-dependencies */
import { setupServer } from 'msw/node';

import { handlers } from './handlers';

/**
 * MSW Server for Node.js (Testing)
 * @see https://mswjs.io/docs/integrations/node
 *
 * This server is used for Vitest/Jest tests.
 * It intercepts requests at the network level.
 */
export const server = setupServer(...handlers);
