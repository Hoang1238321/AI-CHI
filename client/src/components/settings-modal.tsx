import { useState } from "react";
import { X, User, Palette, Brain, LogOut, Sun, Moon, Monitor, MessageSquare, Clock, History } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { useAIModel } from "@/contexts/ai-model-context";
import { signOutUser } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { subjects } from "@/lib/subjects";
import { ChatHistoryModal } from "@/components/chat-history-modal";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { model, setModel } = useAIModel();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Get chat history
  const { data: chatSessions } = useQuery({
    queryKey: ['/api/chat/sessions', user?.id],
    queryFn: async () => {
      if (!user?.id) return { sessions: [] };
      const response = await fetch(`/api/chat/sessions/${user.id}`);
      const data = await response.json();
      return data;
    },
    enabled: !!user?.id,
  });

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOutUser();
      toast({
        title: "Đăng xuất thành công",
        description: "Bạn đã đăng xuất khỏi AI Học tập",
      });
      onClose();
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        variant: "destructive",
        title: "Lỗi đăng xuất",
        description: "Có lỗi xảy ra khi đăng xuất. Vui lòng thử lại.",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Cài đặt</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Quản lý tài khoản và tùy chỉnh giao diện theo sở thích của bạn
          </p>

          <Tabs defaultValue="account" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-gray-700">
              <TabsTrigger 
                value="account" 
                className="data-[state=active]:bg-gray-600 data-[state=active]:text-white"
              >
                <User className="w-4 h-4 mr-1" />
                Tài khoản
              </TabsTrigger>
              <TabsTrigger 
                value="interface"
                className="data-[state=active]:bg-gray-600 data-[state=active]:text-white"
              >
                <Palette className="w-4 h-4 mr-1" />
                Giao diện
              </TabsTrigger>
              <TabsTrigger 
                value="ai"
                className="data-[state=active]:bg-gray-600 data-[state=active]:text-white"
              >
                <Brain className="w-4 h-4 mr-1" />
                AI Model
              </TabsTrigger>
              <TabsTrigger 
                value="history"
                className="data-[state=active]:bg-gray-600 data-[state=active]:text-white"
                onClick={() => setIsHistoryModalOpen(true)}
              >
                <History className="w-4 h-4 mr-1" />
                Lịch sử chat
              </TabsTrigger>
            </TabsList>

            <TabsContent value="account" className="space-y-4">
              <div className="flex items-center space-x-4">
                {user?.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || 'User'} 
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center">
                    <span className="text-lg font-medium">
                      {user?.displayName?.[0] || user?.email?.[0] || 'U'}
                    </span>
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold">
                    {user?.displayName || 'Người dùng'}
                  </h3>
                  <p className="text-gray-400">{user?.email}</p>
                </div>
              </div>

              <Button 
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
              </Button>
            </TabsContent>

            <TabsContent value="interface" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-3">Chế độ hiển thị</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={theme === "light" ? "default" : "outline"}
                      onClick={() => setTheme("light")}
                      className={`h-auto p-3 flex flex-col items-center space-y-2 ${
                        theme === "light" 
                          ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600" 
                          : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      <Sun className="w-5 h-5" />
                      <span className="text-xs">Sáng</span>
                    </Button>
                    <Button
                      variant={theme === "dark" ? "default" : "outline"}
                      onClick={() => setTheme("dark")}
                      className={`h-auto p-3 flex flex-col items-center space-y-2 ${
                        theme === "dark" 
                          ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600" 
                          : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      <Moon className="w-5 h-5" />
                      <span className="text-xs">Tối</span>
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="ai" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Chọn AI Model</h4>
                  <p className="text-xs text-gray-400 mb-3">
                    GPT-4o thông minh hơn nhưng chậm hơn. GPT-3.5 Turbo nhanh hơn nhưng ít thông minh hơn.
                  </p>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                      <SelectItem value="gpt-4o" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600">
                        <div className="flex items-center">
                          <Brain className="w-4 h-4 mr-2" />
                          <div>
                            <div className="font-medium">GPT-4o</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">Thông minh nhất, chậm hơn</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="gpt-3.5-turbo" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600">
                        <div className="flex items-center">
                          <Brain className="w-4 h-4 mr-2" />
                          <div>
                            <div className="font-medium">GPT-3.5 Turbo</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">Nhanh hơn, ít thông minh hơn</div>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>


          </Tabs>

          <div className="flex justify-end space-x-3">
            <Button variant="ghost" onClick={onClose}>
              Hủy
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700">
              Lưu thay đổi
            </Button>
          </div>
        </div>
      </DialogContent>
      
      <ChatHistoryModal 
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />
    </Dialog>
  );
}
