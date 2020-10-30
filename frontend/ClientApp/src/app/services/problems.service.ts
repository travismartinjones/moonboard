import { Injectable, Inject } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { Problem } from "../problem";

@Injectable()
export class ProblemsService {
  constructor(
    private httpClient: HttpClient,
    @Inject('BASE_URL') private baseUrl: string
  ) {}

  showProblem(problem: Problem) {
    this.httpClient.put(this.baseUrl + 'leds', problem).subscribe(result => {}, error => {});
  }
}
