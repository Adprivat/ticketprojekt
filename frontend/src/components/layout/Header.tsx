import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Avatar,
  Divider,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  AccountCircle as AccountCircleIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { NotificationDropdown } from '../notifications/NotificationDropdown';

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { unreadCount, notifications, markAllAsRead, markAsRead } = useNotifications();
  const hasUnread = unreadCount > 0;
  const [notifyHighlight, setNotifyHighlight] = useState(false);

  // Activate highlight when new unread notifications appear
  React.useEffect(() => {
    if (hasUnread) {
      setNotifyHighlight(true);
    }
  }, [hasUnread, unreadCount]);
  
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notificationAnchorEl, setNotificationAnchorEl] = useState<null | HTMLElement>(null);

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationAnchorEl(event.currentTarget);
    // User opened notifications – remove highlight until something new arrives
    setNotifyHighlight(false);
  };

  const handleNotificationMenuClose = () => {
    setNotificationAnchorEl(null);
  };

  const handleSettingsClick = () => {
    navigate('/settings');
    handleProfileMenuClose();
  };

  const handleLogout = async () => {
    await logout();
    handleProfileMenuClose();
  };

  const getUserInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getUserDisplayName = () => {
    if (!user) return 'User';
    return `${user.firstName} ${user.lastName}`;
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      {/* App Title */}
      <Typography
        variant="h6"
        component="div"
        sx={{ 
          flexGrow: 1,
          fontWeight: 600,
          color: 'inherit',
        }}
      >
        IT-Ticketsystem
      </Typography>

      {/* Right side actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* Notifications */}
        <Tooltip title="Benachrichtigungen">
          <IconButton
            color="inherit"
            onClick={handleNotificationMenuOpen}
            aria-label={hasUnread ? `${unreadCount} ungelesene Benachrichtigungen` : 'Benachrichtigungen'}
            sx={{
              position: 'relative',
              ...(notifyHighlight && {
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 0 0 rgba(211,47,47,0.4)',
                  animation: 'notifRing 1.8s ease-out infinite',
                },
              }),
              '@keyframes notifRing': {
                '0%': { boxShadow: '0 0 0 0 rgba(211,47,47,0.55)' },
                '70%': { boxShadow: '0 0 0 14px rgba(211,47,47,0)' },
                '100%': { boxShadow: '0 0 0 0 rgba(211,47,47,0)' },
              },
            }}
          >
            <Badge
              color="error"
              overlap="circular"
              badgeContent={hasUnread ? unreadCount : null}
              invisible={!hasUnread}
              sx={{
                '& .MuiBadge-badge': {
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  minWidth: 20,
                  height: 20,
                },
              }}
            >
              <NotificationsIcon />
            </Badge>
            {hasUnread && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  backgroundColor: 'error.main',
                  color: 'error.contrastText',
                  borderRadius: '6px',
                  px: 0.4,
                  fontSize: '0.55rem',
                  fontWeight: 700,
                  lineHeight: 1.2,
                  boxShadow: 1,
                }}
              >
                !
              </Box>
            )}
          </IconButton>
        </Tooltip>

        {/* User Profile */}
                <Tooltip title="Konto">
          <IconButton
            color="inherit"
            onClick={handleProfileMenuOpen}
            aria-label="account menu"
          >
            {user ? (
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: 'secondary.main',
                  fontSize: '0.875rem',
                }}
              >
                {getUserInitials(user.firstName, user.lastName)}
              </Avatar>
            ) : (
              <AccountCircleIcon />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Notification Dropdown */}
      <NotificationDropdown
        anchorEl={notificationAnchorEl}
        open={Boolean(notificationAnchorEl)}
        onClose={handleNotificationMenuClose}
        notifications={notifications}
        unreadCount={unreadCount}
        markAllAsRead={markAllAsRead}
        markAsRead={markAsRead}
        onNavigateTicket={(ticketId) => navigate(`/tickets/${ticketId}`)}
      />

      {/* Profile Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        onClick={handleProfileMenuClose}
        PaperProps={{
          elevation: 3,
          sx: {
            mt: 1.5,
            minWidth: 200,
            '& .MuiMenuItem-root': {
              px: 2,
              py: 1,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {/* User Info */}
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {getUserDisplayName()}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {user?.email}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {user?.role}
          </Typography>
        </Box>
        
        <Divider />

        {/* Menu Items */}
  <MenuItem onClick={handleSettingsClick}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Einstellungen</ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Abmelden</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};