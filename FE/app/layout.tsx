import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './globals.css';
import ButtonEnhancer from '../components/ui/ButtonEnhancer';

export const metadata = { title: 'SIMONIK — Kinerja & Risiko', description: 'Modul Manajemen Kinerja dan Manajemen Risiko SIMONIK' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="id"><body><ButtonEnhancer />{children}</body></html>; }
