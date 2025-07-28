import { Subject } from "@shared/schema";
import { LucideIcon } from "lucide-react";
import { 
  Calculator,
  BookOpen,
  Languages, 
  Clock, 
  Globe, 
  Microscope, 
  Zap, 
  FlaskConical 
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap: Record<string, LucideIcon> = {
  calculator: Calculator,
  "square-root": Calculator,
  "book-text": BookOpen,
  languages: Languages,
  history: Clock,
  earth: Globe,
  microscope: Microscope,
  zap: Zap,
  beaker: FlaskConical,
};

interface SubjectCardProps {
  subject: Subject;
  onClick: () => void;
}

export function SubjectCard({ subject, onClick }: SubjectCardProps) {
  const Icon = iconMap[subject.icon] || Calculator;

  return (
    <div
      className={cn(
        "subject-card bg-gradient-to-br rounded-xl p-6 cursor-pointer hover:scale-105 transition-transform duration-200",
        subject.gradientFrom,
        subject.gradientTo
      )}
      onClick={onClick}
      data-subject-id={subject.id}
    >
      <div className="flex items-center justify-between mb-4">
        <Icon className="w-6 h-6 text-white" />
        <div className="w-3 h-3 bg-white bg-opacity-30 rounded-full"></div>
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">
        {subject.name}
      </h3>
      <p className="text-white text-opacity-80 text-sm">
        {subject.description}
      </p>
    </div>
  );
}
