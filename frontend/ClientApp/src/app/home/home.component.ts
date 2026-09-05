import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Problem, Route } from '../problem';
import { EventAggregatorService } from '../services/event-aggregator.service';
import { LedsService } from '../services/leds.service';
import { ModeService } from '../services/mode.service';
import { ProblemsService } from '../services/problems.service';
import { SessionService } from '../services/session.service';

type Collection = 'all' | 'session' | 'favorites' | 'recent';
type Panel = 'library' | 'details' | 'zoom';
type WallState = 'idle' | 'sending' | 'on' | 'off' | 'error';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {
  @ViewChild('dialog', { static: false }) dialog: ElementRef<HTMLElement>;
  @ViewChild('problemList', { static: false }) problemList: ElementRef<HTMLElement>;
  selectedProblem: Problem;
  problems: Problem[] = [];
  visibleProblems: Problem[] = [];
  sessionIds: string[] = [];
  favoriteIds: string[] = [];
  recentIds: string[] = [];
  setup: string;
  loading = true;
  loadError = '';
  notice = '';
  name = '';
  minimumGrade = 0;
  maximumGrade = 10;
  grades = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  collection: Collection = 'all';
  navigationCollection: Collection = 'all';
  navigationIds: string[] = [];
  panel: Panel = null;
  panelHeight: number = null;
  panelTop = 0;
  wallState: WallState = 'idle';
  wallError = '';
  lightingEnabled = true;
  confirmDelete = false;
  deleting = false;
  deleteError = '';
  announcement = '';
  private unsubscribeSetup: () => void;
  private loadVersion = 0;
  private wallVersion = 0;
  private destroyed = false;
  private pendingId: string;
  private returnFocus: HTMLElement;
  private previousOverflow = '';
  private focusTimer: number;
  private listScrollTimer: number;
  private libraryScrollPending = false;
  private libraryViewKey = '';
  private libraryScrollPositions = new Map<string, number>();
  private lastCommand: { route: Route, lighting: boolean };
  private lookupSource: Problem[];
  private problemLookup = new Map<string, Problem>();
  private visualViewport: any;
  private updatePanelViewport = () => {
    if (!this.visualViewport || this.destroyed) return;
    this.panelHeight = this.visualViewport.height;
    this.panelTop = this.visualViewport.offsetTop;
  };

  constructor(
    private problemsService: ProblemsService,
    private ledsService: LedsService,
    private eventAggregator: EventAggregatorService,
    private modeService: ModeService,
    private sessions: SessionService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.setup = modeService.getHoldSetup();
    try { this.lightingEnabled = localStorage.getItem('isLighting') !== 'false'; } catch (_) { }
    this.visualViewport = (window as any).visualViewport;
    if (this.visualViewport) {
      this.visualViewport.addEventListener('resize', this.updatePanelViewport);
      this.visualViewport.addEventListener('scroll', this.updatePanelViewport);
      this.updatePanelViewport();
    }
    this.unsubscribeSetup = eventAggregator.subscribe('holdSetupChangedEvent', setup => {
      if (setup === this.setup) return;
      this.closePanel();
      this.setup = setup;
      this.pendingId = null;
      this.selectedProblem = null;
      this.name = '';
      this.minimumGrade = 0;
      this.maximumGrade = 10;
      this.collection = this.navigationCollection = 'all';
      this.notice = '';
      // A deliberate layout change clears the previous layout's lights.
      if (this.wallState !== 'idle' && this.wallState !== 'off') this.sendToWall(new Route(), false);
      this.router.navigate(['/'], { replaceUrl: true });
      this.loadProblems();
    }, this);
  }

  ngOnInit() {
    this.pendingId = this.route.snapshot.queryParamMap.get('id');
    this.loadProblems();
  }

  ngOnDestroy() {
    this.destroyed = true;
    ++this.loadVersion;
    ++this.wallVersion;
    this.unsubscribeSetup();
    if (this.visualViewport) {
      this.visualViewport.removeEventListener('resize', this.updatePanelViewport);
      this.visualViewport.removeEventListener('scroll', this.updatePanelViewport);
    }
    this.closePanel(false);
  }

  get setupLabel(): string { return this.setup === 'Sep2021' ? '2021' : this.setup === 'Nov2020' ? '2020' : 'Art'; }
  get sessionProblems(): Problem[] { return this.resolve(this.sessionIds); }
  get favoriteCount(): number { return this.resolve(this.favoriteIds).length; }
  get hasFilters(): boolean { return !!this.name || this.minimumGrade !== 0 || this.maximumGrade !== 10; }
  get navigation(): Problem[] {
    return this.resolve(this.navigationCollection === 'session' ? this.sessionIds : this.navigationIds);
  }
  get position(): number { return this.selectedProblem ? this.navigation.findIndex(p => p.id === this.selectedProblem.id) : -1; }
  get previousDisabled(): boolean { return this.wallState === 'sending' || this.position <= 0; }
  get nextDisabled(): boolean { return this.wallState === 'sending' || this.position < 0 || this.position >= this.navigation.length - 1; }
  get navigationLabel(): string {
    const names = { all: 'Problem', session: 'Session', favorites: 'Favorites', recent: 'Recent' };
    return this.position < 0 ? 'Current problem' : names[this.navigationCollection] + ' · ' + (this.position + 1) + ' of ' + this.navigation.length;
  }
  get lightingLabel(): string {
    return { idle: 'Light problem', sending: 'Updating…', on: 'Lights on', off: 'Lights off', error: 'Retry lights' }[this.wallState];
  }
  get canToggleLighting(): boolean {
    return this.wallState !== 'sending' && (!!this.selectedProblem || this.wallState === 'on' || (this.wallState === 'error' && !!this.lastCommand));
  }
  get lightingAction(): string {
    return this.wallState === 'on' ? 'Turn board lights off' : this.wallState === 'error' ? 'Retry the last light command' : 'Light the current problem';
  }

  loadProblems() {
    const version = ++this.loadVersion;
    this.loading = true;
    this.loadError = '';
    this.problems = [];
    this.visibleProblems = [];
    this.refreshSaved();
    this.problemsService.search('', 'V0', 'V10', '', this.setup).then(results => {
      if (this.destroyed || version !== this.loadVersion) return;
      this.problems = (results || []).filter(p => p && p.id && p.route);
      this.navigationIds = this.problems.map(p => p.id);
      const savedId = this.pendingId || this.sessions.getLastSelectedId(this.setup);
      const restored = this.problems.find(p => p.id === savedId);
      this.selectedProblem = restored || this.problems[0] || null;
      if (this.sessions.isSessionActive(this.setup) && this.selectedProblem && this.inSession(this.selectedProblem.id)) {
        this.navigationCollection = this.collection = 'session';
      }
      if (this.pendingId && !restored) this.notice = 'That problem is unavailable in this layout.';
      this.pendingId = null;
      this.loading = false;
      this.applyFilters();
      // Restoring a view must never change the physical board.
    }).catch(() => {
      if (this.destroyed || version !== this.loadVersion) return;
      this.loading = false;
      this.loadError = 'Couldn’t load your problems. Check the board’s connection and try again.';
    });
  }

  private resolve(ids: string[]): Problem[] {
    if (this.lookupSource !== this.problems) {
      this.problemLookup.clear();
      this.problems.forEach(problem => this.problemLookup.set(problem.id, problem));
      this.lookupSource = this.problems;
    }
    return ids.map(id => this.problemLookup.get(id)).filter(p => !!p);
  }

  private refreshSaved() {
    this.sessionIds = this.sessions.getSessionIds(this.setup);
    this.favoriteIds = this.sessions.getFavoriteIds(this.setup);
    this.recentIds = this.sessions.getRecentIds(this.setup);
  }

  applyFilters() {
    const query = this.name.trim().toLocaleLowerCase();
    const viewKey = JSON.stringify([this.setup, this.collection, query, this.minimumGrade, this.maximumGrade]);
    const changedView = this.libraryViewKey !== viewKey;
    if (changedView) {
      this.rememberLibraryScroll();
      this.libraryViewKey = viewKey;
    }
    const source = this.collection === 'session' ? this.sessionProblems
      : this.collection === 'favorites' ? this.resolve(this.favoriteIds)
      : this.collection === 'recent' ? this.resolve(this.recentIds) : this.problems;
    this.visibleProblems = source.filter(problem => {
      const grade = parseInt((problem.difficulty || 'V0').replace('V', ''), 10);
      const text = [problem.name, problem.setter, problem.notes].filter(Boolean).join(' ').toLocaleLowerCase();
      return (!query || text.includes(query)) && grade >= this.minimumGrade && grade <= this.maximumGrade;
    });
    if (changedView && this.panel === 'library') this.scheduleLibraryScroll();
  }

  rememberLibraryScroll() {
    if (!this.libraryScrollPending && this.panel === 'library' && this.problemList && this.libraryViewKey) {
      this.libraryScrollPositions.set(this.libraryViewKey, this.problemList.nativeElement.scrollTop);
    }
  }

  private scheduleLibraryScroll() {
    window.clearTimeout(this.listScrollTimer);
    this.libraryScrollPending = true;
    const viewKey = this.libraryViewKey;
    // The list is recreated by ngIf; restore after Angular renders its rows.
    this.listScrollTimer = window.setTimeout(() => {
      if (!this.destroyed && this.panel === 'library' && this.problemList && this.libraryViewKey === viewKey) {
        this.problemList.nativeElement.scrollTop = this.libraryScrollPositions.get(viewKey) || 0;
      }
      this.libraryScrollPending = false;
    }, 0);
  }

  updateMinimum(value: number) {
    this.minimumGrade = Number(value);
    this.maximumGrade = Math.max(this.minimumGrade, this.maximumGrade);
    this.applyFilters();
  }

  updateMaximum(value: number) {
    this.maximumGrade = Number(value);
    this.minimumGrade = Math.min(this.minimumGrade, this.maximumGrade);
    this.applyFilters();
  }

  resetFilters() {
    this.name = '';
    this.minimumGrade = 0;
    this.maximumGrade = 10;
    this.applyFilters();
  }

  setCollection(collection: Collection) { this.collection = collection; this.applyFilters(); }
  trackProblem(index: number, problem: Problem): string { return problem.id; }
  isFavorite(id: string): boolean { return this.favoriteIds.includes(id); }
  inSession(id: string): boolean { return this.sessionIds.includes(id); }

  toggleFavorite(problem: Problem) {
    this.sessions.toggleFavorite(this.setup, problem.id);
    this.refreshSaved();
    this.applyFilters();
    this.announcement = this.isFavorite(problem.id) ? 'Added to favorites' : 'Removed from favorites';
  }

  toggleSession(problem: Problem) {
    const removing = this.inSession(problem.id);
    const ids = this.sessionProblems.map(p => p.id);
    this.sessions.setSessionIds(this.setup, removing ? ids.filter(id => id !== problem.id) : ids.concat(problem.id));
    this.refreshSaved();
    this.applyFilters();
    this.announcement = removing ? 'Removed from session' : 'Added to session';
  }

  moveEarlier(problem: Problem) {
    const ids = this.sessionProblems.map(p => p.id);
    const index = ids.indexOf(problem.id);
    if (index < 1) return;
    ids.splice(index - 1, 0, ids.splice(index, 1)[0]);
    this.sessions.setSessionIds(this.setup, ids);
    this.refreshSaved();
    this.applyFilters();
    this.announcement = problem.name + ' moved earlier in the session';
  }

  loadProblem(problem: Problem, fromPicker = false) {
    if (!problem || this.wallState === 'sending') return;
    if (fromPicker) {
      this.navigationCollection = this.collection;
      this.navigationIds = this.visibleProblems.map(p => p.id);
    }
    this.selectedProblem = problem;
    this.sessions.setSessionActive(this.setup, this.navigationCollection === 'session');
    this.sessions.recordSelection(this.setup, problem.id);
    this.refreshSaved();
    this.notice = '';
    this.closePanel();
    this.router.navigate(['/'], { queryParams: { id: problem.id }, replaceUrl: true });
    this.announcement = problem.name + ', ' + problem.difficulty;
    if (this.lightingEnabled) this.sendToWall(problem.route, true);
  }

  step(direction: number) {
    const next = this.navigation[this.position + direction];
    if (this.position >= 0 && next) this.loadProblem(next);
  }

  startSession() {
    if (!this.sessionProblems.length || this.wallState === 'sending') return;
    this.navigationCollection = 'session';
    this.collection = 'session';
    this.loadProblem(this.sessionProblems[0]);
  }

  toggleLighting() {
    if (!this.canToggleLighting) return;
    if (this.wallState === 'error' && this.lastCommand) {
      this.sendToWall(this.lastCommand.route, this.lastCommand.lighting);
    } else if (this.wallState === 'on') {
      this.sendToWall(new Route(), false);
    } else {
      this.sendToWall(this.selectedProblem.route, true);
    }
  }

  private sendToWall(route: Route, lighting: boolean) {
    const version = ++this.wallVersion;
    this.lightingEnabled = lighting;
    try { localStorage.setItem('isLighting', lighting ? 'true' : 'false'); } catch (_) { }
    this.lastCommand = { route: JSON.parse(JSON.stringify(route)), lighting: lighting };
    this.wallState = 'sending';
    this.wallError = '';
    this.ledsService.showRoute(route).then(() => {
      if (this.destroyed || version !== this.wallVersion) return;
      this.wallState = lighting ? 'on' : 'off';
    }).catch(error => {
      if (this.destroyed || version !== this.wallVersion) return;
      this.wallState = 'error';
      this.wallError = error && error.message ? error.message : 'Couldn’t update the wall. Check its connection, then retry.';
    });
  }

  openPanel(panel: Panel, event?: Event) {
    window.clearTimeout(this.focusTimer);
    if (this.panel) this.closePanel(false);
    this.returnFocus = event ? event.currentTarget as HTMLElement : document.activeElement as HTMLElement;
    this.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    this.panel = panel;
    this.confirmDelete = false;
    this.deleteError = '';
    if (panel === 'library') {
      this.applyFilters();
      this.scheduleLibraryScroll();
    }
    this.focusTimer = window.setTimeout(() => {
      if (this.dialog) {
        const first = this.dialog.nativeElement.querySelector('button:not(:disabled)') as HTMLElement;
        if (first) first.focus({ preventScroll: true });
      }
    }, 0);
  }

  closePanel(restoreFocus = true) {
    window.clearTimeout(this.focusTimer);
    window.clearTimeout(this.listScrollTimer);
    if (!this.panel) return;
    this.rememberLibraryScroll();
    this.libraryScrollPending = false;
    this.panel = null;
    this.confirmDelete = false;
    document.body.style.overflow = this.previousOverflow;
    const target = this.returnFocus;
    if (restoreFocus && !this.destroyed && target) {
      // Angular must remove inert before the originating control can regain focus.
      this.focusTimer = window.setTimeout(() => {
        if (!this.destroyed && !this.panel && document.contains(target)) target.focus();
      }, 0);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if (!this.panel || !this.dialog) return;
    if (event.key === 'Escape') { event.preventDefault(); this.closePanel(); return; }
    if (event.key !== 'Tab') return;
    const controls = Array.from(this.dialog.nativeElement.querySelectorAll('button:not(:disabled),input,select,a[href],[tabindex]:not([tabindex="-1"])')) as HTMLElement[];
    const visible = controls.filter(control => control.getClientRects().length > 0);
    const first = visible[0], last = visible[visible.length - 1];
    if (!first) return;
    if (event.shiftKey && (document.activeElement === first || !this.dialog.nativeElement.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !this.dialog.nativeElement.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  }

  edit() { if (this.selectedProblem) { const id = this.selectedProblem.id; this.closePanel(false); this.router.navigate(['/edit-problem', id]); } }

  deleteProblem() {
    if (!this.selectedProblem || !this.confirmDelete || this.deleting) return;
    const problem = this.selectedProblem;
    const setup = this.setup;
    this.deleting = true;
    this.deleteError = '';
    this.problemsService.deleteProblem(problem.id).then(() => {
      if (this.destroyed) return;
      this.sessions.setSessionIds(setup, this.sessions.getSessionIds(setup).filter(id => id !== problem.id));
      if (this.sessions.getFavoriteIds(setup).includes(problem.id)) this.sessions.toggleFavorite(setup, problem.id);
      this.deleting = false;
      // Deletion may finish after the user has switched layouts or loaded another route.
      if (this.setup !== setup) return;
      const stillSelected = this.selectedProblem && this.selectedProblem.id === problem.id;
      this.problems = this.problems.filter(p => p.id !== problem.id);
      this.refreshSaved();
      this.navigationIds = this.navigationIds.filter(id => id !== problem.id);
      if (stillSelected) this.selectedProblem = this.navigation[0] || this.problems[0] || null;
      this.applyFilters();
      this.announcement = 'Problem deleted';
      if (stillSelected) {
        this.closePanel();
        this.router.navigate(['/'], { replaceUrl: true });
        if (this.wallState !== 'idle' && this.wallState !== 'off') this.sendToWall(new Route(), false);
      }
    }).catch(() => {
      if (this.destroyed) return;
      this.deleting = false;
      if (this.setup === setup && this.selectedProblem && this.selectedProblem.id === problem.id) {
        this.deleteError = 'Couldn’t delete this problem. Please try again.';
      } else {
        this.notice = 'Couldn’t delete ' + problem.name + '. Please try again.';
      }
    });
  }
}
