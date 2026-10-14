"use client";
import { useState } from "react";
import Link from "next/link";
import WelcomePhotoCollage from "@/components/welcome-photo-collage";
import PublicSiteContent from "@/components/public-site-content";
import HomeMinistries from "@/components/home-ministries";
import { SiteImage } from "@/components/site-image";
import { useSiteSettings } from "@/lib/use-site-settings";
import "./home.css";
import "./inspired-home.css";

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const settings = useSiteSettings();
  const closeMenu = () => setMenuOpen(false);
  return <main className="zoe-home zoe-inspired">
    <a href="#home" className="home-skip">Skip to content</a>
    <header className="home-header">
      <div className="home-wrap home-header-inner">
        <a href="#home" className="home-brand" onClick={closeMenu} aria-label={`${settings.church_name}, ${settings.branch_name} home`}>
          <SiteImage slot="church-logo" fallbackSrc="/logo.png" alt="" width={48} height={48} />
          <span><strong>{settings.church_name}</strong><small>{settings.branch_name}</small></span>
        </a>
        <button className="home-menu-toggle" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="home-navigation" onClick={()=>setMenuOpen(!menuOpen)}>{menuOpen ? "Close ×" : "Menu ☰"}</button>
        <nav id="home-navigation" aria-label="Main navigation" className={`home-navigation ${menuOpen ? "is-open" : ""}`} onKeyDown={(event)=>{if(event.key === "Escape")closeMenu();}}>
          <a href="/visit" onClick={closeMenu}>Visit us</a>
          <a href="#announcements" onClick={closeMenu}>What’s on</a>
          <Link href="/cells" onClick={closeMenu}>Our cells</Link>
          <Link href="/sermons" onClick={closeMenu}>Sermons</Link>
          <Link href="/leaders" className="home-login" onClick={closeMenu}>Leader login <span aria-hidden="true">↗</span></Link>
        </nav>
      </div>
    </header>
    <section id="home" className="home-hero">
      <div className="home-hero-copy">
        <p className="home-eyebrow">{settings.hero_eyebrow}</p>
        {settings.annual_theme.trim() && settings.annual_theme_year === new Date().getFullYear() && <div className="home-annual-theme"><p>THEME OF THE YEAR · {settings.annual_theme_year}</p><h2>{settings.annual_theme}</h2>{settings.annual_theme_scripture && <span>{settings.annual_theme_scripture}</span>}</div>}
        <h1>{settings.hero_heading_start} <em>{settings.hero_heading_highlight}</em> {settings.hero_heading_end}</h1>
        <p className="home-hero-scripture">{settings.hero_scripture}</p>
        <div className="home-actions"><a href="/visit" className="home-button home-button-red">{settings.homepage_copy.visit_button} <span aria-hidden="true">↗</span></a><Link href="/cells" className="home-text-link">{settings.homepage_copy.cell_button} <span aria-hidden="true">→</span></Link><a href="#ministries" className="home-text-link">Join a ministry <span aria-hidden="true">→</span></a></div>
        <div className="home-hero-note"><span className="home-note-line"/><p>{settings.homepage_copy.hero_note}</p></div>
      </div>
      <div className="home-hero-photo">
        <SiteImage slot="homepage-hero" fallbackSrc="/hero.jpg" alt="Ministry at New Life Christian Center, Zoe Branch" fill priority sizes="100vw" className="home-cover" />
        <div className="home-photo-caption"><span>{settings.church_name}</span><strong>{settings.branch_name}</strong></div>
      </div>
    </section>
    <div className={`home-welcome-ribbon ${settings.homepage_copy.ribbon_motion === "still" ? "home-ribbon-still" : ""}`} aria-hidden="true"><div className="home-ribbon-track">{[0,1].map(group=><div className="home-ribbon-group" key={group}>{[0,1,2,3].map(index=><span key={index}>{settings.hero_eyebrow}</span>)}</div>)}</div></div>
    <section id="service-times" className="home-section home-services">
      <div className="home-wrap">
        <div className="home-section-heading"><div><p className="home-eyebrow">{settings.homepage_copy.services_eyebrow}</p><h2>{settings.homepage_copy.services_heading}</h2></div><p>{settings.homepage_copy.services_intro}</p></div>
        <div className="inspired-visit-layout"><div><div className="home-service-grid">{settings.service_times.map((service,index)=><article className="home-service" key={`${service.eyebrow}-${index}`}><span className="home-service-number">0{index+1}</span><p className="home-eyebrow">{service.eyebrow}</p><h3>{service.title}</h3><div className="home-service-time"><span>{service.day}</span><strong>{service.time}</strong></div></article>)}</div>
        {settings.contact_address && <p className="home-location"><span aria-hidden="true">◎</span> {settings.contact_address}</p>}
        </div><WelcomePhotoCollage /></div>
      </div>
    </section>
    <PublicSiteContent />
    <HomeMinistries />
    <section id="evangelism" className="home-section home-mission">
      <div className="home-wrap home-mission-inner"><div><p className="home-eyebrow">{settings.homepage_copy.mission_eyebrow}</p><h2>{settings.homepage_copy.mission_heading}</h2></div><div><p>{settings.homepage_copy.mission_intro}</p><Link href="/cells" className="home-button home-button-red">{settings.homepage_copy.mission_button} <span aria-hidden="true">→</span></Link></div></div>
    </section>
    <footer className="home-footer"><div className="home-wrap">
      <div className="home-footer-grid"><div><a href="#home" className="home-brand"><SiteImage slot="church-logo" fallbackSrc="/logo.png" alt="" width={48} height={48}/><span><strong>{settings.church_name}</strong><small>{settings.branch_name}</small></span></a><p className="home-footer-slogan">{settings.slogan}</p></div><div><h3>Explore</h3><a href="#service-times">Service times</a><a href="#announcements">Church updates</a><Link href="/cells">Find a cell</Link><a href="#ministries">Join a ministry</a><Link href="/sermons">Sermons</Link></div><div><h3>Get in touch</h3>{settings.contact_address && <p>{settings.contact_address}</p>}{settings.contact_phone && <a href={`tel:${settings.contact_phone}`}>{settings.contact_phone}</a>}{settings.contact_email && <a href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a>}<Link href="/leaders">Leader login <span aria-hidden="true">↗</span></Link></div></div>
      <div className="home-footer-bottom"><p>© {new Date().getFullYear()} {settings.church_name} · {settings.branch_name}</p><a href="#home">Back to top ↑</a></div>
    </div></footer>
  </main>;
}
