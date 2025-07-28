import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  Home, 
  HardDriveUpload, 
  Settings, 
  Menu, 
  X, 
  Brain,
  MessageSquare,
  Clock,
  Trash2,
  Video,
  HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { SettingsModal } from "@/components/settings-modal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";


interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deletingSessionId, setDeletingSessionId] = useState<number | null>(null);

  const navItems = [
    { href: "/", icon: Home, label: "Trang chủ" },
    { href: "/google-drive", icon: HardDriveUpload, label: "Thêm tài liệu Google Drive" },
  ];

  // Get chat history
  const { data: chatSessions, isLoading: isLoadingChats } = useQuery({
    queryKey: ['/api/chat/sessions', user?.id],
    queryFn: async () => {
      if (!user?.id) return { sessions: [] };
      const response = await fetch(`/api/chat/sessions/${user.id}`);
      const data = await response.json();
      return data;
    },
    enabled: !!user?.id,
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      return apiRequest('DELETE', `/api/chat/sessions/${sessionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/sessions', user?.id] });
      toast({
        title: "Đã xóa",
        description: "Cuộc trò chuyện đã được xóa thành công",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa cuộc trò chuyện",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setDeletingSessionId(null);
    },
  });

  const handleDeleteSession = async (sessionId: number) => {
    setDeletingSessionId(sessionId);
    deleteSessionMutation.mutate(sessionId);
  };

  const getSubjectById = (subjectId: string) => {
    const subjectMap: Record<string, { name: string; color: string }> = {
      "MATH_001": { name: "Toán", color: "text-blue-600 dark:text-blue-400" },
      "LIT_001": { name: "Văn", color: "text-purple-600 dark:text-purple-400" },
      "ENG_001": { name: "Anh", color: "text-green-600 dark:text-green-400" },
      "HIS_001": { name: "Sử", color: "text-orange-600 dark:text-orange-400" },
      "GEO_001": { name: "Địa", color: "text-teal-600 dark:text-teal-400" },
      "BIO_001": { name: "Sinh", color: "text-emerald-600 dark:text-emerald-400" },
      "PHY_001": { name: "Lý", color: "text-red-600 dark:text-red-400" },
      "CHE_001": { name: "Hóa", color: "text-yellow-600 dark:text-yellow-400" }
    };
    return subjectMap[subjectId] || { name: subjectId, color: "text-gray-600 dark:text-gray-400" };
  };

  // Group sessions by subject
  const groupedSessions = chatSessions?.success ? 
    chatSessions.sessions.reduce((acc: any, session: any) => {
      if (!acc[session.subjectId]) {
        acc[session.subjectId] = [];
      }
      acc[session.subjectId].push(session);
      return acc;
    }, {}) : {};

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-gray-100 dark:bg-gray-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between h-16 px-4 bg-gray-200 dark:bg-gray-900">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">AI Học tập</h1>
              <p className="text-xs text-gray-600 dark:text-gray-400">Học thông minh</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="lg:hidden text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="mt-4 px-4">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant={location === item.href ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start mb-2",
                  location === item.href 
                    ? "bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white" 
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                <item.icon className="mr-3 h-4 w-4 text-blue-400" />
                {item.label}
              </Button>
            </Link>
          ))}

          <div className="mt-6">
            <h3 className="px-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Lịch sử chat
            </h3>
            <div className="mt-2 max-h-96 overflow-y-auto">
              {isLoadingChats ? (
                <div className="px-3 py-2">
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-1"></div>
                        <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : chatSessions?.success && chatSessions.sessions?.length > 0 ? (
                Object.entries(groupedSessions).map(([subjectId, sessions]: [string, any[]]) => (
                  <div key={subjectId} className="mb-4">
                    <div className="px-3 mb-2">
                      <h4 className={`text-xs font-semibold uppercase tracking-wider ${getSubjectById(subjectId).color}`}>
                        {getSubjectById(subjectId).name}
                      </h4>
                    </div>
                    {sessions.map((session: any) => (
                  <div
                    key={session.id}
                    className="mx-2 mb-2 p-2 rounded-md bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors group cursor-pointer"
                    onClick={() => {
                      // Navigate to appropriate route based on session type
                      const basePath = session.sessionType === 'video' ? '/video' : '/qa';
                      const newPath = `${basePath}/${session.subjectId}?sessionId=${session.id}`;
                      window.history.pushState({}, '', newPath);
                      window.dispatchEvent(new PopStateEvent('popstate'));
                    }}
                    onMouseEnter={() => {
                      // Preload messages on hover for instant loading
                      fetch(`/api/chat/session/${session.id}/messages`)
                        .then(response => response.json())
                        .catch(() => {});
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-1">
                          {session.sessionType === 'video' ? (
                            <Video className="w-3 h-3 text-purple-500 flex-shrink-0" />
                          ) : (
                            <HelpCircle className="w-3 h-3 text-blue-500 flex-shrink-0" />
                          )}
                          <span className={`text-xs font-medium ${getSubjectById(session.subjectId).color}`}>
                            {getSubjectById(session.subjectId).name}
                          </span>
                          <span className="text-xs text-gray-500">
                            • {session.sessionType === 'video' ? 'Video' : 'Q&A'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 leading-relaxed">
                          {session.title}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3 text-gray-500" />
                          <span className="text-xs text-gray-500">
                            {new Date(session.createdAt).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteSession(session.id);
                        }}
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        disabled={deletingSessionId === session.id}
                        title="Xóa cuộc trò chuyện"
                      >
                        {deletingSessionId === session.id ? (
                          <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                    ))}
                  </div>
                ))
              ) : (
                <div className="px-3 py-6 text-center">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400 opacity-50" />
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    Chưa có lịch sử chat
                  </p>
                </div>
              )}
            </div>
          </div>
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-gray-300 dark:border-gray-700">
          <div className="flex items-center">
            {user?.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || 'User'} 
                className="w-8 h-8 rounded-full mr-3"
              />
            ) : (
              <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center mr-3">
                <span className="text-sm font-medium text-white">
                  {user?.displayName?.[0] || user?.email?.[0] || 'U'}
                </span>
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm font-medium truncate text-gray-900 dark:text-white">
                {user?.displayName || user?.email || 'Học sinh'}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Học sinh</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            onClick={() => setShowSettings(true)}
            className="mt-2 w-full justify-start text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
          >
            <Settings className="mr-3 h-4 w-4" />
            Cài đặt
          </Button>
        </div>
      </div>

      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </>
  );
}
