export function YouTube({ id, title }: { id: string; title?: string }) {
  return (
    <div className="aspect-video my-6 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title={title ?? 'YouTube video'}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="w-full h-full border-0"
      />
    </div>
  );
}
