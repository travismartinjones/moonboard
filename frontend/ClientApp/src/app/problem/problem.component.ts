import { Component, OnInit, AfterViewInit, OnDestroy, Input, Output, SimpleChange, EventEmitter, ElementRef, ViewChild, HostBinding, ChangeDetectorRef } from '@angular/core';
import { Problem, Route } from '../problem';
import { LedsService } from '../services/leds.service';
import { Color } from '../color';
import { EventAggregatorService } from '../services/event-aggregator.service';
import { ModeService } from '../services/mode.service';

class Cell {
  index: number;
  type: string;
  holdType: string;
  color: string;
}

@Component({
  selector: 'problem',
  templateUrl: './problem.component.html',
  styleUrls: ['./problem.component.css']
})
export class ProblemComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() problem: Problem;
  @Input() readonly: boolean;
  @Input() artColor: Color;
  @Input() showControls: boolean = true;
  @Input() autoSend: boolean = true;
  @Input() @HostBinding('class.fit-to-container') fitToContainer: boolean = false;
  @ViewChild('boardStage', { static: true }) boardStage: ElementRef<HTMLDivElement>;
  fittedWidth: number = 0;
  fittedHeight: number = 0;
  isSending: boolean = false;
  lightingError: string = '';
  lightingStatus: string = '';
  lastSentLighting: boolean = null;
  private sendVersion: number = 0;
  private initialized: boolean = false;
  private destroyed: boolean = false;
  private resizeObserver: any;
  private unsubscribeSetup: () => void;
  private resizeBoard = () => this.updateBoardSize();
  isArt: boolean;
  isLighting: boolean = true;
  @Output() onProblemChanged: EventEmitter<Problem> = new EventEmitter<Problem>();

  cells: Cell[][];
  columns: number = 23;
  rows: number = 36;
  isDrawing: boolean;
  setup: string;

  constructor(
    private eventAggregator: EventAggregatorService,
    private ledsService: LedsService,
    private modeService: ModeService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    this.setup = modeService.getHoldSetup();
    this.isArt = this.setup === 'Art';
    this.unsubscribeSetup = eventAggregator.subscribe('holdSetupChangedEvent', setup => {
      this.updateSetup();
      this.endDrawing();
    }, this);

    this.isLighting = localStorage.getItem('isLighting') !== 'false';

    this.problem = new Problem();

    this.cells = [];
    for (let i = 0; i < this.rows; i++)
      this.cells[i] = [];
    let light = false;
    let hold = false;
    let lightIndex = 0;
    let flipIndex = true;

    for (let column = 0; column < this.columns; column++) {
      for (let row = 0; row < this.rows; row++) {
        if (column % 2 === 0 && (row === 0 || row === this.rows - 1)) {
          this.cells[row][column] = { index: -1, type: 'gap', holdType: '', color: '' };
          if (row === this.rows - 1) {
            flipIndex = !flipIndex;
          }
          continue;
        }

        if (light && hold) {
          lightIndex++;
          light = hold = false;
        }

        if (!light) {
          light = true;
        } else if (!hold) {
          hold = true;
        }

        const index = flipIndex ? (this.rows - row - 1) : row;
        this.cells[index][column] = { index: lightIndex, type: hold ? (flipIndex ? 'hold' : 'light') : (light ? (flipIndex ? 'light' : 'hold') : 'gap'), holdType: '', color: '' };

        if (row === this.rows - 1) {
          flipIndex = !flipIndex;
        }
      }
    }
  }

  ngOnInit() {
    if (!this.initialized) this.initialize();
  }

  ngAfterViewInit() {
    const ResizeObserverClass = (window as any).ResizeObserver;
    if (ResizeObserverClass) {
      this.resizeObserver = new ResizeObserverClass(this.resizeBoard);
      this.resizeObserver.observe(this.boardStage.nativeElement);
    }
    window.addEventListener('resize', this.resizeBoard);
    this.updateBoardSize();
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.endDrawing();
    if (this.resizeObserver) this.resizeObserver.disconnect();
    window.removeEventListener('resize', this.resizeBoard);
    if (this.unsubscribeSetup) this.unsubscribeSetup();
  }

  updateBoardSize() {
    if (!this.fitToContainer || !this.boardStage || this.destroyed) return;
    // Layout dimensions exclude the viewer transform when a zoomed board resizes.
    const stage = this.boardStage.nativeElement;
    const width = Math.max(0, Math.min(stage.clientWidth, stage.clientHeight / 1.56));
    if (Math.abs(width - this.fittedWidth) < .01) return;
    this.fittedWidth = width;
    this.fittedHeight = width * 1.56;
    this.changeDetectorRef.detectChanges();
  }

  ngOnChanges(changes: { [propertyName: string]: SimpleChange }) {
    if (changes['problem'] || changes['autoSend'] || changes['readonly']) {
      this.initialize();
    }
  }

  updateSetup() {
    this.setup = this.problem && !this.problem.isNew && this.problem.setup
      ? this.problem.setup : this.modeService.getHoldSetup();
    this.isArt = this.setup === 'Art';
  }

  initialize() {
    this.initialized = true;
    this.updateSetup();
    if (!this.problem || !this.problem.route) {
      this.clearCells();
      return;
    }

    this.updateCellsToMatchProblem();
  }

  onHoldTouched(index: number) {

    if (index < 0 || this.readonly || !this.isArt || !this.problem || !this.problem.route || !this.artColor) return;

    const indexString = index.toString();
    this.problem.route.RGB = this.problem.route.RGB.filter(x => x.index !== indexString);

    if (this.artColor.r != 0 || this.artColor.g != 0 || this.artColor.b != 0) {
      this.problem.route.RGB.push({
        index: indexString,
        r: this.artColor.r,
        g: this.artColor.g,
        b: this.artColor.b
      });

      this.updateCells(index, 'RGB', this.artColor.hex);
    } else {
      this.updateCells(index, 'RGB', '');
    }

    if (this.isLighting) this.sendLighting();
  }

  onHoldSelected(index: number) {
    if (index < 0) return; // gap pressed
    if (this.readonly || !this.problem || !this.problem.route) return;

    var hold = index.toString();
    if (this.problem.route.START.filter(x => x === hold).length > 0) {
      this.problem.route.START = this.problem.route.START.filter(x => x !== hold);
      this.problem.route.MOVES.push(hold);
      this.updateCells(index, 'MOVES', '');
    } else if (this.problem.route.MOVES.filter(x => x === hold).length > 0) {
      this.problem.route.MOVES = this.problem.route.MOVES.filter(x => x !== hold);
      this.problem.route.TOP.push(hold);
      this.updateCells(index, 'TOP', '');
    } else if (this.problem.route.TOP.filter(x => x === hold).length > 0) {
      this.problem.route.TOP = this.problem.route.TOP.filter(x => x !== hold);
      this.problem.route.FEET.push(hold);
      this.updateCells(index, 'FEET', '');
    } else if (this.problem.route.FEET.filter(x => x === hold).length > 0) {
      this.problem.route.FEET = this.problem.route.FEET.filter(x => x !== hold);
      this.updateCells(index, 'NONE', '');
    } else {
      this.problem.route.START.push(hold);
      this.updateCells(index, 'START', '');
    }

    if (this.isLighting) this.sendLighting();
  }

  updateCells(index: number, holdType: string, color: string) {
    for (let i = 0; i < this.cells.length; i++)
      for (let j = 0; j < this.cells[i].length; j++)
        if (this.cells[i][j].index === index) {
          this.cells[i][j].holdType = holdType;
          this.cells[i][j].color = color;
        }
  }

  componentToHex(c: number): string {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
  }

  rgbToHex(r: number, g: number, b: number): string {
    return "#" + this.componentToHex(r) + this.componentToHex(g) + this.componentToHex(b);
  }

  clearCells() {
    for (const row of this.cells) {
      for (const cell of row) {
        cell.holdType = '';
        cell.color = '';
      }
    }
  }

  updateCellsToMatchProblem() {
    this.clearCells();

    for (let index of this.problem.route.START) {
      this.updateCells(parseInt(index), 'START', '');
    }
    for (let index of this.problem.route.FEET) {
      this.updateCells(parseInt(index), 'FEET', '');
    }
    for (let index of this.problem.route.TOP) {
      this.updateCells(parseInt(index), 'TOP', '');
    }
    for (let index of this.problem.route.MOVES) {
      this.updateCells(parseInt(index), 'MOVES', '');
    }
    for (let color of this.problem.route.RGB) {
      this.updateCells(parseInt(color.index), 'RGB', this.rgbToHex(color.r, color.g, color.b));
    }
  }

  startDrawing() {
    this.isDrawing = !this.readonly && this.isArt && !!this.problem && !!this.problem.route && !!this.artColor;
  }

  endDrawing() {
    this.isDrawing = false;
  }

  toggleLighting() {
    if (!this.autoSend || this.readonly) return;
    this.isLighting = this.lastSentLighting === null && !this.isSending ? true : !this.isLighting;
    localStorage.setItem('isLighting', this.isLighting ? 'true' : 'false');
    this.sendLighting();
  }

  retryLighting() {
    this.sendLighting();
  }

  private sendLighting() {
    if (!this.autoSend || this.readonly || this.destroyed) return;
    if (this.isLighting && (!this.problem || !this.problem.route)) return;
    const version = ++this.sendVersion;
    this.isSending = true;
    this.lightingError = '';
    this.lightingStatus = '';
    const targetLighting = this.isLighting;
    const route = targetLighting ? this.problem.route : new Route();
    this.ledsService.showRoute(route).then(() => {
      if (this.destroyed || version !== this.sendVersion) return;
      this.isSending = false;
      this.lastSentLighting = targetLighting;
      this.lightingStatus = 'Request sent.';
    }).catch(error => {
      if (this.destroyed || version !== this.sendVersion) return;
      this.isSending = false;
      this.lightingError = error && error.message ? error.message : 'Unable to send the wall request. Try again.';
    });
  }
}
