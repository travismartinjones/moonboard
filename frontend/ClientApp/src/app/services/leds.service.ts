import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { timeout } from 'rxjs/operators';
import { Route } from '../problem';

interface LedCommand {
  route: Route;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
}

@Injectable()
export class LedsService {
  private isSending: boolean = false;
  private pendingCommand: LedCommand;
  private readonly requestTimeoutMs: number = 10000;

  constructor(
    private httpClient: HttpClient,
    @Inject('BASE_URL') private baseUrl: string
  ) { }

  showRoute(route: Route): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      // Editors mutate routes in place; capture the command when it is requested.
      const snapshot: Route = {
        FEET: route.FEET.slice(),
        START: route.START.slice(),
        MOVES: route.MOVES.slice(),
        TOP: route.TOP.slice(),
        RGB: route.RGB.map(color => ({ index: color.index, r: color.r, g: color.g, b: color.b }))
      };
      // Keep the most recent intent while one request is in flight. In particular,
      // Lights Off must not wait behind a backlog of individual Art strokes.
      if (this.pendingCommand) {
        const error = Object.assign(new Error('A newer wall request replaced this one.'), { code: 'SUPERSEDED' });
        this.pendingCommand.reject(error);
      }
      this.pendingCommand = { route: snapshot, resolve: resolve, reject: reject };
      this.sendNext();
    });
  }

  private sendNext() {
    if (this.isSending || !this.pendingCommand) return;
    const command = this.pendingCommand;
    this.pendingCommand = null;
    this.isSending = true;
    this.sendRoute(command.route).then(result => {
      this.isSending = false;
      command.resolve(result);
      this.sendNext();
    }, error => {
      this.isSending = false;
      command.reject(error);
      this.sendNext();
    });
  }

  private sendRoute(route: Route): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.httpClient.put(this.baseUrl + 'leds', route)
        .pipe(timeout(this.requestTimeoutMs))
        .subscribe(result => resolve(result), error => {
          let message: string;
          if (error && error.name === 'TimeoutError') {
            message = 'The wall request timed out. The wall state is unknown. Try again.';
          } else if (!error || error.status === 0) {
            message = 'Unable to reach the wall. Check the Pi connection and try again.';
          } else {
            message = 'The wall request failed (HTTP ' + error.status + '). Try again.';
          }
          reject(new Error(message));
        });
    });
  }
}
