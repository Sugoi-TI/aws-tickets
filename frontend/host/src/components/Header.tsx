import React from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import AccountCircle from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import { useNavigate, useLocation } from "react-router-dom";
import type { AuthUser } from "aws-amplify/auth";

interface HeaderProps {
  user?: AuthUser;
  signOut?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, signOut }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const username = user?.username || user?.signInDetails?.loginId || "User";

  const isActive = (path: string) => location.pathname === path;

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          AWS Tickets
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Button
            color="inherit"
            onClick={() => navigate("/")}
            sx={{ fontWeight: isActive("/") ? "bold" : "normal" }}
          >
            Events
          </Button>
          <Button
            color="inherit"
            onClick={() => navigate("/videos")}
            sx={{ fontWeight: isActive("/videos") ? "bold" : "normal" }}
          >
            Videos
          </Button>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: 2 }}>
            <IconButton color="inherit">
              <AccountCircle />
            </IconButton>
            <Typography variant="subtitle1" component="div">
              {username}
            </Typography>
          </Box>
          <Button color="inherit" onClick={signOut} startIcon={<LogoutIcon />}>
            Sign Out
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
