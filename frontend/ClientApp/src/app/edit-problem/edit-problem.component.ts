import { Component, OnInit, Input, Output } from '@angular/core';
import { Problem } from "../problem";
import { NouisliderModule } from 'ng2-nouislider';
import { VDifficultyFormatter } from '../vdifficultyformatter';
import { ProblemsService } from '../services/problems.service';
import { Router, ActivatedRoute } from '@angular/router';
import { Color } from '../color';

@Component({
  selector: 'edit-problem',
  templateUrl: './edit-problem.component.html'
})
export class EditProblemComponent implements OnInit {
  error: string;
  difficulty: number = 0;
  isNameInvalid: boolean;
  isSetterNameInvalid: boolean;
  isDifficultyInvalid: boolean;
  isProblemInvalid: boolean;
  isArt: boolean = false;
  currentColor: Color = { r: 0, g: 0, b: 0, hex: '#000' };
  problemError: string;
  id: string;
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

  constructor(
    private problemsService: ProblemsService,
    private router: Router,
    activatedRoute: ActivatedRoute
  ) {
    this.id = activatedRoute.snapshot.paramMap.get("id");
  }

  ngOnInit() {
    this.problemsService.getById(this.id).then(problem => {
      this.problem = problem;
      this.isArt = problem.setup === "Art";
      this.difficulty = parseInt(this.problem.difficulty.replace("V", ""));
    });
    this.hueb = new Huebee('.color-input', {
      notation: 'hex'
    });
    this.hueb.on('change', color => {
      this.setColor(color);
    });
  }

  selectDifficulty(value: string) {
    this.problem.difficulty = value;
  }

  updateDifficulty(difficulty: number) {
    this.difficulty = difficulty;
  }

  updateProblem() {
    this.problem.difficulty = 'V' + this.difficulty;
    this.isNameInvalid = !this.problem.name;
    this.isSetterNameInvalid = !this.problem.setter;
    this.isDifficultyInvalid = !this.problem.difficulty;

    if (this.problem.route.FEET.length +
      this.problem.route.MOVES.length +
      this.problem.route.START.length +
      this.problem.route.TOP.length +
      this.problem.route.RGB.length < 3) {
      this.problemError = "You must enter a valid route for the boulder.";
      this.isProblemInvalid = true;
    } else {
      this.isProblemInvalid = false;
    }

    if (this.isNameInvalid || this.isSetterNameInvalid || this.isDifficultyInvalid || this.isProblemInvalid) return;

    this.problemsService.updateProblem(this.problem).then(() => {
      this.router.navigate(['/']);
    });
  }

  onProblemChanged(updatedProblem: Problem) {
    this.problem = updatedProblem;
  }

  setColor(hex: string) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    var rgb = {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
      hex: hex
    };
    this.currentColor = rgb;
  }
}
