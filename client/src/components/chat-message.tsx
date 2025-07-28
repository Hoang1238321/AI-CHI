import { Brain, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "./markdown-renderer";

interface ChatMessageProps {
  content: string;
  isUser: boolean;
  className?: string;
}

export function ChatMessage({ content, isUser, className }: ChatMessageProps) {
  return (
    <div className={cn("flex message-fade-in mb-6 chat-message", isUser ? "justify-end" : "", className)}>
      {isUser ? (
        <div className="bg-blue-600 rounded-lg p-4 max-w-3xl shadow-sm chat-message">
          <p className="text-white leading-relaxed chat-message">{content}</p>
        </div>
      ) : (
        <>
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mr-4 flex-shrink-0 shadow-md">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-5 max-w-4xl shadow-sm border border-gray-200 dark:border-gray-700 chat-message">
            <MarkdownRenderer 
              content={content} 
              className="text-gray-900 dark:text-gray-100 markdown-content"
            />
          </div>
        </>
      )}
    </div>
  );
}
