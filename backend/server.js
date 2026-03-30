require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('../frontend/public'));

// ─── MongoDB Connection ───────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/employee_onboarding';
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB error:', err);
    process.exit(1);
  });

// ─── Schemas & Models ──────────────────────────────────────────────────────────
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'admin' }
}, { timestamps: true });

const employeeSchema = new mongoose.Schema({
  employeeId: { type: String, unique: true },
  username: { type: String, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  designation: { type: String, required: true },
  doj: { type: Date, required: true },
  location: { type: String, required: true },
  department: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

const Admin = mongoose.model('Admin', adminSchema);
const Employee = mongoose.model('Employee', employeeSchema);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateEmployeeId() {
  const prefix = 'EMP';
  const num = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}${num}`;
}

function generateUsername(name, empId) {
  const base = name.toLowerCase().replace(/\s+/g, '.').substring(0, 10);
  const suffix = empId.slice(-4);
  return `${base}.${suffix}`;
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$';
  return Array.from({length: 10}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function authMiddleware(roles = []) {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (roles.length && !roles.includes(decoded.role))
        return res.status(403).json({ error: 'Access denied' });
      req.user = decoded;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

// ─── Seed Admin (WAIT FOR CONNECTION) ────────────────────────────────────────
mongoose.connection.on('connected', async () => {
  console.log('🔗 Seeding admin...');
  try {
    const exists = await Admin.findOne({ username: 'admin' });
    if (!exists) {
      const hashed = await bcrypt.hash('Admin@123', 10);
      await Admin.create({ username: 'admin', password: hashed });
      console.log('🔑 Default admin created: admin / Admin@123');
    } else {
      console.log('👤 Admin already exists');
    }
  } catch (err) {
    console.error('❌ Seed error:', err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: admin._id, role: 'admin', username: admin.username }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, role: 'admin', username: admin.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Employee Login
app.post('/api/employee/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const emp = await Employee.findOne({ $or: [{ username }, { employeeId: username }] });
    if (!emp) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, emp.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: emp._id, role: 'employee', employeeId: emp.employeeId }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, role: 'employee', employeeId: emp.employeeId });
  } catch (err) {
    console.error('Employee login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/stats', authMiddleware(['admin']), async (req, res) => {
  try {
    const total = await Employee.countDocuments().catch(() => 0);
    const active = await Employee.countDocuments({ status: 'active' }).catch(() => 0);
    const inactive = total - active;
    const thisMonth = await Employee.countDocuments({
      createdAt: { $gte: new Date(new Date().setDate(1)) }
    }).catch(() => 0);
    
    let byDept = await Employee.aggregate([
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).catch(() => []);
    
    // 👇 FIX: Ensure proper format
    if (byDept.length === 0) {
      byDept = [{ _id: 'No departments', count: 0 }];
    }
    
    console.log('✅ Stats:', { total, active, byDept: byDept.map(d => ({ dept: d._id, count: d.count })) });
    res.json({ total, active, inactive, thisMonth, byDept });
  } catch (err) {
    console.error('❌ Stats error:', err);
    res.json({ total: 0, active: 0, inactive: 0, thisMonth: 0, byDept: [{ _id: 'No data', count: 0 }] });
  }
});


// ── Admin: Create Employee ────────────────────────────────────────────────────
app.post('/api/admin/employees', authMiddleware(['admin']), async (req, res) => {
  try {
    const { name, designation, doj, location, department, email, phone } = req.body;
    if (!name || !designation || !doj || !location || !department)
      return res.status(400).json({ error: 'Required fields missing' });

    const empId     = generateEmployeeId();
    const username  = generateUsername(name, empId);
    const plainPass = generatePassword();
    const hashed    = await bcrypt.hash(plainPass, 10);

    const emp = await Employee.create({
      employeeId: empId, username, password: hashed,
      name, designation, doj: new Date(doj), location, department, email, phone
    });

    res.status(201).json({
      message: 'Employee created successfully',
      credentials: { employeeId: empId, username, password: plainPass },
      employee: { ...emp.toObject(), password: undefined }
    });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Duplicate entry' });
    res.status(500).json({ error: err.message });
  }
});

// FIXED: Get All Employees (Safe empty array)
app.get('/api/admin/employees', authMiddleware(['admin']), async (req, res) => {
  try {
    console.log('👥 Employees requested');  // Debug
    const { search, dept, status } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { employeeId: new RegExp(search, 'i') },
        { designation: new RegExp(search, 'i') }
      ];
    }
    if (dept) query.department = dept;
    if (status) query.status = status;
    
    const employees = await Employee.find(query).select('-password').sort({ createdAt: -1 });
    console.log('✅ Employees sent:', employees.length);
    res.json(employees);
  } catch (err) {
    console.error('❌ Employees error:', err);
    res.json([]);  // SAFE EMPTY ARRAY
  }
});

// ── Admin: Get Single Employee ────────────────────────────────────────────────
app.get('/api/admin/employees/:id', authMiddleware(['admin']), async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id).select('-password');
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Update Employee ────────────────────────────────────────────────────
app.put('/api/admin/employees/:id', authMiddleware(['admin']), async (req, res) => {
  try {
    const { name, designation, doj, location, department, email, phone, status } = req.body;
    const emp = await Employee.findByIdAndUpdate(
      req.params.id,
      { name, designation, doj: doj ? new Date(doj) : undefined, location, department, email, phone, status },
      { new: true, runValidators: true }
    ).select('-password');
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    res.json({ message: 'Employee updated', employee: emp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Delete Employee ────────────────────────────────────────────────────
app.delete('/api/admin/employees/:id', authMiddleware(['admin']), async (req, res) => {
  try {
    const emp = await Employee.findByIdAndDelete(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    res.json({ message: 'Employee deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── Employee: Get Own Profile ─────────────────────────────────────────────────
app.get('/api/employee/profile', authMiddleware(['employee']), async (req, res) => {
  try {
    const emp = await Employee.findById(req.user.id).select('-password');
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Employee: Change Password ─────────────────────────────────────────────────
app.put('/api/employee/change-password', authMiddleware(['employee']), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Both passwords required' });
    if (newPassword.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const emp = await Employee.findById(req.user.id);
    const match = await bcrypt.compare(currentPassword, emp.password);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

    emp.password = await bcrypt.hash(newPassword, 10);
    await emp.save();
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on Port:${PORT}`));
