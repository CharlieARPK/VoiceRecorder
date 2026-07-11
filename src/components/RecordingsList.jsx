import React, { useState } from 'react';
import { Play, Pause, Share2, Trash2, Edit3, Check, X, Download, Tag, Music, Clock, Calendar, MessageCircle } from 'lucide-react';

export default function RecordingsList({ recordings, onDeleteRecording, onUpdateRecording }) {
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editKey, setEditKey] = useState("");
  const [editBpm, setEditBpm] = useState("");
  const [editLyrics, setEditLyrics] = useState("");
  const [shareFeedbackId, setShareFeedbackId] = useState(null);
  const [shareMessage, setShareMessage] = useState("");

  const startEditing = (rec) => {
    setEditingId(rec.id);
    setEditTitle(rec.title || "");
    setEditKey(rec.key || "指定なし");
    setEditBpm(rec.bpm || 120);
    setEditLyrics(rec.lyrics || "");
  };

  const saveEditing = (id) => {
    onUpdateRecording(id, {
      title: editTitle,
      key: editKey,
      bpm: Number(editBpm) || 120,
      lyrics: editLyrics
    });
    setEditingId(null);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleShareToLine = async (track) => {
    try {
      const fileName = `${track.title.replace(/[^a-zA-Z0-9ぁ-んァ-ヶ亜-熙]/g, '_') || 'recording'}.${track.fileExt || 'wav'}`;
      const file = new File([track.blob], fileName, { type: track.blob.type });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: track.title,
          text: `🎸 ${track.title}\n（Key: ${track.key || '指定なし'}, BPM: ${track.bpm || '指定なし'}）\n\n${track.lyrics ? `【メモ/歌詞】\n${track.lyrics}\n\n` : ''}LINEで音楽メモを共有します！`
        });
        setShareFeedbackId(track.id);
        setShareMessage("LINEや共有メニューを開きました！");
      } else {
        const a = document.createElement('a');
        a.href = track.url;
        a.download = fileName;
        a.click();
        setShareFeedbackId(track.id);
        setShareMessage("ファイルをダウンロードしました！LINEのトークにそのままドラッグして送信できます。");
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("Share error:", err);
        setShareFeedbackId(track.id);
        setShareMessage("ダウンロードしてLINEから送信してください。");
      }
    }
  };

  if (!recordings || recordings.length === 0) {
    return (
      <div className="studio-card p-12 text-center max-w-2xl mx-auto my-4 text-gray-500">
        <Music className="w-12 h-12 mx-auto mb-3 opacity-40 text-emerald-400" />
        <h3 className="text-lg font-bold text-gray-300 mb-1">まだ保存された録音がありません</h3>
        <p className="text-sm">「🎙️ レコーダー」タブから録音を行い、「📁 録音ライブラリに保存する」を押すとここにストックされます。</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto my-4 space-y-4">
      <div className="flex items-center justify-between mb-2 px-2">
        <h2 className="text-xl font-display font-bold text-gray-200">
          📁 保存された音楽メモ・録音リスト ({recordings.length}曲)
        </h2>
        <span className="text-xs text-gray-400">ワンタップでLINEへ送信可能</span>
      </div>

      {recordings.map((rec) => {
        const isEditing = editingId === rec.id;

        return (
          <div 
            key={rec.id} 
            className="studio-card p-5 md:p-6 transition-all hover:border-white/20 relative"
          >
            {isEditing ? (
              /* Edit Mode Form */
              <div className="space-y-4 text-left">
                <div className="flex justify-between items-center pb-2 border-b border-white/10">
                  <span className="font-bold text-sm text-emerald-400">曲名・メタデータの編集</span>
                  <div className="flex gap-2">
                    <button onClick={() => saveEditing(rec.id)} className="btn-studio btn-emerald py-1 px-3 text-xs">
                      <Check className="w-4 h-4" /> 保存
                    </button>
                    <button onClick={() => setEditingId(null)} className="btn-ghost py-1 px-3 text-xs">
                      <X className="w-4 h-4" /> キャンセル
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">曲タイトル</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="studio-input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">キー (Key)</label>
                    <input
                      type="text"
                      value={editKey}
                      onChange={(e) => setEditKey(e.target.value)}
                      className="studio-input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">BPM</label>
                    <input
                      type="number"
                      value={editBpm}
                      onChange={(e) => setEditBpm(e.target.value)}
                      className="studio-input w-full text-sm font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">歌詞・コード・メモ</label>
                  <textarea
                    value={editLyrics}
                    onChange={(e) => setEditLyrics(e.target.value)}
                    rows={2}
                    className="studio-input w-full text-sm resize-none"
                  />
                </div>
              </div>
            ) : (
              /* Normal Display Mode */
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
                      {rec.title}
                      <span className="text-[11px] font-mono bg-white/10 text-gray-300 px-2 py-0.5 rounded">
                        {rec.fileExt?.toUpperCase() || 'AUDIO'}
                      </span>
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mt-1 font-mono">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-gray-500" />
                        {rec.date}
                      </span>
                      <span className="flex items-center gap-1 text-emerald-400 font-bold">
                        <Clock className="w-3.5 h-3.5" />
                        {formatTime(rec.duration || 0)}
                      </span>
                      {rec.key && rec.key !== "指定なし" && (
                        <span className="bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                          Key: {rec.key}
                        </span>
                      )}
                      {rec.bpm && rec.bpm > 0 && (
                        <span className="bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">
                          BPM: {rec.bpm}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-start">
                    <button
                      onClick={() => startEditing(rec)}
                      className="btn-ghost p-2 rounded-lg text-gray-400 hover:text-white"
                      title="曲情報・メモを編集"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteRecording(rec.id)}
                      className="btn-ghost p-2 rounded-lg text-gray-400 hover:text-rose-400"
                      title="削除する"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Lyrics / Notes display */}
                {rec.lyrics && (
                  <div className="bg-black/40 p-3 rounded-xl border border-white/5 my-3 text-sm text-gray-300 text-left whitespace-pre-wrap font-sans">
                    <span className="text-[10px] text-amber-400 font-bold block mb-1 uppercase tracking-wider">
                      📝 Lyrics / Notes
                    </span>
                    {rec.lyrics}
                  </div>
                )}

                {/* Audio Preview Bar */}
                <div className="bg-black/50 p-2.5 rounded-xl border border-white/10 my-3">
                  <audio src={rec.url} controls className="w-full h-10 rounded accent-emerald-500" />
                </div>

                {/* Share Feedback Toast */}
                {shareFeedbackId === rec.id && (
                  <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 p-2.5 rounded-xl mb-3 text-xs flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    <span>{shareMessage}</span>
                  </div>
                )}

                {/* Bottom Action buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
                  <a
                    href={rec.url}
                    download={`${rec.title}.${rec.fileExt || 'wav'}`}
                    className="btn-ghost py-1.5 px-3 text-xs rounded-lg inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    端末へ保存 ({rec.fileExt})
                  </a>

                  <button
                    onClick={() => handleShareToLine(rec)}
                    className="btn-studio btn-line py-2 px-5 text-sm font-bold flex items-center gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    💚 LINEで友達・グループへ送信
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
