"use client";

import { useState, useEffect } from "react";
import { list, getUrl, remove } from "aws-amplify/storage";
import { Search, X, Trash2, Eye, RefreshCcw } from "lucide-react";
import UploadFileModal from "@/components/UploadFileModal";
import { Checkbox } from '@headlessui/react'
import DeleteFileModal from "./DeleteFileModal";

const ALLOWEDFILETYPES = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"];

interface Document {
  key: string;
  name: string;
  lastModified: Date;
  size: number;
}

function SelectAllFileCheckbox({setSelectAllFiles, numberOfSelectedDocuments, numberOfDocuments
}: {
  setSelectAllFiles: React.Dispatch<React.SetStateAction<boolean>>, numberOfSelectedDocuments: number, numberOfDocuments: number
}) {
  const [enabled, setEnabled] = useState(false);

  // selectAllFiles can be set to false by the other SelectFileCheckbox
  useEffect(() => {
    if (numberOfSelectedDocuments !== numberOfDocuments && numberOfDocuments !== 0) {
      setEnabled(false);
    }

    if (numberOfSelectedDocuments === numberOfDocuments && numberOfDocuments !== 0) {
      setEnabled(true);
    }
  }, [numberOfSelectedDocuments, numberOfDocuments]);



  return (
    <Checkbox
      checked={enabled}
      onChange={() => {
        // old value for enable.
        // If it is GOING TO BE DISABLED.
        if (enabled) {
          setSelectAllFiles(false);
          setEnabled(false);
        } else {
          setSelectAllFiles(true);
        }
      }}
      className={`${enabled || numberOfSelectedDocuments > 0 ? 'opacity-100' : 'opacity-0 hover:opacity-150'} ${numberOfDocuments === 0 ? "hidden" : undefined} transition-opacity duration-50 cursor-pointer group block size-4 rounded-lg border-2 bg-white data-checked:bg-blue-700`}
    >
    </Checkbox>
  );

}

function SelectFileCheckbox({ numberOfSelectedDocuments, setNumberOfSelectedDocuments, selectAllFiles, setSelectAllFiles, setSelectedDocumentKeys, documentKey, numberOfDocuments

}: {
  numberOfSelectedDocuments: number, setNumberOfSelectedDocuments: React.Dispatch<React.SetStateAction<number>>, selectAllFiles: boolean, setSelectAllFiles: React.Dispatch<React.SetStateAction<boolean>>, setSelectedDocumentKeys: React.Dispatch<React.SetStateAction<string[]>>, documentKey: string, numberOfDocuments: number
}) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (selectAllFiles) {
      if (!enabled) {
        setEnabled(true);
        setNumberOfSelectedDocuments(prev => prev + 1);
        setSelectedDocumentKeys(prev => prev.includes(documentKey) ? prev : [...prev, documentKey]);

      }
    } else if (!selectAllFiles && numberOfSelectedDocuments === numberOfDocuments) {
      if (enabled) {
        setEnabled(false);
        setNumberOfSelectedDocuments(prev => prev - 1);
        setSelectedDocumentKeys(prev =>
          prev.filter(key => key !== documentKey)
        );
      }
    }
  }, [selectAllFiles, numberOfSelectedDocuments, numberOfDocuments, documentKey, enabled, setNumberOfSelectedDocuments, setSelectedDocumentKeys]);

  return (

    <Checkbox
      checked={enabled}
      onChange={() => {
        if (enabled) {
          setEnabled(false);
          setNumberOfSelectedDocuments(prev => prev - 1);

          setSelectAllFiles(false);
          setSelectedDocumentKeys(prev =>
            prev.filter(key => key !== documentKey)
          );

        } else {
          setEnabled(true);
          setNumberOfSelectedDocuments(prev => prev + 1);
          setSelectedDocumentKeys(prev => prev.includes(documentKey) ? prev : [...prev, documentKey]);
        }
      }}
      className={`${enabled || numberOfSelectedDocuments > 0 ? 'opacity-100' : 'opacity-0 hover:opacity-150'} transition-opacity duration-50 cursor-pointer group block size-4 rounded-lg border-2 bg-white data-checked:bg-blue-700`}
    >
    </Checkbox>

  );
}

export default function DocumentsTable() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectAllFiles, setSelectAllFiles] = useState(false);
  const [numberOfSelectedDocuments, setNumberOfSelectedDocuments] = useState(0);
  const [selectedDocumentKeys, setSelectedDocumentKeys] = useState<string[]>([]);

  async function onDeleteComplete() {
    setSelectedDocumentKeys([]);
    setNumberOfSelectedDocuments(0);
    getDocuments();
  }

  async function getDocuments() {
    try {
      setLoading(true);
      // List all files in the medical-query-bucket
      const result = await list({
        path: "medical-records/",
      });

      // Filter for document files and map to Document objects
      const documents = result.items
        .filter((item) => {
          const path = item.path?.toLowerCase();
          return path && ALLOWEDFILETYPES.some((ext) => path.endsWith(ext));
        })
        .map((item) => ({
          key: item.path!,
          name: item.path!.split("/").pop() || item.path!,
          lastModified: item.lastModified
            ? new Date(item.lastModified)
            : new Date(),
          size: item.size || 0,
        }));

      setDocuments(documents);
      setFilteredDocuments(documents);
      setSelectAllFiles(false);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  }

  async function openDocumentInNewTab(key: string) {
    try {
      // Get a pre-signed URL for the document
      const { url } = await getUrl({
        path: key,
        options: {
          expiresIn: 3600, // URL expires in 1 hour
        },
      });

      // Open the document in a new tab
      window.open(url.toString(), "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Error opening document:", error);
      alert("Failed to open document. Please try again.");
    }
  }

  async function deleteDocument(key: string, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      setDeleting(key);
      // Delete the document from storage
      await remove({
        path: key,
      });

      // Remove the document from the local state
      setDocuments((prev) => prev.filter((doc) => doc.key !== key));
      setFilteredDocuments((prev) => prev.filter((doc) => doc.key !== key));
      console.log(key);
      // Trigger ingestion once for all files
      const ingestResponse = await fetch("/api/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentKeys: key,
        }),
      });

      if (!ingestResponse.ok) {
        const errorText = await ingestResponse.text();
        console.error("Ingestion API error:", ingestResponse.status, errorText);
        throw new Error(
          `Failed to trigger ingestion: ${ingestResponse.status} ${errorText}`
        );
      }

      const ingestResult = await ingestResponse.json();
      console.log("Ingestion started for all files:", ingestResult);
    } catch (error) {
      console.error("Error deleting document:", error);
      alert("Failed to delete document. Please try again.");
    } finally {
      setDeleting(null);
    }
  }

  // Filter documents based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredDocuments(documents);
    } else {
      const filtered = documents.filter((doc) =>
        doc.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredDocuments(filtered);
    }
  }, [searchTerm, documents]);

  // Clear search
  const clearSearch = () => {
    setSearchTerm("");
  };

  // Load documents on component mount
  useEffect(() => {
    getDocuments();
  }, []);

  if (loading) {
    return (
      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200/50 dark:border-gray-700/50 h-[400px] flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">
          Loading documents...
        </div>
      </div>
    );
  }

  return (
    <>
      <div>
        <div className="justify-end flex">
          <div className="mt-4 flex justify-end gap-6">
            {/* Upload button */}
            {numberOfSelectedDocuments > 0 ? <DeleteFileModal onDeleteComplete={onDeleteComplete} documentKeys={selectedDocumentKeys} /> :
              <UploadFileModal onUploadComplete={getDocuments} />}
            {/* Refresh button */}
            <button
              onClick={getDocuments}
              className="px-3 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 font-semibold"
            >
              <RefreshCcw className="" size={16} />
            </button>
          </div>
        </div>
        {/* Search Bar */}
        <div className="mt-4 mb-4 flex items-center gap-2">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search documents by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-700 py-2 pl-10 pr-4 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Results count */}
          <div className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {filteredDocuments.length} of {documents.length} documents
          </div>
        </div>
      </div>
      {numberOfSelectedDocuments > 0 ? <p>{numberOfSelectedDocuments} files selected</p> : undefined}
      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200/50 dark:border-gray-700/50 max-h-[400px]">

        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-400 uppercase sticky top-0">
            <tr>
              <th className="px-2 py-3 flex justify-center" scope="col">
                <SelectAllFileCheckbox setSelectAllFiles={setSelectAllFiles} numberOfSelectedDocuments={numberOfSelectedDocuments} numberOfDocuments={documents.length} />
              </th>
              <th className="px-6 py-3" scope="col">
                Document Name
              </th>
              <th className="px-6 py-3" scope="col">
                Uploaded Date
              </th>
              <th className="px-6 py-3" scope="col">
                Size
              </th>
              <th className="px-6 py-3" scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredDocuments.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-4 text-center text-gray-500 dark:text-gray-400"
                >
                  {searchTerm ? (
                    <>No documents found matching &quot;{searchTerm}&quot;</>
                  ) : (
                    <div className="flex flex-col">
                      <p>
                        No documents found. Upload a document to get started.
                      </p>
                      <p>
                        Supported formats: pdf, jpeg, jpg, png, doc, docx.
                        Select multiple files.
                      </p>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              filteredDocuments.map((document) => (
                <tr
                  key={document.key}
                  className="border-b border-gray-200 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                >
                  <th className="px-2 py-3 flex justify-center" scope="col">
                    <SelectFileCheckbox documentKey={document.key} setSelectedDocumentKeys={setSelectedDocumentKeys} numberOfSelectedDocuments={numberOfSelectedDocuments} setNumberOfSelectedDocuments={setNumberOfSelectedDocuments} selectAllFiles={selectAllFiles} setSelectAllFiles={setSelectAllFiles} numberOfDocuments={documents.length} />
                  </th>
                  <th
                    className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white max-w-xs truncate"
                    scope="row"
                    title={document.name}
                  >
                    {document.name}
                  </th>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                    {document.lastModified.toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                    {(document.size / 1024).toFixed(1)} KB
                  </td>
                  <td className="px-6 py-4 flex items-center space-x-10">
                    <button
                      onClick={() => openDocumentInNewTab(document.key)}
                      className="p-1 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors cursor-pointer"
                      title="View document"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() =>
                        deleteDocument(document.key, document.name)
                      }
                      disabled={deleting === document.key}
                      className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      title="Delete document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
