import { Component } from '@angular/core';
import { ProblemsService } from '../services/problems.service';
import { ModeService } from '../services/mode.service';

@Component({
  selector: 'footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent {
  holdSetup: string;

  constructor(
    private modeService: ModeService
  ) {
    this.holdSetup = this.modeService.getHoldSetup();
  }

  updateHoldSetup(setup: string) {
    this.holdSetup = setup;
    this.modeService.setHoldSetup(setup);
  }
}
