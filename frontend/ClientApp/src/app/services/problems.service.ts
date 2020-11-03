import { Injectable, Inject } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { Problem } from "../problem";

@Injectable()
export class ProblemsService {
  constructor(
    private httpClient: HttpClient,
    @Inject('BASE_URL') private baseUrl: string
  ) { }

  addProblem(problem: Problem): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.httpClient.post(this.baseUrl + 'problems', problem).subscribe(
        result => { resolve(result); },
        error => { reject(); });
    });
  }

  updateProblem(problem: Problem): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.httpClient.put(this.baseUrl + 'problems', problem).subscribe(
        result => { resolve(result); },
        error => { reject(); });
    });
  }

  deleteProblem(id: string): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.httpClient.delete(this.baseUrl + 'problems/' + id).subscribe(
        result => { resolve(result); },
        error => { reject(); });
    });
  }


  search(name: string, min: string, max: string, setter: string): Promise<Problem[]> {
    return new Promise<Problem[]>((resolve, reject) => {
      this.httpClient.get(this.baseUrl + 'problems/search?name=' + (name ? name : '') + '&min=' + (min ? min : '') + '&max=' + (max ? max : '') + '&setter=' + (setter ? setter : '')).subscribe(
        result => { resolve(result as Problem[]); },
        error => { reject(); });
    });
  }

  getById(id: string): Promise<Problem> {
    return new Promise<Problem>((resolve, reject) => {
      this.httpClient.get(this.baseUrl + 'problems/' + id).subscribe(
        result => { resolve(result as Problem); },
        error => { reject(); });
    });
  }

}
