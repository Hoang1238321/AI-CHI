import { useState, useRef } from "react";
import { Upload, Folder, File, Trash2, Download, RefreshCw, AlertCircle, FileText, Video, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
  modifiedTime: string;
  webViewLink: string;
}

export function GoogleDrivePage() {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processingPdf, setProcessingPdf] = useState<string | null>(null);
  const [processingVideo, setProcessingVideo] = useState<string | null>(null);
  const { user } = useAuth(); // Add user from auth context

  // Fetch files
  const { data: driveData, isLoading, error } = useQuery({
    queryKey: ['/api/drive/files', currentFolderId],
    queryFn: async () => {
      const url = currentFolderId 
        ? `/api/drive/files?folderId=${currentFolderId}`
        : '/api/drive/files';
      const response = await apiRequest('GET', url);
      return response.json();
    },
  });

  // Upload files mutation
  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });
      if (currentFolderId) {
        formData.append('folderId', currentFolderId);
      }

      return fetch('/api/drive/upload', {
        method: 'POST',
        body: formData,
      }).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drive/files'] });
      setSelectedFiles(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      toast({
        title: "Thành công",
        description: "Tệp đã được tải lên Google Drive",
      });
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: "Không thể tải lên tệp",
        variant: "destructive",
      });
    },
  });

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async (folderName: string) => {
      const response = await apiRequest('POST', '/api/drive/create-folder', { 
        name: folderName,
        parentFolderId: currentFolderId 
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drive/files'] });
      setNewFolderName("");
      setIsCreateFolderOpen(false);
      toast({
        title: "Thành công",
        description: "Thư mục đã được tạo",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể tạo thư mục",
        variant: "destructive",
      });
    },
  });

  // Delete file mutation
  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const response = await apiRequest('DELETE', `/api/drive/files/${fileId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drive/files'] });
      toast({
        title: "Thành công",
        description: "Tệp đã được xóa",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa tệp",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(event.target.files);
  };

  // Process PDF with OCR
  const processPdfMutation = useMutation({
    mutationFn: async ({ fileId, fileName }: { fileId: string; fileName: string }) => {
      const response = await apiRequest('POST', '/api/documents/process-pdf', { 
        fileId,
        userId: 3, // Current user ID
        // Let server auto-detect subject from filename
        // subjectId and subjectNumericId will be auto-detected
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Xử lý PDF thành công",
        description: `${data.message}`,
      });
      setProcessingPdf(null);
    },
    onError: (error) => {
      toast({
        title: "Lỗi xử lý PDF",
        description: `Không thể xử lý PDF: ${error.message}`,
        variant: "destructive",
      });
      setProcessingPdf(null);
    },
  });

  const handleProcessPDF = (fileId: string, fileName: string) => {
    setProcessingPdf(fileId);
    processPdfMutation.mutate({ fileId, fileName });
  };

  // Video processing mutation
  const processVideoMutation = useMutation({
    mutationFn: async ({ fileId, fileName }: { fileId: string; fileName: string }) => {
      const response = await apiRequest('POST', '/api/video/process', {
        fileId,
        fileName,
        userId: user?.id || 5 // Pass current user ID with fallback
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Video processing completed",
        description: `Successfully processed video: ${data.result?.originalFilename}`,
      });
      setProcessingVideo(null);
    },
    onError: (error: any) => {
      toast({
        title: "Video processing failed", 
        description: error?.message || "Unable to process video",
        variant: "destructive",
      });
      setProcessingVideo(null);
    },
  });

  const handleProcessVideo = (fileId: string, fileName: string) => {
    console.log('🎬 DEBUG: handleProcessVideo called');
    console.log('🔑 DEBUG: user object:', user);
    console.log('🆔 DEBUG: user ID:', user?.id);
    console.log('📹 DEBUG: fileId:', fileId);
    console.log('📄 DEBUG: fileName:', fileName);
    
    if (!user?.id) {
      console.error('❌ DEBUG: User ID is undefined!');
      toast({
        title: "Lỗi xác thực",
        description: "Không thể xác định người dùng. Vui lòng đăng nhập lại.",
        variant: "destructive",
      });
      return;
    }
    
    setProcessingVideo(fileId);
    processVideoMutation.mutate({ fileId, fileName });
  };

  const handleUpload = () => {
    if (selectedFiles) {
      uploadMutation.mutate(selectedFiles);
    }
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolderMutation.mutate(newFolderName.trim());
    }
  };

  const handleFileClick = (file: DriveFile) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      setCurrentFolderId(file.id);
    } else {
      // Open file in new tab
      window.open(file.webViewLink, '_blank');
    }
  };

  const formatFileSize = (bytes?: string) => {
    if (!bytes) return 'N/A';
    const size = parseInt(bytes);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/vnd.google-apps.folder') {
      return <Folder className="w-5 h-5 text-blue-500" />;
    }
    if (mimeType === 'application/pdf') {
      return <FileText className="w-5 h-5 text-red-500" />;
    }
    if (mimeType.startsWith('video/')) {
      return <Video className="w-5 h-5 text-purple-500" />;
    }
    return <File className="w-5 h-5 text-gray-500" />;
  };

  const isVideoFile = (mimeType: string) => {
    return mimeType.startsWith('video/');
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">
              Lỗi kết nối Google Drive
            </h2>
            <p className="text-red-600 dark:text-red-300 mb-4">
              Không thể kết nối đến Google Drive. Vui lòng kiểm tra cấu hình Service Account.
            </p>
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Thử lại
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Quản lý tài liệu Google Drive
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Tải lên và quản lý tài liệu học tập từ Google Drive thông qua WebDAV
          </p>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex gap-2">
            <Input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button variant="outline" className="cursor-pointer">
                <Upload className="w-4 h-4 mr-2" />
                Chọn tệp
              </Button>
            </label>
            {selectedFiles && (
              <Button 
                onClick={handleUpload} 
                disabled={uploadMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {uploadMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Tải lên ({selectedFiles.length} tệp)
              </Button>
            )}
          </div>

          <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Folder className="w-4 h-4 mr-2" />
                Tạo thư mục
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white dark:bg-gray-800">
              <DialogHeader>
                <DialogTitle className="text-gray-900 dark:text-white">Tạo thư mục mới</DialogTitle>
                <DialogDescription className="text-gray-600 dark:text-gray-400">
                  Nhập tên cho thư mục mới
                </DialogDescription>
              </DialogHeader>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Tên thư mục"
                className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateFolderOpen(false)}>
                  Hủy
                </Button>
                <Button 
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim() || createFolderMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {createFolderMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Tạo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button 
            variant="outline" 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/drive/files'] })}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>

          {currentFolderId && (
            <Button variant="outline" onClick={() => setCurrentFolderId(undefined)}>
              ← Quay lại thư mục gốc
            </Button>
          )}
        </div>

        {/* WebDAV Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
            🌐 WebDAV Server
          </h3>
          <p className="text-blue-600 dark:text-blue-300 text-sm">
            Truy cập tài liệu qua WebDAV tại: <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">http://localhost:8080</code>
          </p>
        </div>

        {/* Files Grid */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          {isLoading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">Đang tải danh sách tệp...</p>
            </div>
          ) : driveData?.files?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="text-left p-4 font-medium text-gray-900 dark:text-white">Tên</th>
                    <th className="text-left p-4 font-medium text-gray-900 dark:text-white">Kích thước</th>
                    <th className="text-left p-4 font-medium text-gray-900 dark:text-white">Ngày sửa đổi</th>
                    <th className="text-left p-4 font-medium text-gray-900 dark:text-white">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {driveData.files.map((file: DriveFile) => (
                    <tr key={file.id} className="border-t border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="p-4">
                        <div 
                          className="flex items-center cursor-pointer"
                          onClick={() => handleFileClick(file)}
                        >
                          {getFileIcon(file.mimeType)}
                          <span className="ml-3 text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                            {file.name}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-gray-600 dark:text-gray-400">
                        {formatFileSize(file.size)}
                      </td>
                      <td className="p-4 text-gray-600 dark:text-gray-400">
                        {new Date(file.modifiedTime).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(file.webViewLink, '_blank')}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          
                          {file.mimeType === 'application/pdf' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleProcessPDF(file.id, file.name)}
                              disabled={processingPdf === file.id}
                              className="text-green-600 hover:text-green-700"
                              title={`Xử lý OCR và tự động nhận diện môn học từ "${file.name}"`}
                            >
                              {processingPdf === file.id ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <FileText className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                          
                          {isVideoFile(file.mimeType) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleProcessVideo(file.id, file.name)}
                              disabled={processingVideo === file.id}
                              className="text-purple-600 hover:text-purple-700"
                              title={`Xử lý tài liệu video - Chuyển đổi thành văn bản từ "${file.name}"`}
                            >
                              {processingVideo === file.id ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-white dark:bg-gray-800">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-gray-900 dark:text-white">
                                  Xác nhận xóa
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-gray-600 dark:text-gray-400">
                                  Bạn có chắc chắn muốn xóa "{file.name}"? Hành động này không thể hoàn tác.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(file.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Xóa
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <Folder className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500 mb-2">Không có tệp nào</p>
              <p className="text-sm text-gray-400">Tải lên tệp đầu tiên để bắt đầu</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}