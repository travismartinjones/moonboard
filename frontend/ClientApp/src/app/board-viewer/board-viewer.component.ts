import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from '@angular/core';
import { Problem } from '../problem';

export interface ViewerPoint { x: number; y: number; }
export interface ViewerTransform { scale: number; x: number; y: number; }
interface BoardBounds { left: number; top: number; width: number; height: number; }
interface ViewerGesture {
  ids: number[];
  start: ViewerPoint;
  distance: number;
  view: ViewerTransform;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const BOARD_RATIO = 1.56;
const limit = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function fittedBoardBounds(width: number, height: number): BoardBounds {
  const boardWidth = Math.min(width, height / BOARD_RATIO);
  const boardHeight = boardWidth * BOARD_RATIO;
  return { left: (width - boardWidth) / 2, top: (height - boardHeight) / 2, width: boardWidth, height: boardHeight };
}

export function clampViewerTransform(view: ViewerTransform, width: number, height: number): ViewerTransform {
  const scale = limit(view.scale, MIN_ZOOM, MAX_ZOOM);
  const board = fittedBoardBounds(width, height);
  const x = board.width * scale <= width
    ? width * (1 - scale) / 2
    : limit(view.x, width - scale * (board.left + board.width), -scale * board.left);
  const y = board.height * scale <= height
    ? height * (1 - scale) / 2
    : limit(view.y, height - scale * (board.top + board.height), -scale * board.top);
  return { scale: scale, x: x, y: y };
}

// Keep the same image point beneath the moving midpoint of a pinch.
export function zoomViewerBetween(view: ViewerTransform, nextScale: number, from: ViewerPoint, to: ViewerPoint, width: number, height: number): ViewerTransform {
  const scale = limit(nextScale, MIN_ZOOM, MAX_ZOOM);
  return clampViewerTransform({
    scale: scale,
    x: to.x - (from.x - view.x) * scale / view.scale,
    y: to.y - (from.y - view.y) * scale / view.scale
  }, width, height);
}

@Component({
  selector: 'app-board-viewer',
  templateUrl: './board-viewer.component.html',
  styleUrls: ['./board-viewer.component.css']
})
export class BoardViewerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() problem: Problem;
  @Output() closed = new EventEmitter<void>();
  @ViewChild('gestureArea', { static: true }) gestureArea: ElementRef<HTMLDivElement>;
  view: ViewerTransform = { scale: 1, x: 0, y: 0 };
  private width: number = 0;
  private height: number = 0;
  private pointers = new Map<number, ViewerPoint>();
  private gesture: ViewerGesture;
  private cleanups: Array<() => void> = [];
  private resizeObserver: any;
  private destroyed: boolean = false;
  private lastTouchTime: number = 0;

  constructor(private changeDetectorRef: ChangeDetectorRef) { }

  get surfaceTransform(): string {
    return 'matrix(' + this.view.scale + ',0,0,' + this.view.scale + ',' + this.view.x + ',' + this.view.y + ')';
  }

  get isZoomed(): boolean { return this.view.scale > 1.01; }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['problem']) this.resetView();
  }

  ngAfterViewInit() {
    const area = this.gestureArea.nativeElement;
    const active = { passive: false };
    if (typeof (window as any).PointerEvent === 'function') {
      this.listen(area, 'pointerdown', event => this.onPointerDown(event as PointerEvent), active);
      this.listen(area, 'pointermove', event => this.onPointerMove(event as PointerEvent), active);
      this.listen(area, 'pointerup', event => this.onPointerEnd(event as PointerEvent));
      this.listen(area, 'pointercancel', event => this.onPointerEnd(event as PointerEvent));
      this.listen(area, 'lostpointercapture', event => this.onPointerEnd(event as PointerEvent));
    } else {
      // iOS Safari before Pointer Events still needs non-passive touch handlers.
      this.listen(area, 'touchstart', event => this.onTouchStart(event as TouchEvent), active);
      this.listen(area, 'touchmove', event => this.onTouchMove(event as TouchEvent), active);
      this.listen(area, 'touchend', event => this.onTouchEnd(event as TouchEvent));
      this.listen(area, 'touchcancel', event => this.onTouchEnd(event as TouchEvent));
      this.listen(area, 'mousedown', event => this.onMouseDown(event as MouseEvent));
      this.listen(window, 'mousemove', event => this.onMouseMove(event as MouseEvent));
      this.listen(window, 'mouseup', () => this.endPointer(-1));
    }
    this.listen(area, 'wheel', event => this.onWheel(event as WheelEvent), active);
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(type => {
      this.listen(area, type, event => { if (event.cancelable) event.preventDefault(); }, active);
    });
    this.listen(window, 'blur', () => this.cancelGestures());
    this.listen(window, 'resize', () => this.measure());
    this.listen(document, 'visibilitychange', () => { if (document.hidden) this.cancelGestures(); });
    const Observer = (window as any).ResizeObserver;
    if (Observer) {
      this.resizeObserver = new Observer(() => this.measure());
      this.resizeObserver.observe(area);
    }
    this.measure();
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.cancelGestures();
    this.cleanups.forEach(cleanup => cleanup());
    this.cleanups = [];
    if (this.resizeObserver) this.resizeObserver.disconnect();
  }

  close() {
    this.cancelGestures();
    this.closed.emit();
  }

  resetView() {
    this.cancelGestures();
    this.view = { scale: 1, x: 0, y: 0 };
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    let scale: number;
    if (event.key === '+' || event.key === '=') scale = this.view.scale * 1.25;
    else if (event.key === '-') scale = this.view.scale / 1.25;
    else if (event.key === '0') {
      event.preventDefault();
      this.resetView();
      return;
    } else return;
    event.preventDefault();
    this.zoomAt(scale, { x: this.width / 2, y: this.height / 2 });
  }

  onPointerDown(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.cancelable) event.preventDefault();
    this.pointers.set(event.pointerId, this.point(event.clientX, event.clientY));
    try { this.gestureArea.nativeElement.setPointerCapture(event.pointerId); } catch (_) { }
    this.beginGesture();
  }

  onPointerMove(event: PointerEvent) {
    if (!this.pointers.has(event.pointerId)) return;
    if (event.cancelable) event.preventDefault();
    this.pointers.set(event.pointerId, this.point(event.clientX, event.clientY));
    this.updateGesture();
  }

  onPointerEnd(event: PointerEvent) { this.endPointer(event.pointerId); }

  onTouchStart(event: TouchEvent) {
    if (event.cancelable) event.preventDefault();
    this.syncTouches(event.touches);
    this.beginGesture();
  }

  onTouchMove(event: TouchEvent) {
    if (event.cancelable) event.preventDefault();
    this.syncTouches(event.touches);
    this.updateGesture();
  }

  onTouchEnd(event: TouchEvent) {
    this.syncTouches(event.touches);
    this.beginGesture();
  }

  onMouseDown(event: MouseEvent) {
    if (event.button !== 0 || Date.now() - this.lastTouchTime < 500) return;
    event.preventDefault();
    this.pointers.set(-1, this.point(event.clientX, event.clientY));
    this.beginGesture();
  }

  onMouseMove(event: MouseEvent) {
    if (!this.pointers.has(-1)) return;
    event.preventDefault();
    this.pointers.set(-1, this.point(event.clientX, event.clientY));
    this.updateGesture();
  }

  onWheel(event: WheelEvent) {
    if (event.cancelable) event.preventDefault();
    const units = event.deltaMode === 1 ? 16 : (event.deltaMode === 2 ? this.height : 1);
    this.zoomAt(this.view.scale * Math.exp(-event.deltaY * units * .002), this.point(event.clientX, event.clientY));
  }

  measure() {
    if (this.destroyed || !this.gestureArea) return;
    const bounds = this.gestureArea.nativeElement.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    if (bounds.width === this.width && bounds.height === this.height) return;
    this.cancelGestures();
    let next: ViewerTransform = { scale: this.view.scale, x: 0, y: 0 };
    if (this.width && this.height) {
      const oldBoard = fittedBoardBounds(this.width, this.height);
      const newBoard = fittedBoardBounds(bounds.width, bounds.height);
      const boardX = ((this.width / 2 - this.view.x) / this.view.scale - oldBoard.left) / oldBoard.width;
      const boardY = ((this.height / 2 - this.view.y) / this.view.scale - oldBoard.top) / oldBoard.height;
      next.x = bounds.width / 2 - (newBoard.left + boardX * newBoard.width) * next.scale;
      next.y = bounds.height / 2 - (newBoard.top + boardY * newBoard.height) * next.scale;
    }
    this.width = bounds.width;
    this.height = bounds.height;
    this.view = clampViewerTransform(next, this.width, this.height);
    this.changeDetectorRef.detectChanges();
  }

  cancelGestures() {
    const ids = Array.from(this.pointers.keys());
    this.pointers.clear();
    this.gesture = null;
    ids.forEach(id => this.releasePointer(id));
  }

  private listen(target: EventTarget, type: string, handler: EventListener, options?: AddEventListenerOptions) {
    target.addEventListener(type, handler, options);
    this.cleanups.push(() => target.removeEventListener(type, handler, options));
  }

  private point(clientX: number, clientY: number): ViewerPoint {
    const bounds = this.gestureArea.nativeElement.getBoundingClientRect();
    return { x: clientX - bounds.left, y: clientY - bounds.top };
  }

  private syncTouches(touches: TouchList) {
    this.lastTouchTime = Date.now();
    this.pointers.clear();
    for (let index = 0; index < touches.length; index++) {
      const touch = touches[index];
      this.pointers.set(touch.identifier, this.point(touch.clientX, touch.clientY));
    }
  }

  private beginGesture() {
    const ids = Array.from(this.pointers.keys()).slice(0, 2);
    if (!ids.length) { this.gesture = null; return; }
    const first = this.pointers.get(ids[0]);
    const second = ids.length === 2 ? this.pointers.get(ids[1]) : first;
    this.gesture = {
      ids: ids,
      start: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
      distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
      view: { scale: this.view.scale, x: this.view.x, y: this.view.y }
    };
  }

  private updateGesture() {
    if (!this.gesture) return;
    const first = this.pointers.get(this.gesture.ids[0]);
    if (!first) return;
    if (this.gesture.ids.length === 2) {
      const second = this.pointers.get(this.gesture.ids[1]);
      if (!second) return;
      const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      this.view = zoomViewerBetween(this.gesture.view, this.gesture.view.scale * distance / this.gesture.distance,
        this.gesture.start, midpoint, this.width, this.height);
    } else if (this.view.scale > MIN_ZOOM) {
      this.view = clampViewerTransform({
        scale: this.gesture.view.scale,
        x: this.gesture.view.x + first.x - this.gesture.start.x,
        y: this.gesture.view.y + first.y - this.gesture.start.y
      }, this.width, this.height);
    }
  }

  private zoomAt(scale: number, anchor: ViewerPoint) {
    this.view = zoomViewerBetween(this.view, scale, anchor, anchor, this.width, this.height);
    this.beginGesture();
  }

  private endPointer(id: number) {
    if (!this.pointers.has(id)) return;
    this.pointers.delete(id);
    this.releasePointer(id);
    this.beginGesture();
  }

  private releasePointer(id: number) {
    if (!this.gestureArea || id < 0) return;
    const area = this.gestureArea.nativeElement;
    try { if (area.hasPointerCapture && area.hasPointerCapture(id)) area.releasePointerCapture(id); } catch (_) { }
  }
}
