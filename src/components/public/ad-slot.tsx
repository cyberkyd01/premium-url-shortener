/** Renders an admin-defined advertisement snippet. Server component; safe to use inside pages. */
export function AdSlot({ code, className }: { code: string | null | undefined; className?: string }) {
  if (!code) return null;
  return <div className={className ?? "my-6 text-center"} dangerouslySetInnerHTML={{ __html: code }} />;
}
