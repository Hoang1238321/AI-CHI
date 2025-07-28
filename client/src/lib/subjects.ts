import { Subject } from "@shared/schema";

export const subjects: Subject[] = [
  {
    id: "MATH_001",
    subjectId: 1,
    name: "Toán học",
    nameEn: "math",
    description: "Giải toán, tính toán nhanh, học xA",
    icon: "square-root",
    gradientFrom: "from-pink-500",
    gradientTo: "to-pink-600",
  },
  {
    id: "LIT_001",
    subjectId: 2,
    name: "Ngữ văn",
    nameEn: "literature",
    description: "Văn học, ngữ pháp, từ vựng, tiếng việt",
    icon: "book-text",
    gradientFrom: "from-purple-500",
    gradientTo: "to-purple-600",
  },
  {
    id: "ENG_001",
    subjectId: 3,
    name: "Tiếng Anh",
    nameEn: "english",
    description: "Từ vựng, ngữ pháp, luyện thi, giao tiếp",
    icon: "languages",
    gradientFrom: "from-blue-500",
    gradientTo: "to-blue-600",
  },
  {
    id: "HIS_001",
    subjectId: 4,
    name: "Lịch sử",
    nameEn: "history",
    description: "Lịch sử Việt Nam & thế giới, sự cố",
    icon: "history",
    gradientFrom: "from-orange-500",
    gradientTo: "to-orange-600",
  },
  {
    id: "GEO_001",
    subjectId: 5,
    name: "Địa lý",
    nameEn: "geography",
    description: "Địa lý tự nhiên và kinh tế xã hội",
    icon: "earth",
    gradientFrom: "from-teal-500",
    gradientTo: "to-teal-600",
  },
  {
    id: "BIO_001",
    subjectId: 6,
    name: "Sinh học",
    nameEn: "biology",
    description: "Sinh học cơ thể và tế bào, thực vật",
    icon: "microscope",
    gradientFrom: "from-green-500",
    gradientTo: "to-green-600",
  },
  {
    id: "PHY_001",
    subjectId: 7,
    name: "Vật lý",
    nameEn: "physics",
    description: "Cơ học, điện học, nhiệt học",
    icon: "zap",
    gradientFrom: "from-indigo-500",
    gradientTo: "to-indigo-600",
  },
  {
    id: "CHE_001",
    subjectId: 8,
    name: "Hóa học",
    nameEn: "chemistry",
    description: "Hóa hữu cơ, hóa vô cơ, hóa phân tích",
    icon: "beaker",
    gradientFrom: "from-violet-500",
    gradientTo: "to-violet-600",
  },
];

// Helper function to get numeric ID from string ID
export const getSubjectNumericId = (subjectStringId: string): number => {
  const subject = subjects.find(s => s.id === subjectStringId);
  return subject?.subjectId || 1;
};

// Helper function to get string ID from numeric ID  
export const getSubjectStringId = (subjectNumericId: number): string => {
  const subject = subjects.find(s => s.subjectId === subjectNumericId);
  return subject?.id || "MATH_001";
};
