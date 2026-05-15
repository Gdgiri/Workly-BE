# 📮 Workly Salon Backend - Postman Collection Guide

## 🔧 Setup Instructions

### 1. Environment Variables (Postman)

Create a Postman Environment with these variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `base_url` | `http://localhost:4000/api/v1` | API base URL |
| `customer_token` | (generated below) | Customer JWT token |
| `admin_token` | (generated below) | Admin JWT token |
| `manager_token` | (generated below) | Manager JWT token |
| `staff_token` | (generated below) | Staff JWT token |
| `serviceId` | (from GET /services) | Sample service ID |
| `stylistId` | (from GET /stylists) | Sample stylist ID |
| `appointmentId` | (from POST /appointments) | Created appointment ID |

### 2. Generate JWT Tokens

Run these commands in your terminal to generate test tokens:

#### Customer Token:
```bash
node -e "console.log(require('jsonwebtoken').sign({ userId: '11111111-1111-1111-1111-111111111111', email:'customer@example.com', roles:['customer'] }, 'dev_secret', {expiresIn: '7d'}))"
```

#### Admin Token:
```bash
node -e "console.log(require('jsonwebtoken').sign({ userId: '44444444-4444-4444-4444-444444444444', email:'admin@example.com', roles:['admin'] }, 'dev_secret', {expiresIn: '7d'}))"
```

#### Manager Token:
```bash
node -e "console.log(require('jsonwebtoken').sign({ userId: '33333333-3333-3333-3333-333333333333', email:'manager@example.com', roles:['manager'] }, 'dev_secret', {expiresIn: '7d'}))"
```

#### Staff Token:
```bash
node -e "console.log(require('jsonwebtoken').sign({ userId: '22222222-2222-2222-2222-222222222222', email:'staff@example.com', roles:['staff'] }, 'dev_secret', {expiresIn: '7d'}))"
```

---

## 📋 API Endpoints

### 1️⃣ Health Check

#### GET `/health`
**Description:** Check if the API is running  
**Auth Required:** No

```json
// No body required
```

**Response (200):**
```json
{
  "status": "OK",
  "service": "Salon Backend"
}
```

---

## 🛍️ Services API

### 2️⃣ Get All Services

#### GET `/services`
**Description:** Get list of all available services  
**Auth Required:** No

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "Haircut",
    "description": "Professional haircut service",
    "duration": 30,
    "price": 300,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
]
```

### 3️⃣ Get Service By ID

#### GET `/services/:id`
**Description:** Get details of a specific service  
**Auth Required:** No

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Haircut",
  "description": "Professional haircut service",
  "duration": 30,
  "price": 300,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

---

## 💇 Stylists API

### 4️⃣ Get All Stylists

#### GET `/stylists`
**Description:** Get list of all stylists  
**Auth Required:** No

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "Rajesh Kumar",
    "email": "rajesh@salon.com",
    "phone": "+91-9876543210",
    "specialization": "Hair Specialist",
    "rating": 4.5,
    "isAvailable": true,
    "workingHours": {
      "monday": { "start": "09:00", "end": "20:00" },
      "tuesday": { "start": "09:00", "end": "20:00" },
      "wednesday": { "start": "09:00", "end": "20:00" },
      "thursday": { "start": "09:00", "end": "20:00" },
      "friday": { "start": "09:00", "end": "20:00" },
      "saturday": { "start": "09:00", "end": "20:00" }
    },
    "leaves": ["2025-12-25", "2025-12-26"],
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
]
```

### 5️⃣ Get Stylist By ID

#### GET `/stylists/:id`
**Description:** Get details of a specific stylist  
**Auth Required:** No

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Rajesh Kumar",
  "email": "rajesh@salon.com",
  "phone": "+91-9876543210",
  "specialization": "Hair Specialist",
  "rating": 4.5,
  "isAvailable": true,
  "workingHours": { ... },
  "leaves": ["2025-12-25"],
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

### 6️⃣ Update Stylist Roster

#### PATCH `/stylists/:id/roster`
**Description:** Update stylist working hours, leaves, or availability  
**Auth Required:** Yes (Admin, Manager)  
**Headers:**
```
Authorization: Bearer {{admin_token}}
Content-Type: application/json
```

**Request Body:**
```json
{
  "workingHours": {
    "monday": { "start": "10:00", "end": "18:00" },
    "tuesday": { "start": "10:00", "end": "18:00" },
    "wednesday": { "start": "10:00", "end": "18:00" },
    "thursday": { "start": "10:00", "end": "18:00" },
    "friday": { "start": "10:00", "end": "18:00" }
  },
  "leaves": ["2025-12-25", "2025-12-26", "2025-01-01"],
  "isAvailable": true
}
```

**Partial Update (Any field is optional):**
```json
{
  "isAvailable": false
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Rajesh Kumar",
  "workingHours": { ... },
  "leaves": ["2025-12-25", "2025-12-26", "2025-01-01"],
  "isAvailable": false,
  "updatedAt": "2025-01-01T12:00:00.000Z"
}
```

---

## 📅 Availability API

### 7️⃣ Get Available Slots

#### GET `/availability?date=YYYY-MM-DD&stylistId=uuid&serviceId=uuid`
**Description:** Get available time slots for booking  
**Auth Required:** Yes (All authenticated users)  
**Headers:**
```
Authorization: Bearer {{customer_token}}
```

**Query Parameters:**
- `date` (required): Date in YYYY-MM-DD format (e.g., 2025-12-10)
- `stylistId` (required): UUID of the stylist
- `serviceId` (required): UUID of the service

**Example Request:**
```
GET /availability?date=2025-12-10&stylistId=550e8400-e29b-41d4-a716-446655440000&serviceId=650e8400-e29b-41d4-a716-446655440000
```

**Response (200):**
```json
{
  "date": "2025-12-10",
  "stylistId": "uuid",
  "stylistName": "Rajesh Kumar",
  "serviceId": "uuid",
  "serviceName": "Haircut",
  "serviceDuration": 30,
  "availableSlots": [
    {
      "startTime": "09:00",
      "endTime": "09:30"
    },
    {
      "startTime": "09:30",
      "endTime": "10:00"
    },
    {
      "startTime": "10:00",
      "endTime": "10:30"
    }
  ]
}
```

**Response (200) - No Slots:**
```json
{
  "date": "2025-12-10",
  "stylistId": "uuid",
  "stylistName": "Rajesh Kumar",
  "serviceId": "uuid",
  "serviceName": "Haircut",
  "serviceDuration": 30,
  "availableSlots": [],
  "message": "No available slots for this date"
}
```

---

## 📆 Appointments API

### 8️⃣ Create Appointment (Book)

#### POST `/appointments`
**Description:** Book a new appointment  
**Auth Required:** Yes (Customer, Admin)  
**Headers:**
```
Authorization: Bearer {{customer_token}}
Content-Type: application/json
```

**Request Body:**
```json
{
  "serviceId": "650e8400-e29b-41d4-a716-446655440000",
  "stylistId": "550e8400-e29b-41d4-a716-446655440000",
  "date": "2025-12-10",
  "time": "10:00",
  "notes": "Please use organic products"
}
```

**Minimal Request (without notes):**
```json
{
  "serviceId": "650e8400-e29b-41d4-a716-446655440000",
  "stylistId": "550e8400-e29b-41d4-a716-446655440000",
  "date": "2025-12-10",
  "time": "10:00"
}
```

**Response (201):**
```json
{
  "id": "appointment-uuid",
  "userId": "11111111-1111-1111-1111-111111111111",
  "serviceId": "650e8400-e29b-41d4-a716-446655440000",
  "stylistId": "550e8400-e29b-41d4-a716-446655440000",
  "startTime": "2025-12-10T10:00:00.000Z",
  "endTime": "2025-12-10T10:30:00.000Z",
  "status": "PENDING",
  "notes": "Please use organic products",
  "createdAt": "2025-01-01T12:00:00.000Z",
  "updatedAt": "2025-01-01T12:00:00.000Z",
  "service": {
    "id": "650e8400-e29b-41d4-a716-446655440000",
    "name": "Haircut",
    "duration": 30,
    "price": 300
  },
  "stylist": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Rajesh Kumar",
    "specialization": "Hair Specialist"
  }
}
```

**Error (409) - Slot Not Available:**
```json
{
  "error": "The selected time slot is not available"
}
```

**Error (400) - Validation Error:**
```json
{
  "error": {
    "issues": [
      {
        "path": ["date"],
        "message": "Date must be in YYYY-MM-DD format"
      }
    ]
  }
}
```

### 9️⃣ Get User Appointments

#### GET `/appointments`
**Description:** Get all appointments for the authenticated user  
**Auth Required:** Yes (Customer, Admin)  
**Headers:**
```
Authorization: Bearer {{customer_token}}
```

**Response (200):**
```json
[
  {
    "id": "appointment-uuid",
    "userId": "11111111-1111-1111-1111-111111111111",
    "startTime": "2025-12-10T10:00:00.000Z",
    "endTime": "2025-12-10T10:30:00.000Z",
    "status": "PENDING",
    "notes": "Please use organic products",
    "createdAt": "2025-01-01T12:00:00.000Z",
    "service": {
      "id": "uuid",
      "name": "Haircut",
      "duration": 30,
      "price": 300
    },
    "stylist": {
      "id": "uuid",
      "name": "Rajesh Kumar",
      "specialization": "Hair Specialist"
    }
  }
]
```

### 🔟 Get Upcoming Appointment

#### GET `/appointments/upcoming`
**Description:** Get the next upcoming appointment  
**Auth Required:** Yes (Customer, Admin)  
**Headers:**
```
Authorization: Bearer {{customer_token}}
```

**Response (200):**
```json
{
  "id": "appointment-uuid",
  "userId": "11111111-1111-1111-1111-111111111111",
  "startTime": "2025-12-10T10:00:00.000Z",
  "endTime": "2025-12-10T10:30:00.000Z",
  "status": "PENDING",
  "notes": "Please use organic products",
  "service": {
    "name": "Haircut",
    "duration": 30,
    "price": 300
  },
  "stylist": {
    "name": "Rajesh Kumar",
    "specialization": "Hair Specialist"
  }
}
```

**Response (404) - No Upcoming Appointments:**
```json
{
  "error": "No upcoming appointments found"
}
```

### 1️⃣1️⃣ Cancel Appointment

#### PATCH `/appointments/:id/cancel`
**Description:** Cancel an existing appointment  
**Auth Required:** Yes (Customer, Admin)  
**Headers:**
```
Authorization: Bearer {{customer_token}}
```

**No Request Body Required**

**Response (200):**
```json
{
  "id": "appointment-uuid",
  "status": "CANCELLED",
  "startTime": "2025-12-10T10:00:00.000Z",
  "endTime": "2025-12-10T10:30:00.000Z",
  "updatedAt": "2025-01-01T12:30:00.000Z",
  "service": {
    "name": "Haircut"
  },
  "stylist": {
    "name": "Rajesh Kumar"
  }
}
```

**Error (403) - Not Owner:**
```json
{
  "error": "You can only cancel your own appointments"
}
```

**Error (400) - Already Cancelled:**
```json
{
  "error": "Appointment is already cancelled"
}
```

### 1️⃣2️⃣ Reschedule Appointment

#### PATCH `/appointments/:id/reschedule`
**Description:** Reschedule an existing appointment  
**Auth Required:** Yes (Customer, Admin)  
**Headers:**
```
Authorization: Bearer {{customer_token}}
Content-Type: application/json
```

**Request Body:**
```json
{
  "newDate": "2025-12-15",
  "newTime": "14:00"
}
```

**Response (200):**
```json
{
  "id": "appointment-uuid",
  "userId": "11111111-1111-1111-1111-111111111111",
  "startTime": "2025-12-15T14:00:00.000Z",
  "endTime": "2025-12-15T14:30:00.000Z",
  "status": "PENDING",
  "updatedAt": "2025-01-01T12:45:00.000Z",
  "service": {
    "name": "Haircut",
    "duration": 30,
    "price": 300
  },
  "stylist": {
    "name": "Rajesh Kumar"
  }
}
```

**Error (403) - Not Owner:**
```json
{
  "error": "You can only reschedule your own appointments"
}
```

**Error (409) - Slot Not Available:**
```json
{
  "error": "The selected time slot is not available"
}
```

---

## 🔑 Authentication & Authorization Errors

### 401 Unauthorized
```json
{
  "error": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "error": "You do not have permission to access this resource"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

---

## 📝 Test Flow Scenario

### Complete Booking Flow:

1. **GET `/services`** → Get serviceId
2. **GET `/stylists`** → Get stylistId
3. **GET `/availability?date=2025-12-10&stylistId=xxx&serviceId=yyy`** → Check available slots
4. **POST `/appointments`** → Book appointment (save appointmentId)
5. **GET `/appointments`** → Verify booking
6. **GET `/appointments/upcoming`** → See next appointment
7. **PATCH `/appointments/:id/reschedule`** → Change date/time
8. **PATCH `/appointments/:id/cancel`** → Cancel appointment

### Admin Flow:

1. Generate admin token
2. **PATCH `/stylists/:id/roster`** → Update stylist schedule
3. **GET `/availability`** → Verify changes reflected

---

## 🎯 Postman Tips

### Set Dynamic Variables:
After creating an appointment, add this to the **Tests** tab:
```javascript
if (pm.response.code === 201) {
    var response = pm.response.json();
    pm.environment.set("appointmentId", response.id);
}
```

After getting services:
```javascript
if (pm.response.code === 200) {
    var response = pm.response.json();
    if (response.length > 0) {
        pm.environment.set("serviceId", response[0].id);
    }
}
```

After getting stylists:
```javascript
if (pm.response.code === 200) {
    var response = pm.response.json();
    if (response.length > 0) {
        pm.environment.set("stylistId", response[0].id);
    }
}
```

---

## 🐛 Common Issues

### Issue: "Environment variable not found: DATABASE_URL"
**Solution:** Create `.env` file from `.env.example` and configure database connection

### Issue: "Invalid token" or "jwt malformed"
**Solution:** Regenerate JWT token with correct secret (should match JWT_SECRET in .env)

### Issue: "No available slots"
**Solution:** Check if:
- Date is in future
- Stylist is available (isAvailable = true)
- Stylist has working hours for that day
- Date is not in stylist's leaves
- Service duration fits within working hours

### Issue: "Slot not available" when booking
**Solution:** Double-check availability first, another user might have booked the slot

---

**Happy Testing! 🚀**
