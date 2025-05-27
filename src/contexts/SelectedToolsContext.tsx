/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
