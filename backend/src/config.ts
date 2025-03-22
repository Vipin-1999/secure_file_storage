// src/config.ts
import { MongoClient, GridFSBucket, Db } from 'mongodb';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json';
const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(serviceAccountPath), 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/securefiles';
const client = new MongoClient(mongoUri);

let gridFSBucket: GridFSBucket;
let db: Db;

async function connectDB() {
  await client.connect();
  db = client.db();
  gridFSBucket = new GridFSBucket(db, { bucketName: 'files' });
  console.log('MongoDB connected');
}

export { client, gridFSBucket, db, connectDB, admin };
