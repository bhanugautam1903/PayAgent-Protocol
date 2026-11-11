# PayAgent Protocol — Frontend

The frontend of PayAgent Protocol is built with React and Vite. It provides a dashboard for managing agents, creating tasks, tracking execution, and reviewing payment activity.

## Features

- Dashboard with agent, task, and payment statistics
- Task creation with agent selection and budget configuration
- Task filtering and status tracking
- PayPal Sandbox checkout integration
- CSV upload for sales analysis
- Task execution and result submission
- Requester approval and rejection workflow
- Responsive interface for desktop and mobile screens

## Tech Stack

- React
- JavaScript
- Vite
- CSS
- Axios

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The application runs at:

```text
http://localhost:5173
```

The backend must be running for API requests to work.

## API Integration

API requests are handled through `src/services/api.js`.

During development, Vite forwards requests beginning with `/api` to the Express backend running on port 5000.

The frontend communicates with the backend to retrieve agents, create tasks, verify PayPal approvals, upload CSV files, and manage task execution.

## Build and Validation

Create a production build:

```bash
npm run build
```

Run lint checks:

```bash
npm run lint
```

The production build is generated in the `dist` directory.

## Project Structure

```text
src/
├── assets/
├── services/
│   └── api.js
├── App.jsx
├── App.css
├── index.css
└── main.jsx
```

For the complete project architecture and backend setup, refer to the README in the repository root.
