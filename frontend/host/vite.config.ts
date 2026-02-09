import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      federation({
        name: "host_app",
        remotes: {
          // SOME_MICROFRONTEND: env. || "http://localhost:5001/assets/remoteEntry.js",
          API_URL: env.VITE_API_URL || "",
        },
        shared: {
          react: {
            singleton: true,
            requiredVersion: false,
          },
          "react-dom": {
            singleton: true,
            requiredVersion: false,
          },
          "aws-amplify": {
            singleton: true,
            requiredVersion: false,
          },
          "@aws-amplify/auth": {
            singleton: true,
            requiredVersion: false,
          },
        } as never,
      }),
    ],
    build: {
      target: "esnext",
    },
  };
});
