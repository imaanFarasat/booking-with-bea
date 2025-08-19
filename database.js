const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || (process.env.NODE_ENV === 'production' ? 'railway' : 'booking_with_bea_time'),
  charset: 'utf8mb4',
  timezone: '+00:00',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectTimeout: 60000,
  acquireTimeout: 60000,
  timeout: 60000
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
    // In Railway, the database already exists, so we just need to create tables
    if (process.env.NODE_ENV === 'production') {
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
