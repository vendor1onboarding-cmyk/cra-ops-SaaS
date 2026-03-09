type ConfirmationModalProps = {
  open?: boolean;
  isOpen?: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
};

export default function ConfirmationModal({
  open,
  isOpen,
  title,
  message,
  confirmLabel = "OK",
  confirmText,
  cancelText = "Cancel",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  const visible = open ?? isOpen ?? false;
  const confirmButtonLabel = confirmText || confirmLabel;

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 print:hidden">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-600">{message}</p>
          </div>
          <span className="text-xl" aria-hidden>
            ✅
          </span>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          {onCancel && (
            <button
              className="btn-secondary px-5 py-2"
              onClick={onCancel}
              disabled={isLoading}
            >
              {cancelText}
            </button>
          )}
          <button
            className="btn-primary px-5 py-2"
            onClick={onConfirm}
            disabled={isLoading}
            autoFocus
          >
            {isLoading ? "Please wait..." : confirmButtonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
