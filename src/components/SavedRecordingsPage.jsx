import React from 'react';
import { ArrowLeft, Share2, Trash2, Download, Music, Disc } from 'lucide-react';

export default function SavedRecordingsPage({ recordings, onDeleteRecording, onBackToStudio }) {
  const handleShare = async (rec) => {
    try {
      const fileName = `${rec.title.replace(/[^a-zA-Z0-9ぁ-んァ-ヶ亜-熙]/g, '_') || 'recording'}.${rec.fileExt || 'wav'}`;
      const file = new File([rec.blob], fileName, { type: rec.blob.type });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: rec.title,
          text: `🎸 ${rec.title}\nLINEで録音した音源を送信します！`
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
    <div className="animate-fade-in pb-12">
      {/* Top Back Navigation Header */}
      <div className="flex items-center justify-between mb-6 border-b border-[#30363d] pb-4">
        <button
          onClick={onBackToStudio}
          className="btn-green py-2 px-4 text-sm flex items-center gap-2 cursor-pointer shadow-md"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>スタジオ画面に戻る</span>
        </button>
        <span className="text-sm font-mono text-gray-400">
          全 {recordings.length} トラック
        </span>
      </div>

      <div className="hardware-card mb-6">
        <h2 className="text-xl font-bold font-sans text-white flex items-center gap-2.5 pb-3 border-b border-[#30363d] mb-6 text-left">
          <Disc className="w-6 h-6 text-emerald-400 animate-spin-slow" />
          <span>保存した録音ライブラリ</span>
        </h2>

        {recordings.length === 0 ? (
          <div className="py-16 text-center text-gray-500 bg-[#0b0e14] rounded-2xl border border-[#30363d]">
            <p className="text-base font-bold text-gray-400 mb-2">保存された録音がありません</p>
            <p className="text-sm">スタジオ画面に戻って、録音・保存ボタンを押すとここに一覧表示されます。</p>
            <button
              onClick={onBackToStudio}
              className="mt-6 btn-green py-2 px-6 text-sm"
            >
              録音しに行く
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
                      <span>🕒 {rec.date}</span>
                      <span>⏱️ 録音時間: {Math.floor(rec.duration / 60)}分{(rec.duration % 60).toString().padStart(2, '0')}秒</span>
                      <span className="uppercase bg-[#21262d] px-2 py-0.5 rounded text-gray-300">{rec.fileExt}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteRecording(rec.id)}
                    className="text-gray-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                    title="この録音を削除"
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
                    className="px-4 py-2 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-gray-300 hover:text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors border border-[#30363d]"
                  >
                    <Download className="w-4 h-4" />
                    <span>端末へダウンロード ({rec.fileExt?.toUpperCase()})</span>
                  </a>

                  <button
                    onClick={() => handleShare(rec)}
                    className="btn-green py-2 px-5 text-xs font-bold flex items-center gap-2 shadow-md cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>LINEで友達へ送信 / 共有</span>
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
