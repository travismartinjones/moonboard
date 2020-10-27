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
  cells: [][];
  const columns: number = 27;
  const rows: number = 36;

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
          this.cells[row][column] = { index: "X", type: "gap" };

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

        let index = flipIndex === true ? (this.rows - row - 1) : row;
        this.cells[index][column] = { index: lightIndex, type: "test" };

        if (row === 0 && !flipIndex || row === this.rows - 1 && flipIndex) {
          flipIndex = !flipIndex;
        }
      }
    }
  }
}
