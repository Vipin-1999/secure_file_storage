// src/routes/files.ts
import { Router, Request, Response } from "express";
import multer from "multer";
import { gridFSBucket, db } from "../config";
import {
  generateKey,
  generateIV,
  encryptBuffer,
  decryptBuffer,
} from "../utils/encryption";
import { ObjectId } from "mongodb";
import crypto from "crypto";

// Use memory storage with file size limit 50MB.
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

const router = Router();

// Helper to obtain the metadata collection.
function getMetaCollection() {
  if (!db) throw new Error("Database not connected");
  return db.collection("filemeta");
}

// POST /api/files/upload: Upload a file.
router.post(
  "/upload",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const metaCollection = getMetaCollection();

      // Generate encryption key and IV.
      const encryptionKey = generateKey();
      const iv = generateIV();

      // Encrypt the file.
      const { encryptedData, authTag } = encryptBuffer(
        req.file.buffer,
        encryptionKey,
        iv
      );

      // Save the encrypted file into GridFS.
      const uploadStream = gridFSBucket.openUploadStream(
        req.file.originalname,
        {
          metadata: { owner: req.user?.uid },
        }
      );
      uploadStream.end(encryptedData);
      uploadStream.on("finish", async (file: any) => {
        // Generate a one-time download token.
        const downloadToken = crypto.randomBytes(16).toString("hex");
        // Store metadata.
        await metaCollection.insertOne({
          fileId: file._id,
          originalName: req.file!.originalname,
          size: req.file!.size,
          owner: req.user?.uid,
          iv: iv.toString("hex"),
          authTag: authTag.toString("hex"),
          encryptionKey: encryptionKey.toString("hex"),
          downloadToken,
          createdAt: new Date(),
        });
        res.status(200).json({
          message: "File uploaded successfully",
          fileId: file._id,
          downloadToken,
        });
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "File upload failed" });
    }
  }
);

// GET /api/files/download/:downloadToken: Download a file.
router.get("/download/:downloadToken", async (req: Request, res: Response) => {
  try {
    const { downloadToken } = req.params;
    const metaCollection = getMetaCollection();
    const meta = await metaCollection.findOne({
      downloadToken,
      owner: req.user?.uid,
    });
    if (!meta)
      return res.status(404).json({ error: "File not found or token invalid" });

    const downloadStream = gridFSBucket.openDownloadStream(meta.fileId);
    const chunks: Buffer[] = [];
    downloadStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    downloadStream.on("error", (err) => {
      console.error(err);
      res.status(500).json({ error: "Error reading file" });
    });
    downloadStream.on("end", async () => {
      const encryptedData = Buffer.concat(chunks);
      const key = Buffer.from(meta.encryptionKey, "hex");
      const iv = Buffer.from(meta.iv, "hex");
      const authTag = Buffer.from(meta.authTag, "hex");
      const decryptedData = decryptBuffer(encryptedData, key, iv, authTag);
      // Invalidate the download token (one-time use).
      await metaCollection.deleteOne({ _id: meta._id });
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${meta.originalName}"`
      );
      res.setHeader("Content-Type", "application/octet-stream");
      res.status(200).send(decryptedData);
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "File download failed" });
  }
});

// GET /api/files/list: Return all files for the authenticated user.
router.get("/list", async (req: Request, res: Response) => {
  try {
    const metaCollection = getMetaCollection();
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const files = await metaCollection
      .find({ owner: userId })
      .sort({ createdAt: -1 })
      .toArray();
    res.status(200).json({ files });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch file list" });
  }
});

// DELETE /api/files/delete/:fileId: Delete a file.
router.delete("/delete/:fileId", async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const metaCollection = getMetaCollection();
    const meta = await metaCollection.findOne({
      fileId: new ObjectId(fileId),
      owner: req.user?.uid,
    });
    if (!meta) {
      return res
        .status(404)
        .json({ error: "File not found or not authorized" });
    }
    await gridFSBucket.delete(new ObjectId(fileId));
    await metaCollection.deleteOne({ fileId: new ObjectId(fileId) });
    res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "File deletion failed" });
  }
});

// GET /api/files/graph: Provide graph details for the authenticated user.
router.get("/graph", async (req: Request, res: Response) => {
  try {
    const metaCollection = getMetaCollection();
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const aggregation = [
      { $match: { owner: userId } },
      {
        $group: {
          _id: null,
          totalFiles: { $sum: 1 },
          totalSize: { $sum: "$size" },
        },
      },
    ];
    const result = await metaCollection.aggregate(aggregation).toArray();
    res.status(200).json({
      graphData: result[0] || { totalFiles: 0, totalSize: 0 },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve graph data" });
  }
});

export default router;
