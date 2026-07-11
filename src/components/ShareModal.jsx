import React, { useState } from 'react';
import { X, Share2, Copy, Check, MessageCircle, Smartphone, Globe, Sparkles, HelpCircle, ArrowRight } from 'lucide-react';

export default function ShareModal({ isOpen, onClose }) {
  const [copied, setCopied] = useState(false);
  const [shareStatus, setShareStatus] = useState("");

  if (!isOpen) return null;

  const currentUrl = window.location.href;

  const handleShareApp = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "PixelMusic Studio | 高音質レコーダー＆チューナー＆メトロノーム",
          text: "バンド練習や曲作りに使える！高音質レコーダー・チューナー・メトロノームが全部入った無料スタジオアプリ🎸 今すぐスマホで開いてみて！\n",
          url: currentUrl
        });
        setShareStatus("LINEや共有メニューを開きました！友達を選んで送信してください。");
      } else {
        handleCopyUrl();
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        handleCopyUrl();
      }
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setShareStatus("URLをクリップボードにコピーしました！LINEに貼り付けてお友達に送信できます。");
    setTimeout(() => setCopied(false), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="studio-card max-w-2xl w-full p-6 md:p-8 relative max-h-[90vh] overflow-y-auto border-2 border-emerald-500/50 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-6">
          <Share2 className="w-7 h-7 text-emerald-400" />
          <h2 className="text-2xl font-display font-bold text-white">
            友達とアプリ・録音音源を共有する方法
          </h2>
        </div>

        {shareStatus && (
          <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 p-3.5 rounded-xl mb-6 text-sm flex items-center gap-2">
            <Check className="w-5 h-5 shrink-0" />
            <span>{shareStatus}</span>
          </div>
        )}

        {/* Section 1: Share the App itself */}
        <div className="bg-black/60 border border-white/10 rounded-2xl p-5 mb-6 text-left">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-5 h-5 text-cyan-400" />
            <h3 className="font-display font-bold text-lg text-white">
              ① このアプリ自体を友達に使ってもらう（A案 PWAの特権！）
            </h3>
          </div>
          <p className="text-sm text-gray-300 mb-4 leading-relaxed">
            Webアプリなので、アプリストアからのダウンロードは不要です。友達やバンドメンバーに**下記のURLをLINEでポンッと送るだけ**で、相手のスマホ（iPhone / Android）でも全く同じチューナー・メトロノーム・レコーダーが今すぐ動きます！
          </p>

          <div className="flex gap-2 mb-4">
            <button
              onClick={handleShareApp}
              className="btn-studio btn-line flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-lg"
            >
              <Share2 className="w-4 h-4" />
              💚 LINEで友達にアプリURLを送る
            </button>
            <button
              onClick={handleCopyUrl}
              className="btn-ghost px-4 py-3 text-sm font-bold flex items-center gap-2"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? "コピー完了" : "URLコピー"}
            </button>
          </div>

          <div className="bg-white/5 p-3 rounded-lg text-xs text-gray-400 font-mono break-all border border-white/5">
            現在のアドレス: <span className="text-emerald-400 font-bold">{currentUrl}</span>
          </div>

          <div className="mt-3 text-xs text-gray-400 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
            💡 **公開のヒント**: もし現在はPCのローカル環境(`localhost`)で実行中の場合、Vercel・GitHub Pages・Cloudflare Pages等の無料サービスへデプロイすると、全員がどこからでもアクセスできる専用URL(`https://your-app.vercel.app`)が自動生成されます。
          </div>
        </div>

        {/* Section 2: Share recorded audio files via LINE */}
        <div className="bg-black/60 border border-white/10 rounded-2xl p-5 text-left">
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle className="w-5 h-5 text-emerald-400" />
            <h3 className="font-display font-bold text-lg text-white">
              ② 録音した音楽音源をLINEに送信する方法
            </h3>
          </div>
          
          <div className="space-y-3 text-sm text-gray-300">
            <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
              <span className="bg-emerald-500/20 text-emerald-400 font-bold px-2.5 py-0.5 rounded text-xs mt-0.5 shrink-0">手順 1</span>
              <div>
                <p className="font-bold text-white">ワンタップでLINE共有（Pixel 9 Pro・スマホ推奨）</p>
                <p className="text-xs text-gray-400 mt-1">
                  録音完了後、または「📁 録音ライブラリ」から **「💚 LINEで友達・グループへ送信」** ボタンを押すと、Android標準の共有画面が開きます。そこからLINEアイコンを選び、送信先のトークを選択するだけでWAV/WebMファイルを直接添付送信できます。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
              <span className="bg-cyan-500/20 text-cyan-400 font-bold px-2.5 py-0.5 rounded text-xs mt-0.5 shrink-0">手順 2</span>
              <div>
                <p className="font-bold text-white">曲名やBPM・歌詞も一緒にテキストで届く！</p>
                <p className="text-xs text-gray-400 mt-1">
                  ファイル送信と同時に、曲名や指定したKey・BPM、コメント欄に記入したコード進行や歌詞も自動でLINEのメッセージ本文に挿入されます！
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={onClose}
            className="btn-studio btn-emerald px-8 py-2.5 text-sm"
          >
            閉じてスタジオに戻る
          </button>
        </div>
      </div>
    </div>
  );
}
