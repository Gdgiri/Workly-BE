import express, { Request, Response } from 'express';
import cors, { CorsOptions } from 'cors';
import dotenv from 'dotenv';
import routes from './routes';
import prisma from './prisma';
import redirectRoutes from './routes/redirect.routes';
const fs = require('fs');
fs.writeFileSync('HEARTBEAT.txt', `Backend alive at ${new Date().toISOString()}`);
// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Allowed origins (NO trailing slash)
const allowedOrigins: string[] = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:4000',
    'http://localhost:3001',
    'http://localhost:5179',
    'http://localhost:8000',
    'https://salon-user-fe.vercel.app',
    'https://saloon-admin-fe.vercel.app',
    'https://salon-backend-2-lh77.onrender.com',
    'https://wkadmin.netlify.app',
    'https://wkuser.netlify.app',
    'https://worklyfeam.netlify.app',
    'https://worklyfeadmin.vercel.app',
    'https://agently-fe-six.vercel.app',
    'https://workly-front-end-admin.vercel.app',
    'https://wkuser.businessongo.com',
    'https://workly.businessongo.com',
    'https://worklyfe.netlify.app'
];

// CORS options (TypeScript safe)
const corsOptions: CorsOptions = {
    origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void
    ) => {
        const isDevelopment = process.env.NODE_ENV === 'development';
        const isAllowed = origin ? allowedOrigins.includes(origin) : false;

        if (!origin || isDevelopment) {
            // In development, allow everything to prevent teammate blockage
            if (!origin) console.debug('Allowing request with no origin');
            else if (!isAllowed) console.warn('⚠️ Development mode: allowing origin:', origin);
            return callback(null, true);
        }

        if (isAllowed) {
            callback(null, true);
        } else {
            console.error('❌ CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'x-business-name', 'x-app-id', 'ngrok-skip-browser-warning'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    optionsSuccessStatus: 200,
    maxAge: 86400 // 24 hours
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use('/api/v1', routes);
// Public redirect routes (no auth required) - MUST be LAST to catch short codes
// This handles URLs like: http://localhost:5000/buyh8e
app.use('/', redirectRoutes);
// Base route
app.get('/', (req: Request, res: Response) => {
    res.json({ message: 'Welcome to Salon Backend API' });
});

// Start server
const startServer = async (): Promise<void> => {
    try {
        await prisma.$connect();
        console.log('✅ Database connected successfully');

        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('❌ Server startup error:', error);
        process.exit(1);
    }
};

startServer();






// // Force reload
// import express from 'express';
// import cors, { CorsOptions } from 'cors';

// import cors from 'cors';
// import dotenv from 'dotenv';
// import routes from './routes';
// import prisma from './prisma';

// // Load environment variables
// dotenv.config();

// const app = express();
// const PORT = process.env.PORT || 5000;

// const allowedOrigins = [
//     'http://localhost:3000',
//     'http://localhost:5173',
//     'http://localhost:5174',
//     'http://localhost:4000',
//     'http://localhost:3001',
//     'https://salon-user-fe.vercel.app/',
//     'https://saloon-admin-fe.vercel.app/',
//     'https://salon-backend-2-lh77.onrender.com/'

// ];

// const corsOptions = {
//     origin: function (origin, callback) {
//         // Allow requests with no origin (like mobile apps, Postman, curl)
//         if (!origin) return callback(null, true);

//         if (allowedOrigins.indexOf(origin) !== -1) {
//             callback(null, true);
//         } else {
//             console.log('CORS blocked origin:', origin);
//             callback(new Error('Not allowed by CORS'));
//         }
//     },
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
//     exposedHeaders: ['Content-Range', 'X-Content-Range'],
//     optionsSuccessStatus: 200,
//     maxAge: 86400 // 24 hours
// };

// // Middleware
// app.use(cors(corsOptions));
// // app.use(cors());
// app.use(express.json());

// // Routes
// app.use('/api/v1', routes);

// // Base route
// app.get('/', (req, res) => {
//     res.json({ message: 'Welcome to Salon Backend API' });
// });

// // Start server
// const startServer = async () => {
//     try {
//         // Connect to database
//         await prisma.$connect();
//         console.log('✅ Database connected successfully');

//         app.listen(PORT, () => {
//             console.log(`🚀 Server running on port ${PORT}`);
//         });
//     } catch (error) {
//         console.error('❌ Server startup error:', error);
//         process.exit(1);
//     }
// };

// startServer();
