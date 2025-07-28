import { useState, useRef, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessage } from "@/components/chat-message";
import { subjects } from "@/lib/subjects";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAIModel } from "@/contexts/ai-model-context";
import { useAuth } from "@/contexts/auth-context";

interface Message {
  content: string;
  isUser: boolean;
  id: string;
}

export default function QAChat() {
  const [, params] = useRoute("/qa/:id");
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { model } = useAIModel();
  const { user } = useAuth();
  
  const subject = subjects.find(s => s.id === params?.id);
  
  // Get sessionId from URL parameters  
  const urlParams = new URLSearchParams(window.location.search);
  const urlSessionId = urlParams.get('sessionId');
  
  // Message cache to avoid reloading
  const [messageCache, setMessageCache] = useState<Record<number, Message[]>>({});
  
  // Load chat history if sessionId is provided in URL
  useEffect(() => {
    if (subject && user?.id && urlSessionId) {
      const sessionIdNum = parseInt(urlSessionId);
      setSessionId(sessionIdNum);
      
      // Check cache first for instant loading
      if (messageCache[sessionIdNum]) {
        setMessages(messageCache[sessionIdNum]);
      } else {
        setIsLoadingHistory(true);
        loadChatHistory(sessionIdNum);
      }
    } else if (subject) {
      // Add initial AI greeting for new sessions
      setMessages([
        {
          id: "1",
          content: `Xin chào! Tôi là AI trợ giảng ${subject.name}. Tôi sẽ giải thích một cách dễ hiểu nhất!`,
          isUser: false,
        }
      ]);
    }
  }, [subject, user?.id, urlSessionId]);

  // Listen for navigation changes
  useEffect(() => {
    const handlePopState = () => {
      const newUrlParams = new URLSearchParams(window.location.search);
      const newSessionId = newUrlParams.get('sessionId');
      
      if (newSessionId) {
        const sessionIdNum = parseInt(newSessionId);
        setSessionId(sessionIdNum);
        
        // Check cache first for instant loading
        if (messageCache[sessionIdNum]) {
          setMessages(messageCache[sessionIdNum]);
        } else {
          setIsLoadingHistory(true);
          loadChatHistory(sessionIdNum);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [messageCache]);

  const loadChatHistory = async (sessionIdToLoad: number) => {
    try {
      // Check cache first
      if (messageCache[sessionIdToLoad]) {
        setMessages(messageCache[sessionIdToLoad]);
        setIsLoadingHistory(false);
        return;
      }

      const response = await fetch(`/api/chat/session/${sessionIdToLoad}/messages`);
      const data = await response.json();
      
      if (data.success && data.messages) {
        const loadedMessages: Message[] = data.messages.map((msg: any, index: number) => ({
          id: (index + 1).toString(),
          content: msg.content,
          isUser: msg.isUser,
        }));
        
        // Cache the messages and update current messages
        setMessageCache(prev => ({
          ...prev,
          [sessionIdToLoad]: loadedMessages
        }));
        setMessages(loadedMessages);
        
        // Also cache in current session for immediate new messages
        if (sessionIdToLoad === sessionId && messages.length > 0) {
          setMessageCache(prev => ({
            ...prev,
            [sessionIdToLoad]: [...loadedMessages]
          }));
        }
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      // Fallback to initial greeting if loading fails
      setMessages([
        {
          id: "1",
          content: `Xin chào! Tôi là AI trợ giảng ${subject?.name}. Tôi sẽ giải thích một cách dễ hiểu nhất!`,
          isUser: false,
        }
      ]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async () => {
    const message = inputValue.trim();
    if (!message || isLoading || !subject || !user) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: message,
      isUser: true,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      // Create or get session ID
      let currentSessionId = sessionId;
      
      // Debug log
      console.log('Sending chat request:', {
        message,
        subjectId: subject.id,
        model,
        userId: user?.id,
        sessionId,
        userObject: user,
        userType: typeof user?.id,
        userHasId: !!user?.id
      });

      // Send request to ChatGPT API
      const response = await apiRequest('POST', '/api/chat/send', {
        message,
        subjectId: subject.id,
        context: `Học sinh đang học môn ${subject.name}`,
        model,
        userId: user?.id,
        sessionId
      });

      const data = await response.json();
      
      if (data.success) {
        // Update sessionId if this was a new session
        if (data.sessionId && !sessionId) {
          setSessionId(data.sessionId);
          
          // Update URL to include sessionId without page reload
          const newUrl = `/qa/${subject.id}?sessionId=${data.sessionId}`;
          window.history.replaceState({}, '', newUrl);
          
          // Invalidate chat sessions to refresh sidebar (throttled)
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['/api/chat/sessions', user?.id] });
          }, 500);
        }
        
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          content: data.response,
          isUser: false,
        };
        
        const newMessages = [...messages, aiResponse];
        setMessages(newMessages);
        
        // Update cache with new message
        if (sessionId) {
          setMessageCache(prev => ({
            ...prev,
            [sessionId]: newMessages
          }));
        }
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: "Xin lỗi, có lỗi xảy ra khi xử lý câu hỏi của bạn. Vui lòng thử lại sau.",
        isUser: false,
      };
      setMessages(prev => [...prev, errorResponse]);
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user?.id) {
      console.error('User not authenticated');
      return;
    }

    console.log('Uploading file:', file.name);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.id.toString());
      if (subject?.id) {
        formData.append('subjectId', subject.id);
      }
      if (sessionId) {
        formData.append('sessionId', sessionId.toString());
      }

      const response = await fetch('/api/temp-documents/upload', {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header, let browser set it automatically with boundary
      });

      const result = await response.json();

      if (result.success) {
        // Set uploaded file name to display above input
        setUploadedFileName(file.name);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('File upload error:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: `❌ Lỗi khi tải lên tài liệu: ${error instanceof Error ? error.message : String(error)}`,
        isUser: false,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleTextareaInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  };

  if (!subject) {
    setLocation("/");
    return null;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center p-4 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation(`/subject/${subject.id}`)}
          className="mr-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{subject.name}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">AI Trợ giảng</p>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 p-6 overflow-auto chat-container bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-4 mb-6">
            {isLoadingHistory ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-400">Đang tải lịch sử chat...</span>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    content={message.content}
                    isUser={message.isUser}
                  />
                ))}
                {isLoading && (
                  <ChatMessage
                    content="Đang xử lý câu trả lời... ⏳ Quá trình trả lời có thể sẽ mất tới 1 phút"
                    isUser={false}
                  />
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Chat Input */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-100 dark:bg-gray-800">
        <div className="max-w-4xl mx-auto">
          {/* Show uploaded file name above input */}
          {uploadedFileName && (
            <div className="mb-3 p-2 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-green-800 dark:text-green-300 text-sm font-medium">
                  📄 {uploadedFileName}
                </span>
                <button 
                  onClick={() => setUploadedFileName(null)}
                  className="ml-auto text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
                  title="Ẩn thông báo"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
          <div className="flex items-end space-x-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.bmp,.tiff,.gif"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              size="icon"
              variant="ghost"
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Tải lên tài liệu (PDF, DOCX, hình ảnh, text)"
              onClick={handleFileUpload}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  handleTextareaInput();
                }}
                onKeyDown={handleKeyDown}
                placeholder={`Hỏi về ${subject.name}...`}
                className="resize-none bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                rows={1}
              />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
