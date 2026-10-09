import { Controller, Inject, Sse } from "@nestjs/common";
import { Observable } from "rxjs";
import { EventBusService, type SystemEvent } from "../event-bus.service.js";

@Controller("api/events")
export class EventsController {
  constructor(
    @Inject(EventBusService)
    private readonly eventBus: EventBusService,
  ) {}

  @Sse()
  streamEvents(): Observable<{ data: SystemEvent }> {
    return new Observable((subscriber) => {
      const unsubscribe = this.eventBus.subscribe((event) => {
        subscriber.next({ data: event });
      });
      return () => unsubscribe();
    });
  }
}
