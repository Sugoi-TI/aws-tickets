import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Header } from "./components/Header";
import { EventsTable } from "./components/EventsTable";
import { EventDetails } from "./components/EventDetails";
import Box from "@mui/material/Box";
import type { Event } from "@my-app/shared/src/types/domain-types";

function App() {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <BrowserRouter>
          <Box sx={{ flexGrow: 1 }}>
            <Header user={user} signOut={signOut} />
            <Box sx={{ p: 3 }}>
              <Routes>
                <Route path="/" element={<EventsTable />} />
                <Route path="/events/:eventId" element={<EventDetails />} />
              </Routes>
            </Box>
          </Box>
        </BrowserRouter>
      )}
    </Authenticator>
  );
}

export default App;
