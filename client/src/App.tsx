import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { ProtectedRoute } from "@/components/protected-route";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useLocation } from "wouter";

// Pages
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import SubjectSelection from "@/pages/subject-selection";
import QAChat from "@/pages/qa-chat";
import VideoView from "@/pages/video-view";
import { GoogleDrivePage } from "@/pages/google-drive";
import NotFound from "@/pages/not-found";

function AppLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [location] = useLocation();

  const getPageInfo = () => {
    switch (location) {
      case "/":
        return { title: "Dashboard", subtitle: "Chuẩn bị cho kì thi Đánh giá năng lực" };
      case "/google-drive":
        return { title: "Google Drive", subtitle: "Quản lý tài liệu học tập" };
      default:
        if (location.startsWith("/subject/")) {
          return { title: "Môn học", subtitle: "Chọn phương thức học tập" };
        } else if (location.startsWith("/qa/")) {
          return { title: "Q&A", subtitle: "Đặt câu hỏi với AI trợ giảng" };
        } else if (location.startsWith("/video/")) {
          return { title: "Video", subtitle: "Học qua video với AI" };
        }
        return { title: "AI Học tập", subtitle: "Học thông minh" };
    }
  };

  const pageInfo = getPageInfo();

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <Menu className="h-4 w-4" />
          </Button>
          
          <div className="flex-1 text-center lg:text-left lg:ml-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{pageInfo.title}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">{pageInfo.subtitle}</p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Settings removed - now accessible via sidebar */}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
          {children}
        </main>
      </div>
    </div>
  );
}

function AuthenticatedApp() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/subject/:id" component={SubjectSelection} />
        <Route path="/qa/:id" component={QAChat} />
        <Route path="/video/:id" component={VideoView} />
        <Route path="/google-drive" component={GoogleDrivePage} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 animate-spin border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400 dark:text-gray-400">Đang tải...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <AuthenticatedApp /> : <Login />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <div>
            <Toaster />
            <Router />
          </div>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
