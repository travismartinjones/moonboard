import { Component } from '@angular/core';
import { Problem } from "../problem";
import { NouisliderModule } from 'ng2-nouislider';
import { VDifficultyFormatter } from '../vdifficultyformatter';

@Component({
  selector: 'app-problem',
  templateUrl: './add-problem.component.html'
})
export class AddProblemComponent {
  error: string;
  difficulty: number = 0;
  isNameInvalid: boolean;
  isSetterNameInvalid: boolean;
  isDifficultyInvalid: boolean;
  isProblemInvalid: boolean;
  problemError: string;
  problem: Problem;
  sliderConfig: any = {
    step: 1,
    connect: 'lower',
    range: {
      min: 0,
      max: 10
    },
    tooltips: [new VDifficultyFormatter()]
  };

  constructor() {
    this.problem = new Problem();
  }

  selectDifficulty(value: string) {
    this.problem.difficulty = value;
  }

  updateDifficulty(difficulty: number) {
    this.difficulty = difficulty;
  }

  addProblem() {
    this.problem.difficulty = 'V' + this.difficulty;
    this.isNameInvalid = !this.problem.name;
    this.isSetterNameInvalid = !this.problem.setter;
    this.isDifficultyInvalid = !this.problem.difficulty;

    if (this.problem.route.FEET.length +
      this.problem.route.MOVES.length +
      this.problem.route.START.length +
      this.problem.route.TOP.length < 3) {
      this.problemError = "You must enter a valid route for the boulder.";
      this.isProblemInvalid = true;
    }

    if (!this.isNameInvalid || this.isSetterNameInvalid || this.isDifficultyInvalid || this.isProblemInvalid) return;
  }

  onProblemChanged(updatedProblem: Problem) {
    this.problem = updatedProblem;
  }
}
