// On the resolve / destination page after a mode-generated QR is scanned
export function ViralFooter({ modeId }: { modeId: string }) {
  const href = `https://authichain.com/generate?mode=${modeId}&utm_source=qr_footer&utm_medium=scan`;
  return (
    <footer className="text-center text-sm mt-8">
      <a
        href={href}
        onClick={() =>
          console.log(JSON.stringify({ evt: "footer_cta_click", mode_id: modeId, utm_source: "qr_footer" }))
        }
      >
        Create your own Living QR — free to try
      </a>
    </footer>
  );
}
