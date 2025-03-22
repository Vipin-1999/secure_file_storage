// /app/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  Paper,
  Typography,
  MenuItem,
  TextField,
} from "@mui/material";
import { useDropzone } from "react-dropzone";
import { signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { createTheme, ThemeProvider } from "@mui/material/styles";

import axiosInstance from "../utils/axiosInstance";
import { auth } from "../firebaseConfig";
import Navbar from "../components/Navbar";
import FileList, { FileMeta } from "../components/FileList";
import FileTypeChart from "../components/FileTypeChart";
import DeleteConfirmationDialog from "../components/DeleteConfirmationDialog";
import SessionDialog from "../components/SessionDialog";
import { FirebaseUser } from "./types";

export default function UploadPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [csrfToken, setCsrfToken] = useState<string>("");
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileMeta | null>(null);
  const [sessionRemaining, setSessionRemaining] = useState<number>(0);
  const [darkMode, setDarkMode] = useState(false);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [filter, setFilter] = useState<string>("");

  const theme = createTheme({
    palette: {
      mode: darkMode ? "dark" : "light",
    },
  });

  // Axios interceptor for session termination.
  useEffect(() => {
    const interceptor = axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (
          error.response &&
          error.response.status === 401 &&
          (error.response.data.error === "Session terminated" ||
            error.response.data.error === "Session expired")
        ) {
          setSessionDialogOpen(true);
          handleSignOut();
        }
        return Promise.reject(error);
      }
    );
    return () => {
      axiosInstance.interceptors.response.eject(interceptor);
    };
  }, []);

  // Monitor Firebase auth state.
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser: FirebaseUser | null) => {
      setUser(currentUser);
    });
    return unsubscribe;
  }, []);

  // Check session status on page load (only once) and create one if needed.
  useEffect(() => {
    async function initSession() {
      if (user) {
        try {
          // Fetch session info.
          const { data } = await axiosInstance.get("/session-info");
          if (data.remaining > 0) {
            // Set local timer using remaining time.
            setSessionRemaining(Math.floor(data.remaining / 1000));
          } else {
            // No valid session exists – create a new session.
            await axiosInstance.post(
              "/create-session",
              {},
              { headers: { "X-New-Session": "true" } }
            );
            // Fetch the session info again.
            const { data: newData } = await axiosInstance.get("/session-info");
            setSessionRemaining(Math.floor(newData.remaining / 1000));
          }
        } catch (err) {
          console.error("Error fetching/creating session", err);
        }
      }
    }
    initSession();
  }, [user]);

  // Start a local timer that counts down from sessionRemaining.
  useEffect(() => {
    if (user && sessionRemaining > 0) {
      const timer = setInterval(() => {
        setSessionRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setSessionDialogOpen(true);
            handleSignOut();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [user, sessionRemaining]);

  // Fetch CSRF token.
  useEffect(() => {
    async function fetchCsrfToken() {
      if (user) {
        try {
          const { data } = await axiosInstance.get("/csrf-token");
          setCsrfToken(data.csrfToken);
        } catch (err) {
          console.error("Error fetching CSRF token", err);
        }
      }
    }
    fetchCsrfToken();
  }, [user]);

  // Fetch file list.
  const fetchFileList = async () => {
    if (user) {
      try {
        const { data } = await axiosInstance.get("/files/list", {
          headers: { "X-CSRF-Token": csrfToken },
        });
        setFiles(data.files);
      } catch (err) {
        console.error("Error fetching file list", err);
      }
    }
  };

  useEffect(() => {
    fetchFileList();
  }, [user, csrfToken]);

  // Sign in.
  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // The initSession effect will run once the user state is updated.
    } catch (error) {
      console.error("Sign in error", error);
    }
  };

  // Sign out.
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out error", error);
    }
  };

  // Dropzone for multiple file selection.
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFiles(acceptedFiles);
    }
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
  });

  // Upload multiple files.
  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    try {
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append("file", file);
        await axiosInstance.post("/files/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            "X-CSRF-Token": csrfToken,
          },
        });
      }
      setMessage("Files uploaded successfully.");
      setSelectedFiles([]);
      fetchFileList();
    } catch (error) {
      console.error(error);
      setMessage("Upload failed");
    }
  };

  // Download a file.
  const handleDownload = async (file: FileMeta) => {
    try {
      window.open(`/api/files/download/${file.fileId}`, "_blank");
    } catch (error) {
      console.error("Download error", error);
    }
  };

  // Initiate delete.
  const handleDelete = (file: FileMeta) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  // Confirm deletion.
  const confirmDelete = async () => {
    if (!fileToDelete) return;
    try {
      await axiosInstance.delete(`/files/delete/${fileToDelete.fileId}`, {
        headers: { "X-CSRF-Token": csrfToken },
      });
      setMessage("File deleted successfully.");
      setDeleteDialogOpen(false);
      setFileToDelete(null);
      fetchFileList();
    } catch (error) {
      console.error("Delete error", error);
      setMessage("Delete failed");
    }
  };

  // Filter files by type.
  const filteredFiles = files.filter((file) => {
    if (!filter) return true;
    const ext = file.originalName.split(".").pop()?.toLowerCase() || "";
    return ext === filter.toLowerCase();
  });

  // List of file types for the filter dropdown.
  const fileTypes = Array.from(
    new Set(
      files.map(
        (file) => file.originalName.split(".").pop()?.toLowerCase() || "unknown"
      )
    )
  );

  // Toggle theme.
  const toggleTheme = () => {
    setDarkMode((prev) => !prev);
  };

  return (
    <ThemeProvider theme={theme}>
      <Box>
        <Navbar
          sessionCountdown={sessionRemaining}
          onThemeToggle={toggleTheme}
          darkMode={darkMode}
          onLogout={handleSignOut}
          userDisplayName={user?.displayName || ""}
          userPhotoURL={user?.photoURL || ""}
        />
        <Box sx={{ p: 4 }}>
          {!user ? (
            <Button variant="contained" onClick={handleSignIn}>
              Sign in with Google
            </Button>
          ) : (
            <>
              <Paper
                {...getRootProps()}
                sx={{
                  p: 4,
                  textAlign: "center",
                  border: "2px dashed #ccc",
                  mb: 2,
                }}
              >
                <input {...getInputProps()} />
                {isDragActive ? (
                  <Typography>Drop files here ...</Typography>
                ) : (
                  <Typography>
                    Drag & drop files here, or click to select files
                  </Typography>
                )}
              </Paper>
              {selectedFiles.length > 0 && (
                <Box>
                  <Typography variant="body1">Selected files:</Typography>
                  <ul>
                    {selectedFiles.map((file, idx) => (
                      <li key={idx}>{file.name}</li>
                    ))}
                  </ul>
                  <Button variant="contained" onClick={handleUpload}>
                    Upload Files
                  </Button>
                </Box>
              )}
              <Box sx={{ mt: 4 }}>
                <Typography variant="h6">Filter by file type:</Typography>
                <TextField
                  select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  variant="outlined"
                  size="small"
                  sx={{ mt: 1, width: 200 }}
                >
                  <MenuItem value="">All</MenuItem>
                  {fileTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type.toUpperCase()}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
              <FileList
                files={filteredFiles}
                onDownload={handleDownload}
                onDelete={handleDelete}
              />
              <FileTypeChart files={files} />
              <DeleteConfirmationDialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                onConfirm={confirmDelete}
                fileName={fileToDelete?.originalName || ""}
              />
              {message && (
                <Typography variant="body2" sx={{ mt: 2 }}>
                  {message}
                </Typography>
              )}
            </>
          )}
        </Box>
        <SessionDialog
          open={sessionDialogOpen}
          title="Session Terminated"
          message="Your session has expired or you logged in on another device."
          onClose={() => setSessionDialogOpen(false)}
        />
      </Box>
    </ThemeProvider>
  );
}
