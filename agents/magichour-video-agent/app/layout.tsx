export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", padding: 16 }}>
        {children}
      </body>
    </html>
  );
}

