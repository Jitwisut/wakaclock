import { faker } from '@faker-js/faker';

/**
 * Default seed for deterministic test data generation.
 * Using the same seed ensures consistent fake data across test runs.
 */
export const DEFAULT_FAKER_SEED = 12_345;

/**
 * Seeds the faker instance with a specific seed value.
 * Use this at the top of story files for deterministic data.
 *
 * @param seed - The seed value to use (defaults to DEFAULT_FAKER_SEED)
 *
 * @example
 * ```typescript
 * import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
 *
 * // At the top of your story file
 * seedFaker();
 *
 * // Or with a custom seed
 * seedFaker(54321);
 * ```
 */
export function seedFaker(seed: number = DEFAULT_FAKER_SEED): void {
  faker.seed(seed);
}

/**
 * Resets faker to the default seed.
 * Useful for ensuring consistent data in play functions.
 *
 * @example
 * ```typescript
 * play: async ({ canvasElement }) => {
 *   resetFaker();
 *   const data = createFakeTableData(5);
 *   // data will always be the same
 * }
 * ```
 */
export function resetFaker(): void {
  faker.seed(DEFAULT_FAKER_SEED);
}

/**
 * Creates a scoped faker instance with a specific seed.
 * Useful for creating isolated fake data without affecting the global seed.
 *
 * @param seed - The seed value to use
 * @param callback - Function to execute with the seeded faker
 * @returns The result of the callback function
 *
 * @example
 * ```typescript
 * const users = withFakerSeed(12345, () => createFakeUsers(5));
 * ```
 */
export function withFakerSeed<T>(seed: number, callback: () => T): T {
  const previousSeed = faker.seed();
  faker.seed(seed);
  const result = callback();
  if (typeof previousSeed === 'number') {
    faker.seed(previousSeed);
  }
  return result;
}

/**
 * Decorator for seeding faker before story render.
 * Use this as a Storybook decorator to ensure consistent data.
 *
 * @example
 * ```typescript
 * export const MyStory: Story = {
 *   decorators: [fakerSeedDecorator()],
 *   render: () => <MyComponent data={createFakeData()} />,
 * };
 * ```
 */
export function fakerSeedDecorator(seed: number = DEFAULT_FAKER_SEED) {
  return (story: () => unknown) => {
    seedFaker(seed);
    return story();
  };
}

// Re-export faker for convenience
export { faker };
