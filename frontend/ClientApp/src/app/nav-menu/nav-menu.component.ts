import { Component } from '@angular/core';
import { ProblemsService } from '../services/problems.service';
import { ModeService } from '../services/mode.service';

@Component({
  selector: 'app-nav-menu',
  templateUrl: './nav-menu.component.html',
  styleUrls: ['./nav-menu.component.css']
})
export class NavMenuComponent {
  isExpanded = false;
  holdSetup: string;

  constructor(
    private modeService: ModeService
  ) {
    this.holdSetup = this.modeService.getHoldSetup();
  }

  collapse() {
    this.isExpanded = false;
  }

  toggle() {
    this.isExpanded = !this.isExpanded;
  }

  updateHoldSetup(setup: string) {
    this.holdSetup = setup;
    this.modeService.setHoldSetup(setup);
  }
}
