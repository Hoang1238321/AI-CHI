import { useState, useRef, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Video, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { subjects } from "@/lib/subjects";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { apiRequest } from "@/lib/queryClient";
import { useAIModel } from "@/contexts/ai-model-context";
import { useAuth } from "@/contexts/auth-context";

interface VideoMessage {
  content: string;
  isUser: boolean;
  id: string;
}

export default function VideoView() {
  const [, params] = useRoute("/video/:id");
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<VideoMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [currentVideo, setCurrentVideo] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string>("");
  const [autoPlay, setAutoPlay] = useState<boolean>(false);
  const [messageCache, setMessageCache] = useState<Record<number, VideoMessage[]>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { model } = useAIModel();
  const { user } = useAuth();
  
  const subject = subjects.find(s => s.id === params?.id);

  useEffect(() => {
    if (subject) {
      // Check for sessionId in URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const sessionIdFromUrl = urlParams.get('sessionId');
      
      if (sessionIdFromUrl) {
        // Load existing chat session
        const sessionIdNum = parseInt(sessionIdFromUrl);
        setSessionId(sessionIdNum);
        
        // Check cache first for instant loading
        if (messageCache[sessionIdNum]) {
          setMessages(messageCache[sessionIdNum]);
        } else {
          loadChatHistory(sessionIdNum);
        }
      } else {
        // Add initial AI greeting for video context
        setMessages([
          {
            id: "1",
            content: `Xin chào! Tôi là AI trợ giảng ${subject.name} cho phần video. Hãy hỏi tôi về bất kỳ nội dung video nào bạn muốn tìm hiểu!`,
            isUser: false,
          }
        ]);
      }
    }
  }, [subject]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Listen for navigation changes to handle sidebar clicks
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
          loadChatHistory(sessionIdNum);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [messageCache]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async () => {
    const message = inputValue.trim();
    if (!message || isLoading || !subject || !user) return;

    const userMessage: VideoMessage = {
      id: Date.now().toString(),
      content: message,
      isUser: true,
    };

    setMessages(prev => {
      const newMessages = [...prev, userMessage];
      // Update cache with user message immediately
      if (sessionId) {
        setMessageCache(prevCache => ({
          ...prevCache,
          [sessionId]: newMessages
        }));
      }
      return newMessages;
    });
    setInputValue("");
    setIsLoading(true);

    try {
      // Send request to Video Chat API with enhanced transcript search
      const response = await apiRequest('POST', '/api/video/chat', {
        message,
        subjectId: subject.id,
        model,
        userId: user?.id,
        sessionId
      });

      const data = await response.json();
      
      if (data.success) {
        // Update sessionId if this was a new session
        if (data.sessionId && !sessionId) {
          setSessionId(data.sessionId);
          // Update URL with new sessionId for future navigation
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('sessionId', data.sessionId.toString());
          window.history.pushState({}, '', newUrl.toString());
        }
        
        // Handle video display action
        if (data.action === 'SHOW_VIDEO') {
          try {
            // Check if server provided specific video ID from vector search
            if (data.videoId) {
              // Use the specific video chosen by vector search
              const videoUrl = `/api/video/file/${user?.id}/${data.videoId}`;
              setCurrentVideo(videoUrl);
              setVideoTitle('Video được chọn dựa trên nội dung câu hỏi');
              // Enable auto-play if server requested it
              if (data.autoPlay) {
                setAutoPlay(true);
              }
            } else {
              // Fallback: Find the most recent video file
              const videosResponse = await apiRequest('GET', `/api/video/processed/${user?.id}`);
              const videosData = await videosResponse.json();
              
              if (videosData.success && videosData.videos.length > 0) {
                const latestVideo = videosData.videos[videosData.videos.length - 1];
                const videoUrl = `/api/video/file/${user?.id}/${latestVideo}`;
                setCurrentVideo(videoUrl);
                setVideoTitle('Video học tập từ Google Drive');
              }
            }
          } catch (videoError) {
            console.error('Error loading video:', videoError);
          }
        }
        
        const aiResponse: VideoMessage = {
          id: (Date.now() + 1).toString(),
          content: data.response,
          isUser: false,
        };
        setMessages(prev => {
          const newMessages = [...prev, aiResponse];
          // Update cache for current session
          if (sessionId) {
            setMessageCache(prevCache => ({
              ...prevCache,
              [sessionId]: newMessages
            }));
          }
          return newMessages;
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      const errorResponse: VideoMessage = {
        id: (Date.now() + 1).toString(),
        content: "Xin lỗi, có lỗi xảy ra khi xử lý câu hỏi của bạn. Vui lòng thử lại sau.",
        isUser: false,
      };
      setMessages(prev => [...prev, errorResponse]);
      console.error('Video chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadChatHistory = async (sessionIdToLoad: number) => {
    try {
      // Check cache first
      if (messageCache[sessionIdToLoad]) {
        setMessages(messageCache[sessionIdToLoad]);
        return;
      }

      const response = await fetch(`/api/chat/session/${sessionIdToLoad}/messages`);
      const data = await response.json();
      
      if (data.success && data.messages && data.messages.length > 0) {
        const formattedMessages: VideoMessage[] = data.messages.map((msg: any, index: number) => ({
          id: (index + 1).toString(),
          content: msg.content,
          isUser: msg.isUser
        }));
        
        // Cache the messages for instant future access
        setMessageCache(prev => ({
          ...prev,
          [sessionIdToLoad]: formattedMessages
        }));
        setMessages(formattedMessages);
      } else {
        // If no messages found, show default greeting
        const defaultMessage = [{
          id: "1",
          content: `Xin chào! Tôi là AI trợ giảng ${subject?.name} cho phần video. Hãy hỏi tôi về bất kỳ nội dung video nào bạn muốn tìm hiểu!`,
          isUser: false,
        }];
        setMessages(defaultMessage);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      // Fallback to default greeting
      const defaultMessage = [{
        id: "1", 
        content: `Xin chào! Tôi là AI trợ giảng ${subject?.name} cho phần video. Hãy hỏi tôi về bất kỳ nội dung video nào bạn muốn tìm hiểu!`,
        isUser: false,
      }];
      setMessages(defaultMessage);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  if (!subject) {
    setLocation("/");
    return null;
  }

  return (
    <div className="h-full flex">
      {/* Video Panel */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center p-4 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation(`/subject/${subject.id}`)}
            className="mr-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {subject.name} - Video Q&A
          </h2>
        </div>

        <div className="flex-1 bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          {currentVideo ? (
            <div className="w-full h-full flex flex-col">
              <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  🎥 {videoTitle || 'Video học tập'}
                </h3>
              </div>
              <div className="flex-1 p-4 flex items-center justify-center relative">
                <div className="w-full max-w-4xl">
                  <video
                    ref={videoRef}
                    key={currentVideo} // Force reload when URL changes
                    controls
                    autoPlay={autoPlay}
                    className="w-full h-auto rounded-lg shadow-lg bg-black"
                    src={currentVideo}
                    onCanPlay={() => {
                      // Auto-play if requested
                      if (autoPlay && videoRef.current) {
                        videoRef.current.play().catch(() => {
                          // Browser prevented auto-play
                        });
                      }
                    }}
                    onPlay={() => {
                      setAutoPlay(false); // Reset auto-play after first play
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLVideoElement;
                      if (target.error) {
                        console.error('Video error:', target.error.message);
                      }
                    }}
                    preload="none" 
                    muted
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <p className="text-gray-600 dark:text-gray-400">
                      Trình duyệt không hỗ trợ phát video.
                    </p>
                  </video>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-24 h-24 bg-gray-300 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video className="w-12 h-12 text-gray-600 dark:text-gray-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Chưa có video</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Hãy hỏi AI trợ giảng để bắt đầu học tập hoặc yêu cầu "xem video"
              </p>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                💡 Thử hỏi: "Xem video", "Hiển thị video", hoặc "Mở video để học"
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Video Q&A Assistant Panel */}
      <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Video className="w-5 h-5 text-blue-500 mr-2" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Video Q&A Assistant</h3>
          </div>
        </div>

        <div className="flex-1 p-4 overflow-auto">
          {messages.length > 0 ? (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isUser ? "justify-end" : "justify-start"} chat-message`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 text-sm chat-message ${
                      message.isUser
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    }`}
                  >
                    <div className="chat-message">
                      {message.isUser ? (
                        message.content
                      ) : (
                        <MarkdownRenderer content={message.content} className="markdown-content" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg p-3 text-sm">
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="text-center text-gray-600 dark:text-gray-400 mt-8">
              <MessageCircle className="w-16 h-16 mx-auto mb-4" />
              <p className="text-sm">
                🎬 Chào bạn! Tôi là trợ giảng AI chuyên về video học tập. 
                Hãy hỏi về nội dung video hoặc nói "xem video" để hiển thị video
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Hỏi về nội dung video hoặc bài học..."
              className="flex-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm"
              disabled={isLoading}
            />
            <Button 
              size="icon" 
              onClick={handleSendMessage}
              disabled={isLoading || !inputValue.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
