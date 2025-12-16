type FileUploadProps = {
  onSelect: (file: File | null) => void;
};

export default function FileUpload({ onSelect }: FileUploadProps) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-slate-700">
        Upload Photo (Optional)
      </label>

      <input
        type="file"
        accept="image/*"
        className="block w-full text-sm text-slate-600"
        onChange={(e) =>
          onSelect(e.target.files ? e.target.files[0] : null)
        }
      />
    </div>
  );
}
