import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import { fetchAuthSession } from "aws-amplify/auth";
import type { EventDetailsDTO, Ticket } from "@my-app/shared";

const API_URL = import.meta.env.VITE_API_URL;

type BookingState = {
  bookingId: string | null;
  ticketId: string | null;
  price: number | null;
};

export const EventDetails: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();

  const [event, setEvent] = useState<EventDetailsDTO>();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isReserving, setIsReserving] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [bookingState, setBookingState] = useState<BookingState>({
    bookingId: null,
    ticketId: null,
    price: null,
  });
  const [error, setError] = useState<string | null>(null);

  const fetchEvent = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/event/${eventId}`);
      const data: EventDetailsDTO = await res.json();
      setEvent(data);
    } catch (err) {
      console.error("Failed to load event: ", err);
      setError("Failed to load event");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvent();
  }, [eventId]);

  const handleSelectSeat = (ticket: Ticket) => {
    if (ticket.status === "AVAILABLE") {
      setSelectedTicketId(ticket.id);
      setError(null);
    }
  };

  const getSeatColor = (ticket: Ticket): string => {
    if (ticket.id === selectedTicketId) return "#2196F3"; // Blue - selected
    if (ticket.status === "AVAILABLE") return "#4CAF50"; // Green
    if (ticket.status === "RESERVED") return "#FFC107"; // Yellow
    if (ticket.status === "SOLD") return "#F44336"; // Red
    return "#9E9E9E";
  };

  const getToken = async (): Promise<string> => {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString() || "";
  };

  const handleReserve = async () => {
    if (!selectedTicketId || !event) return;

    setIsReserving(true);
    setError(null);

    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/bookings/reserve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({
          ticketId: selectedTicketId,
          eventId: event.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to reserve ticket");
      }

      setBookingState({
        bookingId: data.bookingId,
        ticketId: selectedTicketId,
        price: data.price,
      });
      setSelectedTicketId(null);
      await fetchEvent();
    } catch (err) {
      console.error("Reserve error:", err);
      setError(err instanceof Error ? err.message : "Failed to reserve ticket");
    } finally {
      setIsReserving(false);
    }
  };

  const handlePay = async () => {
    if (!bookingState.bookingId) return;

    setIsPaying(true);
    setIsProcessingPayment(true);
    setError(null);

    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/bookings/pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({
          bookingId: bookingState.bookingId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to process payment");
      }

      const pollingResult = await pollBookingStatus(bookingState.bookingId, token);

      if (pollingResult === "CONFIRMED") {
        setBookingState({ bookingId: null, ticketId: null, price: null });
        await fetchEvent();
      } else {
        throw new Error("Payment processing timed out. Please try again.");
      }
    } catch (err) {
      console.error("Pay error:", err);
      setError(err instanceof Error ? err.message : "Failed to process payment");
    } finally {
      setIsPaying(false);
      setIsProcessingPayment(false);
    }
  };

  const pollBookingStatus = async (
    bookingId: string,
    token: string,
    maxAttempts = 15,
  ): Promise<string> => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      try {
        const res = await fetch(`${API_URL}/bookings/${bookingId}`, {
          headers: {
            Authorization: token,
          },
        });

        if (!res.ok) continue;

        const data = await res.json();

        if (data.status === "CONFIRMED") {
          return data.status;
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    }
    return "PENDING";
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (!event) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Event not found</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {event.name}
      </Typography>
      <Typography variant="body1" gutterBottom>
        Date: {event.date}
      </Typography>
      <Typography variant="body1" gutterBottom>
        Venue: {event.avenueName}
      </Typography>
      <Typography variant="body1" gutterBottom>
        Performer: {event.performerName}
      </Typography>

      <Box sx={{ mt: 3, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Select a Seat
        </Typography>

        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ width: 20, height: 20, bgcolor: "#4CAF50" }} />
            <Typography variant="body2">Available</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ width: 20, height: 20, bgcolor: "#FFC107" }} />
            <Typography variant="body2">Reserved</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ width: 20, height: 20, bgcolor: "#F44336" }} />
            <Typography variant="body2">Sold</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ width: 20, height: 20, bgcolor: "#2196F3" }} />
            <Typography variant="body2">Selected</Typography>
          </Box>
        </Box>

        <Paper
          variant="outlined"
          sx={{ p: 2, display: "flex", flexWrap: "wrap", gap: 1, maxWidth: 400 }}
        >
          {event.tickets.map((ticket) => (
            <Box
              key={ticket.id}
              onClick={() => handleSelectSeat(ticket)}
              sx={{
                width: 50,
                height: 50,
                bgcolor: getSeatColor(ticket),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: ticket.status === "AVAILABLE" ? "pointer" : "default",
                border: ticket.id === selectedTicketId ? "3px solid #000" : "1px solid #000",
                borderRadius: 1,
                fontSize: 10,
                color: "#fff",
                textAlign: "center",
              }}
            >
              {ticket.seat}
            </Box>
          ))}
        </Paper>
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      <Box sx={{ display: "flex", gap: 2 }}>
        {bookingState.bookingId ? (
          <Button variant="contained" color="primary" onClick={handlePay} disabled={isPaying}>
            {isProcessingPayment ? "Processing payment..." : `Pay $${bookingState.price}`}
          </Button>
        ) : (
          <Button
            variant="contained"
            color="success"
            onClick={handleReserve}
            disabled={!selectedTicketId || isReserving}
          >
            {isReserving ? "Reserving..." : "Reserve"}
          </Button>
        )}
      </Box>

      {bookingState.bookingId && !isProcessingPayment && (
        <Typography sx={{ mt: 2, color: "success.main" }}>
          Ticket reserved! Please proceed to payment.
        </Typography>
      )}

      {isProcessingPayment && (
        <Typography sx={{ mt: 2, color: "info.main" }}>
          Payment is being processed. Please wait...
        </Typography>
      )}
    </Box>
  );
};
