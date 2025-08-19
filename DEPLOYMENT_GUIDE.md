# 🚀 Railway Deployment Guide - Book with Bea

This guide will walk you through deploying your Book with Bea booking system to Railway with MySQL and setting up a custom domain.

## 📋 Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **GitHub Account**: Your code should be in a GitHub repository
3. **Gmail Account**: For email notifications (or any SMTP provider)
4. **Custom Domain** (optional): If you want to use your own domain

## 🗄️ Step 1: Set Up MySQL Database on Railway

### 1.1 Create a New Railway Project
1. Go to [railway.app](https://railway.app) and sign in
2. Click "New Project"
3. Choose "Deploy from GitHub repo"
4. Connect your GitHub account and select your booking system repository

### 1.2 Add MySQL Service
1. In your Railway project dashboard, click "New Service"
2. Select "Database" → "MySQL"
3. Railway will automatically provision a MySQL database
4. Note down the connection details from the "Connect" tab

### 1.3 Import Database Schema
1. Connect to your Railway MySQL database using a MySQL client (like MySQL Workbench, phpMyAdmin, or command line)
2. Run the SQL commands from `schema.sql` to create all necessary tables and procedures
3. Alternatively, you can use Railway's built-in database console

## 🔧 Step 2: Configure Environment Variables

### 2.1 Set Railway Environment Variables
In your Railway project, go to the "Variables" tab and add these environment variables:

```env
# Database (Railway will auto-populate some of these)
DB_HOST=your-mysql-host.railway.app
DB_USER=root
DB_PASSWORD=your-generated-password
DB_NAME=railway
DB_PORT=3306

# Server
PORT=3000
NODE_ENV=production

# Email Configuration
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-gmail-app-password
ADMIN_EMAIL=admin@yourdomain.com

# Optional: Google Sheets Integration
GOOGLE_SHEET_ID=your-google-sheet-id
```

### 2.2 Gmail App Password Setup
1. Go to your Google Account settings
2. Enable 2-Factor Authentication
3. Generate an "App Password" for "Mail"
4. Use this app password (not your regular password) for `EMAIL_PASS`

## 🚀 Step 3: Deploy to Railway

### 3.1 Automatic Deployment
1. Railway will automatically detect your `package.json` and `railway.json`
2. It will install dependencies and start your application
3. Monitor the deployment logs in the Railway dashboard

### 3.2 Verify Deployment
1. Once deployed, Railway will provide a URL like `https://your-app-name.railway.app`
2. Visit this URL to test your booking system
3. Check the logs for any errors

## 🌐 Step 4: Set Up Custom Domain

### 4.1 Add Custom Domain in Railway
1. In your Railway project, go to "Settings" → "Domains"
2. Click "Add Domain"
3. Enter your custom domain (e.g., `bookwithbea.com`)

### 4.2 Configure DNS Records
Add these DNS records in your domain registrar's control panel:

**For root domain (bookwithbea.com):**
```
Type: CNAME
Name: @
Value: your-app-name.railway.app
```

**For www subdomain:**
```
Type: CNAME
Name: www
Value: your-app-name.railway.app
```

### 4.3 SSL Certificate
Railway automatically provides SSL certificates for custom domains. This may take a few minutes to propagate.

## 🔍 Step 5: Testing and Verification

### 5.1 Test Core Functionality
1. **Homepage**: Visit your domain and verify the booking form loads
2. **Services**: Check that nail services are displayed correctly
3. **Booking Flow**: Try making a test booking
4. **Email Notifications**: Verify emails are sent to the admin email
5. **Database**: Check that bookings are stored in MySQL

### 5.2 Test API Endpoints
- `GET /api/services` - Should return nail services
- `GET /api/slots/2024-01-15` - Should return available time slots
- `POST /api/bookings` - Should create a new booking

## 🛠️ Step 6: Optional Enhancements

### 6.1 Google Sheets Integration
1. Create a Google Sheets document
2. Enable Google Sheets API in Google Cloud Console
3. Create service account credentials
4. Download `credentials.json` and upload to Railway (or use environment variables)
5. Set `GOOGLE_SHEET_ID` environment variable

### 6.2 Monitoring and Logging
1. Use Railway's built-in logging and metrics
2. Set up alerts for application errors
3. Monitor database performance

### 6.3 Backup Strategy
1. Railway provides automated backups for MySQL
2. Consider additional backup solutions for critical data
3. Test restore procedures regularly

## 🚨 Troubleshooting

### Common Issues

**Database Connection Errors:**
- Verify all database environment variables are correct
- Check if Railway MySQL service is running
- Ensure SSL is properly configured

**Email Not Sending:**
- Verify Gmail app password is correct
- Check if 2FA is enabled on Gmail account
- Ensure `EMAIL_USER` and `ADMIN_EMAIL` are valid

**Application Not Starting:**
- Check Railway deployment logs
- Verify `package.json` scripts are correct
- Ensure all dependencies are listed

**Custom Domain Issues:**
- Allow 24-48 hours for DNS propagation
- Verify CNAME records are correct
- Check Railway domain configuration

### Useful Commands

**Connect to Railway MySQL locally:**
```bash
mysql -h your-mysql-host.railway.app -u root -p railway
```

**View Railway logs:**
```bash
railway logs
```

**Deploy specific branch:**
```bash
railway deploy --service your-service-id
```

## 📞 Support

- **Railway Support**: [Railway Discord](https://discord.gg/railway)
- **MySQL Issues**: Check Railway's MySQL documentation
- **Application Issues**: Check the application logs in Railway dashboard

## 🔐 Security Best Practices

1. **Environment Variables**: Never commit sensitive data to Git
2. **Database Access**: Use Railway's private networking when possible
3. **SSL/TLS**: Always use HTTPS in production
4. **Backup**: Regularly backup your database
5. **Monitoring**: Set up alerts for unusual activity

## 📈 Scaling Considerations

- **Database**: Railway MySQL can be scaled vertically
- **Application**: Railway supports horizontal scaling
- **CDN**: Consider using a CDN for static assets
- **Caching**: Implement Redis for session/data caching

---

## 🎉 Your Booking System is Now Live!

Your Book with Bea booking system should now be accessible at your custom domain with:
- ✅ MySQL database for reliable data storage
- ✅ Email notifications for new bookings
- ✅ SSL certificate for secure connections
- ✅ Professional custom domain
- ✅ Automatic deployments from GitHub

**Next Steps:**
1. Test all functionality thoroughly
2. Set up monitoring and alerts
3. Create regular database backups
4. Consider adding additional features like SMS notifications or payment processing
