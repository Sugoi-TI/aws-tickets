export interface BaseItem {
  pk: string;
  sk: string;
  gsi1pk?: string;
  gsi1sk?: string;
  gsi2pk?: string;
  gsi2sk?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserItem extends BaseItem {
  entityType: "USER";
  pk: `USER#${string}`;
  sk: "PROFILE";

  email: string;
  name: string;
}

export interface AvenueItem extends BaseItem {
  entityType: "AVENUE";
  pk: `AVENUE#${string}`;
  sk: "META";

  id: string;
  name: string;
  location: string;
  capacity: number;
}

export interface PerformerItem extends BaseItem {
  entityType: "PERFORMER";
  pk: `PERFORMER#${string}`;
  sk: "META";

  id: string;
  name: string;
  genre: string;
}

export interface EventItem extends BaseItem {
  entityType: "EVENT";
  pk: `EVENT#${string}`;
  sk: "META";

  gsi1pk: `AVENUE#${string}`;
  gsi1sk: string;
  gsi2pk: `PERFORMER#${string}`;
  gsi2sk: string;
  gsi3pk: "EVENT";
  gsi3sk: string; // date

  id: string;
  date: string;
  name: string;
  genre: string;

  tickets: TicketItem[];
  ticketsAvailable: number;
  ticketsTotal: number;

  avenueId: string;
  avenueName: string;

  performerId: string;
  performerName: string;
}

export interface TicketItem extends BaseItem {
  entityType: "TICKET";
  pk: `EVENT#${string}`;
  sk: `TICKET#${string}`;

  gsi1pk?: `USER#${string}`;
  gsi1sk?: string;

  id: string;
  price: number;
  seat: string;
  status: "AVAILABLE" | "SOLD";

  eventId: string;
  eventName: string;

  ownerEmail?: string;
  purchaseDate?: string;
}

export interface BookingItem extends BaseItem {
  entityType: "BOOKING";
  pk: `BOOKING#${string}`;
  sk: "META";

  gsi1pk: `USER#${string}`;
  gsi1sk: string; // createAt

  id: string;
  userId: string;
  eventId: string;

  totalPrice: number;
  status: "CONFIRMED" | "CANCELLED" | "PENDING";
  createdAt: string;

  // useful to keep some data to show recipe without fetching db twice
  tickets: Array<{
    id: string;
    seat: string;
    price: number;
  }>;
}
