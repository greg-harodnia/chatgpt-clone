"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, FileText } from "lucide-react";
import { MAX_DOCUMENT_SIZE_MB } from "@/lib/constants";

interface DocumentFile {
  file: File;
  id?: string;
  uploading?: boolean;
  error?: string;
}

interface DocumentUploadProps {
  chatId: string;
  userId: string | null;
  onDocumentsUploaded?: (documentIds: string[]) => void;
}

export function DocumentUpload({ chatId, userId, onDocumentsUploaded }: DocumentUploadProps) {
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [uploadedIds, setUploadedIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const maxSize = MAX_DOCUMENT_SIZE_MB * 1024 * 1024;
    const newDocs: DocumentFile[] = [];

    for (const file of Array.from(files)) {
      if (file.size > maxSize) {
        newDocs.push({
          file,
          error: `File exceeds ${MAX_DOCUMENT_SIZE_MB}MB limit`,
        });
        continue;
      }

      newDocs.push({ file, uploading: true });
    }

    setDocuments((prev) => [...prev, ...newDocs]);

    const uploadPromises = newDocs
      .filter((d) => d.uploading)
      .map(async (doc) => {
        const formData = new FormData();
        formData.append("file", doc.file);
        formData.append("chatId", chatId);
        if (userId) formData.append("userId", userId);

        try {
          const res = await fetch("/api/documents", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            setDocuments((prev) =>
              prev.map((d) =>
                d.file === doc.file
                  ? { ...d, uploading: false, error: err.error || "Upload failed" }
                  : d
              )
            );
            return null;
          }

          const data = await res.json();
          setDocuments((prev) =>
            prev.map((d) =>
              d.file === doc.file ? { ...d, uploading: false, id: data.id } : d
            )
          );
          return data.id as string;
        } catch {
          setDocuments((prev) =>
            prev.map((d) =>
              d.file === doc.file
                ? { ...d, uploading: false, error: "Upload failed" }
                : d
            )
          );
          return null;
        }
      });

    const results = await Promise.all(uploadPromises);
    const ids = results.filter((id): id is string => id !== null);
    if (ids.length > 0) {
      const allIds = [...uploadedIds, ...ids];
      setUploadedIds(allIds);
      onDocumentsUploaded?.(allIds);
    }

    e.target.value = "";
  };

  const removeDocument = (index: number) => {
    const doc = documents[index];
    if (doc.id) {
      const newIds = uploadedIds.filter((id) => id !== doc.id);
      setUploadedIds(newIds);
      onDocumentsUploaded?.(newIds);
    }
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  if (documents.length === 0) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.csv,.json,.pdf,.doc,.docx"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-8 w-8"
          onClick={() => fileInputRef.current?.click()}
          title="Attach document"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-2 space-y-1">
      {documents.map((doc, index) => (
        <div
          key={index}
          className="flex items-center gap-2 text-xs bg-zinc-50 dark:bg-zinc-800 rounded-lg px-2 py-1.5"
        >
          <FileText className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
          <span className="flex-1 truncate">{doc.file.name}</span>
          {doc.uploading && (
            <span className="text-zinc-400">Uploading...</span>
          )}
          {doc.error && (
            <span className="text-red-500">{doc.error}</span>
          )}
          <button
            onClick={() => removeDocument(index)}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
