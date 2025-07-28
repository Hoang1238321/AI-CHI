import { useRoute } from "wouter";
import { ArrowLeft, MessageSquare, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { subjects } from "@/lib/subjects";
import { useLocation } from "wouter";

export default function SubjectSelection() {
  const [, params] = useRoute("/subject/:id");
  const [, setLocation] = useLocation();
  
  const subject = subjects.find(s => s.id === params?.id);
  
  if (!subject) {
    setLocation("/");
    return null;
  }

  const handleQAClick = () => {
    setLocation(`/qa/${subject.id}`);
  };

  const handleVideoClick = () => {
    setLocation(`/video/${subject.id}`);
  };

  return (
    <div className="p-6">
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/")}
          className="mr-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{subject.name}</h2>
          <p className="text-gray-600 dark:text-gray-400">AI Trợ giảng</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        {/* Q&A Option */}
        <div 
          className="bg-white dark:bg-gray-800 rounded-xl p-8 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors border border-gray-200 dark:border-gray-700"
          onClick={handleQAClick}
        >
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Hỏi đáp AI</h3>
            <p className="text-gray-600 dark:text-gray-400">Đặt câu hỏi và nhận câu trả lời chi tiết từ AI</p>
          </div>
        </div>

        {/* Video Option */}
        <div 
          className="bg-white dark:bg-gray-800 rounded-xl p-8 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors border border-gray-200 dark:border-gray-700"
          onClick={handleVideoClick}
        >
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Video className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Xem video</h3>
            <p className="text-gray-600 dark:text-gray-400">Học qua video với AI trợ giảng thông minh</p>
          </div>
        </div>
      </div>
    </div>
  );
}
