import React from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Chip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  ConfirmationNumber as TicketIcon,
  Add as AddIcon,
  Group as GroupIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';

interface SidebarProps {
  onMobileClose?: () => void;
}

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: string | number;
  roles?: string[];
}

export const Sidebar: React.FC<SidebarProps> = ({ onMobileClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const navigationItems: NavigationItem[] = [
    {
      id: 'dashboard',
      label: 'Übersicht',
      icon: <DashboardIcon />,
      path: '/dashboard',
  },
    {
      id: 'tickets',
  label: 'Tickets',
      icon: <TicketIcon />,
      path: '/tickets',
    },
    {
      id: 'create-ticket',
    label: 'Ticket erstellen',
      icon: <AddIcon />,
      path: '/tickets/new',
    },
  ];

  const adminItems: NavigationItem[] = [
    {
      id: 'admin-users',
      label: 'Users',
    icon: <GroupIcon />,
      path: '/admin/users',
      roles: ['ADMIN'],
    },
    {
      id: 'settings',
      label: 'Einstellungen',
      icon: <SettingsIcon />,
      path: '/settings',
      roles: ['ADMIN'],
    },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
    onMobileClose?.();
  };

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  const canAccessItem = (item: NavigationItem) => {
    if (!item.roles) return true;
    return user && item.roles.includes(user.role);
  };

  const renderNavigationItem = (item: NavigationItem) => {
    if (!canAccessItem(item)) return null;

    const active = isActive(item.path);

    return (
      <ListItem key={item.id} disablePadding>
        <ListItemButton
          onClick={() => handleNavigation(item.path)}
          selected={active}
          sx={{
            borderRadius: 1,
            mx: 1,
            mb: 0.5,
            '&.Mui-selected': {
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
              '& .MuiListItemIcon-root': {
                color: 'primary.contrastText',
              },
            },
            '&:hover': {
              backgroundColor: active ? 'primary.dark' : 'action.hover',
            },
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: 40,
              color: active ? 'inherit' : 'text.secondary',
            }}
          >
            {item.icon}
          </ListItemIcon>
          <ListItemText
            primary={item.label}
            primaryTypographyProps={{
              fontSize: '0.875rem',
              fontWeight: active ? 600 : 400,
            }}
          />
          {item.badge && (
            <Chip
              label={item.badge}
              size="small"
              color={active ? 'secondary' : 'default'}
              sx={{ ml: 1, height: 20, fontSize: '0.75rem' }}
            />
          )}
        </ListItemButton>
      </ListItem>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo/Brand */}
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            color: 'primary.main',
            fontSize: '1.125rem',
          }}
        >
          IT Support
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            display: 'block',
            mt: 0.5,
          }}
        >
            Ticketsystem
        </Typography>
      </Box>

      <Divider />

      {/* Main Navigation */}
      <Box sx={{ flex: 1, py: 1 }}>
        <List disablePadding>
          {navigationItems.map(renderNavigationItem)}
        </List>

        {/* Admin Section (visible to ADMIN only) */}
        {user && user.role === 'ADMIN' && (
          <>
            <Divider sx={{ my: 2, mx: 2 }} />
            <Typography
              variant="overline"
              sx={{
                px: 2,
                color: 'text.secondary',
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: 1,
              }}
            >
              Administration
              </Typography>
            <List disablePadding sx={{ mt: 1 }}>
              {adminItems.map(renderNavigationItem)}
            </List>
          </>
        )}
      </Box>
      {/* User Info removed (header already shows identity at top-right) */}
    </Box>
  );
};