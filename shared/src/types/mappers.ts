import { UserItem, AvenueItem, PerformerItem, EventItem, TicketItem } from "./db-types";
import { User, Avenue, Performer, Ticket, EventPreview, EventDetailsDTO } from "./domain-types";

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

  toEventPreview(item: EventItem): EventPreview {
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
  toEventDetails(item: EventItem): EventDetailsDTO {
    return {
      id: item.id,
      name: item.name,
      date: item.date,
      genre: item.genre,

      avenueId: item.avenueId,
      avenueName: item.avenueName,

      performerId: item.performerId,
      performerName: item.performerName,

      tickets: item.tickets.map(this.toTicket),
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
