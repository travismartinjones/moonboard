import { Component } from '@angular/core';

class Cell {
  index: number;
  type: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
})
export class HomeComponent {
  cells: Cell[][];
  columns: number = 23;
  rows: number = 36;

  constructor() {
    this.cells = [];
    for (let i = 0; i < this.rows; i++)
      this.cells[i] = [];

    let light = false;
    let hold = false;
    let lightIndex = 0;
    let flipIndex = true;

    for (let column = 0; column < this.columns; column++) {
      for (let row = 0; row < this.rows; row++) {
        if (column%2===0 && (row === 0 || row === this.rows-1)) {
          this.cells[row][column] = { index: -1, type: "gap" };
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
        this.cells[index][column] = { index: lightIndex, type: "test" };

        if (row === this.rows - 1) {
          flipIndex = !flipIndex;
        }
      }
    }
  }
}
