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

interface NotificationDropdownProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  anchorEl,
  open,
  onClose,
}) => {
  // Mock notifications - will be replaced with real data in Task 10.1
  const notifications = [
    {
      id: '1',
      title: 'New ticket assigned',
      message: 'Ticket #123 has been assigned to you',
      timestamp: '5 minutes ago',
      read: false,
    },
    {
      id: '2',
      title: 'Ticket status updated',
      message: 'Ticket #122 has been closed',
      timestamp: '1 hour ago',
      read: true,
    },
  ];

  const unreadCount = notifications.filter(n => !n.read).length;

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
            Notifications
          </Typography>
          {unreadCount > 0 && (
            <Chip
              label={`${unreadCount} new`}
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
                        {notification.timestamp}
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
            No notifications yet
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
              onClick={onClose}
            >
              Mark all as read
            </Button>
          </Box>
        </>
      )}
    </Menu>
  );
};