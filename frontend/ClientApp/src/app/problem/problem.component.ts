import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Problem, Route } from '../problem';

class Cell {
  index: number;
  type: string;
  holdType: string;
}

@Component({
  selector: 'problem',
  templateUrl: './problem.component.html',
  styleUrls: ['./problem.component.css']
})
export class ProblemComponent {
  @Input() problem: Problem;
  @Input() readonly: boolean;
  @Output() onProblemChanged: EventEmitter<Problem> = new EventEmitter<Problem>();

  cells: Cell[][];
  columns: number = 23;
  rows: number = 36;

  constructor() {
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
          this.cells[row][column] = { index: -1, type: 'gap', holdType: '' };
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
        this.cells[index][column] = { index: lightIndex, type: hold ? (flipIndex ? 'hold' : 'light') : (light ? (flipIndex ? 'light' : 'hold') : 'gap'), holdType: '' };

        if (row === this.rows - 1) {
          flipIndex = !flipIndex;
        }
      }
    }
  }

  onHoldSelected(index: number) {
    if (index < 0) return; // gap pressed
    if (this.readonly) return;

    var hold = index.toString();
    if (this.problem.route.START.filter(x => x === hold).length > 0) {
      this.problem.route.START = this.problem.route.START.filter(x => x !== hold);
      this.problem.route.MOVES.push(hold);
      this.updateCells(index, 'MOVES');
    } else if (this.problem.route.MOVES.filter(x => x === hold).length > 0) {
      this.problem.route.MOVES = this.problem.route.MOVES.filter(x => x !== hold);
      this.problem.route.TOP.push(hold);
      this.updateCells(index, 'TOP');
    } else if (this.problem.route.TOP.filter(x => x === hold).length > 0) {
      this.problem.route.TOP = this.problem.route.TOP.filter(x => x !== hold);
      this.problem.route.FEET.push(hold);
      this.updateCells(index, 'FEET');
    } else if (this.problem.route.FEET.filter(x => x === hold).length > 0) {
      this.problem.route.FEET = this.problem.route.FEET.filter(x => x !== hold);
      this.updateCells(index, 'NONE');
    } else {
      this.problem.route.START.push(hold);
      this.updateCells(index, 'START');
    }
  }

  updateCells(index: number, holdType: string) {
    for (let i = 0; i < this.cells.length; i++)
      for (let j = 0; j < this.cells[i].length; j++)
        if (this.cells[i][j].index === index)
          this.cells[i][j].holdType = holdType;
  }
}
