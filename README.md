# 💅 Book with Bea - Nail Booking System

A professional booking system for nail services with MySQL database, email notifications, and Google Sheets integration.

## 🌟 Features

- **Professional Booking Interface**: Clean, modern UI for customers
- **MySQL Database**: Reliable data storage with proper relationships
- **Email Notifications**: Automatic booking confirmations
- **Time Slot Management**: Intelligent availability tracking
- **Multiple Services Support**: Book single or multiple services
- **Google Sheets Integration**: Optional data export to spreadsheets
- **Railway Deployment Ready**: Configured for easy cloud deployment
- **Custom Domain Support**: Professional branding with your domain

## 🚀 Quick Start

### Option 1: Railway Deployment (Recommended)

1. **Fork this repository** to your GitHub account
2. **Sign up for Railway** at [railway.app](https://railway.app)
3. **Follow the complete guide** in [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

### Option 2: Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/book-with-bea.git
cd book-with-bea

# Run setup script
npm run setup

# Install dependencies
npm install

# Configure environment variables
# Edit .env file with your settings

# Set up MySQL database
# Import schema.sql into your MySQL database

# Start development server
npm run dev
```

## 📁 Project Structure

```
book-with-bea/
├── book-with-bea/          # Frontend files
│   ├── index.html          # Main booking interface
│   ├── script.js           # Frontend JavaScript
│   ├── styles.css          # Styling
│   └── nail_services.json  # Service definitions
├── server-mysql.js         # Main server file
├── database.js             # Database operations
├── schema.sql              # Database schema
├── railway.json            # Railway deployment config
├── env.template            # Environment variables template
├── setup.js                # Setup helper script
└── DEPLOYMENT_GUIDE.md     # Complete deployment guide
```

## 🔧 Configuration

### Required Environment Variables

```env
# Database Configuration
DB_HOST=your-mysql-host
DB_USER=root
DB_PASSWORD=your-password
DB_NAME=railway
DB_PORT=3306

# Email Configuration
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-gmail-app-password
ADMIN_EMAIL=admin@yourdomain.com

# Server Configuration
PORT=3000
NODE_ENV=production
```

### Optional Configuration

```env
# Google Sheets Integration
GOOGLE_SHEET_ID=your-sheet-id
```

## 🗄️ Database Schema

The system uses MySQL with the following main tables:
- `customers` - Customer information and preferences
- `bookings` - Main booking records
- `time_slots` - Available time slot management
- `individual_service_bookings` - Multiple service bookings
- `blocked_dates` - Holiday/closure management

Run `schema.sql` to create all required tables and procedures.

## 📧 Email Setup

The system sends booking confirmations via email. For Gmail:

1. Enable 2-Factor Authentication
2. Generate an App Password
3. Use the App Password (not your regular password) in `EMAIL_PASS`

## 🌐 Railway Deployment

This project is optimized for Railway deployment:

1. **Automatic Detection**: Railway automatically detects Node.js projects
2. **MySQL Integration**: Easy database service addition
3. **Environment Variables**: Secure configuration management
4. **Custom Domains**: Professional branding support
5. **SSL Certificates**: Automatic HTTPS setup

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions.

## 🎨 Customization

### Services Configuration
Edit `book-with-bea/nail_services.json` to modify:
- Service names and descriptions
- Pricing and duration
- Service categories

### Styling
Modify `book-with-bea/styles.css` for:
- Color schemes
- Layout adjustments
- Responsive design tweaks

### Business Hours
Update `schema.sql` or modify the `GenerateTimeSlots` procedure to change:
- Operating hours
- Time slot intervals
- Blocked days

## 📊 API Endpoints

- `GET /` - Main booking interface
- `GET /api/services` - Available services
- `GET /api/slots/:date` - Available time slots for date
- `POST /api/bookings` - Create new booking
- `GET /api/bookings` - List all bookings (admin)
- `GET /api/bookings/:date` - Bookings for specific date
- `DELETE /api/bookings/:id` - Cancel booking

## 🔍 Troubleshooting

### Common Issues

**Database Connection:**
- Verify environment variables
- Check MySQL service status
- Ensure proper SSL configuration for Railway

**Email Not Working:**
- Verify Gmail App Password
- Check 2FA is enabled
- Confirm email addresses are valid

**Deployment Issues:**
- Check Railway logs
- Verify all environment variables are set
- Ensure database schema is imported

## 🛡️ Security

- Environment variables for sensitive data
- SSL/TLS encryption in production
- Input validation and sanitization
- SQL injection prevention
- CORS configuration

## 📈 Scaling

The system is designed to scale with your business:
- **Database**: Railway MySQL can be upgraded
- **Application**: Horizontal scaling supported
- **CDN**: Static assets can be served via CDN
- **Caching**: Redis integration ready

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Railway Issues**: [Railway Discord](https://discord.gg/railway)
- **General Support**: Create an issue in this repository
- **Deployment Help**: See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

## 🎯 Roadmap

- [ ] SMS notifications
- [ ] Payment processing integration
- [ ] Customer dashboard
- [ ] Advanced reporting
- [ ] Mobile app
- [ ] Multi-location support

---

## 🚀 Deploy Now

Ready to go live? 

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template/your-template-id)

Follow the [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for complete setup instructions.

**Your professional booking system awaits! 💅✨**
