"use client";

import { useEffect, useState, Fragment } from "react";
import Link from "next/link";
import { History, Loader2, X, Ellipsis } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { Description, Dialog, DialogPanel, DialogTitle, Menu, MenuButton, MenuItem, MenuItems, Transition, TransitionChild } from '@headlessui/react'
import { useRouter } from "next/navigation";
import { getCurrentUser } from "aws-amplify/auth";

const client = generateClient<Schema>();

interface SessionInfo {
  sessionId: string;
  firstMessage: string;
  timestamp: Date;
}



function DeleteChatHistoryModal({ openDeleteModal, setOpenDeleteModal, deleteSession }: { openDeleteModal: boolean, setOpenDeleteModal: React.Dispatch<React.SetStateAction<boolean>>, deleteSession: () => void }) {
  return (
    <Transition appear show={openDeleteModal} as={Fragment}>
      <Dialog open={openDeleteModal} onClose={() => setOpenDeleteModal(false)} className="relative z-100">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0 scale-95"
          enterTo="opacity-100 scale-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-95"
        >
          <div className="fixed inset-0 flex w-screen items-center justify-center p-4 text-gray-800 dark:bg-gray-800/50 dark:text-gray-200 transition-all">
            <DialogPanel className="max-w-lg space-y-4 border bg-background border p-12 rounded-lg border-gray-200 dark:border-gray-600 flex flex-col items-center">
              <DialogTitle className="font-bold text-lg text-base text-red-400">Delete chat</DialogTitle>
              <Description className="text-base">This will permanently delete your chat</Description>
              <p className="text-center text-base">Are you sure you want to delete this chat? All of the chat data will be removed.</p>
              <div className="flex gap-4">
                <button className="bg-gray-400 hover:bg-gray-600 px-2 py-1 rounded-lg cursor-pointer" onClick={() => setOpenDeleteModal(false)}>Cancel</button>
                <button className="bg-red-400 hover:bg-red-500 px-2 py-1 rounded-lg cursor-pointer" onClick={() => { setOpenDeleteModal(false); deleteSession(); }}>Delete</button>
              </div>
            </DialogPanel>
          </div>
        </TransitionChild>

      </Dialog>
    </Transition>

  );
}

export default function Sidebar() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [deleteSessionId, setDeleteSessionId] = useState("");
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    getUserId();
  }, []);



  async function deleteSession() {

    try {
      // First check if the session exists in the database
      // TODO: Need to check if user Id is valid or not.
      const { data } = await client.models.ChatMessage.list({
        filter: { sessionId: { eq: deleteSessionId } }
      });

      // If session exists, delete it
      if (data.length > 0) {
        for (const message of data) {
          const success = await client.models.ChatMessage.delete({
            id: message.id
          });
          console.log(success);
        }
      }
    } catch (error) {
      console.error("Error deleting session:", error);
    }

    router.push("/chat");
  }

  useEffect(() => {
    async function loadSessions() {
      // Only load if 0 sessions (to avoid reloading on every open)
      if (!sessions.length) setIsHistoryLoading(true);

      try {
        const res = await client.models.ChatMessage.list({
          filter: {
            userId: { eq: userId },
          },
        });
        console.log("test");
        const sessionsMap = new Map<string, SessionInfo>();

        res.data.forEach((message) => {
          if (!message.sessionId) return;

          const sessionId = message.sessionId;

          const createdAt = new Date(message.createdAt as string);

          // Get the existing session or create a new one
          const existingSession = sessionsMap.get(sessionId);

          // Update if this message is newer than the existing one
          if (!existingSession || createdAt > existingSession.timestamp) {
            // Use the last message (regardless of role)
            if (message.role == "user" && message.message) {
              sessionsMap.set(sessionId, {
                sessionId: sessionId,
                firstMessage: message.message,
                timestamp: createdAt,
              });
            }
          }
        });

        // Convert map to array and sort by timestamp (newest first)
        const sortedSessions = Array.from(sessionsMap.values()).sort(
          (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
        );

        setSessions(sortedSessions);
        setHasLoaded(true);
      } catch (error) {
        console.error("Error loading sessions:", error);
        setIsHistoryLoading(false);
      } finally {
        setIsHistoryLoading(false);
      }
    }

    if (isOpen && userId && !hasLoaded) loadSessions();
  }, [isOpen, sessions, userId, hasLoaded]);

  async function getUserId() {
    try {
      const { userId } = await getCurrentUser();
      setUserId(userId);
    } catch (error) {
      console.error("Error getting user:", error);
    }
  }
  return (
    <>
      <DeleteChatHistoryModal openDeleteModal={openDeleteModal} setOpenDeleteModal={setOpenDeleteModal} deleteSession={deleteSession} />

      {/* History button */}
      <div className="px-6 py-4 flex items-center justify-between lg:absolute lg:top-20 lg:right-0">
        <button
          onClick={() => setIsOpen(true)}
          className="text-gray-800 dark:text-gray-200"
        >
          <History size={32} className="cursor-w-resize" />
        </button>
      </div>

      {/* Sidebar Overlay */}
      <div
        className={`fixed inset-0 bg-black/30 transition-opacity z-40 ${isOpen ? "opacity-100 visible" : "opacity-0 invisible"
          }`}
        onClick={() => setIsOpen(false)}
      />

      {/* Sidebar Drawer */}
      <aside
        className={`overflow-y-auto fixed top-0 right-0 h-full w-64 bg-white dark:bg-gray-800 shadow-lg z-50 transform transition-transform duration-300
          ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Close Button */}
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-[#101c22]">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Chat History
          </h2>
          <button onClick={() => setIsOpen(false)}>
            <X
              size={24}
              className="text-gray-600 dark:text-gray-300 cursor-e-resize"
            />
          </button>
        </div>

        {/* Chat Sessions */}
        <nav className="flex flex-col p-4">
          {isHistoryLoading && (
            <div className="flex flex-col items-center justify-center mt-20 space-y-4">
              <Loader2 className="animate-spin" size={50} />
            </div>
          )}

          {sessions.map((session) => (
            <div key={session.sessionId} className="relative">
              <Menu>
                <MenuButton className="absolute right-2 top-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                  <Ellipsis />
                </MenuButton>
                <MenuItems modal={false} className="border z-90 border-gray-200 dark:border-gray-600 rounded" anchor="bottom">
                  <MenuItem>
                    <button onClick={() => {
                      setOpenDeleteModal(true);
                      setDeleteSessionId(session.sessionId);
                    }} value={session.sessionId} className="hover:bg-gray-100 dark:hover:bg-gray-700 bg-background text-sm p-2 text-red-400 cursor-pointer">
                      Delete
                    </button>
                  </MenuItem>
                </MenuItems>
              </Menu>

              <Link
                href={`/chat/${session.sessionId}`}
                className="px-4 py-3 flex flex-col gap-y-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors mb-2 border border-gray-200 dark:border-gray-600"
                onClick={() => setIsOpen(false)}
              >
                <div className="flex mr-auto">
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-2">
                    {session.firstMessage}
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {session.timestamp.toLocaleDateString()} at{" "}
                  {session.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>

              </Link>

            </div>

          ))}

          {!isHistoryLoading && sessions.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              No chat history yet
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}
