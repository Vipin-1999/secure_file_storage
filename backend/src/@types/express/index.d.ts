// src/@types/express/index.d.ts

declare namespace Express {
  export interface Request {
    user?: import("firebase-admin/auth").DecodedIdToken;
  }
}
