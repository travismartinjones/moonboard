import { Injectable, Inject } from '@angular/core';
import { NouiFormatter } from "ng2-nouislider";

@Injectable()
export class VDifficultyFormatter implements NouiFormatter {
  to(value: number): string {
    return "V" + value;
  }

  from(value: string): number {
    return parseInt(value.replace("V", ""));
  }
}