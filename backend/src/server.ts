import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { query } from './db.ts'; 
import { initializeDatabase } from './schema.ts';

// Route Imports
import { authRoutes } from './routes/authRoutes.ts';
import { userRoutes } from './routes/userRoutes.ts';
import { photoRoutes } from './routes/photoRoutes.ts';
import { schoolRoutes } from './routes/schoolRoutes.ts';
import { classRoutes } from './routes/classRoutes.ts';
import { adminRoutes } from './routes/adminRoutes.ts';
import { commentRoutes } from './routes/commentRoutes.ts';
import { adminSchoolRoutes } from './routes/adminSchoolRoutes.ts';
import { adminClassRoutes } from './routes/adminClassRoutes.ts';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.BACKEND_PORT || 5001;
const corsOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';

console.log('🔧 CORS Origin:', corsOrigin);

// 1. Global Middleware
app.use(cors({
  origin: corsOrigin,
  credentials: true
}));

app.use(express.json());

// 2. API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/users', photoRoutes);
app.use('/api/users', commentRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/schools', adminSchoolRoutes);
app.use('/api/admin/classes', adminClassRoutes);

// 3. Database Connection & Server Initialization
(async () => {
  try {
    console.log("🔄 Testing database connectivity...");
    await query('SELECT NOW()'); 
    
    // 🚨 2. Add this line here to build the tables if they don't exist
    await initializeDatabase(); 
    
    app.listen(port, () => {
      console.log(`✅ Backend server safely listening at http://localhost:${port}`);
    });
  } catch (error: any) {
    console.error("❌ Database connection failed at startup!");
    console.error(`Reason: ${error.message}`);
  }
})();