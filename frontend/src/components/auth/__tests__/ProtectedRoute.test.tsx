import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';

import { ProtectedRoute } from '../ProtectedRoute';
import { AuthProvider } from '../../../contexts/AuthContext';

function WithAuthProvider({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

function Dummy() {
  return <div>PrivateContent</div>;
}

// Helper to render with router
function renderWithRouter(ui: React.ReactNode, initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      {ui}
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to /login', async () => {
    renderWithRouter(
      <WithAuthProvider>
        <Routes>
          <Route
            path="/private"
            element={
              <ProtectedRoute>
                <Dummy />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>LoginPage</div>} />
        </Routes>
      </WithAuthProvider>,
      ['/private']
    );

    // Initially AuthContext checks token and flips to unauthenticated
    // Expect login page to be shown
    expect(await screen.findByText('LoginPage')).toBeInTheDocument();
  });
});
