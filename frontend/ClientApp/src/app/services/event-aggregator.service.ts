import { Injectable, Inject } from '@angular/core';

@Injectable()
export class EventAggregatorService {
  handlers: any[];

  constructor() {
    this.handlers = [];
  }

  subscribe(event, handler, context) {
    if (typeof context === 'undefined') { context = handler; }
    const subscription = { event: event, handler: handler.bind(context) };
    this.handlers.push(subscription);
    return () => {
      this.handlers = this.handlers.filter(topic => topic !== subscription);
    };
  }

  publish(event, args) {
    this.handlers.slice().forEach(topic => {
      if (topic.event === event) {
        topic.handler(args)
      }
    })
  }
}
