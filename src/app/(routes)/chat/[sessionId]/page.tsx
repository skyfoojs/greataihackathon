// app/chat/[sessionId]/page.tsx
"use client";

import ChatArea from "@/components/ChatArea";
import ChatHistorySidebar from "@/components/ChatHistorySidebar";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import PreAuth from "@/components/PreAuth";
import { useParams } from "next/navigation";
import { isValidSessionId } from "@/utils/session";
import { useEffect, useState } from "react";

export default function ChatSessionPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    setIsValid(isValidSessionId(sessionId));
  }, [sessionId]);

  function InvalidChat() {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500 font-bold">Invalid chat session</div>
      </div>
    );
  }
  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-gray-900 dark:text-white min-h-screen flex flex-col">
      <Navbar />
      <PreAuth>
        <Sidebar page="chat" />
        {!isValid ? <InvalidChat /> : <ChatHistorySidebar />}
        {!isValid ? null : <ChatArea sessionId={sessionId} />}
      </PreAuth>
    </div>
  );
}
