const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.NODE_ENV === 'production' ? 44633 : (process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || (process.env.NODE_ENV === 'production' ? 'railway' : 'booking_with_bea_time'),
  charset: 'utf8mb4',
  timezone: '+00:00',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectTimeout: 60000
};

// Create connection pool
const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL database connected successfully');
    console.log(`📊 Connected to database: ${dbConfig.database}`);
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Initialize database (create tables if they don't exist)
async function initializeDatabase() {
  try {
    // In Railway, create tables if they don't exist
    if (process.env.NODE_ENV === 'production') {
      await createTablesIfNeeded();
      console.log('✅ Database initialization completed (Railway environment)');
      return true;
    }
    
    // For local development, check if database exists, create if not
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      ssl: dbConfig.ssl
    });
    
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.end();
    
    console.log('✅ Database initialization completed');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.log('ℹ️  If using Railway, make sure the MySQL service is connected');
    return false;
  }
}

// Create tables if they don't exist
async function createTablesIfNeeded() {
  try {
    // Create customers table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        favorite_services JSON DEFAULT (JSON_ARRAY()),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email)
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // Create bookings table
    await pool.execute(`
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
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // Create time_slots table
    await pool.execute(`
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
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // Create other tables
    await pool.execute(`
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
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS blocked_dates (
        id INT PRIMARY KEY AUTO_INCREMENT,
        blocked_date DATE NOT NULL UNIQUE,
        reason VARCHAR(255) DEFAULT 'Holiday/Closed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_blocked_date (blocked_date)
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    console.log('✅ Database tables created successfully');
    
    // Generate initial time slots for next 30 days
    await generateInitialTimeSlots();
  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
  }
}

// Generate time slots without stored procedure
async function generateInitialTimeSlots() {
  try {
    // Check if time slots already exist
    const [existing] = await pool.execute('SELECT COUNT(*) as count FROM time_slots WHERE slot_date >= CURDATE()');
    if (existing[0].count > 0) {
      console.log('ℹ️ Time slots already exist');
      return;
    }

    console.log('🕐 Generating time slots for next 30 days...');
    
    // Generate slots for next 30 days
    const today = new Date();
    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const date = new Date(today);
      date.setDate(today.getDate() + dayOffset);
      
      // Skip Sundays (day 0)
      if (date.getDay() === 0) continue;
      
      const dateStr = date.toISOString().split('T')[0];
      
      // Generate slots from 9:00 AM to 9:00 PM (30-minute intervals)
      for (let hour = 9; hour < 21; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
          
          try {
            await pool.execute(
              'INSERT IGNORE INTO time_slots (slot_date, slot_time, is_available) VALUES (?, ?, TRUE)',
              [dateStr, timeStr]
            );
          } catch (err) {
            // Ignore duplicate entries
          }
        }
      }
    }
    
    console.log('✅ Time slots generated successfully');
  } catch (error) {
    console.error('❌ Error generating time slots:', error.message);
  }
}

// Customer operations
const customerOperations = {
  // Find customer by email
  async findByEmail(email) {
    const [rows] = await pool.execute(
      'SELECT * FROM customers WHERE email = ?',
      [email]
    );
    return rows[0] || null;
  },

  // Create new customer
  async create(customerData) {
    const { name, email, phone } = customerData;
    const [result] = await pool.execute(
      'INSERT INTO customers (name, email, phone, favorite_services) VALUES (?, ?, ?, ?)',
      [name, email, phone, JSON.stringify([])]
    );
    return result.insertId;
  },

  // Update customer
  async update(customerId, updateData) {
    const fields = [];
    const values = [];
    
    Object.keys(updateData).forEach(key => {
      if (key === 'favorite_services') {
        fields.push(`${key} = ?`);
        values.push(JSON.stringify(updateData[key]));
      } else {
        fields.push(`${key} = ?`);
        values.push(updateData[key]);
      }
    });
    
    values.push(customerId);
    
    await pool.execute(
      `UPDATE customers SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  },

  // Get customer with stats
  async getWithStats(email) {
    const [rows] = await pool.execute(`
      SELECT 
        c.*,
        COUNT(b.id) as booking_count,
        COALESCE(SUM(b.total_price), 0) as total_spent_calc
      FROM customers c
      LEFT JOIN bookings b ON c.id = b.customer_id AND b.status = 'confirmed'
      WHERE c.email = ?
      GROUP BY c.id
    `, [email]);
    
    return rows[0] || null;
  }
};

// Booking operations
const bookingOperations = {
  // Check if slot is available
  async isSlotAvailable(date, time) {
    const [rows] = await pool.execute(
      'SELECT is_available FROM time_slots WHERE slot_date = ? AND slot_time = ?',
      [date, time]
    );
    return rows.length > 0 ? rows[0].is_available === 1 : false;
  },

  // Get available slots for a date
  async getAvailableSlots(date) {
    // Get current time in Toronto timezone
    const torontoTime = new Date().toLocaleString("en-US", {
      timeZone: "America/Toronto"
    });
    const torontoDate = new Date(torontoTime);
    
    // Get today's date in Toronto timezone
    const today = torontoDate.getFullYear() + '-' + 
                  String(torontoDate.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(torontoDate.getDate()).padStart(2, '0');
    
    // Get current time in Toronto timezone (HH:MM:SS format)
    const currentHour = torontoDate.getHours();
    const currentMinute = torontoDate.getMinutes();
    const currentTime = String(currentHour).padStart(2, '0') + ':' + 
                       String(currentMinute).padStart(2, '0') + ':00';
    
    console.log(`🕐 Toronto time: ${torontoTime}`);
    console.log(`🕐 Current Toronto time: ${currentTime}, Today: ${today}, Requested date: ${date}`);
    console.log(`🔍 Date comparison: requesting "${date}" vs today "${today}" - Match: ${date === today}`);
    
    let query = `
      SELECT slot_time 
      FROM time_slots 
      WHERE slot_date = ? AND is_available = TRUE
    `;
    
    const params = [date];
    
    // If requesting slots for today, filter out past times
    if (date === today) {
      query += ` AND slot_time > ?`;
      params.push(currentTime);
      console.log(`🔍 Filtering slots after ${currentTime} for today (${today}) - Toronto timezone`);
    }
    
    query += ` ORDER BY slot_time`;
    
    const [rows] = await pool.execute(query, params);
    
    console.log(`📅 Found ${rows.length} available slots for ${date}`);
    
    return rows.map(row => {
      const time = row.slot_time;
      // Convert TIME to readable format
      const [hours, minutes] = time.split(':');
      const hour24 = parseInt(hours);
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const ampm = hour24 >= 12 ? 'PM' : 'AM';
      return `${hour12}:${minutes} ${ampm}`;
    });
  },

  // Create booking
  async create(bookingData) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Find or create customer
      let customer = await customerOperations.findByEmail(bookingData.customerEmail);
      let customerId;

      if (!customer) {
        customerId = await customerOperations.create({
          name: bookingData.customerName,
          email: bookingData.customerEmail,
          phone: bookingData.customerPhone
        });
      } else {
        customerId = customer.id;
      }

      // Check slot availability one more time
      const isAvailable = await this.isSlotAvailable(bookingData.date, bookingData.time);
      if (!isAvailable) {
        throw new Error('Time slot is no longer available');
      }

      // Create main booking
      const bookingId = Date.now().toString();
      await connection.execute(`
        INSERT INTO bookings (
          id, customer_id, customer_email, customer_name, customer_phone,
          booking_date, booking_time, service_name, services_data, total_price,
          total_duration, is_multiple_services, target_audience, booking_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        bookingId,
        customerId,
        bookingData.customerEmail || '',
        bookingData.customerName || '',
        bookingData.customerPhone || '',
        bookingData.date || null,
        bookingData.time || null,
        bookingData.serviceName || '',
        JSON.stringify(bookingData.services || []),
        bookingData.price || 0,
        bookingData.duration || 30,
        bookingData.multipleServices || false,
        bookingData.targetAudience || 'General',
        bookingData.bookingType || 'single'
      ]);

      // Mark the time slot as unavailable
      await connection.execute(
        'UPDATE time_slots SET is_available = FALSE WHERE slot_date = ? AND slot_time = ?',
        [bookingData.date, bookingData.time]
      );

      // Handle individual service bookings if needed
      if (bookingData.individualServices && bookingData.individualServices.length > 0) {
        for (let i = 0; i < bookingData.individualServices.length; i++) {
          const service = bookingData.individualServices[i];
          await connection.execute(`
            INSERT INTO individual_service_bookings (
              main_booking_id, service_name, service_price, service_duration,
              booking_date, booking_time, service_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            bookingId,
            service.name,
            service.price,
            service.duration,
            service.date,
            service.time,
            i + 1
          ]);

          // Mark individual service time slot as unavailable
          await connection.execute(
            'UPDATE time_slots SET is_available = FALSE WHERE slot_date = ? AND slot_time = ?',
            [service.date, service.time]
          );
        }
      }

      await connection.commit();
      
      // Get the created booking with customer info
      const [bookingRows] = await pool.execute(`
        SELECT b.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
        FROM bookings b
        JOIN customers c ON b.customer_id = c.id
        WHERE b.id = ?
      `, [bookingId]);

      return bookingRows[0];

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // Get booking by ID
  async getById(bookingId) {
    const [rows] = await pool.execute(`
      SELECT b.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
      FROM bookings b
      JOIN customers c ON b.customer_id = c.id
      WHERE b.id = ?
    `, [bookingId]);
    
    return rows[0] || null;
  },

  // Get all bookings
  async getAll() {
    const [rows] = await pool.execute(`
      SELECT * FROM booking_overview
      ORDER BY booking_date DESC, booking_time DESC
    `);
    
    return rows;
  },

  // Get bookings for a specific date
  async getByDate(date) {
    const [rows] = await pool.execute(`
      SELECT * FROM booking_overview
      WHERE booking_date = ?
      ORDER BY booking_time
    `, [date]);
    
    return rows;
  },

  // Cancel booking
  async cancel(bookingId) {
    const [result] = await pool.execute(
      'UPDATE bookings SET status = "cancelled" WHERE id = ?',
      [bookingId]
    );
    
    return result.affectedRows > 0;
  },

  // Sync existing bookings with time slots table
  async syncBookingsWithTimeSlots() {
    console.log('🔄 Syncing existing bookings with time slots...');
    
    try {
      // First, reset all time slots to available
      await pool.execute('UPDATE time_slots SET is_available = TRUE');
      console.log('✅ Reset all time slots to available');
      
      // Get all existing bookings
      const [bookings] = await pool.execute(`
        SELECT DISTINCT booking_date, booking_time 
        FROM bookings 
        WHERE booking_date >= CURDATE()
      `);
      
      console.log(`📊 Found ${bookings.length} existing bookings to sync`);
      
      // Mark slots as unavailable for each booking
      for (const booking of bookings) {
        await pool.execute(
          'UPDATE time_slots SET is_available = FALSE WHERE slot_date = ? AND slot_time = ?',
          [booking.booking_date, booking.booking_time]
        );
        console.log(`🚫 Marked ${booking.booking_date} ${booking.booking_time} as unavailable`);
      }
      
      // Also handle individual service bookings
      const [individualBookings] = await pool.execute(`
        SELECT DISTINCT booking_date, booking_time 
        FROM individual_service_bookings 
        WHERE booking_date >= CURDATE()
      `);
      
      for (const booking of individualBookings) {
        await pool.execute(
          'UPDATE time_slots SET is_available = FALSE WHERE slot_date = ? AND slot_time = ?',
          [booking.booking_date, booking.booking_time]
        );
        console.log(`🚫 Marked individual service ${booking.booking_date} ${booking.booking_time} as unavailable`);
      }
      
      // Also mark blocked dates as unavailable
      const [blockedDates] = await pool.execute('SELECT blocked_date FROM blocked_dates');
      for (const blocked of blockedDates) {
        await pool.execute(
          'UPDATE time_slots SET is_available = FALSE WHERE slot_date = ?',
          [blocked.blocked_date]
        );
        console.log(`🚫 Marked blocked date ${blocked.blocked_date} as unavailable`);
      }
      
      console.log('✅ Time slots sync completed successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Error syncing bookings with time slots:', error);
      throw error;
    }
  }
};

// Time slot operations
const timeSlotOperations = {
  // Generate slots for date range
  async generateSlots(startDate, endDate) {
    await pool.execute(
      'CALL GenerateTimeSlots(?, ?)',
      [startDate, endDate]
    );
  },

  // Block a date
  async blockDate(date, reason = 'Holiday/Closed') {
    await pool.execute(
      'INSERT INTO blocked_dates (blocked_date, reason) VALUES (?, ?) ON DUPLICATE KEY UPDATE reason = VALUES(reason)',
      [date, reason]
    );
    
    // Mark all slots for this date as unavailable
    await pool.execute(
      'UPDATE time_slots SET is_available = FALSE WHERE slot_date = ?',
      [date]
    );
  },

  // Unblock a date
  async unblockDate(date) {
    await pool.execute('DELETE FROM blocked_dates WHERE blocked_date = ?', [date]);
    
    // Mark slots as available (except those with bookings)
    await pool.execute(`
      UPDATE time_slots 
      SET is_available = TRUE 
      WHERE slot_date = ? AND booking_id IS NULL
    `, [date]);
  }
};

// Export pool and operations
module.exports = {
  pool,
  testConnection,
  initializeDatabase,
  customerOperations,
  bookingOperations,
  timeSlotOperations
};
