import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import dashjs from "dashjs";
import type { Video } from "@my-app/shared";

const API_URL = import.meta.env.VITE_API_URL;

export const VideoPlayer: React.FC = () => {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);

  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/videos`);

        if (!response.ok) {
          throw new Error("Failed to fetch video");
        }

        const videos: Video[] = await response.json();
        const foundVideo = videos.find((v) => v.id === videoId);

        if (!foundVideo) {
          throw new Error("Video not found");
        }

        if (foundVideo.status !== "PROCESSED" || !foundVideo.cdnUrl) {
          throw new Error("Video is not ready for playback");
        }

        setVideo(foundVideo);
      } catch (err) {
        console.error("Error fetching video:", err);
        setError(err instanceof Error ? err.message : "Failed to load video");
      } finally {
        setLoading(false);
      }
    };

    fetchVideo();
  }, [videoId]);

  useEffect(() => {
    if (video?.cdnUrl && videoRef.current && !playerRef.current) {
      const player = dashjs.MediaPlayer().create();
      player.initialize(videoRef.current, video.cdnUrl, false);
      playerRef.current = player;

      return () => {
        if (playerRef.current) {
          playerRef.current.destroy();
          playerRef.current = null;
        }
      };
    }
  }, [video?.cdnUrl]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <IconButton onClick={() => navigate("/videos")} sx={{ mb: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <IconButton onClick={() => navigate("/videos")}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ ml: 1 }}>
          {video?.title}
        </Typography>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Box sx={{ position: "relative", paddingTop: "56.25%" }}>
          <video
            ref={videoRef}
            controls
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
            }}
          />
        </Box>
      </Paper>

      {video?.description && (
        <Typography variant="body1" sx={{ mb: 2 }}>
          {video.description}
        </Typography>
      )}

      <Button variant="outlined" onClick={() => navigate("/videos")}>
        Back to Videos
      </Button>
    </Box>
  );
};
