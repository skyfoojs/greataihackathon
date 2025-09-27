"use client";

import { remove } from "@aws-amplify/storage/internals";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { Loader2, Trash } from "lucide-react";
import { Fragment, useState } from "react";


export default function DeleteFileModal({
  documentKeys,
  onDeleteComplete
}: {
  documentKeys: string[],
  onDeleteComplete: () => void,

}) {
  const [isOpen, setIsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [ingesting, setIngesting] = useState(false);

  function closeModal() {
    setIsOpen(false);
    setDeleting(false);
    setIngesting(false);
  }

  function openModal() {
    setIsOpen(true);
  }

  async function deleteFiles(e: React.FormEvent) {
    e.preventDefault();
    if (documentKeys.length === 0) {
      return;
    }
    setDeleting(true);
    try {
      for (const documentKey of documentKeys) {
        await remove({
          path: documentKey,
        });
      }

      // Trigger ingestion once for all files
      const ingestResponse = await fetch("/api/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentKeys: documentKeys,
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

      onDeleteComplete();
    } catch (error) {
      console.error('Error', error)
    }
    setDeleting(false);
  }



  return (
    <>
      <button
        onClick={openModal}
        className="bg-red-500 hover:bg-red-600 :bg-red-700 text-white font-bold py-2 px-6 rounded-lg hover:opacity-90 transition-opacity cursor-pointer justify-center flex items-center"
      >
        Delete
        <Trash className="inline-block ml-2" size={16} />
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
                <DialogPanel className="w-full max-w-md flex flex-col items-center transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                  <DialogTitle
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900 dark:text-white text-center"
                  >
                    Are you sure you want to delete these {documentKeys.length} documents?
                  </DialogTitle>

                  <form onSubmit={deleteFiles} className="mt-4">

                    <div className="mt-6 flex justify-center gap-3">
                      <button
                        type="button"
                        onClick={closeModal}
                        className={`px-4 py-2 text-sm rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 ${deleting || ingesting ? "cursor-not-allowed" : "cursor-pointer dark:active:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 "} font-semibold`}
                        disabled={deleting || ingesting}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className={`px-4 py-2 text-sm rounded-md text-white font-semibold ${deleting || ingesting || documentKeys.length === 0 ? "cursor-not-allowed bg-gray-400" : "cursor-pointer active:bg-red-700 bg-red-500 hover:bg-red-600"}`}
                        disabled={deleting || ingesting || documentKeys.length === 0}
                      >
                        {deleting ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="animate-spin" size={16} />
                            Deleting...
                          </div>
                        ) : (
                          <div className="flex items-center">Delete All</div>
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
