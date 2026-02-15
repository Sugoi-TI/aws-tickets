import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import type { EventDetailsDTO } from "@my-app/shared";

const API_URL = import.meta.env.VITE_API_URL;

export const EventDetails: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();

  const [event, setEvent] = useState<EventDetailsDTO>();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchEvent = async () => {
      setIsLoading(true);
      fetch(`${API_URL}/event/${eventId}`)
        .then((res) => res.json())
        .then((data: EventDetailsDTO) => {
          setEvent(data);
        })
        .catch((err) => console.error("Failed to load event: ", err))
        .finally(() => setIsLoading(false));
    };

    fetchEvent();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4">Event Details</Typography>
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <>
          <Typography variant="body1">Event ID: {event?.id}</Typography>
          <div>{JSON.stringify(event, null, 2)}</div>
        </>
      )}
    </Box>
  );
};
