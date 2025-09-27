"use client";

import { uploadData } from "@aws-amplify/storage/internals";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { CloudUpload, Upload, Loader2, X, FileText } from "lucide-react";
import { Fragment, useState, useRef } from "react";

interface UploadFile {
  file: File | null;
  status: "pending" | "uploading" | "completed" | "error";
  progress?: number;
  errorMessage?: string;
  key?: string;
  name: string;
}

export default function UploadFileModal({
  onUploadComplete,
}: {
  onUploadComplete: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function closeModal() {
    setIsOpen(false);
    setFiles([]);
    setUploading(false);
    setIngesting(false);
  }

  function openModal() {
    setIsOpen(true);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const newFiles: UploadFile[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      if (file && (file.type === "application/pdf" ||
        file.type === "image/jpeg" ||
        file.type === "image/jpg" ||
        file.type === "image/png" ||
        file.type === "application/msword" ||
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")) {
        newFiles.push({
          file,
          name: file.name,
          status: "pending",
        });
      }
    }

    setFiles((prev) => [...prev, ...newFiles]);

    // Reset the input to allow selecting the same files again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function submitFiles(e: React.FormEvent) {
    e.preventDefault();

    if (files.length === 0) {
      return;
    }

    setUploading(true);

    try {
      // Update all files to uploading status
      setFiles((prev) =>
        prev.map((file) => ({ ...file, status: "uploading", progress: 0 }))
      );

      const uploadedFileKeys: string[] = [];

      // Upload files sequentially
      for (let i = 0; i < files.length; i++) {
        const fileData = files[i];

        // Skip if file is null or undefined
        if (!fileData.file) {
          console.error("File is null or undefined at index:", i);
          setFiles((prev) => {
            const updated = [...prev];
            updated[i] = {
              ...updated[i],
              status: "error",
              errorMessage: "File is missing",
            };
            return updated;
          });
          continue;
        }

        const fileKey = `medical-records/${Date.now()}-${i}-${fileData.name}`;

        // Update progress for this file
        setFiles((prev) => {
          const updated = [...prev];
          updated[i] = {
            ...updated[i],
            status: "uploading",
            progress: 0,
            key: fileKey,
          };
          return updated;
        });

        try {
          // Upload to S3
          await uploadData({
            path: fileKey,
            data: fileData.file,
            options: {
              contentType: fileData.file.type,
              onProgress: ({ transferredBytes, totalBytes }) => {
                const progress = totalBytes
                  ? Math.round((transferredBytes / totalBytes) * 100)
                  : 0;
                setFiles((prev) => {
                  const updated = [...prev];
                  updated[i] = { ...updated[i], progress };
                  return updated;
                });
              },
            },
          });

          console.log("File uploaded to S3:", fileKey);
          uploadedFileKeys.push(fileKey);

          // Mark as completed
          setFiles((prev) => {
            const updated = [...prev];
            updated[i] = { ...updated[i], status: "completed", progress: 100 };
            return updated;
          });
        } catch (error) {
          console.error(`Error uploading file ${fileData.name}:`, error);
          setFiles((prev) => {
            const updated = [...prev];
            updated[i] = {
              ...updated[i],
              status: "error",
              errorMessage:
                error instanceof Error ? error.message : "Unknown error",
            };
            return updated;
          });
        }
      }

      // After all files are uploaded, trigger a single ingestion
      if (uploadedFileKeys.length > 0) {
        setIngesting(true);

        try {
          // Trigger ingestion once for all files
          const ingestResponse = await fetch("/api/ingest", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              documentKeys: uploadedFileKeys,
            }),
          });

          if (!ingestResponse.ok) {
            const errorText = await ingestResponse.text();
            console.error(
              "Ingestion API error:",
              ingestResponse.status,
              errorText
            );
            throw new Error(
              `Failed to trigger ingestion: ${ingestResponse.status} ${errorText}`
            );
          }

          const ingestResult = await ingestResponse.json();
          console.log("Ingestion started for all files:", ingestResult);
          
          if (onUploadComplete) {
            onUploadComplete();
          }
        } catch (error) {
          console.error("Error triggering ingestion:", error);
        } finally {
          setIngesting(false);
          closeModal();
        }
      }
    } catch (error) {
      console.error("Upload process failed:", error);
    } finally {
      setUploading(false);
    }
  }

  const completedCount = files.filter((f) => f.status === "completed").length;
  const errorCount = files.filter((f) => f.status === "error").length;
  const pendingCount = files.filter((f) => f.status === "pending").length;

  return (
    <>
      <button
        onClick={openModal}
        className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg hover:opacity-90 transition-opacity cursor-pointer justify-center flex items-center"
      >
        Upload
        <Upload className="inline-block ml-2" size={16} />
      </button>

      {/* Modal */}
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={closeModal}>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/25" />
          </TransitionChild>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                  <DialogTitle
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900 dark:text-white"
                  >
                    Upload Documents
                  </DialogTitle>

                  <form onSubmit={submitFiles} className="mt-4">
                    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-6 text-center bg-gray-50 dark:bg-gray-900/20">
                      <CloudUpload size={60} className="text-blue-400 mb-2" />
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        Drag and drop or select files
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">
                        Supported formats: pdf, jpeg, jpg, png, doc, docx. Select multiple files.
                      </p>
                      <input
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="border mt-2 block rounded-md w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-400 cursor-pointer"
                        id="attachment"
                        name="attachment"
                        type="file"
                        multiple
                        accept="application/pdf, image/jpeg, image/png, image/jpg, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      />
                    </div>

                    {/* File list */}
                    {files.length > 0 && (
                      <div className="mt-4 max-h-60 overflow-y-auto">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Selected files ({files.length}):
                          {completedCount > 0 && ` ${completedCount} completed`}
                          {pendingCount > 0 && ` ${pendingCount} pending`}
                          {errorCount > 0 && ` ${errorCount} failed`}
                        </p>
                        <div className="space-y-2">
                          {files.map((fileData, index) => (
                            <div
                              key={index}
                              className={`flex items-center justify-between p-2 rounded-md ${
                                fileData.status === "completed"
                                  ? "bg-green-50 dark:bg-green-900/20"
                                  : fileData.status === "error"
                                    ? "bg-red-50 dark:bg-red-900/20"
                                    : fileData.status === "uploading"
                                      ? "bg-blue-50 dark:bg-blue-900/20"
                                      : "bg-gray-50 dark:bg-gray-700/50"
                              }`}
                            >
                              <div className="flex items-center flex-1 min-w-0">
                                <FileText
                                  size={16}
                                  className="text-gray-500 mr-2 flex-shrink-0"
                                />
                                <span className="text-sm truncate">
                                  {fileData.name}
                                </span>
                              </div>

                              <div className="flex items-center ml-2">
                                {fileData.status === "uploading" && (
                                  <>
                                    <span className="text-xs text-gray-500 mr-2 whitespace-nowrap">
                                      {fileData.progress}%
                                    </span>
                                    <Loader2
                                      className="animate-spin flex-shrink-0"
                                      size={16}
                                    />
                                  </>
                                )}

                                {fileData.status === "pending" &&
                                  !uploading && (
                                    <button
                                      type="button"
                                      onClick={() => removeFile(index)}
                                      className="text-gray-500 hover:text-red-500 flex-shrink-0"
                                    >
                                      <X size={16} />
                                    </button>
                                  )}

                                {fileData.status === "completed" && (
                                  <span className="text-green-500 text-xs whitespace-nowrap">
                                    Done
                                  </span>
                                )}

                                {fileData.status === "error" && (
                                  <div className="flex flex-col items-end">
                                    <span className="text-red-500 text-xs whitespace-nowrap">
                                      Failed
                                    </span>
                                    {fileData.errorMessage && (
                                      <span
                                        className="text-red-400 text-xs max-w-xs truncate"
                                        title={fileData.errorMessage}
                                      >
                                        {fileData.errorMessage}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-6 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={closeModal}
                        className={`px-4 py-2 text-sm rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 ${uploading || ingesting ? "cursor-not-allowed" : "cursor-pointer dark:active:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 "} font-semibold`}
                        disabled={uploading || ingesting}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className={`px-4 py-2 text-sm rounded-md text-white font-semibold ${uploading || ingesting || files.length === 0 ? "cursor-not-allowed bg-gray-400" : "cursor-pointer active:bg-blue-700 bg-blue-500 hover:bg-blue-600"}`}
                        disabled={uploading || ingesting || files.length === 0}
                      >
                        {uploading ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="animate-spin" size={16} />
                            Uploading...
                          </div>
                        ) : (
                          <div className="flex items-center">Upload All</div>
                        )}
                      </button>
                    </div>
                  </form>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}
