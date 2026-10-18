import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { Sidebar } from './Sidebar';

describe('Sidebar', () => {
  it('renders a real link for every navigation item', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    const primaryNav = screen.getByRole('navigation', { name: /primary/i });
    const links = within(primaryNav).getAllByRole('link');

    // Dashboard + Settings are implemented; every other section is a planned
    // route rendered by the honest placeholder page.
    expect(within(primaryNav).getByRole('link', { name: /dashboard/i })).toHaveAttribute(
      'href',
      '/',
    );
    expect(within(primaryNav).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
    expect(within(primaryNav).getByRole('link', { name: /roadmaps/i })).toHaveAttribute(
      'href',
      '/roadmaps',
    );
    expect(links.length).toBeGreaterThanOrEqual(14);
  });

  it('marks not-yet-implemented sections without faking them as ready', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    const primaryNav = screen.getByRole('navigation', { name: /primary/i });
    // Planned items carry the "soon" marker; Dashboard/Settings do not.
    const goalsLink = within(primaryNav).getByRole('link', { name: /goals/i });
    expect(within(goalsLink).getByText('soon')).toBeInTheDocument();
  });
});
