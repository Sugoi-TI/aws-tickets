import React, { useState } from "react";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import LinearProgress from "@mui/material/LinearProgress";
import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import { fetchAuthSession } from "aws-amplify/auth";

const API_URL = import.meta.env.VITE_API_URL;

const getToken = async (): Promise<string> => {
  const session = await fetchAuthSession();
  return session.tokens?.accessToken?.toString() || "";
};

interface UploadResponse {
  videoId: string;
  uploadUrl: string;
  s3Key: string;
}

export const VideoUpload: React.FC = () => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!title || !file) {
      setError("Title and file are required");
      return;
    }

    setUploading(true);
    setProgress(10);
    setError(null);

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/videos/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({
          title,
          description,
          fileName: file.name,
          contentType: file.type || "video/mp4",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get upload URL");
      }

      const data: UploadResponse = await response.json();
      setProgress(30);

      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percentComplete = 30 + (event.loaded / event.total) * 60;
          setProgress(percentComplete);
        }
      });

      await new Promise((resolve, reject) => {
        xhr.addEventListener("load", resolve);
        xhr.addEventListener("error", reject);
        xhr.open("PUT", data.uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
        xhr.send(file);
      });

      setProgress(100);
      setSuccess(true);

      setTitle("");
      setDescription("");
      setFile(null);
    } catch (err) {
      console.error("Upload error:", err);
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 600, mx: "auto" }}>
      <Typography variant="h4" gutterBottom>
        Upload Video
      </Typography>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Video uploaded successfully! It will be processed shortly.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            margin="normal"
            required
            disabled={uploading}
          />

          <TextField
            fullWidth
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            margin="normal"
            multiline
            rows={3}
            disabled={uploading}
          />

          <Box sx={{ mt: 2, mb: 2 }}>
            <input
              accept="video/*"
              style={{ display: "none" }}
              id="video-file-input"
              type="file"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <label htmlFor="video-file-input">
              <Button variant="outlined" component="span" disabled={uploading} fullWidth>
                {file ? file.name : "Select Video File"}
              </Button>
            </label>
          </Box>

          {uploading && (
            <Box sx={{ mt: 2, mb: 2 }}>
              <LinearProgress variant="determinate" value={progress} />
              <Typography variant="body2" sx={{ mt: 1 }}>
                {Math.round(progress)}% uploaded
              </Typography>
            </Box>
          )}

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={uploading || !file}
            sx={{ mt: 2 }}
          >
            {uploading ? "Uploading..." : "Upload Video"}
          </Button>
        </form>
      </Paper>
    </Box>
  );
};
