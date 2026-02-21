import React, { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Hls from "hls.js";
import * as PlyrLib from "plyr";
import "plyr/dist/plyr.css";
import type { Video } from "@my-app/shared";

const Plyr = (PlyrLib as any).default || PlyrLib;

interface VideoPlayerProps {
  video: Video;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ video }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Plyr | null>(null);

  useEffect(() => {
    if (!video.cdnUrl || !videoRef.current) return;

    let hls: Hls;
    const videoElement = videoRef.current;

    const defaultOptions: Plyr.Options = {
      controls: [
        "play-large",
        "play",
        "progress",
        "current-time",
        "mute",
        "volume",
        "captions",
        "settings",
        "pip",
        "airplay",
        "fullscreen",
      ],
      settings: ["quality", "speed"],
    };

    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(video.cdnUrl);

      hls.on(Hls.Events.MANIFEST_PARSED, function (event, data) {
        const availableQualities = hls.levels.map((l) => l.height);

        defaultOptions.quality = {
          default: availableQualities[0],
          options: availableQualities,
          forced: true,
          onChange: (newQuality: number) => updateQuality(newQuality),
        };

        playerRef.current = new Plyr(videoElement, defaultOptions);
      });
      hls.attachMedia(videoElement);
    } else if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS support (Safari)
      videoElement.src = video.cdnUrl;
      playerRef.current = new Plyr(videoElement, defaultOptions);
    }

    function updateQuality(newQuality: number) {
      if (!hls) return;
      hls.levels.forEach((level, levelIndex) => {
        if (level.height === newQuality) {
          hls.currentLevel = levelIndex;
        }
      });
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [video.cdnUrl]);

  return (
    <Box sx={{ width: "100%", backgroundColor: "#000" }}>
      <video ref={videoRef} playsInline controls crossOrigin="anonymous" />
    </Box>
  );
};
