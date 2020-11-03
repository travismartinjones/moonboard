import { Component, OnInit } from '@angular/core';
import { Problem, Route } from '../problem';
import { ProblemsService } from '../services/problems.service';
import { VDifficultyFormatter } from '../vdifficultyformatter';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  selectedProblem: Problem;
  name: string = "";
  difficultyRange: number[] = [0, 10];
  setter: string = "";
  problems: Problem[];
  sliderConfig: any = {
    step: 1,
    connect: [false,true,false],
    range: {
      min: 0,
      max: 10
    },
    tooltips: [new VDifficultyFormatter(),new VDifficultyFormatter()]
  };
  timeout: number;

  constructor(
    private problemsService: ProblemsService,
    private router: Router
  ) {

  }

  ngOnInit() {
    this.search();
  }

  search(delay: number = 1000) {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    this.timeout = window.setTimeout(() => {
      this.problemsService.search(this.name, "V"+this.difficultyRange[0], "V"+this.difficultyRange[1], this.setter).then(results => {
        this.problems = results;
      });
    }, delay);
  }

  selectProblem(problem: Problem) {
    this.selectedProblem = problem;
  }

  onNameChange(name: string) {
    this.name = name;
    this.search(1000);
  }

  onDifficultyChange(range: number[]) {
    this.difficultyRange = range;
    this.search(500);
  }

  delete() {
    if (!this.selectedProblem) return;

    var promptResponse = prompt("Type DELETE to confirm.");
    if (promptResponse !== "DELETE") {
      return;
    }

    this.problemsService.deleteProblem(this.selectedProblem.id).then(() => {
      this.search();
      this.selectedProblem = null;
    });
  }

  edit() {
    if (!this.selectedProblem) return;

    this.router.navigate(["/edit-problem", this.selectedProblem.id]);
  }
}
