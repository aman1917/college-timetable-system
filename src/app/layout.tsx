import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'College Timetable Management System',
  description: 'Academic structure, faculty, subjects, allocation and collision-free timetabling.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applied before paint so a dark-mode user never sees a white flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('ctms-theme');
              if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){
                document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
