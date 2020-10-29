import { Component } from '@angular/core';
import { Problem, Route } from '../problem';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  selectedProblem: Problem;
}
