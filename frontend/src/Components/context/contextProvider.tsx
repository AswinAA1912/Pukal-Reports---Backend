import React, { createContext, useContext, useState, type ReactNode } from 'react';

// Define the context type
export interface ContextData {
  Add_Rights?: number;
  Edit_Rights?: number;
  Delete_Rights?: number;
  // Add other properties as needed
}

export interface MyContextType {
  contextObj: ContextData;
  setContextObj: (obj: ContextData) => void;
}

// Create the context with proper TypeScript typing
export const MyContext = createContext<MyContextType | undefined>(undefined);

// Props for the provider component
interface ContextDataProviderProps {
  children: ReactNode;
}

// Context Provider Component
export const ContextDataProvider: React.FC<ContextDataProviderProps> = ({ children }) => {
  const [contextObj, setContextObj] = useState<ContextData>({});

  return (
    <MyContext.Provider value={{ contextObj, setContextObj }}>
      {children}
    </MyContext.Provider>
  );
};

// Custom hook to use the context
export const useMyContext = () => {
  const context = useContext(MyContext);
  if (context === undefined) {
    throw new Error('useMyContext must be used within a ContextDataProvider');
  }
  return context;
};