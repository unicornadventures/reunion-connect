# Serverless Lambda Architecture Research

## Overview: Converting ClassYear to AWS Lambda + API Gateway

This document outlines how to convert the ClassYear Express.js application to a serverless architecture using AWS Lambda, API Gateway, and SAM (Serverless Application Model).

---

## 1. What is SAM (Serverless Application Model)?

**SAM** is an open-source framework that makes it easier to build serverless applications on AWS. It's built on top of CloudFormation and provides:

- Simple syntax for defining Lambda functions, API Gateway, databases, etc.
- Local testing with SAM CLI (mimics AWS environment locally)
- Easy deployment to AWS or LocalStack
- Infrastructure-as-Code (IaC) approach

**Key Benefits:**
- No need to manually click AWS console
- Version control your infrastructure
- Repeatable deployments
- Works with LocalStack for local development

---

## 2. Architecture Overview

### Current Setup (Express)
```
User → Express Server (Always Running) → PostgreSQL
```
- Cost: Container running 24/7 (expensive)
- Complexity: Manage scaling, server maintenance

### Proposed Serverless Setup
```
User → API Gateway → Lambda Functions → RDS (PostgreSQL)
        (Routing)      (Event-driven)
```
- Cost: Pay per request (~$0.20 per million requests)
- Scaling: Automatic, handles spikes without config
- Free Tier: 1M invocations/month free

---

## 3. How Express Routes Convert to Lambda

### Express Example
```javascript
// Current: Express route
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  // ... login logic ...
  res.status(200).json({ user: loginResult });
});
```

### Lambda Equivalent
```javascript
// Serverless: Lambda handler
export const loginHandler = async (event, context) => {
  try {
    const { email, password } = JSON.parse(event.body);
    // ... login logic ...
    return {
      statusCode: 200,
      body: JSON.stringify({ user: loginResult })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

**Key Differences:**
1. Request comes as `event` object instead of `req`
2. Response is a simple object with `statusCode` and `body` (must be JSON string)
3. API Gateway parses the response and sends it to client
4. No persistent server - function runs, returns, shuts down

---

## 4. SAM Template Structure

### Basic SAM Template (template.yaml)
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2010-05-11
Description: ClassYear Serverless Application

Globals:
  Function:
    Timeout: 30
    Runtime: nodejs18.x
    Environment:
      Variables:
        DB_HOST: !GetAtt RDSInstance.Endpoint.Address
        DB_NAME: class_reunion
        DB_USER: admin
        JWT_SECRET: ${JWT_SECRET}

Resources:
  # API Gateway
  ClassYearAPI:
    Type: AWS::Serverless::Api
    Properties:
      StageName: dev
      Auth:
        DefaultAuthorizer: MyCognitoAuth

  # Lambda Functions
  AuthLoginFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: src/routes/auth.loginHandler
      Runtime: nodejs18.x
      Events:
        PostLogin:
          Type: Api
          Properties:
            RestApiId: !Ref ClassYearAPI
            Path: /api/auth/login
            Method: POST

  UserProfileFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: src/routes/users.getProfileHandler
      Events:
        GetProfile:
          Type: Api
          Properties:
            RestApiId: !Ref ClassYearAPI
            Path: /api/users/{userId}
            Method: GET

  # Database
  RDSInstance:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: class-reunion-db
      DBInstanceClass: db.t3.micro
      Engine: postgres
      MasterUsername: admin
      MasterUserPassword: !Sub '{{resolve:secretsmanager:ClassYearDBPassword:SecretString:password}}'
      AllocatedStorage: 20
      StorageType: gp2

Outputs:
  APIEndpoint:
    Description: API Gateway endpoint URL
    Value: !Sub 'https://${ClassYearAPI}.execute-api.${AWS::Region}.amazonaws.com/dev'
  
  DatabaseEndpoint:
    Description: RDS Database endpoint
    Value: !GetAtt RDSInstance.Endpoint.Address
```

**What This Does:**
- Defines 2 Lambda functions (login, getProfile)
- Creates API Gateway to route requests to Lambda
- Creates RDS PostgreSQL database
- Sets up environment variables for Lambda functions
- Outputs the API endpoint URL for frontend

---

## 5. Project Structure for Serverless

```
ClassYear/
├── template.yaml                 # SAM infrastructure definition
├── samconfig.toml               # SAM CLI configuration
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts         # Lambda handlers for auth routes
│   │   │   ├── users.ts        # Lambda handlers for user routes
│   │   │   ├── comments.ts     # Lambda handlers for comment routes
│   │   │   └── ...
│   │   ├── db.ts               # Database connection (shared)
│   │   ├── utils/              # Utilities (shared across handlers)
│   │   └── lambda/
│   │       └── index.ts        # Lambda wrapper utilities
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── public/                 # Static assets for S3
│   ├── src/                    # React app
│   └── dist/                   # Built static site (for S3 deploy)
│
├── localstack/
│   └── init-aws.sh            # LocalStack initialization script
│
└── Makefile                    # Commands for local dev & deployment
```

---

## 6. Lambda Handler Example: Full Route Conversion

### Current Express Route (POST /api/auth/login)
```typescript
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required.' });
  }

  try {
    const userResult = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('auth_token', token, { httpOnly: true, secure: true, sameSite: 'strict' });
    res.status(200).json({ user: { id: user.id, email: user.email, is_admin: user.is_admin } });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});
```

### Converted Lambda Handler
```typescript
// src/routes/auth.ts

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { query } from '../db';

export const loginHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { email, password } = JSON.parse(event.body || '{}');

    if (!email || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email and password required.' })
      };
    }

    const userResult = await query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const user = userResult.rows[0];

    if (!user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid credentials.' })
      };
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid credentials.' })
      };
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
    const token = jwt.sign(
      { id: user.id, email: user.email, is_admin: user.is_admin },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      statusCode: 200,
      headers: {
        'Set-Cookie': `auth_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/`
      },
      body: JSON.stringify({
        user: { id: user.id, email: user.email, is_admin: user.is_admin }
      })
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error.' })
    };
  }
};
```

**Key Conversions:**
- `req.body` → `JSON.parse(event.body || '{}')`
- `res.status(400).json(...)` → `{ statusCode: 400, body: JSON.stringify(...) }`
- `res.cookie(...)` → `headers: { 'Set-Cookie': ... }`
- Error handling stays similar, but response format changes

---

## 7. Local Development with SAM CLI

### Setup LocalStack + SAM

```bash
# 1. Start LocalStack containers (PostgreSQL + LocalStack services)
docker-compose up -d

# 2. Install SAM CLI
brew install aws-sam-cli

# 3. Configure AWS CLI for LocalStack
aws configure
# AWS Access Key ID: test
# AWS Secret Access Key: test
# Default region: us-east-1
# Default output format: json

# 4. Set LocalStack endpoint
export AWS_ENDPOINT_URL=http://localhost:4566

# 5. Build SAM application
sam build

# 6. Start SAM local server (emulates API Gateway + Lambda locally)
sam local start-api --port 3001

# 7. Test API
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

**What SAM CLI Does:**
- Reads template.yaml
- Bundles Lambda functions
- Starts local API Gateway emulator on port 3001
- Routes requests to local Lambda functions
- Connects to LocalStack services

---

## 8. Frontend as Static S3 Site

### Build & Deploy Frontend

```bash
# 1. Build React app
cd frontend
npm run build

# 2. Create S3 bucket (LocalStack)
aws s3 mb s3://classyear-frontend --endpoint-url=http://localhost:4566

# 3. Upload static files
aws s3 sync dist/ s3://classyear-frontend/ --endpoint-url=http://localhost:4566

# 4. Access via CloudFront (or direct S3 URL for LocalStack)
# LocalStack: http://classyear-frontend.s3.localhost.localstack.cloud
# AWS: https://classyear.cloudfront.net
```

**Frontend Environment Setup:**
```javascript
// src/api.ts
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// In .env.development
REACT_APP_API_URL=http://localhost:3001/api

// In .env.production (for AWS)
REACT_APP_API_URL=https://abc123.execute-api.us-east-1.amazonaws.com/prod/api
```

---

## 9. Cold Start Considerations

### What is a Cold Start?
When a Lambda function is invoked after being idle, AWS needs to:
1. Download function code (~50-500ms)
2. Start Node.js runtime (~1-3 seconds)
3. Initialize dependencies

**Total**: First request after idle = 1-5 seconds slower

### Mitigation Strategies:
```yaml
# In template.yaml
ReservedConcurrentExecutions: 1  # Keep 1 function "warm"
# Cost: ~$0.015/month per reserved execution

# Or use a scheduled CloudWatch event to keep it warm:
WarmupSchedule:
  Type: AWS::Serverless::Function
  Properties:
    Handler: src/warmup.handler
    Events:
      CronEvent:
        Type: Schedule
        Properties:
          Schedule: 'rate(5 minutes)'  # Invoke every 5 min to prevent cold start
```

**For your use case (sporadic traffic):**
- Cold starts are acceptable - users won't mind 2-3s wait
- Cost savings (~$50/month) outweigh slight latency
- Consider reserved concurrency only if it becomes a problem

---

## 10. Cost Breakdown

### Monthly Costs (Low, Sporadic Traffic)

| Service | Pricing | Your Estimate | Notes |
|---------|---------|---------------|-------|
| Lambda | $0.20 per 1M | FREE (1M free tier) | 100k requests = FREE |
| API Gateway | $3.50 per 1M | FREE (1M free tier) | 100k requests = FREE |
| RDS PostgreSQL | Free tier (12mo) | $0 | Then ~$50-70/month |
| S3 Storage | $0.023 per GB | $0.50 | ~20GB static assets + backups |
| Data Transfer | Varies | $1-5 | Frontend delivery |
| **TOTAL (Year 1)** | | **~$10-15/month** | With free tier |
| **TOTAL (Year 2+)** | | **~$60-100/month** | RDS becomes paid |

**vs Current Setup (Container 24/7):**
- Railway/Render: $7-10/month (cheapest)
- Fly.io: $3-5/month baseline
- EC2 t3.micro: FREE (eligible for 12 months)

**Verdict:** Serverless is cheaper only if you have truly sporadic traffic. With constant traffic, a cheap VPS is better.

---

## 11. Database Considerations

### RDS from Lambda

**Connection Pooling Challenge:**
- Each Lambda creates new DB connection
- At scale, this exhausts RDS connection limit
- Solution: Use RDS Proxy or pg-boss connection pool

```typescript
// Connection reuse across Lambda invocations
let pool: Pool;

export const getPool = () => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5  // Limit connections per Lambda instance
    });
  }
  return pool;
};
```

### VPC Requirements
Lambda needs to be in same VPC as RDS for security:
```yaml
Resources:
  AuthLoginFunction:
    Type: AWS::Serverless::Function
    Properties:
      VpcConfig:
        SecurityGroupIds:
          - !Ref LambdaSecurityGroup
        SubnetIds:
          - subnet-xxxxx
          - subnet-yyyyy
```

---

## 12. Migration Path: Phase by Phase

### Phase 1: Local Development Setup (1-2 hours)
- [ ] Install SAM CLI
- [ ] Create template.yaml with 2-3 Lambda functions
- [ ] Convert POST /api/auth/login to Lambda handler
- [ ] Test locally with SAM CLI + LocalStack
- [ ] Verify database connections work

### Phase 2: Convert All Routes (4-6 hours)
- [ ] Convert remaining auth routes
- [ ] Convert user routes
- [ ] Convert comment routes
- [ ] Convert admin routes
- [ ] Deploy to LocalStack and test end-to-end

### Phase 3: Frontend Integration (1-2 hours)
- [ ] Update API_BASE_URL configuration
- [ ] Build frontend as static site
- [ ] Deploy to S3 (LocalStack)
- [ ] Test full stack locally

### Phase 4: Production Deployment (1 hour)
- [ ] Create AWS account (free tier eligible)
- [ ] Deploy to AWS using SAM CLI
- [ ] Set up domain + CloudFront
- [ ] Monitor costs and performance

---

## 13. Tools Needed

```bash
# Install everything
brew install aws-cli aws-sam-cli
npm install -g aws-cdk

# Docker for LocalStack
docker --version
docker-compose --version
```

---

## 14. Risks & Considerations

| Risk | Mitigation |
|------|-----------|
| Cold starts (1-5s) | Acceptable for sporadic traffic |
| Vendor lock-in (AWS) | Code is portable, only IaC is AWS-specific |
| Debugging complexity | SAM CLI provides local debugging environment |
| Database connections | Use connection pooling + RDS Proxy at scale |
| Cost surprises | Free tier covers you for first 12 months |

---

## Conclusion

**Converting to serverless Lambda is viable if:**
✅ Traffic is truly sporadic (not constant)
✅ You can accept 1-3s cold starts
✅ You want minimal ops overhead
✅ You want to stay within AWS ecosystem

**Stick with containers if:**
❌ You have constant traffic
❌ You need sub-100ms responses
❌ You want complete cloud portability

**Next Steps:**
1. Decide if you want to proceed with full migration
2. If yes, I can help you set up SAM + template.yaml
3. I can convert a few routes first as proof-of-concept
4. Then migrate the rest of the backend

---

## References

- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [AWS Lambda Pricing](https://aws.amazon.com/lambda/pricing/)
- [Express to Lambda Migration Guide](https://aws.amazon.com/blogs/compute/migrating-express-applications-to-aws-lambda/)
- [LocalStack Documentation](https://docs.localstack.cloud/)
