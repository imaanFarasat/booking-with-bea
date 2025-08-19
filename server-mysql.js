require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

// Import database operations
const {
  pool,
  testConnection,
  initializeDatabase,
  customerOperations,
  bookingOperations,
  timeSlotOperations
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('book-with-bea'));

// Load services data
const servicesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'book-with-bea', 'nail_services.json'), 'utf8'));

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Google Sheets configuration
let sheets = null;
let SPREADSHEET_ID = null;

// Initialize Google Sheets if configured
async function initializeGoogleSheets() {
  try {
    // Extract spreadsheet ID from URL if needed
    const sheetUrl = process.env.GOOGLE_SHEET_ID;
    if (sheetUrl) {
      if (sheetUrl.includes('docs.google.com/spreadsheets')) {
        // Extract ID from URL
        const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        SPREADSHEET_ID = match ? match[1] : sheetUrl;
      } else {
        SPREADSHEET_ID = sheetUrl;
      }
    }

    if (!SPREADSHEET_ID) {
      console.log('ℹ️  Google Sheets not configured - skipping sheets integration');
      return false;
    }

    // Check for credentials file
    const credentialsPath = path.join(__dirname, 'credentials.json');
    if (!fs.existsSync(credentialsPath)) {
      console.log('ℹ️  Google Sheets credentials not found - skipping sheets integration');
      return false;
    }

    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    sheets = google.sheets({ version: 'v4', auth });
    
    // Test connection and create sheets if needed
    await createSheetsIfNeeded();
    console.log('✅ Google Sheets integration initialized successfully');
    return true;

  } catch (error) {
    console.error('❌ Error initializing Google Sheets:', error.message);
    sheets = null;
    return false;
  }
}

// Create required sheets if they don't exist
async function createSheetsIfNeeded() {
  if (!sheets || !SPREADSHEET_ID) return;

  try {
    const sheetsList = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const existingSheets = sheetsList.data.sheets.map(sheet => sheet.properties.title);
    
    const requiredSheets = [
      { name: 'Bookings', headers: ['ID', 'Customer Email', 'Customer Name', 'Customer Phone', 'Date', 'Time', 'Service Name', 'Services', 'Total Price', 'Duration', 'Created At'] },
      { name: 'Customers', headers: ['Email', 'Name', 'Phone', 'First Visit', 'Last Visit', 'Total Bookings', 'Total Spent'] }
    ];

    for (const sheet of requiredSheets) {
      if (!existingSheets.includes(sheet.name)) {
        // Create sheet
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            requests: [{
              addSheet: {
                properties: { title: sheet.name }
              }
            }]
          }
        });

        // Add headers
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheet.name}!A1`,
          valueInputOption: 'RAW',
          resource: { values: [sheet.headers] }
        });

        console.log(`✅ Created Google Sheet: ${sheet.name}`);
      }
    }
  } catch (error) {
    console.error('❌ Error creating sheets:', error.message);
  }
}

// Save booking to Google Sheets
async function saveBookingToSheets(booking) {
  if (!sheets || !SPREADSHEET_ID) return;

  try {
    const values = [[
      booking.id,
      booking.customer_email,
      booking.customer_name,
      booking.customer_phone,
      booking.booking_date,
      formatTime(booking.booking_time),
      booking.service_name,
      booking.services_data ? (typeof booking.services_data === 'string' ? booking.services_data : JSON.stringify(booking.services_data)) : '',
      booking.total_price,
      `${booking.total_duration} min`,
      new Date().toISOString()
    ]];
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Bookings!A:K',
      valueInputOption: 'RAW',
      resource: { values }
    });
    
    console.log('✅ Booking saved to Google Sheets');
  } catch (error) {
    console.error('❌ Error saving booking to Google Sheets:', error.message);
  }
}

// Debug: Check if environment variables are loaded
console.log('🔧 Environment check:');
console.log('PORT:', process.env.PORT || 3000);
console.log('DB_HOST:', process.env.DB_HOST || 'localhost');
console.log('DB_PORT:', process.env.DB_PORT || 3306);
console.log('DB_NAME:', process.env.DB_NAME || 'booking_with_bea_time');
console.log('EMAIL_USER:', process.env.EMAIL_USER ? '✅ Set' : '❌ Not set');

// Helper function to convert 24-hour time to 12-hour format
function formatTime(timeString) {
  const [hours, minutes] = timeString.split(':');
  const hour24 = parseInt(hours);
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  return `${hour12}:${minutes} ${ampm}`;
}

// Helper function to convert 12-hour time to 24-hour format
function parseTime(timeString) {
  const match = timeString.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return timeString; // Return as-is if not in expected format
  
  let [, hours, minutes, ampm] = match;
  hours = parseInt(hours);
  
  if (ampm.toUpperCase() === 'PM' && hours !== 12) {
    hours += 12;
  } else if (ampm.toUpperCase() === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes}:00`;
}

// Send booking confirmation emails
async function sendBookingEmails(booking) {
  const servicesList = booking.is_multiple_services && booking.services_data 
    ? (typeof booking.services_data === 'string' ? JSON.parse(booking.services_data) : booking.services_data).map(s => `${s.name} ($${s.price})`).join(', ')
    : booking.service_name;

  const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #ff6b35 0%, #e74c3c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">💅 New Booking Confirmation</h1>
        <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Book with Bea - Nail Services</p>
      </div>
      
      <div style="background: white; padding: 30px; border: 1px solid #e0e0e0;">
        <h2 style="color: #2c3e50; margin-top: 0;">👤 Customer Details</h2>
        <ul style="list-style: none; padding: 0;">
          <li style="margin: 10px 0;"><strong>Name:</strong> ${booking.customer_name}</li>
          <li style="margin: 10px 0;"><strong>Email:</strong> ${booking.customer_email}</li>
          <li style="margin: 10px 0;"><strong>Phone:</strong> ${booking.customer_phone}</li>
        </ul>
        
        <h2 style="color: #2c3e50;">📅 Appointment Details</h2>
        <ul style="list-style: none; padding: 0;">
          <li style="margin: 10px 0;"><strong>Date:</strong> ${new Date(booking.booking_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</li>
          <li style="margin: 10px 0;"><strong>Time:</strong> ${formatTime(booking.booking_time)}</li>
          <li style="margin: 10px 0;"><strong>Service(s):</strong> ${servicesList}</li>
          <li style="margin: 10px 0;"><strong>Total Price:</strong> <span style="color: #ff6b35; font-size: 18px; font-weight: bold;">$${booking.total_price}</span></li>
          <li style="margin: 10px 0;"><strong>Duration:</strong> ${booking.total_duration} minutes</li>
        </ul>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-weight: bold; color: #2c3e50;">📍 Location:</p>
          <p style="margin: 5px 0 0 0; color: #666;">Martina's Nail Place<br>44 Gerard Street, Downtown Toronto</p>
        </div>
        
        <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; border-left: 4px solid #27ae60;">
          <p style="margin: 0; color: #27ae60; font-weight: bold;">🆔 Booking ID: ${booking.id}</p>
        </div>
      </div>
      
      <div style="background: #2c3e50; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
        <p style="color: white; margin: 0;">Please confirm this booking and prepare for the appointment.</p>
      </div>
    </div>
  `;

  const emailOptions = {
    from: process.env.EMAIL_USER || 'your-email@gmail.com',
    to: [process.env.ADMIN_EMAIL || 'admin@bookwithbea.com'],
    subject: `💅 New Booking - ${booking.customer_name} - ${new Date(booking.booking_date).toLocaleDateString()} at ${formatTime(booking.booking_time)}`,
    html: emailContent
  };

  try {
    await transporter.sendMail(emailOptions);
    console.log('✅ Booking notification emails sent successfully');
  } catch (error) {
    console.error('❌ Error sending booking emails:', error);
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'book-with-bea', 'index.html'));
});



// Get all services
app.get('/api/services', (req, res) => {
  res.json(servicesData);
});



// Get available time slots for a date
app.get('/api/slots/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }
    
    const availableSlots = await bookingOperations.getAvailableSlots(date);
    res.json({ availableSlots });
    
  } catch (error) {
    console.error('Error fetching available slots:', error);
    res.status(500).json({ error: 'Failed to fetch available time slots' });
  }
});

// Create a booking
app.post('/api/bookings', async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      date,
      time,
      serviceName,
      price,
      duration,
      targetAudience,
      multipleServices,
      services,
      bookingType,
      individualServices
    } = req.body;

    // Validate required fields
    if (!customerName || !customerEmail || !customerPhone || !date || !time || !serviceName) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    // Convert time format if needed (from "2:00 PM" to "14:00:00")
    const formattedTime = parseTime(time);

    // Check if slot is still available
    const isAvailable = await bookingOperations.isSlotAvailable(date, formattedTime);
    if (!isAvailable) {
      return res.status(409).json({ error: 'This time slot is no longer available' });
    }

    // Calculate total duration if multiple services
    let totalDuration = duration || 30;
    if (multipleServices && services && services.length > 0) {
      totalDuration = services.reduce((sum, service) => sum + parseInt(service.duration || 30), 0);
    }

    // Prepare booking data
    const bookingData = {
      customerName,
      customerEmail,
      customerPhone,
      date,
      time: formattedTime,
      serviceName,
      price,
      duration: totalDuration,
      targetAudience,
      multipleServices: multipleServices || false,
      services: services || [],
      bookingType: bookingType || 'single',
      individualServices: individualServices || []
    };

    // Create booking
    const booking = await bookingOperations.create(bookingData);

    // Save to Google Sheets
    await saveBookingToSheets(booking);

    // Send notification emails
    await sendBookingEmails(booking);

    res.status(201).json({
      success: true,
      booking: {
        id: booking.id,
        customerName: booking.customer_name,
        customerEmail: booking.customer_email,
        customerPhone: booking.customer_phone,
        date: booking.booking_date,
        time: formatTime(booking.booking_time),
        serviceName: booking.service_name,
        price: booking.total_price,
        duration: `${booking.total_duration} min`,
        multipleServices: booking.is_multiple_services,
        services: booking.services_data ? (typeof booking.services_data === 'string' ? JSON.parse(booking.services_data) : booking.services_data) : []
      },
      message: 'Booking confirmed successfully!'
    });

  } catch (error) {
    console.error('❌ Error creating booking:', error);
    
    if (error.message === 'Time slot is no longer available') {
      return res.status(409).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all bookings (admin endpoint)
app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await bookingOperations.getAll();
    
    // Format bookings for frontend
    const formattedBookings = bookings.map(booking => ({
      id: booking.id,
      customerName: booking.customer_name,
      customerEmail: booking.customer_email,
      customerPhone: booking.customer_phone,
      date: booking.booking_date,
      time: formatTime(booking.booking_time),
      serviceName: booking.service_name,
      price: booking.total_price,
      duration: `${booking.total_duration} min`,
      status: booking.status,
      createdAt: booking.created_at,
      multipleServices: booking.is_multiple_services,
      services: booking.services_data ? (typeof booking.services_data === 'string' ? JSON.parse(booking.services_data) : booking.services_data) : []
    }));
    
    res.json(formattedBookings);
  } catch (error) {
    console.error('❌ Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Get bookings for a specific date
app.get('/api/bookings/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const bookings = await bookingOperations.getByDate(date);
    
    const formattedBookings = bookings.map(booking => ({
      id: booking.id,
      customerName: booking.customer_name,
      customerEmail: booking.customer_email,
      customerPhone: booking.customer_phone,
      date: booking.booking_date,
      time: formatTime(booking.booking_time),
      serviceName: booking.service_name,
      price: booking.total_price,
      duration: `${booking.total_duration} min`,
      status: booking.status,
      multipleServices: booking.is_multiple_services,
      services: booking.services_data ? (typeof booking.services_data === 'string' ? JSON.parse(booking.services_data) : booking.services_data) : []
    }));
    
    res.json(formattedBookings);
  } catch (error) {
    console.error('❌ Error fetching bookings for date:', error);
    res.status(500).json({ error: 'Failed to fetch bookings for the specified date' });
  }
});

// Get customer by email
app.get('/api/customers/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const customer = await customerOperations.getWithStats(email);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const customerResponse = {
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      totalBookings: customer.booking_count || 0,
      totalSpent: customer.total_spent_calc || 0,
      favoriteServices: customer.favorite_services ? JSON.parse(customer.favorite_services) : [],
      firstVisit: customer.first_visit,
      lastVisit: customer.last_visit
    };
    
    res.json({ customer: customerResponse });
  } catch (error) {
    console.error('❌ Error fetching customer:', error);
    res.status(500).json({ error: 'Failed to fetch customer information' });
  }
});

// Cancel a booking
app.delete('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await bookingOperations.cancel(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    res.json({ success: true, message: 'Booking cancelled successfully' });
  } catch (error) {
    console.error('❌ Error cancelling booking:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});



// Initialize database and start server
async function startServer() {
  try {
    console.log('🚀 Starting Book with Bea server...');
    
    // Initialize database
    console.log('📊 Initializing database...');
    await initializeDatabase();
    
    // Initialize Google Sheets integration
    console.log('📊 Initializing Google Sheets integration...');
    await initializeGoogleSheets();
    
    // Test database connection
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Failed to connect to database');
    }
    
    // Generate time slots for next 90 days if needed
    console.log('⏰ Ensuring time slots are available...');
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 90);
    const endDate = futureDate.toISOString().split('T')[0];
    
    try {
      await timeSlotOperations.generateSlots(today, endDate);
      console.log('✅ Time slots generated for next 90 days');
    } catch (error) {
      console.log('ℹ️  Time slots already exist or error generating:', error.message);
    }
    
    app.listen(PORT, () => {
      console.log('🎉 Server started successfully!');
      console.log(`🌐 Server running on port ${PORT}`);
      console.log(`📱 Visit http://localhost:${PORT} to access the booking system`);

      console.log('💾 Using MySQL database for reliable booking management');
    });
    
  } catch (error) {
    console.error('❌ Error starting server:', error);
    console.error('💡 Make sure MySQL is running and database credentials are correct');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  try {
    await pool.end();
    console.log('✅ Database connections closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

startServer();
