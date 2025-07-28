import { useState } from 'react';
import { useLocation } from 'wouter';
import { signInWithGmail } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Brain, Mail, Loader2 } from 'lucide-react';

export default function Login() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGmailLogin = async () => {
    setIsLoading(true);
    try {
      await signInWithGmail();
      toast({
        title: "Đăng nhập thành công!",
        description: "Chào mừng bạn đến với AI Học tập",
      });
      setLocation('/');
    } catch (error: any) {
      console.error('Login error:', error);
      
      let errorMessage = 'Có lỗi xảy ra khi đăng nhập';
      
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Đăng nhập bị hủy bởi người dùng';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Popup bị chặn, vui lòng cho phép popup và thử lại';
      } else if (error.message.includes('Gmail')) {
        errorMessage = 'Chỉ cho phép đăng nhập bằng tài khoản Gmail';
      }
      
      toast({
        variant: "destructive",
        title: "Lỗi đăng nhập",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-blue-100 to-gray-100 dark:from-gray-900 dark:via-blue-900 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Brain className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">AI Học tập</h1>
          <p className="text-blue-600 dark:text-blue-200">Học thông minh cùng AI</p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 shadow-2xl">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              Chào mừng trở lại
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Đăng nhập để tiếp tục học tập với AI
            </p>
          </div>

          {/* Gmail Login Button */}
          <Button
            onClick={handleGmailLogin}
            disabled={isLoading}
            className="w-full bg-white hover:bg-gray-100 text-gray-900 font-medium py-3 px-4 rounded-xl flex items-center justify-center space-x-3 transition-all duration-200"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Mail className="w-5 h-5 text-red-500" />
            )}
            <span>
              {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập bằng Gmail'}
            </span>
          </Button>

          {/* Info Text */}
          <div className="mt-6 p-4 bg-blue-900 bg-opacity-30 rounded-xl border border-blue-700">
            <div className="flex items-start space-x-3">
              <div className="text-blue-400 mt-1">ℹ️</div>
              <div>
                <p className="text-blue-200 text-sm">
                  <strong>Lưu ý:</strong> Chỉ hỗ trợ đăng nhập bằng tài khoản Gmail. 
                  Thông tin của bạn sẽ được bảo mật và chỉ dùng để cá nhân hóa trải nghiệm học tập.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-gray-400 text-sm">
            Bằng việc đăng nhập, bạn đồng ý với{' '}
            <span className="text-blue-400 hover:text-blue-300 cursor-pointer">
              Điều khoản sử dụng
            </span>{' '}
            và{' '}
            <span className="text-blue-400 hover:text-blue-300 cursor-pointer">
              Chính sách bảo mật
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}