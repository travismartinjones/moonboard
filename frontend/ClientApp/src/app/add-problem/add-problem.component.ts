import { Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { Problem } from "../problem";
import { VDifficultyFormatter } from '../vdifficultyformatter';
import { ProblemsService } from '../services/problems.service';
import { Router } from '@angular/router';
import { ModeService } from '../services/mode.service';
import { EventAggregatorService } from '../services/event-aggregator.service';
import { Color } from '../color';
declare var Huebee: any;

@Component({
  selector: 'add-problem',
  templateUrl: './add-problem.component.html',
  styleUrls: ['./add-problem.component.css']
})
export class AddProblemComponent implements OnDestroy {
  private stopSetupSubscription: () => void;
  error: string;
  isSaving: boolean = false;
  difficulty: number = 0;
  isNameInvalid: boolean;
  isSetterNameInvalid: boolean;
  isDifficultyInvalid: boolean;
  isArt: boolean = false;
  isProblemInvalid: boolean;
  problemError: string;
  problem: Problem;
  hueb: any;
  hasHuebee: boolean = typeof Huebee === 'function';
  currentColor: Color = { r: 0, g: 0, b: 0, hex: '#000000' };

  @ViewChild('colorInput', { static: false })
  set colorInput(input: ElementRef<HTMLInputElement>) {
    if (!input || !this.hasHuebee || this.hueb) return;

    this.hueb = new Huebee(input.nativeElement, { notation: 'hex' });
    this.hueb.on('change', color => this.setColor(color));
  }
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
    private modeService: ModeService,
    private eventAggregator: EventAggregatorService
  ) {
    this.problem = new Problem();
    this.updateIsArt();
    this.stopSetupSubscription = eventAggregator.subscribe('holdSetupChangedEvent', setup => {
      this.updateIsArt();
    }, this);
  }

  ngOnDestroy() {
    this.stopSetupSubscription();
  }

  updateIsArt() {
    this.isArt = this.modeService.getHoldSetup() === "Art";
  }

  selectDifficulty(value: string) {
    this.problem.difficulty = value;
  }

  updateDifficulty(difficulty: number) {
    this.difficulty = difficulty;
  }

  addProblem() {
    if (this.isSaving) return;
    this.error = null;
    this.problem.difficulty = 'V' + this.difficulty;
    this.isNameInvalid = !this.problem.name;
    this.isSetterNameInvalid = !this.problem.setter;
    this.isDifficultyInvalid = !this.problem.difficulty;

    if (this.problem.route.FEET.length +
      this.problem.route.MOVES.length +
      this.problem.route.START.length +
      this.problem.route.TOP.length +
      this.problem.route.RGB.length <3) {
      this.problemError = "You must enter a valid route for the boulder.";
      this.isProblemInvalid = true;
    } else {
      this.isProblemInvalid = false;
    }

    if (this.isNameInvalid || this.isSetterNameInvalid || this.isDifficultyInvalid || this.isProblemInvalid) return;

    this.problem.setup = this.modeService.getHoldSetup();

    this.isSaving = true;
    this.problemsService.addProblem(this.problem).then(() => {
      this.router.navigate(['/']);
    }).catch(() => {
      this.isSaving = false;
      this.error = 'Unable to save this problem. Please try again.';
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
