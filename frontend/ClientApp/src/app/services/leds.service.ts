import { Injectable, Inject } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { Route } from "../problem";

@Injectable()
export class LedsService {
  constructor(
    private httpClient: HttpClient,
    @Inject('BASE_URL') private baseUrl: string
  ) { }

  showRoute(route: Route): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.httpClient.put(this.baseUrl + 'leds', route).subscribe(result => { resolve(); }, error => { reject(); });
    });
  }
}
