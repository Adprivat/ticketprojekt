-- Create database script for ticket system
-- Run this manually in your MySQL client if automatic creation fails

CREATE DATABASE IF NOT EXISTS `ticket_system` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- Grant privileges (adjust username as needed)
-- GRANT ALL PRIVILEGES ON ticket_system.* TO 'root'@'localhost';
-- FLUSH PRIVILEGES;

-- Show databases to verify creation
SHOW DATABASES LIKE 'ticket_system';