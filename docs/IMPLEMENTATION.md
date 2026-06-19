# Implementation Guide: Class Reunion Application

This document provides instructions for setting up and running the Class Reunion Web Application locally using Docker Compose.

## 🚀 Prerequisites

Ensure you have the following installed on your system:
*   [Docker](https://www.docker.com/products/docker-desktop/) (including Docker Compose)
*   [Node.js](https://nodejs.org/en/) (LTS version recommended)
*   Git

## ⚙️ Setup Instructions

1.  **Clone the Repository**
    ```bash
    git clone [repository-url]
    cd ClassYear
    ```

2.  **Install Dependencies**
    Install Node.js dependencies for the frontend and backend services.
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Configure Environment Variables**
    Create a `.env` file in the root directory and populate it with the necessary configurations. This includes database credentials, API keys, and local service ports.

    Example `.env`:
    ```env
    # Local Database Configuration
    DB_HOST=localhost
    DB_PORT=5432
    DB_USER=user
    DB_PASS=password
    DB_NAME=class_reunion_db

    # Local Service Configuration
    S3_ENDPOINT=http://localhost:4566
    # Add other necessary API gateway/lambda configurations here
    ```

## 🐳 Running Local Services (Docker)

Use `docker-compose` to launch the essential microservices (PostgreSQL and Localstack) required to simulate the AWS cloud environment locally.

```bash
docker compose up -d
```

> **Note:** This command starts the database and S3 mock services in the background.

## 🖥️ Running the Application

Once the services are up, you can run the frontend and backend components.

1.  **Start the Backend (API/Lambda Simulation)**
    Navigate to the backend directory and start the server.
    ```bash
    cd backend
    npm run dev
    # Or use the Serverless Framework command if deploying locally
    # sls invoke local-api
    ```

2.  **Start the Frontend (React SPA)**
    Navigate to the frontend directory and start the development server.
    ```bash
    cd frontend
    npm run dev
    # Application will typically run on http://localhost:3000
    ```

## 🔍 Architectural Notes

*   **Data Flow:** The frontend communicates with the backend API. The backend uses the PostgreSQL container for user/class data and relies on the Localstack container to simulate S3 interactions for photo metadata.
*   **Scalability:** While run locally, the code maintains the serverless paradigm, meaning the architecture is ready for seamless transition to AWS Lambda/API Gateway deployment using the Serverless Framework.