//global.d.ts
export { };
declare global {
    interface Window {
        electronAPI: {
            runDocker: (topology: any) => Promise<{ success: boolean; message: string }>;
            stopDocker: () => Promise<{ success: boolean; message: string }>;
            getDockerStatus: () => Promise<{ success: boolean; containers: any[] }>;
            pruneDocker: () => Promise<{ success: boolean; message: string }>;
            checkDocker: () => Promise<boolean>;
            openTerminal: (containerId: string) => Promise<{ success: boolean; message: string; error?: string }>;
            onDockerProgress: (callback: (event: any, data: { message: string }) => void) => () => void;
        };
    }
}