export const DEFAULT_HOMEPAGE_COPY = {
  "ministries_heading": "A place to grow. A way to serve.",
  "ministries_intro": "Find fellowship and use your gifts. Take your next step with one of our church ministries.",
  "ministry_youth_intro": "Grow in faith, build friendships, and discover your purpose.",
  "ministry_women_intro": "Connect, encourage one another, and grow together in the Word.",
  "ministry_men_intro": "Build fellowship and serve your family, church, and community.",
  "ministry_praise_team_intro": "Express your interest in serving through music and worship.",
  "services_eyebrow": "YOU’RE WELCOME HERE",
  "mission_eyebrow": "FAITH IN ACTION",
  "collage_upload_2": "",
  "collage_upload_3": "",
  "collage_video_path": "",
  "collage_video_name": "",
  "collage_photo_1": "",
  "collage_photo_2": "",
  "collage_photo_3": "",
  "collage_motion": "gentle",
  "ribbon_motion": "moving",
  "hero_note": "A place to belong. A life rooted in the Word.",
  "visit_button": "Plan your visit",
  "cell_button": "Find a cell near you",
  "services_heading": "Gather with us.",
  "services_intro": "Make room for worship, the Word, and fellowship. We look forward to welcoming you.",
  "updates_heading": "Stay connected.",
  "updates_intro": "Messages, gatherings, and moments from our church.",
  "calendar_heading": "Come and be part of it.",
  "calendar_intro": "Join us for our regular services and fellowship. Special gatherings will be shared here as they are announced.",
  "gallery_heading": "Our church, together.",
  "gallery_intro": "Moments of worship, fellowship, and community.",
  "sermons_heading": "A message for your week.",
  "sermons_intro": "Explore the church’s published sermons and recordings.",
  "sermons_button": "Explore sermons",
  "mission_heading": "Growing together. Reaching others.",
  "mission_intro": "Church life continues beyond Sunday. Connect with a cell for fellowship, prayer, and a community where we grow in the Word together.",
  "mission_button": "Find your community"
};
export type HomepageCopy = typeof DEFAULT_HOMEPAGE_COPY;

export type ServiceTime = {
  eyebrow: string;
  title: string;
  day: string;
  time: string;
};

export type SiteSettings = {
  id: boolean;
  homepage_copy: HomepageCopy;
  church_name: string;
  branch_name: string;
  slogan: string;
  hero_eyebrow: string;
  annual_theme: string;
  annual_theme_year: number;
  annual_theme_scripture: string;
  hero_heading_start: string;
  hero_heading_highlight: string;
  hero_heading_end: string;
  hero_scripture: string;
  contact_phone: string;
  contact_email: string;
  contact_address: string;
  service_times: ServiceTime[];
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  id: true,
  homepage_copy: DEFAULT_HOMEPAGE_COPY,
  church_name: "NEW LIFE CHRISTIAN CENTER",
  branch_name: "ZOE BRANCH",
  slogan: "To teach the untaught and train the untrained.",
  hero_eyebrow: "WELCOME TO ZOE BRANCH",
  annual_theme: "",
  annual_theme_year: new Date().getFullYear(),
  annual_theme_scripture: "",
  hero_heading_start: "Experience the",
  hero_heading_highlight: "God kind",
  hero_heading_end: "of life.",
  hero_scripture: "John 10:10 — I have come that they may have Life, and have it more abundantly.",
  contact_phone: "",
  contact_email: "",
  contact_address: "Lusaka, Zambia — 33 Cells Citywide",
  service_times: [
    { eyebrow: "SUNDAY SERVICES", title: "Two Services", day: "SUNDAY", time: "07:30 — 10:00 & 10:30 — 13:00" },
    { eyebrow: "MIDWEEK SERVICE", title: "Word & Power", day: "EVERY WEDNESDAY", time: "17:30–19:00" },
    { eyebrow: "MORNING GLORY", title: "A Godly Tone for a Week", day: "EVERY SATURDAY", time: "05:30 — 06:30" },
  ],
};

export function mergeSiteSettings(value: Partial<SiteSettings> | null | undefined): SiteSettings {
  const serviceTimes = Array.isArray(value?.service_times)
    ? value.service_times.filter((item): item is ServiceTime =>
      Boolean(item && typeof item.eyebrow === "string" && typeof item.title === "string" && typeof item.day === "string" && typeof item.time === "string"),
    )
    : DEFAULT_SITE_SETTINGS.service_times;

  return {
    ...DEFAULT_SITE_SETTINGS,
    ...value,
    service_times: serviceTimes,
    homepage_copy: Object.fromEntries(Object.entries(DEFAULT_HOMEPAGE_COPY).map(([key,fallback])=>[key,typeof value?.homepage_copy?.[key as keyof HomepageCopy] === "string" ? value.homepage_copy[key as keyof HomepageCopy] : fallback])) as HomepageCopy,
  };
}
