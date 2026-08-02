// app/layout.tsx
import './styles/globals.css';

export const metadata = {
  title: 'Andromeda',
  description: 'Andromeda proxy UI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">
        {children}
      </body>
    </html>
  );
}
