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

import { createContext, FC, ReactNode, useContext } from "react";
import { Dependencies } from "../configurations/Dependencies";
import { setupRealDependencies } from "../configurations/RealDependencies";

// Create the context with undefined as initial value
const DependenciesContext = createContext<Dependencies | undefined>(undefined);

// Provider props type
export type DependenciesProviderProps = {
  children: ReactNode;
};

// Provider component
export const DependenciesProvider: FC<DependenciesProviderProps> = ({
  children,
}) => {
  // Initialize the dependencies container
  const dependencies = setupRealDependencies();

  return (
    <DependenciesContext.Provider value={dependencies}>
      {children}
    </DependenciesContext.Provider>
  );
};

// Hook for consuming the context
export const useDependencies = () => {
  const context = useContext(DependenciesContext);
  if (!context) {
    throw new Error(
      "useDependencies must be used within a DependenciesProvider"
    );
  }
  return context;
};
