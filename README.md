# Company's Report Management System

A comprehensive report management system built with Node.js, Express, Prisma, PostgreSQL, and modern frontend technologies.

## 🚀 Features

### Core Functionality
- **User Authentication & Authorization** - Secure login with JWT tokens and role-based access control
- **Report Management** - Upload, view, approve, and track weekly reports
- **Department Management** - Organize users into departments with HOD oversight
- **Notification System** - Real-time notifications for report status changes
- **Audit Trail** - Complete audit logging for all system activities

### Advanced Features
- **Modern UI/UX** - Responsive design with dark/light theme support
- **Real-time Updates** - Live notifications and status updates
- **Advanced Search & Filtering** - Powerful search across reports and users
- **Analytics Dashboard** - Comprehensive analytics and reporting
- **File Management** - PDF upload with version control and revision tracking
- **Comment System** - Collaborative feedback on reports
- **Profile Management** - User profiles with avatar support
- **Mobile Responsive** - Fully responsive design for all devices

### Enterprise Features
- **Multi-role Support** - Staff, HOD, Admin, and HR roles
- **Department Hierarchy** - Organized department structure
- **Bulk Operations** - Efficient management of multiple reports
- **Data Export** - Export capabilities for reports and analytics
- **System Settings** - Configurable system parameters
- **Audit Logging** - Complete activity tracking
- **Security** - Password hashing, session management, and CSRF protection

## 🛠️ Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Prisma** - Database ORM
- **PostgreSQL** - Primary database
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing
- **Multer** - File upload handling

### Frontend
- **Vanilla JavaScript** - Modern ES6+ features
- **CSS3** - Advanced styling with CSS variables
- **Font Awesome** - Icon library
- **Google Fonts** - Typography

### Development Tools
- **Prisma Migrate** - Database migrations
- **Nodemon** - Development server
- **ESLint** - Code linting

## 📋 Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn package manager

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/enterprise-report-system.git
   cd enterprise-report-system
   ```

2. **Install dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the `server` directory:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/report_system"
   JWT_SECRET="your-super-secret-jwt-key"
   CLIENT_ORIGIN="http://localhost:5500"
   UPLOAD_DIR="./uploads"
   PORT=4000
   ```

4. **Database Setup**
   ```bash
   # Generate Prisma client
   npm run prisma:generate
   
   # Run database migrations
   npm run prisma:migrate
   
   # (Optional) Seed the database
   npm run prisma:seed
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:5500
   - API: http://localhost:4000/api
   - Health check: http://localhost:4000/api/health

## 📊 Database Schema

### Core Models

#### User
- Basic user information and authentication
- Role-based access control (STAFF, HOD, ADMIN, HR)
- Department association
- Profile management

#### Department
- Organizational structure
- HOD assignment
- Staff management

#### Report
- Weekly report submissions
- Status tracking (DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED)
- File management with version control
- Comments and revisions

#### Notification
- Real-time notifications
- Type-based categorization
- Read/unread status tracking

#### AuditLog
- Complete activity tracking
- User actions and system events
- Metadata and context preservation

## 🔐 Authentication & Authorization

### Roles
- **STAFF** - Can submit and view their own reports
- **HOD** - Can manage department reports and staff
- **ADMIN** - Full system access and configuration
- **HR** - User management and department oversight

### Security Features
- JWT token-based authentication
- Password hashing with bcryptjs
- Session management
- CSRF protection
- Input validation and sanitization

## 📱 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password

### Reports
- `GET /api/reports` - Get all reports (with filtering)
- `POST /api/reports` - Submit new report
- `GET /api/reports/mine` - Get user's reports
- `GET /api/reports/:id` - Get specific report
- `PUT /api/reports/:id/status` - Update report status
- `POST /api/reports/:id/comments` - Add comment
- `POST /api/reports/:id/revisions` - Upload revision
- `DELETE /api/reports/:id` - Delete report

### Departments
- `GET /api/departments` - Get all departments
- `POST /api/departments` - Create department
- `PUT /api/departments/:id` - Update department
- `DELETE /api/departments/:id` - Delete department
- `POST /api/departments/:id/staff` - Assign staff

### Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/mark-all-read` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification

### Dashboard & Analytics
- `GET /api/dashboard/analytics` - Get dashboard analytics
- `GET /api/dashboard/department-performance` - Department metrics
- `GET /api/dashboard/activity` - User activity summary

### Admin
- `GET /api/admin/users` - Get all users
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/audit-logs` - Get audit logs
- `GET /api/admin/settings` - Get system settings
- `PUT /api/admin/settings` - Update system settings

## 🎨 Frontend Features

### User Interface
- **Modern Design** - Clean, professional interface
- **Responsive Layout** - Works on all device sizes
- **Dark/Light Theme** - User preference support
- **Interactive Components** - Modals, dropdowns, and animations
- **Real-time Updates** - Live notifications and status changes

### User Experience
- **Intuitive Navigation** - Easy-to-use interface
- **Keyboard Shortcuts** - Power user features
- **Search & Filter** - Quick data access
- **Bulk Actions** - Efficient operations
- **Error Handling** - User-friendly error messages

## 🔧 Configuration

### Environment Variables
```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/db"

# Authentication
JWT_SECRET="your-secret-key"

# Server
PORT=4000
CLIENT_ORIGIN="http://localhost:5500"

# File Upload
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE=10485760  # 10MB

# Email (Optional)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
```

### System Settings
- Report submission deadlines
- File size limits
- Notification preferences
- Department configurations
- User management policies

## 🚀 Deployment

### Production Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Set production environment variables**
   ```env
   NODE_ENV=production
   DATABASE_URL="your-production-database-url"
   JWT_SECRET="your-production-secret"
   ```

3. **Run database migrations**
   ```bash
   npm run prisma:deploy
   ```

4. **Start the production server**
   ```bash
   npm start
   ```

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run prisma:generate
EXPOSE 4000
CMD ["npm", "start"]
```

### Railway Deployment
The project includes Railway configuration files:
- `railway.toml` - Railway deployment configuration
- `nixpacks.toml` - Build configuration

## 📈 Performance & Monitoring

### Performance Features
- Database query optimization
- Efficient file handling
- Caching strategies
- Pagination for large datasets
- Lazy loading for better UX

### Monitoring
- Health check endpoint
- Error logging
- Performance metrics
- Audit trail tracking
- User activity monitoring

## 🧪 Testing

### Running Tests
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e
```

### Test Coverage
- API endpoint testing
- Database operation testing
- Frontend component testing
- User workflow testing

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow ESLint configuration
- Write comprehensive tests
- Update documentation
- Follow semantic versioning
- Use conventional commits

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation
- [API Documentation](docs/api.md)
- [User Guide](docs/user-guide.md)
- [Admin Guide](docs/admin-guide.md)
- [Developer Guide](docs/developer-guide.md)

### Troubleshooting
- Check the [FAQ](docs/faq.md)
- Review [Common Issues](docs/troubleshooting.md)
- Open an [Issue](https://github.com/your-username/enterprise-report-system/issues)

### Contact
- Email: support@yourcompany.com
- Documentation: [docs.yourcompany.com](https://docs.yourcompany.com)
- Community: [Discord Server](https://discord.gg/your-invite)

## 🙏 Acknowledgments

- [Express.js](https://expressjs.com/) - Web framework
- [Prisma](https://www.prisma.io/) - Database toolkit
- [PostgreSQL](https://www.postgresql.org/) - Database
- [Font Awesome](https://fontawesome.com/) - Icons
- [Google Fonts](https://fonts.google.com/) - Typography

---

**Built with ❤️ for modern enterprise needs**
