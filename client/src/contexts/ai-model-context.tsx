import { createContext, useContext, useState } from "react";

type AIModel = "gpt-3.5-turbo" | "gpt-4o";

interface AIModelContextType {
  model: AIModel;
  setModel: (model: AIModel) => void;
}

const AIModelContext = createContext<AIModelContextType | undefined>(undefined);

export function AIModelProvider({ children }: { children: React.ReactNode }) {
  const [model, setModel] = useState<AIModel>(() => {
    const stored = localStorage.getItem("ai-model");
    return (stored as AIModel) || "gpt-4o";
  });

  const handleSetModel = (newModel: AIModel) => {
    setModel(newModel);
    localStorage.setItem("ai-model", newModel);
  };

  return (
    <AIModelContext.Provider value={{ model, setModel: handleSetModel }}>
      {children}
    </AIModelContext.Provider>
  );
}

export function useAIModel() {
  const context = useContext(AIModelContext);
  if (context === undefined) {
    throw new Error("useAIModel must be used within an AIModelProvider");
  }
  return context;
}