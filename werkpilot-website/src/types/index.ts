// Navigation
export interface NavLink {
  href: string;
  label: string;
}

// Testimonials
export interface Testimonial {
  quote: string;
  author: string;
  role: string;
  company: string;
  result: string;
  initials: string;
}

// FAQ
export interface FAQ {
  question: string;
  answer: string;
}

// Service package
export interface ServicePackage {
  title: string;
  price: string;
  description: string;
  link: string;
  dataTrack?: string;
  featured?: boolean;
  badge?: string;
}

// Comparison item
export interface ComparisonItem {
  label: string;
  price: string;
  period: string;
  features: string[];
  highlight: boolean;
  strikethrough: boolean;
  badge?: string;
}

// Result metric
export interface ResultMetric {
  end: number;
  prefix: string;
  suffix: string;
  description: string;
  color: string;
}

// Trust badge
export interface TrustBadge {
  icon: React.ReactNode;
  title: string;
  description: string;
}

// Step in how-it-works
export interface Step {
  number: string;
  title: string;
  description: string;
  link: string;
  linkText: string;
}

// Form data for fitness check
export interface FitnessCheckFormData {
  firmenname: string;
  website: string;
  branche: string;
  kanton: string;
  hasBlog: string;
  usesSocialMedia: string;
  neukunden: string;
  name: string;
  email: string;
  telefon: string;
}

// Analytics event
export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, string>;
}

// Media logo
export interface MediaLogo {
  name: string;
  weight: number;
  size: string;
  tracking: string;
}
