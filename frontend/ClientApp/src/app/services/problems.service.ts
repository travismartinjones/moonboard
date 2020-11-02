import { Injectable, Inject } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { Problem } from "../problem";

@Injectable()
export class ProblemsService {
  constructor(
    private httpClient: HttpClient,
    @Inject('BASE_URL') private baseUrl: string
  ) {}
}
