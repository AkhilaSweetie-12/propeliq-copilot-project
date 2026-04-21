import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private readonly authService = inject(AuthService);

  protected readonly user = this.authService.user;
  protected readonly initialized = this.authService.initialized;
  protected readonly isAuthenticated = computed(() => this.authService.isAuthenticated());

  protected async logout(): Promise<void> {
    await this.authService.logout();
  }
}
