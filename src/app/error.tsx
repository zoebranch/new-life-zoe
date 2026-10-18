"use client";
import Link from 'next/link';

export default function ErrorPage({retry}:{error:Error&{digest?:string};retry:()=>void}){
 return <main className="site-recovery"><p className="site-recovery-label">ZOE BRANCH</p><h1>We couldn’t load this page.</h1><p>Please try again. If the problem continues, return to the homepage and open the page again.</p><div><button onClick={()=>retry()}>Try again ↻</button><Link href="/">Go to homepage</Link></div></main>;
}
