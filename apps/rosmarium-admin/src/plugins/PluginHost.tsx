import React, { createContext, useContext, useState } from 'react';

export interface AdminPage {
    name: string;
    path: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: React.ComponentType<any>;
    icon?: string;
}

export interface DashboardWidget {
    name: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: React.ComponentType<any>;
    gridSize?: number;
}

export interface AdminUIExtension {
    pages?: AdminPage[];
    widgets?: DashboardWidget[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fieldEditors?: Record<string, React.ComponentType<any>>;
}

interface PluginContextValue {
    extensions: AdminUIExtension[];
    registerExtension: (ext: AdminUIExtension) => void;
}

const PluginContext = createContext<PluginContextValue>({
    extensions: [],
    registerExtension: () => {},
});

export const PluginProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [extensions, setExtensions] = useState<AdminUIExtension[]>([]);

    const registerExtension = (ext: AdminUIExtension) => {
        setExtensions(prev => [...prev, ext]);
    };

    return (
        <PluginContext.Provider value={{ extensions, registerExtension }}>
            {children}
        </PluginContext.Provider>
    );
};

export const usePlugins = () => useContext(PluginContext);

export const PluginHost: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    // In a real implementation, this component might fetch the list of active
    // plugins from the server and dynamically import their bundled frontend assets.
    // For now, it simply wraps the app with the PluginProvider.
    return (
        <PluginProvider>
            {children}
        </PluginProvider>
    );
};
