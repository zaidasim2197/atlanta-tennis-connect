import { EventEmitter } from "node:events";

export interface CapacityChangeEvent {
  type: "reservation.created" | "reservation.registered" | "reservation.cancelled" | "reservation.expired" | "reservation.failed" | "league.updated";
  leagueSlug: string;
  spotsRemaining?: number;
  reservationId?: string;
  status?: string;
}

export const capacityEvents = new EventEmitter();

export function broadcastCapacityChange(event: CapacityChangeEvent) {
  capacityEvents.emit("capacity_change", event);
}
