import { createContext, FC, ReactNode, useContext, useState } from "react";

export type SelectedToolsContextType = {
  selectedTools: Map<string, Set<string>>;
  setSelectedTools: React.Dispatch<
    React.SetStateAction<Map<string, Set<string>>>
  >;
  activationStatuses: Map<string, boolean>;
  setActivationStatuses: React.Dispatch<
    React.SetStateAction<Map<string, boolean>>
  >;
  getAllSelectedToolNames: () => string[];
  getActiveSelectedToolNames: () => string[];
};

const SelectedToolsContext = createContext<
  SelectedToolsContextType | undefined
>(undefined);

export type SelectedToolsProviderProps = {
  children: ReactNode;
};

export const SelectedToolsProvider: FC<SelectedToolsProviderProps> = ({
  children,
}) => {
  const [selectedTools, setSelectedTools] = useState<Map<string, Set<string>>>(
    new Map()
  );
  const [activationStatuses, setActivationStatuses] = useState<Map<string, boolean>>(
    new Map()
  );

  const getAllSelectedToolNames = (): string[] => {
    const allToolNames: string[] = [];
    selectedTools.forEach((toolSet) => {
      toolSet.forEach((toolName) => {
        allToolNames.push(toolName);
      });
    });
    return allToolNames;
  };

  const getActiveSelectedToolNames = (): string[] => {
    const activeToolNames: string[] = [];
    selectedTools.forEach((toolSet, appName) => {
      // Only include tools from activated apps (default is true if not set)
      const isAppActivated = activationStatuses.get(appName) !== false;
      if (isAppActivated) {
        toolSet.forEach((toolName) => {
          activeToolNames.push(toolName);
        });
      }
    });
    return activeToolNames;
  };

  const contextValue: SelectedToolsContextType = {
    selectedTools,
    setSelectedTools,
    activationStatuses,
    setActivationStatuses,
    getAllSelectedToolNames,
    getActiveSelectedToolNames,
  };

  return (
    <SelectedToolsContext.Provider value={contextValue}>
      {children}
    </SelectedToolsContext.Provider>
  );
};

export const useSelectedToolsContext = () => {
  const context = useContext(SelectedToolsContext);
  if (!context) {
    throw new Error(
      "useSelectedToolsContext must be used within a SelectedToolsProvider"
    );
  }
  return context;
};
