import React from 'react';
import { ArrowLeft, Share2, Trash2, Download } from 'lucide-react';

export default function SavedRecordingsPage({ recordings, onDeleteRecording, onBackToStudio }) {
  const handleShare = async (rec) => {
    try {
      const fileName = `${rec.title.replace(/[^a-zA-Z0-9ぁ-んァ-ヶ亜-熙]/g, '_') || 'recording'}.${rec.fileExt || 'wav'}`;
      
      // Strip any extra codec parameters like ";codecs=opus" because Android Chrome's canShare fails if parameters are present
      const cleanMime = (rec.blob?.type || 'audio/webm').split(';')[0];
      const file = new File([rec.blob], fileName, { type: cleanMime });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: rec.title,
          text: `🎸 ${rec.title}\nLINEで録音した音源を送信します！`
        });
      } else if (navigator.share) {
        // Try direct file share via Web Share API
        await navigator.share({
          files: [file],
          title: rec.title,
          text: `🎸 ${rec.title}`
        });
      } else {
        // Fallback for PC or browsers without native Web Share API: open LINE app/web directly
        const encodedText = encodeURIComponent(`🎸 ${rec.title}\n録音したスタジオ音源をお届けします！`);
        window.open(`https://line.me/R/msg/text/?${encodedText}`, '_blank');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        // If file sharing threw an exception, fall back directly to opening LINE
        const encodedText = encodeURIComponent(`🎸 ${rec.title}\nスタジオ録音音源を送信します`);
        window.open(`https://line.me/R/msg/text/?${encodedText}`, '_blank');
      }
    }
  };

  return (
    <div className="animate-fade-in pb-12">
      {/* Top Back Navigation Header */}
      <div className="flex items-center justify-between mb-6 border-b border-[#30363d] pb-4">
        <button
          onClick={onBackToStudio}
          className="btn-green py-2 px-5 text-sm flex items-center gap-2 cursor-pointer shadow-md font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>スタジオに戻る</span>
        </button>
        <span className="text-sm font-mono text-gray-400 font-bold">
          {recordings.length} トラック
        </span>
      </div>

      <div className="hardware-card mb-6">
        <h2 className="text-xl font-bold font-sans text-white pb-3 border-b border-[#30363d] mb-6 text-left">
          保存した録音ライブラリ
        </h2>

        {recordings.length === 0 ? (
          <div className="py-16 text-center text-gray-400 bg-[#0b0e14] rounded-2xl border border-[#30363d]">
            <p className="text-base font-bold text-gray-300 mb-2">保存された録音がありません</p>
            <button
              onClick={onBackToStudio}
              className="mt-4 btn-green py-2 px-6 text-sm font-bold"
            >
              スタジオへ戻る
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {recordings.map((rec) => (
              <div
                key={rec.id}
                className="bg-[#0b0e14] border border-[#30363d] hover:border-emerald-500/50 p-5 rounded-2xl text-left transition-all"
              >
                <div className="flex justify-between items-start gap-3 mb-3">
                  <div>
                    <h3 className="font-bold text-white text-lg tracking-wide">{rec.title}</h3>
                    <div className="flex items-center gap-3 text-xs font-mono text-gray-400 mt-1">
                      <span>{rec.date}</span>
                      <span>⏱️ {Math.floor(rec.duration / 60)}分{(rec.duration % 60).toString().padStart(2, '0')}秒</span>
                      <span className="uppercase bg-[#21262d] px-2 py-0.5 rounded text-gray-200 font-bold">{rec.fileExt}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteRecording(rec.id)}
                    className="text-gray-400 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                    title="削除"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                {/* Audio Player */}
                <div className="mb-4 bg-[#161b22] p-2 rounded-xl border border-[#21262d]">
                  <audio src={rec.url} controls className="w-full h-11 accent-emerald-500" />
                </div>

                {/* Download and LINE share buttons */}
                <div className="flex flex-wrap justify-end items-center gap-3 pt-3 border-t border-[#30363d]">
                  <a
                    href={rec.url}
                    download={`${rec.title}.${rec.fileExt}`}
                    className="px-4 py-2.5 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-white hover:text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors border border-[#30363d] shadow-sm cursor-pointer no-underline"
                  >
                    <Download className="w-4 h-4" />
                    <span>ダウンロード ({rec.fileExt?.toUpperCase()})</span>
                  </a>

                  <button
                    onClick={() => handleShare(rec)}
                    className="btn-green py-2.5 px-5 text-xs font-bold flex items-center gap-2 shadow-md cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>LINEで送信</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
