export type ToastType = "info" | "warn" | "error";
export type ToastFn = (msg: string, type?: ToastType) => void;
