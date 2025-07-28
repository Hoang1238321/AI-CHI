import { subjects } from "@/lib/subjects";
import { SubjectCard } from "@/components/subject-card";
import { useLocation } from "wouter";

export default function Dashboard() {
  const [, setLocation] = useLocation();

  const handleSubjectClick = (subjectId: string) => {
    setLocation(`/subject/${subjectId}`);
  };

  return (
    <div className="p-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">
          Chào mừng đến với AI học tập
        </h1>
        <p className="text-blue-100">
          Cùng bạn chinh phục kì thi Đánh giá năng lực 2025
        </p>
      </div>

      {/* Subject Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {subjects.map((subject) => (
          <SubjectCard
            key={subject.id}
            subject={subject}
            onClick={() => handleSubjectClick(subject.id)}
          />
        ))}
      </div>
    </div>
  );
}
