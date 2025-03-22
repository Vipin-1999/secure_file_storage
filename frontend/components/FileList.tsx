// /components/FileList.tsx
import React from "react";
import { Box, Paper, Typography, IconButton } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";

export type FileMeta = {
  fileId: string;
  originalName: string;
  size: number;
  createdAt: string;
};

interface FileListProps {
  files: FileMeta[];
  onDownload: (file: FileMeta) => void;
  onDelete: (file: FileMeta) => void;
}

const FileList: React.FC<FileListProps> = ({ files, onDownload, onDelete }) => {
  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h5" gutterBottom>
        Uploaded Files
      </Typography>
      {files.length === 0 ? (
        <Typography>No files uploaded yet.</Typography>
      ) : (
        files.map((file) => (
          <Paper
            key={file.fileId}
            sx={{
              p: 2,
              mb: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Typography variant="subtitle1">{file.originalName}</Typography>
              <Typography variant="caption">
                {(file.size / 1024).toFixed(2)} KB -{" "}
                {new Date(file.createdAt).toLocaleString()}
              </Typography>
            </Box>
            <Box>
              <IconButton onClick={() => onDownload(file)} color="primary">
                <DownloadIcon />
              </IconButton>
              <IconButton onClick={() => onDelete(file)} color="error">
                <DeleteIcon />
              </IconButton>
            </Box>
          </Paper>
        ))
      )}
    </Box>
  );
};

export default FileList;
