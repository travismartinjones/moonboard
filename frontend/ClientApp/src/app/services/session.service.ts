import { Injectable } from '@angular/core';

interface SessionState {
  sessionIds: string[];
  activeSession: boolean;
  favoriteIds: string[];
  recentIds: string[];
  lastSelectedId: string | null;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly storagePrefix = 'moonboard.session.v1:';
  private readonly recentLimit = 20;
  private readonly states = new Map<string, SessionState>();

  getSessionIds(setup: string): string[] {
    return this.getState(setup).sessionIds.slice();
  }

  setSessionIds(setup: string, ids: string[]): void {
    this.getState(setup).sessionIds = this.cleanIds(ids);
    this.saveState(setup);
  }

  isSessionActive(setup: string): boolean {
    return this.getState(setup).activeSession;
  }

  setSessionActive(setup: string, active: boolean): void {
    this.getState(setup).activeSession = active === true;
    this.saveState(setup);
  }

  getFavoriteIds(setup: string): string[] {
    return this.getState(setup).favoriteIds.slice();
  }

  toggleFavorite(setup: string, id: string): void {
    if (!this.isId(id)) return;
    const state = this.getState(setup);
    const index = state.favoriteIds.indexOf(id);
    if (index === -1) {
      state.favoriteIds.push(id);
    } else {
      state.favoriteIds.splice(index, 1);
    }
    this.saveState(setup);
  }

  getRecentIds(setup: string): string[] {
    return this.getState(setup).recentIds.slice();
  }

  recordSelection(setup: string, id: string): void {
    if (!this.isId(id)) return;
    const state = this.getState(setup);
    state.lastSelectedId = id;
    state.recentIds = [id].concat(state.recentIds.filter(recentId => recentId !== id))
      .slice(0, this.recentLimit);
    this.saveState(setup);
  }

  getLastSelectedId(setup: string): string | null {
    return this.getState(setup).lastSelectedId;
  }

  private getState(setup: string): SessionState {
    const cached = this.states.get(setup);
    if (cached) return cached;

    const state: SessionState = {
      sessionIds: [], activeSession: false, favoriteIds: [], recentIds: [], lastSelectedId: null
    };
    try {
      const saved = JSON.parse(localStorage.getItem(this.storagePrefix + setup) || 'null');
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        state.sessionIds = this.cleanIds(saved.sessionIds);
        state.activeSession = saved.activeSession === true;
        state.favoriteIds = this.cleanIds(saved.favoriteIds);
        state.recentIds = this.cleanIds(saved.recentIds).slice(0, this.recentLimit);
        state.lastSelectedId = this.isId(saved.lastSelectedId) ? saved.lastSelectedId : null;
      }
    } catch (_) {
      // A blocked storage API or damaged entry must not prevent browsing problems.
    }
    this.states.set(setup, state);
    return state;
  }

  private saveState(setup: string): void {
    try {
      localStorage.setItem(this.storagePrefix + setup, JSON.stringify(this.getState(setup)));
    } catch (_) {
      // Keep this visit's state in memory when storage is unavailable or full.
    }
  }

  private cleanIds(value: any): string[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value.filter(id => {
      if (!this.isId(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  private isId(value: any): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }
}
