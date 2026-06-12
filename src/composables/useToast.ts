import { reactive } from 'vue'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
    id: number
    message: string
    type: ToastType
}

const toasts = reactive<Toast[]>([])
let nextId = 0

export function useToast() {
    function show(message: string, type: ToastType = 'success', timeout = 4000) {
        const id = nextId++
        toasts.push({ id, message, type })
        setTimeout(() => dismiss(id), timeout)
    }

    function dismiss(id: number) {
        const idx = toasts.findIndex((t) => t.id === id)
        if (idx >= 0) toasts.splice(idx, 1)
    }

    return { toasts, show, dismiss }
}
