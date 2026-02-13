import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import type { Event } from "@my-app/shared/src/types/domain-types";

const MOCK_EVENTS: Event[] = [
  {
    id: "1",
    name: "Rock Concert",
    date: "2023-12-01T20:00:00Z",
    genre: "Rock",
    ticketsTotal: 1000,
    ticketsAvailable: 500,
    avenueId: "av1",
    avenueName: "Madison Square Garden",
    performerId: "p1",
    performerName: "The Rockers",
  },
  {
    id: "2",
    name: "Jazz Night",
    date: "2023-12-05T19:00:00Z",
    genre: "Jazz",
    ticketsTotal: 200,
    ticketsAvailable: 200,
    avenueId: "av2",
    avenueName: "Blue Note",
    performerId: "p2",
    performerName: "Smooth Jazz Trio",
  },
];

export const EventsTable = () => {
  const navigate = useNavigate();

  const [events, setEvents] = useState<Event[]>(MOCK_EVENTS);
  const [isLoading, setIsLoading] = useState(false);

  const handleRowClick = (eventId: string) => {
    navigate(`/events/${eventId}`);
  };

  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoading(true);
      fetch("/tasks")
        .then((res) => res.json())
        .then((data: Event[]) => {
          setEvents(data);
        })
        .catch((err) => console.error("Failed to load events: ", err))
        .finally(() => setIsLoading(false));
    };

    fetchEvents();
  }, []);

  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} aria-label="events table">
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Genre</TableCell>
            <TableCell>Avenue</TableCell>
            <TableCell align="right">Tickets</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell>"Loading..."</TableCell>
            </TableRow>
          ) : (
            events.map((event) => (
              <TableRow
                key={event.id}
                hover
                onClick={() => handleRowClick(event.id)}
                sx={{ cursor: "pointer" }}
              >
                <TableCell component="th" scope="row">
                  {new Date(event.date).toLocaleDateString()}
                </TableCell>
                <TableCell>{event.name}</TableCell>
                <TableCell>{event.genre}</TableCell>
                <TableCell>{event.avenueName}</TableCell>
                <TableCell align="right">
                  {event.ticketsAvailable} / {event.ticketsTotal}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
