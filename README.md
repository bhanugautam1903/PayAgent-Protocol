# PayAgent Protocol

**AI-Assisted Agent-to-Agent Commerce and Payment Management**

PayAgent Protocol is a full-stack application that explores how software agents can delegate tasks, process results, and manage payments through a structured workflow.

The system combines agent management, capability-based permissions, AI-assisted task verification, CSV data analysis, and PayPal Sandbox payments.

A requester agent can assign work, review the submitted result, and approve payment capture once the task is completed.

The project demonstrates an **escrow-style approval-and-release workflow**, not a regulated escrow service or a fully autonomous payment network.

## Live Demo and Source Code

| Resource | Link |
|---|---|
| Live Application | [PayAgent Protocol Frontend](https://payagent-protocol-frontend.onrender.com) |
| Backend API | [PayAgent Protocol Backend](https://payagent-protocol-backend.onrender.com) |
| API Health Check | [GET /api/health](https://payagent-protocol-backend.onrender.com/api/health) |
| GitHub Repository | [PayAgent-Protocol](https://github.com/bhanugautam1903/PayAgent-Protocol) |

> **Demo Note:** Payments use PayPal Sandbox accounts and do not transfer real money. The free Render backend may take some time to respond after inactivity.

## Features

### Agent and Task Management

- Register and manage agents with different capabilities.
- Assign tasks based on agent permissions.
- Create tasks with descriptions, required capabilities, and budgets.
- Track task progress through different execution stages.
- Review and approve or reject completed tasks.

### PayPal Integration

- Create payment orders using the PayPal Sandbox API.
- Redirect users to PayPal for payment approval.
- Verify payment approval before allowing task execution.
- Capture payments after requester approval.
- Store payment and transaction details in Firestore.
- Handle payment errors and repeated capture requests.

### AI-Assisted Verification

- Integrate Google Gemini for evaluating submitted task results.
- Compare execution results with task requirements.
- Generate structured verification responses.
- Validate AI-generated verdicts, scores, and explanations.
- Handle API failures through retries and manual review fallback.

### CSV Data Analysis

- Upload sales datasets in CSV format.
- Validate file size, format, and required columns.
- Calculate revenue, quantities sold, and product performance.
- Analyze monthly sales trends.
- Generate insights, recommendations, and formatted reports.
- Submit generated reports for task verification and review.

### Dashboard

- View registered agents and their status.
- Monitor tasks and payment activity.
- Create tasks directly from the interface.
- Filter tasks by their current status.
- Upload datasets and submit results.
- Review task details and payment information.

## Tech Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite, JavaScript, CSS |
| Backend | Node.js, Express.js |
| Database | Firebase Firestore |
| AI Integration | Google Gemini API |
| Payments | PayPal REST API (Sandbox) |
| File Upload | Multer |
| CSV Processing | csv-parse |
| HTTP Client | Axios |
| API Testing | Postman |
| Deployment | Render |
| Version Control | Git, GitHub |

## System Architecture

The application follows a client-server architecture.

React handles the user interface, while Express manages task operations, agent permissions, external API requests, and database interactions.

Firebase Firestore stores agent records, task details, execution results, verification information, and payment statuses.

Google Gemini evaluates submitted task results. PayPal Sandbox handles payment order creation, approval, and capture.

```text
                  React Frontend
                        |
                        v
                  Express REST API
                        |
          +-------------+-------------+
          |             |             |
          v             v             v
      Agent & Task   AI Verification  Payment Service
       Management     Google Gemini   PayPal Sandbox
          |             |             |
          +-------------+-------------+
                        |
                        v
                  Firebase Firestore
```

## Task Workflow

A transaction moves through the following stages:

1. **Task Creation:** A requester selects an agent, defines task requirements, and sets a budget.

2. **Permission Validation:** The backend checks whether the assigned agent has permission for the required capability.

3. **Payment Approval:** A PayPal Sandbox order is created, and the requester approves the payment.

4. **Task Acceptance:** The assigned agent accepts the task after payment approval is verified.

5. **Task Execution:** The agent submits an execution result. For sales analysis tasks, a CSV dataset can be uploaded to generate a report.

6. **AI Verification:** Google Gemini attempts to evaluate the submitted result against the task requirements.

7. **Requester Review:** The requester approves or rejects the submitted work.

8. **Payment Capture:** If the requester approves the task, the backend attempts to capture the payment through PayPal.

Payment approval and payment capture are separate operations.

**Final payment release remains under requester control.**

## Project Structure

```text
PayAgent_Protocol/
|
|-- backend/
|   |-- config/
|   |   |-- serviceAccountKey.json
|   |
|   |-- src/
|   |   |-- config/
|   |   |   |-- firebase.js
|   |   |
|   |   |-- controllers/
|   |   |   |-- agentController.js
|   |   |   |-- permissionController.js
|   |   |   |-- taskController.js
|   |   |   |-- reviewController.js
|   |   |   |-- salesAnalysisController.js
|   |   |
|   |   |-- middleware/
|   |   |-- routes/
|   |   |
|   |   |-- services/
|   |   |   |-- geminiService.js
|   |   |   |-- paypalService.js
|   |   |   |-- salesAnalysisService.js
|   |   |
|   |   |-- server.js
|   |
|   |-- .env
|   |-- .gitignore
|   |-- package.json
|
|-- frontend/
|   |-- public/
|   |-- src/
|   |   |-- services/
|   |   |   |-- api.js
|   |   |-- App.jsx
|   |   |-- App.css
|   |   |-- main.jsx
|   |
|   |-- vite.config.js
|   |-- package.json
|
|-- screenshots/
|-- sales-data.csv
|-- README.md
```

**Security Note:** The Firebase service account file and backend `.env` contain sensitive credentials and must not be committed to GitHub.

## Getting Started

### Prerequisites

Before running the application, install or configure:

- Node.js and npm
- Firebase project with Firestore enabled
- Firebase Admin SDK service account credentials
- PayPal Developer Sandbox credentials
- Google Gemini API key

### 1. Clone the Repository

```bash
git clone https://github.com/bhanugautam1903/PayAgent-Protocol.git
cd PayAgent-Protocol
```

### 2. Backend Setup

Navigate to the backend directory:

```bash
cd backend
npm install
```

Create a `.env` file inside the `backend` directory:

```env
GEMINI_API_KEY=your_gemini_api_key
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_paypal_sandbox_client_secret
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
PORT=5000
```

Replace the placeholder values with your own credentials.

#### Firebase Configuration

1. Open Firebase Console.
2. Select your Firebase project.
3. Navigate to Project Settings.
4. Open Service Accounts.
5. Generate a Firebase Admin SDK private key.
6. Download the JSON file.
7. Rename it to `serviceAccountKey.json`.
8. Place it inside:

```text
backend/config/serviceAccountKey.json
```

The Firebase configuration supports local service account credentials and a `FIREBASE_SERVICE_ACCOUNT` environment variable for deployment.

Never expose Firebase private keys in frontend code or public repositories.

#### Start Backend

```bash
npm run dev
```

The backend runs locally at:

```text
http://localhost:5000
```

Check backend health:

```text
http://localhost:5000/api/health
```

A successful health response looks like:

```json
{
  "success": true,
  "status": "healthy",
  "service": "PayAgent API",
  "version": "1.0.0"
}
```

### 3. Frontend Setup

Open another terminal.

Navigate to the frontend directory:

```bash
cd frontend
npm install
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

The frontend uses a Vite development proxy to communicate with the local backend.

For production deployment, the frontend uses the `VITE_API_BASE_URL` environment variable.

## API Endpoints

### Health Check

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Check backend service health |

### Task Management

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/tasks` | Retrieve task records |
| POST | `/api/tasks/create` | Create a task and PayPal order |
| POST | `/api/tasks/confirm-payment` | Confirm PayPal payment approval |
| POST | `/api/tasks/accept` | Accept an assigned task |
| POST | `/api/tasks/execute` | Submit task execution results |
| POST | `/api/tasks/review` | Approve or reject a task |
| POST | `/api/tasks/analyze-sales` | Analyze an uploaded CSV dataset |

Additional agent and permission routes support agent registration, capability management, and permission validation.

## CSV Analysis

The sales analysis endpoint accepts a CSV file using `multipart/form-data`.

**Endpoint:**

```http
POST /api/tasks/analyze-sales
```

**Form field:** `file`

**Maximum file size:** 5 MB

**Supported file extension:** `.csv`

### Required CSV Columns

```csv
date,product,quantity,unitPrice
2026-01-05,Laptop,2,500
2026-01-10,Mouse,5,20
2026-02-02,Keyboard,3,40
```

The service validates:

- Required column names
- Valid dates in YYYY-MM-DD format
- Non-empty product names
- Positive integer quantities
- Non-negative numeric unit prices
- Non-empty datasets

### Generated Analysis

The analysis service calculates:

- Total revenue
- Total quantity sold
- Number of products and sales records
- Top products by revenue
- Monthly revenue trends
- Sales insights
- Recommendations

The generated analysis includes a formatted report that can be submitted as a task execution result.

CSV files are processed in memory by the analysis endpoint.

## Gemini AI Verification

PayAgent Protocol integrates the Google Gemini API to evaluate submitted task execution results.

The verification service considers:

- Task title
- Task description
- Required capability
- Submitted execution result

It requests a structured response from Gemini.

### Example Verification Response

```json
{
  "verdict": "needs_review",
  "score": 70,
  "reasoning": "Additional evidence is required to verify the submitted result.",
  "missingItems": [
    "Supporting evidence"
  ]
}
```

Supported verdicts:

- `approved`
- `rejected`
- `needs_review`

The score represents an evaluation score between 0 and 100.

The backend validates the response structure and handles selected API failures through retries and fallback handling.

### Manual Review Fallback

If Gemini verification cannot be completed, the workflow remains available for manual requester review.

During development testing, Gemini returned an HTTP 503 error. The integration and fallback handling were implemented, but successful automated verification was not confirmed in that test.

**AI verification supports the review process. It does not independently authorize payment capture.**

## PayPal Payment Handling

PayAgent Protocol uses PayPal Sandbox to simulate payments without real-money transactions.

### Payment Lifecycle

```text
Task Created
     |
     v
PayPal Order Created
     |
     v
Requester Approves Payment
     |
     v
Payment Approval Verified
     |
     v
Agent Accepts Task
     |
     v
Agent Submits Result
     |
     v
AI Verification / Manual Review
     |
     v
Requester Approves Task
     |
     v
PayPal Payment Captured
     |
     v
Firestore Updated
```

The implementation includes:

- PayPal order creation
- Payment approval verification
- Payment status validation
- Requester-controlled capture
- Transaction record storage
- Handling for repeated capture requests
- Payment failure handling

The implementation demonstrates an escrow-style approval-and-release workflow.

It is not a regulated escrow service.

## Deployment

The application is deployed using Render.

### Backend Deployment

**Platform:** Render Web Service

**Live URL:**

https://payagent-protocol-backend.onrender.com

**Configuration:**

| Setting | Value |
|---|---|
| Runtime | Node.js |
| Branch | `master` |
| Root Directory | `backend` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Region | Singapore |

### Backend Environment Variables

Configure the following variables in the Render dashboard:

```env
GEMINI_API_KEY=your_gemini_api_key
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_paypal_sandbox_client_secret
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
FIREBASE_SERVICE_ACCOUNT=your_firebase_service_account_json
```

`FIREBASE_SERVICE_ACCOUNT` must contain the complete Firebase service account JSON.

Render provides a `PORT` environment variable for the running service.

The backend must listen on the port provided by the hosting environment.

**Do not commit production or Sandbox credentials to GitHub.**

### Frontend Deployment

**Platform:** Render Static Site

**Live URL:**

https://payagent-protocol-frontend.onrender.com

**Configuration:**

| Setting | Value |
|---|---|
| Branch | `master` |
| Root Directory | `frontend` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

### Frontend Environment Variable

```env
VITE_API_BASE_URL=https://payagent-protocol-backend.onrender.com/api
```

The Axios client uses the deployed backend URL when this environment variable is configured.

Example:

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
});

export default api;
```

The frontend and backend are deployed separately.

## Testing and Validation

The application has been tested across its main task and payment workflows.

### Completed Checks

- Firebase connection and backend startup
- Agent and task retrieval
- Task creation and permission validation
- PayPal Sandbox order creation
- PayPal payment approval verification
- Task acceptance and execution
- CSV upload and sales report generation
- Task review and approval
- Successful PayPal Sandbox payment capture
- Frontend production build
- Frontend lint validation
- Render backend deployment
- Render frontend deployment
- Live backend health check
- Live task execution and Sandbox payment capture

### CSV Analysis Test

A sample sales dataset containing nine records produced:

| Metric | Result |
|---|---:|
| Sales Records | 9 |
| Products | 4 |
| Quantity Sold | 57 |
| Total Revenue | $7,385 |

### Live Deployment Test

The deployed application successfully completed a task workflow involving:

1. Task acceptance
2. CSV dataset upload
3. Sales report generation
4. Task result submission
5. Requester approval
6. PayPal Sandbox payment capture

**Observed live result:**

```text
Task Status: approved
Payment Status: captured
Captured Amount: $1.00 USD
```

This confirms that the deployed frontend and backend successfully completed the tested Sandbox payment workflow.

The frontend production build and lint checks also completed without reported errors.

## Current Limitations

- The project uses PayPal Sandbox rather than live payments.
- Gemini verification depends on external API availability.
- Successful automated Gemini verification was not confirmed in the HTTP 503 test.
- Final task approval and payment capture require requester action.
- The payment capture retry flow has not been fully tested under failure conditions.
- Agent-to-agent execution is not fully autonomous.
- Additional authentication and authorization would be needed for production use.
- The application is a prototype and is not configured for real-money production payment processing.

## Security Considerations

The application uses environment variables to configure external API credentials.

Sensitive files include:

```text
backend/.env
backend/config/serviceAccountKey.json
```

These files must remain excluded from version control.

Security measures implemented in the prototype include:

- Capability-based permission checks
- Task input validation
- Payment status validation
- CSV file type validation
- CSV upload size restrictions
- In-memory CSV processing
- Backend-managed PayPal API credentials
- Backend-managed Firebase credentials

Before production deployment, additional measures would be required, including:

- Strong user and agent authentication
- Server-side authorization for all sensitive operations
- Audit logging
- Rate limiting
- Webhook verification
- Automated security testing
- Secret rotation and secure credential management

## Future Improvements

- Agent authentication and access control
- Automated agent-to-agent task execution
- PayPal webhook integration
- Expanded AI verification and evidence validation
- Automated backend and end-to-end testing
- Transaction history and analytics
- Improved observability and monitoring
- Additional data analysis capabilities
- Stronger payment workflow security

## Project Screenshots

### 1. Dashboard

![PayAgent Protocol Dashboard](screenshots/01-dashboard.png)

### 2. Task Creation

![Create Task](screenshots/02-create-task.png)

### 3. PayPal Sandbox Checkout

![PayPal Sandbox Checkout](screenshots/03-paypal-sandbox-checkout.png)

### 4. Payment Approval

![PayPal Approval](screenshots/04-payment-approved.png)

### 5. CSV Analysis and Task Execution

![CSV Upload](screenshots/05-csv-upload.png)

### 6. Completed Task and Payment Capture

![Payment Captured](screenshots/06-payment-captured.png)

## About the Project

PayAgent Protocol was developed as a practical exploration of AI-assisted agent workflows and payment integration.

The project brings together:

- Full-stack web development
- REST API design
- Database management
- External API integration
- Asynchronous operations
- Error handling
- Structured task processing
- Cloud deployment
- Payment workflow management

Its main focus is demonstrating how AI-assisted verification and requester-controlled payment workflows can operate together within a full-stack application.

## Project Links

**Live Application:**  
https://payagent-protocol-frontend.onrender.com

**Backend API:**  
https://payagent-protocol-backend.onrender.com

**GitHub Repository:**  
https://github.com/bhanugautam1903/PayAgent-Protocol

---

**PayAgent Protocol — AI-Assisted Agent-to-Agent Commerce and Payment Management**
