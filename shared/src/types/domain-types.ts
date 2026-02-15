export interface User {
  email: string;
  name: string;
  createdAt: string;
}

export interface Avenue {
  id: string;
  name: string;
  location: string;
  capacity: number;
}

export interface Performer {
  id: string;
  name: string;
  genre: string;
}

export interface EventPreview {
  id: string;
  name: string;
  date: string;
  genre: string;
  ticketsTotal: number;
  ticketsAvailable: number;

  avenueId: string;
  avenueName: string;

  performerId: string;
  performerName: string;
}

export interface EventDetailsDTO {
  id: string;
  name: string;
  date: string;
  genre: string;

  avenueId: string;
  avenueName: string;

  performerId: string;
  performerName: string;

  tickets: Ticket[];
  ticketsTotal: number;
  ticketsAvailable: number;
}

export interface Ticket {
  id: string;
  eventId: string;
  eventName: string;

  ownerEmail?: string;
  purchaseDate?: string;

  price: number;
  seat: string;
  status: "AVAILABLE" | "SOLD" | "RESERVED";
}

export interface BookingTicket {
  id: string;
  seat: string;
  price: number;
}

export interface Booking {
  id: string;
  userId: string;
  eventId: string;

  totalPrice: number;
  status: "CONFIRMED" | "CANCELLED" | "PENDING";
  createdAt: string;

  tickets: BookingTicket[];
}
