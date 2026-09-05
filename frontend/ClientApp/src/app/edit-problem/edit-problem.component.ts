import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Problem } from "../problem";
import { VDifficultyFormatter } from '../vdifficultyformatter';
import { ProblemsService } from '../services/problems.service';
import { Router, ActivatedRoute } from '@angular/router';
import { Color } from '../color';
declare var Huebee: any;

@Component({
  selector: 'edit-problem',
  templateUrl: './edit-problem.component.html',
  styleUrls: ['../add-problem/add-problem.component.css']
})
export class EditProblemComponent implements OnInit {
  error: string;
  isSaving: boolean = false;
  isLoading: boolean = true;
  saveError: string;
  difficulty: number = 0;
  isNameInvalid: boolean;
  isSetterNameInvalid: boolean;
  isDifficultyInvalid: boolean;
  isProblemInvalid: boolean;
  isArt: boolean = false;
  hueb: any;
  hasHuebee: boolean = typeof Huebee === 'function';
  currentColor: Color = { r: 0, g: 0, b: 0, hex: '#000000' };

  @ViewChild('colorInput', { static: false })
  set colorInput(input: ElementRef<HTMLInputElement>) {
    if (!input || !this.hasHuebee || this.hueb) return;

    this.hueb = new Huebee(input.nativeElement, { notation: 'hex' });
    this.hueb.on('change', color => this.setColor(color));
  }
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
    if (!this.id) {
      this.error = 'Problem not found.';
      this.isLoading = false;
      return;
    }

    this.problemsService.getById(this.id).then(problem => {
      if (!problem || !problem.route) {
        this.error = 'Problem not found.';
        this.isLoading = false;
        return;
      }

      this.problem = problem;
      this.isArt = problem.setup === 'Art';
      const difficulty = parseInt((problem.difficulty || '').replace('V', ''), 10);
      this.difficulty = isNaN(difficulty) ? 0 : difficulty;
      this.isLoading = false;
    }).catch(() => {
      this.error = 'Unable to load this problem. Please try again.';
      this.isLoading = false;
    });
  }

  selectDifficulty(value: string) {
    this.problem.difficulty = value;
  }

  updateDifficulty(difficulty: number) {
    this.difficulty = difficulty;
  }

  updateProblem() {
    if (!this.problem || this.isLoading || this.isSaving) return;
    this.saveError = null;

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

    this.isSaving = true;
    this.problemsService.updateProblem(this.problem).then(() => {
      this.router.navigate(['/'], { queryParams: { id: this.problem.id } });
    }).catch(() => {
      this.isSaving = false;
      this.saveError = 'Unable to save your changes. Please try again.';
    });
  }

  onProblemChanged(updatedProblem: Problem) {
    this.problem = updatedProblem;
  }

  setColor(hex: string) {
    const normalized = (hex || '').replace(/^#([a-f\d])([a-f\d])([a-f\d])$/i, '#$1$1$2$2$3$3');
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized);
    if (!result) return;

    this.currentColor = {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
      hex: '#' + result[1] + result[2] + result[3]
    };
  }
}
