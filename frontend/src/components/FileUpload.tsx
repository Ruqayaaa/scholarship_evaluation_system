// (Applicant) To be used for when applicants need to upload files as part of their application (e.g. transcripts, portfolios). 
import React, { useRef } from "react";

/* This component needs: 
- a label for the file input
- an optional description for the file input (e.g. "Upload a PDF of your transcript")
- accepted file formats (e.g. .pdf, .docx) and max file size (e.g. 10MB) for validation
- support for multiple file uploads if needed
- a way to display the list of selected files with an option to remove them before submission
- a callback function to pass the selected files back to the parent component for form submission
*/

type Props = {
  label: string;
  description?: string;
  acceptedFormats?: string;
  maxSize?: number;
  multiple?: boolean;
  files: File[];
  onFilesChange: (files: File[]) => void;
};



// https://uploadcare.com/blog/how-to-upload-file-in-react/
export function FileUpload({
  label,
  description,
  acceptedFormats = "",
  maxSize = 10,
  multiple = false,
  files,
  onFilesChange,
}: Props) {
  //for file input 
  const inputRef = useRef<HTMLInputElement | null>(null); 
  // to open file picker when button is clicked
  const openPicker = () => inputRef.current?.click(); 

  const validateAndSet = (fileList: FileList | null) => {
    // checking if a file is selected
    if (!fileList || fileList.length === 0) return;
    const picked = Array.from(fileList);

    // size check
    const tooBig = picked.find((f) => f.size > maxSize * 1024 * 1024);
    if (tooBig) {
      alert(`"${tooBig.name}" is too large. Max size is ${maxSize}MB.`);
      return;
    }

    // format check
    onFilesChange(multiple ? picked : [picked[0]]);
  };

  // remove file 
  const removeFile = (index: number) => {
    const next = [...files];
    next.splice(index, 1);
    onFilesChange(next);
  };

  return (
    /* (FigmaMake 2025) */
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>{label}</div>
        {description ? (
          <div style={{ color: "var(--muted)", lineHeight: 1.6 }}>{description}</div>
        ) : null}
      </div>


      <input
        ref={inputRef}
        type="file"
        accept={acceptedFormats}
        multiple={multiple}
        style={{ display: "none" }}
        onChange={(e) => validateAndSet(e.target.files)}
      />

  
      <button type="button" className="primary-btn" onClick={openPicker} style={{ width: "fit-content" }}>
        Upload file
      </button>

      <div style={{ color: "var(--muted)", fontSize: 13 }}>
        {acceptedFormats ? `${acceptedFormats} • ` : ""}
        Max {maxSize}MB
      </div>

      {/* Uploaded file list */}
      {files?.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {files.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 10,
                background: "rgba(255,255,255,0.70)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
              <button type="button" className="ghost-btn" onClick={() => removeFile(i)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
