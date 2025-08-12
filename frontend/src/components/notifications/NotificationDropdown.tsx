import React from 'react';
import {
  Menu,
  Typography,
  Box,
  Divider,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  MarkEmailRead as MarkReadIcon,
} from '@mui/icons-material';

import { AppNotification } from '../../hooks/useNotifications';

interface NotificationDropdownProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  onNavigateTicket?: (ticketId: string) => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  anchorEl,
  open,
  onClose,
  notifications,
  unreadCount,
  markAsRead,
  markAllAsRead,
  onNavigateTicket,
}) => {

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      PaperProps={{
        elevation: 3,
        sx: {
          mt: 1.5,
          minWidth: 320,
          maxWidth: 400,
          maxHeight: 400,
        },
      }}
      transformOrigin={{ horizontal: 'right', vertical: 'top' }}
      anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
    >
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Benachrichtigungen
          </Typography>
          {unreadCount > 0 && (
            <Chip
              label={`${unreadCount} neu`}
              size="small"
              color="primary"
              variant="filled"
            />
          )}
        </Box>
      </Box>

      {/* Notifications List */}
      {notifications.length > 0 ? (
        <List disablePadding sx={{ maxHeight: 300, overflow: 'auto' }}>
          {notifications.map((notification, index) => (
            <React.Fragment key={notification.id}>
              <ListItem
                sx={{
                  alignItems: 'flex-start',
                  backgroundColor: notification.read ? 'transparent' : 'action.hover',
                  '&:hover': {
                    backgroundColor: 'action.selected',
                  },
                }}
                onClick={() => {
                  if (!notification.read) markAsRead(notification.id);
                  if (notification.ticketId && onNavigateTicket) {
                    onNavigateTicket(notification.ticketId);
                    onClose();
                  }
                }}
              >
                <ListItemIcon sx={{ mt: 0.5 }}>
                  <NotificationsIcon
                    fontSize="small"
                    color={notification.read ? 'disabled' : 'primary'}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={notification.title}
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {notification.message}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        {new Date(notification.timestamp).toLocaleString()}
                      </Typography>
                    </Box>
                  }
                  primaryTypographyProps={{
                    fontWeight: notification.read ? 400 : 600,
                    fontSize: '0.875rem',
                  }}
                />
              </ListItem>
              {index < notifications.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      ) : (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <NotificationsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            Noch keine Benachrichtigungen
          </Typography>
        </Box>
      )}

      {/* Footer */}
  {notifications.length > 0 && (
        <>
          <Divider />
          <Box sx={{ p: 1 }}>
            <Button
              fullWidth
              size="small"
              startIcon={<MarkReadIcon />}
      onClick={() => { markAllAsRead(); onClose(); }}
            >
              Alle als gelesen markieren
            </Button>
          </Box>
        </>
      )}
    </Menu>
  );
};