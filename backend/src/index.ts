// src/index.ts
import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import cors from "cors";
import rateLimit from "express-rate-limit";
import csrf from "csurf";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import { connectDB, db } from "./config";
import fileRoutes from "./routes/files";
import { firebaseAuthMiddleware } from "./middlewares/auth";

dotenv.config();

const app = express();
const sessionMaxAge = 30 * 60 * 1000; // 30 minutes in ms

// Enable JSON parsing and configure CORS (allow credentials for cookie support)
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3000", // Frontend origin
    credentials: true,
  })
);

// Use cookie-parser.
app.use(cookieParser());

// --- Custom Session Middleware ---
// This middleware uses a "sid" cookie and stores session data in the "sessions" collection.
app.use(async (req: Request, res: Response, next: NextFunction) => {
  const sessionsCollection = db.collection("sessions");
  let sid = req.cookies.sid;
  if (!sid) {
    // No session cookie: create a new session.
    sid = crypto.randomBytes(16).toString("hex");
    res.cookie("sid", sid, {
      maxAge: sessionMaxAge,
      httpOnly: true,
      sameSite: "lax",
    });
    const sessionRecord = {
      sessionId: sid,
      createdAt: new Date(),
      lastAccess: new Date(),
    };
    await sessionsCollection.insertOne(sessionRecord);
    (req as any).session = sessionRecord;
  } else {
    // Load the session from DB.
    const sessionRecord = await sessionsCollection.findOne({ sessionId: sid });
    if (!sessionRecord) {
      // Create a new session if not found.
      sid = crypto.randomBytes(16).toString("hex");
      res.cookie("sid", sid, {
        maxAge: sessionMaxAge,
        httpOnly: true,
        sameSite: "lax",
      });
      const newSessionRecord = {
        sessionId: sid,
        createdAt: new Date(),
        lastAccess: new Date(),
      };
      await sessionsCollection.insertOne(newSessionRecord);
      (req as any).session = newSessionRecord;
    } else {
      // Update the session's lastAccess timestamp.
      await sessionsCollection.updateOne(
        { sessionId: sid },
        { $set: { lastAccess: new Date() } }
      );
      (req as any).session = sessionRecord;
    }
  }
  next();
});

// Rate limiting.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

// --- Exclude /api/create-session from CSRF protection ---
// The create-session route is placed before CSRF middleware so that the client can call it without a token.
app.post(
  "/api/create-session",
  firebaseAuthMiddleware,
  async (req: Request, res: Response) => {
    const sessionsCollection = db.collection("sessions");
    // Check if a valid session already exists on this device.
    if (req.cookies.sid && (req as any).session) {
      // Return the existing session info.
      const existing = (req as any).session;
      // Calculate expiry from lastAccess + sessionMaxAge.
      const expires = new Date(
        new Date(existing.lastAccess).getTime() + sessionMaxAge
      );
      return res.status(200).json({
        message: "Session already exists",
        cookieExpires: expires,
        session: existing,
      });
    }
    // Otherwise, create a new session.
    const newSid = crypto.randomBytes(16).toString("hex");
    res.cookie("sid", newSid, {
      maxAge: sessionMaxAge,
      httpOnly: true,
      sameSite: "lax",
    });
    const sessionRecord = {
      sessionId: newSid,
      createdAt: new Date(),
      lastAccess: new Date(),
    };
    await sessionsCollection.updateOne(
      {
        sessionId: (req as any).session ? (req as any).session.sessionId : null,
      },
      { $set: sessionRecord },
      { upsert: true }
    );
    (req as any).session = sessionRecord;
    res.status(200).json({
      message: "Session created",
      cookieExpires: new Date(Date.now() + sessionMaxAge),
      session: sessionRecord,
    });
  }
);

// Attach CSRF protection.
const csrfProtection = csrf();
app.use(csrfProtection);

/**
 * One-Device & Expired Session Enforcement Middleware
 *
 * Cleans up expired active session records and checks that the current session matches
 * the active session stored for the user.
 */
app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (req.user && (req as any).session) {
    const userId = req.user.uid;
    const activeSessions = db.collection("activeSessions");
    const now = Date.now();

    // Cleanup expired active sessions.
    await activeSessions.deleteMany({
      createdAt: { $lt: new Date(now - sessionMaxAge) },
    });

    const newSessionHeader = req.headers["x-new-session"];
    const record = await activeSessions.findOne({ userId });
    if (!record) {
      // No active session recorded: create one.
      await activeSessions.insertOne({
        userId,
        sessionId: (req as any).session.sessionId,
        createdAt: new Date(),
      });
    } else {
      if (new Date(now - sessionMaxAge) > new Date(record.createdAt)) {
        await activeSessions.deleteOne({ userId });
        return res.status(401).json({ error: "Session expired" });
      }
      if (newSessionHeader === "true") {
        await activeSessions.updateOne(
          { userId },
          {
            $set: {
              sessionId: (req as any).session.sessionId,
              createdAt: new Date(),
            },
          }
        );
      } else if (record.sessionId !== (req as any).session.sessionId) {
        return res.status(401).json({ error: "Session expired" });
      }
    }
  }
  next();
});

// Secure CSRF Token Endpoint.
app.get(
  "/api/csrf-token",
  firebaseAuthMiddleware,
  (req: Request, res: Response) => {
    res.json({ csrfToken: req.csrfToken() });
  }
);

// Session Info Endpoint: Returns remaining session time (in ms)
app.get(
  "/api/session-info",
  firebaseAuthMiddleware,
  (req: Request, res: Response) => {
    const sessionRecord = (req as any).session;
    if (sessionRecord && sessionRecord.lastAccess) {
      const expires = new Date(
        new Date(sessionRecord.lastAccess).getTime() + sessionMaxAge
      );
      const remaining = expires.getTime() - Date.now();
      res.json({ remaining });
    } else {
      res.json({ remaining: 0 });
    }
  }
);

// Protect file routes.
app.use("/api/files", firebaseAuthMiddleware, fileRoutes);

connectDB()
  .then(() => {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(console.error);

export default app;
