/* eslint-disable import/no-extraneous-dependencies */
import { http, HttpResponse } from 'msw';

/**
 * MSW Request Handlers
 * @see https://mswjs.io/docs/basics/mocking-responses
 *
 * Add your API mock handlers here. These will be used during:
 * - Development (optional, via browser.ts)
 * - Testing (via vitest setup)
 * - Storybook (via storybook integration)
 */

export const handlers = [
  // Example: Mock a GET request to /api/user
  http.get('/api/user', () =>
    HttpResponse.json({
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
    })
  ),

  // Example: Mock a POST request to /api/login
  http.post('/api/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };

    if (body.email === 'test@example.com' && body.password === 'password') {
      return HttpResponse.json({
        token: 'mock-jwt-token',
        user: {
          id: '1',
          email: body.email,
        },
      });
    }

    return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }),

  // Example: Mock a network error
  // http.get('/api/error', () => {
  //   return HttpResponse.error();
  // }),

  // Example: Mock a delayed response
  // http.get('/api/slow', async () => {
  //   await delay(2000);
  //   return HttpResponse.json({ data: 'slow response' });
  // }),
];
