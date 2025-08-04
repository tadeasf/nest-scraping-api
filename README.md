# NestJS Scraping API

A robust NestJS application for scraping news articles from popular Czech news websites. Built with enterprise-grade logging, comprehensive testing, and automated CI/CD pipeline.

## 🚀 Features

- **News Scraping**: Automated scraping from major Czech news websites
  - iDnes.cz
  - Hospodářské noviny (HN.cz)
  - Aktuálně.cz
  - Novinky.cz
  - Blesk.cz
- **Enterprise Logging**: Winston-based logging with file and console outputs
- **Database**: SQLite with TypeORM for data persistence
- **API Documentation**: Scalar UI for interactive API documentation
- **Background Jobs**: Scheduled scraping every hour using NestJS Schedule
- **Duplicate Prevention**: Content-based deduplication using SHA-256 hashing
- **Comprehensive Testing**: Unit tests, e2e tests, and code coverage
- **CI/CD Pipeline**: GitHub Actions with security scanning and code quality checks

## 📋 Prerequisites

- [Bun](https://bun.sh/) (v1.2.17 or higher)
- Node.js (v20 or higher)

## 🛠️ Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd nest-scraping-api
```

2. Install dependencies:
```bash
bun install
```

3. Create logs directory:
```bash
mkdir -p logs
```

## 🏃‍♂️ Running the Application

### Development Mode
```bash
bun run start:dev
```

### Production Mode
```bash
bun run build
bun run start:prod
```

### Debug Mode
```bash
bun run start:debug
```

## 🧪 Testing

### Run All Tests
```bash
bun run test
```

### Run Tests with Coverage
```bash
bun run test:cov
```

### Run Tests in Watch Mode
```bash
bun run test:watch
```

### Run End-to-End Tests
```bash
bun run test:e2e
```

### Run Tests for CI
```bash
bun run test:ci
```

## 🔍 Code Quality

### Linting
```bash
# Check and fix linting issues
bun run lint

# Check linting issues only (no auto-fix)
bun run lint:check
```

### Type Checking
```bash
bun run type-check
```

### Code Formatting
```bash
bun run format
```

### Security Audit
```bash
bun run audit
```

## 📊 Code Coverage

The project maintains a minimum code coverage threshold of 80% for:
- Branches
- Functions
- Lines
- Statements

Coverage reports are generated in multiple formats:
- HTML: `coverage/index.html`
- LCOV: `coverage/lcov.info`
- Console output

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Application
PORT=3000
NODE_ENV=development

# Logging
LOG_LEVEL=info

# Database
DB_TYPE=sqlite
DB_DATABASE=db.sqlite3
```

### Logging Configuration

Logs are stored in the `logs/` directory:
- `logs/combined.log`: All log levels
- `logs/error.log`: Error level only

## 📚 API Documentation

Once the application is running, you can access:

- **API Documentation (Scalar UI)**: http://localhost:3000/reference
- **OpenAPI JSON**: http://localhost:3000/api-json

The API documentation includes:
- Interactive API explorer
- Request/response examples
- Authentication details
- Schema definitions

## 🏗️ Project Structure

```
src/
├── config/
│   └── logging.config.ts      # Winston logging configuration
├── entities/
│   └── article.entity.ts      # Article database entity
├── scraping/
│   ├── scraping.module.ts     # Scraping module
│   ├── scraping.service.ts    # Core scraping logic
│   └── scraping.service.spec.ts # Unit tests
├── app.controller.ts          # Main controller
├── app.module.ts             # Root module
├── app.service.ts            # App service
└── main.ts                   # Application entry point

test/
├── setup.ts                  # Test environment setup
└── scraping.e2e-spec.ts      # End-to-end tests

logs/                         # Application logs
coverage/                     # Test coverage reports
```

## 🔄 CI/CD Pipeline

The project includes a comprehensive GitHub Actions workflow that runs on every push and pull request:

### Jobs
1. **Test**: Runs linting, type checking, and tests with coverage
2. **Security**: Performs security audits and vulnerability scanning
3. **Build**: Creates production build artifacts (main branch only)

### Features
- Automated testing with Jest
- Code coverage reporting to Codecov
- Security scanning with Snyk
- Dependency vulnerability checks
- Automated builds and deployments

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**:
   ```bash
   # Change the port in .env file
   PORT=3001
   ```

2. **Database issues**:
   ```bash
   # Remove existing database and restart
   rm db.sqlite3
   bun run start:dev
   ```

3. **Logging issues**:
   ```bash
   # Ensure logs directory exists
   mkdir -p logs
   ```

### Debug Mode

Run the application in debug mode to get detailed logs:
```bash
bun run start:debug
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

### Development Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes and test
bun run test
bun run lint
bun run type-check

# Commit changes
git commit -m "feat: add your feature"

# Push and create PR
git push origin feature/your-feature
```

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the API documentation at `/reference`
- Review the test files for usage examples
