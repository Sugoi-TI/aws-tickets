import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Header } from "./components/Header";
import { EventsTable } from "./components/EventsTable";
import { EventDetails } from "./components/EventDetails";
import { VideoList } from "./components/VideoList";
import { VideoUpload } from "./components/VideoUpload";
import { VideoPlayer } from "./components/VideoPlayer";
import Box from "@mui/material/Box";

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
                <Route path="/videos" element={<VideoList />} />
                <Route path="/videos/upload" element={<VideoUpload />} />
                <Route path="/videos/:videoId" element={<VideoPlayer />} />
              </Routes>
            </Box>
          </Box>
        </BrowserRouter>
      )}
    </Authenticator>
  );
}

export default App;
