const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'restaurant.db');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database at:', dbPath);
        initDatabase();
    }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

function initDatabase() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const seedPath = path.join(__dirname, 'seed.sql');

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    const seedSql = fs.readFileSync(seedPath, 'utf8');

    db.exec(schemaSql, (err) => {
        if (err) {
            console.error('Error executing schema.sql:', err.message);
            return;
        }
        console.log('Database schema created/verified successfully.');

        db.exec(seedSql, (err) => {
            if (err) {
                console.error('Error executing seed.sql:', err.message);
                return;
            }
            console.log('Database seeded successfully.');
        });
    });
}

// Helper promises for async/await usage
function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

module.exports = {
    db,
    query,
    get,
    run
};
