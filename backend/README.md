# PayAgent Protocol — Backend

The backend of PayAgent Protocol is built with Node.js and Express. It manages agent permissions, task execution, AI-assisted verification, CSV analysis, and PayPal Sandbox payment operations.

Firebase Firestore is used to store agent records, task information, execution results, and payment statuses.

## Tech Stack

- Node.js
- Express.js
- Firebase Admin SDK
- Google Gemini API
- PayPal REST API
- Multer
- csv-parse

## Core Modules

### Agent Management

Handles agent registration and retrieval.

### Permission Management

Validates agent capabilities and spending permissions before task assignment.

### Task Management

Manages task creation, acceptance, execution, and status updates.

### AI Verification

Uses Google Gemini to evaluate submitted task results against task requirements.

The service validates structured verification responses and handles selected API failures through retries and timeouts.

When verification is unavailable, manual requester review remains available.

### Payment Integration

Handles PayPal Sandbox order creation, payment approval verification, and payment capture following requester approval.

### Sales Analysis

Processes uploaded CSV datasets and generates reports containing revenue calculations, product performance, monthly trends, insights, and recommendations.

## Project Structure

```text
backend/
├── config/
├── src/
│   ├── config/
│   │   └── firebase.js
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   │   ├── geminiService.js
│   │   ├── paypalService.js
│   │   └── salesAnalysisService.js
│   └── server.js
├── .gitignore
└── package.json
```

## Setup

Install dependencies:

```bash
npm install
```

Create a `.env` file in the backend directory:

```env
GEMINI_API_KEY=your_gemini_api_key
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_paypal_sandbox_client_secret
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
PORT=5000
```

Place the Firebase service account JSON at:

```text
config/serviceAccountKey.json
```

Start the development server:

```bash
npm run dev
```

The backend runs at:

```text
http://localhost:5000
```

## Task API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/tasks` | Retrieve tasks |
| POST | `/api/tasks/create` | Create a task |
| POST | `/api/tasks/confirm-payment` | Confirm PayPal approval |
| POST | `/api/tasks/accept` | Accept a task |
| POST | `/api/tasks/execute` | Submit execution results |
| POST | `/api/tasks/review` | Review submitted work |
| POST | `/api/tasks/analyze-sales` | Analyze a sales CSV |

## CSV Analysis

The CSV analysis endpoint accepts a file through `multipart/form-data` using the field name `file`.

Required columns:

```csv
date,product,quantity,unitPrice
2026-01-05,Laptop,2,500
2026-01-10,Mouse,5,20
```

The maximum supported file size is 5 MB.

The analysis service returns revenue totals, quantity sold, product rankings, monthly trends, and a formatted report.

## Payment Workflow

The backend creates a PayPal Sandbox order when a task is submitted.

After the requester approves the order, the assigned agent can accept and execute the task.

Payment capture is attempted only after the requester approves the submitted work.

Payment statuses and capture details are maintained in Firestore.

## Security

API keys and Firebase credentials must remain outside version control.

The backend includes input validation, agent permission checks, and payment state validation.

Additional authentication and authorization controls would be required before production deployment.

For the complete application overview, refer to the repository's main README.
