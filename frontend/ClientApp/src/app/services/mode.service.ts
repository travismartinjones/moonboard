import { Injectable, Inject } from '@angular/core';
import { EventAggregatorService } from './event-aggregator.service';

@Injectable({
  providedIn: 'root',
})
export class ModeService {
  constructor(
    private eventAggregatorService: EventAggregatorService) {}

  setHoldSetup(setup: string) {
    localStorage.setItem('holdSetup', setup);
    this.eventAggregatorService.publish('holdSetupChangedEvent', setup);
  }

  getHoldSetup(): string {
    let value = localStorage.getItem('holdSetup');
    if (!value) {
      localStorage.setItem('holdSetup', 'Nov2020');
      value = localStorage.getItem('holdSetup');
    }
    return value;
  }
}
