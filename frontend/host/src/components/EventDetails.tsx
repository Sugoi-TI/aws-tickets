import React from "react";
import { useParams } from "react-router-dom";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

export const EventDetails: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4">Event Details</Typography>
      <Typography variant="body1">Event ID: {eventId}</Typography>
    </Box>
  );
};
