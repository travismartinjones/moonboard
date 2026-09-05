import { Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { ModeService } from '../services/mode.service';
import { EventAggregatorService } from '../services/event-aggregator.service';

@Component({
  selector: 'app-nav-menu',
  templateUrl: './nav-menu.component.html',
  styleUrls: ['./nav-menu.component.css']
})
export class NavMenuComponent implements OnDestroy {
  private stopSetupSubscription: () => void;
  isSettingsOpen = false;
  holdSetup: string;

  @ViewChild('settingsButton', { static: true }) settingsButton: ElementRef<HTMLButtonElement>;
  @ViewChild('settingsPanel', { static: false }) settingsPanel: ElementRef<HTMLElement>;
  @ViewChild('setupSelect', { static: false })
  set setupSelect(select: ElementRef<HTMLSelectElement>) {
    if (select) select.nativeElement.focus();
  }

  constructor(
    private modeService: ModeService,
    private element: ElementRef,
    eventAggregator: EventAggregatorService
  ) {
    this.holdSetup = this.modeService.getHoldSetup();
    this.stopSetupSubscription = eventAggregator.subscribe('holdSetupChangedEvent', setup => {
      this.holdSetup = setup;
    }, this);
  }

  ngOnDestroy() {
    this.stopSetupSubscription();
  }

  toggleSettings() {
    this.isSettingsOpen = !this.isSettingsOpen;
  }

  closeSettings(restoreFocus: boolean = false) {
    this.isSettingsOpen = false;
    if (restoreFocus) this.settingsButton.nativeElement.focus();
  }

  updateHoldSetup(setup: string) {
    if (['Sep2021', 'Nov2020', 'Art'].indexOf(setup) === -1) return;
    if (setup !== this.holdSetup) {
      this.holdSetup = setup;
      this.modeService.setHoldSetup(setup);
    }
    this.closeSettings(true);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.isSettingsOpen && !this.element.nativeElement.contains(event.target)) {
      this.closeSettings();
    }
  }

  @HostListener('document:focusin', ['$event'])
  onFocusChange(event: FocusEvent) {
    if (!this.isSettingsOpen || !this.settingsPanel) return;
    const target = event.target as Node;
    if (!this.settingsPanel.nativeElement.contains(target) &&
        !this.settingsButton.nativeElement.contains(target)) this.closeSettings();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: KeyboardEvent) {
    if (!this.isSettingsOpen) return;
    event.preventDefault();
    this.closeSettings(true);
  }
}
