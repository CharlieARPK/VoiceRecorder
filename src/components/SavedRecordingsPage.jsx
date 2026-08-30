import React, { useState } from 'react';
import { ArrowLeft, Share2, Trash2, Download } from 'lucide-react';

export default function SavedRecordingsPage({ recordings, onDeleteRecording, onBackToStudio }) {
  const [shareStatus, setShareStatus] = useState(null);

  const extensionForMime = (mimeType, fallback = 'webm') => {
    if (mimeType === 'audio/mp4' || mimeType === 'audio/m4a' || mimeType === 'audio/x-m4a') return 'm4a';
    if (mimeType === 'audio/wav' || mimeType === 'audio/wave' || mimeType === 'audio/x-wav') return 'wav';
    if (mimeType === 'audio/webm') return 'webm';
    return fallback;
  };

  const downloadRecording = (rec, fileName) => {
    const temporaryUrl = rec.url ? null : URL.createObjectURL(rec.blob);
    const link = document.createElement('a');
    link.href = rec.url || temporaryUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    if (temporaryUrl) setTimeout(() => URL.revokeObjectURL(temporaryUrl), 1000);
  };

  const handleShare = async (rec) => {
    const appUrl = new URL('./', window.location.href).href;
    const shareText = `🎸 ${rec.title}\n※音声ファイルはこの音楽スタジオアプリで録音されました！\n▼ アプリURL（ブラウザで開けます）\n${appUrl}`;
    const cleanMime = (rec.blob?.type || 'audio/webm').split(';')[0].toLowerCase();
    const fileExt = extensionForMime(cleanMime, rec.fileExt || 'webm');
    const safeTitle = rec.title.replace(/[^a-zA-Z0-9ぁ-んァ-ヶ亜-熙]/g, '_') || 'recording';
    const fileName = `${safeTitle}.${fileExt}`;

    setShareStatus({ id: rec.id, type: 'info', message: '共有画面を準備しています…' });

    try {
      if (!rec.blob) throw new Error('録音データが見つかりません');

      const file = new File([rec.blob], fileName, { type: cleanMime });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        // LINE on Android can reject a mixed payload. Share the audio file only.
        await navigator.share({
          files: [file],
          title: rec.title
        });
        setShareStatus({ id: rec.id, type: 'success', message: '音声を共有画面へ渡しました。LINEを選んで送信してください。' });
        return;
      }

      downloadRecording(rec, fileName);
      setShareStatus({ id: rec.id, type: 'warning', message: 'このブラウザは音声の直接共有に非対応です。音声を保存したので、LINEの「＋」→「ファイル」から選んでください。' });

      const encodedText = encodeURIComponent(shareText);
      window.open(`https://line.me/R/msg/text/?${encodedText}`, '_blank', 'noopener,noreferrer');
    } catch (err) {
      if (err.name === 'AbortError') {
        setShareStatus(null);
        return;
      }

      if (!rec.blob) {
        setShareStatus({ id: rec.id, type: 'warning', message: '録音データを読み込めませんでした。ページを開き直してから、もう一度お試しください。' });
        return;
      }

      downloadRecording(rec, fileName);
      setShareStatus({ id: rec.id, type: 'warning', message: 'LINEへ直接渡せなかったため音声を保存しました。LINEの「＋」→「ファイル」から選んでください。' });
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

                {shareStatus?.id === rec.id && (
                  <p
                    className={`mt-3 rounded-lg border px-3 py-2 text-xs leading-relaxed ${
                      shareStatus.type === 'success'
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        : shareStatus.type === 'warning'
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                          : 'border-sky-500/40 bg-sky-500/10 text-sky-200'
                    }`}
                  >
                    {shareStatus.message}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
