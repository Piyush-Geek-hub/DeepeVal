import React, { useRef, useState } from "react";
import "../styles/excel-upload.css";

interface ExcelUploadProps {
  onFileSelect: (file: File) => Promise<void>;
  isLoading?: boolean;
  acceptedFormats?: string[];
}

/**
 * ExcelUpload Component
 * 
 * Provides drag-and-drop and click-to-upload interface for Excel files
 * Validates file type and size before upload
 */
export const ExcelUpload: React.FC<ExcelUploadProps> = ({
  onFileSelect,
  isLoading = false,
  acceptedFormats = [".xlsx", ".xls"],
}) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

  const validateFile = (file: File): boolean => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
      return false;
    }

    // Check file type
    const fileName = file.name.toLowerCase();
    const isValidType = acceptedFormats.some(format =>
      fileName.endsWith(format.toLowerCase())
    );

    if (!isValidType) {
      setError(`Invalid file format. Accepted formats: ${acceptedFormats.join(", ")}`);
      return false;
    }

    return true;
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      if (validateFile(file)) {
        setError(null);
        onFileSelect(file);
      }
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files[0]) {
      const file = files[0];
      if (validateFile(file)) {
        setError(null);
        onFileSelect(file);
      }
    }
  };

  return (
    <div className="excel-upload-container">
      <div
        className={`excel-upload-area ${isDragActive ? "active" : ""} ${isLoading ? "loading" : ""}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          disabled={isLoading}
          style={{ display: "none" }}
        />

        {isLoading ? (
          <div className="upload-loading">
            <div className="spinner"></div>
            <p>Processing Excel file...</p>
          </div>
        ) : (
          <>
            <div className="upload-icon">📊</div>
            <h3>Upload Excel File</h3>
            <p className="upload-text">
              Drag and drop your Excel file here or click to browse
            </p>
            <p className="upload-hint">
              Accepted formats: {acceptedFormats.join(", ")} (max {MAX_FILE_SIZE / 1024 / 1024}MB)
            </p>
          </>
        )}
      </div>

      {error && <div className="upload-error">{error}</div>}
    </div>
  );
};

export default ExcelUpload;
