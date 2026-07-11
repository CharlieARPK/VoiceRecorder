import React from 'react';
import { X, Share2, Trash2, Download, Music } from 'lucide-react';

export default function SavedRecordingsModal({ isOpen, onClose, recordings, onDeleteRecording }) {
  if (!isOpen) return null;

  const handleShare = async (rec) => {
    try {
      const fileName = `${rec.title.replace(/[^a-zA-Z0-9ぁ-んァ-ヶ亜-熙]/g, '_') || 'recording'}.${rec.fileExt || 'wav'}`;
      const file = new File([rec.blob], fileName, { type: rec.blob.type });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: rec.title,
          text: `🎸 ${rec.title}\nLINEで録音音源を送信します！`
        });
      } else {
        const a = document.createElement('a');
        a.href = rec.url;
        a.download = fileName;
        a.click();
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        const a = document.createElement('a');
        a.href = rec.url;
        a.download = `${rec.title}.${rec.fileExt || 'wav'}`;
        a.click();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="hardware-card max-w-xl w-full max-h-[85vh] overflow-y-auto relative border border-emerald-500/30">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#30363d]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Music className="w-5 h-5 text-emerald-400" />
            <span>録音した音声リスト ({recordings.length})</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg bg-[#21262d]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {recordings.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">
            まだ保存された録音がありません。<br />
            「保存」ボタンを押したファイルがここに表示されます。
          </div>
        ) : (
          <div className="space-y-4">
            {recordings.map((rec) => (
              <div key={rec.id} className="bg-[#0b0e14] border border-[#30363d] p-4 rounded-xl text-left">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div>
                    <h3 className="font-bold text-white text-base">{rec.title}</h3>
                    <span className="text-xs font-mono text-gray-400">{rec.date}</span>
                  </div>
                  <button
                    onClick={() => onDeleteRecording(rec.id)}
                    className="text-gray-500 hover:text-red-400 p-1.5 rounded"
                    title="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="mb-3">
                  <audio src={rec.url} controls className="w-full h-10 accent-emerald-500" />
                </div>

                <div className="flex justify-between items-center gap-2 pt-2 border-t border-[#30363d]/50">
                  <a
                    href={rec.url}
                    download={`${rec.title}.${rec.fileExt}`}
                    className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    保存 ({rec.fileExt?.toUpperCase()})
                  </a>

                  <button
                    onClick={() => handleShare(rec)}
                    className="btn-green py-1.5 px-4 text-xs flex items-center gap-1.5 shadow-none"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>LINEで送信</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 text-center">
          <button onClick={onClose} className="btn-green px-8 py-2 text-sm">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
