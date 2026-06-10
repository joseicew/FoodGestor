import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private themeSubject = new BehaviorSubject<ThemeMode>('system');
  public theme$: Observable<ThemeMode> = this.themeSubject.asObservable();

  constructor() {
    this.initializeTheme();
  }

  private initializeTheme() {
    const savedTheme = localStorage.getItem('theme') as ThemeMode | null;

    if (savedTheme) {
      this.setTheme(savedTheme);
    } else {
      // Default to system preference
      this.setTheme('system');
    }
  }

  setTheme(theme: ThemeMode) {
    this.themeSubject.next(theme);
    localStorage.setItem('theme', theme);
    this.applyTheme(theme);
  }

  private applyTheme(theme: ThemeMode) {
    const isDark = this.shouldBeDark(theme);

    if (isDark) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }

  private shouldBeDark(theme: ThemeMode): boolean {
    if (theme === 'dark') {
      return true;
    }
    if (theme === 'light') {
      return false;
    }
    // system: check OS preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  getCurrentTheme(): ThemeMode {
    return this.themeSubject.value;
  }

  toggleTheme() {
    const current = this.getCurrentTheme();
    const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
  }

  isDarkMode(): boolean {
    return this.shouldBeDark(this.getCurrentTheme());
  }
}
