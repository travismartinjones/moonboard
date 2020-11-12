import { Component, OnInit, Input, Output, OnChanges, SimpleChange, EventEmitter } from '@angular/core';
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
export class ProblemComponent implements OnInit {
  @Input() problem: Problem;
  @Input() readonly: boolean;
  @Input() artColor: Color;
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
    private modeService: ModeService
  ) {
    this.setup = modeService.getHoldSetup();
    this.isArt = this.setup === 'Art';
    eventAggregator.subscribe('holdSetupChangedEvent', setup => {
      this.setup = setup;
      this.isArt = this.setup === 'Art';
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
    if (this.problem) {
      this.initialize();
    }
  }

  ngOnChanges(changes: { [propertyName: string]: SimpleChange }) {
    if (changes['problem']) {
      this.initialize();
    }
  }

  initialize() {
    if (!this.problem || !this.problem.route) {
      return;
    }

    if (this.isLighting) {
      this.ledsService.showRoute(this.problem.route);
    }
    this.updateCellsToMatchProblem();
  }

  onHoldTouched(index: number) {

    if (index < 0) return; // gap pressed

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

    if (this.isLighting) {
      this.ledsService.showRoute(this.problem.route);
    }
  }

  onHoldSelected(index: number) {
    if (index < 0) return; // gap pressed
    if (this.readonly) return;

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

    if (this.isLighting) {
      this.ledsService.showRoute(this.problem.route);
    }
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

  updateCellsToMatchProblem() {
    for (let i = 0; i < this.cells.length; i++)
      for (let j = 0; j < this.cells[i].length; j++)
        this.cells[i][j].holdType = '';

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
    this.isDrawing = true;
  }

  endDrawing() {
    this.isDrawing = false;
  }

  toggleLighting() {
    this.isLighting = !this.isLighting;
    localStorage.setItem('isLighting', this.isLighting ? 'true' : 'false');
  }
}
