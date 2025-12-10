import { create } from 'zustand'

let toastId = 0

export const useToastStore = create((set, get) => ({
  toasts: [],

  /**
   * 顯示 Toast 通知
   * @param {string} message - 訊息內容
   * @param {'success' | 'error' | 'warning' | 'info'} type - 類型
   * @param {number} duration - 持續時間 (毫秒),預設 4000
   */
  showToast: (message, type = 'info', duration = 4000) => {
    const id = ++toastId
    const toast = { id, message, type, duration }

    set((state) => ({
      toasts: [...state.toasts.slice(-2), toast], // 最多保留 3 個
    }))

    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id)
      }, duration)
    }

    return id
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },

  // 便捷方法
  success: (message, duration = 3000) => get().showToast(message, 'success', duration),
  error: (message, duration = 5000) => get().showToast(message, 'error', duration),
  warning: (message, duration = 4000) => get().showToast(message, 'warning', duration),
  info: (message, duration = 4000) => get().showToast(message, 'info', duration),
}))
