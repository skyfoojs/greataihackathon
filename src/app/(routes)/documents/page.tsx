import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import PreAuth from "../../../components/PreAuth";

import DocumentsTable from "@/features/documents/DocumentsTable";

export default function Documents() {
  return (


    <div className="bg-background-light dark:bg-background-dark font-display text-gray-900 dark:text-white min-h-screen flex flex-col">
      <Navbar />
      <PreAuth>
        <Sidebar page="documents" />

        <div className="flex flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="mx-auto max-w-4xl">
              {/* Upload area */}
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Upload your Medical Documents
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                  Securely upload and store your medical records in one place.
                </p>
              </div>

              <DocumentsTable />
            </div>
          </div>
        </div>

      </PreAuth>
    </div>
  );
}
