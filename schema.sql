-- Book with Bea - Database Schema for Railway MySQL
-- This file contains the complete database schema for the booking system

-- Create database (Railway will handle this automatically)
-- CREATE DATABASE IF NOT EXISTS railway CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE railway;

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  favorite_services JSON DEFAULT (JSON_ARRAY()),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR(50) PRIMARY KEY,
  customer_id INT NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20),
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  services_data JSON DEFAULT (JSON_ARRAY()),
  total_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_duration INT NOT NULL DEFAULT 30,
  is_multiple_services BOOLEAN DEFAULT FALSE,
  target_audience VARCHAR(100) DEFAULT 'General',
  booking_type VARCHAR(50) DEFAULT 'single',
  status ENUM('confirmed', 'cancelled', 'completed') DEFAULT 'confirmed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  INDEX idx_booking_date (booking_date),
  INDEX idx_booking_time (booking_time),
  INDEX idx_customer_email (customer_email),
  INDEX idx_status (status),
  UNIQUE KEY unique_booking_slot (booking_date, booking_time)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Time slots table for availability management
CREATE TABLE IF NOT EXISTS time_slots (
  id INT PRIMARY KEY AUTO_INCREMENT,
  slot_date DATE NOT NULL,
  slot_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  booking_id VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
  UNIQUE KEY unique_slot (slot_date, slot_time),
  INDEX idx_slot_date (slot_date),
  INDEX idx_available (is_available)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Individual service bookings (for multiple services spread across different times)
CREATE TABLE IF NOT EXISTS individual_service_bookings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  main_booking_id VARCHAR(50) NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  service_price DECIMAL(10,2) NOT NULL,
  service_duration INT NOT NULL DEFAULT 30,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  service_order INT DEFAULT 1,
  status ENUM('confirmed', 'cancelled', 'completed') DEFAULT 'confirmed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (main_booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  INDEX idx_main_booking (main_booking_id),
  INDEX idx_service_date_time (booking_date, booking_time)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Blocked dates table (for holidays, closures, etc.)
CREATE TABLE IF NOT EXISTS blocked_dates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  blocked_date DATE NOT NULL UNIQUE,
  reason VARCHAR(255) DEFAULT 'Holiday/Closed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_blocked_date (blocked_date)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create a view for easy booking overview
CREATE OR REPLACE VIEW booking_overview AS
SELECT 
  b.id,
  b.customer_id,
  b.customer_email,
  b.customer_name,
  b.customer_phone,
  b.booking_date,
  b.booking_time,
  b.service_name,
  b.services_data,
  b.total_price,
  b.total_duration,
  b.is_multiple_services,
  b.target_audience,
  b.booking_type,
  b.status,
  b.created_at,
  b.updated_at,
  c.name as customer_full_name,
  c.email as customer_contact_email,
  c.phone as customer_contact_phone
FROM bookings b
LEFT JOIN customers c ON b.customer_id = c.id;

-- Stored procedure to generate time slots
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS GenerateTimeSlots(
  IN start_date DATE,
  IN end_date DATE
)
BEGIN
  DECLARE current_date DATE DEFAULT start_date;
  DECLARE current_time TIME;
  DECLARE done INT DEFAULT FALSE;
  
  -- Business hours: 9:00 AM to 6:00 PM, 30-minute slots
  DECLARE time_cursor CURSOR FOR 
    SELECT TIME(CONCAT(hour, ':', minute, ':00')) as slot_time
    FROM (
      SELECT 9 + (n DIV 2) as hour, (n % 2) * 30 as minute
      FROM (
        SELECT 0 as n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION 
        SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION 
        SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION 
        SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15 UNION 
        SELECT 16 UNION SELECT 17
      ) numbers
    ) times
    WHERE (9 + (n DIV 2)) < 18; -- End at 6:00 PM
  
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
  
  -- Loop through each date
  WHILE current_date <= end_date DO
    -- Skip Sundays (DAYOFWEEK returns 1 for Sunday)
    IF DAYOFWEEK(current_date) != 1 THEN
      -- Generate time slots for this date
      OPEN time_cursor;
      
      time_loop: LOOP
        FETCH time_cursor INTO current_time;
        IF done THEN
          LEAVE time_loop;
        END IF;
        
        -- Insert time slot if it doesn't exist
        INSERT IGNORE INTO time_slots (slot_date, slot_time, is_available)
        VALUES (current_date, current_time, TRUE);
        
      END LOOP;
      
      CLOSE time_cursor;
      SET done = FALSE;
    END IF;
    
    -- Move to next date
    SET current_date = DATE_ADD(current_date, INTERVAL 1 DAY);
  END WHILE;
END //
DELIMITER ;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bookings_datetime ON bookings(booking_date, booking_time);
CREATE INDEX IF NOT EXISTS idx_timeslots_datetime ON time_slots(slot_date, slot_time);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

-- Insert some initial blocked dates (you can modify these)
-- INSERT IGNORE INTO blocked_dates (blocked_date, reason) VALUES 
-- ('2024-12-25', 'Christmas Day'),
-- ('2024-01-01', 'New Year Day');
