import React, { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Hls from "hls.js";
import type { Video } from "@my-app/shared";

interface VideoPlayerProps {
  video: Video;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ video }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!video.cdnUrl || !videoRef.current) return;

    let hls: Hls;

    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(video.cdnUrl);
      hls.attachMedia(videoRef.current);
    } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS support (Safari)
      videoRef.current.src = video.cdnUrl;
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [video.cdnUrl]);

  return (
    <Box
      sx={{ position: "relative", paddingTop: "56.25%", backgroundColor: "#000", width: "100%" }}
    >
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
  );
};
