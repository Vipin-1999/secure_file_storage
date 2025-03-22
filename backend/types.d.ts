// types.d.ts

declare namespace Express {
  export interface Request {
    user?: import("firebase-admin/auth").DecodedIdToken;
  }
}

declare module "express-session" {
  export interface SessionData {
    userId?: string;
    createdAt?: Date;
  }
}
