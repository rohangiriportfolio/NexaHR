# NexaHR — Employee Onboarding System

A full-stack employee onboarding platform with **Admin** and **Employee** panels.

---

## 🚀 Tech Stack
- **Backend**: Node.js + Express.js
- **Database**: MongoDB (via Mongoose)
- **Auth**: JWT + bcrypt
- **Frontend**: Vanilla HTML/CSS/JS (served statically)

---

## 📁 Project Structure
```
onboarding/
├── backend/
│   ├── server.js        # All API routes + logic
│   ├── .env             # Environment config
│   └── package.json
└── frontend/
    └── public/
        └── index.html   # Full SPA frontend
```

---

## ⚙️ Setup & Run

### Prerequisites
- Node.js v16+
- MongoDB running locally (`mongodb://localhost:27017`) **or** a MongoDB Atlas URI

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Configure environment
Edit `backend/.env`:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/employee_onboarding
JWT_SECRET=your_super_secret_key_change_in_production
```

### 3. Start the server
```bash
cd backend
node server.js
```

### 4. Open the app
Open your browser and go to:
```
http://localhost:5000
```

---

## 🔑 Default Credentials

| Role  | Username | Password  |
|-------|----------|-----------|
| Admin | `admin`  | `Admin@123` |

---

## 👤 Admin Panel Features
- **Dashboard Overview** — Total employees, active/inactive counts, new joinings this month, dept chart
- **Employee List** — Search, filter by department/status, view/edit/delete
- **Add Employee** — Creates account with auto-generated:
  - Employee ID (e.g. `EMP83921`)
  - Username (e.g. `priya.sharma.3921`)
  - Password (random, shown once)

## 👔 Employee Panel Features
- **My Profile** — View all personal and employment details (read-only)
- **Change Password** — Employees can only change their own password

---

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/login` | Admin login |
| POST | `/api/employee/login` | Employee login |

### Admin (requires admin token)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Dashboard statistics |
| GET | `/api/admin/employees` | List all employees |
| POST | `/api/admin/employees` | Create employee |
| GET | `/api/admin/employees/:id` | Get single employee |
| PUT | `/api/admin/employees/:id` | Update employee |
| DELETE | `/api/admin/employees/:id` | Delete employee |

### Employee (requires employee token)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/employee/profile` | Get own profile |
| PUT | `/api/employee/change-password` | Change own password |

---

## 🔒 Security Notes
- Passwords are hashed with **bcrypt** (salt rounds: 10)
- JWT tokens expire after **8 hours**
- Employees can **only** view their own data and change their password
- Admin has full CRUD access
