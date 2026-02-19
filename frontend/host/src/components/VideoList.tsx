import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import VideocamIcon from "@mui/icons-material/Videocam";
import { fetchAuthSession } from "aws-amplify/auth";
import type { Video } from "@my-app/shared";

const API_URL = import.meta.env.VITE_API_URL;

const statusColors: Record<
  string,
  "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"
> = {
  PENDING: "default",
  UPLOADED: "info",
  PROCESSING: "warning",
  PROCESSED: "success",
  FAILED: "error",
};

export const VideoList: React.FC = () => {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getToken = async (): Promise<string> => {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString() || "";
  };

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const response = await fetch(`${API_URL}/videos`, {
        headers: {
          Authorization: token,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch videos");
      }

      const data: Video[] = await response.json();
      setVideos(data);
    } catch (err) {
      console.error("Error fetching videos:", err);
      setError(err instanceof Error ? err.message : "Failed to load videos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handlePlay = (videoId: string) => {
    navigate(`/videos/${videoId}`);
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4">Videos</Typography>
        <Button variant="contained" onClick={() => navigate("/videos/upload")}>
          Upload New Video
        </Button>
      </Box>

      {videos.length === 0 ? (
        <Alert severity="info">No videos available. Upload your first video!</Alert>
      ) : (
        <Grid container spacing={3}>
          {videos.map((video) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={video.id}>
              <Card>
                <Box
                  sx={{
                    height: 140,
                    backgroundColor: "grey.300",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <VideocamIcon sx={{ fontSize: 60, color: "grey.500" }} />
                </Box>
                <CardContent>
                  <Typography variant="h6" noWrap title={video.title}>
                    {video.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {video.description || "No description"}
                  </Typography>
                  <Chip
                    label={video.status}
                    color={statusColors[video.status] || "default"}
                    size="small"
                  />
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    startIcon={<PlayArrowIcon />}
                    disabled={video.status !== "PROCESSED"}
                    onClick={() => handlePlay(video.id)}
                    fullWidth
                  >
                    {video.status === "PROCESSED" ? "Watch" : video.status}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};
