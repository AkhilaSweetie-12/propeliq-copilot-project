import { render, screen } from '@testing-library/angular';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { LoginComponent } from './login.component';
import { AuthService } from '../../core/services/auth.service';

describe('LoginComponent', () => {
  it('renders the login form fields', async () => {
    await render(LoginComponent, {
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            initialize: jest.fn(),
            user: signal(null),
            initialized: signal(true),
            isAuthenticated: jest.fn(() => false),
          },
        },
        provideRouter([]),
      ],
    });

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });
});