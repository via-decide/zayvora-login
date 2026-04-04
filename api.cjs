const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt'); // For password hashing
const crypto = require('crypto'); // For generating reset tokens
const nodemailer = require('nodemailer'); // For sending emails
const multer = require('multer'); // For file uploads
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        // Accept images and PDFs
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only images and PDFs are allowed for Student ID.'));
        }
    }
});

// Database connection pool
const pool = new Pool({
    user: process.env.DB_USER || 'your_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'api_db',
    password: process.env.DB_PASSWORD || 'your_password',
    port: process.env.DB_PORT || 5432,
});

// Email Transporter Configuration
// For production, configure with real SMTP credentials via environment variables.
// For development without credentials, it falls back to a mock/ethereal account if possible,
// or just logs if not configured.
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: process.env.SMTP_PORT || 587,
    auth: {
        user: process.env.SMTP_USER || 'ethereal.user@ethereal.email',
        pass: process.env.SMTP_PASS || 'ethereal_password'
    }
});

// Initialize database tables if they don't exist
const initDb = async () => {
    try {
        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id_file VARCHAR(255);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified_student BOOLEAN DEFAULT FALSE;
            
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                token VARCHAR(255) NOT NULL UNIQUE,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens (token);
        `);
        console.log('Database initialized.');
    } catch (err) {
        console.error('Error initializing database:', err);
    }
};
initDb();

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.static(__dirname));

// --- Helper Functions ---

/**
 * Logs an activity to the activity_log table.
 * @param {number} userId - The ID of the user performing the action.
 * @param {string} action - Description of the action (e.g., 'user_created', 'item_updated').
 * @param {string} [entityType] - The type of entity involved (e.g., 'user', 'item').
 * @param {number} [entityId] - The ID of the entity involved.
 * @param {object} [details] - Additional details as a JSONB object.
 */
async function logActivity(userId, action, entityType = null, entityId = null, details = {}) {
    try {
        await pool.query(
            'INSERT INTO activity_log (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
            [userId, action, entityType, entityId, details]
        );
    } catch (error) {
        console.error('Failed to log activity:', error.message);
        // Do not re-throw, activity logging should not block main operations
    }
}

// --- Authentication Middleware (Simplified) ---
// In a real application, this would involve JWTs or session management.
// For this exercise, we'll simulate `req.userId` based on a prior login or a header.
// This middleware is a placeholder. For now, we'll assume `req.userId` is set for authenticated routes,
// or that some routes are public.

// Placeholder for a very basic authentication middleware
// In a real app, this would verify a token or session.
// For demonstration, we'll assume a `x-user-id` header is present for authenticated requests.
// This is NOT secure and for demonstration purposes ONLY.
const authenticateUser = async (req, res, next) => {
    const userIdHeader = req.headers['x-user-id'];
    if (!userIdHeader) {
        // For development, allow some public access or assume user 1 for simplicity if no header
        // For production, this should be an immediate 401
        // console.warn('x-user-id header missing. Proceeding without authentication for development.');
        // req.userId = 1; // Default to user 1 for easier testing
        return res.status(401).json({ message: 'Authentication required. Please provide x-user-id header.' });
    }

    try {
        const userId = parseInt(userIdHeader, 10);
        if (isNaN(userId)) {
            return res.status(400).json({ message: 'Invalid x-user-id header.' });
        }
        const result = await pool.query('SELECT id, is_admin FROM users WHERE id = $1 AND is_active = TRUE', [userId]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid or inactive user ID.' });
        }
        req.userId = userId;
        req.isAdmin = result.rows[0].is_admin;
        next();
    } catch (error) {
        console.error('Authentication error:', error.message);
        res.status(500).json({ message: 'Server error during authentication.' });
    }
};

const authorizeAdmin = (req, res, next) => {
    if (!req.isAdmin) {
        return res.status(403).json({ message: 'Admin access required.' });
    }
    next();
};

// --- API Routes ---

// --- User Management ---

// POST /api/register - Register a new user
app.post('/api/register', upload.single('studentId'), async (req, res) => {
    const { email, password, first_name, last_name } = req.body;
    const studentIdFile = req.file;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    // Validate Indian University Email
    const lowerEmail = email.toLowerCase();
    if (!lowerEmail.endsWith('.ac.in') && !lowerEmail.endsWith('.edu.in')) {
        return res.status(400).json({ message: 'Only Indian university emails (.ac.in or .edu.in) are acceptable.' });
    }

    if (!studentIdFile) {
        return res.status(400).json({ message: 'Student ID document (image or PDF) is required for verification.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10); // Hash password with salt rounds
        const filePath = studentIdFile.filename;
        
        // In a real application, you would run OCR or manual verification here.
        // For now, we assume uploading the file marks them as verified or pending verification.
        // We'll set is_verified_student to true for demonstration.
        const isVerified = true; 

        const result = await pool.query(
            'INSERT INTO users (email, password_hash, first_name, last_name, student_id_file, is_verified_student) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, first_name, last_name, is_admin, is_verified_student',
            [email, hashedPassword, first_name, last_name, filePath, isVerified]
        );
        const newUser = result.rows[0];
        await logActivity(newUser.id, 'user_registered', 'user', newUser.id);
        res.status(201).json({ message: 'User registered and verified successfully!', user: newUser });
    } catch (error) {
        if (error.code === '23505') { // Unique violation for email
            return res.status(409).json({ message: 'Email already exists.' });
        }
        console.error('Error registering user:', error.message);
        res.status(500).json({ message: 'Error registering user.' });
    }
});

// POST /api/login - Authenticate a user
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        const result = await pool.query('SELECT id, password_hash, is_active FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user || !user.is_active) {
            return res.status(401).json({ message: 'Invalid credentials or inactive account.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // In a real app, you'd generate a JWT or set a session.
        // For this demo, we'll just return the user ID. The client should then use x-user-id header.
        await logActivity(user.id, 'user_logged_in', 'user', user.id);
        res.json({ message: 'Login successful!', userId: user.id });
    } catch (error) {
        console.error('Error logging in user:', error.message);
        res.status(500).json({ message: 'Error logging in user.' });
    }
});

// POST /api/forgot-password - Request a password reset
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    try {
        const result = await pool.query('SELECT id FROM users WHERE email = $1 AND is_active = TRUE', [email]);
        const user = result.rows[0];

        if (!user) {
            // To prevent email enumeration, return success even if user not found
            return res.json({ message: 'If that email is registered, a reset link has been sent.' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

        await pool.query(
            'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, token, expiresAt]
        );

        const resetLink = `http://localhost:3000/?token=${token}`;
        
        // Send email using nodemailer
        try {
            await transporter.sendMail({
                from: process.env.EMAIL_FROM || '"App Support" <support@example.com>',
                to: email,
                subject: 'Password Reset Request',
                text: `You requested a password reset. Click the link to reset your password: ${resetLink}`,
                html: `<p>You requested a password reset.</p><p>Click the link below to reset your password:</p><a href="${resetLink}">${resetLink}</a>`
            });
            console.log(`Password reset email sent to ${email}`);
        } catch (emailError) {
            console.error('Failed to send password reset email:', emailError);
            // We might still want to return success to the user so they don't know if the email failed
            // or we could return an error. Usually, we just log it and return success to prevent enumeration.
        }

        await logActivity(user.id, 'password_reset_requested', 'user', user.id);
        res.json({ message: 'If that email is registered, a reset link has been sent.', _mockToken: token }); // _mockToken for testing purposes
    } catch (error) {
        console.error('Error in forgot password:', error.message);
        res.status(500).json({ message: 'Error processing request.' });
    }
});

// POST /api/reset-password - Reset password using token
app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token and new password are required.' });
    }

    try {
        const result = await pool.query(
            'SELECT user_id FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW()',
            [token]
        );
        const resetRecord = result.rows[0];

        if (!resetRecord) {
            return res.status(400).json({ message: 'Invalid or expired reset token.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password and invalidate token in a transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, resetRecord.user_id]);
            await client.query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        await logActivity(resetRecord.user_id, 'password_reset_completed', 'user', resetRecord.user_id);
        res.json({ message: 'Password has been successfully reset.' });
    } catch (error) {
        console.error('Error resetting password:', error.message);
        res.status(500).json({ message: 'Error resetting password.' });
    }
});

// GET /api/users - Get all users (Admin only)
app.get('/api/users', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, email, first_name, last_name, is_admin, is_active, created_at FROM users');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching users:', error.message);
        res.status(500).json({ message: 'Error fetching users.' });
    }
});

// GET /api/users/:id - Get a specific user (Admin or self)
app.get('/api/users/:id', authenticateUser, async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid user ID.' });
    }

    // Allow admin to fetch any user, or a user to fetch their own profile
    if (req.userId !== userId && !req.isAdmin) {
        return res.status(403).json({ message: 'Access denied. You can only view your own profile.' });
    }

    try {
        const result = await pool.query(
            'SELECT id, email, first_name, last_name, is_admin, is_active, created_at FROM users WHERE id = $1',
            [userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching user:', error.message);
        res.status(500).json({ message: 'Error fetching user.' });
    }
});

// PUT /api/users/:id - Update a user (Admin or self)
app.put('/api/users/:id', authenticateUser, async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const { email, first_name, last_name, is_admin, is_active } = req.body;
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid user ID.' });
    }

    // Allow admin to update any user, or a user to update their own profile (limited fields)
    if (req.userId !== userId && !req.isAdmin) {
        return res.status(403).json({ message: 'Access denied. You can only update your own profile.' });
    }

    if (email !== undefined) {
        updates.push(`email = $${paramIndex++}`);
        values.push(email);
    }
    if (first_name !== undefined) {
        updates.push(`first_name = $${paramIndex++}`);
        values.push(first_name);
    }
    if (last_name !== undefined) {
        updates.push(`last_name = $${paramIndex++}`);
        values.push(last_name);
    }
    // Only admin can change is_admin or is_active status
    if (req.isAdmin) {
        if (is_admin !== undefined) {
            updates.push(`is_admin = $${paramIndex++}`);
            values.push(is_admin);
        }
        if (is_active !== undefined) {
            updates.push(`is_active = $${paramIndex++}`);
            values.push(is_active);
        }
    } else {
        if (is_admin !== undefined || is_active !== undefined) {
            return res.status(403).json({ message: 'Access denied. Only admins can change `is_admin` or `is_active`.' });
        }
    }

    if (updates.length === 0) {
        return res.status(400).json({ message: 'No update fields provided.' });
    }

    values.push(userId); // Add user ID for WHERE clause
    const query = `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING id, email, first_name, last_name, is_admin, is_active`;

    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        await logActivity(req.userId, 'user_updated', 'user', userId, req.body);
        res.json({ message: 'User updated successfully!', user: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') { // Unique violation for email
            return res.status(409).json({ message: 'Email already exists.' });
        }
        console.error('Error updating user:', error.message);
        res.status(500).json({ message: 'Error updating user.' });
    }
});

// DELETE /api/users/:id - Delete a user (Admin only)
app.delete('/api/users/:id', authenticateUser, authorizeAdmin, async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid user ID.' });
    }

    // Prevent admin from deleting themselves
    if (req.userId === userId) {
        return res.status(403).json({ message: 'You cannot delete your own admin account.' });
    }

    try {
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        await logActivity(req.userId, 'user_deleted', 'user', userId);
        res.json({ message: 'User deleted successfully!' });
    } catch (error) {
        console.error('Error deleting user:', error.message);
        res.status(500).json({ message: 'Error deleting user.' });
    }
});

// --- Item Management ---

// POST /api/items - Create a new item
app.post('/api/items', authenticateUser, async (req, res) => {
    const { title, description, status } = req.body;
    const userId = req.userId; // User ID from authentication middleware

    if (!title) {
        return res.status(400).json({ message: 'Item title is required.' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO items (user_id, title, description, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [userId, title, description, status || 'draft']
        );
        const newItem = result.rows[0];
        await logActivity(userId, 'item_created', 'item', newItem.id, { title: newItem.title });
        res.status(201).json({ message: 'Item created successfully!', item: newItem });
    } catch (error) {
        console.error('Error creating item:', error.message);
        res.status(500).json({ message: 'Error creating item.' });
    }
});

// GET /api/items - Get all items (Admin) or items by authenticated user
app.get('/api/items', authenticateUser, async (req, res) => {
    try {
        let query = 'SELECT * FROM items';
        const values = [];

        if (!req.isAdmin) {
            query += ' WHERE user_id = $1';
            values.push(req.userId);
        }

        query += ' ORDER BY created_at DESC';
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching items:', error.message);
        res.status(500).json({ message: 'Error fetching items.' });
    }
});

// GET /api/items/:id - Get a specific item
app.get('/api/items/:id', authenticateUser, async (req, res) => {
    const itemId = parseInt(req.params.id, 10);
    if (isNaN(itemId)) {
        return res.status(400).json({ message: 'Invalid item ID.' });
    }

    try {
        const result = await pool.query('SELECT * FROM items WHERE id = $1', [itemId]);
        const item = result.rows[0];

        if (!item) {
            return res.status(404).json({ message: 'Item not found.' });
        }

        // Only owner or admin can view the item
        if (item.user_id !== req.userId && !req.isAdmin) {
            return res.status(403).json({ message: 'Access denied. You do not own this item.' });
        }

        res.json(item);
    } catch (error) {
        console.error('Error fetching item:', error.message);
        res.status(500).json({ message: 'Error fetching item.' });
    }
});

// PUT /api/items/:id - Update an item
app.put('/api/items/:id', authenticateUser, async (req, res) => {
    const itemId = parseInt(req.params.id, 10);
    const { title, description, status } = req.body;
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (isNaN(itemId)) {
        return res.status(400).json({ message: 'Invalid item ID.' });
    }

    if (title !== undefined) {
        updates.push(`title = $${paramIndex++}`);
        values.push(title);
    }
    if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description);
    }
    if (status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        values.push(status);
    }

    if (updates.length === 0) {
        return res.status(400).json({ message: 'No update fields provided.' });
    }

    try {
        // First, check if the item exists and the user has permission
        const checkResult = await pool.query('SELECT user_id FROM items WHERE id = $1', [itemId]);
        const item = checkResult.rows[0];

        if (!item) {
            return res.status(404).json({ message: 'Item not found.' });
        }

        // Only owner or admin can update the item
        if (item.user_id !== req.userId && !req.isAdmin) {
            return res.status(403).json({ message: 'Access denied. You do not own this item.' });
        }

        values.push(itemId); // Add item ID for WHERE clause
        const query = `UPDATE items SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING *`;

        const result = await pool.query(query, values);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Item not found (after permission check).' }); // Should not happen if check passed
        }
        await logActivity(req.userId, 'item_updated', 'item', itemId, req.body);
        res.json({ message: 'Item updated successfully!', item: result.rows[0] });
    } catch (error) {
        console.error('Error updating item:', error.message);
        res.status(500).json({ message: 'Error updating item.' });
    }
});

// DELETE /api/items/:id - Delete an item
app.delete('/api/items/:id', authenticateUser, async (req, res) => {
    const itemId = parseInt(req.params.id, 10);
    if (isNaN(itemId)) {
        return res.status(400).json({ message: 'Invalid item ID.' });
    }

    try {
        // First, check if the item exists and the user has permission
        const checkResult = await pool.query('SELECT user_id FROM items WHERE id = $1', [itemId]);
        const item = checkResult.rows[0];

        if (!item) {
            return res.status(404).json({ message: 'Item not found.' });
        }

        // Only owner or admin can delete the item
        if (item.user_id !== req.userId && !req.isAdmin) {
            return res.status(403).json({ message: 'Access denied. You do not own this item.' });
        }

        const result = await pool.query('DELETE FROM items WHERE id = $1 RETURNING id', [itemId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Item not found (after permission check).' }); // Should not happen
        }
        await logActivity(req.userId, 'item_deleted', 'item', itemId);
        res.json({ message: 'Item deleted successfully!' });
    } catch (error) {
        console.error('Error deleting item:', error.message);
        res.status(500).json({ message: 'Error deleting item.' });
    }
});

// --- Settings Management ---

// GET /api/settings - Get all settings for the authenticated user
app.get('/api/settings', authenticateUser, async (req, res) => {
    try {
        const result = await pool.query('SELECT setting_key, setting_value FROM settings WHERE user_id = $1', [req.userId]);
        const settings = result.rows.reduce((acc, row) => {
            acc[row.setting_key] = row.setting_value;
            return acc;
        }, {});
        res.json(settings);
    } catch (error) {
        console.error('Error fetching settings:', error.message);
        res.status(500).json({ message: 'Error fetching settings.' });
    }
});

// POST /api/settings - Create or update settings for the authenticated user
// This route can handle multiple settings in one go, or a single setting.
app.post('/api/settings', authenticateUser, async (req, res) => {
    const { setting_key, setting_value, settings } = req.body;
    const userId = req.userId;

    if (!setting_key && !settings) {
        return res.status(400).json({ message: 'Please provide `setting_key` and `setting_value` or a `settings` object.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let updatedKeys = [];
        if (setting_key && setting_value !== undefined) {
            await client.query(
                'INSERT INTO settings (user_id, setting_key, setting_value) VALUES ($1, $2, $3) ON CONFLICT (user_id, setting_key) DO UPDATE SET setting_value = $3, updated_at = CURRENT_TIMESTAMP',
                [userId, setting_key, setting_value]
            );
            updatedKeys.push(setting_key);
        }

        if (settings && typeof settings === 'object') {
            for (const key in settings) {
                if (Object.prototype.hasOwnProperty.call(settings, key)) {
                    await client.query(
                        'INSERT INTO settings (user_id, setting_key, setting_value) VALUES ($1, $2, $3) ON CONFLICT (user_id, setting_key) DO UPDATE SET setting_value = $3, updated_at = CURRENT_TIMESTAMP',
                        [userId, key, settings[key]]
                    );
                    updatedKeys.push(key);
                }
            }
        }

        await client.query('COMMIT');
        await logActivity(userId, 'user_settings_updated', 'user', userId, { updated_keys: updatedKeys });
        res.status(200).json({ message: 'Settings updated successfully!', updatedKeys });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating settings:', error.message);
        res.status(500).json({ message: 'Error updating settings.' });
    } finally {
        client.release();
    }
});

// GET /api/settings/:key - Get a specific setting for the authenticated user
app.get('/api/settings/:key', authenticateUser, async (req, res) => {
    const settingKey = req.params.key;

    try {
        const result = await pool.query('SELECT setting_value FROM settings WHERE user_id = $1 AND setting_key = $2', [req.userId, settingKey]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Setting not found.' });
        }
        res.json({ [settingKey]: result.rows[0].setting_value });
    } catch (error) {
        console.error('Error fetching setting:', error.message);
        res.status(500).json({ message: 'Error fetching setting.' });
    }
});

// DELETE /api/settings/:key - Delete a specific setting for the authenticated user
app.delete('/api/settings/:key', authenticateUser, async (req, res) => {
    const settingKey = req.params.key;

    try {
        const result = await pool.query('DELETE FROM settings WHERE user_id = $1 AND setting_key = $2 RETURNING setting_key', [req.userId, settingKey]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Setting not found.' });
        }
        await logActivity(req.userId, 'user_setting_deleted', 'user', req.userId, { deleted_key: settingKey });
        res.json({ message: `Setting '${settingKey}' deleted successfully!` });
    } catch (error) {
        console.error('Error deleting setting:', error.message);
        res.status(500).json({ message: 'Error deleting setting.' });
    }
});


// --- Activity Log (Read-only for users, Admin can see all) ---

// GET /api/activity_log - Get activity logs (Admin for all, user for self)
app.get('/api/activity_log', authenticateUser, async (req, res) => {
    try {
        let query = 'SELECT * FROM activity_log';
        const values = [];

        if (!req.isAdmin) {
            query += ' WHERE user_id = $1';
            values.push(req.userId);
        }

        query += ' ORDER BY created_at DESC LIMIT 100'; // Limit to recent 100 entries for performance
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching activity log:', error.message);
        res.status(500).json({ message: 'Error fetching activity log.' });
    }
});


// --- Global Error Handling Middleware ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something broke!', error: err.message });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    await pool.end();
    console.log('Database pool closed.');
    process.exit(0);
});
