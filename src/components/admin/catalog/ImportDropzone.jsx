import { useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";

/**
 * ImportDropzone — drag-drop / click-browse for a single CSV file.
 * Calls onFile(file) once a valid .csv is picked. Rejects non-CSVs
 * with a small inline error.
 */
export default function ImportDropzone({ onFile, disabled = false }) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError]           = useState(null);
  const inputRef = useRef(null);

  function accept(file) {
    if (!file) return;
    const isCsv =
      file.name?.toLowerCase().endsWith(".csv") ||
      file.type === "text/csv" ||
      file.type === "application/vnd.ms-excel" ||
      file.type === "";
    if (!isCsv) {
      setError("Please upload a .csv file (Excel: File → Save As → CSV)");
      return;
    }
    setError(null);
    onFile(file);
  }

  function handleChange(e) {
    accept(e.target.files?.[0]);
    // Reset so the same file can be picked again after fixing
    e.target.value = "";
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    if (disabled) return;
    accept(e.dataTransfer.files?.[0]);
  }

  return (
    <>
      <div
        className={
          "adm-import__drop" +
          (dragActive ? " adm-import__drop--drag" : "") +
          (disabled ? " adm-import__drop--disabled" : "")
        }
        onClick={() => !disabled && inputRef.current?.click()}
        onDragEnter={(e) => { e.preventDefault(); if (!disabled) setDragActive(true); }}
        onDragOver={(e)  => { e.preventDefault(); if (!disabled) setDragActive(true); }}
        onDragLeave={()  => setDragActive(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
      >
        <Upload size={36} strokeWidth={1.4} className="adm-import__drop-icon" />
        <b>Drop your CSV here, or click to browse</b>
        <small>Only .csv files. Excel: File → Save As → CSV</small>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleChange}
          disabled={disabled}
          style={{ display: "none" }}
        />
      </div>
      {error && (
        <div className="adm-import__err">
          <FileText size={13} /> {error}
        </div>
      )}
    </>
  );
}