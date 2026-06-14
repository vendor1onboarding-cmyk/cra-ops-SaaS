type FileUploadProps = {
  onSelect: (file: File | null) => void;
};

export default function FileUpload({ onSelect }: FileUploadProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-slate-700">
        Upload Photo (Optional)
      </label>

      <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-primary hover:bg-primary/5 transition-all">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) =>
            onSelect(e.target.files ? e.target.files[0] : null)
          }
          id="file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer block">
          <div className="text-3xl mb-2">📸</div>
          <p className="text-sm font-medium text-slate-700">
            Click to upload photo
          </p>
          <p className="text-xs text-slate-500 mt-1">
            PNG, JPG up to 10MB
          </p>
        </label>
      </div>
    </div>
  );
}
