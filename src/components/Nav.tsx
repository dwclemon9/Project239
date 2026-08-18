'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/log', label: 'Log' },
  { href: '/wellness', label: 'Check-in' },
  { href: '/races', label: 'Races' },
  { href: '/zones', label: 'Zones' },
  { href: '/settings', label: 'Settings' },
];

export default function Nav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <header className="topbar">
      <Link href="/" className="brand">
        Project239 <span>/ training</span>
      </Link>
      <nav className="nav">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} aria-current={isActive(link.href) ? 'page' : undefined}>
            {link.label}
          </Link>
        ))}
      </nav>
      <Link href="/log/new" className="btn btn-primary">
        Log session
      </Link>
    </header>
  );
}
