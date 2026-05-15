# Workly Saloon — Backend API (Node.js · Express · TypeScript · Prisma · MySQL)

A production-ready backend system for **Workly Saloon**, featuring advanced role-based access control (RBAC), secure appointment booking, stylist scheduling, slot availability calculation, and layered service architecture.

This documentation is designed for **developers, DevOps engineers, and team members** to understand, run, extend, and deploy the system.

---

## 📌 Table of Contents

1. [Overview](#-1-overview)
2. [Features](#-2-features)
3. [System Architecture](#%EF%B8%8F-3-system-architecture)
4. [Folder Structure](#-4-folder-structure)
5. [Tech Stack](#%EF%B8%8F-5-tech-stack)
6. [Environment Setup](#-6-environment-setup)
7. [Database Schema (Prisma)](#%EF%B8%97%EF%B8%8F-7-database-schema-prisma)
8. [Seed Data](#-8-seed-data)
9. [Authentication](#-9-authentication)
10. [Advanced RBAC (Admin, Manager, Staff, Customer)](#%EF%B8%8F-10-advanced-rbac-role-based-access-control)
11. [Availability Logic](#-11-availability-logic-0900--2000)
12. [Appointment Booking Flow](#-12-appointment-booking-flow-with-transaction)
13. [API Endpoints](#-13-api-endpoints)
14. [Validation (Zod)](#-14-validation-zod)
15. [Error Handling](#-15-error-handling)
16. [Testing](#-16-testing-jest)
17. [Docker & Deployment](#-17-docker--deployment)
18. [Curl Examples](#-18-curl-examples)
19. [Production Notes](#-19-production-notes)
20. [Appendices](#-appendix-a--prisma-schema)

---

## 🎯 1. Overview

Workly Saloon Backend provides:

- Secure appointments
- Stylist roster management
- Role-based permissions
- Overlap-safe booking with Prisma Transactions
- Time-slot availability engine (09:00–20:00)
- JSON-based stylist workingHours + leaves
- Clean architecture: Controllers → Services → Routes

---

## ⭐ 2. Features

- **JWT Authentication**
- **Advanced RBAC (Admin, Manager, Staff, Customer)**
- **Appointment lifecycle**
- **Slot availability checker**
- **Reschedule & cancellation logic**
- **JSON roster management**
- **Prisma ORM + MySQL**
- **Zod input validation**
- **Jest tests**
- **Docker-ready deployment**

---

## 🏗️ 3. System Architecture

```
Frontend → Backend API → Prisma ORM → MySQL
```

```
    +------------------+
    |   Controllers    |
    +------------------+
    |      Services    |
    +------------------+
    |     Routes       |
    +------------------+
    | Middleware (Auth, RBAC, Errors)
    +------------------+
    | Prisma Client    |
    +------------------+
    | MySQL Database   |
    +------------------+
```

---

## 📁 4. Folder Structure

```
src/
  controllers/
  routes/
  services/
  middleware/
  schemas/
  utils/
  prisma.ts
prisma/
  schema.prisma
  seed.ts
tests/
docker-compose.yml
Dockerfile
README.md
```

---

## ⚙️ 5. Tech Stack

| Component | Technology |
|----------|------------|
| Runtime | Node.js |
| Backend | Express.js |
| Language | TypeScript |
| Database | MySQL |
| ORM | Prisma |
| Validation | Zod |
| Auth | JWT (jsonwebtoken) |
| Dev Runner | ts-node-dev |
| Testing | Jest |
| Containerization | Docker |

---

## 🔧 6. Environment Setup

### Step 1 — Copy env file

```bash
cp .env.example .env
```

### Step 2 — Install dependencies

```bash
npm install
```

### Step 3 — Prisma Client

```bash
npx prisma generate
```

### Step 4 — Run migrations

```bash
npx prisma migrate dev --name init
```

### Step 5 — Seed DB

```bash
npm run prisma:seed
```

### Step 6 — Start dev server

```bash
npm run dev
```

---

## 🗄️ 7. Database Schema (Prisma)

### Models Included

- Service
- Stylist
- Appointment
- AppointmentStatus enum

➡️ Full schema available in **[Appendix A](#-appendix-a--prisma-schema)**.

---

## 🌱 8. Seed Data

Seed script populates:

### 6 Services

- Haircut
- Beard Trim
- Facial
- Hair Spa
- Full Grooming
- Pedicure

### 4 Stylists

With:
- workingHours (JSON)
- leaves (JSON)
- rating
- role

---

## 🔐 9. Authentication

- JWT tokens required for protected routes
- Auth Microservice will supply tokens later
- For now → tokens are decoded locally using `JWT_SECRET`

Payload example:

```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "roles": ["customer"]
}
```

---

## 🛡️ 10. ADVANCED RBAC (Role-Based Access Control)

Role is stored inside JWT (`roles` array).

### Roles & Permissions

#### 👑 Admin

| Permission | Access |
|---------------------------|--------|
| Manage services | Yes |
| Manage stylists | Yes |
| Modify roster | Yes |
| View all appointments | Yes |
| Cancel/reschedule for ANY user | Yes |
| Access admin endpoints | Yes |

---

#### 🧑‍💼 Manager

| Permission | Access |
|---------------------------|--------|
| View all appointments | Yes |
| Update stylist roster | Yes |
| View sales metrics | Yes |
| Modify appointments of staff | No |
| Cancel appointments for customers | No |

---

#### 💇 Staff

| Permission | Access |
|---------------------------|--------|
| View OWN assigned appointments | Yes |
| Modify only appointments they service | Yes |
| See customer names | Yes |
| Manage stylists | No |
| Manage services | No |

---

#### 🧑 Customer

| Permission | Access |
|---------------------------|--------|
| Book appointments | Yes |
| Reschedule own appointments | Yes |
| Cancel own appointments | Yes |
| Access admin/staff endpoints | No |

---

### RBAC Middleware (Concept)

Routes use:

```ts
rbac(["admin", "manager"])
```

The middleware checks:

```ts
if (!req.user.roles.includes(anyAllowedRole)) → 403 Forbidden
```

---

## 🕒 11. Availability Logic (09:00 — 20:00)

### Slot generation rules:

- 30-minute intervals
- Start times: 09:00 → 19:30
- slotEnd = start + service.duration
- Must not overlap existing appointments
- Must not exceed working hours
- If stylist.isAvailable = false → all slots unavailable

### Overlap detection:

```
slotStart < appointment.endTime && slotEnd > appointment.startTime
```

---

## 📅 12. Appointment Booking Flow (with Transaction)

### Booking Steps

1. Validate input with Zod
2. Fetch service to get duration
3. Build startTime & endTime
4. **Open Prisma Transaction**
5. Check overlapping appointment
6. If overlap → throw 409
7. Create appointment
8. Return created booking

### Reschedule Steps

- Same as booking but excluding the appointment being edited

---

## 📚 13. API Endpoints

### Services

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/services` | public | List services |

---

### Stylists

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/stylists` | public | List stylists |
| PATCH | `/stylists/:id/roster` | admin, manager | Update roster JSON |

---

### Availability

| Method | Endpoint | Role |
|--------|----------|------|
| GET | `/availability` | customer, staff, manager, admin |

---

### Appointments

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/appointments` | customer | List own appointments |
| POST | `/appointments` | customer | Book appointment |
| GET | `/appointments/upcoming` | customer | Next appointment |
| PATCH | `/appointments/:id/cancel` | customer | Cancel own appt |
| PATCH | `/appointments/:id/reschedule` | customer | Move appointment |

Admins can call staff endpoints & override security.

---

## 🧪 14. Validation (Zod)

Examples:

### Appointment booking schema

```ts
{
  serviceId: uuid,
  stylistId: uuid,
  date: "YYYY-MM-DD",
  time: "HH:mm"
}
```

### Reschedule schema

```ts
{
  newDate: "YYYY-MM-DD",
  newTime: "HH:mm"
}
```

On invalid request → return:

```json
{
  "error": { ...zod structured errors... }
}
```

---

## ❗ 15. Error Handling

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Validation failed |
| 401 | Missing/invalid token |
| 403 | Not allowed (RBAC / owner check) |
| 404 | Resource not found |
| 409 | Booking conflict |
| 500 | Server error |

---

## 🧪 16. Testing (Jest)

Run tests:

```bash
npm test
```

Included tests:

- Slot overlap detection
- Slot generation boundaries

Recommended:

- Add DB-backed tests for concurrency
- Add RBAC tests

---

## 🐳 17. Docker & Deployment

### Start containers:

```bash
docker-compose up --build
```

Includes:

- MySQL container
- App container

### MySQL DB output:

```
mysql://root:root@db:3306/workly_saloon
```

---

## 🧪 18. Curl Examples

### Get availability

```bash
curl "http://localhost:4000/api/v1/availability?date=2025-12-10&stylistId=STY&serviceId=SER"
```

### Book appointment

```bash
curl -X POST http://localhost:4000/api/v1/appointments \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"serviceId":"SER","stylistId":"STY","date":"2025-12-12","time":"10:00"}'
```

### Get own appointments

```bash
curl http://localhost:4000/api/v1/appointments \
  -H "Authorization: Bearer TOKEN"
```

### Cancel appointment

```bash
curl -X PATCH http://localhost:4000/api/v1/appointments/APPT_ID/cancel \
  -H "Authorization: Bearer TOKEN"
```

### Reschedule appointment

```bash
curl -X PATCH http://localhost:4000/api/v1/appointments/APPT_ID/reschedule \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newDate":"2025-12-15","newTime":"14:00"}'
```

---

## 🧠 19. Production Notes

- Use **Asia/Kolkata timezone** in production
- Move JWT validation to Auth Microservice
- Add rate limiting for heavy traffic
- Activate query logging + monitoring
- Use HTTPS & secure cookies if deployed with frontend
- Enable Prisma connection pooling
- Set up database backups
- Configure CORS properly for frontend domain
- Use environment-specific `.env` files
- Enable logging with Winston or similar
- Set up health check endpoints

---

## 📎 Appendix A — Prisma Schema

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model Service {
  id          String        @id @default(uuid())
  name        String
  description String?       @db.Text
  duration    Int           // in minutes
  price       Float
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  appointments Appointment[]

  @@map("services")
}

model Stylist {
  id            String        @id @default(uuid())
  name          String
  email         String        @unique
  phone         String?
  specialization String?
  rating        Float?        @default(0)
  isAvailable   Boolean       @default(true)
  workingHours  Json?         // { "monday": { "start": "09:00", "end": "18:00" }, ... }
  leaves        Json?         // ["2025-12-25", "2025-12-26"]
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  appointments  Appointment[]

  @@map("stylists")
}

model Appointment {
  id          String            @id @default(uuid())
  userId      String            // From JWT
  serviceId   String
  stylistId   String
  startTime   DateTime
  endTime     DateTime
  status      AppointmentStatus @default(PENDING)
  notes       String?           @db.Text
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  service Service @relation(fields: [serviceId], references: [id])
  stylist Stylist @relation(fields: [stylistId], references: [id])

  @@index([userId])
  @@index([stylistId, startTime, endTime])
  @@map("appointments")
}

enum AppointmentStatus {
  PENDING
  CONFIRMED
  COMPLETED
  CANCELLED
}
```

---

## 📎 Appendix B — Seed Summary

### Services Created

1. **Haircut** — 30 min — ₹300
2. **Beard Trim** — 20 min — ₹150
3. **Facial** — 45 min — ₹800
4. **Hair Spa** — 60 min — ₹1200
5. **Full Grooming** — 90 min — ₹2000
6. **Pedicure** — 40 min — ₹600

### Stylists Created

1. **Rajesh Kumar** — Hair Specialist — 4.5★
2. **Priya Sharma** — Facial Expert — 4.8★
3. **Amit Patel** — Grooming Specialist — 4.6★
4. **Neha Singh** — Spa Therapist — 4.7★

Each stylist has:
- Working hours: Mon-Sat, 09:00-20:00
- Leaves: Sample dates
- isAvailable: true

---

## 📎 Appendix C — Create Fake JWT for Testing

Generate a test JWT token:

```bash
node -e "console.log(require('jsonwebtoken').sign({ userId: '11111111-1111-1111-1111-111111111111', email:'test@example.com', roles:['customer'] }, 'dev_secret'))"
```

Use in requests:

```bash
Authorization: Bearer <token>
```

### Example tokens for different roles:

**Customer:**
```bash
node -e "console.log(require('jsonwebtoken').sign({ userId: '11111111-1111-1111-1111-111111111111', email:'customer@example.com', roles:['customer'] }, 'dev_secret'))"
```

**Staff:**
```bash
node -e "console.log(require('jsonwebtoken').sign({ userId: '22222222-2222-2222-2222-222222222222', email:'staff@example.com', roles:['staff'] }, 'dev_secret'))"
```

**Manager:**
```bash
node -e "console.log(require('jsonwebtoken').sign({ userId: '33333333-3333-3333-3333-333333333333', email:'manager@example.com', roles:['manager'] }, 'dev_secret'))"
```

**Admin:**
```bash
node -e "console.log(require('jsonwebtoken').sign({ userId: '44444444-4444-4444-4444-444444444444', email:'admin@example.com', roles:['admin'] }, 'dev_secret'))"
```

---

## 📞 Support & Contributing

For issues, questions, or contributions:

1. Create an issue in the repository
2. Follow the coding standards
3. Write tests for new features
4. Update documentation

---

## 📄 License

This project is proprietary software for Workly Saloon.

---

**Built with ❤️ by the Workly Saloon Team**
#   s a l o n _ b e  
 