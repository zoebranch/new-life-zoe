import Link from 'next/link';

export default function NotFound(){
 return <main className="site-recovery"><p className="site-recovery-label">ZOE BRANCH · 404</p><h1>Let’s get you back.</h1><p>This page may have moved, or the link may be incomplete.</p><div><Link href="/">Go to homepage ↗</Link><Link href="/cells">Find a cell</Link></div></main>;
}
