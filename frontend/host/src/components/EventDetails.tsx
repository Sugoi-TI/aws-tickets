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
  price: number | null;
};

export const EventDetails: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();

  const [event, setEvent] = useState<EventDetailsDTO>();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [isReserving, setIsReserving] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [bookingState, setBookingState] = useState<BookingState>({
    bookingId: null,
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
      setSelectedTicketIds((prev) => {
        if (prev.includes(ticket.id)) {
          return prev.filter((id) => id !== ticket.id);
        }
        return [...prev, ticket.id];
      });
      setError(null);
    }
  };

  const getSeatColor = (ticket: Ticket): string => {
    if (selectedTicketIds.includes(ticket.id)) return "#2196F3";
    if (ticket.status === "AVAILABLE") return "#4CAF50";
    if (ticket.status === "RESERVED") return "#FFC107";
    if (ticket.status === "SOLD") return "#F44336";
    return "#9E9E9E";
  };

  const getToken = async (): Promise<string> => {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString() || "";
  };

  const getTotalPrice = (): number => {
    if (!event) return 0;
    return event.tickets
      .filter((t) => selectedTicketIds.includes(t.id))
      .reduce((sum, t) => sum + t.price, 0);
  };

  const handleReserve = async () => {
    if (selectedTicketIds.length === 0 || !event) return;

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
          ticketIds: selectedTicketIds,
          eventId: event.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to reserve tickets");
      }

      setBookingState({
        bookingId: data.bookingId,
        price: data.price,
      });
      setSelectedTicketIds([]);
      await fetchEvent();
    } catch (err) {
      console.error("Reserve error:", err);
      setError(err instanceof Error ? err.message : "Failed to reserve tickets");
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
        setBookingState({ bookingId: null, price: null });
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
    await new Promise((resolve) => setTimeout(resolve, 5000));

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

  const totalPrice = getTotalPrice();

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
          Select Seats
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
                border: selectedTicketIds.includes(ticket.id) ? "3px solid #000" : "1px solid #000",
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

      {selectedTicketIds.length > 0 && (
        <Typography variant="body1" sx={{ mb: 2 }}>
          Selected: {selectedTicketIds.length} ticket(s) - Total: ${totalPrice}
        </Typography>
      )}

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
            disabled={selectedTicketIds.length === 0 || isReserving}
          >
            {isReserving ? "Reserving..." : `Reserve (${selectedTicketIds.length})`}
          </Button>
        )}
      </Box>

      {bookingState.bookingId && !isProcessingPayment && (
        <Typography sx={{ mt: 2, color: "success.main" }}>
          Tickets reserved! Please proceed to payment.
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
