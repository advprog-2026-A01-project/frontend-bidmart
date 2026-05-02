declare global {
    interface Window {
        Tesseract?: {
            createWorker: (
                langs?: string,
                oem?: number,
                options?: { logger?: (message: { status?: string; progress?: number }) => void }
            ) => Promise<{
                recognize: (image: Blob | File | string) => Promise<{ data: { text: string } }>
                terminate: () => Promise<void>
            }>
        }
    }
}

export {}