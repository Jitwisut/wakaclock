import { faker } from '@faker-js/faker';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';

it('supports deterministic fixtures and user interactions', async () => {
  faker.seed(123);

  const label = faker.lorem.word();
  const onClick = vi.fn();

  render(
    <button type="button" onClick={onClick}>
      {label}
    </button>
  );

  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: label }));

  expect(onClick).toHaveBeenCalledTimes(1);
});
