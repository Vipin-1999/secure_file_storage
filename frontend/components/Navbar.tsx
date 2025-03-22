// /components/Navbar.tsx
import React, { useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
} from "@mui/material";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";

interface NavbarProps {
  sessionCountdown: number;
  onThemeToggle: () => void;
  darkMode: boolean;
  onLogout: () => void;
  userDisplayName?: string;
  userPhotoURL?: string;
}

const Navbar: React.FC<NavbarProps> = ({
  sessionCountdown,
  onThemeToggle,
  darkMode,
  onLogout,
  userDisplayName,
  userPhotoURL,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  // Format countdown as mm:ss
  const minutes = Math.floor(sessionCountdown / 60);
  const seconds = sessionCountdown % 60;
  const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;

  const handleAvatarClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    onLogout();
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Secure File Storage
        </Typography>
        <Typography variant="body1" sx={{ marginRight: 2 }}>
          Session: {formattedTime}
        </Typography>
        <IconButton color="inherit" onClick={onThemeToggle}>
          {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
        </IconButton>
        {userDisplayName && (
          <>
            <IconButton onClick={handleAvatarClick} color="inherit">
              <Avatar src={userPhotoURL} alt={userDisplayName} />
            </IconButton>
            <Menu anchorEl={anchorEl} open={open} onClose={handleMenuClose}>
              <MenuItem onClick={handleLogout}>Logout</MenuItem>
            </Menu>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
