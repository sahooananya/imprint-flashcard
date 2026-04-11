import './globals.css';

export const metadata = {
  title: 'Imprint — Leave a mark on your memory.',
  description: 'Built for the long game.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="grain antialiased">{children}</body>
    </html>
  );
}
