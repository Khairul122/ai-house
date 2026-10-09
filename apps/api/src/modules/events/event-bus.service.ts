import { EventEmitter } from "node:events";
import { Injectable } from "@nestjs/common";

export interface SystemEvent {
  type:
    | "division.status"
    | "task.updated"
    | "run.event"
    | "approval.created"
    | "approval.decided"
    | "project.updated"
    | "task.dispatched"
    | "social.updated";
  payload: any;
  timestamp: string;
}

@Injectable()
export class EventBusService {
  private emitter = new EventEmitter();

  publish(type: SystemEvent["type"], payload: any): void {
    const event: SystemEvent = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    };
    this.emitter.emit("system-event", event);
  }

  subscribe(callback: (event: SystemEvent) => void): () => void {
    this.emitter.on("system-event", callback);
    return () => this.emitter.off("system-event", callback);
  }
}
