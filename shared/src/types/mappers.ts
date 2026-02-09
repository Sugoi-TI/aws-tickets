import { UserItem, AvenueItem, PerformerItem, EventItem, TicketItem } from "./db-types";
import { User, Avenue, Performer, Ticket, Event } from "./domain-types";

export const Mappers = {
  toUser(item: UserItem): User {
    return {
      email: item.email,
      name: item.name,
      createdAt: item.createdAt,
    };
  },

  toAvenue(item: AvenueItem): Avenue {
    return {
      id: item.id,
      name: item.name,
      location: item.location,
      capacity: item.capacity,
    };
  },

  toPerformer(item: PerformerItem): Performer {
    return {
      id: item.id,
      name: item.name,
      genre: item.genre,
    };
  },

  toEvent(item: EventItem): Event {
    return {
      id: item.id,
      name: item.name,
      date: item.date,

      avenueId: item.avenueId,
      avenueName: item.avenueName,

      performerId: item.performerId,
      performerName: item.performerName,

      genre: item.genre,
      ticketsTotal: item.ticketsTotal,
      ticketsAvailable: item.ticketsAvailable,
    };
  },

  toTicket(item: TicketItem): Ticket {
    return {
      id: item.id,
      eventId: item.eventId,
      eventName: item.eventName,

      ownerEmail: item.ownerEmail,
      purchaseDate: item.purchaseDate,

      price: item.price,
      seat: item.seat,
      status: item.status,
    };
  },
};
