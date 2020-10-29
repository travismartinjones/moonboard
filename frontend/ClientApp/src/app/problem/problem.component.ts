import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Problem, Route } from '../problem';

class Cell {
  index: number;
  type: string;
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
          this.cells[row][column] = { index: -1, type: 'gap' };
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
        this.cells[index][column] = { index: lightIndex, type: hold ? (flipIndex ? 'hold' : 'light') : (light ? (flipIndex ? 'light' : 'hold') : 'gap') };

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
    } else if (this.problem.route.MOVES.filter(x => x === hold).length > 0) {
      this.problem.route.MOVES = this.problem.route.MOVES.filter(x => x !== hold);
      this.problem.route.TOP.push(hold);
    } else if (this.problem.route.TOP.filter(x => x === hold).length > 0) {
      this.problem.route.TOP = this.problem.route.TOP.filter(x => x !== hold);
      this.problem.route.FEET.push(hold);
    } else if (this.problem.route.FEET.filter(x => x === hold).length > 0) {
      this.problem.route.FEET = this.problem.route.FEET.filter(x => x !== hold);
    } else {
      this.problem.route.START.push(hold);
    }
    alert(JSON.stringify(this.problem));
  }
}
