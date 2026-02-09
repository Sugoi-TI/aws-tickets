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

export interface Event {
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
