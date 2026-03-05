"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDb = exports.getDb = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const path_1 = __importDefault(require("path"));
let db;
const getDb = async () => {
    if (db)
        return db;
    db = await (0, sqlite_1.open)({
        filename: path_1.default.join(__dirname, '../../database.sqlite'),
        driver: sqlite3_1.default.Database
    });
    // Enable Write-Ahead Logging (WAL) for high concurrency and reliability
    // This prevents SQLITE_BUSY locking errors during parallel webhook ingestion
    await db.exec('PRAGMA journal_mode = WAL;');
    await db.exec('PRAGMA synchronous = NORMAL;');
    return db;
};
exports.getDb = getDb;
const initDb = async () => {
    const database = await (0, exports.getDb)();
    // Create tables for persistent sessions and contexts
    await database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      auth_token TEXT,
      project_context TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      role TEXT,
      content TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(session_id) REFERENCES sessions(id)
    );
  `);
    console.log("Database initialized with sessions and messages tables.");
};
exports.initDb = initDb;
